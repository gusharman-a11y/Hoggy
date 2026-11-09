import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/db";
import { slugify } from "@/lib/conferences";
import type { ExtractedConference } from "./extract";

export interface UpsertResult {
  id: number;
  slug: string;
  action: "inserted" | "updated";
}

/** Dedupe key part: case, accents, punctuation and spacing don't matter. */
export function normaliseName(name: string): string {
  return slugify(name);
}

/**
 * Inserts the conference, or updates the existing row with the same
 * normalised name + start_date (and bumps updated_at). Blank incoming
 * fields never wipe out values we already have.
 */
export function upsertConference(
  c: ExtractedConference,
  source = "ingest",
  db: DatabaseSync = getDb(),
): UpsertResult {
  const key = normaliseName(c.name);
  const candidates = db
    .prepare("SELECT id, slug, name FROM conferences WHERE start_date = ?")
    .all(c.start_date) as { id: number; slug: string; name: string }[];
  const existing = candidates.find((r) => normaliseName(r.name) === key);

  if (existing) {
    db.prepare(
      `UPDATE conferences SET
         name = ?,
         specialty = CASE WHEN ? = 'General' THEN specialty ELSE ? END,
         end_date = ?,
         city = COALESCE(NULLIF(?, ''), city),
         country = COALESCE(NULLIF(?, ''), country),
         venue = COALESCE(?, venue),
         lat = COALESCE(?, lat),
         lng = COALESCE(?, lng),
         url = COALESCE(?, url),
         cpd_points = COALESCE(?, cpd_points),
         registration_fee_cents = COALESCE(?, registration_fee_cents),
         currency = CASE WHEN ? IS NULL THEN currency ELSE ? END,
         source_url = COALESCE(?, source_url),
         updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
       WHERE id = ?`,
    ).run(
      c.name,
      c.specialty,
      c.specialty,
      c.end_date,
      c.city,
      c.country,
      c.venue,
      c.lat,
      c.lng,
      c.url,
      c.cpd_points,
      c.registration_fee_cents,
      c.registration_fee_cents,
      c.currency,
      c.source_url,
      existing.id,
    );
    return { id: existing.id, slug: existing.slug, action: "updated" };
  }

  const base = slugify(`${c.name}-${c.start_date.slice(0, 4)}`) || "conference";
  let slug = base;
  for (let i = 2; db.prepare("SELECT 1 FROM conferences WHERE slug = ?").get(slug); i++) slug = `${base}-${i}`;

  const r = db
    .prepare(
      `INSERT INTO conferences
         (slug, name, specialty, start_date, end_date, city, country, venue, lat, lng, url,
          cpd_points, registration_fee_cents, currency, source, source_url, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%d %H:%M:%f', 'now'))`,
    )
    .run(
      slug,
      c.name,
      c.specialty,
      c.start_date,
      c.end_date,
      c.city,
      c.country,
      c.venue,
      c.lat,
      c.lng,
      c.url,
      c.cpd_points,
      c.registration_fee_cents,
      c.currency,
      source,
      c.source_url,
    );
  return { id: Number(r.lastInsertRowid), slug, action: "inserted" };
}

/** Upserts a batch in one transaction. */
export function upsertConferences(
  list: ExtractedConference[],
  source = "ingest",
  db: DatabaseSync = getDb(),
): UpsertResult[] {
  db.exec("BEGIN");
  try {
    const out = list.map((c) => upsertConference(c, source, db));
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
