import type { ContactRecord, MeetingRecord, MeetingState } from "@trace/contracts";

export function sortContacts(contacts: ContactRecord[], locale?: string): ContactRecord[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
  return [...contacts].sort((left, right) => {
    const leftName = (left.sortName || left.displayName).trim();
    const rightName = (right.sortName || right.displayName).trim();
    if (!leftName && rightName) return 1;
    if (leftName && !rightName) return -1;
    if (!leftName && !rightName) {
      return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
    }
    return collator.compare(leftName, rightName) || left.id.localeCompare(right.id);
  });
}

export function meetingState(meeting: MeetingRecord, now: Date): MeetingState {
  if (!meeting.startAt || !meeting.endAt) {
    return "time_unresolved";
  }
  const currentTime = now.getTime();
  const startTime = new Date(meeting.startAt).getTime();
  const endTime = new Date(meeting.endAt).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    return "time_unresolved";
  }
  if (currentTime < startTime) {
    return "upcoming";
  }
  if (currentTime >= endTime) {
    return "ended";
  }
  return "ongoing";
}

const meetingStateRank: Record<MeetingState, number> = {
  ongoing: 0,
  upcoming: 1,
  ended: 2,
  time_unresolved: 3,
};

export function sortMeetings(meetings: MeetingRecord[], now: Date): MeetingRecord[] {
  return [...meetings].sort((left, right) => {
    const leftState = meetingState(left, now);
    const rightState = meetingState(right, now);
    const rankDifference = meetingStateRank[leftState] - meetingStateRank[rightState];
    if (rankDifference !== 0) {
      return rankDifference;
    }

    if (leftState === "ended") {
      return (right.endAt ?? "").localeCompare(left.endAt ?? "") || left.id.localeCompare(right.id);
    }
    if (leftState === "ongoing") {
      return (left.endAt ?? "").localeCompare(right.endAt ?? "") || left.id.localeCompare(right.id);
    }
    if (leftState === "upcoming") {
      return (left.startAt ?? "").localeCompare(right.startAt ?? "") || left.id.localeCompare(right.id);
    }
    return right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id);
  });
}
