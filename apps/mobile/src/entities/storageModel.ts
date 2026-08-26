import {
  ContactRecordSchema,
  EntityMemorySchema,
  MeetingRecordSchema,
  type ContactRecord,
  type EntityMemory,
  type MeetingRecord,
} from "@trace/contracts";
import { z } from "zod";

export const ENTITY_STORE_VERSION = 2;

export const EntityCommitRecordSchema = z.object({
  idempotencyKey: z.string().trim().min(1),
  entityRef: z.object({
    type: z.enum(["contact", "meeting"]),
    id: z.uuid(),
    externalId: z.string().optional(),
  }),
  writtenMemoryIds: z.array(z.uuid()),
  skippedMemoryProposals: z.number().int().min(0),
  committedAt: z.iso.datetime(),
});

export type EntityCommitRecord = z.infer<typeof EntityCommitRecordSchema>;

export const EntityStoreSchema = z.object({
  version: z.literal(ENTITY_STORE_VERSION),
  contacts: z.array(ContactRecordSchema),
  meetings: z.array(MeetingRecordSchema),
  memories: z.array(EntityMemorySchema),
  entityCommits: z.array(EntityCommitRecordSchema).default([]),
  migratedFromV1At: z.iso.datetime().optional(),
});

export type EntityStore = {
  version: typeof ENTITY_STORE_VERSION;
  contacts: ContactRecord[];
  meetings: MeetingRecord[];
  memories: EntityMemory[];
  entityCommits: EntityCommitRecord[];
  migratedFromV1At?: string;
};

export function emptyEntityStore(): EntityStore {
  return {
    version: ENTITY_STORE_VERSION,
    contacts: [],
    meetings: [],
    memories: [],
    entityCommits: [],
  };
}
