import { describe, expect, it } from "vitest";
import { APP_NAME, TAGLINE } from "./site";

describe("site", () => {
  it("has a name and a one-line tagline", () => {
    expect(APP_NAME).toBe("StudyLeave");
    expect(TAGLINE.length).toBeGreaterThan(0);
    expect(TAGLINE).not.toContain("\n");
  });
});
