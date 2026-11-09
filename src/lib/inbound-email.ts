/**
 * Receipts forwarded by email. The mail provider POSTs each message to
 * /api/inbound as JSON with the shared secret in `x-inbound-secret`. Two kinds of address:
 * - trip-<inbound_code>@in.studyleave.app: attachments become receipts on that trip
 *   (source 'email', amount 0, description = subject), only from the trip's owner.
 * - inbox-<users.inbox_code>@in.studyleave.app (the doctor's personal Hoggy inbox): each
 *   attachment (or, with none, the body rendered to a one-page PDF) is read by the
 *   ReceiptReader and matched to one of the doctor's trips (receipt-matching.ts) as a
 *   needs_review receipt; no clear match -> the doctor's private Unfiled receipts.
 *   Only accepted from the account's own email address.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/db";
import { EMPTY_READING, getReceiptReader, pdfToText, type ReceiptReader, type ReceiptReading } from "@/providers/receipt-reader";
import { buildEmailReceiptPdf } from "./email-receipt-pdf";
import { matchTrip } from "./receipt-matching";
import { purgeUnfiled } from "./receipt-review";
import { receiptKindFromReading } from "./receipt-snap";
import { SNAP_KIND_LABELS } from "./receipt-upload-kinds";
import {
  receiptDetailColumns,
  ReceiptDetailsError,
  resolveUploadPath,
  setReceiptDetails,
  uploadsDir,
  type Receipt,
  type ReceiptDetailsInput,
} from "./receipts";
import { detectFileType, MAX_UPLOAD_BYTES, RECEIPT_LOCKED_STATUSES } from "./receipt-uploads";
import type { TripStatus } from "./trips";
import type { UnfiledReason } from "./unfiled-receipts";
import { findUserByInboxCode } from "./users";

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

const domainRe = INBOUND_DOMAIN.replace(/\./g, "\\.");
const CODE_RE = new RegExp(`^trip-([a-z0-9]{4,32})@${domainRe}$`);
const INBOX_RE = new RegExp(`^inbox-([a-z0-9]{4,32})@${domainRe}$`);

function codesFrom(to: string, re: RegExp): string[] {
  const codes: string[] = [];
  for (const part of to.split(/[,;]/)) {
    const addr = parseEmailAddress(part);
    const m = addr?.match(re);
    if (m && !codes.includes(m[1])) codes.push(m[1]);
  }
  return codes;
}

/** Trip codes addressed in a To header (may list several recipients). */
export function inboundCodesFrom(to: string): string[] {
  return codesFrom(to, CODE_RE);
}

