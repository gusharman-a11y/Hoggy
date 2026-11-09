/**
 * /receipts: the doctor checks what Hoggy filed. Lists their needs_review receipts (on
 * their own open trips) and their private Unfiled receipts, and lets them Confirm, Edit,
 * Move to another of their trips, or delete a personal one (file and row).
 * Also purgeUnfiled(): unfiled receipts are kept for 7 days only.
 * Every write here is for POST handlers only; listing/counting never writes.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/db";
import {
  confirmReceipt,
  getReceipt,
  receiptDetailColumns,
  ReceiptDetailsError,
  resolveUploadPath,
  uploadsDir,
  type Receipt,
} from "./receipts";
import { reviewReceipt, type ReceiptReview } from "./receipt-snap";
import { SNAP_KIND_LABELS, SNAP_KINDS, type SnapKind } from "./receipt-upload-kinds";
import { canEditReceipt, RECEIPT_LOCKED_STATUSES, UploadError } from "./receipt-uploads";
import { getTrip, type TripStatus, type TripViewer } from "./trips";
import { getUnfiledReceipt, listUnfiledReceipts, type UnfiledReceipt } from "./unfiled-receipts";

/** Unfiled receipts older than this are deleted. */
export const UNFILED_KEEP_DAYS = 7;

export interface ReviewOptions {
  db?: DatabaseSync;
  dir?: string;
}

/** A needs_review receipt with the trip it sits on. */
export interface ReviewReceipt extends Receipt {
  trip_status: TripStatus;
  conference_name: string;
}

/** A trip the doctor can move a receipt to. */
export interface MoveTarget {
  id: number;
  conference_name: string;
  start_date: string;
}

const lockedList = RECEIPT_LOCKED_STATUSES.map((s) => `'${s}'`).join(", ");

/** The doctor's own needs_review receipts on trips they can still change, newest first. */
export function listReceiptsToReview(viewer: TripViewer, db: DatabaseSync = getDb()): ReviewReceipt[] {
  if (viewer.org_id == null) return [];
  return db
    .prepare(
      `SELECT r.*, t.status AS trip_status, c.name AS conference_name
       FROM receipts r JOIN trips t ON t.id = r.trip_id JOIN conferences c ON c.id = t.conference_id
       WHERE t.user_id = ? AND t.org_id = ? AND r.status = 'needs_review' AND t.status NOT IN (${lockedList})
       ORDER BY r.created_at DESC, r.id DESC`,
    )
    .all(viewer.id, viewer.org_id) as unknown as ReviewReceipt[];
}

