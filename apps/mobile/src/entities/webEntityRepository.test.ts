import {
  EntityMemorySchema,
  USER_NOTE_EVIDENCE_ID,
  type CreateContactCard,
  type CreateMeetingCard,
  type MemoryEntry,
  type UpdateMeetingCard,
} from "@trace/contracts";
import { describe, expect, it } from "vitest";

import type { KeyValueStore } from "../storage/keyValueStore";
import { GLOBAL_MEMORY_OWNER } from "./types";
import { ENTITY_STORAGE_KEY, LEGACY_MEMORY_STORAGE_KEY, WebEntityRepository } from "./webEntityRepository";

const ids = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
  "00000000-0000-4000-8000-000000000005",
  "00000000-0000-4000-8000-000000000006",
];

function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

function repository(store: KeyValueStore) {
  let nextId = 0;
  return new WebEntityRepository({
    createId: () => ids[nextId++]!,
    now: () => "2026-08-26T03:30:00.000Z",
    store,
  });
}

describe("WebEntityRepository", () => {
  it("persists empty contact and meeting drafts without creating blank memories", async () => {
    const store = memoryStore();
    const entities = repository(store);

    const contact = await entities.createContactDraft();
    const meeting = await entities.createMeetingDraft("Asia/Shanghai");

    expect(contact).toMatchObject({ displayName: "", status: "draft" });
    expect(meeting).toMatchObject({ title: "", status: "draft" });
    expect(await entities.listContacts()).toHaveLength(1);
    expect(await entities.listMeetings()).toHaveLength(1);
    expect(await entities.listMemories({ ownerType: "contact", ownerId: contact.id })).toEqual([]);
    expect(store.getItem(ENTITY_STORAGE_KEY)).not.toBeNull();
  });

  it("lets the user add, edit and delete an entity-owned memory", async () => {
    const entities = repository(memoryStore());
    const contact = await entities.createContactDraft();
    const created = await entities.addMemory({
      ownerType: "contact",
      ownerId: contact.id,
      content: "Prefers written updates.",
    });
    const updated = await entities.updateMemory(created.id, {
      content: "Prefers a written summary before meetings.",
    });

    expect(updated).toMatchObject({ source: "manual", confidence: 1 });
    expect(EntityMemorySchema.parse(updated).content).toContain("before meetings");

    await entities.deleteMemory(created.id);
    expect(await entities.listMemories({ ownerType: "contact", ownerId: contact.id })).toEqual([]);
  });

  it("persists editable global memory without a contact or meeting", async () => {
    const entities = repository(memoryStore());
    const created = await entities.addMemory({
      ...GLOBAL_MEMORY_OWNER,
      content: "Prefer concise meeting summaries.",
    });

    expect(created).toMatchObject({ ...GLOBAL_MEMORY_OWNER, source: "manual" });
    await expect(entities.listMemories(GLOBAL_MEMORY_OWNER)).resolves.toEqual([created]);
  });

  it("applies insight-created global memory changes atomically and exactly once", async () => {
    const store = memoryStore();
    const entities = repository(store);
    const existingGlobal = await entities.addMemory({
      ...GLOBAL_MEMORY_OWNER,
      content: "Prefer long meeting summaries.",
    });
    const removableGlobal = await entities.addMemory({
      ...GLOBAL_MEMORY_OWNER,
      content: "Always schedule meetings in the morning.",
    });
    const contact = await entities.createContactDraft();
    const contactMemory = await entities.addMemory({
      ownerType: "contact",
      ownerId: contact.id,
      content: "Maya owns the design review.",
    });
    const input = {
      sourceRunId: "20000000-0000-4000-8000-000000000020",
      insightGeneratedAt: "2026-08-26T03:30:00.000Z",
      operations: [
        {
          type: "update" as const,
          memoryId: existingGlobal.id,
          content: "Prefer concise meeting summaries.",
          evidenceRefs: ["evidence-summary-style"],
          confidence: 0.96,
        },
        {
          type: "delete" as const,
          memoryId: contactMemory.id,
          evidenceRefs: ["evidence-summary-style"],
          confidence: 1,
        },
        {
          type: "delete" as const,
          memoryId: removableGlobal.id,
          evidenceRefs: ["evidence-schedule-change"],
          confidence: 0.98,
        },
        {
          type: "create" as const,
          content: "Use written follow-ups after important conversations.",
          evidenceRefs: ["evidence-written-follow-up"],
          confidence: 0.9,
        },
      ],
    };

    const first = await entities.applyGlobalMemoryOperations(input);
    const second = await entities.applyGlobalMemoryOperations(input);
    const globalMemories = await entities.listMemories(GLOBAL_MEMORY_OWNER);
    const contactMemories = await entities.listMemories({ ownerType: "contact", ownerId: contact.id });
    const persisted = JSON.parse(store.getItem(ENTITY_STORAGE_KEY) ?? "{}") as {
      globalMemoryCommits?: unknown[];
    };

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      createdMemoryIds: [expect.any(String)],
      updatedMemoryIds: [existingGlobal.id],
      deletedMemoryIds: [removableGlobal.id],
      skippedOperations: 1,
    });
    expect(globalMemories.map((memory) => memory.content)).toEqual([
      "Prefer concise meeting summaries.",
      "Use written follow-ups after important conversations.",
    ]);
    expect(globalMemories.every((memory) => memory.source === "insight")).toBe(true);
    expect(contactMemories).toEqual([contactMemory]);
    expect(persisted.globalMemoryCommits).toHaveLength(1);
  });

  it("allows a repaired insight from the same analysis run to apply a later memory operation", async () => {
    const store = memoryStore();
    const entities = repository(store);
    const sourceRunId = "20000000-0000-4000-8000-000000000022";

    await entities.applyGlobalMemoryOperations({
      sourceRunId,
      insightGeneratedAt: "2026-08-26T03:30:00.000Z",
      operations: [],
    });
    const repaired = await entities.applyGlobalMemoryOperations({
      sourceRunId,
      insightGeneratedAt: "2026-08-26T03:31:00.000Z",
      operations: [
        {
          type: "create",
          content: "Prefer concise follow-ups.",
          evidenceRefs: [USER_NOTE_EVIDENCE_ID],
          confidence: 1,
        },
      ],
    });

    expect(repaired.createdMemoryIds).toHaveLength(1);
    await expect(entities.listMemories(GLOBAL_MEMORY_OWNER)).resolves.toEqual([
      expect.objectContaining({ content: "Prefer concise follow-ups.", source: "insight" }),
    ]);
    const persisted = JSON.parse(store.getItem(ENTITY_STORAGE_KEY) ?? "{}") as {
      globalMemoryCommits?: unknown[];
    };
    expect(persisted.globalMemoryCommits).toHaveLength(2);
  });

  it("opens an Iteration 24 entity store before adding insight commit metadata", async () => {
    const store = memoryStore({
      [ENTITY_STORAGE_KEY]: JSON.stringify({
        version: 2,
        contacts: [],
        meetings: [],
        memories: [],
        entityCommits: [],
      }),
    });
    const entities = repository(store);

    await expect(entities.listAllMemories()).resolves.toEqual([]);
    await expect(
      entities.applyGlobalMemoryOperations({
        sourceRunId: "20000000-0000-4000-8000-000000000021",
        insightGeneratedAt: "2026-08-26T03:30:00.000Z",
        operations: [],
      }),
    ).resolves.toMatchObject({ skippedOperations: 0 });
  });

  it("migrates legacy contact and meeting memory without deleting v1 data", async () => {
    const legacy: MemoryEntry[] = [
      {
        id: "10000000-0000-4000-8000-000000000001",
        contactId: "native-maya",
        type: "relationship_fact",
        key: "contact:introduction",
        value: {
          kind: "contact_created",
          displayName: "Maya Chen",
          company: "Northstar",
          jobTitle: "Head of Product",
          phones: [],
          emails: ["maya@example.com"],
          notes: "Met through the design review.",
        },
        status: "active",
        sourceRunId: "20000000-0000-4000-8000-000000000001",
        sourceActionId: "create-maya",
        sourceEvidenceRefs: ["evidence-maya"],
        confidence: 0.92,
        createdAt: "2026-08-20T03:30:00.000Z",
        updatedAt: "2026-08-20T03:30:00.000Z",
      },
      {
        id: "10000000-0000-4000-8000-000000000002",
        contactId: "native-maya",
        type: "open_loop",
        key: "meeting:review",
        value: {
          kind: "scheduled_meeting",
          externalId: "native-event-review",
          title: "Design review",
          startAt: "2026-08-27T07:00:00.000Z",
          endAt: "2026-08-27T07:30:00.000Z",
          timezone: "Asia/Shanghai",
          participantNames: ["Maya Chen"],
          notes: "Send the deck first.",
        },
        status: "active",
        sourceRunId: "20000000-0000-4000-8000-000000000002",
        sourceActionId: "create-review",
        sourceEvidenceRefs: ["evidence-review"],
        confidence: 0.95,
        createdAt: "2026-08-21T03:30:00.000Z",
        updatedAt: "2026-08-21T03:30:00.000Z",
      },
    ];
    const legacyJson = JSON.stringify(legacy);
    const store = memoryStore({ [LEGACY_MEMORY_STORAGE_KEY]: legacyJson });
    const entities = repository(store);

    const contacts = await entities.listContacts();
    const meetings = await entities.listMeetings();

    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ displayName: "Maya Chen", externalContactId: "native-maya" });
    expect(meetings).toHaveLength(1);
    expect(meetings[0]).toMatchObject({ title: "Design review", externalEventId: "native-event-review" });
    expect(await entities.listMemories({ ownerType: "contact", ownerId: contacts[0]!.id })).toHaveLength(1);
    expect(await entities.listMemories({ ownerType: "meeting", ownerId: meetings[0]!.id })).toHaveLength(1);
    expect(store.getItem(LEGACY_MEMORY_STORAGE_KEY)).toBe(legacyJson);
  });

  it("commits a successful meeting and its proposed memory exactly once", async () => {
    const entities = repository(memoryStore());
    const action: CreateMeetingCard = {
      id: "create-review",
      type: "create_meeting",
      title: "Create design review",
      confidence: 0.94,
      evidenceRefs: ["evidence-review"],
      editableFields: [],
      riskFlags: [],
      memoryProposals: [
        {
          target: { type: "action_entity" },
          content: "Send the deck before the review.",
          evidenceRefs: ["evidence-review"],
        },
      ],
      payload: {
        title: "Design review",
        startAt: "2026-08-27T07:00:00.000Z",
        endAt: "2026-08-27T07:30:00.000Z",
        timezone: "Asia/Shanghai",
        participantContactIds: [],
        participantNames: [],
        notes: "Send the deck.",
      },
    };
    const input = {
      sourceRunId: "20000000-0000-4000-8000-000000000003",
      action,
      result: {
        actionId: action.id,
        success: true as const,
        provider: "demo" as const,
        externalId: "demo-event-review",
      },
      timezone: "Asia/Shanghai",
    };

    const first = await entities.commitSuccessfulAction(input);
    const second = await entities.commitSuccessfulAction(input);
    const meetings = await entities.listMeetings();
    const memories = await entities.listMemories({ ownerType: "meeting", ownerId: first.entityRef.id });

    expect(second).toEqual(first);
    expect(meetings).toHaveLength(1);
    expect(memories).toHaveLength(1);
    expect(memories[0]?.content).toBe("Send the deck before the review.");
  });

  it("keeps only the latest action-created contact marked as self", async () => {
    const entities = repository(memoryStore());
    const selfAction = (id: string, displayName: string): CreateContactCard => ({
      id,
      type: "create_contact",
      title: `Create ${displayName}`,
      confidence: 1,
      evidenceRefs: ["evidence-self"],
      editableFields: ["displayName", "isSelf"],
      riskFlags: [],
      memoryProposals: [],
      payload: {
        displayName,
        givenName: displayName,
        familyName: "",
        company: "",
        jobTitle: "",
        phones: [],
        emails: [],
        notes: "",
        isSelf: true,
        interactionSummary: "",
      },
    });
    const first = selfAction("create-self-first", "Old self");
    const second = selfAction("create-self-second", "Kai");

    for (const [index, action] of [first, second].entries()) {
      await entities.commitSuccessfulAction({
        sourceRunId: `20000000-0000-4000-8000-00000000001${index}`,
        action,
        result: {
          actionId: action.id,
          success: true,
          provider: "demo",
          externalId: `demo-${action.id}`,
        },
        timezone: "Asia/Shanghai",
      });
    }

    const contacts = await entities.listContacts();
    expect(contacts.filter((contact) => contact.isSelf)).toHaveLength(1);
    expect(contacts.find((contact) => contact.isSelf)?.displayName).toBe("Kai");
  });

  it("updates a meeting participant relationship with a local contact id", async () => {
    const entities = repository(memoryStore());
    const contact = await entities.createContactDraft();
    await entities.saveContact({ ...contact, displayName: "Maya", status: "active" });
    const meeting = await entities.createMeetingDraft("Asia/Shanghai");
    await entities.saveMeeting({ ...meeting, title: "Design review", status: "active" });
    const action: UpdateMeetingCard = {
      id: "add-maya",
      type: "update_meeting",
      title: "Add Maya to design review",
      confidence: 1,
      evidenceRefs: ["evidence-attendee"],
      editableFields: ["changes"],
      riskFlags: [],
      memoryProposals: [],
      payload: {
        meetingId: meeting.id,
        displayTitle: "Design review",
        participantNames: [],
        changes: [
          {
            field: "participantContactIds",
            previousValue: [],
            nextValue: [contact.id],
          },
        ],
      },
    };

    await entities.commitSuccessfulAction({
      sourceRunId: "20000000-0000-4000-8000-000000000004",
      action,
      result: {
        actionId: action.id,
        success: true,
        provider: "demo",
        externalId: "demo-event-review",
      },
      timezone: "Asia/Shanghai",
    });

    expect((await entities.findMeeting(meeting.id))?.participantContactIds).toEqual([contact.id]);
  });

  it("resolves synchronized meeting participants to stable local contact ids", async () => {
    const entities = repository(memoryStore());
    const sourceContact = {
      id: "native-maya",
      displayName: "Maya Chen",
      company: "Northstar",
      jobTitle: "Head of Product",
      phones: [],
      emails: ["maya@example.com"],
    };
    const sourceMeeting = {
      id: "native-review",
      externalEventId: "native-review",
      title: "Design review",
      startAt: "2026-08-27T07:00:00.000Z",
      endAt: "2026-08-27T07:30:00.000Z",
      timezone: "Asia/Shanghai",
      allDay: false,
      location: "",
      meetingLink: "",
      notes: "",
      participantContactIds: [sourceContact.id],
    };

    await entities.syncContacts([sourceContact], "ios");
    await entities.syncMeetings([sourceMeeting], "ios");
    await entities.syncContacts([{ ...sourceContact, jobTitle: "VP Product" }], "ios");

    const contacts = await entities.listContacts();
    const meetings = await entities.listMeetings();
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ externalContactId: sourceContact.id, jobTitle: "VP Product" });
    expect(meetings).toHaveLength(1);
    expect(meetings[0]?.participantContactIds).toEqual([contacts[0]?.id]);

    await entities.saveContact({ ...contacts[0]!, jobTitle: "Local role", source: "trace" });
    await entities.saveMeeting({
      ...meetings[0]!,
      participantContactIds: [],
      source: "trace",
      title: "Local review title",
    });
    await entities.syncContacts([{ ...sourceContact, jobTitle: "External role" }], "ios");
    await entities.syncMeetings([sourceMeeting], "ios");

    expect((await entities.listContacts())[0]?.jobTitle).toBe("Local role");
    expect((await entities.listMeetings())[0]).toMatchObject({
      participantContactIds: [],
      title: "Local review title",
    });
  });

  it("reconciles a preserved legacy participant external id to its local contact", async () => {
    const entities = repository(memoryStore());
    const sourceContact = {
      id: "contact-maya",
      displayName: "Maya Chen",
      company: "Atelier",
      jobTitle: "Designer",
      phones: [],
      emails: ["maya@example.com"],
    };
    await entities.syncContacts([sourceContact], "demo");
    const draft = await entities.createMeetingDraft("Asia/Shanghai");
    await entities.saveMeeting({
      ...draft,
      externalEventId: "meeting-design-review",
      participantContactIds: [sourceContact.id],
      source: "demo",
      status: "active",
      title: "Design review with Maya",
    });

    await entities.syncMeetings(
      [
        {
          id: "meeting-design-review",
          externalEventId: "meeting-design-review",
          title: "Design review with Maya",
          startAt: "2026-08-27T07:00:00.000Z",
          endAt: "2026-08-27T07:30:00.000Z",
          timezone: "Asia/Shanghai",
          allDay: false,
          location: "",
          meetingLink: "",
          notes: "",
          participantContactIds: [sourceContact.id],
        },
      ],
      "demo",
    );

    const [contact] = await entities.listContacts();
    const [meeting] = await entities.listMeetings();
    expect(meeting?.participantContactIds).toEqual([contact?.id]);
  });
});
