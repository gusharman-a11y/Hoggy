// Pulls conferences out of event web pages via schema.org JSON-LD
// (Event / EducationEvent and friends). Pure: no network, no database.

export interface ExtractedConference {
  name: string;
  /** Best guess from keywords/about/name; "General" when nothing matches. */
  specialty: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD (= start_date when missing)
  city: string;
  country: string;
  venue: string | null;
  lat: number | null;
  lng: number | null;
  url: string | null;
  cpd_points: number | null;
  registration_fee_cents: number | null;
  currency: string;
  source_url: string;
}

type Json = unknown;
type Obj = Record<string, Json>;

const EVENT_TYPES = new Set([
  "event",
  "educationevent",
  "businessevent",
  "eventseries",
  "courseinstance",
  "socialevent",
  "exhibitionevent",
]);

/** Specialties we recognise in keywords/about/name (first match wins). */
const SPECIALTIES: [string, RegExp][] = [
  ["Emergency Medicine", /\bemergency\b|\btrauma\b|\bresuscitation\b/i],
  ["Cardiology", /\bcardi|\bheart\b/i],
  ["Paediatrics", /\bpa?ediatric|\bneonat|\bchild health\b/i],
  ["Anaesthesia", /\bana?esthe|\bairway\b/i],
  ["General Practice", /\bgeneral practice\b|\bprimary care\b|\bfamily medicine\b|\bgp\b/i],
  ["Psychiatry", /\bpsychiatr|\bmental health\b/i],
  ["Orthopaedics", /\borthopa?edic/i],
  ["Oncology", /\boncolog|\bcancer\b/i],
  ["Obstetrics & Gynaecology", /\bobstetric|\bgyna?ecolog/i],
  ["Radiology", /\bradiolog|\bimaging\b/i],
  ["Intensive Care", /\bintensive care\b|\bcritical care\b|\bicu\b/i],
  ["Surgery", /\bsurg/i],
];

const COUNTRY_CODES: Record<string, string> = {
  AU: "Australia",
  NZ: "New Zealand",
  GB: "United Kingdom",
  UK: "United Kingdom",
  US: "United States",
  USA: "United States",
  CA: "Canada",
  IE: "Ireland",
  SG: "Singapore",
  ES: "Spain",
  FR: "France",
  DE: "Germany",
  IT: "Italy",
  NL: "Netherlands",
  JP: "Japan",
  ZA: "South Africa",
  AT: "Austria",
  CH: "Switzerland",
  PT: "Portugal",
  HK: "Hong Kong",
  AE: "United Arab Emirates",
  TH: "Thailand",
  IN: "India",
  DK: "Denmark",
  SE: "Sweden",
  NO: "Norway",
  FI: "Finland",
  BE: "Belgium",
  GR: "Greece",
};

const SCRIPT_RE = /<script\b[^>]*\btype\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;

