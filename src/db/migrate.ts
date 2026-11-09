import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

/** Folder holding NNN_name.sql files. Resolved from the project root so it works under Next and Vitest. */
export const MIGRATIONS_DIR = path.join(process.cwd(), "src", "db", "migrations");

const MIGRATION_FILE = /^(\d{3})_[\w-]+\.sql$/;

/** Lists migration file names in apply order (by their NNN prefix). */
export function listMigrations(dir: string = MIGRATIONS_DIR): string[] {
  return fs
    .readdirSync(/*turbopackIgnore: true*/ dir)
    .filter((f) => MIGRATION_FILE.test(f))
    .sort();
}

/**
 * Applies every migration not yet recorded in `_migrations`, in order, each in
 * its own transaction. Safe to call repeatedly. Returns the names it applied.
 */
export function migrate(db: DatabaseSync, dir: string = MIGRATIONS_DIR): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name       TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  const done = new Set(
    (db.prepare("SELECT name FROM _migrations").all() as { name: string }[]).map((r) => r.name),
  );
  const record = db.prepare("INSERT INTO _migrations (name) VALUES (?)");
  const applied: string[] = [];
  for (const name of listMigrations(dir)) {
    if (done.has(name)) continue;
    const sql = fs.readFileSync(path.join(/*turbopackIgnore: true*/ dir, name), "utf8");
    db.exec("BEGIN");
    try {
      db.exec(sql);
      record.run(name);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw new Error(`Migration ${name} failed: ${(err as Error).message}`);
    }
    applied.push(name);
  }
  return applied;
}
