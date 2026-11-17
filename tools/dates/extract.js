'use strict';
/* Date-range extraction for tools/verify-dates.js. Pure functions, no network.
   pageText(html)            visible text (one line per block) plus the page title and h1
   jsonLdEvents(html)        schema.org Event objects: [{ name, start, end, raw }]
   findRanges(text, opts)    every date or date range written in the text: [{ start, end, index, length, raw, ambiguous }]
   Formats: "12–14 March 2027", "12 to 14 Mar 2027", "30 March – 2 April 2027", "30 December 2026 – 2 January 2027",
   "March 12-14, 2027", "March 30 – April 2, 2027", "March 12, 2027 – March 14, 2027", "12/03/2027 – 14/03/2027",
   "12-14.03.2027", "2027-03-12 to 2027-03-14", single dates in each style, and month names in English, French, Spanish,
   Portuguese, German and Italian ("17 a 20 de março de 2027", "du 12 au 14 mars 2027", "12.–14. März 2027"). */
const { decode: baseDecode } = require('../courses/util');
/* named entities common on society pages, beyond the few tools/courses/util.js knows */
const MORE = { middot: '·', bull: '•', copy: '©', reg: '®', trade: '™', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', sbquo: '‚', bdquo: '„', thinsp: ' ', ensp: ' ', emsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', agrave: 'à', egrave: 'è', ograve: 'ò', acirc: 'â', ecirc: 'ê', ocirc: 'ô', atilde: 'ã', otilde: 'õ', ntilde: 'ñ', ccedil: 'ç', auml: 'ä', ouml: 'ö', uuml: 'ü', szlig: 'ß', deg: '°', ordm: 'º', ordf: 'ª' };
const decode = s => baseDecode(String(s == null ? '' : s).replace(/&([a-z]+);/gi, (m, n) => MORE[n] || MORE[n.toLowerCase()] || m));

const MONTH_NAMES = [
  ['january', 'jan', 'janvier', 'janv', 'enero', 'ene', 'janeiro', 'januar', 'jänner', 'gennaio', 'genn'],
  ['february', 'feb', 'février', 'fevrier', 'févr', 'fevr', 'febrero', 'fevereiro', 'fev', 'februar', 'febbraio'],
  ['march', 'mar', 'mars', 'marzo', 'março', 'marco', 'märz', 'maerz'],
  ['april', 'apr', 'avril', 'avr', 'abril', 'abr', 'aprile'],
  ['may', 'mai', 'mayo', 'maio', 'maggio', 'mag'],
  ['june', 'jun', 'juin', 'junio', 'junho', 'juni', 'giugno', 'giu'],
  ['july', 'jul', 'juillet', 'juil', 'julio', 'julho', 'juli', 'luglio', 'lug'],
  ['august', 'aug', 'août', 'aout', 'agosto', 'ago'],
  ['september', 'sep', 'sept', 'septembre', 'septiembre', 'setiembre', 'setembro', 'set', 'settembre'],
  ['october', 'oct', 'octobre', 'octubre', 'outubro', 'out', 'oktober', 'okt', 'ottobre', 'ott'],
  ['november', 'nov', 'novembre', 'noviembre', 'novembro'],
  ['december', 'dec', 'décembre', 'decembre', 'déc', 'diciembre', 'dic', 'dezembro', 'dez', 'dezember', 'dicembre']
];
const MONTH = new Map(); MONTH_NAMES.forEach((names, i) => names.forEach(n => MONTH.set(n, i + 1)));
const MON = '(' + [...MONTH.keys()].sort((a, b) => b.length - a.length).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\.?';
const D = '(\\d{1,2})(?:st|nd|rd|th|er|º|°|\\.)?';
const Y = '((?:19|20)\\d{2})';
const SEP = '\\s*(?:-|to|until|till|through|thru|au|bis|a|al|até|ao|y|e|et|and|&)\\s*';
const OF = '(?:\\s+de|\\s+del)?\\s*';           /* "17 de março", "12 de marzo de 2027" */
const YS = '(?:,|\\s+de|\\s+del)?\\s*';          /* before the year */
const WD = /(?<!\p{L})(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lunes|martes|miércoles|jueves|viernes|sábado|domingo|segunda-feira|terça-feira|quarta-feira|quinta-feira|sexta-feira|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)(?!\p{L}),?/giu;

