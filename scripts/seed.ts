/**
 * Seeds demo data (idempotent). Run with `npm run seed`.
 * Uses DATABASE_PATH or data/app.db.
 */
import { getDb, closeDb } from "../src/db";
import { seed } from "../src/db/seed";

const summary = seed(getDb());
closeDb();
console.log(`Seeded ${summary.org.name} (join code ${summary.org.join_code}); users: ${summary.users.join(", ")}; ${summary.conferences} sample conferences`);
