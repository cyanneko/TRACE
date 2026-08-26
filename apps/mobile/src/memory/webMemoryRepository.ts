import { MemoryEntrySchema, type MemoryEntry } from "@trace/contracts";

import { getDeviceKeyValueStore, type KeyValueStore } from "../storage/keyValueStore";
import { deleteMemoryEntry, mergeMemoryEntries, type MemoryMergeResult } from "./policy";
import type { MemoryRepository } from "./types";

const STORAGE_KEY = "trace.memories.v1";
const StoredMemoriesSchema = MemoryEntrySchema.array();

type Options = {
  now?: () => string;
  store?: KeyValueStore;
};

export class WebMemoryRepository implements MemoryRepository {
  private readonly now: () => string;
  private readonly store: KeyValueStore;

  constructor(options: Options = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.store = options.store ?? getDeviceKeyValueStore();
  }

  async listAll(): Promise<MemoryEntry[]> {
    return this.read();
  }

  async listActive(): Promise<MemoryEntry[]> {
    return this.read().filter((memory) => memory.status === "active");
  }

  async apply(candidates: MemoryEntry[]): Promise<MemoryMergeResult> {
    const merged = mergeMemoryEntries(this.read(), candidates);
    this.write(merged.entries);
    return merged;
  }

  async delete(memoryId: string): Promise<void> {
    this.write(deleteMemoryEntry(this.read(), memoryId, this.now()));
  }

  private read(): MemoryEntry[] {
    const serialized = this.store.getItem(STORAGE_KEY);
    if (!serialized) {
      return [];
    }

    try {
      const parsed = StoredMemoriesSchema.safeParse(JSON.parse(serialized));
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  }

  private write(entries: MemoryEntry[]) {
    this.store.setItem(STORAGE_KEY, JSON.stringify(entries));
  }
}
