import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db";
import { getConference } from "@/lib/conferences";
import { extractEvents } from "./extract";
import { normaliseName, upsertConference, upsertConferences } from "./upsert";

const fixture = (name: string) => readFileSync(path.join(__dirname, "__fixtures__", name), "utf8");

describe("extractEvents", () => {
  it("reads an EducationEvent inside @graph with Place, PostalAddress, geo and offers", () => {
    const url = "https://example.org/asm";
    const [c, ...rest] = extractEvents(fixture("graph-education-event.html"), url);
    expect(rest).toHaveLength(0);
    expect(c).toEqual({
      name: "SAMPLE – Emergency Medicine Annual Scientific Meeting",
      specialty: "Emergency Medicine",
      start_date: "2027-08-09",
      end_date: "2027-08-12",
      city: "Newcastle",
      country: "Australia",
      venue: "Example Convention Centre",
      lat: -32.9283,
      lng: 151.7817,
      url: "https://example.org/asm-2027",
      cpd_points: null,
      registration_fee_cents: 85000,
      currency: "AUD",
      source_url: url,
    });
  });

  it("handles top-level arrays, multiple @types, datetimes, entities, Country objects and trailing commas", () => {
    const url = "https://example.org/events";
    const list = extractEvents(fixture("array-events.html"), url);
    expect(list.map((c) => c.name)).toEqual([
      "SAMPLE – Paediatric Sedation Workshop & Skills Day",
      "SAMPLE – Heart Failure Update",
    ]);
    const [a, b] = list;
    expect(a).toMatchObject({
      specialty: "Paediatrics",
      start_date: "2027-11-15",
      end_date: "2027-11-15",
      city: "Wellington",
      country: "New Zealand",
      venue: "Harbour Example Rooms",
      registration_fee_cents: 42000,
      currency: "NZD",
      url,
    });
    expect(b).toMatchObject({
      specialty: "Cardiology",
      start_date: "2028-03-02",
      end_date: "2028-03-02",
      city: "Leeds",
      country: "United Kingdom",
      registration_fee_cents: null,
      url: "https://example.org/events/hf-update",
    });
  });

  it("finds subEvents of an EventSeries (full-URL @type, HTML comment wrapper, string address)", () => {
    const list = extractEvents(fixture("event-series.html"), "https://example.org/ra");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      name: "SAMPLE – Regional Anaesthesia Course (Perth)",
      specialty: "Anaesthesia",
      start_date: "2027-04-10",
      end_date: "2027-04-11",
      venue: "Example Skills Lab",
      city: "",
      country: "",
    });
  });

  it("returns [] for pages without event JSON-LD, including broken JSON", () => {
    expect(extractEvents(fixture("no-jsonld.html"), "https://example.org/news")).toEqual([]);
    expect(extractEvents("", "https://example.org/")).toEqual([]);
    expect(extractEvents("<html><body>hi</body></html>", "https://example.org/")).toEqual([]);
  });
});

describe("upsertConference", () => {
  afterEach(() => closeDb());

  const base = () => extractEvents(fixture("graph-education-event.html"), "https://example.org/asm")[0];

  it("inserts a new conference with a slug and source", () => {
    const db = getDb(":memory:");
    const r = upsertConference(base(), "ingest", db);
    expect(r.action).toBe("inserted");
    const row = getConference(r.slug, db)!;
    expect(row).toMatchObject({ source: "ingest", city: "Newcastle", registration_fee_cents: 85000 });
    expect(r.slug).toBe("sample-emergency-medicine-annual-scientific-meeting-2027");
  });

  it("dedupes by normalised name + start_date and bumps updated_at", async () => {
    const db = getDb(":memory:");
    const first = upsertConference(base(), "ingest", db);
    const before = getConference(first.slug, db)!.updated_at;
    await new Promise((r) => setTimeout(r, 5));

    const again = {
      ...base(),
      name: "  sample — EMERGENCY medicine annual scientific meeting ",
      venue: null,
      registration_fee_cents: 90000,
    };
    const second = upsertConference(again, "ingest", db);
    expect(second).toEqual({ id: first.id, slug: first.slug, action: "updated" });

    const rows = db.prepare("SELECT * FROM conferences").all() as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0].registration_fee_cents).toBe(90000);
    expect(rows[0].venue).toBe("Example Convention Centre"); // null never wipes a known value
    expect(String(rows[0].updated_at) > before).toBe(true);
  });

  it("treats a different start_date as a different conference and keeps slugs unique", () => {
    const db = getDb(":memory:");
    const a = upsertConference(base(), "ingest", db);
    const b = upsertConference({ ...base(), start_date: "2027-09-01", end_date: "2027-09-02" }, "ingest", db);
    expect(b.action).toBe("inserted");
    expect(b.id).not.toBe(a.id);
    expect(b.slug).toBe(`${a.slug}-2`);
  });

  it("upsertConferences runs a batch in one transaction", () => {
    const db = getDb(":memory:");
    const list = extractEvents(fixture("array-events.html"), "https://example.org/events");
    expect(upsertConferences(list, "ingest", db).map((r) => r.action)).toEqual(["inserted", "inserted"]);
    expect(upsertConferences(list, "ingest", db).map((r) => r.action)).toEqual(["updated", "updated"]);
    expect((db.prepare("SELECT COUNT(*) AS n FROM conferences").get() as { n: number }).n).toBe(2);
  });

  it("normaliseName ignores case, accents and punctuation", () => {
    expect(normaliseName("Café – Cardiology!")).toBe(normaliseName("cafe cardiology"));
  });
});
