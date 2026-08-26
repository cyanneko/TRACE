import type { InsightResult, MemoryEntry, ToolResult } from "@trace/contracts";

export type ExecutionState = {
  status: "idle" | "running" | "insighting" | "complete" | "failed" | "partial";
  results: ToolResult[];
  activeMemories: MemoryEntry[];
  writtenMemoryIds: string[];
  supersededMemoryIds: string[];
  insights: InsightResult | null;
  error: string | null;
};

export const initialExecutionState: ExecutionState = {
  status: "idle",
  results: [],
  activeMemories: [],
  writtenMemoryIds: [],
  supersededMemoryIds: [],
  insights: null,
  error: null,
};

export type ExecutionEvent =
  | { type: "START" }
  | {
      type: "EXECUTED";
      results: ToolResult[];
      activeMemories: MemoryEntry[];
      writtenMemoryIds: string[];
      supersededMemoryIds: string[];
    }
  | { type: "INSIGHTS_START" }
  | { type: "INSIGHTS_READY"; insights: InsightResult }
  | { type: "FAILED"; error: string }
  | { type: "MEMORY_DELETED"; memoryId: string }
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
        activeMemories: event.activeMemories,
        writtenMemoryIds: event.writtenMemoryIds,
        supersededMemoryIds: event.supersededMemoryIds,
      };
    case "INSIGHTS_START":
      return { ...state, status: "insighting", error: null };
    case "INSIGHTS_READY":
      return { ...state, status: "complete", insights: event.insights, error: null };
    case "FAILED":
      return {
        ...state,
        status: state.results.length > 0 ? "partial" : "failed",
        error: event.error,
      };
    case "MEMORY_DELETED":
      return {
        ...state,
        activeMemories: state.activeMemories.filter((memory) => memory.id !== event.memoryId),
        writtenMemoryIds: state.writtenMemoryIds.filter((id) => id !== event.memoryId),
      };
    case "RESET":
      return initialExecutionState;
  }
}
