/**
 * Unfiled receipts: mail to a doctor's personal Hoggy inbox that didn't fit exactly
 * one of their trips. Private to that doctor (every query filters by user_id).
 */
import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/db";

export type UnfiledReason = "no_match" | "ambiguous";

export const UNFILED_REASON_LABELS: Record<UnfiledReason, string> = {
  no_match: "Didn't match a trip",
  ambiguous: "Could be more than one trip",
};

export interface UnfiledReceipt {
  id: number;
  user_id: number;
  kind: string;
  description: string;
  amount_cents: number;
  currency: string;
  /** Relative to the uploads folder, e.g. "unfiled/12/inbox-ab12.pdf". */
  file_path: string;
  mime_type: string;
  original_name: string | null;
  supplier_name: string | null;
  supplier_abn: string | null;
  gst_cents: number | null;
  receipt_date: string | null;
  is_tax_invoice: 0 | 1 | null;
  extraction_json: string | null;
  email_subject: string;
  reason: UnfiledReason;
  created_at: string;
}

/** The doctor's own unfiled receipts, newest first. */
export function listUnfiledReceipts(userId: number, db: DatabaseSync = getDb()): UnfiledReceipt[] {
  return db
    .prepare("SELECT * FROM unfiled_receipts WHERE user_id = ? ORDER BY created_at DESC, id DESC")
    .all(userId) as unknown as UnfiledReceipt[];
}

/** One unfiled receipt, only if it belongs to this user. */
export function getUnfiledReceipt(id: number, userId: number, db: DatabaseSync = getDb()): UnfiledReceipt | undefined {
  return db.prepare("SELECT * FROM unfiled_receipts WHERE id = ? AND user_id = ?").get(id, userId) as
    | UnfiledReceipt
    | undefined;
}
