import { describe, expect, it } from "vitest";
import { formatDateRange, todayIso } from "./format";
import { filtersFromParams } from "./conference-query";

describe("formatDateRange", () => {
  it("formats single days, same month, cross month and cross year", () => {
    expect(formatDateRange("2027-02-15", "2027-02-15")).toBe("15 Feb 2027");
    expect(formatDateRange("2027-02-15", "2027-02-17")).toBe("15–17 Feb 2027");
    expect(formatDateRange("2027-03-30", "2027-04-02")).toBe("30 Mar – 2 Apr 2027");
    expect(formatDateRange("2027-12-30", "2028-01-02")).toBe("30 Dec 2027 – 2 Jan 2028");
  });
  it("todayIso", () => {
    expect(todayIso(new Date("2026-11-09T05:00:00Z"))).toBe("2026-11-09");
  });
});

describe("filtersFromParams", () => {
  it("trims, takes the first of repeated params, drops bad months, always upcoming", () => {
    expect(filtersFromParams({ q: "  heart ", specialty: ["Cardiology", "x"], month: "2027-13" }, "2026-11-09")).toEqual({
      q: "heart",
      specialty: "Cardiology",
      country: "",
      month: "",
      from: "2026-11-09",
    });
    expect(filtersFromParams({ month: "2027-03" }, "2026-11-09").month).toBe("2027-03");
  });
});
