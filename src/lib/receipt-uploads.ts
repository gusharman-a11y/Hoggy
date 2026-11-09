/**
 * Receipts a doctor uploads themselves (taxi, meals, registration...).
 * Files go to <uploads>/<trip_id>/upload-<random>.<ext>; rows are source='upload'.
 * The file type is checked from its first bytes, not the name or browser type.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/db";
import { getReceipt, resolveUploadPath, uploadsDir, type Receipt } from "./receipts";
import { UPLOAD_KINDS } from "./receipt-upload-kinds";
import { getTrip, type Trip, type TripStatus, type TripViewer } from "./trips";

export { UPLOAD_KIND_LABELS, UPLOAD_KINDS, type UploadKind } from "./receipt-upload-kinds";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Once a claim has gone in, its receipts are frozen. */
export const RECEIPT_LOCKED_STATUSES: readonly TripStatus[] = ["claimed", "paid"];

export const ALLOWED_TYPES_TEXT = "PDF, JPG or PNG";

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

export interface DetectedType {
  mime: "application/pdf" | "image/jpeg" | "image/png";
  ext: "pdf" | "jpg" | "png";
}

/** Sniffs PDF / JPEG / PNG from the file's magic bytes; undefined for anything else. */
export function detectFileType(bytes: Uint8Array): DetectedType | undefined {
  const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: "application/pdf", ext: "pdf" }; // %PDF-
  if (starts([0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  return undefined;
}

type ReceiptTrip = Pick<Trip, "org_id" | "user_id" | "status">;

/** The trip's owner can add receipts until the claim has been sent. */
export function canUploadReceipt(trip: ReceiptTrip, viewer: TripViewer): boolean {
  return (
    viewer.org_id != null &&
    trip.org_id === viewer.org_id &&
    trip.user_id === viewer.id &&
    !RECEIPT_LOCKED_STATUSES.includes(trip.status)
  );
}

/** Only your own uploads, and only until the claim has been sent. */
export function canDeleteReceipt(
  receipt: Pick<Receipt, "source" | "uploaded_by">,
  trip: ReceiptTrip,
  viewer: TripViewer,
): boolean {
  return receipt.source === "upload" && receipt.uploaded_by === viewer.id && canUploadReceipt(trip, viewer);
}

export interface UploadInput {
  file: { name: string; size: number; bytes: Uint8Array } | undefined;
  description: string;
  amountCents: number | undefined;
  kind: string;
}

export interface UploadOptions {
  db?: DatabaseSync;
  dir?: string;
}

export function cleanName(name: string): string {
  const base = path.basename(name.replace(/\\/g, "/")).replace(/[\u0000-\u001f]/g, "").trim();
  return base.slice(0, 200) || "receipt";
}

/** Checks an uploaded file is present, not too big and a PDF/JPG/PNG by its bytes. Throws UploadError. */
export function checkUploadFile(file: UploadInput["file"]): { file: NonNullable<UploadInput["file"]>; type: DetectedType } {
  if (!file || file.size === 0) throw new UploadError("Choose a file to upload.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("That file is too big. The limit is 10 MB.");
  const type = detectFileType(file.bytes);
  if (!type) throw new UploadError(`That file type isn't supported. Please upload a ${ALLOWED_TYPES_TEXT}.`);
  return { file, type };
}

/** Writes the file to <uploads>/<trip_id>/upload-<hex>.<ext>; returns the relative and full paths. */
export function storeUploadFile(tripId: number, type: DetectedType, bytes: Uint8Array, dir: string): { rel: string; full: string } {
  const rel = path.posix.join(String(tripId), `upload-${crypto.randomBytes(8).toString("hex")}.${type.ext}`);
  const full = resolveUploadPath(rel, dir);
  fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(full), { recursive: true });
  fs.writeFileSync(/*turbopackIgnore: true*/ full, bytes);
  return { rel, full };
}

/** Validates and stores an uploaded receipt. Throws UploadError with a user-facing message. */
export function saveUploadedReceipt(
  tripId: number,
  viewer: TripViewer,
  input: UploadInput,
  opts: UploadOptions = {},
): Receipt {
  const db = opts.db ?? getDb();
  const trip = getTrip(tripId, db, viewer.org_id ?? -1);
  if (!trip || !canUploadReceipt(trip, viewer)) throw new UploadError("You can't add receipts to this trip.");

  const { file, type } = checkUploadFile(input.file);

  const description = input.description.trim();
  if (!description) throw new UploadError("Add a short description, e.g. “Taxi to venue”.");
  if (description.length > 200) throw new UploadError("Keep the description under 200 characters.");
  if (input.amountCents === undefined) throw new UploadError("Enter the amount, e.g. 42.50.");
  if (!(UPLOAD_KINDS as readonly string[]).includes(input.kind)) throw new UploadError("Choose what the receipt is for.");

  const { rel, full } = storeUploadFile(trip.id, type, file.bytes, opts.dir ?? uploadsDir());
  try {
    return db
      .prepare(
        `INSERT INTO receipts (trip_id, kind, description, amount_cents, currency, file_path, mime_type, source, uploaded_by, original_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'upload', ?, ?) RETURNING *`,
      )
      .get(
        trip.id,
        input.kind,
        description,
        input.amountCents,
        trip.currency,
        rel,
        type.mime,
        viewer.id,
        cleanName(file.name),
      ) as unknown as Receipt;
  } catch (e) {
    fs.rmSync(/*turbopackIgnore: true*/ full, { force: true });
    throw e;
  }
}

/** Deletes one of the viewer's own uploaded receipts (row and file). */
export function deleteUploadedReceipt(
  tripId: number,
  receiptId: number,
  viewer: TripViewer,
  opts: UploadOptions = {},
): void {
  const db = opts.db ?? getDb();
  const trip = getTrip(tripId, db, viewer.org_id ?? -1);
  const receipt = trip ? getReceipt(receiptId, db) : undefined;
  if (!trip || !receipt || receipt.trip_id !== trip.id || !canDeleteReceipt(receipt, trip, viewer)) {
    throw new UploadError("You can't delete that receipt.");
  }
  db.prepare("DELETE FROM receipts WHERE id = ?").run(receipt.id);
  if (receipt.file_path) {
    fs.rmSync(/*turbopackIgnore: true*/ resolveUploadPath(receipt.file_path, opts.dir ?? uploadsDir()), { force: true });
  }
}

/** The trip's owner can fix the description and amount of any receipt on it (e.g. an
 * emailed one that arrived at $0) until the claim has been sent. */
export function canEditReceipt(trip: ReceiptTrip, viewer: TripViewer): boolean {
  return canUploadReceipt(trip, viewer);
}

export interface ReceiptEdit {
  description: string;
  amountCents: number | undefined;
}

/** Updates a receipt's description and amount. Throws UploadError with a user-facing message. */
export function updateReceipt(
  tripId: number,
  receiptId: number,
  viewer: TripViewer,
  edit: ReceiptEdit,
  opts: Pick<UploadOptions, "db"> = {},
): Receipt {
  const db = opts.db ?? getDb();
  const trip = getTrip(tripId, db, viewer.org_id ?? -1);
  const receipt = trip ? getReceipt(receiptId, db) : undefined;
  if (!trip || !receipt || receipt.trip_id !== trip.id || !canEditReceipt(trip, viewer)) {
    throw new UploadError("You can't change that receipt.");
  }
  const description = edit.description.trim();
  if (!description) throw new UploadError("Add a short description, e.g. “Taxi to venue”.");
  if (description.length > 200) throw new UploadError("Keep the description under 200 characters.");
  if (edit.amountCents === undefined) throw new UploadError("Enter the amount, e.g. 42.50.");
  return db
    .prepare("UPDATE receipts SET description = ?, amount_cents = ? WHERE id = ? RETURNING *")
    .get(description, edit.amountCents, receipt.id) as unknown as Receipt;
}
