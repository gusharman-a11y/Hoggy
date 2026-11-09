/**
 * Bookings and receipts. A booking is something bought through a provider
 * (flight, hotel); every booking gets a generated one-page PDF receipt.
 * Uploaded and emailed receipts (later stories) share the receipts table.
 *
 * Files live under the uploads folder (UPLOADS_DIR, default data/uploads),
 * in a sub-folder per trip; receipts.file_path is relative to that folder.
 */
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDb } from "@/db";
import { formatMoney } from "./format";

export const BOOKING_KINDS = ["flight", "hotel"] as const;
export type BookingKind = (typeof BOOKING_KINDS)[number];

export const RECEIPT_SOURCES = ["generated", "upload", "email"] as const;
export type ReceiptSource = (typeof RECEIPT_SOURCES)[number];

/** needs_review = read automatically, waiting for the doctor; confirmed = checked. */
export const RECEIPT_STATUSES = ["needs_review", "confirmed"] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];
export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  needs_review: "Needs review",
  confirmed: "Confirmed",
};

export interface Booking {
  id: number;
  trip_id: number;
  kind: BookingKind;
  provider: string;
  reference: string;
  details_json: string;
  total_cents: number;
  currency: string;
  created_at: string;
}

export interface Receipt {
  id: number;
  trip_id: number;
  kind: string;
  description: string;
  amount_cents: number;
  currency: string;
  /** Relative to the uploads folder, e.g. "12/booking-3.pdf". */
  file_path: string | null;
  mime_type: string | null;
  source: ReceiptSource;
  booking_id: number | null;
  /** Who uploaded it (source 'upload' only). */
  uploaded_by: number | null;
  /** The uploaded file's original name, for downloads. */
  original_name: string | null;
  created_at: string;
  /** What was read off the receipt (migration 013). All nullable = unknown. */
  supplier_name: string | null;
  /** 11 digits, no spaces. */
  supplier_abn: string | null;
  gst_cents: number | null;
  /** YYYY-MM-DD. */
  receipt_date: string | null;
  /** 1 yes, 0 no, null unknown. */
  is_tax_invoice: 0 | 1 | null;
  status: ReceiptStatus;
  /** Raw ReceiptReader output, JSON. */
  extraction_json: string | null;
}

export const DEFAULT_UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

/** Where receipt files live: UPLOADS_DIR, else data/uploads. */
export function uploadsDir(env: Record<string, string | undefined> = process.env): string {
  return env.UPLOADS_DIR || DEFAULT_UPLOADS_DIR;
}

/** Absolute path of a stored receipt file; refuses paths that escape the uploads folder. */
export function resolveUploadPath(relPath: string, dir: string = uploadsDir()): string {
  const root = path.resolve(/*turbopackIgnore: true*/ dir);
  const full = path.resolve(/*turbopackIgnore: true*/ root, relPath);
  if (full !== root && !full.startsWith(root + path.sep)) throw new Error("Bad receipt path");
  return full;
}

export interface NewBooking {
  tripId: number;
  kind: BookingKind;
  provider: string;
  reference: string;
  /** Provider details (offer, legs, hotel, guest...). Stored as JSON. */
  details?: unknown;
  totalCents: number;
  currency?: string;
}

