import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/db";
import { getBudget, tripYear } from "./budget";
import { formatDateRange, formatMoney } from "./format";
import type { Mailer } from "./mailer";
import {
  getTripForViewer,
  transitionTrip,
  tripEstimateTotal,
  type TripDetail,
  type TripViewer,
} from "./trips";

/**
 * Approval workflow (US-013).
 * - The trip's owner submits a draft or rejected trip -> pending_approval; the hospital's
 *   managers (admins if it has none) get an email.
 * - A manager/admin in the same org approves or rejects (a comment is required to reject);
 *   the doctor gets an email and the trip page shows the comment.
 * - Nobody decides on their own trip.
 */

export const APPROVER_ROLES = ["manager", "admin"] as const;
export const MAX_COMMENT_LENGTH = 1000;

export class ApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalError";
  }
}

export function isApprover(viewer: Pick<TripViewer, "role">): boolean {
  return (APPROVER_ROLES as readonly string[]).includes(viewer.role);
}

/** Absolute link for emails. APP_URL in production; localhost in dev. */
export function appUrl(path: string, env: Record<string, string | undefined> = process.env): string {
  const base = (env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path}`;
}

/** Emails of the people who approve trips in an org: its managers, else its admins. */
export function approverEmails(orgId: number, db: DatabaseSync = getDb()): string[] {
  const rows = db
    .prepare("SELECT email, role FROM users WHERE org_id = ? AND role IN ('manager', 'admin') ORDER BY id")
    .all(orgId) as { email: string; role: string }[];
  const managers = rows.filter((r) => r.role === "manager");
  return (managers.length > 0 ? managers : rows).map((r) => r.email);
}

export function canSubmitTrip(trip: Pick<TripDetail, "user_id" | "status">, viewer: TripViewer): boolean {
  return trip.user_id === viewer.id && (trip.status === "draft" || trip.status === "rejected");
}

export function canDecideTrip(trip: Pick<TripDetail, "user_id" | "status">, viewer: TripViewer): boolean {
  return isApprover(viewer) && trip.user_id !== viewer.id && trip.status === "pending_approval";
}

function tripSummary(trip: TripDetail): string {
  return [
    `Conference: ${trip.conference_name}`,
    `Dates: ${formatDateRange(trip.conference_start, trip.conference_end)}`,
    `Where: ${[trip.conference_city, trip.conference_country].filter(Boolean).join(", ") || "TBC"}`,
    `Estimated cost: ${formatMoney(tripEstimateTotal(trip), trip.currency)}`,
  ].join("\n");
}

/** Doctor submits (or resubmits) their trip for approval and the approvers are emailed. */
export async function submitTripForApproval(
  tripId: number,
  viewer: TripViewer,
  mailer: Mailer,
  db: DatabaseSync = getDb(),
): Promise<TripDetail> {
  const trip = getTripForViewer(tripId, viewer, db);
  if (!trip || !canSubmitTrip(trip, viewer)) throw new ApprovalError("You can't submit this trip.");
  if (tripEstimateTotal(trip) <= 0) throw new ApprovalError("Add your estimated costs before submitting.");
  transitionTrip(tripId, "pending_approval", { orgId: trip.org_id }, db);
  const to = approverEmails(trip.org_id, db);
  const resubmitted = trip.status === "rejected";
  for (const addr of to) {
    await mailer.send({
      orgId: trip.org_id,
      to: addr,
      subject: `${resubmitted ? "Resubmitted" : "Approval needed"}: ${trip.owner_name} – ${trip.conference_name}`,
      text: [
        `${trip.owner_name} has ${resubmitted ? "resubmitted" : "submitted"} a study-leave trip for approval.`,
        "",
        tripSummary(trip),
        trip.notes ? `Notes: ${trip.notes}` : "",
        "",
        `Review it: ${appUrl("/approvals")}`,
      ]
        .filter((l, i, a) => l !== "" || a[i - 1] !== "")
        .join("\n"),
    });
  }
  return getTripForViewer(tripId, viewer, db)!;
}

export type Decision = "approved" | "rejected";

/** Manager approves or rejects a pending trip; the doctor is emailed with the comment. */
export async function decideTrip(
  tripId: number,
  viewer: TripViewer,
  decision: Decision,
  comment: string,
  mailer: Mailer,
  db: DatabaseSync = getDb(),
): Promise<TripDetail> {
  if (decision !== "approved" && decision !== "rejected") throw new ApprovalError("Unknown decision.");
  const text = comment.trim();
  if (text.length > MAX_COMMENT_LENGTH) throw new ApprovalError("The comment is too long.");
  if (decision === "rejected" && !text) throw new ApprovalError("Please say why you're rejecting this trip.");
  const trip = isApprover(viewer) ? getTripForViewer(tripId, viewer, db) : undefined;
  if (!trip) throw new ApprovalError("Trip not found.");
  if (trip.user_id === viewer.id) throw new ApprovalError("You can't approve your own trip.");
  if (trip.status !== "pending_approval") throw new ApprovalError("This trip is no longer awaiting approval.");
  transitionTrip(tripId, decision, { orgId: trip.org_id, managerComment: text || null }, db);

  const owner = db.prepare("SELECT email FROM users WHERE id = ?").get(trip.user_id) as { email: string };
  const word = decision === "approved" ? "approved" : "not approved";
  await mailer.send({
    orgId: trip.org_id,
    to: owner.email,
    subject: `Trip ${decision === "approved" ? "approved" : "rejected"}: ${trip.conference_name}`,
    text: [
      `Hi ${trip.owner_name},`,
      "",
      `Your trip to ${trip.conference_name} was ${word} by ${viewerName(viewer, db)}.`,
      text ? `Comment: ${text}` : "",
      decision === "rejected" ? "You can change the plan and submit it again." : "You can now book flights and a hotel.",
      "",
      `Open your trip: ${appUrl(`/trips/${trip.id}`)}`,
    ]
      .filter((l, i, a) => l !== "" || a[i - 1] !== "")
      .join("\n"),
  });
  return getTripForViewer(tripId, viewer, db)!;
}

function viewerName(viewer: TripViewer, db: DatabaseSync): string {
  const row = db.prepare("SELECT name FROM users WHERE id = ?").get(viewer.id) as { name: string } | undefined;
  return row?.name ?? "your manager";
}

export interface PendingApproval {
  trip: TripDetail;
  estimateCents: number;
  year: number;
  /** Doctor's remaining budget for the trip's year (pending trips aren't deducted yet). */
  remainingCents: number;
  /** What would be left if this trip were approved. */
  remainingAfterCents: number;
}

/** Trips awaiting approval in the approver's org, oldest first, with the doctor's budget. */
export function listPendingApprovals(viewer: TripViewer, db: DatabaseSync = getDb()): PendingApproval[] {
  if (!isApprover(viewer) || viewer.org_id == null) return [];
  const ids = db
    .prepare("SELECT id FROM trips WHERE org_id = ? AND status = 'pending_approval' ORDER BY updated_at, id")
    .all(viewer.org_id) as { id: number }[];
  return ids
    .map((r) => getTripForViewer(r.id, viewer, db))
    .filter((t): t is TripDetail => !!t)
    .map((trip) => {
      const year = tripYear(trip.conference_start);
      const budget = getBudget({ id: trip.user_id, org_id: trip.org_id }, year, db);
      const estimateCents = tripEstimateTotal(trip);
      return {
        trip,
        estimateCents,
        year,
        remainingCents: budget.remainingCents,
        remainingAfterCents: budget.remainingCents - estimateCents,
      };
    });
}
