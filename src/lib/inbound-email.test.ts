import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db";
import {
  handleInboundRequest,
  inboundAddress,
  inboundCodesFrom,
  inboundSecretMatches,
  parseEmailAddress,
  receiveInboundEmail,
  type InboundEmail,
} from "./inbound-email";
import { listReceipts, resolveUploadPath } from "./receipts";
import { createTrip, getTrip, transitionTrip, type Trip } from "./trips";
import { createOrg, createUser } from "./users";

const SECRET = "s3cret-inbound";
const PDF = Buffer.from("%PDF-1.4\n%fake\n");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const b64 = (b: Buffer) => b.toString("base64");

describe("addresses", () => {
  it("builds and parses trip addresses", () => {
    expect(inboundAddress("ab12cd34ef56")).toBe("trip-ab12cd34ef56@in.studyleave.app");
    expect(inboundCodesFrom("trip-ab12cd34ef56@in.studyleave.app")).toEqual(["ab12cd34ef56"]);
    expect(inboundCodesFrom('"My trip" <TRIP-AB12CD34EF56@IN.STUDYLEAVE.APP>')).toEqual(["ab12cd34ef56"]);
    expect(inboundCodesFrom("me@x.example, trip-aaaa1111@in.studyleave.app; trip-bbbb2222@in.studyleave.app")).toEqual([
      "aaaa1111",
      "bbbb2222",
    ]);
    expect(inboundCodesFrom("trip-ab12@in.studyleave.app.evil.example")).toEqual([]);
    expect(inboundCodesFrom("trip-ab12cd@other.example")).toEqual([]);
    expect(inboundCodesFrom("")).toEqual([]);
  });

  it("parses sender addresses", () => {
    expect(parseEmailAddress("Dr A <Doc@A.Example>")).toBe("doc@a.example");
    expect(parseEmailAddress(" doc@a.example ")).toBe("doc@a.example");
    expect(parseEmailAddress("not an email")).toBeUndefined();
  });
});

describe("inboundSecretMatches", () => {
  it("accepts only the exact configured secret", () => {
    expect(inboundSecretMatches(SECRET, SECRET)).toBe(true);
    expect(inboundSecretMatches("s3cret-inbounD", SECRET)).toBe(false);
    expect(inboundSecretMatches("s3cret", SECRET)).toBe(false);
    expect(inboundSecretMatches(SECRET + "x", SECRET)).toBe(false);
    expect(inboundSecretMatches("", SECRET)).toBe(false);
    expect(inboundSecretMatches(null, SECRET)).toBe(false);
  });

  it("rejects everything when no secret is configured", () => {
    expect(inboundSecretMatches("", undefined)).toBe(false);
    expect(inboundSecretMatches("", "")).toBe(false);
    expect(inboundSecretMatches("anything", undefined)).toBe(false);
  });
});

