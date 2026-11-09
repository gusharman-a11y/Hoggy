/**
 * "Snap receipt": the doctor photographs (or picks a PDF of) a receipt, the ReceiptReader
 * fills in the details, and the receipt waits as needs_review until the doctor checks it
 * on the "Check this receipt" card and taps "Looks right".
 */
import fs from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/db";
import {
  EMPTY_READING,
  getReceiptReader,
  type ReadKind,
  type ReceiptReader,
  type ReceiptReading,
} from "@/providers/receipt-reader";
import { getReceipt, ReceiptDetailsError, setReceiptDetails, uploadsDir, type Receipt } from "./receipts";
import { canEditReceipt, canUploadReceipt, checkUploadFile, cleanName, storeUploadFile, UploadError, type UploadInput } from "./receipt-uploads";
import { SNAP_KIND_LABELS, SNAP_KINDS, type SnapKind } from "./receipt-upload-kinds";
import { getTrip, type TripViewer } from "./trips";

/** What the reader calls a receipt -> the receipts.kind we store. */
export function receiptKindFromReading(kind: ReadKind): SnapKind {
  return (SNAP_KINDS as readonly string[]).includes(kind) ? (kind as SnapKind) : "other";
}

export interface SnapOptions {
  db?: DatabaseSync;
  dir?: string;
  reader?: ReceiptReader;
}

/**
 * Saves a snapped receipt and reads it. The receipt is stored even when the reader finds
 * nothing (or fails): the doctor fills the gaps on the check card. Throws UploadError.
 */
export async function snapReceipt(
  tripId: number,
  viewer: TripViewer,
  rawFile: UploadInput["file"],
  opts: SnapOptions = {},
): Promise<Receipt> {
  const db = opts.db ?? getDb();
  const trip = getTrip(tripId, db, viewer.org_id ?? -1);
  if (!trip || !canUploadReceipt(trip, viewer)) throw new UploadError("You can't add receipts to this trip.");
  const { file, type } = checkUploadFile(rawFile);

  let reading: ReceiptReading;
  try {
    reading = await (opts.reader ?? getReceiptReader()).read({ bytes: file.bytes, mimeType: type.mime });
  } catch (err) {
    // A failed read must not lose the receipt; the doctor types the details instead.
    console.error("Receipt reader failed:", err instanceof Error ? err.message : err);
    reading = { ...EMPTY_READING };
  }

  const kind = receiptKindFromReading(reading.kind);
  const description = reading.supplierName ?? SNAP_KIND_LABELS[kind];
  const { rel, full } = storeUploadFile(trip.id, type, file.bytes, opts.dir ?? uploadsDir());
  try {
    db.exec("BEGIN");
    const row = db
      .prepare(
        `INSERT INTO receipts (trip_id, kind, description, amount_cents, currency, file_path, mime_type, source, uploaded_by, original_name, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'upload', ?, ?, 'needs_review') RETURNING id`,
      )
      .get(trip.id, kind, description, reading.totalCents ?? 0, trip.currency, rel, type.mime, viewer.id, cleanName(file.name)) as {
      id: number;
    };
    const saved = setReceiptDetails(
      row.id,
      {
        supplierName: reading.supplierName,
        supplierAbn: reading.supplierAbn,
        gstCents: reading.gstCents,
        receiptDate: reading.date,
        isTaxInvoice: reading.isTaxInvoice,
        status: "needs_review",
        extraction: reading,
      },
      db,
    ) as Receipt;
    db.exec("COMMIT");
    return saved;
  } catch (e) {
    if (db.isTransaction) db.exec("ROLLBACK");
    fs.rmSync(/*turbopackIgnore: true*/ full, { force: true });
    throw e;
  }
}

export interface ReceiptReview {
  supplierName: string;
  supplierAbn: string;
  /** undefined = invalid money; null = blank. */
  gstCents: number | null | undefined;
  amountCents: number | undefined;
  receiptDate: string;
  kind: string;
}

/**
 * Saves the doctor's checked details and marks the receipt confirmed ("Looks right").
 * Throws UploadError with a user-facing message.
 */
export function reviewReceipt(
  tripId: number,
  receiptId: number,
  viewer: TripViewer,
  review: ReceiptReview,
  opts: Pick<SnapOptions, "db"> = {},
): Receipt {
  const db = opts.db ?? getDb();
  const trip = getTrip(tripId, db, viewer.org_id ?? -1);
  const receipt = trip ? getReceipt(receiptId, db) : undefined;
  if (!trip || !receipt || receipt.trip_id !== trip.id || !canEditReceipt(trip, viewer)) {
    throw new UploadError("You can't change that receipt.");
  }
  const supplier = review.supplierName.trim();
  if (supplier.length > 200) throw new UploadError("Keep the supplier name under 200 characters.");
  if (review.amountCents === undefined) throw new UploadError("Enter the amount, e.g. 42.50.");
  if (review.gstCents === undefined) throw new UploadError("Enter the GST as an amount, e.g. 4.16, or leave it blank.");
  if (review.gstCents != null && review.gstCents > review.amountCents) throw new UploadError("GST can't be more than the amount.");
  if (!(SNAP_KINDS as readonly string[]).includes(review.kind)) throw new UploadError("Choose what the receipt is for.");

  const description = supplier || receipt.description || SNAP_KIND_LABELS[review.kind as SnapKind];
  try {
    db.exec("BEGIN");
    db.prepare("UPDATE receipts SET kind = ?, description = ?, amount_cents = ? WHERE id = ?").run(
      review.kind,
      description,
      review.amountCents,
      receipt.id,
    );
    const saved = setReceiptDetails(
      receipt.id,
      {
        supplierName: supplier || null,
        supplierAbn: review.supplierAbn.trim() || null,
        gstCents: review.gstCents,
        receiptDate: review.receiptDate.trim() || null,
        status: "confirmed",
      },
      db,
    ) as Receipt;
    db.exec("COMMIT");
    return saved;
  } catch (e) {
    if (db.isTransaction) db.exec("ROLLBACK");
    if (e instanceof ReceiptDetailsError) throw new UploadError(e.message);
    throw e;
  }
}