export function createBooking(input: NewBooking, db: DatabaseSync = getDb()): Booking {
  if (!BOOKING_KINDS.includes(input.kind)) throw new Error(`Unknown booking kind: ${input.kind}`);
  if (!Number.isInteger(input.totalCents) || input.totalCents < 0) throw new Error("Booking total must be whole cents >= 0");
  const row = db
    .prepare(
      `INSERT INTO bookings (trip_id, kind, provider, reference, details_json, total_cents, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    )
    .get(
      input.tripId,
      input.kind,
      input.provider,
      input.reference,
      JSON.stringify(input.details ?? {}),
      input.totalCents,
      input.currency ?? "AUD",
    ) as unknown as Booking;
  return row;
}

export function getBooking(id: number, db: DatabaseSync = getDb()): Booking | undefined {
  return db.prepare("SELECT * FROM bookings WHERE id = ?").get(id) as unknown as Booking | undefined;
}

export function listBookings(tripId: number, db: DatabaseSync = getDb()): Booking[] {
  return db.prepare("SELECT * FROM bookings WHERE trip_id = ? ORDER BY id").all(tripId) as unknown as Booking[];
}

export function getReceipt(id: number, db: DatabaseSync = getDb()): Receipt | undefined {
  return db.prepare("SELECT * FROM receipts WHERE id = ?").get(id) as unknown as Receipt | undefined;
}

export function listReceipts(tripId: number, db: DatabaseSync = getDb()): Receipt[] {
  return db.prepare("SELECT * FROM receipts WHERE trip_id = ? ORDER BY id").all(tripId) as unknown as Receipt[];
}

// ---- Receipt details (what was read off the receipt) ----

/** Digits-only ABN if it has exactly 11 digits ("51 824 753 556" -> "51824753556"), else undefined. */
export function normaliseAbn(raw: string | null | undefined): string | undefined {
  if (raw == null) return undefined;
  const digits = String(raw).replace(/[\s-]/g, "");
  return /^\d{11}$/.test(digits) ? digits : undefined;
}

const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
/** ATO checksum: subtract 1 from the first digit, weighted sum must divide by 89. */
export function isValidAbn(raw: string | null | undefined): boolean {
  const abn = normaliseAbn(raw);
  if (!abn) return false;
  const digits = abn.split("").map(Number);
  digits[0] -= 1;
  return digits.reduce((sum, d, i) => sum + d * ABN_WEIGHTS[i], 0) % 89 === 0;
}

/** "51 824 753 556" for display. */
export function formatAbn(abn: string | null | undefined): string {
  const a = normaliseAbn(abn);
  return a ? `${a.slice(0, 2)} ${a.slice(2, 5)} ${a.slice(5, 8)} ${a.slice(8)}` : "";
}

/** Fields that can be set on a receipt. undefined = leave as is; null = clear. */
export interface ReceiptDetailsInput {
  supplierName?: string | null;
  supplierAbn?: string | null;
  gstCents?: number | null;
  receiptDate?: string | null;
  isTaxInvoice?: boolean | null;
  status?: ReceiptStatus;
  /** Raw reader output; stored as JSON. */
  extraction?: unknown;
}

export class ReceiptDetailsError extends Error {}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isRealDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Validates and converts details into column -> value pairs. Throws ReceiptDetailsError. */
export function receiptDetailColumns(input: ReceiptDetailsInput): Record<string, string | number | null> {
  const cols: Record<string, string | number | null> = {};
  if (input.supplierName !== undefined) {
    const name = input.supplierName?.trim().slice(0, 200);
    cols.supplier_name = name ? name : null;
  }
  if (input.supplierAbn !== undefined) {
    if (input.supplierAbn === null || input.supplierAbn.trim() === "") cols.supplier_abn = null;
    else {
      const abn = normaliseAbn(input.supplierAbn);
      if (!abn) throw new ReceiptDetailsError("An ABN has 11 digits.");
      cols.supplier_abn = abn;
    }
  }
  if (input.gstCents !== undefined) {
    if (input.gstCents !== null && (!Number.isInteger(input.gstCents) || input.gstCents < 0))
      throw new ReceiptDetailsError("GST must be zero or more.");
    cols.gst_cents = input.gstCents;
  }
  if (input.receiptDate !== undefined) {
    if (input.receiptDate === null || input.receiptDate === "") cols.receipt_date = null;
    else if (!isRealDate(input.receiptDate)) throw new ReceiptDetailsError("Receipt date must be a real date (YYYY-MM-DD).");
    else cols.receipt_date = input.receiptDate;
  }
  if (input.isTaxInvoice !== undefined) cols.is_tax_invoice = input.isTaxInvoice === null ? null : input.isTaxInvoice ? 1 : 0;
  if (input.status !== undefined) {
    if (!RECEIPT_STATUSES.includes(input.status)) throw new ReceiptDetailsError(`Unknown receipt status: ${input.status}`);
    cols.status = input.status;
  }
  if (input.extraction !== undefined) cols.extraction_json = input.extraction === null ? null : JSON.stringify(input.extraction);
  return cols;
}

/** Saves receipt details (only the fields given). Returns the updated row, or undefined if not found. */
export function setReceiptDetails(
  receiptId: number,
  input: ReceiptDetailsInput,
  db: DatabaseSync = getDb(),
): Receipt | undefined {
  const cols = receiptDetailColumns(input);
  const keys = Object.keys(cols);
  if (keys.length === 0) return getReceipt(receiptId, db);
  return db
    .prepare(`UPDATE receipts SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ? RETURNING *`)
    .get(...keys.map((k) => cols[k]), receiptId) as unknown as Receipt | undefined;
}

/** Marks a receipt as checked by the doctor. */
export function confirmReceipt(receiptId: number, db: DatabaseSync = getDb()): Receipt | undefined {
  return setReceiptDetails(receiptId, { status: "confirmed" }, db);
}

/** Receipts on a trip still waiting for the doctor to check them. */
export function listReceiptsNeedingReview(tripId: number, db: DatabaseSync = getDb()): Receipt[] {
  return db
    .prepare("SELECT * FROM receipts WHERE trip_id = ? AND status = 'needs_review' ORDER BY id")
    .all(tripId) as unknown as Receipt[];
}

/** The stored reader output, parsed; undefined when missing or not valid JSON. */
export function receiptExtraction(receipt: Pick<Receipt, "extraction_json">): unknown {
  if (!receipt.extraction_json) return undefined;
  try {
    return JSON.parse(receipt.extraction_json);
  } catch {
    return undefined;
  }
}

// ---- What a booking says, in plain lines (used on the PDF and on screen) ----

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");

function legLine(label: string, leg: unknown): string | undefined {
  if (!isObj(leg)) return undefined;
  const when = (s: unknown) => str(s).replace("T", " ");
  return `${label}: ${str(leg.flightNumber)} ${str(leg.from)} ${when(leg.departAt)} to ${str(leg.to)} ${when(leg.arriveAt)}`.trim();
}

/** Human-readable detail lines for a booking, from its details_json. */
export function describeBooking(booking: Pick<Booking, "kind" | "details_json">): string[] {
  let d: unknown;
  try {
    d = JSON.parse(booking.details_json);
  } catch {
    return [];
  }
  if (!isObj(d)) return [];
  const lines: string[] = [];
  const offer = isObj(d.offer) ? d.offer : d;
  if (booking.kind === "flight") {
    if (str(offer.airline)) lines.push(`Airline: ${str(offer.airline)}`);
    for (const [label, leg] of [["Outbound", offer.outbound], ["Return", offer.inbound]] as const) {
      const l = legLine(label, leg);
      if (l) lines.push(l);
    }
  } else {
    const hotel = isObj(d.hotel) ? d.hotel : d;
    if (str(hotel.name)) lines.push(`Hotel: ${str(hotel.name)}`);
    if (str(hotel.address)) lines.push(`Address: ${str(hotel.address)}`);
    if (str(hotel.distanceKm)) lines.push(`Distance to venue: ${str(hotel.distanceKm)} km`);
    const checkIn = str(d.checkIn) || str(hotel.checkIn);
    const checkOut = str(d.checkOut) || str(hotel.checkOut);
    if (checkIn || checkOut) lines.push(`Stay: ${checkIn} to ${checkOut}`);
    const nights = str(d.nights);
    if (nights) lines.push(`Nights: ${nights}`);
  }
  const traveller = isObj(d.passenger) ? d.passenger : isObj(d.guest) ? d.guest : undefined;
  if (traveller && str(traveller.name)) lines.push(`Traveller: ${str(traveller.name)}`);
  return lines;
}

// ---- PDF ----

// Standard PDF fonts only encode WinAnsi; pdfSafe swaps anything else so drawText never throws.
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
export function pdfSafe(s: string): string {
  return Array.from(s.normalize("NFC"))
    .map((ch) => {
      const c = ch.codePointAt(0)!;
      if (c === 0x09) return " ";
      if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_EXTRA.has(ch)) return ch;
      if (ch === "→") return "->";
      return "?";
    })
    .join("");
}

export interface ReceiptPdfInput {
  booking: Booking;
  travellerName?: string;
  conferenceName?: string;
  issuedAt?: Date;
}

/** Builds a one-page A4 receipt PDF for a booking. Pure (no I/O). */
export async function buildBookingReceiptPdf(input: ReceiptPdfInput): Promise<Uint8Array> {
  const { booking } = input;
  const doc = await PDFDocument.create();
  const title = `${booking.kind === "flight" ? "Flight" : "Hotel"} booking receipt`;
  doc.setTitle(`${title} ${booking.reference}`);
  doc.setProducer("StudyLeave");
  doc.setCreator("StudyLeave");
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const left = 56;
  const maxWidth = 595.28 - left * 2;
  let y = 841.89 - 72;

  const line = (text: string, opts: { size?: number; bold?: boolean; gap?: number } = {}) => {
    const size = opts.size ?? 11;
    const f = opts.bold ? bold : font;
    let t = pdfSafe(text);
    while (t.length > 1 && f.widthOfTextAtSize(t, size) > maxWidth) t = t.slice(0, -2) + "…";
    page.drawText(t, { x: left, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
    y -= opts.gap ?? size + 7;
  };

  line("StudyLeave", { size: 12, bold: true, gap: 28 });
  line(title, { size: 20, bold: true, gap: 32 });
  line(`Booking reference: ${booking.reference}`, { bold: true });
  line(`Provider: ${booking.provider}`);
  line(`Issued: ${(input.issuedAt ?? new Date()).toISOString().slice(0, 10)}`);
  if (input.travellerName) line(`Doctor: ${input.travellerName}`);
  if (input.conferenceName) line(`For: ${input.conferenceName}`);
  line(`Trip: #${booking.trip_id}`, { gap: 28 });
  for (const l of describeBooking(booking)) line(l);
  y -= 16;
  page.drawLine({ start: { x: left, y: y + 12 }, end: { x: left + maxWidth, y: y + 12 }, thickness: 0.8 });
  line(`Total paid: ${formatMoney(booking.total_cents, booking.currency)}`, { size: 14, bold: true, gap: 40 });
  line("Generated automatically by StudyLeave when this booking was made.", { size: 9 });
  return doc.save();
}

function receiptDescription(booking: Booking): string {
  const first = describeBooking(booking)[0]?.replace(/^(Airline|Hotel): /, "");
  return [booking.kind === "flight" ? "Flight" : "Hotel", first, booking.reference].filter(Boolean).join(" · ");
}

export interface GenerateOptions {
  db?: DatabaseSync;
  /** Uploads folder; defaults to uploadsDir(). */
  dir?: string;
  now?: Date;
}

/**
 * Writes the booking's one-page PDF receipt to <uploads>/<trip_id>/booking-<id>.pdf
 * and inserts a receipt row (source 'generated'). Idempotent per booking.
 */
export async function generateBookingReceipt(booking: Booking, opts: GenerateOptions = {}): Promise<Receipt> {
  const db = opts.db ?? getDb();
  const existing = db.prepare("SELECT * FROM receipts WHERE booking_id = ?").get(booking.id) as unknown as
    | Receipt
    | undefined;
  if (existing) return existing;

  const who = db
    .prepare(
      `SELECT u.name AS traveller, c.name AS conference FROM trips t
       JOIN users u ON u.id = t.user_id JOIN conferences c ON c.id = t.conference_id WHERE t.id = ?`,
    )
    .get(booking.trip_id) as { traveller: string; conference: string } | undefined;
  if (!who) throw new Error("Trip not found");

  const bytes = await buildBookingReceiptPdf({
    booking,
    travellerName: who.traveller,
    conferenceName: who.conference,
    issuedAt: opts.now,
  });
  const dir = opts.dir ?? uploadsDir();
  const rel = path.posix.join(String(booking.trip_id), `booking-${booking.id}.pdf`);
  const full = resolveUploadPath(rel, dir);
  fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(full), { recursive: true });
  fs.writeFileSync(/*turbopackIgnore: true*/ full, bytes);
  try {
    return db
      .prepare(
        `INSERT INTO receipts (trip_id, kind, description, amount_cents, currency, file_path, mime_type, source, booking_id)
         VALUES (?, ?, ?, ?, ?, ?, 'application/pdf', 'generated', ?) RETURNING *`,
      )
      .get(
        booking.trip_id,
        booking.kind,
        receiptDescription(booking),
        booking.total_cents,
        booking.currency,
        rel,
        booking.id,
      ) as unknown as Receipt;
  } catch (e) {
    fs.rmSync(/*turbopackIgnore: true*/ full, { force: true });
    throw e;
  }
}
