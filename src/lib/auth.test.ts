import { afterEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db";
import { DEMO_ORG, DEMO_PASSWORD, seed } from "@/db/seed";
import { hashPassword, verifyPassword } from "./password";
import {
  checkCredentials,
  createOrg,
  createSession,
  createUser,
  deleteSession,
  findOrgByCode,
  generateJoinCode,
  getSessionUser,
  safeNext,
  SESSION_DAYS,
} from "./users";

afterEach(() => closeDb());

describe("password hashing", () => {
  it("uses scrypt with a random salt and verifies the right password only", () => {
    const a = hashPassword("password123");
    const b = hashPassword("password123");
    expect(a).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(a).not.toBe(b);
    expect(verifyPassword("password123", a)).toBe(true);
    expect(verifyPassword("password124", a)).toBe(false);
    expect(verifyPassword("password123", "garbage")).toBe(false);
  });
});

describe("users and sessions", () => {
  function setup() {
    const db = getDb(":memory:");
    const org = createOrg(db, { name: "Test Hospital", financeEmail: "Fin@Test.test" });
    const user = createUser(db, { orgId: org.id, email: " Doc@Test.test ", name: "Dr Doc", password: "secret123", role: "doctor" });
    return { db, org, user };
  }

  it("stores a hash, not the password, and normalises email", () => {
    const { db, user } = setup();
    expect(user.email).toBe("doc@test.test");
    const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as { password_hash: string };
    expect(row.password_hash).not.toContain("secret123");
    expect(checkCredentials(db, "DOC@test.test", "secret123")?.id).toBe(user.id);
    expect(checkCredentials(db, "doc@test.test", "wrong")).toBeUndefined();
    expect(checkCredentials(db, "nobody@test.test", "secret123")).toBeUndefined();
  });

  it("finds the user for a live session and nothing for expired or deleted ones", () => {
    const { db, user } = setup();
    const now = new Date("2026-11-09T00:00:00Z");
    const id = createSession(db, user.id, now);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(getSessionUser(db, id, now)).toMatchObject({ id: user.id, role: "doctor", name: "Dr Doc" });
    expect(getSessionUser(db, "not-a-session", now)).toBeUndefined();
    expect(getSessionUser(db, undefined, now)).toBeUndefined();
    const later = new Date(now.getTime() + (SESSION_DAYS + 1) * 86_400_000);
    expect(getSessionUser(db, id, later)).toBeUndefined();
    deleteSession(db, id);
    expect(getSessionUser(db, id, now)).toBeUndefined();
  });

  it("generates readable unique join codes and looks them up case-insensitively", () => {
    const { db, org } = setup();
    expect(org.join_code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(generateJoinCode()).not.toBe(generateJoinCode());
    expect(findOrgByCode(db, org.join_code.toLowerCase())?.id).toBe(org.id);
    expect(findOrgByCode(db, "NOPE")).toBeUndefined();
    expect(org.finance_email).toBe("fin@test.test");
  });

  it("only allows relative post-login redirects", () => {
    expect(safeNext("/conferences/x")).toBe("/conferences/x");
    expect(safeNext("https://evil.test")).toBe("/account");
    expect(safeNext("//evil.test")).toBe("/account");
    expect(safeNext(null)).toBe("/account");
  });
});

describe("seed", () => {
  it("creates the demo hospital and manager login, idempotently", () => {
    const db = getDb(":memory:");
    seed(db);
    seed(db);
    const org = findOrgByCode(db, DEMO_ORG.joinCode);
    expect(org).toMatchObject({ name: "Demo Hospital", finance_email: "finance@demo.test" });
    const manager = checkCredentials(db, "manager@demo.test", DEMO_PASSWORD);
    expect(manager).toMatchObject({ role: "manager", org_id: org!.id });
    expect(checkCredentials(db, "finance@demo.test", DEMO_PASSWORD)?.role).toBe("finance");
    expect((db.prepare("SELECT COUNT(*) AS n FROM orgs").get() as { n: number }).n).toBe(1);
  });
});
