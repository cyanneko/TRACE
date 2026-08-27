import type { ActionCard, ToolResult } from "@trace/contracts";

import type { EntityRepository } from "../entities/types";
import type { ActionExecutionContext, ActionExecutor } from "./types";

async function actionExecutionContext(
  action: ActionCard,
  entities: EntityRepository,
): Promise<ActionExecutionContext> {
  if (action.type === "update_contact" && action.payload.contactId) {
    const contact = await entities.findContact(action.payload.contactId);
    return contact
      ? { targetExternalId: contact.externalContactId, targetLocalId: contact.id }
      : {};
  }
  if (action.type === "update_meeting" && action.payload.meetingId) {
    const meeting = await entities.findMeeting(action.payload.meetingId);
    return meeting
      ? { targetExternalId: meeting.externalEventId, targetLocalId: meeting.id }
      : {};
  }
  return {};
}

export async function executeAndCommit(
  sourceRunId: string,
  action: ActionCard,
  executor: ActionExecutor,
  entities: EntityRepository,
  timezone: string,
): Promise<ToolResult> {
  const result = await executor.execute(sourceRunId, action, await actionExecutionContext(action, entities));
  if (!result.success) {
    return result;
  }

  try {
    const commit = await entities.commitSuccessfulAction({
      sourceRunId,
      action,
      result: { ...result, success: true },
      timezone,
    });
    return { ...result, entityRef: commit.entityRef };
  } catch (error) {
    return {
      ...result,
      success: false,
      error: `The device write succeeded, but TRACE could not update local memory: ${
        error instanceof Error ? error.message : "unknown local error"
      }`,
    };
  }
}
