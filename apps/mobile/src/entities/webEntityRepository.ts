import {
  ContactRecordSchema,
  EntityMemorySchema,
  MemoryEntrySchema,
  MeetingRecordSchema,
  type ContactRecord,
  type ContactSummary,
  type EntityMemory,
  type MemoryEntry,
  type MeetingRecord,
  type MeetingSummary,
} from "@trace/contracts";

import { getDeviceKeyValueStore, type KeyValueStore } from "../storage/keyValueStore";
import { deriveActionEntityEffects } from "./actionEffects";
import { migrateLegacyMemories } from "./legacyMigration";
import {
  applyManualMemoryUpdate,
  createContactDraft,
  createManualMemory,
  createMeetingDraft,
  entityFactoryOptions,
} from "./model";
import {
  EntityCommitRecordSchema,
  EntityStoreSchema,
  type EntityCommitRecord,
  type EntityStore,
} from "./storageModel";
import type {
  CommitSuccessfulActionInput,
  EntityOwner,
  EntityRepository,
  EntityRepositoryOptions,
  ManualMemoryInput,
} from "./types";

export const ENTITY_STORAGE_KEY = "trace.entities.v2";
export const LEGACY_MEMORY_STORAGE_KEY = "trace.memories.v1";

const LegacyMemoriesSchema = MemoryEntrySchema.array();

type Options = EntityRepositoryOptions & {
  store?: KeyValueStore;
};

export class WebEntityRepository implements EntityRepository {
  private readonly factory;
  private readonly store: KeyValueStore;

  constructor(options: Options = {}) {
    this.factory = entityFactoryOptions(options);
    this.store = options.store ?? getDeviceKeyValueStore();
  }

  async initialize(): Promise<void> {
    this.read();
  }

  async listContacts(): Promise<ContactRecord[]> {
    return this.read().contacts;
  }

  async findContact(contactId: string): Promise<ContactRecord | null> {
    return (
      this.read().contacts.find(
        (contact) => contact.id === contactId || contact.externalContactId === contactId,
      ) ?? null
    );
  }

  async syncContacts(contacts: ContactSummary[], source: "demo" | "ios"): Promise<void> {
    const store = this.read();
    const now = this.factory.now();
    for (const summary of contacts) {
      const index = store.contacts.findIndex(
        (contact) => contact.externalContactId === summary.id || contact.id === summary.id,
      );
      const existing = store.contacts[index];
      const preserveExisting = Boolean(existing && (existing.source === "trace" || source === "demo"));
      const candidate = {
        id: existing?.id ?? this.factory.createId(),
        externalContactId: summary.id,
        displayName: preserveExisting ? existing!.displayName : summary.displayName,
        sortName: existing?.sortName,
        company: preserveExisting ? existing!.company : summary.company || undefined,
        jobTitle: preserveExisting ? existing!.jobTitle : summary.jobTitle || undefined,
        phones: preserveExisting ? existing!.phones : summary.phones.filter(Boolean),
        emails: preserveExisting ? existing!.emails : summary.emails.filter(Boolean),
        isSelf: existing?.isSelf ?? false,
        status: "active" as const,
        source: existing?.source ?? source,
        createdAt: existing?.createdAt ?? now,
        updatedAt: preserveExisting ? existing!.updatedAt : now,
      };
      const parsed = ContactRecordSchema.safeParse(candidate);
      const contact = parsed.success ? parsed.data : ContactRecordSchema.parse({ ...candidate, emails: [] });
      if (index >= 0) store.contacts[index] = contact;
      else store.contacts.push(contact);
    }
    this.write(store);
  }

  async createContactDraft(): Promise<ContactRecord> {
    const contact = createContactDraft(this.factory);
    const store = this.read();
    store.contacts.push(contact);
    this.write(store);
    return contact;
  }

  async saveContact(contact: ContactRecord): Promise<void> {
    const parsed = ContactRecordSchema.parse(contact);
    const store = this.read();
    const index = store.contacts.findIndex((item) => item.id === parsed.id);
    if (index >= 0) store.contacts[index] = parsed;
    else store.contacts.push(parsed);
    this.write(store);
  }

