import type { InsightResult, ToolResult } from "@trace/contracts";

export type ExecutionState = {
  status: "idle" | "running" | "insighting" | "complete" | "failed" | "partial";
  results: ToolResult[];
  globalMemoryChangeCount: number;
  globalMemoryOperationCount: number;
  globalMemorySkippedCount: number;
  insights: InsightResult | null;
  error: string | null;
};

export const initialExecutionState: ExecutionState = {
  status: "idle",
  results: [],
  globalMemoryChangeCount: 0,
  globalMemoryOperationCount: 0,
  globalMemorySkippedCount: 0,
  insights: null,
  error: null,
};

export type ExecutionEvent =
  | { type: "START" }
  | {
      type: "EXECUTED";
      results: ToolResult[];
    }
  | { type: "INSIGHTS_START" }
  | {
      type: "INSIGHTS_READY";
      insights: InsightResult;
      globalMemoryChangeCount: number;
      globalMemoryOperationCount: number;
      globalMemorySkippedCount: number;
    }
  | { type: "FAILED"; error: string }
  | { type: "RESET" };

export function executionReducer(state: ExecutionState, event: ExecutionEvent): ExecutionState {
  switch (event.type) {
    case "START":
      return { ...initialExecutionState, status: "running" };
    case "EXECUTED":
      return {
        ...state,
        status: "insighting",
        results: event.results,
      };
    case "INSIGHTS_START":
      return { ...state, status: "insighting", error: null };
    case "INSIGHTS_READY":
      return {
        ...state,
        status: "complete",
        insights: event.insights,
        globalMemoryChangeCount: event.globalMemoryChangeCount,
        globalMemoryOperationCount: event.globalMemoryOperationCount,
        globalMemorySkippedCount: event.globalMemorySkippedCount,
        error: null,
      };
    case "FAILED":
      return {
        ...state,
        status: state.results.length > 0 ? "partial" : "failed",
        error: event.error,
      };
    case "RESET":
      return initialExecutionState;
  }
}
