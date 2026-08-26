import type { ContactRecord, EntityMemory, MeetingRecord } from "@trace/contracts";

export type EntityOwner = Pick<EntityMemory, "ownerId" | "ownerType">;

export type ManualMemoryInput = EntityOwner & {
  content: string;
  kind: EntityMemory["kind"];
};

export interface EntityRepository {
  initialize(): Promise<void>;

  listContacts(): Promise<ContactRecord[]>;
  createContactDraft(): Promise<ContactRecord>;
  saveContact(contact: ContactRecord): Promise<void>;
  deleteContact(contactId: string): Promise<void>;

  listMeetings(): Promise<MeetingRecord[]>;
  createMeetingDraft(timezone: string): Promise<MeetingRecord>;
  saveMeeting(meeting: MeetingRecord): Promise<void>;
  deleteMeeting(meetingId: string): Promise<void>;

  listMemories(owner: EntityOwner): Promise<EntityMemory[]>;
  addMemory(input: ManualMemoryInput): Promise<EntityMemory>;
  updateMemory(memoryId: string, patch: Pick<ManualMemoryInput, "content" | "kind">): Promise<EntityMemory>;
  deleteMemory(memoryId: string): Promise<void>;
}

export type EntityRepositoryOptions = {
  createId?: () => string;
  now?: () => string;
};
