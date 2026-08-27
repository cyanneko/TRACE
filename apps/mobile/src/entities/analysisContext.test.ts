import type { ContactRecord, MeetingRecord } from "@trace/contracts";
import { describe, expect, it } from "vitest";

import { mergeContactContext, mergeMeetingContext } from "./analysisContext";

const timestamps = {
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
};

describe("analysis entity context", () => {
  it("uses the stable local id when a native contact has a local entity mirror", () => {
    const local: ContactRecord = {
      id: "00000000-0000-4000-8000-000000000001",
      externalContactId: "native-maya",
      displayName: "Maya",
      phones: [],
      emails: [],
      isSelf: false,
      status: "active",
      source: "ios",
      ...timestamps,
    };

    const result = mergeContactContext(
      [
        {
          id: "native-maya",
          displayName: "Maya Chen",
          company: "Northstar",
          jobTitle: "Head of Product",
          phones: [],
          emails: [],
        },
      ],
      [local],
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: local.id,
        externalContactId: "native-maya",
        displayName: "Maya Chen",
        company: "Northstar",
      }),
    ]);
  });

  it("exposes the local self-contact marker to the analysis agent", () => {
    const self: ContactRecord = {
      id: "00000000-0000-4000-8000-000000000011",
      displayName: "Kai",
      phones: [],
      emails: [],
      isSelf: true,
      status: "active",
      source: "trace",
      ...timestamps,
    };

    expect(mergeContactContext([], [self])).toContainEqual(
      expect.objectContaining({ id: self.id, displayName: "Kai", isSelf: true }),
    );
  });

  it("keeps local participant links when merging the corresponding calendar event", () => {
    const local: MeetingRecord = {
      id: "00000000-0000-4000-8000-000000000002",
      externalEventId: "native-event-review",
      title: "Design review",
      startAt: "2026-08-27T07:00:00.000Z",
      endAt: "2026-08-27T07:30:00.000Z",
      timezone: "Asia/Shanghai",
      allDay: false,
      participantContactIds: ["00000000-0000-4000-8000-000000000001"],
      status: "active",
      source: "ios",
      ...timestamps,
    };

    const result = mergeMeetingContext(
      [
        {
          id: "native-event-review",
          externalEventId: "native-event-review",
          title: "Design review updated on device",
          startAt: "2026-08-28T07:00:00.000Z",
          endAt: "2026-08-28T07:30:00.000Z",
          timezone: "Asia/Shanghai",
          allDay: false,
          location: "",
          meetingLink: "",
          participantContactIds: [],
        },
      ],
      [local],
    );

    expect(result[0]).toMatchObject({
      id: local.id,
      title: "Design review updated on device",
      participantContactIds: local.participantContactIds,
    });
  });
});
