import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { closeDb, getDb } from "@/db";
import { DEMO_DEFAULT_ALLOWANCE_CENTS, seed } from "@/db/seed";
import { createOrg, createUser, findOrgByCode, type User } from "./users";
import { createTrip, transitionTrip, type TripStatus } from "./trips";
import {
  calculateBudget,
  defaultBudgetYear,
  getAllowanceCents,
  getBudget,
  setAllowance,
  setOrgDefaultAllowance,
  teamBudgets,
  tripYearsForUser,
} from "./budget";

describe("calculateBudget", () => {
  const t = (status: TripStatus, estimateCents: number, actualCents: number | null = null) => ({
    status,
    estimateCents,
    actualCents,
  });

  it("is all allowance with no trips", () => {
    expect(calculateBudget(2027, 300_000, [])).toEqual({
      year: 2027,
      allowanceCents: 300_000,
      committedCents: 0,
      spentCents: 0,
      pendingCents: 0,
      remainingCents: 300_000,
    });
  });

  it("commits approved/booked estimates, spends claimed/paid actuals, ignores drafts and rejections", () => {
    const b = calculateBudget(2027, 300_000, [
      t("draft", 99_999),
      t("rejected", 88_888),
      t("pending_approval", 50_000),
      t("approved", 40_000),
      t("booked", 60_000, 12_345), // booked counts its estimate, not receipts so far
      t("claimed", 70_000, 65_000),
      t("paid", 30_000, 31_000),
    ]);
    expect(b.committedCents).toBe(100_000);
    expect(b.spentCents).toBe(96_000);
    expect(b.pendingCents).toBe(50_000);
    expect(b.remainingCents).toBe(300_000 - 100_000 - 96_000);
  });

  it("falls back to the estimate when a claimed trip has no receipts yet", () => {
    expect(calculateBudget(2027, 100_000, [t("claimed", 40_000)]).spentCents).toBe(40_000);
  });

  it("goes negative when overspent", () => {
    expect(calculateBudget(2027, 10_000, [t("approved", 25_000)]).remainingCents).toBe(-15_000);
  });
});

describe("defaultBudgetYear", () => {
  it("prefers the current year, then the next year with a trip", () => {
    expect(defaultBudgetYear([], 2026)).toBe(2026);
    expect(defaultBudgetYear([2026, 2027], 2026)).toBe(2026);
    expect(defaultBudgetYear([2025, 2028, 2027], 2026)).toBe(2027);
    expect(defaultBudgetYear([2024], 2026)).toBe(2026);
  });
});

