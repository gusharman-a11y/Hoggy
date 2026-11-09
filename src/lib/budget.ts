import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/db";
import { tripEstimateTotal, type Trip, type TripStatus, type TripViewer } from "./trips";

/**
 * Study budget for one doctor and one calendar year (the year a trip's conference starts).
 * - allowance: budgets row for that year, else the hospital's default allowance
 * - committed: approved/booked trips, at their estimated cost
 * - spent: claimed/paid trips, at their actual receipt total (estimate if no receipts yet)
 * - pending: trips awaiting approval (shown for information, not taken off remaining)
 * - remaining = allowance - committed - spent (can go negative)
 */
export interface Budget {
  year: number;
  allowanceCents: number;
  committedCents: number;
  spentCents: number;
  pendingCents: number;
  remainingCents: number;
}

export const COMMITTED_STATUSES: readonly TripStatus[] = ["approved", "booked"];
export const SPENT_STATUSES: readonly TripStatus[] = ["claimed", "paid"];

/** What the calculation needs about each trip. actualCents = sum of receipts (null when none). */
export interface BudgetTrip {
  status: TripStatus;
  estimateCents: number;
  actualCents: number | null;
}

/** Pure budget calculation over a doctor's trips for the year. */
export function calculateBudget(year: number, allowanceCents: number, trips: readonly BudgetTrip[]): Budget {
  let committed = 0;
  let spent = 0;
  let pending = 0;
  for (const t of trips) {
    if (COMMITTED_STATUSES.includes(t.status)) committed += t.estimateCents;
    else if (SPENT_STATUSES.includes(t.status)) spent += t.actualCents ?? t.estimateCents;
    else if (t.status === "pending_approval") pending += t.estimateCents;
  }
  return {
    year,
    allowanceCents,
    committedCents: committed,
    spentCents: spent,
    pendingCents: pending,
    remainingCents: allowanceCents - committed - spent,
  };
}

/** The year whose budget a trip counts against: its conference's start year. */
export function tripYear(conferenceStart: string): number {
  return Number(conferenceStart.slice(0, 4));
}

/**
 * Which year the dashboard opens on: the current year if the doctor has a trip in it,
 * else their next year with a trip, else the current year.
 */
export function defaultBudgetYear(tripYears: readonly number[], currentYear: number): number {
  const upcoming = tripYears.filter((y) => y >= currentYear).sort((a, b) => a - b);
  return upcoming[0] ?? currentYear;
}

export function getAllowanceCents(db: DatabaseSync, userId: number, year: number): number {
  const row = db
    .prepare(
      `SELECT COALESCE(b.allowance_cents, o.default_allowance_cents, 0) AS cents
       FROM users u LEFT JOIN orgs o ON o.id = u.org_id
       LEFT JOIN budgets b ON b.user_id = u.id AND b.year = ?
       WHERE u.id = ?`,
    )
    .get(year, userId) as { cents: number } | undefined;
  return row?.cents ?? 0;
}

/** Sets (or replaces) a doctor's allowance for a year. The doctor must be in orgId. */
export function setAllowance(
  db: DatabaseSync,
  input: { orgId: number; userId: number; year: number; allowanceCents: number },
): void {
  if (!Number.isInteger(input.allowanceCents) || input.allowanceCents < 0) throw new Error("Invalid allowance");
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) throw new Error("Invalid year");
  const member = db.prepare("SELECT 1 FROM users WHERE id = ? AND org_id = ?").get(input.userId, input.orgId);
  if (!member) throw new Error("User not found");
  db.prepare(
    `INSERT INTO budgets (org_id, user_id, year, allowance_cents) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, year) DO UPDATE SET allowance_cents = excluded.allowance_cents, org_id = excluded.org_id`,
  ).run(input.orgId, input.userId, input.year, input.allowanceCents);
}

export function setOrgDefaultAllowance(db: DatabaseSync, orgId: number, cents: number): void {
  db.prepare("UPDATE orgs SET default_allowance_cents = ? WHERE id = ?").run(cents, orgId);
}

type EstimateCols = Pick<
  Trip,
  "id" | "status" | "est_registration_cents" | "est_flights_cents" | "est_hotel_cents" | "est_other_cents"
>;

/** The doctor's trips (in their org) whose conference starts in `year`, as calculation inputs. */
export function budgetTrips(db: DatabaseSync, userId: number, orgId: number, year: number): BudgetTrip[] {
  const rows = db
    .prepare(
      `SELECT t.id, t.status, t.est_registration_cents, t.est_flights_cents, t.est_hotel_cents, t.est_other_cents
       FROM trips t JOIN conferences c ON c.id = t.conference_id
       WHERE t.user_id = ? AND t.org_id = ? AND substr(c.start_date, 1, 4) = ?`,
    )
    .all(userId, orgId, String(year)) as unknown as EstimateCols[];
  // Spent uses the trip's receipt total; a trip with no receipts falls back to its estimate.
  const actual = new Map<number, number>();
  if (rows.length > 0) {
    const sums = db
      .prepare(
        `SELECT trip_id, SUM(amount_cents) AS cents, COUNT(*) AS n FROM receipts
         WHERE trip_id IN (${rows.map(() => "?").join(",")}) GROUP BY trip_id`,
      )
      .all(...rows.map((r) => r.id)) as { trip_id: number; cents: number; n: number }[];
    for (const s of sums) if (s.n > 0) actual.set(s.trip_id, s.cents);
  }
  return rows.map((r) => ({
    status: r.status,
    estimateCents: tripEstimateTotal(r),
    actualCents: actual.get(r.id) ?? null,
  }));
}

/** A doctor's budget for a year. */
export function getBudget(
  user: Pick<TripViewer, "id" | "org_id">,
  year: number,
  db: DatabaseSync = getDb(),
): Budget {
  const allowance = getAllowanceCents(db, user.id, year);
  const trips = user.org_id == null ? [] : budgetTrips(db, user.id, user.org_id, year);
  return calculateBudget(year, allowance, trips);
}

/** Years (conference start years) in which the user has trips. */
export function tripYearsForUser(db: DatabaseSync, userId: number): number[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT CAST(substr(c.start_date, 1, 4) AS INTEGER) AS y
       FROM trips t JOIN conferences c ON c.id = t.conference_id WHERE t.user_id = ? ORDER BY y`,
    )
    .all(userId) as { y: number }[];
  return rows.map((r) => r.y);
}

export interface TeamBudgetRow extends Budget {
  userId: number;
  name: string;
  email: string;
  hasOwnAllowance: boolean;
}

/** Every doctor in the org with their budget for the year (for /team). */
export function teamBudgets(orgId: number, year: number, db: DatabaseSync = getDb()): TeamBudgetRow[] {
  const doctors = db
    .prepare(
      `SELECT u.id, u.name, u.email, b.id AS budget_id FROM users u
       LEFT JOIN budgets b ON b.user_id = u.id AND b.year = ?
       WHERE u.org_id = ? AND u.role = 'doctor' ORDER BY u.name, u.id`,
    )
    .all(year, orgId) as { id: number; name: string; email: string; budget_id: number | null }[];
  return doctors.map((d) => ({
    ...getBudget({ id: d.id, org_id: orgId }, year, db),
    userId: d.id,
    name: d.name,
    email: d.email,
    hasOwnAllowance: d.budget_id != null,
  }));
}
