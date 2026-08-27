import type { AnalyzeResult, CreateContactCard, CreateMeetingCard } from "@trace/contracts";
import { describe, expect, it } from "vitest";

import { mergeSequentialAnalysis } from "./sequentialPlanning";

const contactCard: CreateContactCard = {
  id: "action-1",
  type: "create_contact",
  title: "Create my contact",
  confidence: 0.98,
  evidenceRefs: ["evidence-1"],
  editableFields: ["displayName", "isSelf"],
  riskFlags: [],
  memoryProposals: [],
  payload: {
    displayName: "Kai",
    givenName: "Kai",
    familyName: "",
    company: "",
    jobTitle: "",
    phones: [],
    emails: [],
    isSelf: true,
    interactionSummary: "Kai introduced themself.",
  },
};

const meetingCard: CreateMeetingCard = {
  id: "action-1",
  type: "create_meeting",
  title: "Create interview",
  confidence: 0.94,
  evidenceRefs: ["evidence-1"],
  editableFields: ["startAt", "endAt"],
  riskFlags: [],
  memoryProposals: [],
  payload: {
    title: "HR interview",
    startAt: "2026-08-28T06:00:00.000Z",
    endAt: "2026-08-28T06:45:00.000Z",
    timezone: "Asia/Shanghai",
    participantContactIds: [],
    participantNames: ["Kai", "Lina"],
  },
};

const first: AnalyzeResult = {
  runId: "10000000-0000-4000-8000-000000000001",
  provider: { id: "fixture", model: "fixture", fixture: true },
  thread: {
    summary: "Kai and Lina discussed an interview.",
    participants: [{ displayName: "Kai", confidence: 0.98, isSelf: true }],
    evidence: [{ id: "evidence-1", quote: "I am Kai.", speaker: "User" }],
    uncertainties: [],
  },
  actionCards: [contactCard],
};

const second: AnalyzeResult = {
  runId: "10000000-0000-4000-8000-000000000002",
  provider: { id: "fixture", model: "fixture", fixture: true },
  thread: {
    summary: "An interview was scheduled.",
    participants: [
      {
        displayName: "Kai",
        contactId: "20000000-0000-4000-8000-000000000001",
        confidence: 0.99,
        isSelf: true,
      },
      { displayName: "Lina", confidence: 0.94, isSelf: false },
    ],
    evidence: [{ id: "evidence-1", quote: "Tomorrow at two.", speaker: "Lina" }],
    uncertainties: [],
  },
  actionCards: [meetingCard],
};

describe("mergeSequentialAnalysis", () => {
  it("preserves the workflow run and avoids evidence and action id collisions", () => {
    const merged = mergeSequentialAnalysis(first, [contactCard], second);

    expect(merged.runId).toBe(first.runId);
    expect(merged.actionCards.map((action) => action.id)).toEqual(["action-1", "action-1-2"]);
    expect(merged.thread.evidence.map((evidence) => evidence.id)).toEqual([
      "evidence-1",
      "meeting-evidence-1",
    ]);
    expect(merged.actionCards[1]?.evidenceRefs).toEqual(["meeting-evidence-1"]);
    expect(merged.thread.participants[0]).toMatchObject({
      displayName: "Kai",
      contactId: "20000000-0000-4000-8000-000000000001",
      isSelf: true,
    });
  });
});
