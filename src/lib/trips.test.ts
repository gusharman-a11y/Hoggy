import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { closeDb, getDb } from "@/db";
import { seedConferences } from "@/db/seed";
import { createOrg, createUser } from "./users";
import {
  TRIP_STATUSES,
  TRIP_TRANSITIONS,
  TripTransitionError,
  assertTransition,
  canTransition,
  createTrip,
  getTrip,
  isTripStatus,
  transitionTrip,
  tripEstimateTotal,
  type TripStatus,
} from "./trips";

const ALLOWED: [TripStatus, TripStatus][] = [
  ["draft", "pending_approval"],
  ["pending_approval", "approved"],
  ["pending_approval", "rejected"],
  ["pending_approval", "draft"],
  ["rejected", "draft"],
  ["rejected", "pending_approval"],
  ["approved", "booked"],
  ["booked", "claimed"],
  ["claimed", "paid"],
];

describe("trip status transitions", () => {
  it("allows exactly the listed moves", () => {
    const key = (a: string, b: string) => `${a}>${b}`;
    const allowed = new Set(ALLOWED.map(([a, b]) => key(a, b)));
    for (const from of TRIP_STATUSES) {
      for (const to of TRIP_STATUSES) {
        expect(canTransition(from, to), key(from, to)).toBe(allowed.has(key(from, to)));
      }
    }
  });

  it.each([
    ["draft", "approved"],
    ["draft", "booked"],
    ["pending_approval", "booked"],
    ["rejected", "approved"],
    ["approved", "rejected"],
    ["approved", "claimed"],
    ["booked", "paid"],
    ["paid", "draft"],
    ["claimed", "booked"],
    ["draft", "draft"],
  ] as [TripStatus, TripStatus][])("forbids %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(TripTransitionError);
  });

  it("paid is terminal and every status has a transition list", () => {
    expect(TRIP_TRANSITIONS.paid).toEqual([]);
    expect(Object.keys(TRIP_TRANSITIONS).sort()).toEqual([...TRIP_STATUSES].sort());
    expect(isTripStatus("booked")).toBe(true);
    expect(isTripStatus("cancelled")).toBe(false);
  });
});

describe("trips table", () => {
  let db: DatabaseSync;
  let orgId: number;
  let userId: number;
  let conferenceId: number;
  beforeEach(() => {
    db = getDb(":memory:");
    seedConferences(db);
    orgId = createOrg(db, { name: "Test Hospital", financeEmail: "fin@test.example" }).id;
    userId = createUser(db, { orgId, email: "doc@test.example", name: "Dr Doc", password: "pw123456", role: "doctor" }).id;
    conferenceId = (db.prepare("SELECT id FROM conferences LIMIT 1").get() as { id: number }).id;
  });
  afterEach(() => closeDb());

  it("has the PRD columns", () => {
    const cols = (db.prepare("PRAGMA table_info(trips)").all() as { name: string }[]).map((c) => c.name);
    expect(cols).toEqual([
      "id",
      "org_id",
      "user_id",
      "conference_id",
      "status",
      "depart_city",
      "notes",
      "est_registration_cents",
      "est_flights_cents",
      "est_hotel_cents",
      "est_other_cents",
      "currency",
      "manager_comment",
      "created_at",
      "updated_at",
      "inbound_code",
    ]);
  });

  it("creates a draft trip with estimates and an AUD default", () => {
    const t = createTrip({ orgId, userId, conferenceId, departCity: "Sydney", estRegistrationCents: 95000, estFlightsCents: 40000 }, db);
    expect(t.status).toBe("draft");
    expect(t.currency).toBe("AUD");
    expect(t.depart_city).toBe("Sydney");
    expect(tripEstimateTotal(t)).toBe(135000);
  });

  it("rejects unknown statuses at the DB level", () => {
    const t = createTrip({ orgId, userId, conferenceId }, db);
    expect(() => db.prepare("UPDATE trips SET status = 'cancelled' WHERE id = ?").run(t.id)).toThrow();
  });

  it("walks the happy path and records the manager comment", () => {
    const t = createTrip({ orgId, userId, conferenceId }, db);
    transitionTrip(t.id, "pending_approval", {}, db);
    const approved = transitionTrip(t.id, "approved", { orgId, managerComment: "Enjoy" }, db);
    expect(approved.status).toBe("approved");
    expect(approved.manager_comment).toBe("Enjoy");
    expect(approved.updated_at >= t.updated_at).toBe(true);
    transitionTrip(t.id, "booked", {}, db);
    transitionTrip(t.id, "claimed", {}, db);
    const paid = transitionTrip(t.id, "paid", {}, db);
    expect(paid.status).toBe("paid");
    expect(paid.manager_comment).toBe("Enjoy");
  });

  it("supports reject then resubmit", () => {
    const t = createTrip({ orgId, userId, conferenceId }, db);
    transitionTrip(t.id, "pending_approval", {}, db);
    expect(transitionTrip(t.id, "rejected", { managerComment: "Too pricey" }, db).manager_comment).toBe("Too pricey");
    expect(transitionTrip(t.id, "pending_approval", {}, db).status).toBe("pending_approval");
  });

  it("refuses forbidden moves and leaves the trip unchanged", () => {
    const t = createTrip({ orgId, userId, conferenceId }, db);
    expect(() => transitionTrip(t.id, "booked", {}, db)).toThrow(TripTransitionError);
    expect(() => transitionTrip(t.id, "approved", {}, db)).toThrow(/draft to approved/);
    expect(getTrip(t.id, db)!.status).toBe("draft");
  });

  it("scopes lookups and transitions by org", () => {
    const other = createOrg(db, { name: "Other", financeEmail: "o@test.example" }).id;
    const t = createTrip({ orgId, userId, conferenceId }, db);
    expect(getTrip(t.id, db, other)).toBeUndefined();
    expect(getTrip(t.id, db, orgId)?.id).toBe(t.id);
    expect(() => transitionTrip(t.id, "pending_approval", { orgId: other }, db)).toThrow(/not found/);
    expect(getTrip(t.id, db)!.status).toBe("draft");
  });
});
