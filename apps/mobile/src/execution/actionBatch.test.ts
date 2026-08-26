import type {
  ContactRecord,
  CreateContactCard,
  CreateMeetingCard,
  MeetingRecord,
  ToolResult,
  UpdateMeetingCard,
} from "@trace/contracts";
import { describe, expect, it } from "vitest";

import { linkContactsToMeetingAction, orderActionsForExecution } from "./actionBatch";

const contact: CreateContactCard = {
  id: "action-create-maya",
  type: "create_contact",
  title: "Create Maya",
  confidence: 0.9,
  evidenceRefs: ["evidence-maya"],
  editableFields: ["displayName"],
  riskFlags: [],
  memoryProposals: [],
  payload: {
    displayName: "Maya Chen",
    givenName: "Maya",
    familyName: "Chen",
    company: "",
    jobTitle: "",
    phones: [],
    emails: [],
    notes: "",
    isSelf: false,
    interactionSummary: "Maya replied directly.",
  },
};

const meeting: CreateMeetingCard = {
  id: "action-create-meeting",
  type: "create_meeting",
  title: "Create review",
  confidence: 0.9,
  evidenceRefs: ["evidence-meeting"],
  editableFields: ["title"],
  riskFlags: [],
  memoryProposals: [],
  payload: {
    title: "Design review",
    startAt: "2026-08-27T07:00:00.000Z",
    endAt: "2026-08-27T07:30:00.000Z",
    timezone: "Asia/Shanghai",
    participantContactIds: [],
    participantNames: ["Maya"],
    notes: "",
  },
};

const result: ToolResult = {
  actionId: contact.id,
  success: true,
  provider: "demo",
  entityRef: {
    type: "contact",
    id: "00000000-0000-4000-8000-000000000101",
  },
};

describe("action batch planning", () => {
  it("keeps card order stable within contact-first execution groups", () => {
    expect(orderActionsForExecution([meeting, contact]).map((action) => action.id)).toEqual([
      contact.id,
      meeting.id,
    ]);
  });

  it("links a meeting alias to a successfully created contact", () => {
    const linked = linkContactsToMeetingAction(meeting, [contact, meeting], [result]);
    expect(linked.type).toBe("create_meeting");
    if (linked.type === "create_meeting") {
      expect(linked.payload.participantContactIds).toEqual([result.entityRef?.id]);
    }
  });

  it("does not guess when two created contacts share the same alias", () => {
    const secondContact: CreateContactCard = {
      ...contact,
      id: "action-create-another-maya",
      payload: { ...contact.payload, displayName: "Maya Lin", familyName: "Lin" },
    };
    const ambiguous = linkContactsToMeetingAction(
      meeting,
      [contact, secondContact, meeting],
      [
        result,
        {
          ...result,
          actionId: secondContact.id,
          entityRef: { type: "contact", id: "00000000-0000-4000-8000-000000000102" },
        },
      ],
    );
    expect(ambiguous.type).toBe("create_meeting");
    if (ambiguous.type === "create_meeting") {
      expect(ambiguous.payload.participantContactIds).toEqual([]);
    }
  });

  it("resolves a self alias to an existing self contact", () => {
    const self: ContactRecord = {
      id: "00000000-0000-4000-8000-000000000201",
      displayName: "Kai",
      phones: [],
      emails: [],
      isSelf: true,
      status: "active",
      source: "trace",
      createdAt: "2026-08-26T03:30:00.000Z",
      updatedAt: "2026-08-26T03:30:00.000Z",
    };
    const linked = linkContactsToMeetingAction(
      { ...meeting, payload: { ...meeting.payload, participantNames: ["我"] } },
      [meeting],
      [],
      [self],
    );

    expect(linked.type).toBe("create_meeting");
    if (linked.type === "create_meeting") {
      expect(linked.payload.participantContactIds).toEqual([self.id]);
    }
  });

  it("adds a same-run self contact to an existing meeting update", () => {
    const selfAction: CreateContactCard = {
      ...contact,
      id: "action-create-self",
      title: "Create my contact",
      payload: { ...contact.payload, displayName: "Kai", givenName: "Kai", familyName: "", isSelf: true },
    };
    const selfResult: ToolResult = {
      ...result,
      actionId: selfAction.id,
      entityRef: { type: "contact", id: "00000000-0000-4000-8000-000000000202" },
    };
    const update: UpdateMeetingCard = {
      id: "action-update-interview",
      type: "update_meeting",
      title: "Add me to the interview",
      confidence: 0.92,
      evidenceRefs: ["evidence-meeting"],
      editableFields: ["participantNames"],
      riskFlags: [],
      memoryProposals: [],
      payload: {
        meetingId: "meeting-interview",
        displayTitle: "HR interview",
        participantNames: ["Me"],
        changes: [{ field: "notes", previousValue: null, nextValue: "Bring portfolio." }],
      },
    };
    const existingMeeting: MeetingRecord = {
      id: "00000000-0000-4000-8000-000000000203",
      externalEventId: "meeting-interview",
      title: "HR interview",
      timezone: "Asia/Shanghai",
      allDay: false,
      participantContactIds: ["00000000-0000-4000-8000-000000000204"],
      status: "active",
      source: "trace",
      createdAt: "2026-08-26T03:30:00.000Z",
      updatedAt: "2026-08-26T03:30:00.000Z",
    };

    const linked = linkContactsToMeetingAction(
      update,
      [selfAction, update],
      [selfResult],
      [],
      existingMeeting,
    );

    expect(linked.type).toBe("update_meeting");
    if (linked.type === "update_meeting") {
      expect(linked.payload.changes).toContainEqual({
        field: "participantContactIds",
        previousValue: existingMeeting.participantContactIds,
        nextValue: [...existingMeeting.participantContactIds, selfResult.entityRef?.id],
      });
    }
  });
});
