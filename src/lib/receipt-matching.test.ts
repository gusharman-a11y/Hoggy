import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db";
import { matchTrip, pickTrip, scoreTrip, type MatchCandidate, type MatchInput } from "./receipt-matching";
import { createTrip, transitionTrip } from "./trips";
import { createOrg, createUser, type User } from "./users";

const melb: MatchCandidate = {
  id: 1,
  status: "approved",
  start_date: "2027-03-10",
  end_date: "2027-03-12",
  city: "Melbourne",
  venue: "SAMPLE Exhibition Centre",
  conference_name: "SAMPLE Cardiology Congress 2027",
};
const perth: MatchCandidate = {
  id: 2,
  status: "draft",
  start_date: "2027-03-11",
  end_date: "2027-03-13",
  city: "Perth",
  venue: null,
  conference_name: "SAMPLE Anaesthesia Meeting 2027",
};
const brisbane: MatchCandidate = { ...perth, id: 3, start_date: "2027-08-01", end_date: "2027-08-03", city: "Brisbane" };

const input = (over: Partial<MatchInput>): MatchInput => ({ date: null, kind: "other", supplierName: null, ...over });

describe("scoreTrip", () => {
  it("scores conference dates above the travel window and rejects dates outside it", () => {
    expect(scoreTrip(melb, input({ date: "2027-03-11" }))).toBe(3);
    expect(scoreTrip(melb, input({ date: "2027-03-09" }))).toBe(2); // day before
    expect(scoreTrip(melb, input({ date: "2027-03-13" }))).toBe(2); // day after
    expect(scoreTrip(melb, input({ date: "2027-03-08" }))).toBe(-1); // a taxi 2 days early isn't this trip
    expect(scoreTrip(melb, input({ date: "2027-03-14" }))).toBe(-1);
  });

  it("allows bookings from 30 days before the start", () => {
    for (const kind of ["flight", "accommodation", "registration"] as const) {
      expect(scoreTrip(melb, input({ date: "2027-02-08", kind }))).toBe(2);
      expect(scoreTrip(melb, input({ date: "2027-02-07", kind }))).toBe(-1);
    }
    expect(scoreTrip(melb, input({ date: "2027-02-08", kind: "taxi" }))).toBe(-1);
  });

  it("adds points when the city, venue or conference name is mentioned", () => {
    expect(scoreTrip(melb, input({ text: "Fwd: your trip to MELBOURNE" }))).toBe(2);
    expect(scoreTrip(melb, input({ supplierName: "SAMPLE Exhibition Centre cafe" }))).toBe(2);
    expect(scoreTrip(melb, input({ text: "Registration: Cardiology Congress delegate" }))).toBe(2);
    expect(scoreTrip(melb, input({ date: "2027-03-11", text: "Melbourne Cabs" }))).toBe(5);
    const dashed = { ...melb, city: "Hobart", venue: null, conference_name: "SAMPLE – Paediatrics Spring Symposium" };
    expect(scoreTrip(dashed, input({ text: "Paediatrics Spring Symposium registration" }))).toBe(2);
    // Whole words only, and a city alone never rescues a date outside the window.
    expect(scoreTrip(melb, input({ text: "Melbournes" }))).toBe(0);
    expect(scoreTrip(melb, input({ date: "2027-06-01", text: "Melbourne" }))).toBe(-1);
  });
});

