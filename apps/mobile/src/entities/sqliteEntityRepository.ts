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
import type { SQLiteDatabase } from "expo-sqlite";

import { getTraceDatabase } from "../native/traceDatabase";
import { deriveActionEntityEffects } from "./actionEffects";
import { migrateLegacyMemories } from "./legacyMigration";
import {
  applyManualMemoryUpdate,
  createContactDraft,
  createManualMemory,
  createMeetingDraft,
  entityFactoryOptions,
} from "./model";
import { EntityCommitRecordSchema, type EntityCommitRecord } from "./storageModel";
import {
  GLOBAL_MEMORY_OWNER,
  type CommitSuccessfulActionInput,
  type EntityOwner,
  type EntityRepository,
  type EntityRepositoryOptions,
  type ManualMemoryInput,
} from "./types";

const ENTITY_MIGRATION = "entity-memory-v2";

type PayloadRow = {
  payload: string;
};

function parseRows<T>(rows: PayloadRow[], parse: (input: unknown) => { success: boolean; data?: T }): T[] {
  return rows.flatMap((row) => {
    try {
      const parsed = parse(JSON.parse(row.payload));
      return parsed.success && parsed.data ? [parsed.data] : [];
    } catch {
      return [];
    }
  });
}

export class SqliteEntityRepository implements EntityRepository {
  private readonly factory;
  private initialization: Promise<void> | null = null;

  constructor(options: EntityRepositoryOptions = {}) {
    this.factory = entityFactoryOptions(options);
  }

  initialize(): Promise<void> {
    this.initialization ??= this.runMigration();
    return this.initialization;
  }

  async listContacts(): Promise<ContactRecord[]> {
    const database = await this.database();
    const rows = await database.getAllAsync<PayloadRow>("SELECT payload FROM contacts ORDER BY sort_name, id");
    return parseRows(rows, (input) => ContactRecordSchema.safeParse(input));
  }

  async findContact(contactId: string): Promise<ContactRecord | null> {
    const database = await this.database();
    const row = await database.getFirstAsync<PayloadRow>(
      "SELECT payload FROM contacts WHERE id = ? OR external_contact_id = ? LIMIT 1",
      contactId,
      contactId,
    );
    if (!row) return null;
    const parsed = ContactRecordSchema.safeParse(JSON.parse(row.payload));
    return parsed.success ? parsed.data : null;
  }

  async syncContacts(contacts: ContactSummary[], source: "demo" | "ios"): Promise<void> {
    const database = await this.database();
    const existingContacts = await this.listContacts();
    const now = this.factory.now();
    const synced = contacts.map((summary) => {
      const existing = existingContacts.find(
        (contact) => contact.externalContactId === summary.id || contact.id === summary.id,
      );
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
      return parsed.success ? parsed.data : ContactRecordSchema.parse({ ...candidate, emails: [] });
    });
    await database.withExclusiveTransactionAsync(async (transaction) => {
      for (const contact of synced) await this.writeContact(transaction, contact);
    });
  }

  async createContactDraft(): Promise<ContactRecord> {
    const contact = createContactDraft(this.factory);
    await this.saveContact(contact);
    return contact;
  }

  async saveContact(contact: ContactRecord): Promise<void> {
    const database = await this.database();
    await this.writeContact(database, ContactRecordSchema.parse(contact));
  }

