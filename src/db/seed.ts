import type { DatabaseSync } from "node:sqlite";
import { SAMPLE_CONFERENCES } from "./sample-conferences";
import { slugify } from "@/lib/conferences";
import { createOrg, createUser, findOrgByCode, findUserByEmail, type Org, type Role } from "@/lib/users";

export const DEMO_ORG = { name: "Demo Hospital", joinCode: "DEMO2026", financeEmail: "finance@demo.test" };
export const DEMO_PASSWORD = "password123";
export const DEMO_USERS: { email: string; name: string; role: Role }[] = [
  { email: "manager@demo.test", name: "Morgan Manager", role: "manager" },
  { email: "finance@demo.test", name: "Fran Finance", role: "finance" },
];

/** Inserts the demo hospital and staff logins if they are missing. Safe to run repeatedly. */
export function seed(db: DatabaseSync): { org: Org; users: string[]; conferences: number } {
  const org =
    findOrgByCode(db, DEMO_ORG.joinCode) ??
    createOrg(db, { name: DEMO_ORG.name, financeEmail: DEMO_ORG.financeEmail, joinCode: DEMO_ORG.joinCode });
  for (const u of DEMO_USERS) {
    if (!findUserByEmail(db, u.email)) createUser(db, { orgId: org.id, password: DEMO_PASSWORD, ...u });
  }
  return { org, users: DEMO_USERS.map((u) => u.email), conferences: seedConferences(db) };
}

/** Inserts the SAMPLE conferences (source='sample') if missing; returns how many sample rows exist. */
export function seedConferences(db: DatabaseSync): number {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO conferences
       (slug, name, specialty, start_date, end_date, city, country, venue, lat, lng, url,
        cpd_points, registration_fee_cents, currency, source, source_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sample', NULL)`,
  );
  for (const c of SAMPLE_CONFERENCES) {
    const slug = slugify(`${c.name}-${c.start_date.slice(0, 4)}`);
    insert.run(
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
      `https://example.org/sample/${slug}`,
      c.cpd_points,
      c.registration_fee_cents,
      c.currency,
    );
  }
  return (db.prepare("SELECT COUNT(*) AS n FROM conferences WHERE source = 'sample'").get() as { n: number }).n;
}
