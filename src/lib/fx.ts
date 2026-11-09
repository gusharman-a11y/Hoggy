/**
 * Indicative exchange rates to AUD, used only to prefill estimates when a
 * conference fee is in another currency. Not live rates: the trip page tells
 * the doctor to check the figure. Update by hand when they drift badly.
 */
export const INDICATIVE_AUD_PER_UNIT: Record<string, number> = {
  AUD: 1,
  CAD: 1.1,
  EUR: 1.65,
  GBP: 1.95,
  JPY: 0.0102,
  MYR: 0.34,
  NZD: 0.91,
  SGD: 1.15,
  USD: 1.52,
  ZAR: 0.084,
};

/** Converts integer cents in `currency` to AUD cents (rounded). Unknown currency -> undefined. */
export function toAudCents(cents: number, currency: string): number | undefined {
  const rate = INDICATIVE_AUD_PER_UNIT[currency.toUpperCase()];
  if (rate === undefined) return undefined;
  return Math.round(cents * rate);
}
