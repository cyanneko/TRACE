import type { MemoryEntry } from "@trace/contracts";

import type { MemoryMergeResult } from "./policy";

export interface MemoryRepository {
  apply(candidates: MemoryEntry[]): Promise<MemoryMergeResult>;
  delete(memoryId: string): Promise<void>;
  listActive(): Promise<MemoryEntry[]>;
  listAll(): Promise<MemoryEntry[]>;
}
