/** Reads ?year=YYYY (2000–2100); undefined when missing or invalid. */
export function yearFromParam(v: string | string[] | undefined): number | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s || !/^\d{4}$/.test(s)) return undefined;
  const y = Number(s);
  return y >= 2000 && y <= 2100 ? y : undefined;
}
