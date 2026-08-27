import type { AnalyzeRequest } from "@trace/contracts";
import { describe, expect, it } from "vitest";

import { buildAnalyzePrompt, buildRepairPrompt } from "./analyze.js";

const input: AnalyzeRequest = {
  actionScope: "all",
  screenshotDataUrl:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  note: "",
  reviewFeedback: "",
  contacts: [],
  meetings: [
    {
      id: "meeting-review",
      title: "Design review",
      startAt: "2026-08-27T07:00:00.000Z",
      endAt: "2026-08-27T07:30:00.000Z",
      timezone: "Asia/Shanghai",
      allDay: false,
      location: "",
      meetingLink: "",
      participantContactIds: [],
    },
  ],
  entityMemories: [
    {
      id: "10000000-0000-4000-8000-000000000001",
      ownerType: "meeting",
      ownerId: "20000000-0000-4000-8000-000000000001",
      content: "Send the deck before the review.",
      status: "active",
      source: "manual",
      sourceEvidenceRefs: [],
      confidence: 1,
      createdAt: "2026-08-20T00:00:00.000Z",
      updatedAt: "2026-08-20T00:00:00.000Z",
    },
  ],
  timezone: "Asia/Shanghai",
  currentTime: "2026-08-26T03:30:00.000Z",
};

describe("buildAnalyzePrompt", () => {
  it("requests all four action types without a three-card limit", () => {
    const prompt = buildAnalyzePrompt(input);

    expect(prompt).toContain("There is no business count limit");
    expect(prompt).toContain("update_meeting");
    expect(prompt).toContain("directly interacts with the user");
    expect(prompt).toContain("create_contact with isSelf true");
    expect(prompt).toContain("Meetings must include every attendee, including the user");
    expect(prompt).toContain("For update_meeting, put pending names in payload.participantNames");
    expect(prompt).toContain("complete phones and emails lists");
    expect(prompt).toContain("never encode a reschedule only as free-text memory");
    expect(prompt).toContain("memoryProposals are the only place for durable free-text context");
    expect(prompt).toContain("always emit a startAt change");
    expect(prompt).toContain("also emit the corresponding endAt change");
    expect(prompt).toContain("UTC ISO 8601 timestamps ending in Z");
    expect(prompt).not.toContain("at most three actions");
  });

  it("includes meeting and entity-owned memory context", () => {
    const prompt = buildAnalyzePrompt(input);

    expect(prompt).toContain("Design review");
    expect(prompt).toContain("Send the deck before the review");
    expect(prompt).not.toContain("legacyMemories");
  });

  it("focuses the first pass on contacts and the second pass on confirmed meeting participants", () => {
    const contactPrompt = buildAnalyzePrompt({ ...input, actionScope: "contacts" });
    const meetingPrompt = buildAnalyzePrompt({ ...input, actionScope: "meetings" });

    expect(contactPrompt).toContain("CONTACT PASS 1");
    expect(contactPrompt).toContain("Every directly interacting unmatched participant, including the user");
    expect(meetingPrompt).toContain("MEETING PASS 2");
    expect(meetingPrompt).toContain("supplied contacts are the confirmed result of pass 1");
    expect(meetingPrompt).toContain("even when its time or other fields are incomplete");
    expect(meetingPrompt).toContain("genuinely no grounded meeting or meeting change");
    expect(meetingPrompt).toContain("Never propose Global Memory here");
  });

  it("keeps stage feedback as guidance rather than conversation evidence", () => {
    const prompt = buildAnalyzePrompt({
      ...input,
      actionScope: "contacts",
      reviewFeedback: "The green speaker is me; use the name from my introduction.",
    });

    expect(prompt).toContain("The green speaker is me");
    expect(prompt).toContain("Treat feedback as explicit user clarification");
  });

  it("tells the repair pass which schema path failed", () => {
    const prompt = buildRepairPrompt(input, "{}", [
      { path: "actionCards.0.payload.startAt", message: "Invalid ISO datetime" },
    ]);

    expect(prompt).toContain("actionCards.0.payload.startAt");
    expect(prompt).toContain("Invalid ISO datetime");
  });
});
