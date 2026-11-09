import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { closeDb, getDb } from "@/db";
import { seedConferences } from "@/db/seed";
import { createOrg, createUser, type User } from "./users";
import { toAudCents } from "./fx";
import {
  canEditTrip,
  canViewTrip,
  findOrCreateDraftTrip,
  getTripForViewer,
  listTripsForViewer,
  transitionTrip,
  updateTripPlan,
} from "./trips";

describe("trip access", () => {
  let db: DatabaseSync;
  let doc: User, doc2: User, manager: User, finance: User, outsider: User, outsiderManager: User;
  let confA: number, confB: number;

  beforeEach(() => {
    db = getDb(":memory:");
    seedConferences(db);
    const org = createOrg(db, { name: "A Hospital", financeEmail: "fin@a.example" }).id;
    const other = createOrg(db, { name: "B Hospital", financeEmail: "fin@b.example" }).id;
    const mk = (orgId: number, email: string, role: User["role"]) =>
      createUser(db, { orgId, email, name: email, password: "pw123456", role });
    doc = mk(org, "doc@a.example", "doctor");
    doc2 = mk(org, "doc2@a.example", "doctor");
    manager = mk(org, "mgr@a.example", "manager");
    finance = mk(org, "fin@a.example", "finance");
    outsider = mk(other, "doc@b.example", "doctor");
    outsiderManager = mk(other, "mgr@b.example", "manager");
    const ids = db.prepare("SELECT id FROM conferences ORDER BY id LIMIT 2").all() as { id: number }[];
    [confA, confB] = ids.map((r) => r.id);
  });
  afterEach(() => closeDb());

  it("Plan trip creates a draft with the registration prefilled, and reuses it on repeat", () => {
    const first = findOrCreateDraftTrip(doc, confA, 95000, db);
    expect(first.created).toBe(true);
    expect(first.trip.status).toBe("draft");
    expect(first.trip.est_registration_cents).toBe(95000);
    expect(first.trip.org_id).toBe(doc.org_id);
    const again = findOrCreateDraftTrip(doc, confA, 95000, db);
    expect(again.created).toBe(false);
    expect(again.trip.id).toBe(first.trip.id);
    // a different doctor, or a non-draft trip, gets a new draft
    expect(findOrCreateDraftTrip(doc2, confA, 0, db).trip.id).not.toBe(first.trip.id);
    transitionTrip(first.trip.id, "pending_approval", {}, db);
    expect(findOrCreateDraftTrip(doc, confA, 0, db).created).toBe(true);
  });

  it("doctors see only their own trips; other roles see the org; nobody sees another org", () => {
    const mine = findOrCreateDraftTrip(doc, confA, 0, db).trip;
    const theirs = findOrCreateDraftTrip(doc2, confB, 0, db).trip;
    const foreign = findOrCreateDraftTrip(outsider, confA, 0, db).trip;

    expect(listTripsForViewer(doc, db).map((t) => t.id)).toEqual([mine.id]);
    expect(listTripsForViewer(manager, db).map((t) => t.id)).toEqual([theirs.id, mine.id]);
    expect(listTripsForViewer(finance, db)).toHaveLength(2);
    expect(listTripsForViewer(outsiderManager, db).map((t) => t.id)).toEqual([foreign.id]);

    expect(getTripForViewer(mine.id, doc, db)?.conference_name).toBeTruthy();
    expect(getTripForViewer(theirs.id, doc, db)).toBeUndefined();
    expect(getTripForViewer(mine.id, manager, db)?.owner_name).toBe("doc@a.example");
    expect(getTripForViewer(mine.id, outsiderManager, db)).toBeUndefined();
    expect(getTripForViewer(foreign.id, manager, db)).toBeUndefined();
    expect(canViewTrip(mine, { ...doc, org_id: null })).toBe(false);
  });

  it("only the owner edits, and only in draft/rejected", () => {
    const t = findOrCreateDraftTrip(doc, confA, 0, db).trip;
    const fields = {
      departCity: "Sydney",
      notes: "Poster",
      estRegistrationCents: 100000,
      estFlightsCents: 150000,
      estHotelCents: 80000,
      estOtherCents: 2550,
    };
    const saved = updateTripPlan(t.id, doc, fields, db);
    expect(saved.depart_city).toBe("Sydney");
    expect(saved.est_other_cents).toBe(2550);
    expect(canEditTrip(saved, manager)).toBe(false);
    expect(() => updateTripPlan(t.id, manager, fields, db)).toThrow();
    expect(() => updateTripPlan(t.id, outsider, fields, db)).toThrow();
    const pending = transitionTrip(t.id, "pending_approval", {}, db);
    expect(canEditTrip(pending, doc)).toBe(false);
    expect(() => updateTripPlan(t.id, doc, fields, db)).toThrow();
    const rejected = transitionTrip(t.id, "rejected", {}, db);
    expect(canEditTrip(rejected, doc)).toBe(true);
  });
});

describe("toAudCents", () => {
  it("keeps AUD, converts known currencies, refuses unknown ones", () => {
    expect(toAudCents(95000, "AUD")).toBe(95000);
    expect(toAudCents(89000, "GBP")).toBe(173550);
    expect(toAudCents(100, "XXX")).toBeUndefined();
  });
});
