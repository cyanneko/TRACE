import type { ActionCard, ContactRecord, EntityMemory, MeetingRecord, ToolResult } from "@trace/contracts";

import type { EntityCommitRecord } from "./storageModel";

export type EntityOwner = Pick<EntityMemory, "ownerId" | "ownerType">;

export type ManualMemoryInput = EntityOwner & {
  content: string;
  kind: EntityMemory["kind"];
};

export type CommitSuccessfulActionInput = {
  sourceRunId: string;
  action: ActionCard;
  result: ToolResult & { success: true };
  timezone: string;
};

export interface EntityRepository {
  initialize(): Promise<void>;

  listContacts(): Promise<ContactRecord[]>;
  findContact(contactId: string): Promise<ContactRecord | null>;
  createContactDraft(): Promise<ContactRecord>;
  saveContact(contact: ContactRecord): Promise<void>;
  deleteContact(contactId: string): Promise<void>;

  listMeetings(): Promise<MeetingRecord[]>;
  findMeeting(meetingId: string): Promise<MeetingRecord | null>;
  createMeetingDraft(timezone: string): Promise<MeetingRecord>;
  saveMeeting(meeting: MeetingRecord): Promise<void>;
  deleteMeeting(meetingId: string): Promise<void>;

  listMemories(owner: EntityOwner): Promise<EntityMemory[]>;
  listAllMemories(): Promise<EntityMemory[]>;
  addMemory(input: ManualMemoryInput): Promise<EntityMemory>;
  updateMemory(memoryId: string, patch: Pick<ManualMemoryInput, "content" | "kind">): Promise<EntityMemory>;
  deleteMemory(memoryId: string): Promise<void>;

  commitSuccessfulAction(input: CommitSuccessfulActionInput): Promise<EntityCommitRecord>;
}

export type EntityRepositoryOptions = {
  createId?: () => string;
  now?: () => string;
};