  async deleteContact(contactId: string): Promise<void> {
    const store = this.read();
    store.contacts = store.contacts.filter((contact) => contact.id !== contactId);
    this.deleteOwnedMemories(store, { ownerType: "contact", ownerId: contactId });
    for (const meeting of store.meetings) {
      meeting.participantContactIds = meeting.participantContactIds.filter((id) => id !== contactId);
    }
    this.write(store);
  }

  async listMeetings(): Promise<MeetingRecord[]> {
    return this.read().meetings;
  }

  async findMeeting(meetingId: string): Promise<MeetingRecord | null> {
    return (
      this.read().meetings.find((meeting) => meeting.id === meetingId || meeting.externalEventId === meetingId) ??
      null
    );
  }

  async syncMeetings(meetings: MeetingSummary[], source: "demo" | "ios"): Promise<void> {
    const store = this.read();
    const now = this.factory.now();
    for (const summary of meetings) {
      const externalEventId = summary.externalEventId ?? summary.id;
      const index = store.meetings.findIndex(
        (meeting) => meeting.externalEventId === externalEventId || meeting.id === summary.id,
      );
      const existing = store.meetings[index];
      const preserveExisting = Boolean(existing && (existing.source === "trace" || source === "demo"));
      const resolveParticipantContactId = (contactId: string) => {
        const contact = store.contacts.find(
          (candidate) => candidate.id === contactId || candidate.externalContactId === contactId,
        );
        return contact?.id ?? contactId;
      };
      const participantContactIds = [
        ...new Set(summary.participantContactIds.map(resolveParticipantContactId)),
      ];
      const existingParticipantContactIds = [
        ...new Set((existing?.participantContactIds ?? []).map(resolveParticipantContactId)),
      ];
      const meeting = MeetingRecordSchema.parse({
        id: existing?.id ?? this.factory.createId(),
        externalEventId,
        title: preserveExisting ? existing!.title : summary.title,
        startAt: preserveExisting ? existing!.startAt : summary.startAt ?? undefined,
        endAt: preserveExisting ? existing!.endAt : summary.endAt ?? undefined,
        timezone: preserveExisting ? existing!.timezone : summary.timezone,
        allDay: preserveExisting ? existing!.allDay : summary.allDay,
        location: preserveExisting ? existing!.location : summary.location || undefined,
        meetingLink: preserveExisting ? existing!.meetingLink : summary.meetingLink || undefined,
        notes: preserveExisting ? existing!.notes : summary.notes || undefined,
        participantContactIds: preserveExisting ? existingParticipantContactIds : participantContactIds,
        status: "active",
        source: existing?.source ?? source,
        createdAt: existing?.createdAt ?? now,
        updatedAt: preserveExisting ? existing!.updatedAt : now,
      });
      if (index >= 0) store.meetings[index] = meeting;
      else store.meetings.push(meeting);
    }
    this.write(store);
  }

  async createMeetingDraft(timezone: string): Promise<MeetingRecord> {
    const meeting = createMeetingDraft(this.factory, timezone);
    const store = this.read();
    store.meetings.push(meeting);
    this.write(store);
    return meeting;
  }

  async saveMeeting(meeting: MeetingRecord): Promise<void> {
    const parsed = MeetingRecordSchema.parse(meeting);
    const store = this.read();
    const index = store.meetings.findIndex((item) => item.id === parsed.id);
    if (index >= 0) store.meetings[index] = parsed;
    else store.meetings.push(parsed);
    this.write(store);
  }

  async deleteMeeting(meetingId: string): Promise<void> {
    const store = this.read();
    store.meetings = store.meetings.filter((meeting) => meeting.id !== meetingId);
    this.deleteOwnedMemories(store, { ownerType: "meeting", ownerId: meetingId });
    this.write(store);
  }

  async listMemories(owner: EntityOwner): Promise<EntityMemory[]> {
    return this.read().memories.filter(
      (memory) =>
        memory.status === "active" && memory.ownerType === owner.ownerType && memory.ownerId === owner.ownerId,
    );
  }

  async listAllMemories(): Promise<EntityMemory[]> {
    return this.read().memories.filter((memory) => memory.status === "active");
  }

  async addMemory(input: ManualMemoryInput): Promise<EntityMemory> {
    const store = this.read();
    this.assertOwnerExists(store, input);
    const memory = createManualMemory(this.factory, input);
    store.memories.push(memory);
    this.write(store);
    return memory;
  }

