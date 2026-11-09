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
  /** Random code for the trip's inbound email address (trip-<code>@in.studyleave.app). */
  inbound_code: string;
  created_at: string;
  updated_at: string;
}

const COLS =
  "id, org_id, user_id, conference_id, status, depart_city, notes, est_registration_cents, est_flights_cents, est_hotel_cents, est_other_cents, currency, manager_comment, inbound_code, created_at, updated_at";
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

// ---------------------------------------------------------------------------
// Access rules (US-010). Every trip read for a page goes through these.
// - A user only ever sees trips in their own org.
// - Doctors see only their own trips; manager/finance/admin see the whole org.
// - Only the trip's owner may edit it, and only while EDITABLE_STATUSES.

/** The minimal user shape the access rules need (matches User from ./users). */
export interface TripViewer {
  id: number;
  org_id: number | null;
  role: "doctor" | "manager" | "finance" | "admin";
}

export function canViewTrip(trip: Pick<Trip, "org_id" | "user_id">, viewer: TripViewer): boolean {
  if (viewer.org_id == null || trip.org_id !== viewer.org_id) return false;
  return viewer.role === "doctor" ? trip.user_id === viewer.id : true;
}

export function canEditTrip(trip: Pick<Trip, "org_id" | "user_id" | "status">, viewer: TripViewer): boolean {
  return (
    viewer.org_id != null &&
    trip.org_id === viewer.org_id &&
    trip.user_id === viewer.id &&
    EDITABLE_STATUSES.includes(trip.status)
  );
}

/** A trip joined with what pages need to show about its conference and owner. */
export interface TripDetail extends Trip {
  conference_slug: string;
  conference_name: string;
  conference_start: string;
  conference_end: string;
  conference_city: string;
  conference_country: string;
  conference_venue: string | null;
  conference_fee_cents: number | null;
  conference_currency: string;
  owner_name: string;
}

const DETAIL_SQL = `SELECT ${COLS
  .split(", ")
  .map((c) => `t.${c}`)
  .join(", ")},
  c.slug AS conference_slug, c.name AS conference_name, c.start_date AS conference_start,
  c.end_date AS conference_end, c.city AS conference_city, c.country AS conference_country,
  c.venue AS conference_venue,
  c.registration_fee_cents AS conference_fee_cents, c.currency AS conference_currency,
  u.name AS owner_name
  FROM trips t JOIN conferences c ON c.id = t.conference_id JOIN users u ON u.id = t.user_id`;

/** The trip if this viewer may see it, else undefined (callers 404 either way, so ids don't leak). */
export function getTripForViewer(id: number, viewer: TripViewer, db: DatabaseSync = getDb()): TripDetail | undefined {
  if (viewer.org_id == null) return undefined;
  const row = db.prepare(`${DETAIL_SQL} WHERE t.id = ? AND t.org_id = ?`).get(id, viewer.org_id) as
    | TripDetail
    | undefined;
  return row && canViewTrip(row, viewer) ? row : undefined;
}

/** Trips this viewer may see, newest first: a doctor's own, or the whole org for other roles. */
export function listTripsForViewer(viewer: TripViewer, db: DatabaseSync = getDb()): TripDetail[] {
  if (viewer.org_id == null) return [];
  const rows =
    viewer.role === "doctor"
      ? db.prepare(`${DETAIL_SQL} WHERE t.org_id = ? AND t.user_id = ? ORDER BY t.id DESC`).all(viewer.org_id, viewer.id)
      : db.prepare(`${DETAIL_SQL} WHERE t.org_id = ? ORDER BY t.id DESC`).all(viewer.org_id);
  return rows as unknown as TripDetail[];
}

/**
 * "Plan trip": returns the viewer's existing draft for this conference, or creates one with
 * the registration estimate prefilled (registrationCents, already converted to the trip currency).
 * Reusing the draft means a double click or a reload never makes duplicate trips.
 */
export function findOrCreateDraftTrip(
  viewer: TripViewer,
  conferenceId: number,
  registrationCents: number,
  db: DatabaseSync = getDb(),
): { trip: Trip; created: boolean } {
  if (viewer.org_id == null) throw new Error("You need to join a hospital before planning a trip");
  const existing = db
    .prepare(
      `SELECT ${COLS} FROM trips WHERE org_id = ? AND user_id = ? AND conference_id = ? AND status = 'draft'
       ORDER BY id DESC LIMIT 1`,
    )
    .get(viewer.org_id, viewer.id, conferenceId) as Trip | undefined;
  if (existing) return { trip: existing, created: false };
  const trip = createTrip(
    { orgId: viewer.org_id, userId: viewer.id, conferenceId, estRegistrationCents: registrationCents },
    db,
  );
  return { trip, created: true };
}

export interface TripPlanFields {
  departCity: string | null;
  notes: string | null;
  estRegistrationCents: number;
  estFlightsCents: number;
  estHotelCents: number;
  estOtherCents: number;
}

/** Saves the doctor's plan. Throws unless canEditTrip. */
export function updateTripPlan(
  id: number,
  viewer: TripViewer,
  fields: TripPlanFields,
  db: DatabaseSync = getDb(),
): Trip {
  const trip = viewer.org_id == null ? undefined : getTrip(id, db, viewer.org_id);
  if (!trip || !canEditTrip(trip, viewer)) throw new Error("You can't edit this trip");
  db.prepare(
    `UPDATE trips SET depart_city = ?, notes = ?, est_registration_cents = ?, est_flights_cents = ?,
       est_hotel_cents = ?, est_other_cents = ?, updated_at = ${NOW}
     WHERE id = ? AND status = ?`,
  ).run(
    fields.departCity,
    fields.notes,
    fields.estRegistrationCents,
    fields.estFlightsCents,
    fields.estHotelCents,
    fields.estOtherCents,
    id,
    trip.status,
  );
  return getTrip(id, db)!;
}
