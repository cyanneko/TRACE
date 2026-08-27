import {
  ContactRecordSchema,
  EntityMemorySchema,
  MeetingRecordSchema,
  type ContactRecord,
  type EntityMemory,
  type MeetingRecord,
  type MemoryProposal,
} from "@trace/contracts";

import type { EntityFactoryOptions } from "./model";
import type { CommitSuccessfulActionInput } from "./types";

export type ActionEntityEffects = {
  contact?: ContactRecord;
  demotedContacts: ContactRecord[];
  meeting?: MeetingRecord;
  memories: EntityMemory[];
  entityRef: {
    type: "contact" | "meeting";
    id: string;
    externalId?: string;
  };
  skippedMemoryProposals: number;
};

type EntityState = {
  contacts: ContactRecord[];
  meetings: MeetingRecord[];
  memories: EntityMemory[];
};

function findContact(contacts: ContactRecord[], id?: string | null): ContactRecord | undefined {
  if (!id) return undefined;
  return contacts.find((contact) => contact.id === id || contact.externalContactId === id);
}

function findMeeting(meetings: MeetingRecord[], id?: string | null): MeetingRecord | undefined {
  if (!id) return undefined;
  return meetings.find((meeting) => meeting.id === id || meeting.externalEventId === id);
}

function contactEffects(
  state: EntityState,
  input: CommitSuccessfulActionInput,
  factory: EntityFactoryOptions,
): ContactRecord {
  const { action, result } = input;
  const now = factory.now();
  const source = result.provider === "native" ? "ios" : "demo";

  if (action.type === "create_contact") {
    const existing = findContact(state.contacts, result.externalId);
    return ContactRecordSchema.parse({
      id: existing?.id ?? factory.createId(),
      externalContactId: result.externalId ?? existing?.externalContactId,
      displayName: action.payload.displayName,
      givenName: action.payload.givenName || undefined,
      familyName: action.payload.familyName || undefined,
      company: action.payload.company || undefined,
      jobTitle: action.payload.jobTitle || undefined,
      phones: action.payload.phones,
      emails: action.payload.emails,
      notes: action.payload.notes || undefined,
      isSelf: action.payload.isSelf,
      status: "active",
      source,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  if (action.type !== "update_contact") {
    throw new Error("This action does not target a contact.");
  }

  const existing =
    findContact(state.contacts, action.payload.contactId) ?? findContact(state.contacts, result.externalId);
  const contact: ContactRecord = {
    id: existing?.id ?? factory.createId(),
    externalContactId: result.externalId ?? existing?.externalContactId,
    displayName: existing?.displayName || action.payload.displayName,
    sortName: existing?.sortName,
    givenName: existing?.givenName,
    familyName: existing?.familyName,
    company: existing?.company,
    jobTitle: existing?.jobTitle,
    phones: existing?.phones ?? [],
    emails: existing?.emails ?? [],
    notes: existing?.notes,
    isSelf: existing?.isSelf ?? false,
    status: "active",
    source: existing?.source ?? source,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  for (const change of action.payload.changes) {
    if (change.field === "displayName") {
      contact.displayName = change.nextValue!;
      contact.sortName = undefined;
    }
    if (change.field === "givenName") {
      contact.givenName = change.nextValue?.trim() || undefined;
      contact.sortName = undefined;
    }
    if (change.field === "familyName") {
      contact.familyName = change.nextValue?.trim() || undefined;
      contact.sortName = undefined;
    }
    if (change.field === "company") contact.company = change.nextValue?.trim() || undefined;
    if (change.field === "jobTitle") contact.jobTitle = change.nextValue?.trim() || undefined;
    if (change.field === "phones") contact.phones = [...change.nextValue];
    if (change.field === "emails") contact.emails = [...change.nextValue];
    if (change.field === "notes") contact.notes = change.nextValue || undefined;
    if (change.field === "isSelf") contact.isSelf = change.nextValue;
  }
  return ContactRecordSchema.parse(contact);
}

function meetingEffects(
  state: EntityState,
  input: CommitSuccessfulActionInput,
  factory: EntityFactoryOptions,
): MeetingRecord {
  const { action, result } = input;
  const now = factory.now();
  const source = result.provider === "native" ? "ios" : "demo";

  if (action.type === "create_meeting") {
    const existing = findMeeting(state.meetings, result.externalId);
    return MeetingRecordSchema.parse({
      id: existing?.id ?? factory.createId(),
      externalEventId: result.externalId ?? existing?.externalEventId,
      title: action.payload.title,
      startAt: action.payload.startAt ?? undefined,
      endAt: action.payload.endAt ?? undefined,
      timezone: action.payload.timezone,
      allDay: false,
      notes: action.payload.notes || undefined,
      participantContactIds: [
        ...new Set(
          action.payload.participantContactIds.map(
            (id) => findContact(state.contacts, id)?.id ?? id,
          ),
        ),
      ],
      status: "active",
      source,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  if (action.type !== "update_meeting") {
    throw new Error("This action does not target a meeting.");
  }

  const existing =
    findMeeting(state.meetings, action.payload.meetingId) ?? findMeeting(state.meetings, result.externalId);
  const meeting: MeetingRecord = {
    id: existing?.id ?? factory.createId(),
    externalEventId: result.externalId ?? existing?.externalEventId,
    title: existing?.title || action.payload.displayTitle,
    startAt: existing?.startAt,
    endAt: existing?.endAt,
    timezone: existing?.timezone || input.timezone,
    allDay: existing?.allDay ?? false,
    location: existing?.location,
    meetingLink: existing?.meetingLink,
    notes: existing?.notes,
    participantContactIds: existing?.participantContactIds ?? [],
    status: "active",
    source: existing?.source ?? source,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  for (const change of action.payload.changes) {
    if (change.field === "title") meeting.title = change.nextValue!;
    if (change.field === "timezone") meeting.timezone = change.nextValue!;
    if (change.field === "startAt") meeting.startAt = change.nextValue ?? undefined;
    if (change.field === "endAt") meeting.endAt = change.nextValue ?? undefined;
    if (change.field === "location") meeting.location = change.nextValue ?? undefined;
    if (change.field === "meetingLink") meeting.meetingLink = change.nextValue ?? undefined;
    if (change.field === "notes") meeting.notes = change.nextValue ?? undefined;
    if (change.field === "allDay") meeting.allDay = change.nextValue;
    if (change.field === "participantContactIds") {
      meeting.participantContactIds = [
        ...new Set(change.nextValue.map((id) => findContact(state.contacts, id)?.id ?? id)),
      ];
    }
  }
  return MeetingRecordSchema.parse(meeting);
}

function memoryFromProposal(
  proposal: MemoryProposal,
  owner: Pick<EntityMemory, "ownerId" | "ownerType">,
  input: CommitSuccessfulActionInput,
  factory: EntityFactoryOptions,
): EntityMemory {
  const now = factory.now();
  return EntityMemorySchema.parse({
    id: factory.createId(),
    ...owner,
    content: proposal.content,
    status: "active",
    source: "action",
    sourceRunId: input.sourceRunId,
    sourceActionId: input.action.id,
    sourceEvidenceRefs: proposal.evidenceRefs,
    confidence: input.action.confidence,
    createdAt: now,
    updatedAt: now,
  });
}

export function deriveActionEntityEffects(
  state: EntityState,
  input: CommitSuccessfulActionInput,
  factory: EntityFactoryOptions,
): ActionEntityEffects {
  if (!input.result.success) {
    throw new Error("Only successful actions can update entity memory.");
  }

  const isContactAction = input.action.type === "create_contact" || input.action.type === "update_contact";
  const contact = isContactAction ? contactEffects(state, input, factory) : undefined;
  const meeting = isContactAction ? undefined : meetingEffects(state, input, factory);
  const entityRef = contact
    ? { type: "contact" as const, id: contact.id, externalId: contact.externalContactId }
    : { type: "meeting" as const, id: meeting!.id, externalId: meeting!.externalEventId };

  const demotedContacts =
    contact?.isSelf
      ? state.contacts
          .filter((item) => item.id !== contact.id && item.isSelf)
          .map((item) =>
            ContactRecordSchema.parse({ ...item, isSelf: false, updatedAt: contact.updatedAt }),
          )
      : [];
  const demotedById = new Map(demotedContacts.map((item) => [item.id, item]));
  const contacts = contact
    ? [
        ...state.contacts
          .filter((item) => item.id !== contact.id)
          .map((item) => demotedById.get(item.id) ?? item),
        contact,
      ]
    : state.contacts;
  const meetings = meeting
    ? [...state.meetings.filter((item) => item.id !== meeting.id), meeting]
    : state.meetings;
  const proposals: MemoryProposal[] = [...input.action.memoryProposals];

  if (input.action.type === "create_contact" && input.action.payload.interactionSummary.trim()) {
    const content = input.action.payload.interactionSummary.trim();
    if (!proposals.some((proposal) => proposal.content.trim() === content) && input.action.evidenceRefs.length > 0) {
      proposals.push({
        target: { type: "action_entity" },
        content,
        evidenceRefs: input.action.evidenceRefs,
      });
    }
  }

  const memories: EntityMemory[] = [];
  let skippedMemoryProposals = 0;
  for (const proposal of proposals) {
    let owner: Pick<EntityMemory, "ownerId" | "ownerType"> | undefined;
    if (proposal.target.type === "action_entity") {
      owner = { ownerType: entityRef.type, ownerId: entityRef.id };
    } else if (proposal.target.type === "contact") {
      const target = findContact(contacts, proposal.target.contactId);
      if (target) owner = { ownerType: "contact", ownerId: target.id };
    } else {
      const target = findMeeting(meetings, proposal.target.meetingId);
      if (target) owner = { ownerType: "meeting", ownerId: target.id };
    }

    if (!owner) {
      skippedMemoryProposals += 1;
      continue;
    }
    const duplicate = [...state.memories, ...memories].some(
      (memory) =>
        memory.status === "active" &&
        memory.ownerType === owner!.ownerType &&
        memory.ownerId === owner!.ownerId &&
        memory.content.trim() === proposal.content.trim(),
    );
    if (!duplicate) {
      memories.push(memoryFromProposal(proposal, owner, input, factory));
    }
  }

  return { contact, demotedContacts, meeting, memories, entityRef, skippedMemoryProposals };
}
