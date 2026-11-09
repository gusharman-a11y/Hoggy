import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { closeDb, getDb } from "@/db";
import { seed, seedConferences } from "@/db/seed";
import { SAMPLE_CONFERENCES } from "@/db/sample-conferences";
import { conferenceFacets, getConference, searchConferences, slugify } from "./conferences";

let db: DatabaseSync;
beforeEach(() => {
  db = getDb(":memory:");
  seedConferences(db);
});
afterEach(() => closeDb());

describe("sample conferences", () => {
  it("seeds ~30 SAMPLE events across 8+ specialties and 10+ countries, idempotently", () => {
    const all = searchConferences({}, db);
    expect(all.length).toBeGreaterThanOrEqual(28);
    expect(all.length).toBe(SAMPLE_CONFERENCES.length);
    expect(new Set(all.map((c) => c.specialty)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(all.map((c) => c.country)).size).toBeGreaterThanOrEqual(10);
    for (const c of all) {
      expect(c.source).toBe("sample");
      expect(c.name.startsWith("SAMPLE – ")).toBe(true);
      expect(c.url).toMatch(/^https:\/\/example\.org\//);
      expect(c.end_date >= c.start_date).toBe(true);
      expect(Number.isInteger(c.registration_fee_cents)).toBe(true);
    }
    expect(seedConferences(db)).toBe(all.length);
    expect(seed(db).conferences).toBe(all.length);
    expect(searchConferences({}, db).length).toBe(all.length);
  });

  it("sorts by start date", () => {
    const dates = searchConferences({}, db).map((c) => c.start_date);
    expect(dates).toEqual([...dates].sort());
  });
});

describe("searchConferences filters", () => {
  it("q matches name, city, country and venue case-insensitively", () => {
    const byName = searchConferences({ q: "airway" }, db);
    expect(byName.map((c) => c.name)).toEqual(["SAMPLE – Airway Management Forum"]);
    expect(searchConferences({ q: "dubbo" }, db)).toHaveLength(1);
    expect(searchConferences({ q: "JAPAN" }, db)).toHaveLength(1);
    expect(searchConferences({ q: "marina medical" }, db)).toHaveLength(1);
    expect(searchConferences({ q: "no such thing" }, db)).toEqual([]);
    expect(searchConferences({ q: "%" }, db)).toEqual([]);
    expect(searchConferences({ q: "   " }, db).length).toBe(SAMPLE_CONFERENCES.length);
  });

  it("specialty filters exactly", () => {
    const res = searchConferences({ specialty: "cardiology" }, db);
    expect(res.length).toBe(3);
    expect(res.every((c) => c.specialty === "Cardiology")).toBe(true);
  });

  it("country filters exactly", () => {
    const res = searchConferences({ country: "New Zealand" }, db);
    expect(res.length).toBeGreaterThanOrEqual(3);
    expect(res.every((c) => c.country === "New Zealand")).toBe(true);
  });

  it("month returns events running during that month, including ones spanning it", () => {
    const res = searchConferences({ month: "2027-04" }, db);
    expect(res.length).toBeGreaterThan(0);
    for (const c of res) expect(c.start_date <= "2027-04-31" && c.end_date >= "2027-04-01").toBe(true);
    // Oncology symposium starts 29 Mar and ends 1 Apr.
    expect(res.some((c) => c.start_date.startsWith("2027-03"))).toBe(true);
    expect(searchConferences({ month: "bogus" }, db).length).toBe(SAMPLE_CONFERENCES.length);
  });

  it("from hides events that have finished", () => {
    const res = searchConferences({ from: "2028-01-01" }, db);
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((c) => c.end_date >= "2028-01-01")).toBe(true);
  });

  it("combines filters", () => {
    const res = searchConferences({ specialty: "Intensive Care", country: "Australia", month: "2027-09" }, db);
    expect(res.map((c) => c.city)).toEqual(["Melbourne"]);
    expect(searchConferences({ q: "ultrasound", country: "Japan" }, db)).toEqual([]);
  });
});

describe("getConference", () => {
  it("finds by slug and returns undefined otherwise", () => {
    const first = searchConferences({}, db)[0];
    expect(getConference(first.slug, db)?.name).toBe(first.name);
    expect(getConference("nope", db)).toBeUndefined();
  });
});

describe("helpers", () => {
  it("slugify and facets", () => {
    expect(slugify("SAMPLE – Café & Co 2027")).toBe("sample-cafe-co-2027");
    const f = conferenceFacets(db);
    expect(f.specialties).toContain("Paediatrics");
    expect(f.countries).toContain("Australia");
  });
});
