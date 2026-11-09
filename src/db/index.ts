import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrate } from "./migrate";

export const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "app.db");

/** Opens a database (file path or ':memory:'), turns on foreign keys and runs migrations. */
export function openDb(file: string): DatabaseSync {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON");
  if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  migrate(db);
  return db;
}

// Cached on globalThis so Next dev hot reloads reuse one connection.
const g = globalThis as unknown as { __studyleaveDb?: { file: string; db: DatabaseSync } };

/**
 * Shared connection. Uses `file`, else DATABASE_PATH, else data/app.db.
 * Migrations run automatically the first time a database is opened.
 */
export function getDb(file?: string): DatabaseSync {
  const target = file ?? process.env.DATABASE_PATH ?? DEFAULT_DB_PATH;
  if (g.__studyleaveDb && g.__studyleaveDb.file === target) return g.__studyleaveDb.db;
  if (g.__studyleaveDb) g.__studyleaveDb.db.close();
  const db = openDb(target);
  g.__studyleaveDb = { file: target, db };
  return db;
}

/** Closes the shared connection (tests). */
export function closeDb(): void {
  g.__studyleaveDb?.db.close();
  g.__studyleaveDb = undefined;
}
