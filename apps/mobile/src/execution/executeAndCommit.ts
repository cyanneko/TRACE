import type { ActionCard, ToolResult } from "@trace/contracts";

import type { EntityRepository } from "../entities/types";
import type { ActionExecutor } from "./types";

async function targetExternalId(action: ActionCard, entities: EntityRepository): Promise<string | undefined> {
  if (action.type === "update_contact" && action.payload.contactId) {
    const contact = await entities.findContact(action.payload.contactId);
    return contact?.externalContactId ?? action.payload.contactId;
  }
  if (action.type === "update_meeting" && action.payload.meetingId) {
    const meeting = await entities.findMeeting(action.payload.meetingId);
    return meeting?.externalEventId;
  }
  return undefined;
}

export async function executeAndCommit(
  sourceRunId: string,
  action: ActionCard,
  executor: ActionExecutor,
  entities: EntityRepository,
  timezone: string,
): Promise<ToolResult> {
  const result = await executor.execute(sourceRunId, action, {
    targetExternalId: await targetExternalId(action, entities),
  });
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
