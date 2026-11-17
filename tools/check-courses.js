'use strict';
/* Validates data/courses/catalogue.json and data/courses/sessions.json against the Hoggy data rules
   (docs/team/country-desks.md): https only, evidence on every confirmed row, sane dates, no duplicates,
   no superlatives, CPD only when cited. Exits 1 on any error.
   Usage: node tools/check-courses.js [--today YYYY-MM-DD] [--dir DIR]   (--dir: check a copy, e.g. before a refresh writes) */
const fs = require('node:fs'), path = require('node:path');
const di = process.argv.indexOf('--dir');
const dir = di > 0 ? path.resolve(process.argv[di + 1]) : path.join(__dirname, '..', 'data', 'courses');
const ti = process.argv.indexOf('--today');
const today = ti > 0 ? process.argv[ti + 1] : new Date().toISOString().slice(0, 10);
const errors = [], warnings = [];
const err = (w, m) => errors.push(`${w}: ${m}`), warn = (w, m) => warnings.push(`${w}: ${m}`);

function load(f) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); }
  catch (e) { err(f, 'cannot read/parse: ' + e.message); return null; }
}
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const isHttps = u => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };
const SUPER = /\b(best|largest|leading|premier|world[- ]class|top[- ]rated|number one|#1|biggest)\b/i;
const URL_KEYS = /(^url$|Url$|^schedulePage$|^calendar$|^feed$)/;

function checkUrls(obj, where) {
  if (Array.isArray(obj)) return obj.forEach((x, i) => checkUrls(x, `${where}[${i}]`));
  if (!obj || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    if (URL_KEYS.test(k) && v != null && !isHttps(v)) err(where, `${k} is not an https URL: ${v}`);
    else if (typeof v === 'object') checkUrls(v, `${where}.${k}`);
  }
}

const cat = load('catalogue.json'), ses = load('sessions.json');
const courseIds = new Set();
if (cat) {
  if (!Array.isArray(cat.courses)) err('catalogue', 'courses must be an array');
  for (const [i, c] of (cat.courses || []).entries()) {
    const w = `catalogue[${c && c.id || i}]`;
    for (const k of ['id', 'name']) if (!c[k] || typeof c[k] !== 'string') err(w, `missing ${k}`);
    if (c.id && !/^[a-z0-9-]+$/.test(c.id)) err(w, 'id must be lowercase a-z0-9-');
    if (courseIds.has(c.id)) err(w, 'duplicate course id'); courseIds.add(c.id);
    if (!Array.isArray(c.providers) || !c.providers.length) err(w, 'needs at least one provider');
    else c.providers.forEach((p, j) => { if (!p.name) err(w, `provider[${j}] missing name`); if (!p.url) err(w, `provider[${j}] missing url`); });
    checkUrls(c, w);
    if (c.certificateValidityYears != null) {
      if (!(c.certificateValidityYears > 0 && c.certificateValidityYears <= 10)) err(w, 'certificateValidityYears out of range');
      if (!c.validitySource || !isHttps(c.validitySource)) err(w, 'certificateValidityYears needs an https validitySource');
      if (!c.validityQuote) err(w, 'certificateValidityYears needs a validityQuote');
    }
    if (c.feeRange != null && (!c.feeSource || !isHttps(c.feeSource))) err(w, 'feeRange needs an https feeSource');
    if (c.cpdHours && !(c.cpdSource && isHttps(c.cpdSource))) err(w, 'cpdHours > 0 needs an https cpdSource (0 = check provider)');
    if (c.verified === true && (!isDate(c.lastVerified) || c.lastVerified > today)) err(w, 'verified entry needs lastVerified (not in the future)');
    if (c.verified !== true) warn(w, 'not verified against a provider page yet');
    if (c.verified !== true && (c.certificateValidityYears != null || c.feeRange != null || c.cpdHours)) err(w, 'unverified entry carries facts');
    for (const cc of c.cpdByCollege || []) if (!isHttps(cc.sourceUrl) || !cc.quote) err(w, `cpdByCollege ${cc.college} needs https sourceUrl + quote`);
    for (const k of ['name', 'audience', 'format', 'recertification', 'cpdNote']) if (typeof c[k] === 'string' && SUPER.test(c[k])) err(w, `superlative in ${k}`);
  }
}

if (cat) for (const c of cat.courses || []) for (const k of ['nzEquivalent', 'nzEquivalentOf']) if (c[k] && !courseIds.has(c[k])) err(`catalogue[${c.id}]`, `${k} points to unknown course ${c[k]}`);

if (ses) {
  if (!Array.isArray(ses.sessions)) err('sessions', 'sessions must be an array');
  const ids = new Set(), keys = new Set();
  const REQ = ['id', 'courseId', 'provider', 'city', 'region', 'country', 'start', 'end', 'bookingUrl', 'sourceUrl', 'datesQuote', 'lastVerified'];
  for (const [i, s] of (ses.sessions || []).entries()) {
    const w = `session[${s && s.id || i}]`;
    for (const k of REQ) if (s[k] == null || s[k] === '') err(w, `missing ${k}`);
    if (ids.has(s.id)) err(w, 'duplicate id'); ids.add(s.id);
    const key = [s.courseId, s.provider, s.city, s.start, s.end, s.venue || ''].join('|').toLowerCase();
    if (keys.has(key)) err(w, 'duplicate session (same course/provider/city/dates/venue)'); keys.add(key);
    if (s.courseId && !courseIds.has(s.courseId)) err(w, `unknown courseId ${s.courseId}`);
    if (s.country && !['AU', 'NZ'].includes(s.country)) err(w, `country must be AU or NZ, got ${s.country}`);
    if (!isDate(s.start)) err(w, 'start is not YYYY-MM-DD');
    if (!isDate(s.end)) err(w, 'end is not YYYY-MM-DD');
    if (isDate(s.start) && isDate(s.end)) {
      if (s.end < s.start) err(w, 'end before start');
      const days = (Date.parse(s.end) - Date.parse(s.start)) / 864e5;
      if (days > 14) err(w, `session spans ${days} days (>14), check dates`);
      if (s.end < today) warn(w, 'session already finished, drop on next refresh');
      if (s.start > String(+today.slice(0, 4) + 3) + today.slice(4)) err(w, 'start more than 3 years ahead');
    }
    if (!isDate(s.lastVerified) || s.lastVerified > today) err(w, 'lastVerified must be a date, not in the future');
    if (s.endInferred != null && typeof s.endInferred !== 'boolean') err(w, 'endInferred must be boolean');
    if (s.datesConfirmed !== true) err(w, 'datesConfirmed must be true (only provider-page sessions belong here)');
    for (const k of ['bookingUrl', 'sourceUrl']) if (s[k] && !isHttps(s[k])) err(w, `${k} not https`);
    if (typeof s.datesQuote === 'string' && s.datesQuote.length > 300) warn(w, 'datesQuote longer than 300 chars');
    if (s.priceFrom != null) {
      if (typeof s.priceFrom !== 'number' || s.priceFrom <= 0) err(w, 'priceFrom must be a positive number or null');
      if (!['AUD', 'NZD', 'USD'].includes(s.currency)) err(w, 'priceFrom needs currency AUD/NZD/USD');
    }
    if (s.seatsStatus != null && !['open', 'full', 'waitlist'].includes(s.seatsStatus)) err(w, 'seatsStatus must be open/full/waitlist/null');
    if (s.cpdHours && !(s.cpdSource && isHttps(s.cpdSource))) err(w, 'cpdHours > 0 needs cpdSource');
  }
  if (!(ses.sessions || []).length) warn('sessions', 'no sessions yet');
}

for (const m of warnings) console.log('warn  ' + m);
for (const m of errors) console.log('ERROR ' + m);
console.log(`courses: ${courseIds.size}, sessions: ${ses && ses.sessions ? ses.sessions.length : 0}, errors: ${errors.length}, warnings: ${warnings.length}`);
process.exit(errors.length ? 1 : 0);
