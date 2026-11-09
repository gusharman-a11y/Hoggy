/**
 * City -> main airport (IATA code) for the sample conference cities plus the
 * usual Australian departure cities. Good enough to prefill a flight search;
 * a real airport search comes with the live flight provider.
 */
export const CITY_TO_IATA: Record<string, string> = {
  adelaide: "ADL",
  auckland: "AKL",
  barcelona: "BCN",
  boston: "BOS",
  brisbane: "BNE",
  cairns: "CNS",
  canberra: "CBR",
  "cape town": "CPT",
  christchurch: "CHC",
  darwin: "DRW",
  dubbo: "DBO",
  dublin: "DUB",
  edinburgh: "EDI",
  "gold coast": "OOL",
  hobart: "HBA",
  "kuala lumpur": "KUL",
  lisbon: "LIS",
  london: "LHR",
  melbourne: "MEL",
  munich: "MUC",
  newcastle: "NTL",
  perth: "PER",
  "san francisco": "SFO",
  singapore: "SIN",
  sydney: "SYD",
  tokyo: "HND",
  toronto: "YYZ",
  vancouver: "YVR",
  wellington: "WLG",
};

const IATA_CODES = new Set(Object.values(CITY_TO_IATA));

/**
 * "Sydney" / " sydney " / "SYD" -> "SYD". Any other 3-letter code is passed
 * through upper-cased (the doctor may know their airport). Unknown -> undefined.
 */
export function cityToIata(input: string | null | undefined): string | undefined {
  const s = (input ?? "").trim();
  if (!s) return undefined;
  const byCity = CITY_TO_IATA[s.toLowerCase().replace(/\s+/g, " ")];
  if (byCity) return byCity;
  if (/^[a-z]{3}$/i.test(s)) return s.toUpperCase();
  return undefined;
}

/** True when the code is one of the airports in CITY_TO_IATA. */
export function isKnownAirport(code: string): boolean {
  return IATA_CODES.has(code.toUpperCase());
}
