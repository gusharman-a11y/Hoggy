import { describe, expect, it } from "vitest";
import { databasePath, isDemoMode, uploadsDir } from "./runtime";

describe("runtime paths", () => {
  it("is demo mode with DEMO_MODE=1/true or on Vercel", () => {
    expect(isDemoMode({})).toBe(false);
    expect(isDemoMode({ DEMO_MODE: "0" })).toBe(false);
    expect(isDemoMode({ DEMO_MODE: "1" })).toBe(true);
    expect(isDemoMode({ DEMO_MODE: "true" })).toBe(true);
    expect(isDemoMode({ VERCEL: "1" })).toBe(true);
  });

  it("defaults to data/ normally and /tmp/hoggy in demo mode", () => {
    expect(databasePath({})).toMatch(/data[\\/]app\.db$/);
    expect(uploadsDir({})).toMatch(/data[\\/]uploads$/);
    expect(databasePath({ DEMO_MODE: "1" })).toBe("/tmp/hoggy/app.db");
    expect(uploadsDir({ VERCEL: "1" })).toBe("/tmp/hoggy/uploads");
  });

  it("always respects explicit paths, ignoring blank ones", () => {
    const env = { DEMO_MODE: "1", DATABASE_PATH: "/x/db.sqlite", UPLOADS_DIR: "/x/up" };
    expect(databasePath(env)).toBe("/x/db.sqlite");
    expect(uploadsDir(env)).toBe("/x/up");
    expect(databasePath({ DEMO_MODE: "1", DATABASE_PATH: "" })).toBe("/tmp/hoggy/app.db");
  });
});
