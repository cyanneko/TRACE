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
});