const pad = n => String(n).padStart(2, '0');
function iso(y, m, d) {
  y = +y; m = +m; d = +d; if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const s = `${y}-${pad(m)}-${pad(d)}`, t = new Date(s + 'T00:00:00Z');
  return !isNaN(t) && t.toISOString().slice(0, 10) === s ? s : null;
}
const mon = s => MONTH.get(String(s).toLowerCase().replace(/\.$/, ''));

/* patterns, longest first; each returns [start, end] or null. Dashes and spaces are normalised before matching. */
const PATTERNS = [
  /* 30 December 2026 - 2 January 2027 */
  [new RegExp(`\\b${D}${OF}${MON}${YS}${Y}${SEP}${D}${OF}${MON}${YS}${Y}\\b`, 'gi'), m => [iso(m[3], mon(m[2]), m[1]), iso(m[6], mon(m[5]), m[4])]],
  /* March 12, 2027 - March 14, 2027 */
  [new RegExp(`\\b${MON}\\s+${D}${YS}${Y}${SEP}${MON}\\s+${D}${YS}${Y}\\b`, 'gi'), m => [iso(m[3], mon(m[1]), m[2]), iso(m[6], mon(m[4]), m[5])]],
  /* 30 March - 2 April 2027 */
  [new RegExp(`\\b${D}${OF}${MON}${SEP}${D}${OF}${MON}${YS}${Y}\\b`, 'gi'), m => [iso(m[5], mon(m[2]), m[1]), iso(m[5], mon(m[4]), m[3])]],
  /* March 30 - April 2, 2027 */
  [new RegExp(`\\b${MON}\\s+${D}${SEP}${MON}\\s+${D}${YS}${Y}\\b`, 'gi'), m => [iso(m[5], mon(m[1]), m[2]), iso(m[5], mon(m[3]), m[4])]],
  /* 12-14 March 2027, 17 a 20 de março de 2027, 12.-14. März 2027 */
  [new RegExp(`\\b${D}${SEP}${D}${OF}${MON}${YS}${Y}\\b`, 'gi'), m => [iso(m[4], mon(m[3]), m[1]), iso(m[4], mon(m[3]), m[2])]],
  /* March 12-14, 2027 */
  [new RegExp(`\\b${MON}\\s+${D}${SEP}${D}${YS}${Y}\\b`, 'gi'), m => [iso(m[4], mon(m[1]), m[2]), iso(m[4], mon(m[1]), m[3])]],
  /* 2027-03-12 to 2027-03-14 */
  [new RegExp(`\\b${Y}-(\\d{2})-(\\d{2})${SEP}${Y}-(\\d{2})-(\\d{2})\\b`, 'g'), m => [iso(m[1], m[2], m[3]), iso(m[4], m[5], m[6])]],
  /* 12/03/2027 - 14/03/2027 (day first unless the numbers say otherwise, or mdy) */
  [new RegExp(`\\b(\\d{1,2})[./](\\d{1,2})[./]${Y}${SEP}(\\d{1,2})[./](\\d{1,2})[./]${Y}\\b`, 'g'), (m, o) => numeric([[m[1], m[2], m[3]], [m[4], m[5], m[6]]], o)],
  /* 12-14.03.2027, 12.-14.03.2027 */
  [new RegExp(`\\b(\\d{1,2})\\.?${SEP}(\\d{1,2})\\.(\\d{1,2})\\.${Y}\\b`, 'g'), m => [iso(m[4], m[3], m[1]), iso(m[4], m[3], m[2])]],
  /* single dates */
  [new RegExp(`\\b${D}${OF}${MON}${YS}${Y}\\b`, 'gi'), m => { const s = iso(m[3], mon(m[2]), m[1]); return [s, s]; }],
  [new RegExp(`\\b${MON}\\s+${D}${YS}${Y}\\b`, 'gi'), m => { const s = iso(m[3], mon(m[1]), m[2]); return [s, s]; }],
  [new RegExp(`\\b${Y}-(\\d{2})-(\\d{2})\\b`, 'g'), m => { const s = iso(m[1], m[2], m[3]); return [s, s]; }],
  [new RegExp(`\\b(\\d{1,2})[./](\\d{1,2})[./]${Y}\\b`, 'g'), (m, o) => { const r = numeric([[m[1], m[2], m[3]]], o); return r && [r[0], r[0], r.ambiguous]; }]
];
/* numeric dates: day first by default, month first with opts.mdy (US pages); a part above 12 settles it; otherwise flagged */
function numeric(parts, o) {
  const dayFirst = parts.some(([a]) => +a > 12) ? true : parts.some(([, b]) => +b > 12) ? false : !(o && o.mdy);
  const amb = !parts.some(([a, b]) => +a > 12 || +b > 12) && parts.some(([a, b]) => a !== b);
  const ds = parts.map(([a, b, y]) => dayFirst ? iso(y, b, a) : iso(y, a, b));
  if (ds.some(x => !x)) return null;
  const r = ds.length === 1 ? [ds[0], ds[0]] : ds; r.ambiguous = amb; return r;
}
/* length-preserving, so match positions index the original text and quotes stay verbatim */
const norm = s => String(s).replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-').replace(/\u00a0/g, ' ').replace(WD, m => ' '.repeat(m.length));

