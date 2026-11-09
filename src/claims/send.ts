/**
 * Sending the claim (US-022): the doctor clicks "Send claim" on a booked trip,
 * the hospital's finance address gets ONE email with the claim pack PDF attached
 * (the doctor is cc'd), the trip moves to `claimed` and a `claims` row records it.
 */
import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/db";
import { appUrl } from "@/lib/approvals";
import { formatDateRange, formatMoney } from "@/lib/format";
import type { Mailer } from "@/lib/mailer";
import { listReceipts } from "@/lib/receipts";
import { getTripForViewer, transitionTrip, TripTransitionError, type TripDetail, type TripStatus, type TripViewer } from "@/lib/trips";
import { getOrg } from "@/lib/users";
import { buildClaimPack, claimPackFilename } from "./pack";

export class ClaimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaimError";
  }
}

/** Trips in these statuses can be claimed. */
export const CLAIMABLE_STATUSES: readonly TripStatus[] = ["booked"];

export interface Claim {
  id: number;
  trip_id: number;
  org_id: number;
  sent_by: number;
  to_addr: string;
  cc_addr: string;
  filename: string;
  total_cents: number;
  currency: string;
  receipt_count: number;
  page_count: number;
  email_id: number | null;
  sent_at: string;
}

/** Only the trip's owner sends its claim, and only once it is booked. */
export function canSendClaim(trip: Pick<TripDetail, "user_id" | "org_id" | "status">, viewer: TripViewer): boolean {
  return (
    viewer.org_id != null &&
    trip.org_id === viewer.org_id &&
    trip.user_id === viewer.id &&
    CLAIMABLE_STATUSES.includes(trip.status)
  );
}

export function getClaimForTrip(tripId: number, db: DatabaseSync = getDb()): Claim | undefined {
  return db.prepare("SELECT * FROM claims WHERE trip_id = ?").get(tripId) as Claim | undefined;
}

export interface SendClaimOptions {
  db?: DatabaseSync;
  /** Uploads folder (receipt files); defaults to uploadsDir(). */
  dir?: string;
  now?: Date;
}

/** Builds the pack, emails finance (cc the doctor), marks the trip claimed. Throws ClaimError. */
export async function sendClaim(
  tripId: number,
  viewer: TripViewer,
  mailer: Mailer,
  opts: SendClaimOptions = {},
): Promise<Claim> {
  const db = opts.db ?? getDb();
  const trip = getTripForViewer(tripId, viewer, db);
  if (!trip || trip.user_id !== viewer.id) throw new ClaimError("Trip not found.");
  if (trip.status === "claimed" || trip.status === "paid") throw new ClaimError("This claim has already been sent.");
  if (!canSendClaim(trip, viewer)) throw new ClaimError("Book your travel before sending the claim.");
  if (listReceipts(trip.id, db).length === 0) throw new ClaimError("Add at least one receipt before sending the claim.");
  const org = getOrg(db, trip.org_id);
  const financeEmail = org?.finance_email?.trim();
  if (!org || !financeEmail) {
    throw new ClaimError("Your hospital hasn't set a finance email address yet. Ask your admin to add one in Settings.");
  }

  const pack = await buildClaimPack(trip.id, { db, dir: opts.dir, orgId: trip.org_id, now: opts.now });
  const { data } = pack;
  const filename = claimPackFilename(trip.conference_slug, data.employeeName);
  const total = formatMoney(data.totalCents, data.currency);
  const cc = data.employeeEmail ? [data.employeeEmail] : [];

  const sent = await mailer.send({
    orgId: trip.org_id,
    to: financeEmail,
    cc,
    subject: `Study leave claim: ${data.employeeName} – ${trip.conference_name} (${total})`,
    text: [
      `Hello ${org.name} finance team,`,
      "",
      `${data.employeeName} is claiming study-leave expenses for:`,
      `Conference: ${trip.conference_name}`,
      `Dates: ${formatDateRange(trip.conference_start, trip.conference_end)}`,
      `Where: ${[trip.conference_city, trip.conference_country].filter(Boolean).join(", ") || "TBC"}`,
      `Receipts: ${pack.receipts.length}`,
      `Total claimed: ${total}`,
      "",
      `The attached PDF (${filename}, ${pack.pageCount} pages) has a cover sheet, the filled claim form and every receipt.`,
      `Trip: ${appUrl(`/trips/${trip.id}`)}`,
      "",
      `Questions? Reply to ${data.employeeName} at ${data.employeeEmail}.`,
    ].join("\n"),
    attachments: [{ filename, content: Buffer.from(pack.bytes), contentType: "application/pdf" }],
  });

  db.exec("BEGIN");
  try {
    transitionTrip(trip.id, "claimed", { orgId: trip.org_id }, db);
    db.prepare(
      `INSERT INTO claims (trip_id, org_id, sent_by, to_addr, cc_addr, filename, total_cents, currency,
         receipt_count, page_count, email_id${opts.now ? ", sent_at" : ""})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${opts.now ? ", ?" : ""})`,
    ).run(
      trip.id,
      trip.org_id,
      viewer.id,
      financeEmail,
      cc.join(", "),
      filename,
      data.totalCents,
      data.currency,
      pack.receipts.length,
      pack.pageCount,
      sent.id,
      ...(opts.now ? [opts.now.toISOString()] : []),
    );
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    // A concurrent send already moved the trip on.
    if (err instanceof TripTransitionError) throw new ClaimError("This claim has already been sent.");
    throw err;
  }
  return getClaimForTrip(trip.id, db)!;
}