describe("pickTrip", () => {
  const all = [melb, perth, brisbane];

  it("matches the one trip that fits", () => {
    expect(pickTrip(all, input({ date: "2027-08-02" }))).toEqual({ kind: "matched", tripId: 3, score: 3 });
    expect(pickTrip(all, input({ text: "Perth Airport taxi" }))).toMatchObject({ kind: "matched", tripId: 2 });
  });

  it("uses the place to break a date tie", () => {
    expect(pickTrip(all, input({ date: "2027-03-11", supplierName: "Melbourne Cabs" }))).toMatchObject({ kind: "matched", tripId: 1 });
  });

  it("finds no match for receipts that fit no trip (e.g. a personal holiday)", () => {
    expect(pickTrip(all, input({ date: "2027-05-20", text: "Bali Beach Resort" }))).toEqual({ kind: "none" });
    expect(pickTrip(all, input({ text: "Some shop" }))).toEqual({ kind: "none" });
    expect(pickTrip([], input({ date: "2027-03-11" }))).toEqual({ kind: "none" });
  });

  it("is ambiguous when two trips fit equally well", () => {
    expect(pickTrip(all, input({ date: "2027-03-11" }))).toEqual({ kind: "ambiguous", tripIds: [1, 2] });
  });

  it("never picks a trip whose claim has been sent", () => {
    expect(pickTrip([{ ...brisbane, status: "claimed" }], input({ date: "2027-08-02" }))).toEqual({ kind: "none" });
  });
});

describe("matchTrip", () => {
  let db: DatabaseSync;
  let doc: User;
  let other: User;
  let conf: (name: string, start: string, end: string, city: string) => number;
  beforeEach(() => {
    db = getDb(":memory:");
    const orgId = createOrg(db, { name: "A Hospital", financeEmail: "fin@a.example" }).id;
    doc = createUser(db, { orgId, email: "a@a.example", name: "Dr A", password: "pw123456", role: "doctor" });
    other = createUser(db, { orgId, email: "b@a.example", name: "Dr B", password: "pw123456", role: "doctor" });
    conf = (name, start, end, city) =>
      Number(
        db
          .prepare(
            `INSERT INTO conferences (slug, name, specialty, start_date, end_date, city, country, currency, source)
             VALUES (?, ?, 'Cardiology', ?, ?, ?, 'Australia', 'AUD', 'sample')`,
          )
          .run(name.toLowerCase().replace(/\W+/g, "-"), name, start, end, city).lastInsertRowid,
      );
  });
  afterEach(() => closeDb());

  it("only looks at the doctor's own open trips", () => {
    const melbId = conf("SAMPLE Melbourne Meeting 2027", "2027-03-10", "2027-03-12", "Melbourne");
    const hobartId = conf("SAMPLE Hobart Meeting 2027", "2027-09-01", "2027-09-02", "Hobart");
    const mine = createTrip({ orgId: doc.org_id!, userId: doc.id, conferenceId: melbId }, db);
    createTrip({ orgId: other.org_id!, userId: other.id, conferenceId: hobartId }, db);

    expect(matchTrip(doc, input({ date: "2027-03-11" }), db)).toMatchObject({ kind: "matched", tripId: mine.id });
    // Dr B's Hobart trip is invisible to Dr A.
    expect(matchTrip(doc, input({ date: "2027-09-01" }), db)).toEqual({ kind: "none" });

    for (const s of ["pending_approval", "approved", "booked", "claimed"] as const) transitionTrip(mine.id, s, {}, db);
    expect(matchTrip(doc, input({ date: "2027-03-11" }), db)).toEqual({ kind: "none" });
  });

  it("reports ambiguity across the doctor's trips", () => {
    const a = createTrip({ orgId: doc.org_id!, userId: doc.id, conferenceId: conf("SAMPLE A 2027", "2027-03-10", "2027-03-12", "Sydney") }, db);
    const b = createTrip({ orgId: doc.org_id!, userId: doc.id, conferenceId: conf("SAMPLE B 2027", "2027-03-11", "2027-03-14", "Adelaide") }, db);
    expect(matchTrip(doc, input({ date: "2027-03-11" }), db)).toEqual({ kind: "ambiguous", tripIds: [a.id, b.id] });
    expect(matchTrip(doc, input({ date: "2027-03-11", text: "Adelaide Taxis" }), db)).toMatchObject({ kind: "matched", tripId: b.id });
  });
});
