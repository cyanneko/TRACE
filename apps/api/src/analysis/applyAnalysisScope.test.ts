import type { AnalyzeRequest } from "@trace/contracts";
import { describe, expect, it } from "vitest";

import { getAnalyzeFixture } from "../fixtures/analyzeFixtures.js";
import { applyAnalysisScope } from "./applyAnalysisScope.js";

function request(actionScope: AnalyzeRequest["actionScope"]): AnalyzeRequest {
  return {
    actionScope,
    note: "I am Kai. Lina HR invited me to an interview.",
    contacts: [],
    memories: [],
    meetings: [],
    entityMemories: [],
    reviewFeedback: "",
    timezone: "Asia/Shanghai",
    currentTime: "2026-08-27T03:30:00.000Z",
  };
}

describe("applyAnalysisScope", () => {
  it("keeps only actions for the requested planning pass", () => {
    const output = getAnalyzeFixture("self-meeting");

    expect(applyAnalysisScope(request("contacts"), output).actionCards.every((action) =>
      action.type === "create_contact" || action.type === "update_contact"
    )).toBe(true);
    expect(applyAnalysisScope(request("meetings"), output).actionCards).toHaveLength(1);
    expect(applyAnalysisScope(request("meetings"), output).actionCards[0]?.type).toBe("create_meeting");
  });

  it("recovers a grounded self-contact card omitted by the model", () => {
    const output = getAnalyzeFixture("self-meeting");
    output.actionCards = output.actionCards.filter(
      (action) => action.type !== "create_contact" || !action.payload.isSelf,
    );
    output.thread.participants[0] = { ...output.thread.participants[0]!, isSelf: undefined };

    const recovered = applyAnalysisScope(request("contacts"), output);

    expect(recovered.actionCards).toContainEqual(
      expect.objectContaining({
        type: "create_contact",
        evidenceRefs: ["evidence-self-name"],
        payload: expect.objectContaining({ displayName: "Kai", isSelf: true }),
      }),
    );
    expect(recovered.thread.participants[0]?.isSelf).toBe(true);
  });

  it("does not create a duplicate when a self contact is supplied", () => {
    const output = getAnalyzeFixture("self-meeting");
    output.actionCards = output.actionCards.filter(
      (action) => action.type !== "create_contact" || !action.payload.isSelf,
    );
    const input = request("contacts");
    input.contacts = [
      {
        id: "contact-self",
        displayName: "Kai",
        company: "",
        jobTitle: "",
        phones: [],
        emails: [],
        isSelf: true,
      },
    ];

    const recovered = applyAnalysisScope(input, output);

    expect(recovered.actionCards.some(
      (action) => action.type === "create_contact" && action.payload.isSelf,
    )).toBe(false);
  });

  it("does not treat a person merely mentioned by the user as self", () => {
    const output = getAnalyzeFixture("self-meeting");
    output.actionCards = output.actionCards.filter(
      (action) => action.type !== "create_contact" || !action.payload.isSelf,
    );
    output.thread.participants[0] = { ...output.thread.participants[0]!, isSelf: undefined };
    output.thread.evidence[0] = {
      ...output.thread.evidence[0]!,
      quote: "Kai will also attend the interview.",
      speaker: "User",
    };

    const recovered = applyAnalysisScope(request("contacts"), output);

    expect(recovered.actionCards.some(
      (action) => action.type === "create_contact" && action.payload.isSelf,
    )).toBe(false);
  });

  it("removes a participant match when the referenced contact no longer exists", () => {
    const output = getAnalyzeFixture("meeting");
    output.thread.participants[0] = {
      ...output.thread.participants[0]!,
      contactId: "deleted-contact",
    };
    const meeting = output.actionCards[0]!;
    if (meeting.type !== "create_meeting") throw new Error("Expected create_meeting fixture.");
    meeting.payload.participantContactIds = ["deleted-contact"];

    const reconciled = applyAnalysisScope(request("meetings"), output);
    const action = reconciled.actionCards[0]!;

    expect(reconciled.thread.participants[0]).not.toHaveProperty("contactId");
    expect(action.type).toBe("create_meeting");
    if (action.type !== "create_meeting") throw new Error("Expected create_meeting action.");
    expect(action.payload.participantContactIds).toEqual([]);
    expect(action.riskFlags).toContain("contact_not_found");
  });

  it("turns a stale direct-participant update into a confirmable new contact", () => {
    const contactOutput = getAnalyzeFixture("update-contact");
    const reconciledContact = applyAnalysisScope(request("contacts"), contactOutput);
    const contactAction = reconciledContact.actionCards[0]!;

    expect(reconciledContact.thread.participants[0]).not.toHaveProperty("contactId");
    expect(contactAction.type).toBe("create_contact");
    if (contactAction.type !== "create_contact") throw new Error("Expected create_contact action.");
    expect(contactAction.payload).toMatchObject({
      displayName: "Maya Chen",
      company: "Northstar",
      jobTitle: "Head of Product",
    });
    expect(contactAction.riskFlags).toContain("previous_contact_missing");
    expect(contactAction.memoryProposals).toEqual([]);
  });

  it("keeps an unmatched meeting update unresolved for explicit user selection", () => {
    const meetingOutput = getAnalyzeFixture("update-meeting");
    const reconciledMeeting = applyAnalysisScope(request("meetings"), meetingOutput);
    const meetingAction = reconciledMeeting.actionCards[0]!;

    expect(meetingAction.type).toBe("update_meeting");
    if (meetingAction.type !== "update_meeting") throw new Error("Expected update_meeting action.");
    expect(meetingAction.payload.meetingId).toBeNull();
    expect(meetingAction.riskFlags).toContain("meeting_not_found");
    expect(meetingAction.memoryProposals).toEqual([]);
  });

  it("canonicalizes a known external contact id instead of treating it as deleted", () => {
    const input = request("contacts");
    input.contacts = [
      {
        id: "local-maya",
        externalContactId: "contact-maya",
        displayName: "Maya Chen",
        company: "Atelier",
        jobTitle: "Product Designer",
        phones: [],
        emails: [],
      },
    ];
    const reconciled = applyAnalysisScope(input, getAnalyzeFixture("update-contact"));
    const action = reconciled.actionCards[0]!;

    expect(reconciled.thread.participants[0]?.contactId).toBe("local-maya");
    expect(action.type).toBe("update_contact");
    if (action.type !== "update_contact") throw new Error("Expected update_contact action.");
    expect(action.payload.contactId).toBe("local-maya");
    expect(action.riskFlags).not.toContain("contact_not_found");
    expect(action.memoryProposals[0]?.target).toEqual({ type: "contact", contactId: "local-maya" });
  });

  it("keeps a same-name ambiguous contact update unresolved", () => {
    const input = request("contacts");
    input.contacts = ["one", "two"].map((suffix) => ({
      id: `local-maya-${suffix}`,
      displayName: "Maya Chen",
      company: "",
      jobTitle: "",
      phones: [],
      emails: [],
    }));

    const reconciled = applyAnalysisScope(input, getAnalyzeFixture("update-contact"));
    const action = reconciled.actionCards[0]!;

    expect(action.type).toBe("update_contact");
    if (action.type !== "update_contact") throw new Error("Expected update_contact action.");
    expect(action.payload.contactId).toBeNull();
    expect(action.riskFlags).toContain("contact_not_found");
  });

  it("matches a meeting update by one exact local title when the model id is stale", () => {
    const input = request("meetings");
    input.meetings = [
      {
        id: "local-design-review",
        title: "与 Maya 的设计评审",
        startAt: "2026-08-27T07:00:00.000Z",
        endAt: "2026-08-27T07:30:00.000Z",
        timezone: "Asia/Shanghai",
        allDay: false,
        location: "",
        meetingLink: "",
        participantContactIds: [],
      },
    ];

    const reconciled = applyAnalysisScope(input, getAnalyzeFixture("update-meeting"));
    const action = reconciled.actionCards[0]!;

    expect(action.type).toBe("update_meeting");
    if (action.type !== "update_meeting") throw new Error("Expected update_meeting action.");
    expect(action.payload.meetingId).toBe("local-design-review");
    expect(action.riskFlags).not.toContain("meeting_not_found");
  });

  it("preselects uniquely named saved contacts for a proposed meeting", () => {
    const input = request("meetings");
    input.contacts = [
      {
        id: "local-maya",
        displayName: "Maya Chen",
        givenName: "Maya",
        familyName: "Chen",
        company: "Atelier",
        jobTitle: "Designer",
        phones: [],
        emails: [],
      },
    ];
    const output = getAnalyzeFixture("meeting");
    const meeting = output.actionCards[0]!;
    if (meeting.type !== "create_meeting") throw new Error("Expected create_meeting fixture.");
    meeting.payload.participantContactIds = ["deleted-contact"];
    meeting.payload.participantNames = ["Maya"];

    const reconciled = applyAnalysisScope(input, output);
    const action = reconciled.actionCards[0]!;

    expect(reconciled.thread.participants[0]?.contactId).toBe("local-maya");
    expect(action.type).toBe("create_meeting");
    if (action.type !== "create_meeting") throw new Error("Expected create_meeting action.");
    expect(action.payload.participantContactIds).toEqual(["local-maya"]);
    expect(action.riskFlags).not.toContain("contact_not_found");
  });

  it("recovers a minimal contact card when the model omits a direct participant", () => {
    const output = getAnalyzeFixture("contact-meeting");
    output.actionCards = output.actionCards.filter((action) => action.type !== "create_contact");

    const recovered = applyAnalysisScope(request("contacts"), output);

    expect(recovered.actionCards).toContainEqual(
      expect.objectContaining({
        type: "create_contact",
        evidenceRefs: ["evidence-linqiao-intro", "evidence-linqiao-meeting"],
        payload: expect.objectContaining({ displayName: "林乔", isSelf: false }),
      }),
    );
  });
});
