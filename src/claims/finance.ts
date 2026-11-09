/**
 * Finance view (US-023): finance (or an admin) sees every claim sent in their hospital,
 * downloads the exact pack that was emailed, and marks claims paid (the doctor is emailed).
 */
import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/db";
import { appUrl } from "@/lib/approvals";
import { formatMoney } from "@/lib/format";
import { getOutboxAttachment, type Mailer } from "@/lib/mailer";
import { transitionTrip, TripTransitionError, type TripStatus, type TripViewer } from "@/lib/trips";
import { buildClaimPack } from "./pack";
import type { Claim } from "./send";

export class FinanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinanceError";
  }
}

export const FINANCE_ROLES: readonly TripViewer["role"][] = ["finance", "admin"];

export function canManageClaims(viewer: Pick<TripViewer, "role" | "org_id">): boolean {
  return viewer.org_id != null && FINANCE_ROLES.includes(viewer.role);
}

export interface ClaimListItem extends Claim {
  status: Extract<TripStatus, "claimed" | "paid">;
  doctor_name: string;
  doctor_email: string;
  conference_name: string;
  conference_slug: string;
  conference_start: string;
  conference_end: string;
}

const LIST_SQL = `SELECT cl.*, t.status, u.name AS doctor_name, u.email AS doctor_email,
    c.name AS conference_name, c.slug AS conference_slug, c.start_date AS conference_start, c.end_date AS conference_end
  FROM claims cl
  JOIN trips t ON t.id = cl.trip_id
  JOIN users u ON u.id = t.user_id
  JOIN conferences c ON c.id = t.conference_id
  WHERE cl.org_id = ? AND t.org_id = ? AND t.status IN ('claimed', 'paid')`;

/** The viewer's hospital's claims: unpaid first (oldest first), then paid (latest paid first). */
export function listClaims(viewer: TripViewer, db: DatabaseSync = getDb()): ClaimListItem[] {
  if (!canManageClaims(viewer)) return [];
  return db
    .prepare(
      `${LIST_SQL} ORDER BY CASE t.status WHEN 'claimed' THEN 0 ELSE 1 END,
         CASE t.status WHEN 'claimed' THEN cl.sent_at END ASC, cl.paid_at DESC, cl.id DESC`,
    )
    .all(viewer.org_id, viewer.org_id) as unknown as ClaimListItem[];
}

export function getClaimForFinance(tripId: number, viewer: TripViewer, db: DatabaseSync = getDb()): ClaimListItem | undefined {
  if (!canManageClaims(viewer)) return undefined;
  return db.prepare(`${LIST_SQL} AND cl.trip_id = ?`).get(viewer.org_id, viewer.org_id, tripId) as
    | ClaimListItem
    | undefined;
}

export interface ClaimPackFile {
  filename: string;
  bytes: Uint8Array;
}

/**
 * The pack finance received: the emailed attachment when the outbox still has it,
 * otherwise rebuilt from the (locked) receipts. Read-only.
 */
export async function claimPackForFinance(
  tripId: number,
  viewer: TripViewer,
  opts: { db?: DatabaseSync; dir?: string } = {},
): Promise<ClaimPackFile | undefined> {
  const db = opts.db ?? getDb();
  const claim = getClaimForFinance(tripId, viewer, db);
  if (!claim) return undefined;
  if (claim.email_id != null) {
    const att = db
      .prepare("SELECT id FROM outbox_attachments WHERE email_id = ? AND filename = ? ORDER BY id LIMIT 1")
      .get(claim.email_id, claim.filename) as { id: number } | undefined;
    const file = att ? getOutboxAttachment(att.id, { orgId: claim.org_id }, db) : undefined;
    if (file) return { filename: claim.filename, bytes: new Uint8Array(file.content) };
  }
  const pack = await buildClaimPack(tripId, { db, dir: opts.dir, orgId: claim.org_id });
  return { filename: claim.filename, bytes: pack.bytes };
}

/** Marks a sent claim paid (trip claimed -> paid) and emails the doctor. Throws FinanceError. */
export async function markClaimPaid(
  tripId: number,
  viewer: TripViewer,
  mailer: Mailer,
  opts: { db?: DatabaseSync; now?: Date } = {},
): Promise<ClaimListItem> {
  const db = opts.db ?? getDb();
  if (!canManageClaims(viewer)) throw new FinanceError("Only finance can mark claims paid.");
  const claim = getClaimForFinance(tripId, viewer, db);
  if (!claim) throw new FinanceError("Claim not found.");
  if (claim.status === "paid") throw new FinanceError("This claim is already marked paid.");
  const paidAt = (opts.now ?? new Date()).toISOString();

  db.exec("BEGIN");
  try {
    transitionTrip(tripId, "paid", { orgId: claim.org_id }, db);
    db.prepare("UPDATE claims SET paid_at = ?, paid_by = ? WHERE trip_id = ?").run(paidAt, viewer.id, tripId);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    if (err instanceof TripTransitionError) throw new FinanceError("This claim is already marked paid.");
    throw err;
  }

  // The status change is the source of truth; the email (local outbox) follows it.
  const total = formatMoney(claim.total_cents, claim.currency);
  await mailer.send({
    orgId: claim.org_id,
    to: claim.doctor_email,
    subject: `Claim paid: ${claim.conference_name} (${total})`,
    text: [
      `Hi ${claim.doctor_name},`,
      "",
      `Good news: finance has paid your study-leave claim for ${claim.conference_name}.`,
      `Amount: ${total}`,
      "The money should reach your account within a few working days.",
      "",
      `Trip: ${appUrl(`/trips/${tripId}`)}`,
    ].join("\n"),
  });
  return getClaimForFinance(tripId, viewer, db)!;
}