/** Nav badge: needs_review receipts + unfiled receipts for this doctor. Read-only. */
export function countReceiptsToReview(viewer: TripViewer, db: DatabaseSync = getDb()): number {
  const unfiled = (db.prepare("SELECT COUNT(*) AS n FROM unfiled_receipts WHERE user_id = ?").get(viewer.id) as { n: number }).n;
  if (viewer.org_id == null) return unfiled;
  const review = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM receipts r JOIN trips t ON t.id = r.trip_id
         WHERE t.user_id = ? AND t.org_id = ? AND r.status = 'needs_review' AND t.status NOT IN (${lockedList})`,
      )
      .get(viewer.id, viewer.org_id) as { n: number }
  ).n;
  return review + unfiled;
}

/** The doctor's own trips that can still take receipts (soonest conference first). */
export function listMoveTargets(viewer: TripViewer, db: DatabaseSync = getDb()): MoveTarget[] {
  if (viewer.org_id == null) return [];
  return db
    .prepare(
      `SELECT t.id, c.name AS conference_name, c.start_date
       FROM trips t JOIN conferences c ON c.id = t.conference_id
       WHERE t.user_id = ? AND t.org_id = ? AND t.status NOT IN (${lockedList})
       ORDER BY c.start_date, t.id`,
    )
    .all(viewer.id, viewer.org_id) as unknown as MoveTarget[];
}

export { listUnfiledReceipts };

/** A receipt on one of the viewer's trips that they may change; throws UploadError otherwise. */
function ownTripReceipt(receiptId: number, viewer: TripViewer, db: DatabaseSync): { receipt: Receipt; tripId: number } {
  const receipt = getReceipt(receiptId, db);
  const trip = receipt ? getTrip(receipt.trip_id, db, viewer.org_id ?? -1) : undefined;
  if (!receipt || !trip || !canEditReceipt(trip, viewer)) throw new UploadError("You can't change that receipt.");
  return { receipt, tripId: trip.id };
}

function ownUnfiled(id: number, viewer: TripViewer, db: DatabaseSync): UnfiledReceipt {
  const u = getUnfiledReceipt(id, viewer.id, db);
  if (!u) throw new UploadError("That receipt has already gone.");
  return u;
}

/** "Confirm": the details are right as read. */
export function confirmReviewReceipt(receiptId: number, viewer: TripViewer, opts: ReviewOptions = {}): Receipt {
  const db = opts.db ?? getDb();
  const { receipt } = ownTripReceipt(receiptId, viewer, db);
  return confirmReceipt(receipt.id, db) as Receipt;
}

/** "Edit" on a filed receipt: save corrected details, leaving it in the review list. */
export function editReviewReceipt(receiptId: number, viewer: TripViewer, review: ReceiptReview, opts: ReviewOptions = {}): Receipt {
  const db = opts.db ?? getDb();
  const { tripId } = ownTripReceipt(receiptId, viewer, db);
  return reviewReceipt(tripId, receiptId, viewer, review, { db, confirm: false });
}

/** "Edit" on an unfiled receipt (same fields as the check card). */
export function editUnfiledReceipt(id: number, viewer: TripViewer, review: ReceiptReview, opts: ReviewOptions = {}): UnfiledReceipt {
  const db = opts.db ?? getDb();
  const u = ownUnfiled(id, viewer, db);
  const supplier = review.supplierName.trim();
  if (supplier.length > 200) throw new UploadError("Keep the supplier name under 200 characters.");
  if (review.amountCents === undefined) throw new UploadError("Enter the amount, e.g. 42.50.");
  if (review.gstCents === undefined) throw new UploadError("Enter the GST as an amount, e.g. 4.16, or leave it blank.");
  if (review.gstCents != null && review.gstCents > review.amountCents) throw new UploadError("GST can't be more than the amount.");
  if (!(SNAP_KINDS as readonly string[]).includes(review.kind)) throw new UploadError("Choose what the receipt is for.");
  let cols: Record<string, string | number | null>;
  try {
    cols = receiptDetailColumns({
      supplierName: supplier || null,
      supplierAbn: review.supplierAbn.trim() || null,
      gstCents: review.gstCents,
      receiptDate: review.receiptDate.trim() || null,
    });
  } catch (e) {
    if (e instanceof ReceiptDetailsError) throw new UploadError(e.message);
    throw e;
  }
  const all: Record<string, string | number | null> = {
    ...cols,
    kind: review.kind,
    description: supplier || u.description || SNAP_KIND_LABELS[review.kind as SnapKind],
    amount_cents: review.amountCents,
  };
  const keys = Object.keys(all);
  db.prepare(`UPDATE unfiled_receipts SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ? AND user_id = ?`).run(
    ...keys.map((k) => all[k]),
    u.id,
    viewer.id,
  );
  return getUnfiledReceipt(u.id, viewer.id, db)!;
}

/** The trip a receipt may be moved to: the viewer's own, and still open for receipts. */
function targetTrip(toTripId: number, viewer: TripViewer, db: DatabaseSync) {
  const trip = Number.isInteger(toTripId) ? getTrip(toTripId, db, viewer.org_id ?? -1) : undefined;
  if (!trip || !canEditReceipt(trip, viewer)) throw new UploadError("Choose one of your trips that can still take receipts.");
  return trip;
}

/** Copies a stored file into <toTripId>/ with a fresh name; returns the new relative path. */
function copyInto(rel: string, toTripId: number, prefix: string, dir: string): { rel: string; full: string } {
  const ext = path.posix.extname(rel).replace(/[^.a-z0-9]/gi, "") || ".bin";
  const nextRel = path.posix.join(String(toTripId), `${prefix}-${crypto.randomBytes(8).toString("hex")}${ext}`);
  const full = resolveUploadPath(nextRel, dir);
  fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(full), { recursive: true });
  fs.copyFileSync(/*turbopackIgnore: true*/ resolveUploadPath(rel, dir), full);
  return { rel: nextRel, full };
}

/**
 * "Move to another of my trips". Booking receipts belong to their booking and can't move.
 * The file moves with it; the receipt stays needs_review on the new trip.
 */
export function moveReviewReceipt(receiptId: number, toTripId: number, viewer: TripViewer, opts: ReviewOptions = {}): Receipt {
  const db = opts.db ?? getDb();
  const dir = opts.dir ?? uploadsDir();
  const { receipt, tripId } = ownTripReceipt(receiptId, viewer, db);
  if (receipt.source === "generated") throw new UploadError("Booking receipts stay with their booking.");
  const to = targetTrip(toTripId, viewer, db);
  if (to.id === tripId) throw new UploadError("It's already on that trip.");
  let copied: { rel: string; full: string } | undefined;
  if (receipt.file_path) {
    try {
      copied = copyInto(receipt.file_path, to.id, receipt.source === "email" ? "email" : "upload", dir);
    } catch {
      copied = undefined; // file already missing: move the record anyway
    }
  }
  try {
    db.prepare("UPDATE receipts SET trip_id = ?, currency = ?, file_path = ? WHERE id = ?").run(
      to.id,
      to.currency,
      copied ? copied.rel : receipt.file_path,
      receipt.id,
    );
  } catch (e) {
    if (copied) fs.rmSync(/*turbopackIgnore: true*/ copied.full, { force: true });
    throw e;
  }
  if (copied && receipt.file_path) fs.rmSync(/*turbopackIgnore: true*/ resolveUploadPath(receipt.file_path, dir), { force: true });
  return getReceipt(receipt.id, db)!;
}

/** Files an unfiled receipt on one of the doctor's trips (needs_review, source email). */
export function moveUnfiledReceipt(id: number, toTripId: number, viewer: TripViewer, opts: ReviewOptions = {}): Receipt {
  const db = opts.db ?? getDb();
  const dir = opts.dir ?? uploadsDir();
  const u = ownUnfiled(id, viewer, db);
  const to = targetTrip(toTripId, viewer, db);
  const copied = copyInto(u.file_path, to.id, "email", dir);
  let receiptId: number;
  try {
    db.exec("BEGIN");
    receiptId = (
      db
        .prepare(
          `INSERT INTO receipts (trip_id, kind, description, amount_cents, currency, file_path, mime_type, source, uploaded_by,
             original_name, supplier_name, supplier_abn, gst_cents, receipt_date, is_tax_invoice, extraction_json, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'email', ?, ?, ?, ?, ?, ?, ?, ?, 'needs_review') RETURNING id`,
        )
        .get(
          to.id,
          u.kind,
          u.description,
          u.amount_cents,
          to.currency,
          copied.rel,
          u.mime_type,
          viewer.id,
          u.original_name,
          u.supplier_name,
          u.supplier_abn,
          u.gst_cents,
          u.receipt_date,
          u.is_tax_invoice,
          u.extraction_json,
        ) as { id: number }
    ).id;
    db.prepare("DELETE FROM unfiled_receipts WHERE id = ? AND user_id = ?").run(u.id, viewer.id);
    db.exec("COMMIT");
  } catch (e) {
    if (db.isTransaction) db.exec("ROLLBACK");
    fs.rmSync(/*turbopackIgnore: true*/ copied.full, { force: true });
    throw e;
  }
  fs.rmSync(/*turbopackIgnore: true*/ resolveUploadPath(u.file_path, dir), { force: true });
  return getReceipt(receiptId, db)!;
}

/** "Personal — delete" on a filed receipt: removes the row and its file. Not booking receipts. */
export function deletePersonalReceipt(receiptId: number, viewer: TripViewer, opts: ReviewOptions = {}): void {
  const db = opts.db ?? getDb();
  const { receipt } = ownTripReceipt(receiptId, viewer, db);
  if (receipt.source === "generated") throw new UploadError("Booking receipts can't be deleted.");
  db.prepare("DELETE FROM receipts WHERE id = ?").run(receipt.id);
  if (receipt.file_path) fs.rmSync(/*turbopackIgnore: true*/ resolveUploadPath(receipt.file_path, opts.dir ?? uploadsDir()), { force: true });
}

/** "Personal — delete" on an unfiled receipt. */
export function deleteUnfiledReceipt(id: number, viewer: TripViewer, opts: ReviewOptions = {}): void {
  const db = opts.db ?? getDb();
  const u = ownUnfiled(id, viewer, db);
  db.prepare("DELETE FROM unfiled_receipts WHERE id = ? AND user_id = ?").run(u.id, viewer.id);
  fs.rmSync(/*turbopackIgnore: true*/ resolveUploadPath(u.file_path, opts.dir ?? uploadsDir()), { force: true });
}

/** created_at format used by the migrations: "YYYY-MM-DD HH:MM:SS.SSS" (UTC). */
function sqliteTimestamp(d: Date): string {
  return d.toISOString().replace("T", " ").replace("Z", "");
}

/**
 * Deletes every unfiled receipt (row + file) older than UNFILED_KEEP_DAYS. Runs on each
 * inbound email POST and via `npm run purge` — never on a page load. Returns how many.
 */
export function purgeUnfiled(opts: ReviewOptions & { now?: Date } = {}): number {
  const db = opts.db ?? getDb();
  const dir = opts.dir ?? uploadsDir();
  const now = opts.now ?? new Date();
  const cutoff = sqliteTimestamp(new Date(now.getTime() - UNFILED_KEEP_DAYS * 24 * 60 * 60 * 1000));
  const old = db.prepare("SELECT id, file_path FROM unfiled_receipts WHERE created_at < ?").all(cutoff) as {
    id: number;
    file_path: string;
  }[];
  for (const row of old) {
    db.prepare("DELETE FROM unfiled_receipts WHERE id = ?").run(row.id);
    try {
      fs.rmSync(/*turbopackIgnore: true*/ resolveUploadPath(row.file_path, dir), { force: true });
    } catch {
      // a bad stored path must not stop the purge
    }
  }
  return old.length;
}
