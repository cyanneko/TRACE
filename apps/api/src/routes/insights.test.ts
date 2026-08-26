import type { InsightRequest } from "@trace/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { getAnalyzeFixture } from "../fixtures/analyzeFixtures.js";
import { FixtureProvider } from "../providers/fixtureProvider.js";
import { buildServer } from "../server.js";

const sourceRunId = "2f887426-3d1f-4b68-a6bc-58e975ac35fb";
const memoryId = "8b9b25de-8616-45f5-b9fd-baa09ae8f6dc";
const servers: ReturnType<typeof buildServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

function createServer() {
  const server = buildServer({ provider: new FixtureProvider() });
  servers.push(server);
  return server;
}

function meetingRequest(): InsightRequest {
  const fixture = getAnalyzeFixture("meeting");
  const action = fixture.actionCards[0]!;
  return {
    sourceRunId,
    thread: fixture.thread,
    confirmedActions: [action],
    toolResults: [
      {
        actionId: action.id,
        success: true,
        provider: "demo" as const,
        externalId: "demo-event-1",
      },
    ],
    memories: [
      {
        id: memoryId,
        contactId: "contact-maya",
        type: "open_loop" as const,
        key: "meeting:2026-08-27T07:00:00.000Z:与 Maya 的设计评审",
        value: { title: "与 Maya 的设计评审" },
        status: "active" as const,
        sourceRunId,
        sourceActionId: action.id,
        sourceEvidenceRefs: action.evidenceRefs,
        confidence: action.confidence,
        createdAt: "2026-08-26T03:30:00.000Z",
        updatedAt: "2026-08-26T03:30:00.000Z",
      },
    ],
    contacts: [],
    timezone: "Asia/Shanghai",
    currentTime: "2026-08-26T03:30:00.000Z",
  };
}

describe("POST /v1/insights", () => {
  it("returns evidence- and memory-backed help after execution", async () => {
    const response = await createServer().inject({
      method: "POST",
      url: "/v1/insights",
      payload: meetingRequest(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      sourceRunId,
      provider: {
        fixture: true,
        id: "trace-policy",
      },
      insights: [
        {
          importance: "high",
          evidenceRefs: ["evidence-meeting-time", "evidence-send-deck"],
          memoryRefs: [memoryId],
        },
      ],
    });
  });

  it("does not produce factual insights for a failed action", async () => {
    const payload = meetingRequest();
    payload.toolResults[0] = {
      actionId: payload.confirmedActions[0]!.id,
      success: false,
      provider: "demo",
    };

    const response = await createServer().inject({
      method: "POST",
      url: "/v1/insights",
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().insights).toEqual([]);
    expect(response.json().unresolvedQuestions[0]).toContain("没有成功执行");
  });

  it("rejects a result for an action that was never confirmed", async () => {
    const payload = meetingRequest();
    payload.confirmedActions = [];

    const response = await createServer().inject({
      method: "POST",
      url: "/v1/insights",
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("INVALID_INSIGHT_REQUEST");
  });
});
