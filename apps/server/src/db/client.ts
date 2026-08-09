import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname } from "node:path";

import { drizzle, type NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";

export interface DatabaseConnection {
  db: NodeSQLiteDatabase;
  sqlite: DatabaseSync;
  close: () => void;
}

export function openDatabase(filename: string): DatabaseConnection {
  if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
  const sqlite = new DatabaseSync(filename, { timeout: 5_000 });
  sqlite.exec("PRAGMA foreign_keys = ON;");
  const db = drizzle({ client: sqlite });
  return { db, sqlite, close: () => sqlite.close() };
}

export type JobCopilotDatabase = DatabaseConnection["db"];
