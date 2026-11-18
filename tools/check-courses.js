'use strict';
/* Validates data/courses/catalogue.json and data/courses/sessions.json against the Hoggy data rules
   (docs/team/country-desks.md): https only, evidence on every confirmed row, sane dates, no duplicates,
   no superlatives, CPD only when cited. Exits 1 on any error.
   Usage: node tools/check-courses.js [--today YYYY-MM-DD] [--dir DIR]   (--dir: check a copy, e.g. before a refresh writes)
   Also a module: tools/merge-courses.js uses courseProblems / sessionProblems to refuse single rows before the full check.
   x10 (18 Nov 2026): any ISO 3166-1 alpha-2 country and ISO 4217 currency (sessions outside AU/NZ); the duplicate key
   includes the variant (RCUK centres run e-ALS and ALS recertification on the same day); optional fields checked when
   present: languages, endNote, yearInferred/yearNote, sourceKind, accessNote/bookingNote/sessionNote/cityNote, placesTotal. */
const fs = require('node:fs'), path = require('node:path');

const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const isHttps = u => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };
const SUPER = /\b(best|largest|leading|premier|world[- ]class|top[- ]rated|number one|#1|biggest)\b/i;
const URL_KEYS = /(^url$|Url$|^schedulePage$|^calendar$|^feed$|^coursePage$)/;
const REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });
/* a real ISO 3166-1 alpha-2 code (XK, Kosovo, is user-assigned but used by ERC and known to ICU) */
const isCountry = cc => typeof cc === 'string' && /^[A-Z]{2}$/.test(cc) && cc !== 'ZZ' && REGION_NAMES.of(cc) !== cc && REGION_NAMES.of(cc) !== 'Unknown Region';
const CURRENCIES = new Set(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('currency') : []);
const isCurrency = c => typeof c === 'string' && /^[A-Z]{3}$/.test(c) && (!CURRENCIES.size || CURRENCIES.has(c));
const NOTE_KEYS = ['endNote', 'yearNote', 'sourceKind', 'accessNote', 'bookingNote', 'bookingUrlNote', 'sessionNote', 'cityNote', 'priceNote', 'availabilityText', 'note', 'cpdNote'];
const REQ = ['id', 'courseId', 'provider', 'city', 'region', 'country', 'start', 'end', 'bookingUrl', 'sourceUrl', 'datesQuote', 'lastVerified'];
/* duplicate key: same course, variant, provider, city, dates and venue */
const sessionKey = s => [s.courseId, s.variant || '', s.provider, s.city, s.start, s.end, s.venue || ''].join('|').toLowerCase();

function checkUrls(obj, add) {
  if (Array.isArray(obj)) return obj.forEach(x => checkUrls(x, add));
  if (!obj || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    if (URL_KEYS.test(k) && v != null && !isHttps(v)) add('error', `${k} is not an https URL: ${v}`);
    else if (typeof v === 'object') checkUrls(v, add);
  }
}

/* one catalogue entry -> [{ level, msg }] (duplicate ids and cross-references are checked by check()) */
function courseProblems(c, { today }) {
  const P = [], add = (level, msg) => P.push({ level, msg }), err = m => add('error', m);
  if (!c || typeof c !== 'object') return [{ level: 'error', msg: 'not an object' }];
  for (const k of ['id', 'name']) if (!c[k] || typeof c[k] !== 'string') err(`missing ${k}`);
  if (c.id && !/^[a-z0-9-]+$/.test(c.id)) err('id must be lowercase a-z0-9-');
  if (!Array.isArray(c.providers) || !c.providers.length) err('needs at least one provider');
  else c.providers.forEach((p, j) => { if (!p.name) err(`provider[${j}] missing name`); if (!p.url) err(`provider[${j}] missing url`); });
  checkUrls(c, add);
  if (c.countries != null && (!Array.isArray(c.countries) || c.countries.some(x => !isCountry(x)))) err('countries must be ISO 3166-1 alpha-2 codes');
  if (c.certificateValidityYears != null) {
    if (!(c.certificateValidityYears > 0 && c.certificateValidityYears <= 10)) err('certificateValidityYears out of range');
    if (!c.validitySource || !isHttps(c.validitySource)) err('certificateValidityYears needs an https validitySource');
    if (!c.validityQuote) err('certificateValidityYears needs a validityQuote');
  }
  if (c.feeRange != null && (!c.feeSource || !isHttps(c.feeSource))) err('feeRange needs an https feeSource');
  if (c.cpdHours && !(c.cpdSource && isHttps(c.cpdSource))) err('cpdHours > 0 needs an https cpdSource (0 = check provider)');
  if (c.verified === true && (!isDate(c.lastVerified) || c.lastVerified > today)) err('verified entry needs lastVerified (not in the future)');
  if (c.verified !== true) add('warn', 'not verified against a provider page yet');
  if (c.verified !== true && (c.certificateValidityYears != null || c.feeRange != null || c.cpdHours)) err('unverified entry carries facts');
  for (const cc of c.cpdByCollege || []) if (!isHttps(cc.sourceUrl) || !cc.quote) err(`cpdByCollege ${cc.college} needs https sourceUrl + quote`);
  /* a recognition statement is shown to doctors as a claim: only with the course owner's own words and page */
  if (c.recognition != null && !(c.recognitionEvidence && isHttps(c.recognitionEvidence.sourceUrl) && c.recognitionEvidence.quote)) err('recognition needs recognitionEvidence with an https sourceUrl and a quote');
  if (c.certifyingBody != null && typeof c.certifyingBody !== 'string') err('certifyingBody must be a string');
  if (c.relevance != null && ![0, 1, 2, 3].includes(c.relevance)) err('relevance must be 0-3');
  if (c.providerType != null && !['commercial'].includes(c.providerType)) err('providerType must be "commercial" or absent');
  for (const k of ['name', 'audience', 'format', 'recertification', 'cpdNote', 'userNote']) if (typeof c[k] === 'string' && SUPER.test(c[k])) err(`superlative in ${k}`);
  return P;
}

