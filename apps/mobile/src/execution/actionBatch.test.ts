import type { CreateContactCard, CreateMeetingCard, ToolResult } from "@trace/contracts";
import { describe, expect, it } from "vitest";

import { linkCreatedContactsToMeeting, orderActionsForExecution } from "./actionBatch";

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
    const linked = linkCreatedContactsToMeeting(meeting, [contact, meeting], [result]);
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
    const ambiguous = linkCreatedContactsToMeeting(
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
});