/** Returns every conference found in the page's JSON-LD; [] if there is none or it is unreadable. */
export function extractEvents(html: string, pageUrl: string): ExtractedConference[] {
  const out: ExtractedConference[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(SCRIPT_RE)) {
    const data = parseJsonLd(m[1]);
    if (data === undefined) continue;
    for (const node of walk(data)) {
      if (!isEvent(node)) continue;
      const c = normalise(node, pageUrl);
      if (!c) continue;
      const key = `${c.name.toLowerCase()}|${c.start_date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}

function parseJsonLd(raw: string): Json | undefined {
  const text = raw
    .trim()
    .replace(/^<!--/, "")
    .replace(/-->$/, "")
    .replace(/^\/\/\s*<!\[CDATA\[/, "")
    .replace(/\/\/\s*\]\]>$/, "")
    .trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    try {
      // Common publisher mistake: trailing commas.
      return JSON.parse(text.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      return undefined;
    }
  }
}

/** Yields every object in the JSON-LD tree (arrays, @graph, nested subEvent). */
function* walk(node: Json, depth = 0): Generator<Obj> {
  if (depth > 8 || node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n, depth + 1);
    return;
  }
  const obj = node as Obj;
  yield obj;
  if (obj["@graph"]) yield* walk(obj["@graph"], depth + 1);
  if (obj.subEvent) yield* walk(obj.subEvent, depth + 1);
  if (obj.event) yield* walk(obj.event, depth + 1);
  if (obj.itemListElement) yield* walk(obj.itemListElement, depth + 1);
  if (obj.item) yield* walk(obj.item, depth + 1);
}

function types(node: Obj): string[] {
  const t = node["@type"];
  const list = Array.isArray(t) ? t : [t];
  return list
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.replace(/^.*[/:#]/, "").toLowerCase());
}

function isEvent(node: Obj): boolean {
  return types(node).some((t) => EVENT_TYPES.has(t));
}

function text(v: Json): string | null {
  if (typeof v === "string") return decodeEntities(v).replace(/\s+/g, " ").trim() || null;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) {
    for (const x of v) {
      const t = text(x);
      if (t) return t;
    }
    return null;
  }
  if (v && typeof v === "object") {
    const o = v as Obj;
    return text(o.name ?? o["@value"] ?? null);
  }
  return null;
}

function first(v: Json): Json {
  return Array.isArray(v) ? v[0] : v;
}

function num(v: Json): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.\-]/g, ""));
    return v.trim() && Number.isFinite(n) ? n : null;
  }
  return null;
}

function date(v: Json): string | null {
  const s = text(v);
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null;
  return `${y}-${mo}-${d}`;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&amp;/g, "&");
}

function country(v: Json): string | null {
  const c = text(v);
  if (!c) return null;
  return COUNTRY_CODES[c.toUpperCase()] ?? c;
}

function absolute(u: string | null, base: string): string | null {
  if (!u) return null;
  try {
    return new URL(u, base).toString();
  } catch {
    return null;
  }
}

function place(node: Obj): Obj | null {
  const locs = Array.isArray(node.location) ? node.location : [node.location];
  // Prefer a physical Place over a VirtualLocation.
  for (const l of locs) {
    if (l && typeof l === "object" && !types(l as Obj).includes("virtuallocation")) return l as Obj;
  }
  return null;
}

function guessSpecialty(node: Obj, name: string): string {
  const hay = [text(node.keywords), text(node.about), text(node.audience), name, text(node.description)]
    .filter(Boolean)
    .join(" | ");
  for (const [label, re] of SPECIALTIES) if (re.test(hay)) return label;
  return "General";
}

function offer(node: Obj): { cents: number | null; currency: string | null } {
  const offers = Array.isArray(node.offers) ? node.offers : node.offers ? [node.offers] : [];
  let best: { cents: number; currency: string | null } | null = null;
  for (const o of offers) {
    if (!o || typeof o !== "object") continue;
    const ob = o as Obj;
    const spec = first(ob.priceSpecification) as Obj | undefined;
    const price = num(ob.price ?? ob.lowPrice ?? spec?.price ?? null);
    if (price === null || price < 0) continue;
    const cur = text(ob.priceCurrency ?? spec?.priceCurrency ?? null);
    const cents = Math.round(price * 100);
    if (!best || cents < best.cents) best = { cents, currency: cur };
  }
  return best ?? { cents: null, currency: null };
}

function normalise(node: Obj, pageUrl: string): ExtractedConference | null {
  const name = text(node.name);
  const start = date(node.startDate);
  if (!name || !start) return null;
  let end = date(node.endDate) ?? start;
  if (end < start) end = start;

  const loc = place(node);
  const addr = (loc ? first(loc.address) : null) as Json;
  const addrObj = addr && typeof addr === "object" ? (addr as Obj) : null;
  const geo = (loc ? first(loc.geo) : null) as Obj | null;

  const city = text(addrObj?.addressLocality ?? null) ?? "";
  const ctry = country(addrObj?.addressCountry ?? null) ?? "";
  const venue = loc ? text(loc.name) : null;
  const { cents, currency } = offer(node);

  return {
    name,
    specialty: guessSpecialty(node, name),
    start_date: start,
    end_date: end,
    city,
    country: ctry,
    venue,
    lat: geo && typeof geo === "object" ? num(geo.latitude ?? null) : null,
    lng: geo && typeof geo === "object" ? num(geo.longitude ?? null) : null,
    url: absolute(text(node.url ?? null), pageUrl) ?? pageUrl,
    cpd_points: null,
    registration_fee_cents: cents,
    currency: (currency ?? "AUD").toUpperCase(),
    source_url: pageUrl,
  };
}
