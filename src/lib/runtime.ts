import path from "node:path";

type Env = Record<string, string | undefined>;

/** Root for the demo's writable data: serverless hosts (Vercel) only allow writes under /tmp. */
export const DEMO_DATA_DIR = "/tmp/hoggy";

/** Demo mode: DEMO_MODE=1 (or true), or running on Vercel. Data lives in /tmp and is seeded on first open. */
export function isDemoMode(env: Env = process.env): boolean {
  const flag = (env.DEMO_MODE ?? "").trim().toLowerCase();
  return flag === "1" || flag === "true" || Boolean(env.VERCEL);
}

/** Database file: DATABASE_PATH, else /tmp/hoggy/app.db in demo mode, else data/app.db. */
export function databasePath(env: Env = process.env): string {
  if (env.DATABASE_PATH) return env.DATABASE_PATH;
  return isDemoMode(env)
    ? path.join(DEMO_DATA_DIR, "app.db")
    : path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "app.db");
}

/** Receipt files: UPLOADS_DIR, else /tmp/hoggy/uploads in demo mode, else data/uploads. */
export function uploadsDir(env: Env = process.env): string {
  if (env.UPLOADS_DIR) return env.UPLOADS_DIR;
  return isDemoMode(env)
    ? path.join(DEMO_DATA_DIR, "uploads")
    : path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "uploads");
}