function findRanges(text, opts = {}) {
  const t = norm(text), hits = [];
  for (const [re, fn] of PATTERNS) {
    re.lastIndex = 0;
    for (const m of t.matchAll(re)) {
      const r = fn(m, opts); if (!r || !r[0] || !r[1] || r[1] < r[0]) continue;
      hits.push({ start: r[0], end: r[1], index: m.index, length: m[0].length, raw: String(text).slice(m.index, m.index + m[0].length).replace(/\s+/g, ' ').trim(), ambiguous: !!(r.ambiguous || r[2]) });
    }
  }
  /* keep the longest match where matches overlap ("12-14 March 2027" over "14 March 2027") */
  hits.sort((a, b) => b.length - a.length || a.index - b.index);
  const kept = [];
  for (const h of hits) if (!kept.some(k => h.index < k.index + k.length && k.index < h.index + h.length)) kept.push(h);
  return kept.sort((a, b) => a.index - b.index);
}

/* visible text, one block per line; script/style/noscript removed (JSON-LD is read separately) */
function pageText(html) {
  const h = String(html || '');
  const title = decode(((h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  const h1 = decode(((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  let t = h.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<head\b[\s\S]*?<\/head>/i, ' ');
  t = t.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d|td|th|section|article|header|footer|dd|dt|time|span class="date[^"]*")>/gi, '\n').replace(/<(p|div|li|h\d|tr|section|article)\b[^>]*>/gi, '\n');
  t = decode(t.replace(/<[^>]+>/g, ' '));
  const text = t.split('\n').map(l => l.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean).join('\n');
  return { title, h1, text };
}

/* schema.org Event objects from JSON-LD blocks */
function jsonLdEvents(html) {
  const out = [];
  const walk = n => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    const t = [].concat(n['@type'] || []);
    if (t.some(x => /Event$/.test(String(x))) && n.startDate) {
      const s = String(n.startDate).slice(0, 10), e = String(n.endDate || n.startDate).slice(0, 10);
      if (iso(s.slice(0, 4), s.slice(5, 7), s.slice(8, 10)) && iso(e.slice(0, 4), e.slice(5, 7), e.slice(8, 10))) out.push({ name: String(n.name || ''), start: s, end: e });
    }
    Object.values(n).forEach(walk);
  };
  for (const m of String(html || '').matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) { try { walk(JSON.parse(m[1])); } catch (e) { /* broken JSON-LD: ignore */ } }
  return out;
}

/* links on the page (absolute https), for the one hop from a site root to the event page */
function links(html, base) {
  const out = [];
  for (const m of String(html || '').matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try { const u = new URL(decode(m[1]), base); if (u.protocol === 'https:') out.push({ url: u.toString(), text: decode(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() }); } catch (e) { /* bad href */ }
  }
  return out;
}

/* the line around a match, at most max characters, always containing the match itself (verbatim, whitespace collapsed) */
function quoteAround(text, index, length, max = 200) {
  const t = String(text);
  let a = t.lastIndexOf('\n', index) + 1, b = t.indexOf('\n', index + length); if (b < 0) b = t.length;
  if (b - a > max) {
    const room = Math.max(0, max - length), before = Math.min(index - a, Math.floor(room / 2));
    a = index - before; b = Math.min(b, a + max);
    const sp = t.indexOf(' ', a); if (sp > 0 && sp < index && a > 0) a = sp + 1;
    const ep = t.lastIndexOf(' ', b); if (ep > index + length && b < t.length) b = ep;
  }
  return t.slice(a, b).replace(/\s+/g, ' ').trim();
}

module.exports = { findRanges, pageText, jsonLdEvents, links, quoteAround, MONTH, norm };
