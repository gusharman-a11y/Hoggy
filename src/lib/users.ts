import { randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { hashPassword, verifyPassword } from "./password";

export type Role = "doctor" | "manager" | "finance" | "admin";

export interface User {
  id: number;
  org_id: number | null;
  email: string;
  name: string;
  role: Role;
}

export interface Org {
  id: number;
  name: string;
  join_code: string;
  finance_email: string | null;
}

export const SESSION_DAYS = 30;
const USER_COLS = "u.id, u.org_id, u.email, u.name, u.role";

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

// No 0/O/1/I so codes are easy to read out loud.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateJoinCode(length = 8): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

export function findOrgByCode(db: DatabaseSync, code: string): Org | undefined {
  return db
    .prepare("SELECT id, name, join_code, finance_email FROM orgs WHERE join_code = ?")
    .get(code.trim().toUpperCase()) as Org | undefined;
}

export function getOrg(db: DatabaseSync, id: number): Org | undefined {
  return db.prepare("SELECT id, name, join_code, finance_email FROM orgs WHERE id = ?").get(id) as
    | Org
    | undefined;
}

export function createOrg(
  db: DatabaseSync,
  input: { name: string; financeEmail: string; joinCode?: string },
): Org {
  let code = input.joinCode ?? generateJoinCode();
  while (!input.joinCode && findOrgByCode(db, code)) code = generateJoinCode();
  const res = db
    .prepare("INSERT INTO orgs (name, join_code, finance_email) VALUES (?, ?, ?)")
    .run(input.name.trim(), code, normaliseEmail(input.financeEmail));
  return getOrg(db, Number(res.lastInsertRowid))!;
}

export function findUserByEmail(db: DatabaseSync, email: string): User | undefined {
  return db.prepare(`SELECT ${USER_COLS} FROM users u WHERE u.email = ?`).get(normaliseEmail(email)) as
    | User
    | undefined;
}

export function createUser(
  db: DatabaseSync,
  input: { orgId: number; email: string; name: string; password: string; role: Role },
): User {
  const res = db
    .prepare("INSERT INTO users (org_id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)")
    .run(input.orgId, normaliseEmail(input.email), input.name.trim(), hashPassword(input.password), input.role);
  return db.prepare(`SELECT ${USER_COLS} FROM users u WHERE u.id = ?`).get(Number(res.lastInsertRowid)) as unknown as User;
}

/** Returns the user when the email + password match, else undefined. */
export function checkCredentials(db: DatabaseSync, email: string, password: string): User | undefined {
  const row = db
    .prepare(`SELECT ${USER_COLS}, u.password_hash FROM users u WHERE u.email = ?`)
    .get(normaliseEmail(email)) as (User & { password_hash: string }) | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) return undefined;
  const { password_hash: _hash, ...user } = row;
  void _hash;
  return user;
}

/** Creates a login session and returns its random id (the cookie value). */
export function createSession(db: DatabaseSync, userId: number, now: Date = new Date()): string {
  const id = randomBytes(32).toString("hex");
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(id, userId, expires.toISOString());
  return id;
}

/** Looks up the user behind a session id; undefined if missing or expired. */
export function getSessionUser(
  db: DatabaseSync,
  sessionId: string | undefined,
  now: Date = new Date(),
): User | undefined {
  if (!sessionId) return undefined;
  return db
    .prepare(
      `SELECT ${USER_COLS} FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .get(sessionId, now.toISOString()) as User | undefined;
}

export function deleteSession(db: DatabaseSync, sessionId: string): void {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

/** Only allow same-site relative paths as a post-login destination. */
export function safeNext(next: unknown, fallback = "/account"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  return next;
}

const EMAIL_RE = /^[^\s@<>,]+@[^\s@<>,]+\.[^\s@<>,]+$/;

/** A plain single address like name@hospital.org (no display names). */
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** Sets the hospital's finance address (where claims are sent). Throws on a bad address. */
export function setFinanceEmail(db: DatabaseSync, orgId: number, email: string): Org {
  if (!isValidEmail(email)) throw new Error("Invalid email address");
  db.prepare("UPDATE orgs SET finance_email = ? WHERE id = ?").run(normaliseEmail(email), orgId);
  const org = getOrg(db, orgId);
  if (!org) throw new Error(`Org ${orgId} not found`);
  return org;
}
