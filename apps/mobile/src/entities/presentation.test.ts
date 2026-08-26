import type { ContactRecord, MeetingRecord } from "@trace/contracts";
import { describe, expect, it } from "vitest";

import { meetingState, sortContacts, sortMeetings } from "./presentation";

const createdAt = "2026-08-20T00:00:00.000Z";

function contact(id: string, displayName: string): ContactRecord {
  return {
    id,
    displayName,
    phones: [],
    emails: [],
    isSelf: false,
    status: displayName ? "active" : "draft",
    source: "trace",
    createdAt,
    updatedAt: createdAt,
  };
}

function meeting(
  id: string,
  startAt?: string,
  endAt?: string,
  title = id,
): MeetingRecord {
  return {
    id,
    title,
    startAt,
    endAt,
    timezone: "UTC",
    allDay: false,
    participantContactIds: [],
    status: title ? "active" : "draft",
    source: "trace",
    createdAt,
    updatedAt: createdAt,
  };
}

describe("entity presentation", () => {
  it("sorts named contacts with a locale collator and keeps blank drafts last", () => {
    const contacts = [
      contact("00000000-0000-4000-8000-000000000001", "bob"),
      contact("00000000-0000-4000-8000-000000000002", ""),
      contact("00000000-0000-4000-8000-000000000003", "Alice"),
    ];

    expect(sortContacts(contacts, "en").map((item) => item.displayName)).toEqual(["Alice", "bob", ""]);
  });

  it("derives meeting state at exact start and end boundaries", () => {
    const item = meeting(
      "00000000-0000-4000-8000-000000000001",
      "2026-08-26T09:00:00.000Z",
      "2026-08-26T10:00:00.000Z",
    );

    expect(meetingState(item, new Date("2026-08-26T09:00:00.000Z"))).toBe("ongoing");
    expect(meetingState(item, new Date("2026-08-26T10:00:00.000Z"))).toBe("ended");
  });

  it("orders ongoing, upcoming, recent ended, older ended, then unresolved meetings", () => {
    const meetings = [
      meeting("00000000-0000-4000-8000-000000000005"),
      meeting(
        "00000000-0000-4000-8000-000000000004",
        "2026-08-24T09:00:00.000Z",
        "2026-08-24T10:00:00.000Z",
      ),
      meeting(
        "00000000-0000-4000-8000-000000000002",
        "2026-08-27T09:00:00.000Z",
        "2026-08-27T10:00:00.000Z",
      ),
      meeting(
        "00000000-0000-4000-8000-000000000003",
        "2026-08-25T09:00:00.000Z",
        "2026-08-25T10:00:00.000Z",
      ),
      meeting(
        "00000000-0000-4000-8000-000000000001",
        "2026-08-26T09:00:00.000Z",
        "2026-08-26T11:00:00.000Z",
      ),
    ];

    expect(sortMeetings(meetings, new Date("2026-08-26T10:00:00.000Z")).map((item) => item.id)).toEqual([
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
      "00000000-0000-4000-8000-000000000004",
      "00000000-0000-4000-8000-000000000005",
    ]);
  });
});
