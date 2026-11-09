import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { closeDb, getDb } from "@/db";
import { seedConferences } from "@/db/seed";
import {
  appUrl,
  approverEmails,
  canDecideTrip,
  canSubmitTrip,
  decideTrip,
  listPendingApprovals,
  submitTripForApproval,
} from "./approvals";
import { setAllowance } from "./budget";
import { listOutbox, OutboxMailer } from "./mailer";
import { canEditTrip, createTrip, getTrip, transitionTrip, updateTripPlan } from "./trips";
import { createOrg, createUser, type User } from "./users";

describe("approval workflow", () => {
  let db: DatabaseSync;
  let mailer: OutboxMailer;
  let orgId: number;
  let doc: User, doc2: User, manager: User, admin: User, finance: User, outsiderManager: User;
  let confId: number;
  let year: number;

  const newTrip = (owner: User, flights = 100000) =>
    createTrip(
      { orgId: owner.org_id!, userId: owner.id, conferenceId: confId, estRegistrationCents: 50000, estFlightsCents: flights },
      db,
    );

  beforeEach(() => {
    db = getDb(":memory:");
    mailer = new OutboxMailer(db);
    seedConferences(db);
    orgId = createOrg(db, { name: "A Hospital", financeEmail: "fin@a.example" }).id;
    const other = createOrg(db, { name: "B Hospital", financeEmail: "fin@b.example" }).id;
    const mk = (o: number, email: string, role: User["role"]) =>
      createUser(db, { orgId: o, email, name: `Name ${email}`, password: "pw123456", role });
    doc = mk(orgId, "doc@a.example", "doctor");
    doc2 = mk(orgId, "doc2@a.example", "doctor");
    manager = mk(orgId, "mgr@a.example", "manager");
    admin = mk(orgId, "admin@a.example", "admin");
    finance = mk(orgId, "fin@a.example", "finance");
    outsiderManager = mk(other, "mgr@b.example", "manager");
    const c = db.prepare("SELECT id, start_date FROM conferences ORDER BY id LIMIT 1").get() as {
      id: number;
      start_date: string;
    };
    confId = c.id;
    year = Number(c.start_date.slice(0, 4));
  });
  afterEach(() => closeDb());

  it("doctor submits a draft: pending_approval and the managers get an email", async () => {
    const trip = newTrip(doc);
    expect(canSubmitTrip({ ...trip }, doc)).toBe(true);
    const after = await submitTripForApproval(trip.id, doc, mailer, db);
    expect(after.status).toBe("pending_approval");
    expect(canEditTrip(after, doc)).toBe(false);
    const mail = listOutbox({ to: "mgr@a.example" }, db);
    expect(mail).toHaveLength(1);
    expect(mail[0].org_id).toBe(orgId);
    expect(mail[0].subject).toContain("Approval needed");
    expect(mail[0].body_text).toContain("AUD 1,500.00");
    expect(mail[0].body_text).toContain("/approvals");
    // only managers are emailed while the org has one
    expect(listOutbox({ to: "admin@a.example" }, db)).toHaveLength(0);
  });

  it("falls back to admins when the org has no manager", () => {
    db.prepare("UPDATE users SET role = 'doctor' WHERE id = ?").run(manager.id);
    expect(approverEmails(orgId, db)).toEqual(["admin@a.example"]);
  });

  it("only the owner can submit, only from draft/rejected, and not with no costs", async () => {
    const trip = newTrip(doc);
    await expect(submitTripForApproval(trip.id, doc2, mailer, db)).rejects.toThrow("can't submit");
    await expect(submitTripForApproval(trip.id, manager, mailer, db)).rejects.toThrow("can't submit");
    await submitTripForApproval(trip.id, doc, mailer, db);
    await expect(submitTripForApproval(trip.id, doc, mailer, db)).rejects.toThrow("can't submit");
    const empty = createTrip({ orgId, userId: doc.id, conferenceId: confId }, db);
    await expect(submitTripForApproval(empty.id, doc, mailer, db)).rejects.toThrow("estimated costs");
    expect(getTrip(empty.id, db)!.status).toBe("draft");
  });

  it("manager approves with an optional comment; the doctor is emailed", async () => {
    const trip = newTrip(doc);
    await submitTripForApproval(trip.id, doc, mailer, db);
    const pendingTrip = getTrip(trip.id, db)!;
    expect(canDecideTrip(pendingTrip, manager)).toBe(true);
    expect(canDecideTrip(pendingTrip, doc)).toBe(false);
    const after = await decideTrip(trip.id, manager, "approved", "  Enjoy it ", mailer, db);
    expect(after.status).toBe("approved");
    expect(after.manager_comment).toBe("Enjoy it");
    const mail = listOutbox({ to: "doc@a.example" }, db);
    expect(mail).toHaveLength(1);
    expect(mail[0].subject).toContain("Trip approved");
    expect(mail[0].body_text).toContain("Comment: Enjoy it");
    expect(mail[0].body_text).toContain(`/trips/${trip.id}`);
    // approving again is refused
    await expect(decideTrip(trip.id, manager, "approved", "", mailer, db)).rejects.toThrow("no longer awaiting");
  });

  it("rejection needs a comment; rejected trips can be edited and resubmitted", async () => {
    const trip = newTrip(doc);
    await submitTripForApproval(trip.id, doc, mailer, db);
    await expect(decideTrip(trip.id, manager, "rejected", "   ", mailer, db)).rejects.toThrow("why");
    const rejected = await decideTrip(trip.id, manager, "rejected", "Too expensive", mailer, db);
    expect(rejected.status).toBe("rejected");
    expect(rejected.manager_comment).toBe("Too expensive");
    expect(listOutbox({ to: "doc@a.example" }, db)[0].subject).toContain("Trip rejected");

    expect(canEditTrip(rejected, doc)).toBe(true);
    updateTripPlan(
      trip.id,
      doc,
      { departCity: "Sydney", notes: null, estRegistrationCents: 50000, estFlightsCents: 40000, estHotelCents: 0, estOtherCents: 0 },
      db,
    );
    const again = await submitTripForApproval(trip.id, doc, mailer, db);
    expect(again.status).toBe("pending_approval");
    const mgrMail = listOutbox({ to: "mgr@a.example" }, db);
    expect(mgrMail).toHaveLength(2);
    expect(mgrMail[0].subject).toContain("Resubmitted");
    expect(mgrMail[0].body_text).toContain("AUD 900.00");
  });

  it("only managers/admins of the same org decide, never on their own trip", async () => {
    const trip = newTrip(doc);
    await submitTripForApproval(trip.id, doc, mailer, db);
    await expect(decideTrip(trip.id, doc2, "approved", "", mailer, db)).rejects.toThrow("not found");
    await expect(decideTrip(trip.id, finance, "approved", "", mailer, db)).rejects.toThrow("not found");
    await expect(decideTrip(trip.id, outsiderManager, "approved", "", mailer, db)).rejects.toThrow("not found");
    expect(getTrip(trip.id, db)!.status).toBe("pending_approval");

    const own = newTrip(manager);
    await submitTripForApproval(own.id, manager, mailer, db);
    await expect(decideTrip(own.id, manager, "approved", "", mailer, db)).rejects.toThrow("own trip");
    expect((await decideTrip(own.id, admin, "approved", "", mailer, db)).status).toBe("approved");
  });

  it("lists pending trips in the org with cost and budget remaining", async () => {
    setAllowance(db, { orgId, userId: doc.id, year, allowanceCents: 300000 });
    const approved = newTrip(doc, 50000); // 1,000 committed
    transitionTrip(approved.id, "pending_approval", {}, db);
    transitionTrip(approved.id, "approved", {}, db);
    const t1 = newTrip(doc); // 1,500 pending
    const t2 = newTrip(doc2);
    newTrip(doc); // draft: not listed
    await submitTripForApproval(t1.id, doc, mailer, db);
    await submitTripForApproval(t2.id, doc2, mailer, db);

    const list = listPendingApprovals(manager, db);
    expect(list.map((p) => p.trip.id)).toEqual([t1.id, t2.id]);
    expect(list[0]).toMatchObject({ estimateCents: 150000, remainingCents: 200000, remainingAfterCents: 50000, year });
    expect(list[0].trip.owner_name).toBe("Name doc@a.example");
    expect(listPendingApprovals(doc, db)).toEqual([]);
    expect(listPendingApprovals(finance, db)).toEqual([]);
    expect(listPendingApprovals(outsiderManager, db)).toEqual([]);
  });

  it("appUrl uses APP_URL when set", () => {
    expect(appUrl("/approvals", {})).toBe("http://localhost:3000/approvals");
    expect(appUrl("/trips/3", { APP_URL: "https://studyleave.example/" })).toBe("https://studyleave.example/trips/3");
  });
});
