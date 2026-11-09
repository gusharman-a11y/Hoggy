const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

/** "15–17 Feb 2027", "30 Mar – 2 Apr 2027", "30 Dec 2027 – 2 Jan 2028", "15 Feb 2027". */
export function formatDateRange(start: string, end: string): string {
  const [sy, sm, sd] = parts(start);
  const [ey, em, ed] = parts(end || start);
  if (start === end || !end) return `${sd} ${MONTHS[sm - 1]} ${sy}`;
  if (sy === ey && sm === em) return `${sd}–${ed} ${MONTHS[sm - 1]} ${sy}`;
  if (sy === ey) return `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]} ${sy}`;
  return `${sd} ${MONTHS[sm - 1]} ${sy} – ${ed} ${MONTHS[em - 1]} ${ey}`;
}

/** A date or ISO timestamp as "20 Mar 2027" (the timestamp's UTC date). */
export function formatDate(iso: string): string {
  return formatDateRange(iso.slice(0, 10), iso.slice(0, 10));
}

/** Today's date as YYYY-MM-DD (UTC). */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Integer cents -> "AUD 950.00" style money ("A$950.00" etc. via Intl, en-AU). Null -> "TBC". */
export function formatMoney(cents: number | null | undefined, currency = "AUD"): string {
  if (cents == null) return "TBC";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, currencyDisplay: "code" })
    .format(cents / 100)
    .replace(/ /g, " ");
}

/**
 * Parses a money amount typed by a person ("950", "$1,234.50", " 12.5 ") into integer cents.
 * Blank -> 0. Returns undefined for anything that isn't a non-negative amount with at most 2 decimals.
 */
export function parseMoneyToCents(input: string | null | undefined): number | undefined {
  const s = String(input ?? "").replace(/[\s,$]/g, "").replace(/^AUD/i, "");
  if (s === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return undefined;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

/** Integer cents -> "950.00" for an <input> value. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
