import type { DatabaseConnection } from "./client.js";

const INITIAL_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id),
    ai_autofill INTEGER NOT NULL,
    auto_continue INTEGER NOT NULL,
    auto_submit INTEGER NOT NULL,
    autopilot INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS installations (
    installation_id TEXT PRIMARY KEY NOT NULL,
    pairing_secret_hash TEXT NOT NULL,
    token_hash TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    data_json TEXT NOT NULL,
    captured_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    job_id TEXT REFERENCES jobs(id),
    state TEXT NOT NULL,
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  PRAGMA user_version = 1;
`;

export function migrateDatabase(connection: DatabaseConnection): void {
  const row = connection.sqlite.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };
  if (row.user_version < 1) connection.sqlite.exec(INITIAL_SCHEMA);
}

