import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

let databasePromise: Promise<SQLiteDatabase> | null = null;

async function openTraceDatabase(): Promise<SQLiteDatabase> {
  const database = await openDatabaseAsync("trace.db");
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS action_events (
      idempotency_key TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      executed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memory_entries (
      id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS memory_status_updated_idx
      ON memory_entries(status, updated_at DESC);
  `);
  return database;
}

export function getTraceDatabase(): Promise<SQLiteDatabase> {
  databasePromise ??= openTraceDatabase();
  return databasePromise;
}
