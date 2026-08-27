import type { ContactRecord, ContactSummary, MeetingRecord, MeetingSummary } from "@trace/contracts";

function contactSummary(contact: ContactRecord): ContactSummary {
  return {
    id: contact.id,
    externalContactId: contact.externalContactId,
    displayName: contact.displayName,
    givenName: contact.givenName,
    familyName: contact.familyName,
    company: contact.company ?? "",
    jobTitle: contact.jobTitle ?? "",
    phones: contact.phones,
    emails: contact.emails,
    isSelf: contact.isSelf,
  };
}

function meetingSummary(meeting: MeetingRecord): MeetingSummary {
  return {
    id: meeting.id,
    externalEventId: meeting.externalEventId,
    title: meeting.title,
    startAt: meeting.startAt ?? null,
    endAt: meeting.endAt ?? null,
    timezone: meeting.timezone,
    allDay: meeting.allDay,
    location: meeting.location ?? "",
    meetingLink: meeting.meetingLink ?? "",
    participantContactIds: meeting.participantContactIds,
  };
}

export function mergeContactContext(
  sourceContacts: ContactSummary[],
  localContacts: ContactRecord[],
): ContactSummary[] {
  const localByExternalId = new Map(
    localContacts.flatMap((contact) => (contact.externalContactId ? [[contact.externalContactId, contact] as const] : [])),
  );
  const includedLocalIds = new Set<string>();
  const contacts = sourceContacts.map((source) => {
    const local = localByExternalId.get(source.id);
    if (!local) return source;
    includedLocalIds.add(local.id);
    return {
      id: local.id,
      externalContactId: local.externalContactId ?? source.externalContactId ?? source.id,
      displayName: source.displayName || local.displayName,
      givenName: source.givenName || local.givenName,
      familyName: source.familyName || local.familyName,
      company: source.company || local.company || "",
      jobTitle: source.jobTitle || local.jobTitle || "",
      phones: source.phones.length > 0 ? source.phones : local.phones,
      emails: source.emails.length > 0 ? source.emails : local.emails,
      isSelf: local.isSelf || source.isSelf || undefined,
    };
  });

  for (const local of localContacts) {
    if (local.status === "active" && local.displayName && !includedLocalIds.has(local.id)) {
      contacts.push(contactSummary(local));
    }
  }
  return contacts.slice(0, 200);
}

export function mergeMeetingContext(
  sourceMeetings: MeetingSummary[],
  localMeetings: MeetingRecord[],
): MeetingSummary[] {
  const localByExternalId = new Map(
    localMeetings.flatMap((meeting) => (meeting.externalEventId ? [[meeting.externalEventId, meeting] as const] : [])),
  );
  const includedLocalIds = new Set<string>();
  const meetings = sourceMeetings.map((source) => {
    const local = localByExternalId.get(source.externalEventId ?? source.id);
    if (!local) return source;
    includedLocalIds.add(local.id);
    return {
      ...source,
      id: local.id,
      participantContactIds:
        local.participantContactIds.length > 0 ? local.participantContactIds : source.participantContactIds,
    };
  });

  for (const local of localMeetings) {
    if (local.status === "active" && local.title && !includedLocalIds.has(local.id)) {
      meetings.push(meetingSummary(local));
    }
  }
  return meetings.slice(0, 200);
}
