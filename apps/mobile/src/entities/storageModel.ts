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

export const EntityStoreSchema = z.object({
  version: z.literal(ENTITY_STORE_VERSION),
  contacts: z.array(ContactRecordSchema),
  meetings: z.array(MeetingRecordSchema),
  memories: z.array(EntityMemorySchema),
  migratedFromV1At: z.iso.datetime().optional(),
});

export type EntityStore = {
  version: typeof ENTITY_STORE_VERSION;
  contacts: ContactRecord[];
  meetings: MeetingRecord[];
  memories: EntityMemory[];
  migratedFromV1At?: string;
};

export function emptyEntityStore(): EntityStore {
  return {
    version: ENTITY_STORE_VERSION,
    contacts: [],
    meetings: [],
    memories: [],
  };
}
