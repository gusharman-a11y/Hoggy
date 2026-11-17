'use strict';
/* Small helpers shared by the course-source parsers (tools/courses/*.js). No network here. */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', hellip: '…' };
function decode(s) {
  return String(s == null ? '' : s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENTITIES ? ENTITIES[n.toLowerCase()] : m));
}

/* HTML fragment -> plain text, keeping line breaks for <br>, </p>, </div>, </tr>, </li>, </h*> */
function text(html) {
  let t = String(html || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  t = t.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d|td|th)>/gi, '\n');
  t = decode(t.replace(/<[^>]+>/g, ' ')).replace(/ /g, ' ');
  return t.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
}

const slug = (...a) => a.filter(x => x != null && x !== '').join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90).replace(/-+$/, '');

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const pad = n => String(n).padStart(2, '0');
/* "November 3, 2026", "3 November 2026", "Saturday 21st Nov 2026", "Wed, 25 Nov 2026" -> "2026-11-03"; null if not a real date */
function parseDate(s) {
  s = String(s || '').replace(/,/g, ' ').replace(/(\d+)(st|nd|rd|th)\b/gi, '$1').replace(/\s+/g, ' ').trim().replace(/\.$/, '');
  s = s.replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s+/i, '');
  let m = s.match(/^([a-z]+)\s+(\d{1,2})\s+(\d{4})$/i), d, mo, y;
  if (m) [mo, d, y] = [m[1], m[2], m[3]];
  else if ((m = s.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i))) [d, mo, y] = [m[1], m[2], m[3]];
  else return null;
  const i = MONTHS.findIndex(x => mo.length >= 3 && x.startsWith(mo.toLowerCase()));
  if (i < 0) return null;
  const iso = `${y}-${pad(i + 1)}-${pad(+d)}`;
  const t = new Date(iso + 'T00:00:00Z');
  return !isNaN(t) && t.toISOString().slice(0, 10) === iso ? iso : null;
}
const addDays = (iso, n) => { const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

/* Clean a booking link: unwrap Outlook safelinks, drop ad-tracking params, require https. Returns { url, note } (url null if unusable). */
const TRACKING = /^(utm_[a-z]+|gclid|gad_source|gad_campaignid|gbraid|wbraid|fbclid|msclkid)$/i;
function cleanUrl(raw) {
  let u = decode(String(raw || '').trim()), note;
  try {
    let x = new URL(u);
    if (/safelinks\.protection\.outlook\.com$/i.test(x.hostname) && x.searchParams.get('url')) {
      x = new URL(x.searchParams.get('url')); note = 'unwrapped from an Outlook safelinks URL on the source page';
    }
    if (x.protocol !== 'https:') return { url: null, note: 'source booking link was not https; points to source page' };
    let dropped = false;
    for (const k of [...x.searchParams.keys()]) if (TRACKING.test(k)) { x.searchParams.delete(k); dropped = true; }
    if (dropped) note = (note ? note + '; ' : '') + 'ad-tracking parameters removed';
    return { url: x.toString(), note };
  } catch { return { url: null, note: u ? 'source booking link was not a valid URL; points to source page' : undefined }; }
}

const AU_STATES = { 'australian capital territory': 'ACT', 'new south wales': 'NSW', 'northern territory': 'NT', queensland: 'QLD', 'south australia': 'SA', tasmania: 'TAS', victoria: 'VIC', 'western australia': 'WA' };

module.exports = { decode, text, slug, parseDate, addDays, cleanUrl, AU_STATES };
