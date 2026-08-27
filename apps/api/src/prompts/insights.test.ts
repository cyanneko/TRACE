import type { InsightRequest } from "@trace/contracts";
import { describe, expect, it } from "vitest";

import { getAnalyzeFixture } from "../fixtures/analyzeFixtures.js";
import { buildInsightsPrompt, buildInsightsRepairPrompt } from "./insights.js";

const screenshotDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function insightRequest(): InsightRequest {
  const fixture = getAnalyzeFixture("meeting");
  const action = fixture.actionCards[0]!;
  const timestamps = {
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
  };
  return {
    sourceRunId: "10000000-0000-4000-8000-000000000001",
    screenshotDataUrl,
    note: "Keep the recommendation practical.",
    thread: fixture.thread,
    confirmedActions: [action],
    toolResults: [
      {
        actionId: action.id,
        success: true,
        provider: "demo",
        externalId: "demo-meeting-review",
        entityRef: {
          type: "meeting",
          id: "20000000-0000-4000-8000-000000000001",
        },
      },
    ],
    entityMemories: [
      {
        id: "30000000-0000-4000-8000-000000000001",
        ownerType: "global",
        ownerId: "00000000-0000-4000-8000-000000000000",
        content: "Prefer concise summaries.",
        status: "active",
        source: "manual",
        sourceEvidenceRefs: [],
        confidence: 1,
        ...timestamps,
      },
      {
        id: "30000000-0000-4000-8000-000000000002",
        ownerType: "contact",
        ownerId: "40000000-0000-4000-8000-000000000001",
        content: "Maya prefers receiving the deck in advance.",
        status: "active",
        source: "manual",
        sourceEvidenceRefs: [],
        confidence: 1,
        ...timestamps,
      },
      {
        id: "30000000-0000-4000-8000-000000000003",
        ownerType: "meeting",
        ownerId: "20000000-0000-4000-8000-000000000001",
        content: "The design review needs a revised deck.",
        status: "active",
        source: "action",
        sourceRunId: "10000000-0000-4000-8000-000000000001",
        sourceActionId: action.id,
        sourceEvidenceRefs: action.evidenceRefs,
        confidence: 0.94,
        ...timestamps,
      },
    ],
    contacts: [
      {
        id: "40000000-0000-4000-8000-000000000001",
        displayName: "Maya Chen",
        company: "Northstar",
        jobTitle: "Head of Product",
        phones: [],
        emails: [],
      },
    ],
    meetings: [
      {
        id: "20000000-0000-4000-8000-000000000001",
        title: "Design review",
        startAt: "2026-08-27T07:00:00.000Z",
        endAt: "2026-08-27T07:30:00.000Z",
        timezone: "Asia/Shanghai",
        allDay: false,
        location: "",
        meetingLink: "",
        notes: "Send the deck first.",
        participantContactIds: ["40000000-0000-4000-8000-000000000001"],
      },
    ],
    timezone: "Asia/Shanghai",
    currentTime: "2026-08-26T03:30:00.000Z",
  };
}

describe("buildInsightsPrompt", () => {
  it("includes original analysis context and all three active memory scopes", () => {
    const prompt = buildInsightsPrompt(insightRequest());

    expect(prompt).toContain("screenshot_with_optional_description");
    expect(prompt).toContain("Keep the recommendation practical");
    expect(prompt).toContain("Maya 确认明天下午三点");
    expect(prompt).toContain("demo-meeting-review");
    expect(prompt).toContain("Prefer concise summaries");
    expect(prompt).toContain("Maya prefers receiving the deck in advance");
    expect(prompt).toContain("The design review needs a revised deck");
    expect(prompt).toContain("globalMemoryOperations are applied automatically");
    expect(prompt).toContain("Never target contact or meeting memory");
  });

  it("feeds reference failures back into the repair pass", () => {
    const prompt = buildInsightsRepairPrompt(insightRequest(), "{}", [
      { path: "globalMemoryOperations.0.memoryId", message: "Not an active global memory." },
    ]);

    expect(prompt).toContain("globalMemoryOperations.0.memoryId");
    expect(prompt).toContain("Not an active global memory");
  });
});