  async updateMemory(
    memoryId: string,
    patch: Pick<ManualMemoryInput, "content" | "kind">,
  ): Promise<EntityMemory> {
    const store = this.read();
    const index = store.memories.findIndex((memory) => memory.id === memoryId && memory.status === "active");
    const existing = store.memories[index];
    if (!existing) {
      throw new Error("Memory not found.");
    }
    const memory = applyManualMemoryUpdate(this.factory, existing, patch);
    store.memories[index] = memory;
    this.write(store);
    return memory;
  }

  async deleteMemory(memoryId: string): Promise<void> {
    const store = this.read();
    const index = store.memories.findIndex((memory) => memory.id === memoryId);
    const existing = store.memories[index];
    if (!existing) {
      return;
    }
    store.memories[index] = EntityMemorySchema.parse({
      ...existing,
      status: "deleted",
      updatedAt: this.factory.now(),
    });
    this.write(store);
  }

  async commitSuccessfulAction(input: CommitSuccessfulActionInput): Promise<EntityCommitRecord> {
    const store = this.read();
    const idempotencyKey = `${input.sourceRunId}:${input.action.id}`;
    const existing = store.entityCommits.find((record) => record.idempotencyKey === idempotencyKey);
    if (existing) {
      return existing;
    }

    const effects = deriveActionEntityEffects(store, input, this.factory);
    if (effects.contact) {
      const index = store.contacts.findIndex((contact) => contact.id === effects.contact!.id);
      if (index >= 0) store.contacts[index] = effects.contact;
      else store.contacts.push(effects.contact);
    }
    if (effects.meeting) {
      const index = store.meetings.findIndex((meeting) => meeting.id === effects.meeting!.id);
      if (index >= 0) store.meetings[index] = effects.meeting;
      else store.meetings.push(effects.meeting);
    }
    store.memories.push(...effects.memories);

    const record = EntityCommitRecordSchema.parse({
      idempotencyKey,
      entityRef: effects.entityRef,
      writtenMemoryIds: effects.memories.map((memory) => memory.id),
      skippedMemoryProposals: effects.skippedMemoryProposals,
      committedAt: this.factory.now(),
    });
    store.entityCommits.push(record);
    this.write(store);
    return record;
  }

  private read(): EntityStore {
    const serialized = this.store.getItem(ENTITY_STORAGE_KEY);
    if (serialized) {
      const parsed = EntityStoreSchema.safeParse(JSON.parse(serialized));
      if (!parsed.success) {
        throw new Error("Saved TRACE entity data is invalid.");
      }
      return parsed.data;
    }

    const migratedAt = this.factory.now();
    const legacySerialized = this.store.getItem(LEGACY_MEMORY_STORAGE_KEY);
    let legacyMemories: MemoryEntry[] = [];
    if (legacySerialized) {
      try {
        const parsed = LegacyMemoriesSchema.safeParse(JSON.parse(legacySerialized));
        if (parsed.success) legacyMemories = parsed.data;
      } catch {
        legacyMemories = [];
      }
    }
    const migrated = migrateLegacyMemories(legacyMemories, {
      createId: this.factory.createId,
      migratedAt,
    });
    this.write(migrated);
    return migrated;
  }

  private write(store: EntityStore): void {
    this.store.setItem(ENTITY_STORAGE_KEY, JSON.stringify(EntityStoreSchema.parse(store)));
  }

  private assertOwnerExists(store: EntityStore, owner: EntityOwner): void {
    const exists =
      owner.ownerType === "contact"
        ? store.contacts.some((contact) => contact.id === owner.ownerId)
        : store.meetings.some((meeting) => meeting.id === owner.ownerId);
    if (!exists) {
      throw new Error("Memory owner not found.");
    }
  }

  private deleteOwnedMemories(store: EntityStore, owner: EntityOwner): void {
    const now = this.factory.now();
    store.memories = store.memories.map((memory) =>
      memory.ownerType === owner.ownerType && memory.ownerId === owner.ownerId
        ? EntityMemorySchema.parse({ ...memory, status: "deleted", updatedAt: now })
        : memory,
    );
  }
}
