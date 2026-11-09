import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/db";

export interface Conference {
  id: number;
  slug: string;
  name: string;
  specialty: string;
  start_date: string;
  end_date: string;
  city: string;
  country: string;
  venue: string | null;
  lat: number | null;
  lng: number | null;
  url: string | null;
  cpd_points: number | null;
  registration_fee_cents: number | null;
  currency: string;
  source: string;
  source_url: string | null;
  updated_at: string;
}

export interface ConferenceFilters {
  /** Free text: matches name, specialty, city, country or venue. */
  q?: string;
  /** Exact specialty (case-insensitive). */
  specialty?: string;
  /** Exact country (case-insensitive). */
  country?: string;
  /** "YYYY-MM": conferences that run at any point in that month. */
  month?: string;
  /** "YYYY-MM-DD": only conferences ending on or after this date (e.g. today for "upcoming"). */
  from?: string;
}

const COLS =
  "id, slug, name, specialty, start_date, end_date, city, country, venue, lat, lng, url, cpd_points, registration_fee_cents, currency, source, source_url, updated_at";

/** Searches conferences, sorted by start date. Empty/blank filters are ignored. */
export function searchConferences(filters: ConferenceFilters = {}, db: DatabaseSync = getDb()): Conference[] {
  const where: string[] = [];
  const args: string[] = [];
  const q = filters.q?.trim();
  if (q) {
    const like = `%${q.toLowerCase().replace(/[\\%_]/g, (c) => "\\" + c)}%`;
    where.push(
      "(" +
        ["name", "specialty", "city", "country", "IFNULL(venue, '')"]
          .map((c) => `lower(${c}) LIKE ? ESCAPE '\\'`)
          .join(" OR ") +
        ")",
    );
    args.push(like, like, like, like, like);
  }
  if (filters.specialty?.trim()) {
    where.push("lower(specialty) = lower(?)");
    args.push(filters.specialty.trim());
  }
  if (filters.country?.trim()) {
    where.push("lower(country) = lower(?)");
    args.push(filters.country.trim());
  }
  const month = filters.month?.trim();
  if (month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    where.push("start_date <= ? AND end_date >= ?");
    args.push(`${month}-31`, `${month}-01`);
  }
  if (filters.from?.trim()) {
    where.push("end_date >= ?");
    args.push(filters.from.trim());
  }
  const sql =
    `SELECT ${COLS} FROM conferences` +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    " ORDER BY start_date, name";
  return db.prepare(sql).all(...args) as unknown as Conference[];
}

export function getConference(slug: string, db: DatabaseSync = getDb()): Conference | undefined {
  return db.prepare(`SELECT ${COLS} FROM conferences WHERE slug = ?`).get(slug) as Conference | undefined;
}

/** Distinct specialties and countries, for filter dropdowns. */
export function conferenceFacets(db: DatabaseSync = getDb()): { specialties: string[]; countries: string[] } {
  const col = (c: string) =>
    (db.prepare(`SELECT DISTINCT ${c} AS v FROM conferences ORDER BY ${c}`).all() as { v: string }[]).map(
      (r) => r.v,
    );
  return { specialties: col("specialty"), countries: col("country") };
}

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
