import { MemoryEntrySchema, type MemoryEntry } from "@trace/contracts";

import { getTraceDatabase } from "../native/traceDatabase";
import { deleteMemoryEntry, mergeMemoryEntries, type MemoryMergeResult } from "./policy";
import type { MemoryRepository } from "./types";

type MemoryRow = {
  payload: string;
};

export class SqliteMemoryRepository implements MemoryRepository {
  async listAll(): Promise<MemoryEntry[]> {
    const database = await getTraceDatabase();
    const rows = await database.getAllAsync<MemoryRow>("SELECT payload FROM memory_entries ORDER BY updated_at ASC");
    return rows.flatMap((row) => {
      try {
        const parsed = MemoryEntrySchema.safeParse(JSON.parse(row.payload));
        return parsed.success ? [parsed.data] : [];
      } catch {
        return [];
      }
    });
  }

  async listActive(): Promise<MemoryEntry[]> {
    return (await this.listAll()).filter((memory) => memory.status === "active");
  }

  async apply(candidates: MemoryEntry[]): Promise<MemoryMergeResult> {
    const merged = mergeMemoryEntries(await this.listAll(), candidates);
    await this.write(merged.entries);
    return merged;
  }

  async delete(memoryId: string): Promise<void> {
    const entries = deleteMemoryEntry(await this.listAll(), memoryId, new Date().toISOString());
    await this.write(entries.filter((entry) => entry.id === memoryId));
  }

  private async write(entries: MemoryEntry[]): Promise<void> {
    const database = await getTraceDatabase();
    await database.withExclusiveTransactionAsync(async (transaction) => {
      for (const entry of entries) {
        await transaction.runAsync(
          `INSERT INTO memory_entries (id, payload, status, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             payload = excluded.payload,
             status = excluded.status,
             updated_at = excluded.updated_at`,
          entry.id,
          JSON.stringify(entry),
          entry.status,
          entry.updatedAt,
        );
      }
    });
  }
}
