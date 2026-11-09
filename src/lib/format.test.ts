import { describe, expect, it } from "vitest";
import { centsToInput, formatDateRange, formatMoney, parseMoneyToCents, todayIso } from "./format";
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

describe("formatMoney", () => {
  it("formats cents with the currency code, TBC for null", () => {
    expect(formatMoney(95000, "AUD")).toBe("AUD 950.00");
    expect(formatMoney(123456, "EUR")).toBe("EUR 1,234.56");
    expect(formatMoney(0)).toBe("AUD 0.00");
    expect(formatMoney(null, "GBP")).toBe("TBC");
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

describe("parseMoneyToCents", () => {
  it.each([
    ["950", 95000],
    ["950.5", 95050],
    ["$1,234.56", 123456],
    [" AUD 12 ", 1200],
    ["", 0],
    ["0", 0],
  ])("%s -> %s", (input, cents) => expect(parseMoneyToCents(input)).toBe(cents));

  it.each(["abc", "-5", "1.234", "1e3", "12.3.4"])("rejects %s", (input) =>
    expect(parseMoneyToCents(input)).toBeUndefined(),
  );

  it("centsToInput round-trips", () => {
    expect(centsToInput(95050)).toBe("950.50");
    expect(parseMoneyToCents(centsToInput(123456))).toBe(123456);
  });
});