  async deleteContact(contactId: string): Promise<void> {
    const database = await this.database();
    const meetings = (await this.listMeetings()).filter((meeting) =>
      meeting.participantContactIds.includes(contactId),
    );
    const memories = await this.listMemories({ ownerType: "contact", ownerId: contactId });
    const now = this.factory.now();
    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync("DELETE FROM contacts WHERE id = ?", contactId);
      for (const meeting of meetings) {
        await this.writeMeeting(transaction, {
          ...meeting,
          participantContactIds: meeting.participantContactIds.filter((id) => id !== contactId),
          updatedAt: now,
        });
      }
      for (const memory of memories) {
        await this.writeMemory(transaction, { ...memory, status: "deleted", updatedAt: now });
      }
    });
  }

  async listMeetings(): Promise<MeetingRecord[]> {
    const database = await this.database();
    const rows = await database.getAllAsync<PayloadRow>(
      "SELECT payload FROM meetings ORDER BY start_at IS NULL, start_at, id",
    );
    return parseRows(rows, (input) => MeetingRecordSchema.safeParse(input));
  }

  async findMeeting(meetingId: string): Promise<MeetingRecord | null> {
    const database = await this.database();
    const row = await database.getFirstAsync<PayloadRow>(
      "SELECT payload FROM meetings WHERE id = ? OR external_event_id = ? LIMIT 1",
      meetingId,
      meetingId,
    );
    if (!row) return null;
    const parsed = MeetingRecordSchema.safeParse(JSON.parse(row.payload));
    return parsed.success ? parsed.data : null;
  }

  async syncMeetings(meetings: MeetingSummary[], source: "demo" | "ios"): Promise<void> {
    const database = await this.database();
    const [existingMeetings, existingContacts] = await Promise.all([
      this.listMeetings(),
      this.listContacts(),
    ]);
    const now = this.factory.now();
    const synced = meetings.map((summary) => {
      const externalEventId = summary.externalEventId ?? summary.id;
      const existing = existingMeetings.find(
        (meeting) => meeting.externalEventId === externalEventId || meeting.id === summary.id,
      );
      const preserveExisting = Boolean(existing && (existing.source === "trace" || source === "demo"));
      const resolveParticipantContactId = (contactId: string) => {
        const contact = existingContacts.find(
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
      return MeetingRecordSchema.parse({
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
    });
    await database.withExclusiveTransactionAsync(async (transaction) => {
      for (const meeting of synced) await this.writeMeeting(transaction, meeting);
    });
  }

  async createMeetingDraft(timezone: string): Promise<MeetingRecord> {
    const meeting = createMeetingDraft(this.factory, timezone);
    await this.saveMeeting(meeting);
    return meeting;
  }

  async saveMeeting(meeting: MeetingRecord): Promise<void> {
    const database = await this.database();
    await this.writeMeeting(database, MeetingRecordSchema.parse(meeting));
  }

  async deleteMeeting(meetingId: string): Promise<void> {
    const database = await this.database();
    const memories = await this.listMemories({ ownerType: "meeting", ownerId: meetingId });
    const now = this.factory.now();
    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync("DELETE FROM meetings WHERE id = ?", meetingId);
      for (const memory of memories) {
        await this.writeMemory(transaction, { ...memory, status: "deleted", updatedAt: now });
      }
    });
  }

  async listMemories(owner: EntityOwner): Promise<EntityMemory[]> {
    const database = await this.database();
    const rows = await database.getAllAsync<PayloadRow>(
      `SELECT payload FROM entity_memories
       WHERE owner_type = ? AND owner_id = ? AND status = 'active'
       ORDER BY updated_at DESC`,
      owner.ownerType,
      owner.ownerId,
    );
    return parseRows(rows, (input) => EntityMemorySchema.safeParse(input));
  }

  async listAllMemories(): Promise<EntityMemory[]> {
    const database = await this.database();
    const rows = await database.getAllAsync<PayloadRow>(
      "SELECT payload FROM entity_memories WHERE status = 'active' ORDER BY updated_at DESC",
    );
    return parseRows(rows, (input) => EntityMemorySchema.safeParse(input));
  }

  async addMemory(input: ManualMemoryInput): Promise<EntityMemory> {
    const database = await this.database();
    await this.assertOwnerExists(database, input);
    const memory = createManualMemory(this.factory, input);
    await this.writeMemory(database, memory);
    return memory;
  }

  async updateMemory(
    memoryId: string,
    patch: Pick<ManualMemoryInput, "content">,
  ): Promise<EntityMemory> {
    const database = await this.database();
    const row = await database.getFirstAsync<PayloadRow>(
      "SELECT payload FROM entity_memories WHERE id = ? AND status = 'active'",
      memoryId,
    );
    if (!row) {
      throw new Error("Memory not found.");
    }
    const existing = EntityMemorySchema.parse(JSON.parse(row.payload));
    const memory = applyManualMemoryUpdate(this.factory, existing, patch);
    await this.writeMemory(database, memory);
    return memory;
  }

  async deleteMemory(memoryId: string): Promise<void> {
    const database = await this.database();
    const row = await database.getFirstAsync<PayloadRow>("SELECT payload FROM entity_memories WHERE id = ?", memoryId);
    if (!row) {
      return;
    }
    const existing = EntityMemorySchema.parse(JSON.parse(row.payload));
    await this.writeMemory(database, { ...existing, status: "deleted", updatedAt: this.factory.now() });
  }

  async commitSuccessfulAction(input: CommitSuccessfulActionInput): Promise<EntityCommitRecord> {
    const database = await this.database();
    const idempotencyKey = `${input.sourceRunId}:${input.action.id}`;
    const existingRow = await database.getFirstAsync<PayloadRow>(
      "SELECT payload FROM entity_action_commits WHERE idempotency_key = ?",
      idempotencyKey,
    );
    if (existingRow) {
      return EntityCommitRecordSchema.parse(JSON.parse(existingRow.payload));
    }

    const [contacts, meetings, memories] = await Promise.all([
      this.listContacts(),
      this.listMeetings(),
      this.listAllEntityMemories(database),
    ]);
    const effects = deriveActionEntityEffects({ contacts, meetings, memories }, input, this.factory);
    const record = EntityCommitRecordSchema.parse({
      idempotencyKey,
      entityRef: effects.entityRef,
      writtenMemoryIds: effects.memories.map((memory) => memory.id),
      skippedMemoryProposals: effects.skippedMemoryProposals,
      committedAt: this.factory.now(),
    });

    await database.withExclusiveTransactionAsync(async (transaction) => {
      for (const demoted of effects.demotedContacts) await this.writeContact(transaction, demoted);
      if (effects.contact) await this.writeContact(transaction, effects.contact);
      if (effects.meeting) await this.writeMeeting(transaction, effects.meeting);
      for (const memory of effects.memories) await this.writeMemory(transaction, memory);
      await transaction.runAsync(
        `INSERT INTO entity_action_commits (idempotency_key, payload, committed_at)
         VALUES (?, ?, ?)`,
        record.idempotencyKey,
        JSON.stringify(record),
        record.committedAt,
      );
    });
    return record;
  }

  private async database(): Promise<SQLiteDatabase> {
    await this.initialize();
    return getTraceDatabase();
  }

  private async runMigration(): Promise<void> {
    const database = await getTraceDatabase();
    const existing = await database.getFirstAsync<{ name: string }>(
      "SELECT name FROM schema_migrations WHERE name = ?",
      ENTITY_MIGRATION,
    );
    if (existing) {
      return;
    }

    const rows = await database.getAllAsync<PayloadRow>("SELECT payload FROM memory_entries");
    const legacy = parseRows<MemoryEntry>(rows, (input) => MemoryEntrySchema.safeParse(input));
    const migratedAt = this.factory.now();
    const migrated = migrateLegacyMemories(legacy, { createId: this.factory.createId, migratedAt });

    await database.withExclusiveTransactionAsync(async (transaction) => {
      for (const contact of migrated.contacts) await this.writeContact(transaction, contact);
      for (const meeting of migrated.meetings) await this.writeMeeting(transaction, meeting);
      for (const memory of migrated.memories) await this.writeMemory(transaction, memory);
      await transaction.runAsync(
        "INSERT OR IGNORE INTO schema_migrations (name, applied_at) VALUES (?, ?)",
        ENTITY_MIGRATION,
        migratedAt,
      );
    });
  }

  private async listAllEntityMemories(database: SQLiteDatabase): Promise<EntityMemory[]> {
    const rows = await database.getAllAsync<PayloadRow>("SELECT payload FROM entity_memories");
    return parseRows(rows, (input) => EntityMemorySchema.safeParse(input));
  }

  private async assertOwnerExists(database: SQLiteDatabase, owner: EntityOwner): Promise<void> {
    if (owner.ownerType === "global") {
      if (owner.ownerId !== GLOBAL_MEMORY_OWNER.ownerId) {
        throw new Error("Global memory owner is invalid.");
      }
      return;
    }
    const table = owner.ownerType === "contact" ? "contacts" : "meetings";
    const row = await database.getFirstAsync<{ id: string }>(`SELECT id FROM ${table} WHERE id = ?`, owner.ownerId);
    if (!row) {
      throw new Error("Memory owner not found.");
    }
  }

  private async writeContact(database: SQLiteDatabase, contact: ContactRecord): Promise<void> {
    const parsed = ContactRecordSchema.parse(contact);
    await database.runAsync(
      `INSERT INTO contacts (id, external_contact_id, sort_name, status, payload, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         external_contact_id = excluded.external_contact_id,
         sort_name = excluded.sort_name,
         status = excluded.status,
         payload = excluded.payload,
         updated_at = excluded.updated_at`,
      parsed.id,
      parsed.externalContactId ?? null,
      parsed.sortName || parsed.displayName,
      parsed.status,
      JSON.stringify(parsed),
      parsed.updatedAt,
    );
  }

  private async writeMeeting(database: SQLiteDatabase, meeting: MeetingRecord): Promise<void> {
    const parsed = MeetingRecordSchema.parse(meeting);
    await database.runAsync(
      `INSERT INTO meetings (id, external_event_id, start_at, end_at, status, payload, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         external_event_id = excluded.external_event_id,
         start_at = excluded.start_at,
         end_at = excluded.end_at,
         status = excluded.status,
         payload = excluded.payload,
         updated_at = excluded.updated_at`,
      parsed.id,
      parsed.externalEventId ?? null,
      parsed.startAt ?? null,
      parsed.endAt ?? null,
      parsed.status,
      JSON.stringify(parsed),
      parsed.updatedAt,
    );
  }

  private async writeMemory(database: SQLiteDatabase, memory: EntityMemory): Promise<void> {
    const parsed = EntityMemorySchema.parse(memory);
    await database.runAsync(
      `INSERT INTO entity_memories (id, owner_type, owner_id, status, payload, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         owner_type = excluded.owner_type,
         owner_id = excluded.owner_id,
         status = excluded.status,
         payload = excluded.payload,
         updated_at = excluded.updated_at`,
      parsed.id,
      parsed.ownerType,
      parsed.ownerId,
      parsed.status,
      JSON.stringify(parsed),
      parsed.updatedAt,
    );
  }
}