describe("budgets in the database", () => {
  let db: DatabaseSync;
  let orgId: number;
  let doc: User;
  let conf2027: number, conf2028: number;

  const insertConf = (slug: string, start: string) =>
    Number(
      db
        .prepare(
          `INSERT INTO conferences (slug, name, specialty, start_date, end_date, city, country, currency, source)
           VALUES (?, ?, 'General', ?, ?, 'Sydney', 'Australia', 'AUD', 'sample')`,
        )
        .run(slug, slug, start, start).lastInsertRowid,
    );
  const trip = (conferenceId: number, est: number, user = doc) =>
    createTrip({ orgId, userId: user.id, conferenceId, estRegistrationCents: est }, db);
  const moveTo = (id: number, path: TripStatus[]) => path.forEach((s) => transitionTrip(id, s, {}, db));

  beforeEach(() => {
    db = getDb(":memory:");
    orgId = createOrg(db, { name: "A Hospital", financeEmail: "fin@a.example" }).id;
    doc = createUser(db, { orgId, email: "doc@a.example", name: "Dr A", password: "pw123456", role: "doctor" });
    conf2027 = insertConf("c-2027", "2027-03-10");
    conf2028 = insertConf("c-2028", "2028-02-01");
  });
  afterEach(() => closeDb());

  it("uses the org default until a yearly allowance is set", () => {
    expect(getAllowanceCents(db, doc.id, 2027)).toBe(0);
    setOrgDefaultAllowance(db, orgId, 300_000);
    expect(getAllowanceCents(db, doc.id, 2027)).toBe(300_000);
    setAllowance(db, { orgId, userId: doc.id, year: 2027, allowanceCents: 450_000 });
    setAllowance(db, { orgId, userId: doc.id, year: 2027, allowanceCents: 500_000 }); // replaces
    expect(getAllowanceCents(db, doc.id, 2027)).toBe(500_000);
    expect(getAllowanceCents(db, doc.id, 2028)).toBe(300_000);
    expect((db.prepare("SELECT COUNT(*) AS n FROM budgets").get() as { n: number }).n).toBe(1);
  });

  it("won't set an allowance for someone in another hospital, or a bad amount", () => {
    const other = createOrg(db, { name: "B", financeEmail: "f@b.example" }).id;
    expect(() => setAllowance(db, { orgId: other, userId: doc.id, year: 2027, allowanceCents: 1 })).toThrow();
    expect(() => setAllowance(db, { orgId, userId: doc.id, year: 2027, allowanceCents: -1 })).toThrow();
  });

  it("counts only the year's trips by conference start date, for that doctor", () => {
    setOrgDefaultAllowance(db, orgId, 300_000);
    const a = trip(conf2027, 100_000);
    moveTo(a.id, ["pending_approval", "approved"]);
    const b = trip(conf2027, 50_000);
    moveTo(b.id, ["pending_approval"]);
    const c = trip(conf2028, 70_000);
    moveTo(c.id, ["pending_approval", "approved", "booked", "claimed"]);
    const doc2 = createUser(db, { orgId, email: "d2@a.example", name: "Dr B", password: "pw123456", role: "doctor" });
    const d = trip(conf2027, 99_000, doc2);
    moveTo(d.id, ["pending_approval", "approved"]);

    const b27 = getBudget(doc, 2027, db);
    expect(b27).toMatchObject({ committedCents: 100_000, pendingCents: 50_000, spentCents: 0, remainingCents: 200_000 });
    const b28 = getBudget(doc, 2028, db);
    expect(b28).toMatchObject({ committedCents: 0, spentCents: 70_000, remainingCents: 230_000 });
    expect(tripYearsForUser(db, doc.id)).toEqual([2027, 2028]);

    const team = teamBudgets(orgId, 2027, db);
    expect(team.map((r) => [r.name, r.committedCents, r.hasOwnAllowance])).toEqual([
      ["Dr A", 100_000, false],
      ["Dr B", 99_000, false],
    ]);
  });

  it("uses receipt totals for spent once a trip has receipts", () => {
    const a = trip(conf2027, 100_000);
    moveTo(a.id, ["pending_approval", "approved", "booked", "claimed"]);
    db.prepare("INSERT INTO receipts (trip_id, kind, amount_cents, source) VALUES (?, 'other', ?, 'upload'), (?, 'other', ?, 'upload')").run(a.id, 40_000, a.id, 2_550);
    expect(getBudget(doc, 2027, db).spentCents).toBe(42_550);
  });

  it("seed gives demo doctors AUD 3,000 and doesn't overwrite a changed default", () => {
    seed(db);
    const demo = findOrgByCode(db, "DEMO2026")!;
    const d = createUser(db, { orgId: demo.id, email: "new@demo.test", name: "New", password: "pw123456", role: "doctor" });
    expect(getAllowanceCents(db, d.id, 2027)).toBe(DEMO_DEFAULT_ALLOWANCE_CENTS);
    expect(DEMO_DEFAULT_ALLOWANCE_CENTS).toBe(300_000);
    setOrgDefaultAllowance(db, demo.id, 123_400);
    seed(db);
    expect(getAllowanceCents(db, d.id, 2027)).toBe(123_400);
  });
});
