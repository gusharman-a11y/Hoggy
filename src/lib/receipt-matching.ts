/**
 * Which of a doctor's trips does a receipt belong to? Used for mail sent to the
 * personal Hoggy inbox (inbox-<code>@in.studyleave.app).
 *
 * Rules (pure scoring over the doctor's open trips — not claimed or paid):
 * - Date: a receipt dated inside the conference dates scores 3; inside the travel
 *   window scores 2. The window is 1 day either side, or for bookings (flight,
 *   accommodation, registration) from 30 days before the start. A dated receipt
 *   outside a trip's window never matches that trip.
 * - Place: the conference city, venue or name in the supplier / email / receipt
 *   text scores 2.
 * Best score wins; nothing above 0 = no match; a tie at the top = ambiguous.
 * No match and ambiguous both go to the doctor's Unfiled receipts.
 */
import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/db";
import type { ReadKind } from "@/providers/receipt-reader";
import { RECEIPT_LOCKED_STATUSES } from "./receipt-uploads";
import type { TripStatus } from "./trips";

/** Kinds that are often paid well before the conference. */
export const BOOKING_READ_KINDS: readonly ReadKind[] = ["flight", "accommodation", "registration"];
export const BOOKING_LEAD_DAYS = 30;
export const TRAVEL_SLACK_DAYS = 1;

export interface MatchInput {
  /** YYYY-MM-DD, or null when the receipt has no readable date. */
  date: string | null;
  kind: ReadKind;
  supplierName: string | null;
  /** Anything else to look for place names in: email subject/body, receipt text. */
  text?: string;
}

export interface MatchCandidate {
  id: number;
  status: TripStatus;
  start_date: string;
  end_date: string;
  city: string;
  venue: string | null;
  conference_name: string;
}

export type MatchResult =
  | { kind: "matched"; tripId: number; score: number }
  | { kind: "none" }
  | { kind: "ambiguous"; tripIds: number[] };

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word, case-insensitive. Ignores very short names so "A" or "" never match. */
function mentions(haystack: string, needle: string | null | undefined): boolean {
  const n = needle
    ?.replace(/\bSAMPLE\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, "");
  if (!n || n.length < 3) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(n)}($|[^\\p{L}\\p{N}])`, "iu").test(haystack);
}

/** How well one receipt fits one trip; -1 = cannot be this trip. */
export function scoreTrip(trip: MatchCandidate, input: MatchInput): number {
  let score = 0;
  if (input.date) {
    const lead = BOOKING_READ_KINDS.includes(input.kind) ? BOOKING_LEAD_DAYS : TRAVEL_SLACK_DAYS;
    const from = shiftDate(trip.start_date, -lead);
    const to = shiftDate(trip.end_date, TRAVEL_SLACK_DAYS);
    if (input.date < from || input.date > to) return -1;
    score += input.date >= trip.start_date && input.date <= trip.end_date ? 3 : 2;
  }
  const haystack = `${input.supplierName ?? ""}\n${input.text ?? ""}`;
  // The conference name without its year, e.g. "SAMPLE Cardiology Congress 2027" -> "Cardiology Congress".
  const confName = trip.conference_name.replace(/\b(19|20)\d{2}\b/g, "");
  if (mentions(haystack, trip.city) || mentions(haystack, trip.venue) || mentions(haystack, confName)) score += 2;
  return score;
}

/** Pure: picks the best-fitting trip from candidates. */
export function pickTrip(candidates: readonly MatchCandidate[], input: MatchInput): MatchResult {
  let best = 0;
  let top: number[] = [];
  for (const t of candidates) {
    if (RECEIPT_LOCKED_STATUSES.includes(t.status)) continue;
    const s = scoreTrip(t, input);
    if (s <= 0) continue;
    if (s > best) {
      best = s;
      top = [t.id];
    } else if (s === best) top.push(t.id);
  }
  if (top.length === 0) return { kind: "none" };
  if (top.length > 1) return { kind: "ambiguous", tripIds: top };
  return { kind: "matched", tripId: top[0], score: best };
}

/** The doctor's trips that can still take receipts, with their conference dates and place. */
export function listMatchCandidates(user: { id: number; org_id: number | null }, db: DatabaseSync = getDb()): MatchCandidate[] {
  if (user.org_id == null) return [];
  return db
    .prepare(
      `SELECT t.id, t.status, c.start_date, c.end_date, c.city, c.venue, c.name AS conference_name
       FROM trips t JOIN conferences c ON c.id = t.conference_id
       WHERE t.user_id = ? AND t.org_id = ? AND t.status NOT IN ('claimed', 'paid')
       ORDER BY c.start_date, t.id`,
    )
    .all(user.id, user.org_id) as unknown as MatchCandidate[];
}

/** Picks the doctor's trip whose dates and city/supplier best fit what was read off the receipt. */
export function matchTrip(
  user: { id: number; org_id: number | null },
  extracted: MatchInput,
  db: DatabaseSync = getDb(),
): MatchResult {
  return pickTrip(listMatchCandidates(user, db), extracted);
}
