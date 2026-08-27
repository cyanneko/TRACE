import type { ActionCard, ToolResult } from "@trace/contracts";

export type ActionExecutionContext = {
  targetExternalId?: string;
  targetLocalId?: string;
};

export interface ActionExecutor {
  execute(sourceRunId: string, action: ActionCard, context?: ActionExecutionContext): Promise<ToolResult>;
}
