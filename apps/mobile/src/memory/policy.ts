import type { ActionCard, MemoryEntry, ToolResult } from "@trace/contracts";

import { createUuid } from "../lib/uuid";

type DeriveInput = {
  sourceRunId: string;
  actions: ActionCard[];
  results: ToolResult[];
  now: string;
  createId?: () => string;
};

export type MemoryMergeResult = {
  entries: MemoryEntry[];
  writtenMemoryIds: string[];
  supersededMemoryIds: string[];
};

function baseMemory(
  input: DeriveInput,
  action: ActionCard,
  overrides: Pick<MemoryEntry, "contactId" | "key" | "type" | "value">,
): MemoryEntry {
  return {
    id: (input.createId ?? createUuid)(),
    contactId: overrides.contactId,
    type: overrides.type,
    key: overrides.key,
    value: overrides.value,
    status: "active",
    sourceRunId: input.sourceRunId,
    sourceActionId: action.id,
    sourceEvidenceRefs: action.evidenceRefs,
    confidence: action.confidence,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function deriveMemoryCandidates(input: DeriveInput): MemoryEntry[] {
  const successfulResults = new Map(
    input.results.filter((result) => result.success).map((result) => [result.actionId, result]),
  );

  return input.actions.flatMap((action) => {
    const result = successfulResults.get(action.id);
    if (!result) {
      return [];
    }

    if (action.type === "create_meeting") {
      return [
        baseMemory(input, action, {
          contactId: action.payload.participantContactIds[0],
          type: "open_loop",
          key: `meeting:${action.payload.startAt ?? "time-unresolved"}:${action.payload.title}`,
          value: {
            kind: "scheduled_meeting",
            externalId: result.externalId,
            title: action.payload.title,
            startAt: action.payload.startAt,
            endAt: action.payload.endAt,
            timezone: action.payload.timezone,
            participantNames: action.payload.participantNames,
            notes: action.payload.notes,
          },
        }),
      ];
    }

    if (action.type === "create_contact") {
      return [
        baseMemory(input, action, {
          contactId: result.externalId,
          type: "relationship_fact",
          key: "contact:introduction",
          value: {
            kind: "contact_created",
            displayName: action.payload.displayName,
            company: action.payload.company,
            jobTitle: action.payload.jobTitle,
            phones: action.payload.phones,
            emails: action.payload.emails,
            notes: action.payload.notes,
          },
        }),
      ];
    }

    return action.payload.changes.map((change) =>
      baseMemory(input, action, {
        contactId: action.payload.contactId ?? result.externalId,
        type: "contact_fact",
        key: `contact:${change.field}`,
        value: {
          kind: "contact_change",
          field: change.field,
          previousValue: change.previousValue,
          value: change.nextValue,
        },
      }),
    );
  });
}

function sameIdentity(left: MemoryEntry, right: MemoryEntry): boolean {
  return left.contactId === right.contactId && left.type === right.type && left.key === right.key;
}

function sameValue(left: MemoryEntry, right: MemoryEntry): boolean {
  return JSON.stringify(left.value) === JSON.stringify(right.value);
}

export function mergeMemoryEntries(existing: MemoryEntry[], candidates: MemoryEntry[]): MemoryMergeResult {
  const entries = existing.map((memory) => ({ ...memory }));
  const writtenMemoryIds: string[] = [];
  const supersededMemoryIds: string[] = [];

  for (const candidate of candidates) {
    const sourceDuplicate = entries.some(
      (memory) =>
        memory.sourceRunId === candidate.sourceRunId &&
        memory.sourceActionId === candidate.sourceActionId &&
        memory.key === candidate.key,
    );
    const semanticDuplicate = entries.some(
      (memory) => memory.status === "active" && sameIdentity(memory, candidate) && sameValue(memory, candidate),
    );
    if (sourceDuplicate || semanticDuplicate) {
      continue;
    }

    for (const memory of entries) {
      if (memory.status === "active" && sameIdentity(memory, candidate)) {
        memory.status = "superseded";
        memory.updatedAt = candidate.updatedAt;
        supersededMemoryIds.push(memory.id);
      }
    }

    entries.push(candidate);
    writtenMemoryIds.push(candidate.id);
  }

  return { entries, writtenMemoryIds, supersededMemoryIds };
}

export function deleteMemoryEntry(entries: MemoryEntry[], memoryId: string, now: string): MemoryEntry[] {
  return entries.map((memory) =>
    memory.id === memoryId ? { ...memory, status: "deleted" as const, updatedAt: now } : memory,
  );
}
