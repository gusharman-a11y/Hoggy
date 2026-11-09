import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { databasePath, isDemoMode } from "@/lib/runtime";
import { migrate } from "./migrate";
import { seed } from "./seed";

/** Opens a database (file path or ':memory:'), turns on foreign keys and runs migrations. */
export function openDb(file: string): DatabaseSync {
  if (file !== ":memory:") fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON");
  // Wait (rather than fail with "database is locked") when the dev server and a seed/e2e run write at once.
  db.exec("PRAGMA busy_timeout = 5000");
  if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  migrate(db);
  return db;
}

// Cached on globalThis so Next dev hot reloads reuse one connection.
const g = globalThis as unknown as { __studyleaveDb?: { file: string; db: DatabaseSync } };

/**
 * Shared connection. Uses `file`, else DATABASE_PATH, else data/app.db
 * (/tmp/hoggy/app.db in demo mode). Migrations run automatically the first
 * time a database is opened; in demo mode an empty default database is also
 * seeded (demo hospital, logins, SAMPLE conferences) so a fresh serverless
 * instance is usable straight away.
 */
export function getDb(file?: string): DatabaseSync {
  const target = file ?? databasePath();
  if (g.__studyleaveDb && g.__studyleaveDb.file === target) return g.__studyleaveDb.db;
  if (g.__studyleaveDb) g.__studyleaveDb.db.close();
  const db = openDb(target);
  if (file === undefined && isDemoMode()) seedIfEmpty(db);
  g.__studyleaveDb = { file: target, db };
  return db;
}

/** Runs the idempotent demo seed when the database has no organisations yet. Returns whether it seeded. */
export function seedIfEmpty(db: DatabaseSync): boolean {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM orgs").get() as { n: number };
  if (n > 0) return false;
  seed(db);
  return true;
}

/** Closes the shared connection (tests). */
export function closeDb(): void {
  g.__studyleaveDb?.db.close();
  g.__studyleaveDb = undefined;
}