/* one session -> [{ level, msg }]; courseIds: Set of known course ids (unknown course = error) */
function sessionProblems(s, { today, courseIds }) {
  const P = [], err = m => P.push({ level: 'error', msg: m }), warn = m => P.push({ level: 'warn', msg: m });
  if (!s || typeof s !== 'object') return [{ level: 'error', msg: 'not an object' }];
  for (const k of REQ) if (s[k] == null || s[k] === '') err(`missing ${k}`);
  if (s.courseId && courseIds && !courseIds.has(s.courseId)) err(`unknown courseId ${s.courseId}`);
  if (s.country && !isCountry(s.country)) err(`country must be an ISO 3166-1 alpha-2 code, got ${s.country}`);
  if (!isDate(s.start)) err('start is not YYYY-MM-DD');
  if (!isDate(s.end)) err('end is not YYYY-MM-DD');
  if (isDate(s.start) && isDate(s.end)) {
    if (s.end < s.start) err('end before start');
    const days = (Date.parse(s.end) - Date.parse(s.start)) / 864e5;
    if (days > 14) err(`session spans ${days} days (>14), check dates`);
    if (s.end < today) warn('session already finished, drop on next refresh');
    if (s.start > String(+today.slice(0, 4) + 3) + today.slice(4)) err('start more than 3 years ahead');
  }
  if (!isDate(s.lastVerified) || s.lastVerified > today) err('lastVerified must be a date, not in the future');
  if (s.endInferred != null && typeof s.endInferred !== 'boolean') err('endInferred must be boolean');
  if (s.yearInferred != null && typeof s.yearInferred !== 'boolean') err('yearInferred must be boolean');
  if (s.yearInferred === true && !s.yearNote && !s.note) warn('yearInferred without a yearNote saying how the year was worked out');
  if (s.datesConfirmed !== true) err('datesConfirmed must be true (only provider-page sessions belong here)');
  for (const k of ['bookingUrl', 'sourceUrl', 'providerBookingUrl', 'coursePage', 'cpdSource']) if (s[k] && !isHttps(s[k])) err(`${k} not https`);
  if (typeof s.datesQuote === 'string' && s.datesQuote.length > 300) warn('datesQuote longer than 300 chars');
  if (s.priceFrom != null) {
    if (typeof s.priceFrom !== 'number' || s.priceFrom <= 0) err('priceFrom must be a positive number or null');
    if (!isCurrency(s.currency)) err(`priceFrom needs an ISO 4217 currency, got ${s.currency}`);
  } else if (s.currency != null && !isCurrency(s.currency)) err(`currency must be ISO 4217, got ${s.currency}`);
  if (s.seatsStatus != null && !['open', 'full', 'waitlist', 'closed'].includes(s.seatsStatus)) err('seatsStatus must be open/full/waitlist/closed/null');
  if (s.durationOptions != null) {
    if (!Array.isArray(s.durationOptions) || s.durationOptions.length < 2) err('durationOptions must list at least two lengths');
    else for (const o of s.durationOptions) { if (!(o.days > 0) || !isDate(o.end) || o.end < s.start || !isHttps(o.sourceUrl) || !o.datesQuote) err('durationOptions entry needs days, end, an https sourceUrl and its datesQuote'); }
  }
  if (s.providerEvidence != null && !(isHttps(s.providerEvidence.sourceUrl) && s.providerEvidence.datesQuote && isDate(s.providerEvidence.lastVerified))) err('providerEvidence needs an https sourceUrl, datesQuote and lastVerified');
  if (s.providerType != null && !['commercial'].includes(s.providerType)) err('providerType must be "commercial" or absent');
  for (const k of ['placesRemaining', 'placesTotal']) if (s[k] != null && !(Number.isInteger(s[k]) && s[k] >= 0)) err(`${k} must be a whole number >= 0 or null`);
  if (s.cpdHours && !(s.cpdSource && isHttps(s.cpdSource))) err('cpdHours > 0 needs cpdSource');
  if (s.languages != null && (!Array.isArray(s.languages) || s.languages.some(l => typeof l !== 'string' || !l.trim()))) err('languages must be a list of language names');
  if (s.online != null && typeof s.online !== 'boolean') err('online must be boolean');
  for (const k of NOTE_KEYS) if (s[k] != null && typeof s[k] !== 'string') err(`${k} must be text`);
  for (const k of ['sessionNote', 'accessNote', 'bookingNote', 'note']) if (typeof s[k] === 'string' && SUPER.test(s[k])) err(`superlative in ${k}`);
  return P;
}

