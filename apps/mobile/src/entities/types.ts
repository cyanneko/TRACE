import type {
  ActionCard,
  ContactRecord,
  ContactSummary,
  EntityMemory,
  GlobalMemoryOperation,
  MeetingRecord,
  MeetingSummary,
  ToolResult,
} from "@trace/contracts";

import type { EntityCommitRecord, GlobalMemoryCommitRecord } from "./storageModel";

export type EntityOwner = Pick<EntityMemory, "ownerId" | "ownerType">;

export const GLOBAL_MEMORY_OWNER = {
  ownerId: "00000000-0000-4000-8000-000000000000",
  ownerType: "global",
} as const satisfies EntityOwner;

export type ManualMemoryInput = EntityOwner & {
  content: string;
};

export type CommitSuccessfulActionInput = {
  sourceRunId: string;
  action: ActionCard;
  result: ToolResult & { success: true };
  timezone: string;
};

export type ApplyGlobalMemoryOperationsInput = {
  sourceRunId: string;
  operations: GlobalMemoryOperation[];
};

export interface EntityRepository {
  initialize(): Promise<void>;

  listContacts(): Promise<ContactRecord[]>;
  findContact(contactId: string): Promise<ContactRecord | null>;
  syncContacts(contacts: ContactSummary[], source: "demo" | "ios"): Promise<void>;
  createContactDraft(): Promise<ContactRecord>;
  saveContact(contact: ContactRecord): Promise<void>;
  deleteContact(contactId: string): Promise<void>;

  listMeetings(): Promise<MeetingRecord[]>;
  findMeeting(meetingId: string): Promise<MeetingRecord | null>;
  syncMeetings(meetings: MeetingSummary[], source: "demo" | "ios"): Promise<void>;
  createMeetingDraft(timezone: string): Promise<MeetingRecord>;
  saveMeeting(meeting: MeetingRecord): Promise<void>;
  deleteMeeting(meetingId: string): Promise<void>;

  listMemories(owner: EntityOwner): Promise<EntityMemory[]>;
  listAllMemories(): Promise<EntityMemory[]>;
  addMemory(input: ManualMemoryInput): Promise<EntityMemory>;
  updateMemory(memoryId: string, patch: Pick<ManualMemoryInput, "content">): Promise<EntityMemory>;
  deleteMemory(memoryId: string): Promise<void>;
  applyGlobalMemoryOperations(input: ApplyGlobalMemoryOperationsInput): Promise<GlobalMemoryCommitRecord>;

  commitSuccessfulAction(input: CommitSuccessfulActionInput): Promise<EntityCommitRecord>;
}

export type EntityRepositoryOptions = {
  createId?: () => string;
  now?: () => string;
};
