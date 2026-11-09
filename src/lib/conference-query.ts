import type { ConferenceFilters } from "./conferences";

export type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

/** Reads q/specialty/country/month from URL query params into upcoming-only search filters. */
export function filtersFromParams(params: SearchParams, today: string): Required<Omit<ConferenceFilters, "from">> & { from: string } {
  const month = first(params.month);
  return {
    q: first(params.q),
    specialty: first(params.specialty),
    country: first(params.country),
    month: /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : "",
    from: today,
  };
}
