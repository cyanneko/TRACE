import type { ActionCard, ToolResult } from "@trace/contracts";

export interface ActionExecutor {
  execute(sourceRunId: string, action: ActionCard): Promise<ToolResult>;
}
