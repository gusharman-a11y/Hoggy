import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/db";
import type { User } from "./users";

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  attachments?: MailAttachment[];
  /** Hospital the email belongs to (lets finance/admin see it in production). */
  orgId?: number | null;
}

export interface SentMail {
  id: number;
}

/** Anything that can send an email. Dev/test: OutboxMailer. Real SMTP comes later. */
export interface Mailer {
  send(message: MailMessage): Promise<SentMail>;
}

export interface OutboxAttachmentInfo {
  id: number;
  email_id: number;
  filename: string;
  content_type: string;
  size_bytes: number;
}

export interface OutboxEmail {
  id: number;
  org_id: number | null;
  to_addr: string;
  subject: string;
  body_text: string;
  created_at: string;
  attachments: OutboxAttachmentInfo[];
}

/** Stores every email (and its attachments) in the outbox table instead of sending it. */
export class OutboxMailer implements Mailer {
  constructor(private readonly db: DatabaseSync = getDb()) {}

  async send(message: MailMessage): Promise<SentMail> {
    const to = message.to.trim();
    if (!to) throw new Error("Email needs a recipient");
    const insertEmail = this.db.prepare(
      "INSERT INTO outbox (org_id, to_addr, subject, body_text) VALUES (?, ?, ?, ?)",
    );
    const insertAttachment = this.db.prepare(
      "INSERT INTO outbox_attachments (email_id, filename, content_type, size_bytes, content) VALUES (?, ?, ?, ?, ?)",
    );
    this.db.exec("BEGIN");
    try {
      const res = insertEmail.run(message.orgId ?? null, to, message.subject, message.text);
      const id = Number(res.lastInsertRowid);
      for (const a of message.attachments ?? []) {
        insertAttachment.run(id, a.filename, a.contentType, a.content.length, new Uint8Array(a.content));
      }
      this.db.exec("COMMIT");
      return { id };
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }
}

/** Placeholder for real delivery; chosen when SMTP_URL is set. */
export class SmtpMailer implements Mailer {
  constructor(readonly url: string) {}

  async send(): Promise<SentMail> {
    throw new Error("SMTP sending is not implemented yet: unset SMTP_URL to use the outbox");
  }
}

/** The app's mailer: the outbox unless SMTP_URL is set. */
export function getMailer(env: Record<string, string | undefined> = process.env, db?: DatabaseSync): Mailer {
  if (env.SMTP_URL) return new SmtpMailer(env.SMTP_URL);
  return new OutboxMailer(db ?? getDb());
}

/**
 * Who may open /outbox: admin/finance always (their hospital's emails only);
 * in dev/test (NODE_ENV != production) any logged-in user sees everything.
 * Returns the org filter to apply (null = all emails), or false when denied.
 */
export function outboxScope(
  user: Pick<User, "role" | "org_id">,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): { orgId: number | null } | false {
  if (nodeEnv !== "production") return { orgId: null };
  if (user.role === "admin" || user.role === "finance") return user.org_id == null ? false : { orgId: user.org_id };
  return false;
}

function attachmentsFor(db: DatabaseSync, emailIds: number[]): Map<number, OutboxAttachmentInfo[]> {
  const map = new Map<number, OutboxAttachmentInfo[]>();
  if (emailIds.length === 0) return map;
  const rows = db
    .prepare(
      `SELECT id, email_id, filename, content_type, size_bytes FROM outbox_attachments
       WHERE email_id IN (${emailIds.map(() => "?").join(",")}) ORDER BY id`,
    )
    .all(...emailIds) as unknown as OutboxAttachmentInfo[];
  for (const r of rows) {
    const list = map.get(r.email_id) ?? [];
    list.push({ ...r });
    map.set(r.email_id, list);
  }
  return map;
}

/** Newest first. orgId null/undefined = every email. */
export function listOutbox(
  opts: { orgId?: number | null; to?: string; limit?: number } = {},
  db: DatabaseSync = getDb(),
): OutboxEmail[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (opts.orgId != null) {
    where.push("org_id = ?");
    args.push(opts.orgId);
  }
  if (opts.to) {
    where.push("lower(to_addr) = lower(?)");
    args.push(opts.to.trim());
  }
  args.push(opts.limit ?? 100);
  const rows = db
    .prepare(
      `SELECT id, org_id, to_addr, subject, body_text, created_at FROM outbox
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC LIMIT ?`,
    )
    .all(...args) as unknown as Omit<OutboxEmail, "attachments">[];
  const atts = attachmentsFor(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({ ...r, attachments: atts.get(r.id) ?? [] }));
}

export interface OutboxAttachmentFile extends OutboxAttachmentInfo {
  org_id: number | null;
  content: Buffer;
}

/** One attachment with its bytes, or undefined. Pass orgId to enforce hospital scoping. */
export function getOutboxAttachment(
  id: number,
  opts: { orgId?: number | null } = {},
  db: DatabaseSync = getDb(),
): OutboxAttachmentFile | undefined {
  const row = db
    .prepare(
      `SELECT a.id, a.email_id, a.filename, a.content_type, a.size_bytes, a.content, o.org_id
       FROM outbox_attachments a JOIN outbox o ON o.id = a.email_id WHERE a.id = ?`,
    )
    .get(id) as (Omit<OutboxAttachmentFile, "content"> & { content: Uint8Array }) | undefined;
  if (!row) return undefined;
  if (opts.orgId != null && row.org_id !== opts.orgId) return undefined;
  return { ...row, content: Buffer.from(row.content) };
}
