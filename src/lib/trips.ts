import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/db";

export const TRIP_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "booked",
  "claimed",
  "paid",
] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

/**
 * Allowed status moves. Anything not listed is forbidden.
 * - draft -> pending_approval (doctor submits)
 * - pending_approval -> approved | rejected (manager decides) | draft (doctor withdraws)
 * - rejected -> draft (doctor edits) | pending_approval (doctor resubmits)
 * - approved -> booked (first flight/hotel booking)
 * - booked -> claimed (claim pack sent to finance)
 * - claimed -> paid (finance reimburses)
 */
export const TRIP_TRANSITIONS: Record<TripStatus, readonly TripStatus[]> = {
  draft: ["pending_approval"],
  pending_approval: ["approved", "rejected", "draft"],
  rejected: ["draft", "pending_approval"],
  approved: ["booked"],
  booked: ["claimed"],
  claimed: ["paid"],
  paid: [],
};

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  draft: "Draft",
  pending_approval: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
  booked: "Booked",
  claimed: "Claimed",
  paid: "Paid",
};

/** Statuses in which the doctor may still edit the plan (city, notes, estimates). */
export const EDITABLE_STATUSES: readonly TripStatus[] = ["draft", "rejected"];

export function isTripStatus(s: unknown): s is TripStatus {
  return typeof s === "string" && (TRIP_STATUSES as readonly string[]).includes(s);
}

export function canTransition(from: TripStatus, to: TripStatus): boolean {
  return TRIP_TRANSITIONS[from].includes(to);
}

export class TripTransitionError extends Error {
  constructor(
    public readonly from: TripStatus,
    public readonly to: TripStatus,
  ) {
    super(`A trip cannot go from ${from} to ${to}`);
    this.name = "TripTransitionError";
  }
}

/** Throws TripTransitionError unless from -> to is allowed. */
export function assertTransition(from: TripStatus, to: TripStatus): void {
  if (!canTransition(from, to)) throw new TripTransitionError(from, to);
}

export interface Trip {
  id: number;
  org_id: number;
  user_id: number;
  conference_id: number;
  status: TripStatus;
  depart_city: string | null;
  notes: string | null;
  est_registration_cents: number;
  est_flights_cents: number;
  est_hotel_cents: number;
  est_other_cents: number;
  currency: string;
  manager_comment: string | null;
  created_at: string;
  updated_at: string;
}

const COLS =
  "id, org_id, user_id, conference_id, status, depart_city, notes, est_registration_cents, est_flights_cents, est_hotel_cents, est_other_cents, currency, manager_comment, created_at, updated_at";
const NOW = "strftime('%Y-%m-%d %H:%M:%f', 'now')";

export function tripEstimateTotal(
  t: Pick<Trip, "est_registration_cents" | "est_flights_cents" | "est_hotel_cents" | "est_other_cents">,
): number {
  return t.est_registration_cents + t.est_flights_cents + t.est_hotel_cents + t.est_other_cents;
}

export interface NewTrip {
  orgId: number;
  userId: number;
  conferenceId: number;
  departCity?: string | null;
  notes?: string | null;
  estRegistrationCents?: number;
  estFlightsCents?: number;
  estHotelCents?: number;
  estOtherCents?: number;
  currency?: string;
}

/** Creates a draft trip. */
export function createTrip(input: NewTrip, db: DatabaseSync = getDb()): Trip {
  const res = db
    .prepare(
      `INSERT INTO trips (org_id, user_id, conference_id, depart_city, notes, est_registration_cents,
         est_flights_cents, est_hotel_cents, est_other_cents, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.orgId,
      input.userId,
      input.conferenceId,
      input.departCity ?? null,
      input.notes ?? null,
      input.estRegistrationCents ?? 0,
      input.estFlightsCents ?? 0,
      input.estHotelCents ?? 0,
      input.estOtherCents ?? 0,
      input.currency ?? "AUD",
    );
  return getTrip(Number(res.lastInsertRowid), db)!;
}

/** Fetches a trip by id. Pass orgId to scope the lookup to one hospital. */
export function getTrip(id: number, db: DatabaseSync = getDb(), orgId?: number): Trip | undefined {
  const row =
    orgId === undefined
      ? db.prepare(`SELECT ${COLS} FROM trips WHERE id = ?`).get(id)
      : db.prepare(`SELECT ${COLS} FROM trips WHERE id = ? AND org_id = ?`).get(id, orgId);
  return row as Trip | undefined;
}

/**
 * Moves a trip to a new status, enforcing TRIP_TRANSITIONS. Optionally sets
 * manager_comment (e.g. on approve/reject). Returns the updated trip.
 * Uses a conditional UPDATE so a concurrent change can't skip a check.
 */
export function transitionTrip(
  id: number,
  to: TripStatus,
  opts: { orgId?: number; managerComment?: string | null } = {},
  db: DatabaseSync = getDb(),
): Trip {
  const trip = getTrip(id, db, opts.orgId);
  if (!trip) throw new Error(`Trip ${id} not found`);
  assertTransition(trip.status, to);
  const setComment = opts.managerComment !== undefined;
  const res = db
    .prepare(
      `UPDATE trips SET status = ?, updated_at = ${NOW}${setComment ? ", manager_comment = ?" : ""}
       WHERE id = ? AND status = ?`,
    )
    .run(...(setComment ? [to, opts.managerComment ?? null, id, trip.status] : [to, id, trip.status]));
  if (Number(res.changes) !== 1) throw new TripTransitionError(trip.status, to);
  return getTrip(id, db)!;
}
