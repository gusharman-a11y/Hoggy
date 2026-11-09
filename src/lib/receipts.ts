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

// Standard PDF fonts only encode WinAnsi; swap anything else so drawText never throws.
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
function pdfSafe(s: string): string {
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
