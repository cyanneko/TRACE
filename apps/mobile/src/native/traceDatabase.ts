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

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY NOT NULL,
      external_contact_id TEXT,
      sort_name TEXT NOT NULL,
      status TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS contacts_external_id_idx
      ON contacts(external_contact_id)
      WHERE external_contact_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS contacts_sort_idx
      ON contacts(sort_name, id);

    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY NOT NULL,
      external_event_id TEXT,
      start_at TEXT,
      end_at TEXT,
      status TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS meetings_external_id_idx
      ON meetings(external_event_id)
      WHERE external_event_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS meetings_time_idx
      ON meetings(start_at, end_at, id);

    CREATE TABLE IF NOT EXISTS entity_memories (
      id TEXT PRIMARY KEY NOT NULL,
      owner_type TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      status TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS entity_memories_owner_idx
      ON entity_memories(owner_type, owner_id, status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entity_action_commits (
      idempotency_key TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      committed_at TEXT NOT NULL
    );
  `);
  return database;
}

export function getTraceDatabase(): Promise<SQLiteDatabase> {
  databasePromise ??= openTraceDatabase();
  return databasePromise;
}
