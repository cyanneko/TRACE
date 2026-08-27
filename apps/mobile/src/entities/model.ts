import {
  ContactRecordSchema,
  EntityMemorySchema,
  MeetingRecordSchema,
  type ContactRecord,
  type EntityMemory,
  type MeetingRecord,
} from "@trace/contracts";

import { createUuid } from "../lib/uuid";
import type { EntityRepositoryOptions, ManualMemoryInput } from "./types";

export type EntityFactoryOptions = Required<EntityRepositoryOptions>;

export function entityFactoryOptions(options: EntityRepositoryOptions = {}): EntityFactoryOptions {
  return {
    createId: options.createId ?? createUuid,
    now: options.now ?? (() => new Date().toISOString()),
  };
}

export function createContactDraft(options: EntityFactoryOptions): ContactRecord {
  const now = options.now();
  return ContactRecordSchema.parse({
    id: options.createId(),
    displayName: "",
    phones: [],
    emails: [],
    isSelf: false,
    status: "draft",
    source: "trace",
    createdAt: now,
    updatedAt: now,
  });
}

export function createMeetingDraft(options: EntityFactoryOptions, timezone: string): MeetingRecord {
  const now = options.now();
  return MeetingRecordSchema.parse({
    id: options.createId(),
    title: "",
    timezone,
    allDay: false,
    participantContactIds: [],
    status: "draft",
    source: "trace",
    createdAt: now,
    updatedAt: now,
  });
}

export function createManualMemory(options: EntityFactoryOptions, input: ManualMemoryInput): EntityMemory {
  const now = options.now();
  return EntityMemorySchema.parse({
    id: options.createId(),
    ...input,
    status: "active",
    source: "manual",
    sourceEvidenceRefs: [],
    confidence: 1,
    createdAt: now,
    updatedAt: now,
  });
}

export function applyManualMemoryUpdate(
  options: EntityFactoryOptions,
  memory: EntityMemory,
  patch: Pick<ManualMemoryInput, "content">,
): EntityMemory {
  return EntityMemorySchema.parse({
    ...memory,
    ...patch,
    status: "active",
    source: "manual",
    confidence: 1,
    updatedAt: options.now(),
  });
}
