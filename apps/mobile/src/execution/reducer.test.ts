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
});