/* whole data set -> { errors, warnings, courseIds } (strings "where: message") */
function check({ catalogue, sessions, today }) {
  const errors = [], warnings = [], put = (w, p) => (p.level === 'error' ? errors : warnings).push(`${w}: ${p.msg}`);
  const courseIds = new Set();
  if (catalogue) {
    if (!Array.isArray(catalogue.courses)) errors.push('catalogue: courses must be an array');
    for (const [i, c] of (catalogue.courses || []).entries()) {
      const w = `catalogue[${c && c.id || i}]`;
      if (c && courseIds.has(c.id)) errors.push(`${w}: duplicate course id`);
      if (c) courseIds.add(c.id);
      for (const p of courseProblems(c, { today })) put(w, p);
    }
    for (const c of catalogue.courses || []) {
      for (const k of ['nzEquivalent', 'nzEquivalentOf']) if (c[k] && !courseIds.has(c[k])) errors.push(`catalogue[${c.id}]: ${k} points to unknown course ${c[k]}`);
      for (const r of c.relatedCourses || []) if (!courseIds.has(r)) warnings.push(`catalogue[${c.id}]: relatedCourses names unknown course ${r}`);
    }
  }
  if (sessions) {
    if (!Array.isArray(sessions.sessions)) errors.push('sessions: sessions must be an array');
    const ids = new Set(), keys = new Set();
    for (const [i, s] of (sessions.sessions || []).entries()) {
      const w = `session[${s && s.id || i}]`;
      if (s && ids.has(s.id)) errors.push(`${w}: duplicate id`);
      if (s) ids.add(s.id);
      const key = s ? sessionKey(s) : '';
      if (s && keys.has(key)) errors.push(`${w}: duplicate session (same course/variant/provider/city/dates/venue)`);
      keys.add(key);
      for (const p of sessionProblems(s, { today, courseIds })) put(w, p);
    }
    if (!(sessions.sessions || []).length) warnings.push('sessions: no sessions yet');
  }
  return { errors, warnings, courseIds };
}

module.exports = { check, courseProblems, sessionProblems, sessionKey, isCountry, isCurrency, isHttps, isDate };

if (require.main === module) {
  const di = process.argv.indexOf('--dir');
  const dir = di > 0 ? path.resolve(process.argv[di + 1]) : path.join(__dirname, '..', 'data', 'courses');
  const ti = process.argv.indexOf('--today');
  const today = ti > 0 ? process.argv[ti + 1] : new Date().toISOString().slice(0, 10);
  const loadErr = [];
  const load = f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { loadErr.push(`${f}: cannot read/parse: ${e.message}`); return null; } };
  const catalogue = load('catalogue.json'), sessions = load('sessions.json');
  const r = check({ catalogue, sessions, today }), errors = loadErr.concat(r.errors);
  for (const m of r.warnings) console.log('warn  ' + m);
  for (const m of errors) console.log('ERROR ' + m);
  console.log(`courses: ${r.courseIds.size}, sessions: ${sessions && sessions.sessions ? sessions.sessions.length : 0}, errors: ${errors.length}, warnings: ${r.warnings.length}`);
  process.exit(errors.length ? 1 : 0);
}
