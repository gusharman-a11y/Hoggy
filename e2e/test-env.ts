import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Every e2e run gets a fresh, seeded temp database + uploads folder (never data/app.db).
 * playwright.config.ts calls this in the main process; workers and the dev server inherit
 * the env vars, so they all share the same files. Specs read the path via e2eDbPath().
 */
export function prepareE2eEnv(): void {
  if (process.env.E2E_DATA_DIR) return; // a worker re-loading the config: already prepared
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studyleave-e2e-"));
  process.env.E2E_DATA_DIR = dir;
  process.env.DATABASE_PATH = path.join(dir, "app.db");
  process.env.UPLOADS_DIR = path.join(dir, "uploads");
  execSync("npx tsx scripts/seed.ts", { stdio: "ignore", env: process.env });
}

/** The run's temp database file (set by prepareE2eEnv). */
export function e2eDbPath(): string {
  const p = process.env.DATABASE_PATH;
  if (!p || !process.env.E2E_DATA_DIR) throw new Error("e2e env not prepared (run via playwright.config.ts)");
  return p;
}
