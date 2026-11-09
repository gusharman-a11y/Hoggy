import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "./index";
import { listMigrations, migrate } from "./migrate";

function tables(db: DatabaseSync): string[] {
  return (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as {
      name: string;
    }[]
  ).map((r) => r.name);
}

afterEach(() => closeDb());

describe("migrations", () => {
  it("lists numbered files in order, starting with 001_core.sql", () => {
    const files = listMigrations();
    expect(files[0]).toBe("001_core.sql");
    expect([...files].sort()).toEqual(files);
  });

  it("runs twice without error and records each migration once", () => {
    const db = new DatabaseSync(":memory:");
    const first = migrate(db);
    expect(first).toContain("001_core.sql");
    expect(migrate(db)).toEqual([]);
    const rows = db.prepare("SELECT name FROM _migrations").all() as { name: string }[];
    expect(rows.map((r) => r.name)).toEqual(listMigrations());
    expect(tables(db)).toEqual(expect.arrayContaining(["_migrations", "orgs", "users", "sessions"]));
    db.close();
  });

  it("getDb(':memory:') migrates automatically and the core columns exist", () => {
    const db = getDb(":memory:");
    const cols = (t: string) =>
      (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
    expect(cols("orgs")).toEqual(["id", "name", "join_code", "finance_email", "created_at"]);
    expect(cols("users")).toEqual(["id", "org_id", "email", "name", "password_hash", "role", "created_at"]);
    expect(cols("sessions")).toEqual(["id", "user_id", "expires_at"]);

    db.prepare("INSERT INTO orgs (name, join_code) VALUES (?, ?)").run("Test Hospital", "ABC123");
    expect(() =>
      db.prepare("INSERT INTO orgs (name, join_code) VALUES (?, ?)").run("Other", "ABC123"),
    ).toThrow(/UNIQUE/);
  });

  it("reopening a file database is idempotent", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studyleave-db-"));
    const file = path.join(dir, "nested", "app.db");
    getDb(file);
    closeDb();
    const db = getDb(file);
    expect(tables(db)).toEqual(expect.arrayContaining(["orgs", "users", "sessions"]));
    closeDb();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("uses DATABASE_PATH when no file is given", () => {
    const old = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = ":memory:";
    try {
      expect(tables(getDb())).toContain("users");
    } finally {
      if (old === undefined) delete process.env.DATABASE_PATH;
      else process.env.DATABASE_PATH = old;
    }
  });
});