describe("inbound email routing", () => {
  let db: DatabaseSync;
  let dir: string;
  let trip: Trip;
  let otherTrip: Trip;

  beforeEach(() => {
    db = getDb(":memory:");
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "sl-inbound-"));
    const orgId = createOrg(db, { name: "A Hospital", financeEmail: "fin@a.example" }).id;
    const doc = createUser(db, { orgId, email: "Doc@A.example", name: "Dr A", password: "pw123456", role: "doctor" });
    const other = createUser(db, { orgId, email: "b@a.example", name: "Dr B", password: "pw123456", role: "doctor" });
    const confId = Number(
      db
        .prepare(
          `INSERT INTO conferences (slug, name, specialty, start_date, end_date, city, country, currency, source)
           VALUES ('c', 'SAMPLE Meeting 2027', 'Cardiology', '2027-03-10', '2027-03-12', 'Melbourne', 'Australia', 'AUD', 'sample')`,
        )
        .run().lastInsertRowid,
    );
    trip = createTrip({ orgId, userId: doc.id, conferenceId: confId }, db);
    otherTrip = createTrip({ orgId, userId: other.id, conferenceId: confId }, db);
  });
  afterEach(() => {
    closeDb();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const email = (over: Partial<InboundEmail> = {}): InboundEmail => ({
    to: inboundAddress(trip.inbound_code),
    from: "Dr A <doc@a.example>",
    subject: "Fwd: Your taxi receipt",
    attachments: [{ filename: "taxi.pdf", contentType: "application/pdf", base64: b64(PDF) }],
    ...over,
  });

  it("gives every trip its own random inbound code", () => {
    expect(trip.inbound_code).toMatch(/^[a-f0-9]{12}$/);
    expect(otherTrip.inbound_code).toMatch(/^[a-f0-9]{12}$/);
    expect(trip.inbound_code).not.toBe(otherTrip.inbound_code);
    expect(getTrip(trip.id, db)!.inbound_code).toBe(trip.inbound_code);
  });

  it("turns attachments from the owner into source='email' receipts", () => {
    const res = receiveInboundEmail(
      email({
        attachments: [
          { filename: "taxi.pdf", contentType: "application/pdf", base64: b64(PDF) },
          { filename: "../../photo.png", contentType: "image/png", base64: b64(PNG) },
        ],
      }),
      { db, dir },
    );
    expect(res.ok).toBe(true);
    const rows = listReceipts(trip.id, db);
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r).toMatchObject({ source: "email", amount_cents: 0, description: "Your taxi receipt", kind: "other" });
      expect(r.file_path!.startsWith(`${trip.id}/email-`)).toBe(true);
    }
    expect(rows.map((r) => r.mime_type)).toEqual(["application/pdf", "image/png"]);
    expect(rows[1].original_name).toBe("photo.png");
    expect(fs.readFileSync(resolveUploadPath(rows[0].file_path!, dir))).toEqual(PDF);
    expect(listReceipts(otherTrip.id, db)).toHaveLength(0);
  });

  it("ignores mail whose sender isn't the trip owner", () => {
    const res = receiveInboundEmail(email({ from: "b@a.example" }), { db, dir });
    expect(res).toMatchObject({ ok: false, status: 404 });
    expect(listReceipts(trip.id, db)).toHaveLength(0);
  });

  it("ignores unknown or non-trip addresses", () => {
    expect(receiveInboundEmail(email({ to: inboundAddress("ffffffffffff") }), { db, dir })).toMatchObject({ ok: false, status: 404 });
    expect(receiveInboundEmail(email({ to: "someone@a.example" }), { db, dir })).toMatchObject({ ok: false, status: 404 });
  });

  it("routes to the sender's own trip when several trip addresses are in 'to'", () => {
    const to = `${inboundAddress(otherTrip.inbound_code)}, ${inboundAddress(trip.inbound_code)}`;
    const res = receiveInboundEmail(email({ to }), { db, dir });
    expect(res).toMatchObject({ ok: true, tripId: trip.id });
    expect(listReceipts(otherTrip.id, db)).toHaveLength(0);
  });

  it("skips unsupported attachments and rejects mail with none usable", () => {
    const html = { filename: "x.html", contentType: "text/html", base64: b64(Buffer.from("<html>")) };
    const mixed = receiveInboundEmail(email({ attachments: [html, email().attachments[0]] }), { db, dir });
    expect(mixed).toMatchObject({ ok: true, skipped: ["x.html: not a PDF, JPG or PNG"] });
    expect(receiveInboundEmail(email({ attachments: [html] }), { db, dir })).toMatchObject({ ok: false, status: 422 });
    expect(receiveInboundEmail(email({ attachments: [] }), { db, dir })).toMatchObject({ ok: false, status: 422 });
    expect(listReceipts(trip.id, db)).toHaveLength(1);
  });

  it("uses a default description when the subject is blank", () => {
    receiveInboundEmail(email({ subject: "  " }), { db, dir });
    expect(listReceipts(trip.id, db)[0].description).toBe("Emailed receipt");
  });

  it("refuses receipts once the claim has been sent", () => {
    for (const s of ["pending_approval", "approved", "booked", "claimed"] as const) transitionTrip(trip.id, s, {}, db);
    expect(receiveInboundEmail(email(), { db, dir })).toMatchObject({ ok: false, status: 409 });
    expect(listReceipts(trip.id, db)).toHaveLength(0);
  });

  describe("POST handler", () => {
    const post = (body: unknown, headers: Record<string, string> = { "x-inbound-secret": SECRET }) =>
      new Request("http://localhost/api/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
      });

    it("rejects a missing or wrong secret before touching the payload", async () => {
      const bad: Record<string, string>[] = [{}, { "x-inbound-secret": "wrong" }, { "x-inbound-secret": "" }];
      for (const headers of bad) {
        const res = await handleInboundRequest(post(email(), headers), { secret: SECRET, db, dir });
        expect(res.status).toBe(401);
      }
      expect((await handleInboundRequest(post("not json", {}), { secret: SECRET, db, dir })).status).toBe(401);
      expect((await handleInboundRequest(post(email()), { secret: undefined, db, dir })).status).toBe(401);
      expect(listReceipts(trip.id, db)).toHaveLength(0);
    });

    it("rejects malformed payloads", async () => {
      expect((await handleInboundRequest(post("{nope"), { secret: SECRET, db, dir })).status).toBe(400);
      expect((await handleInboundRequest(post({ to: "x" }), { secret: SECRET, db, dir })).status).toBe(400);
      expect((await handleInboundRequest(post({ ...email(), attachments: [{ filename: "a" }] }), { secret: SECRET, db, dir })).status).toBe(400);
    });

    it("stores receipts with the right secret and reports them", async () => {
      const res = await handleInboundRequest(post(email()), { secret: SECRET, db, dir });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toMatchObject({ tripId: trip.id, receipts: [{ description: "Your taxi receipt", filename: "taxi.pdf" }] });
      expect(listReceipts(trip.id, db)).toHaveLength(1);
    });

    it("answers 404 for a sender who doesn't own the trip", async () => {
      const res = await handleInboundRequest(post(email({ from: "b@a.example" })), { secret: SECRET, db, dir });
      expect(res.status).toBe(404);
    });
  });
});
