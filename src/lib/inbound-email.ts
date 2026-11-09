/**
 * Receipts forwarded by email. Each trip has an address
 * trip-<inbound_code>@in.studyleave.app; the mail provider POSTs each message
 * to /api/inbound as JSON with the shared secret in `x-inbound-secret`.
 * Attachments become receipts (source 'email', amount 0, description = subject)
 * only when the sender is the trip's owner.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/db";
import { resolveUploadPath, uploadsDir, type Receipt } from "./receipts";
import { detectFileType, MAX_UPLOAD_BYTES, RECEIPT_LOCKED_STATUSES } from "./receipt-uploads";
import type { TripStatus } from "./trips";

export const INBOUND_DOMAIN = "in.studyleave.app";
export const INBOUND_SECRET_HEADER = "x-inbound-secret";
/** Whole request body limit (base64 inflates attachments by ~4/3). */
export const MAX_INBOUND_BODY_BYTES = 30 * 1024 * 1024;
export const MAX_INBOUND_ATTACHMENTS = 10;

/** The address a doctor forwards receipts to for one trip. */
export function inboundAddress(code: string): string {
  return `trip-${code}@${INBOUND_DOMAIN}`;
}

/** A doctor's personal Hoggy address (users.inbox_code): forward any receipt here. */
export function personalInboxAddress(code: string): string {
  return `inbox-${code}@${INBOUND_DOMAIN}`;
}

/** Bare lower-case email from "Name <a@b>" or "a@b"; undefined if it isn't one. */
export function parseEmailAddress(raw: string): string | undefined {
  const angle = raw.match(/<([^<>\s]+@[^<>\s]+)>/);
  const addr = (angle ? angle[1] : raw).trim().toLowerCase();
  return /^[^\s@<>,]+@[^\s@<>,]+$/.test(addr) ? addr : undefined;
}

const CODE_RE = new RegExp(`^trip-([a-z0-9]{4,32})@${INBOUND_DOMAIN.replace(/\./g, "\\.")}$`);

/** Trip codes addressed in a To header (may list several recipients). */
export function inboundCodesFrom(to: string): string[] {
  const codes: string[] = [];
  for (const part of to.split(/[,;]/)) {
    const addr = parseEmailAddress(part);
    const m = addr?.match(CODE_RE);
    if (m && !codes.includes(m[1])) codes.push(m[1]);
  }
  return codes;
}

/**
 * Constant-time secret check. Both sides are hashed first so the comparison
 * takes the same time whatever the lengths. No configured secret = reject all.
 */
export function inboundSecretMatches(provided: string | null | undefined, expected: string | undefined): boolean {
  if (!expected || typeof provided !== "string") return false;
  const a = crypto.createHash("sha256").update(provided, "utf8").digest();
  const b = crypto.createHash("sha256").update(expected, "utf8").digest();
  return crypto.timingSafeEqual(a, b);
}

export interface InboundAttachment {
  filename: string;
  contentType: string;
  base64: string;
}

export interface InboundEmail {
  to: string;
  from: string;
  subject: string;
  attachments: InboundAttachment[];
}

const isStr = (v: unknown): v is string => typeof v === "string";

/** Validates the JSON payload shape; undefined if it's wrong. */
export function parseInboundPayload(body: unknown): InboundEmail | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const b = body as Record<string, unknown>;
  if (!isStr(b.to) || !isStr(b.from)) return undefined;
  const subject = b.subject === undefined || b.subject === null ? "" : b.subject;
  if (!isStr(subject)) return undefined;
  const list = b.attachments ?? [];
  if (!Array.isArray(list)) return undefined;
  const attachments: InboundAttachment[] = [];
  for (const a of list) {
    if (typeof a !== "object" || a === null) return undefined;
    const { filename, contentType, base64 } = a as Record<string, unknown>;
    if (!isStr(base64)) return undefined;
    attachments.push({
      filename: isStr(filename) ? filename : "",
      contentType: isStr(contentType) ? contentType : "",
      base64,
    });
  }
  return { to: b.to, from: b.from, subject, attachments };
}

export type InboundOutcome =
  | { ok: true; tripId: number; receipts: Receipt[]; skipped: string[] }
  | { ok: false; status: 403 | 404 | 409 | 422; error: string };

export interface InboundOptions {
  db?: DatabaseSync;
  dir?: string;
}

function decodeBase64(s: string): Buffer | undefined {
  const clean = s.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) return undefined;
  return Buffer.from(clean, "base64");
}

function cleanName(name: string): string {
  const base = path.basename(name.replace(/\\/g, "/")).replace(/[\u0000-\u001f]/g, "").trim();
  return base.slice(0, 200) || "receipt";
}

function describe(subject: string): string {
  const s = subject
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/^\s*((fwd?|fw|re)\s*:\s*)+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return s.slice(0, 200) || "Emailed receipt";
}

