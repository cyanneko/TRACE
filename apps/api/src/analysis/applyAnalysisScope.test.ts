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

  it("clears deleted update targets and their explicit memory proposals", () => {
    const contactOutput = getAnalyzeFixture("update-contact");
    const reconciledContact = applyAnalysisScope(request("contacts"), contactOutput);
    const contactAction = reconciledContact.actionCards[0]!;

    expect(reconciledContact.thread.participants[0]).not.toHaveProperty("contactId");
    expect(contactAction.type).toBe("update_contact");
    if (contactAction.type !== "update_contact") throw new Error("Expected update_contact action.");
    expect(contactAction.payload.contactId).toBeNull();
    expect(contactAction.riskFlags).toContain("contact_not_found");
    expect(contactAction.memoryProposals).toEqual([]);

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
});
