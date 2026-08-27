import {
  EntityMemorySchema,
  type EntityMemory,
  type GlobalMemoryOperation,
} from "@trace/contracts";

import type { EntityFactoryOptions } from "./model";
import { GLOBAL_MEMORY_OWNER, type ApplyGlobalMemoryOperationsInput } from "./types";

export type GlobalMemoryEffects = {
  changedMemories: EntityMemory[];
  createdMemoryIds: string[];
  updatedMemoryIds: string[];
  deletedMemoryIds: string[];
  skippedOperations: number;
};

function normalizedContent(content: string): string {
  return content.trim().toLocaleLowerCase();
}

function operationMetadata(
  operation: GlobalMemoryOperation,
  input: ApplyGlobalMemoryOperationsInput,
  updatedAt: string,
) {
  return {
    source: "insight" as const,
    sourceRunId: input.sourceRunId,
    sourceActionId: undefined,
    sourceEvidenceRefs: operation.evidenceRefs,
    confidence: operation.confidence,
    updatedAt,
  };
}

export function deriveGlobalMemoryEffects(
  allMemories: EntityMemory[],
  input: ApplyGlobalMemoryOperationsInput,
  factory: EntityFactoryOptions,
): GlobalMemoryEffects {
  const memoriesById = new Map(allMemories.map((memory) => [memory.id, memory]));
  const changedById = new Map<string, EntityMemory>();
  const createdMemoryIds: string[] = [];
  const updatedMemoryIds: string[] = [];
  const deletedMemoryIds: string[] = [];
  let skippedOperations = 0;

  const duplicates = (content: string, excludedId?: string) =>
    [...memoriesById.values()].some(
      (memory) =>
        memory.id !== excludedId &&
        memory.status === "active" &&
        memory.ownerType === GLOBAL_MEMORY_OWNER.ownerType &&
        memory.ownerId === GLOBAL_MEMORY_OWNER.ownerId &&
        normalizedContent(memory.content) === normalizedContent(content),
    );

  for (const operation of input.operations) {
    const now = factory.now();
    if (operation.type === "create") {
      if (duplicates(operation.content)) {
        skippedOperations += 1;
        continue;
      }
      const memory = EntityMemorySchema.parse({
        id: factory.createId(),
        ...GLOBAL_MEMORY_OWNER,
        content: operation.content,
        status: "active",
        ...operationMetadata(operation, input, now),
        createdAt: now,
      });
      memoriesById.set(memory.id, memory);
      changedById.set(memory.id, memory);
      createdMemoryIds.push(memory.id);
      continue;
    }

    const existing = memoriesById.get(operation.memoryId);
    if (
      !existing ||
      existing.status !== "active" ||
      existing.ownerType !== GLOBAL_MEMORY_OWNER.ownerType ||
      existing.ownerId !== GLOBAL_MEMORY_OWNER.ownerId
    ) {
      skippedOperations += 1;
      continue;
    }

    if (operation.type === "update") {
      if (
        normalizedContent(existing.content) === normalizedContent(operation.content) ||
        duplicates(operation.content, existing.id)
      ) {
        skippedOperations += 1;
        continue;
      }
      const memory = EntityMemorySchema.parse({
        ...existing,
        content: operation.content,
        status: "active",
        ...operationMetadata(operation, input, now),
      });
      memoriesById.set(memory.id, memory);
      changedById.set(memory.id, memory);
      updatedMemoryIds.push(memory.id);
      continue;
    }

    const memory = EntityMemorySchema.parse({
      ...existing,
      status: "deleted",
      ...operationMetadata(operation, input, now),
    });
    memoriesById.set(memory.id, memory);
    changedById.set(memory.id, memory);
    deletedMemoryIds.push(memory.id);
  }

  return {
    changedMemories: [...changedById.values()],
    createdMemoryIds,
    updatedMemoryIds,
    deletedMemoryIds,
    skippedOperations,
  };
}
