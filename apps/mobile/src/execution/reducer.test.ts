import { USER_NOTE_EVIDENCE_ID } from "@trace/contracts";
import { describe, expect, it } from "vitest";

import { executionReducer, initialExecutionState } from "./reducer";

describe("executionReducer", () => {
  it("keeps successful writes visible when insight generation fails", () => {
    const running = executionReducer(initialExecutionState, { type: "START" });
    const executed = executionReducer(running, {
      type: "EXECUTED",
      results: [{ actionId: "action-1", success: true, provider: "demo", externalId: "event-1" }],
      activeMemories: [],
      writtenMemoryIds: [],
      supersededMemoryIds: [],
    });
    const failed = executionReducer(executed, { type: "FAILED", error: "Insights unavailable" });

    expect(failed.status).toBe("partial");
    expect(failed.results).toHaveLength(1);
    expect(failed.error).toBe("Insights unavailable");
  });

  it("keeps proposed and skipped Global Memory operation counts visible", () => {
    const complete = executionReducer(initialExecutionState, {
      type: "INSIGHTS_READY",
      insights: {
        sourceRunId: "10000000-0000-4000-8000-000000000001",
        generatedAt: "2026-08-26T03:30:00.000Z",
        provider: { fixture: true, id: "fixture", model: "fixture" },
        insights: [],
        unresolvedQuestions: [],
        globalMemoryOperations: [
          {
            type: "create",
            content: "Prefer concise follow-ups.",
            evidenceRefs: [USER_NOTE_EVIDENCE_ID],
            confidence: 1,
          },
        ],
      },
      globalMemoryChangeCount: 0,
      globalMemoryOperationCount: 1,
      globalMemorySkippedCount: 1,
    });

    expect(complete).toMatchObject({
      status: "complete",
      globalMemoryChangeCount: 0,
      globalMemoryOperationCount: 1,
      globalMemorySkippedCount: 1,
    });
  });
});
