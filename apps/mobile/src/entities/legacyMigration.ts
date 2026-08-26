import {
  ContactRecordSchema,
  EntityMemorySchema,
  MeetingRecordSchema,
  type ContactRecord,
  type EntityMemory,
  type MemoryEntry,
  type MeetingRecord,
} from "@trace/contracts";

import type { EntityStore } from "./storageModel";

type MigrationOptions = {
  createId: () => string;
  migratedAt: string;
};

function recordValue(memory: MemoryEntry): Record<string, unknown> {
  return typeof memory.value === "object" && memory.value !== null
    ? (memory.value as Record<string, unknown>)
    : { value: memory.value };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.flatMap((item) => (text(item) ? [text(item)] : [])) : [];
}

function isoDate(value: unknown): string | undefined {
  const candidate = text(value);
  return candidate && Number.isFinite(new Date(candidate).getTime()) ? candidate : undefined;
}

function createMigratedMemory(
  memory: MemoryEntry,
  owner: Pick<EntityMemory, "ownerId" | "ownerType">,
  content: string,
  kind: EntityMemory["kind"],
  options: MigrationOptions,
): EntityMemory | null {
  if (!content.trim()) {
    return null;
  }
  return EntityMemorySchema.parse({
    id: options.createId(),
    ...owner,
    kind,
    content,
    status: "active",
    source: "migration",
    sourceRunId: memory.sourceRunId,
    sourceActionId: memory.sourceActionId,
    sourceEvidenceRefs: memory.sourceEvidenceRefs,
    confidence: memory.confidence,
    createdAt: memory.createdAt,
    updatedAt: options.migratedAt,
  });
}

export function migrateLegacyMemories(memories: MemoryEntry[], options: MigrationOptions): EntityStore {
  const contacts: ContactRecord[] = [];
  const meetings: MeetingRecord[] = [];
  const entityMemories: EntityMemory[] = [];
  const contactsByExternalId = new Map<string, ContactRecord>();
  const meetingsByExternalId = new Map<string, MeetingRecord>();

  function ensureContact(externalContactId: string, displayName = ""): ContactRecord {
    const existing = contactsByExternalId.get(externalContactId);
    if (existing) {
      if (!existing.displayName && displayName) {
        existing.displayName = displayName;
        existing.status = "active";
        existing.updatedAt = options.migratedAt;
      }
      return existing;
    }
    const contact = ContactRecordSchema.parse({
      id: options.createId(),
      externalContactId,
      displayName,
      phones: [],
      emails: [],
      isSelf: false,
      status: displayName ? "active" : "draft",
      source: "trace",
      createdAt: options.migratedAt,
      updatedAt: options.migratedAt,
    });
    contacts.push(contact);
    contactsByExternalId.set(externalContactId, contact);
    return contact;
  }

  for (const memory of memories) {
    if (memory.status !== "active") {
      continue;
    }
    const value = recordValue(memory);

    if (memory.type === "open_loop" && value.kind === "scheduled_meeting") {
      const externalEventId = text(value.externalId);
      let meeting = externalEventId ? meetingsByExternalId.get(externalEventId) : undefined;
      if (!meeting) {
        const participantNames = stringList(value.participantNames);
        const participant = memory.contactId
          ? ensureContact(memory.contactId, participantNames[0] ?? "")
          : undefined;
        const title = text(value.title);
        const timezone = text(value.timezone);
        meeting = MeetingRecordSchema.parse({
          id: options.createId(),
          externalEventId: externalEventId || undefined,
          title,
          startAt: isoDate(value.startAt),
          endAt: isoDate(value.endAt),
          timezone,
          allDay: false,
          notes: text(value.notes) || undefined,
          participantContactIds: participant ? [participant.id] : [],
          status: title && timezone ? "active" : "draft",
          source: "trace",
          createdAt: memory.createdAt,
          updatedAt: options.migratedAt,
        });
        meetings.push(meeting);
        if (externalEventId) {
          meetingsByExternalId.set(externalEventId, meeting);
        }
      }
      const migrated = createMigratedMemory(
        memory,
        { ownerType: "meeting", ownerId: meeting.id },
        text(value.notes),
        "commitment",
        options,
      );
      if (migrated) entityMemories.push(migrated);
      continue;
    }

    if (!memory.contactId) {
      continue;
    }

    const displayName = text(value.displayName);
    const contact = ensureContact(memory.contactId, displayName);

    if (memory.type === "relationship_fact" && value.kind === "contact_created") {
      if (displayName) contact.displayName = displayName;
      const company = text(value.company);
      const jobTitle = text(value.jobTitle);
      if (company) contact.company = company;
      if (jobTitle) contact.jobTitle = jobTitle;
      contact.phones = stringList(value.phones);
      contact.emails = stringList(value.emails).filter((email) => email.includes("@"));
      contact.status = contact.displayName ? "active" : "draft";
      contact.updatedAt = options.migratedAt;
      const migrated = createMigratedMemory(
        memory,
        { ownerType: "contact", ownerId: contact.id },
        text(value.notes),
        "context",
        options,
      );
      if (migrated) entityMemories.push(migrated);
      continue;
    }

    if (memory.type === "contact_fact" && value.kind === "contact_change") {
      const field = text(value.field);
      const nextValue = text(value.value);
      if (field === "displayName" && nextValue) contact.displayName = nextValue;
      if (field === "givenName" && nextValue) contact.givenName = nextValue;
      if (field === "familyName" && nextValue) contact.familyName = nextValue;
      if (field === "company") contact.company = nextValue;
      if (field === "jobTitle") contact.jobTitle = nextValue;
      if (field === "phone" && nextValue && !contact.phones.includes(nextValue)) contact.phones.push(nextValue);
      if (field === "email" && nextValue && !contact.emails.includes(nextValue)) contact.emails.push(nextValue);
      contact.status = contact.displayName ? "active" : "draft";
      contact.updatedAt = options.migratedAt;
      continue;
    }

    const content = text(value.value) || text(value.notes);
    const migrated = createMigratedMemory(
      memory,
      { ownerType: "contact", ownerId: contact.id },
      content,
      memory.type === "preference" ? "preference" : "context",
      options,
    );
    if (migrated) entityMemories.push(migrated);
  }

  return {
    version: 2,
    contacts: contacts.map((contact) => ContactRecordSchema.parse(contact)),
    meetings,
    memories: entityMemories,
    migratedFromV1At: options.migratedAt,
  };
}