/** Personal inbox codes addressed in a To header. */
export function inboxCodesFrom(to: string): string[] {
  return codesFrom(to, INBOX_RE);
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
  /** Plain-text body (optional). Read for details; rendered to a PDF when there are no attachments. */
  text?: string;
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
  const text = b.text === undefined || b.text === null ? undefined : b.text;
  if (text !== undefined && !isStr(text)) return undefined;
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
  return { to: b.to, from: b.from, subject, ...(text !== undefined ? { text } : {}), attachments };
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

interface InboundFile {
  name: string;
  bytes: Buffer;
  mime: string;
  ext: string;
}

/** Decodes and checks attachments (PDF/JPG/PNG by magic bytes, 10 MB each, at most 10). */
function collectAttachments(attachments: InboundAttachment[]): { files: InboundFile[]; skipped: string[] } {
  const skipped: string[] = [];
  const files: InboundFile[] = [];
  for (const a of attachments.slice(0, MAX_INBOUND_ATTACHMENTS)) {
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
  for (const a of attachments.slice(MAX_INBOUND_ATTACHMENTS)) skipped.push(`${cleanName(a.filename)}: too many attachments`);
  return { files, skipped };
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

  const { files, skipped } = collectAttachments(email.attachments);
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

export interface InboxOptions extends InboundOptions {
  reader?: ReceiptReader;
}

export interface InboxFiled {
  tripId: number;
  receipt: Receipt;
}

export interface InboxUnfiled {
  id: number;
  description: string;
  reason: UnfiledReason;
}

export type InboxOutcome =
  | { ok: true; userId: number; filed: InboxFiled[]; unfiled: InboxUnfiled[]; skipped: string[] }
  | { ok: false; status: 404 | 422; error: string };

/** Details to store from a reading; drops anything the receipt columns would reject. */
function detailsFromReading(reading: ReceiptReading): ReceiptDetailsInput {
  const input: ReceiptDetailsInput = {
    supplierName: reading.supplierName,
    supplierAbn: reading.supplierAbn,
    gstCents: reading.gstCents,
    receiptDate: reading.date,
    isTaxInvoice: reading.isTaxInvoice,
    extraction: reading,
  };
  for (const k of ["supplierAbn", "gstCents", "receiptDate"] as const) {
    try {
      receiptDetailColumns({ [k]: input[k] });
    } catch (e) {
      if (!(e instanceof ReceiptDetailsError)) throw e;
      input[k] = null;
    }
  }
  return input;
}

/**
 * Mail to a doctor's personal inbox. Reads every attachment (or the body, when there are
 * none), matches each to one of the doctor's trips and saves it as a needs_review receipt
 * there, or as an unfiled receipt only that doctor can see.
 */
export async function receiveInboxEmail(email: InboundEmail, opts: InboxOptions = {}): Promise<InboxOutcome> {
  const db = opts.db ?? getDb();
  const sender = parseEmailAddress(email.from);
  let user: { id: number; org_id: number | null } | undefined;
  for (const code of inboxCodesFrom(email.to)) {
    const u = findUserByInboxCode(db, code);
    // Same answer for "no such inbox" and "not your inbox" so addresses can't be probed.
    if (u && sender && u.email.toLowerCase() === sender) {
      user = u;
      break;
    }
  }
  if (!user) return { ok: false, status: 404, error: "No inbox for this sender at that address" };

  const body = (email.text ?? "").slice(0, 100_000);
  let files: InboundFile[];
  let skipped: string[];
  if (email.attachments.length > 0) {
    ({ files, skipped } = collectAttachments(email.attachments));
    if (files.length === 0) return { ok: false, status: 422, error: "No PDF, JPG or PNG attachments" };
  } else {
    if (!body.trim()) return { ok: false, status: 422, error: "Nothing to read: no attachment and an empty email" };
    const pdf = await buildEmailReceiptPdf({ from: email.from, subject: email.subject, text: body });
    files = [{ name: "email.pdf", bytes: Buffer.from(pdf), mime: "application/pdf", ext: "pdf" }];
    skipped = [];
  }

  // Read everything first (async), then write in one transaction with no awaits inside.
  const reader = opts.reader ?? getReceiptReader();
  const emailText = `Subject: ${email.subject}\n\n${body}`.trim();
  const subject = describe(email.subject);
  const plans: { file: InboundFile; reading: ReceiptReading; match: ReturnType<typeof matchTrip> }[] = [];
  for (const file of files) {
    let reading: ReceiptReading;
    try {
      reading = await reader.read({ bytes: file.bytes, mimeType: file.mime, emailText });
    } catch (err) {
      // A failed read must not lose the receipt; the doctor fills it in on review.
      console.error("Receipt reader failed:", err instanceof Error ? err.message : err);
      reading = { ...EMPTY_READING };
    }
    const fileText = file.mime === "application/pdf" ? await pdfToText(file.bytes) : "";
    const match = matchTrip(user, {
      date: reading.date,
      kind: reading.kind,
      supplierName: reading.supplierName,
      text: `${email.subject}\n${body}\n${fileText}\n${file.name}`,
    }, db);
    plans.push({ file, reading, match });
  }

  const dir = opts.dir ?? uploadsDir();
  const written: string[] = [];
  const filed: InboxFiled[] = [];
  const unfiled: InboxUnfiled[] = [];
  const store = (folder: string, prefix: string, f: InboundFile) => {
    const rel = path.posix.join(folder, `${prefix}-${crypto.randomBytes(8).toString("hex")}.${f.ext}`);
    const full = resolveUploadPath(rel, dir);
    fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(full), { recursive: true });
    fs.writeFileSync(/*turbopackIgnore: true*/ full, f.bytes);
    written.push(full);
    return rel;
  };
  db.exec("BEGIN");
  try {
    for (const { file, reading, match } of plans) {
      const kind = receiptKindFromReading(reading.kind);
      const description = reading.supplierName ?? (subject !== "Emailed receipt" ? subject : SNAP_KIND_LABELS[kind]);
      const details = detailsFromReading(reading);
      if (match.kind === "matched") {
        const trip = db.prepare("SELECT id, currency FROM trips WHERE id = ?").get(match.tripId) as { id: number; currency: string };
        const rel = store(String(trip.id), "email", file);
        const row = db
          .prepare(
            `INSERT INTO receipts (trip_id, kind, description, amount_cents, currency, file_path, mime_type, source, uploaded_by, original_name, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'email', ?, ?, 'needs_review') RETURNING id`,
          )
          .get(trip.id, kind, description, reading.totalCents ?? 0, trip.currency, rel, file.mime, user.id, file.name) as { id: number };
        const receipt = setReceiptDetails(row.id, { ...details, status: "needs_review" }, db) as Receipt;
        filed.push({ tripId: trip.id, receipt });
      } else {
        const rel = store(path.posix.join("unfiled", String(user.id)), "inbox", file);
        const cols = receiptDetailColumns(details);
        const keys = Object.keys(cols);
        const reason: UnfiledReason = match.kind === "ambiguous" ? "ambiguous" : "no_match";
        const row = db
          .prepare(
            `INSERT INTO unfiled_receipts (user_id, kind, description, amount_cents, file_path, mime_type, original_name, email_subject, reason${keys.map((k) => `, ${k}`).join("")})
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?${keys.map(() => ", ?").join("")}) RETURNING id`,
          )
          .get(user.id, kind, description, reading.totalCents ?? 0, rel, file.mime, file.name, email.subject.slice(0, 300), reason, ...keys.map((k) => cols[k])) as {
          id: number;
        };
        unfiled.push({ id: row.id, description, reason });
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    if (db.isTransaction) db.exec("ROLLBACK");
    for (const full of written) fs.rmSync(/*turbopackIgnore: true*/ full, { force: true });
    throw e;
  }
  return { ok: true, userId: user.id, filed, unfiled, skipped };
}

export interface InboundHandlerOptions extends InboxOptions {
  /** The configured INBOUND_SECRET. Unset rejects every request. */
  secret: string | undefined;
  /** Clock for the unfiled purge (tests). */
  now?: Date;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** The whole POST /api/inbound handler, with its dependencies passed in (unit-testable). */
export async function handleInboundRequest(req: Request, opts: InboundHandlerOptions): Promise<Response> {
  // Secret first: nothing about the payload is looked at until the caller is trusted.
  if (!inboundSecretMatches(req.headers.get(INBOUND_SECRET_HEADER), opts.secret)) {
    return json(401, { error: "Bad or missing inbound secret" });
  }
  // Unfiled receipts are kept 7 days; every trusted inbound POST clears the expired ones.
  try {
    purgeUnfiled({ db: opts.db, dir: opts.dir, now: opts.now });
  } catch (err) {
    console.error("purgeUnfiled failed:", err instanceof Error ? err.message : err);
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

  // trip-<code> addresses first (they name the trip), then the personal inbox-<code>.
  const hasTrip = inboundCodesFrom(email.to).length > 0;
  const hasInbox = inboxCodesFrom(email.to).length > 0;
  if (!hasTrip && !hasInbox) return json(404, { error: "No StudyLeave address in 'to'" });
  if (hasTrip) {
    const result = receiveInboundEmail(email, opts);
    if (result.ok) {
      return json(201, {
        tripId: result.tripId,
        receipts: result.receipts.map((r) => ({ id: r.id, description: r.description, filename: r.original_name })),
        skipped: result.skipped,
      });
    }
    if (!hasInbox || result.status !== 404) return json(result.status, { error: result.error });
  }
  const inbox = await receiveInboxEmail(email, opts);
  if (!inbox.ok) return json(inbox.status, { error: inbox.error });
  return json(201, {
    filed: inbox.filed.map((f) => ({ tripId: f.tripId, receiptId: f.receipt.id, description: f.receipt.description })),
    unfiled: inbox.unfiled,
    skipped: inbox.skipped,
  });
}
