import {
  ActionExecutionRecordSchema,
  type ActionCard,
  type ActionExecutionRecord,
  type ToolResult,
} from "@trace/contracts";

import { createUuid } from "../lib/uuid";
import { getDeviceKeyValueStore, type KeyValueStore } from "../storage/keyValueStore";
import type { ActionExecutionContext, ActionExecutor } from "./types";

const STORAGE_KEY = "trace.demo.action-events.v1";
const StoredRecordsSchema = ActionExecutionRecordSchema.array();

type Options = {
  createId?: () => string;
  now?: () => string;
  store?: KeyValueStore;
};

function externalPrefix(action: ActionCard): string {
  if (action.type === "create_meeting") {
    return "event";
  }
  if (action.type === "create_contact") {
    return "contact";
  }
  if (action.type === "update_meeting") {
    return "event-update";
  }
  return "contact-update";
}

export class DemoActionExecutor implements ActionExecutor {
  private readonly createId: () => string;
  private readonly now: () => string;
  private readonly store: KeyValueStore;

  constructor(options: Options = {}) {
    this.createId = options.createId ?? createUuid;
    this.now = options.now ?? (() => new Date().toISOString());
    this.store = options.store ?? getDeviceKeyValueStore();
  }

  async execute(sourceRunId: string, action: ActionCard, context?: ActionExecutionContext): Promise<ToolResult> {
    const idempotencyKey = `${sourceRunId}:${action.id}`;
    const records = this.readRecords();
    const existing = records.find((record) => record.idempotencyKey === idempotencyKey);
    if (existing) {
      return existing.result;
    }

    let externalId = context?.targetExternalId;
    if (!externalId && action.type === "update_contact") externalId = action.payload.contactId ?? undefined;
    if (!externalId && action.type === "update_meeting") externalId = action.payload.meetingId ?? undefined;
    externalId ??= `demo-${externalPrefix(action)}-${this.createId()}`;

    const result: ToolResult = {
      actionId: action.id,
      success: true,
      provider: "demo",
      externalId,
    };
    const record: ActionExecutionRecord = {
      idempotencyKey,
      sourceRunId,
      action,
      result,
      executedAt: this.now(),
    };
    this.store.setItem(STORAGE_KEY, JSON.stringify([...records, record]));
    return result;
  }

  listRecords(): ActionExecutionRecord[] {
    return this.readRecords();
  }

  private readRecords(): ActionExecutionRecord[] {
    const serialized = this.store.getItem(STORAGE_KEY);
    if (!serialized) {
      return [];
    }

    try {
      const parsed = StoredRecordsSchema.safeParse(JSON.parse(serialized));
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  }
}