/** Routes one inbound email to its trip and stores the attachments as receipts. */
export function receiveInboundEmail(email: InboundEmail, opts: InboundOptions = {}): InboundOutcome {
  const db = opts.db ?? getDb();
  const codes = inboundCodesFrom(email.to);
  if (codes.length === 0) return { ok: false, status: 404, error: "No trip address in 'to'" };

  const sender = parseEmailAddress(email.from);
  let trip: { id: number; status: TripStatus; currency: string; user_id: number } | undefined;
  for (const code of codes) {
    const row = db
      .prepare(
        `SELECT t.id, t.status, t.currency, t.user_id, lower(u.email) AS owner_email
         FROM trips t JOIN users u ON u.id = t.user_id WHERE t.inbound_code = ?`,
      )
      .get(code) as { id: number; status: TripStatus; currency: string; user_id: number; owner_email: string } | undefined;
    if (!row) continue;
    // Same answer for "no such trip" and "not your trip" so addresses can't be probed.
    if (sender && row.owner_email === sender) {
      trip = row;
      break;
    }
  }
  if (!trip) return { ok: false, status: 404, error: "No trip for this sender at that address" };
  if (RECEIPT_LOCKED_STATUSES.includes(trip.status)) {
    return { ok: false, status: 409, error: "This trip's claim has been sent; receipts are locked" };
  }

  const skipped: string[] = [];
  const files: { name: string; bytes: Buffer; mime: string; ext: string }[] = [];
  for (const a of email.attachments.slice(0, MAX_INBOUND_ATTACHMENTS)) {
    const name = cleanName(a.filename);
    const bytes = decodeBase64(a.base64);
    if (!bytes || bytes.length === 0) {
      skipped.push(`${name}: empty or not base64`);
      continue;
    }
    if (bytes.length > MAX_UPLOAD_BYTES) {
      skipped.push(`${name}: over 10 MB`);
      continue;
    }
    const type = detectFileType(bytes);
    if (!type) {
      skipped.push(`${name}: not a PDF, JPG or PNG`);
      continue;
    }
    files.push({ name, bytes, mime: type.mime, ext: type.ext });
  }
  for (const a of email.attachments.slice(MAX_INBOUND_ATTACHMENTS)) skipped.push(`${cleanName(a.filename)}: too many attachments`);
  if (files.length === 0) return { ok: false, status: 422, error: "No PDF, JPG or PNG attachments" };

  const dir = opts.dir ?? uploadsDir();
  const description = describe(email.subject);
  const written: string[] = [];
  const insert = db.prepare(
    `INSERT INTO receipts (trip_id, kind, description, amount_cents, currency, file_path, mime_type, source, uploaded_by, original_name)
     VALUES (?, 'other', ?, 0, ?, ?, ?, 'email', ?, ?) RETURNING *`,
  );
  const receipts: Receipt[] = [];
  db.exec("BEGIN");
  try {
    for (const f of files) {
      const rel = path.posix.join(String(trip.id), `email-${crypto.randomBytes(8).toString("hex")}.${f.ext}`);
      const full = resolveUploadPath(rel, dir);
      fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(full), { recursive: true });
      fs.writeFileSync(/*turbopackIgnore: true*/ full, f.bytes);
      written.push(full);
      receipts.push(insert.get(trip.id, description, trip.currency, rel, f.mime, trip.user_id, f.name) as unknown as Receipt);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    for (const full of written) fs.rmSync(/*turbopackIgnore: true*/ full, { force: true });
    throw e;
  }
  return { ok: true, tripId: trip.id, receipts, skipped };
}

export interface InboundHandlerOptions extends InboundOptions {
  /** The configured INBOUND_SECRET. Unset rejects every request. */
  secret: string | undefined;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** The whole POST /api/inbound handler, with its dependencies passed in (unit-testable). */
export async function handleInboundRequest(req: Request, opts: InboundHandlerOptions): Promise<Response> {
  // Secret first: nothing about the payload is looked at until the caller is trusted.
  if (!inboundSecretMatches(req.headers.get(INBOUND_SECRET_HEADER), opts.secret)) {
    return json(401, { error: "Bad or missing inbound secret" });
  }
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_INBOUND_BODY_BYTES) return json(413, { error: "Email too large" });
  let text: string;
  try {
    text = await req.text();
  } catch {
    return json(400, { error: "Could not read body" });
  }
  if (Buffer.byteLength(text) > MAX_INBOUND_BODY_BYTES) return json(413, { error: "Email too large" });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, { error: "Body must be JSON" });
  }
  const email = parseInboundPayload(body);
  if (!email) return json(400, { error: "Expected {to, from, subject, attachments:[{filename, contentType, base64}]}" });

  const result = receiveInboundEmail(email, opts);
  if (!result.ok) return json(result.status, { error: result.error });
  return json(201, {
    tripId: result.tripId,
    receipts: result.receipts.map((r) => ({ id: r.id, description: r.description, filename: r.original_name })),
    skipped: result.skipped,
  });
}
