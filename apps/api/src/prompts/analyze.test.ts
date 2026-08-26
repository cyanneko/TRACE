import type { AnalyzeRequest } from "@trace/contracts";
import { describe, expect, it } from "vitest";

import { buildAnalyzePrompt, buildRepairPrompt } from "./analyze.js";

const input: AnalyzeRequest = {
  screenshotDataUrl:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  note: "",
  contacts: [],
  memories: [],
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
      notes: "",
      participantContactIds: [],
    },
  ],
  entityMemories: [
    {
      id: "10000000-0000-4000-8000-000000000001",
      ownerType: "meeting",
      ownerId: "20000000-0000-4000-8000-000000000001",
      kind: "commitment",
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
    expect(prompt).toContain("UTC ISO 8601 timestamps ending in Z");
    expect(prompt).not.toContain("at most three actions");
  });

  it("includes meeting and entity-owned memory context", () => {
    const prompt = buildAnalyzePrompt(input);

    expect(prompt).toContain("Design review");
    expect(prompt).toContain("Send the deck before the review");
  });

  it("tells the repair pass which schema path failed", () => {
    const prompt = buildRepairPrompt(input, "{}", [
      { path: "actionCards.0.payload.startAt", message: "Invalid ISO datetime" },
    ]);

    expect(prompt).toContain("actionCards.0.payload.startAt");
    expect(prompt).toContain("Invalid ISO datetime");
  });
});
