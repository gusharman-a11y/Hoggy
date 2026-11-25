'use strict';
/* Validator for data/experiences/experiences.json (docs/research/experiences.md).
   node tools/check-experiences.js [file]  -> prints problems, exits 1 on any error.
   Rules: required fields, https source on an official page (not a blog, listing or booking site), fixed category vocabulary,
   a verbatim quote of at most 200 characters, valid dates (ISO for fixed events and dated seasons, MM-DD for recurring
   ranges), verifiedOn as an ISO date, summary at most 160 characters, and no superlatives (tools/copy-lint.js) or
   US spellings in our own words (title, summary, note). Quotes are the source's words and are not linted. */
const fs = require('fs'), path = require('path');
const { lint } = require('./copy-lint');
const { CATEGORIES } = require('./experiences');

const DATE_TYPES = ['seasonal', 'fixed-event'];
/* Hosts that are never a season or date source: listings, booking sites, blogs, encyclopaedias. */
const NOT_OFFICIAL = /(^|\.)(tripadvisor|viator|getyourguide|klook|expedia|booking|lonelyplanet|timeout|japan-guide|wikipedia|wikitravel|australiantraveller|onthesnow|snow-forecast|skiresort|culturetrip|thrillist|bali|travelandleisure|cntraveler|fodors|frommers|roughguides|tiqets|eventbrite|allevents|10times|wego|japantravel|livejapan|ticketmaster)\.[a-z.]+$/i;
const US_SPELLING = /\b(colors?|favorites?|organized?|organizes|traveling|traveler|centers?|theaters?)\b/; /* lower case only: proper names (Kennedy Space Center) are left alone */
const isoOk = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const mdOk = s => { if (!/^\d{2}-\d{2}$/.test(s)) return false; const m = +s.slice(0, 2), d = +s.slice(3); return m >= 1 && m <= 12 && d >= 1 && d <= [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; };
const httpsOk = u => { try { return new URL(u).protocol === 'https:'; } catch (e) { return false; } };

function check(doc) {
  const errors = [], warnings = [];
  const list = doc && Array.isArray(doc.experiences) ? doc.experiences : null;
  if (!list) return { errors: ['file has no experiences array'], warnings, count: 0 };
  const ids = new Set();
  for (const [i, e] of list.entries()) {
    const at = `#${i} ${e && e.id || '(no id)'}`;
    const err = m => errors.push(`${at}: ${m}`);
    if (!e || typeof e !== 'object') { err('not an object'); continue; }
    for (const k of ['id', 'place', 'title', 'category', 'season', 'dateType', 'summary', 'sourceUrl', 'sourceQuote', 'verifiedOn']) if (e[k] == null || e[k] === '') err(`missing ${k}`);
    if (e.id && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id)) err('id must be lower-case words joined by hyphens');
    if (ids.has(e.id)) err('duplicate id'); ids.add(e.id);
    const p = e.place || {};
    if (!p.city || !p.countryCode || !/^[A-Z]{2}$/.test(p.countryCode)) err('place needs city and a two-letter countryCode');
    if (!(Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 && Number.isFinite(p.lng) && Math.abs(p.lng) <= 180)) err('place lat/lng invalid');
    if (!(Number.isFinite(p.radiusKm) && p.radiusKm > 0 && p.radiusKm <= 5000)) err('place radiusKm must be 1-5000');
    if (p.nearby && !Array.isArray(p.nearby)) err('place nearby must be an array');
    if (p.sameCountry != null && typeof p.sameCountry !== 'boolean') err('place sameCountry must be true/false');
    if (e.category && !CATEGORIES.includes(e.category)) err(`category "${e.category}" not in vocabulary`);
    if (e.dateType && !DATE_TYPES.includes(e.dateType)) err(`dateType "${e.dateType}" must be seasonal or fixed-event`);
    const s = e.season || {};
    const hasDates = Array.isArray(s.dates) && s.dates.length, hasRanges = Array.isArray(s.ranges) && s.ranges.length;
    if (!hasDates && !hasRanges) err('season needs dates [{start,end}] or ranges [{from,to}]');
    if (e.dateType === 'fixed-event' && !hasDates) err('a fixed event needs exact dates');
    for (const r of s.dates || []) {
      if (!isoOk(r.start) || !isoOk(r.end)) err(`bad date ${JSON.stringify(r)}`);
      else if (r.end < r.start) err(`date ends before it starts ${JSON.stringify(r)}`);
      else if ((Date.parse(r.end) - Date.parse(r.start)) / 864e5 > (e.dateType === 'fixed-event' ? 200 : 366)) err(`date range too long for a ${e.dateType} ${JSON.stringify(r)}`);
    }
    for (const r of s.ranges || []) if (!mdOk(r.from) || !mdOk(r.to)) err(`bad MM-DD range ${JSON.stringify(r)}`);
    if (typeof e.summary === 'string' && e.summary.length > 160) err(`summary is ${e.summary.length} characters (max 160)`);
    if (typeof e.title === 'string' && e.title.length > 90) err('title longer than 90 characters');
    if (e.sourceUrl && !httpsOk(e.sourceUrl)) err('sourceUrl must be https');
    else if (e.sourceUrl && NOT_OFFICIAL.test(new URL(e.sourceUrl).hostname)) err(`sourceUrl host ${new URL(e.sourceUrl).hostname} is a listing, blog or booking site`);
    if (typeof e.sourceQuote === 'string') {
      if (e.sourceQuote.length > 200) err(`sourceQuote is ${e.sourceQuote.length} characters (max 200)`);
      if (e.sourceQuote.trim().length < 6) err('sourceQuote too short to support the date or season');
    }
    if (e.verifiedOn && !isoOk(e.verifiedOn)) err('verifiedOn must be an ISO date');
    for (const k of ['title', 'summary', 'note']) if (typeof e[k] === 'string') {
      for (const h of lint(e[k])) err(`copy lint: "${h.word}" in ${k}`);
      const u = e[k].match(US_SPELLING); if (u) err(`US spelling "${u[0]}" in ${k} (Australian English)`);
    }
    if (e.family != null && typeof e.family !== 'boolean') err('family must be true/false');
    if (hasDates && e.dateType === 'fixed-event' && s.dates.every(r => r.end < (doc.generated || '2000-01-01'))) warnings.push(`${at}: every date is before the file was generated`);
  }
  return { errors, warnings, count: list.length };
}

if (require.main === module) {
  const file = process.argv[2] || path.join(__dirname, '..', 'data', 'experiences', 'experiences.json');
  const { errors, warnings, count } = check(JSON.parse(fs.readFileSync(file, 'utf8')));
  for (const w of warnings) console.log('warning: ' + w);
  for (const e of errors) console.log('error: ' + e);
  console.log(`check-experiences: ${count} experiences, ${errors.length} errors, ${warnings.length} warnings`);
  process.exit(errors.length ? 1 : 0);
}
module.exports = { check };
