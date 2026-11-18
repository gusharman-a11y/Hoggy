/* Hoggy courses: certificate expiry, session filters, plan-trip and "near you". Shared by the browser (window.HoggyCourses)
   and tests. Data: data/courses/catalogue.json and data/courses/sessions.json (served by GET /api/courses).
   Honesty rules: expiry is computed only from a validity the catalogue sources (years + https source + quote, verified entry);
   otherwise the user types the expiry from their certificate. No date is ever made up for a course with no sessions. */
(function (root) {
'use strict';
const ARC_LIST = 'https://www.resus.org.au/training-and-education/advanced-life-support-courses/course-dates';
const STATES_AU = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];
const STATUS_LABEL = { valid: 'Valid', due6: 'Due in ≤6 months', due3: 'Due in ≤3 months', expired: 'Expired', unknown: 'Expiry unknown' };
const VARIANT_LABEL = { refresher: 'Refresher', recertification: 'Recertification', 'acrrm-one-day': 'ACRRM one-day', 'e-als': 'e-ALS (e-learning + 1 day)', 'short-recertification': 'Short recertification', 'length-options': 'Several lengths' };
const isIso = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
const isHttps = u => { try { return new URL(u).protocol === 'https:'; } catch (e) { return false; } };

/* calendar arithmetic on YYYY-MM-DD (UTC, no time zones); 29 Feb + 1 year = 28 Feb, 31 Aug + 6 months = 28/29 Feb */
function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number), t = y * 12 + (m - 1) + n, ny = Math.floor(t / 12), nm = t - ny * 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${String(ny).padStart(4, '0')}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
const addYears = (iso, n) => addMonths(iso, 12 * n);
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);

/* the catalogue's validity, only when it is sourced */
function validityOf(course) {
  if (!course || course.verified !== true) return null;
  const y = course.certificateValidityYears;
  if (!(y > 0) || !isHttps(course.validitySource) || !course.validityQuote) return null;
  return { years: y, source: course.validitySource, quote: course.validityQuote };
}
/* expiry: sourced validity from the completion date, else the date the user entered from their certificate */
function expiryFor(cert, course) {
  const v = validityOf(course);
  if (v && isIso(cert.completed)) return { expires: addYears(cert.completed, v.years), from: 'catalogue', years: v.years, source: v.source };
  if (isIso(cert.expiresEntered)) return { expires: cert.expiresEntered, from: 'user' };
  return { expires: null, from: null };
}
/* valid / due within 6 months / due within 3 months / expired (on the expiry date it still counts as valid that day) */
function certStatus(expires, today) {
  if (!isIso(expires)) return 'unknown';
  if (expires < today) return 'expired';
  if (expires <= addMonths(today, 3)) return 'due3';
  if (expires <= addMonths(today, 6)) return 'due6';
  return 'valid';
}
const needsAttention = st => st === 'expired' || st === 'due3' || st === 'due6';

const shortName = c => { if (!c) return ''; const m = String(c.name).match(/\(([A-Z][A-Z0-9]{1,6})[,)]/); return m ? m[1] : String(c.name).replace(/^NZRC\s+/, ''); };
const courseById = (cat, id) => ((cat && cat.courses) || []).find(c => c.id === id) || null;
/* "NZ equivalent of ALS1" for the NZRC courses */
function equivalentLabel(cat, c) { const o = c && c.nzEquivalentOf && courseById(cat, c.nzEquivalentOf); return o ? 'NZ equivalent of ' + shortName(o) : ''; }

/* sessions */
const isArcList = s => !!s && String(s.bookingUrl || '').replace(/[#?].*$/, '').replace(/\/$/, '') === ARC_LIST;
function lengthLabel(s) {
  if (Array.isArray(s.durationOptions) && s.durationOptions.length > 1) { const d = s.durationOptions.map(o => o.days); return `${Math.min(...d)}–${Math.max(...d)} days (choose a length)`; }
  const n = daysBetween(s.start, s.end) + 1; return `${n} day${n === 1 ? '' : 's'}${s.endInferred ? ' (inferred)' : ''}`;
}
const upcomingSessions = (sessions, today) => (sessions || []).filter(s => s && s.end >= today).sort((a, b) => a.start.localeCompare(b.start) || a.city.localeCompare(b.city));
/* filters: state (region), city, month (YYYY-MM of the start date); sorted soonest */
function filterSessions(sessions, f, today) {
  f = f || {};
  return upcomingSessions(sessions, today).filter(s => (!f.courseId || s.courseId === f.courseId) && inPlace(s.country, f.country) && langOk(s, f.lang) && (!f.state || s.region === f.state) && (!f.city || s.city === f.city) && (!f.month || s.start.slice(0, 7) === f.month));
}
/* options for the filter selects, from the course's upcoming sessions; cities follow the chosen state */
function filterOptions(sessions, f, today) {
  const L = filterSessions(sessions, { courseId: f && f.courseId, country: f && f.country, lang: f && f.lang }, today), uniq = a => [...new Set(a)];
  const states = uniq(L.map(s => s.region)).sort((a, b) => (STATES_AU.includes(a) ? 0 : 1) - (STATES_AU.includes(b) ? 0 : 1) || a.localeCompare(b));
  const cities = uniq(L.filter(s => !f || !f.state || s.region === f.state).map(s => s.city)).sort();
  const months = uniq(L.map(s => s.start.slice(0, 7))).sort();
  const countries = uniq(filterSessions(sessions, { courseId: f && f.courseId }, today).map(s => s.country)).sort((a, b) => countryName(a).localeCompare(countryName(b)));
  const langs = uniq([].concat(...filterSessions(sessions, { courseId: f && f.courseId, country: f && f.country }, today).map(langsOf))).sort();
  return { states, cities, months, countries, langs };
}
/* countries and languages (x10: sessions in 45 countries). Names from Intl when the browser has it. */
const COUNTRY_FALLBACK = { AU: 'Australia', NZ: 'New Zealand', GB: 'United Kingdom', IE: 'Ireland', DE: 'Germany', NL: 'Netherlands', BE: 'Belgium', CH: 'Switzerland', FR: 'France', AT: 'Austria' };
let REGION_NAMES = null; try { REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) { /* old browser */ }
const countryName = cc => { if (!cc) return ''; try { const n = REGION_NAMES && REGION_NAMES.of(cc); if (n && n !== cc) return n; } catch (e) { /* unknown code */ } return COUNTRY_FALLBACK[cc] || cc; };
const COUNTRY = new Proxy({}, { get: (t, cc) => typeof cc === 'string' && /^[A-Z]{2}$/.test(cc) ? countryName(cc) : undefined });
/* world regions for the country filter ("Europe (all)"); a country not listed falls under 'Other' */
const WORLD = { 'Australia and New Zealand': ['AU', 'NZ'], 'UK and Ireland': ['GB', 'IE'],
  Europe: ['AT', 'BA', 'BE', 'BG', 'CH', 'CY', 'CZ', 'DE', 'DK', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IS', 'IT', 'LU', 'MK', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'SE', 'SI', 'SK', 'TR', 'UA', 'XK', 'GB', 'IE'],
  Asia: ['IN', 'LK', 'VN', 'SG', 'MY', 'HK', 'JP', 'CN', 'KR', 'TH', 'ID', 'PH'], 'Middle East and Africa': ['AE', 'BH', 'EG', 'SY', 'TN', 'UG', 'SA', 'QA', 'ZA', 'KE'], Americas: ['AW', 'PE', 'US', 'CA', 'BR', 'MX'] };
const worldOf = cc => Object.keys(WORLD).find(k => k !== 'UK and Ireland' && k !== 'Australia and New Zealand' && WORLD[k].includes(cc)) || (WORLD['Australia and New Zealand'].includes(cc) ? 'Australia and New Zealand' : 'Other');
/* a country filter value: '' (all), 'AU' (one country) or 'w:Europe' (a world region) */
const inPlace = (cc, place) => !place || (place.startsWith('w:') ? (WORLD[place.slice(2)] || []).includes(cc) : cc === place);
const placeLabel = place => !place ? 'All countries' : place.startsWith('w:') ? place.slice(2) + (place === 'w:Europe' ? ' (all countries)' : '') : countryName(place);
/* "Australia" (profile text) -> 'AU'; default AU */
function countryCodeOf(text) {
  const t = String(text || '').trim().toLowerCase(); if (!t) return 'AU';
  if (/^[a-z]{2}$/.test(t)) return t.toUpperCase() === 'UK' ? 'GB' : t.toUpperCase();
  const alias = { uk: 'GB', 'united kingdom': 'GB', england: 'GB', scotland: 'GB', wales: 'GB', 'great britain': 'GB', usa: 'US', 'united states': 'US', nz: 'NZ', 'aotearoa': 'NZ' };
  if (alias[t]) return alias[t];
  for (const cc of [].concat(...Object.values(WORLD))) if (countryName(cc).toLowerCase() === t) return cc;
  return 'AU';
}
/* languages: only the ERC rows state them. 'en' = taught in English or language not stated (AU/NZ/UK providers teach in English
   but do not say so, so Hoggy does not claim it); 'any' = all; otherwise a language name ("Dutch") */
const langsOf = s => (Array.isArray(s && s.languages) ? s.languages.filter(Boolean) : []);
const langOk = (s, lang) => { if (!lang || lang === 'any') return true; const L = langsOf(s); return lang === 'en' ? (!L.length || L.includes('English')) : L.includes(lang); };
/* "Taught in Dutch" when the provider names the languages and English is not one of them; '' otherwise */
function languageLabel(s) { const L = langsOf(s); if (!L.length) return ''; return L.includes('English') ? (L.length > 1 ? 'Taught in ' + L.join(' or ') : '') : 'Taught in ' + L.join(' or '); }

/* per-course counts for the course list without loading every session: { id: { n, next, by: [[country, lang, n, next]] } }
   lang '' = not stated, '*' = all languages (count each session once) */
function courseSummary(sessions, today) {
  const out = {};
  for (const s of upcomingSessions(sessions, today)) {
    const o = out[s.courseId] || (out[s.courseId] = { n: 0, next: s.start, by: {} });
    o.n++; if (s.start < o.next) o.next = s.start;
    const keys = ['*'].concat(langsOf(s).length ? langsOf(s) : ['']);
    for (const l of keys) { const k = s.country + '|' + l, b = o.by[k] || (o.by[k] = [s.country, l, 0, s.start]); b[2]++; if (s.start < b[3]) b[3] = s.start; }
  }
  for (const id in out) out[id].by = Object.values(out[id].by);
  return out;
}
/* sessions of one course summary that match a place and language: { n, next } */
function countFor(sum, place, lang) {
  if (!sum) return { n: 0, next: '' };
  let n = 0, next = '';
  const add = b => { n += b[2]; if (!next || b[3] < next) next = b[3]; };
  for (const b of sum.by) {
    if (!inPlace(b[0], place)) continue;
    if (!lang || lang === 'any') { if (b[1] === '*') add(b); }
    else if (lang === 'en') { if (b[1] === 'English' || b[1] === '') add(b); }
    else if (b[1] === lang) add(b);
  }
  return { n, next };
}
/* languages offered in a place, for the language select (most sessions first) */
function languagesIn(summary, place) {
  const c = {};
  for (const id in summary || {}) for (const b of summary[id].by) if (b[1] && b[1] !== '*' && inPlace(b[0], place)) c[b[1]] = (c[b[1]] || 0) + b[2];
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(x => x[0]);
}
/* countries with sessions, most sessions first: [[cc, n]] */
function countriesIn(summary) {
  const c = {};
  for (const id in summary || {}) for (const b of summary[id].by) if (b[1] === '*') c[b[0]] = (c[b[0]] || 0) + b[2];
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}
/* course totals for Home / Discover */
function courseTotals(summary, cat) {
  const cs = countriesIn(summary), types = Object.keys(summary || {}).filter(id => summary[id].n > 0);
  return { sessions: cs.reduce((a, x) => a + x[1], 0), countries: cs.length, types: types.length, catalogued: ((cat && cat.courses) || []).length };
}

/* certificate families: courses that lead to a comparable certificate from different certifying bodies. Labels name the body
   only; whether one body recognises another's certificate is shown only where the catalogue quotes the course owner. */
const FAMILIES = [
  { key: 'als', label: 'Advanced Life Support (ALS)', short: 'ALS', members: [
    ['als2', 'ANZCOR (Australia/NZ) · Australian Resuscitation Council, ALS2'], ['als1', 'ANZCOR (Australia/NZ) · Australian Resuscitation Council, ALS1'],
    ['nzrc-core-advanced', 'ANZCOR (Australia/NZ) · New Zealand Resuscitation Council, CORE Advanced'], ['acccn-adult-als', 'ACCCN (Australia)'],
    ['rcuk-als', 'Resuscitation Council UK'], ['erc-als', 'European Resuscitation Council']] },
  { key: 'paeds', label: 'Paediatric life support', short: 'Paediatric', members: [
    ['apls', 'APLS Australia'], ['acccn-paediatric-als', 'ACCCN (Australia)'], ['paediatric-als', 'Course centres (Australia), one-day PALS'], ['pals', 'American Heart Association (PALS)'],
    ['rcuk-epals', 'Resuscitation Council UK (EPALS)'], ['erc-epals', 'European Resuscitation Council (EPALS)']] },
  { key: 'newborn', label: 'Newborn life support', short: 'Newborn', members: [
    ['acrrm-anr', 'ACRRM (Australia)'], ['rcuk-nls', 'Resuscitation Council UK (NLS)'], ['erc-nls', 'European Resuscitation Council (NLS)']] },
  { key: 'trauma', label: 'Trauma (EMST / ATLS / ETC)', short: 'Trauma', members: [
    ['emst', 'RACS (Australia/NZ), EMST'], ['atls', 'ATLS in the UK (RCS England / RCSEd)'], ['erc-etc', 'European Resuscitation Council (ETC)']] }
];
const familyOf = id => FAMILIES.find(f => f.members.some(m => m[0] === id)) || null;
const bodyLabel = id => { const f = familyOf(id), m = f && f.members.find(x => x[0] === id); return m ? f.short + ' — ' + m[1] : ''; };
/* quoted recognition statements for a family's members: [{ courseId, text, sourceUrl }] (never inferred) */
function recognitionOf(cat, fam) {
  return (fam ? fam.members : []).map(([id]) => courseById(cat, id)).filter(c => c && c.recognitionEvidence && isHttps(c.recognitionEvidence.sourceUrl) && c.recognitionEvidence.quote)
    .map(c => ({ courseId: c.id, text: c.recognitionEvidence.quote, sourceUrl: c.recognitionEvidence.sourceUrl }));
}
/* list order: relevance for AU/NZ doctors (fixes.json; default 2), then sessions */
const relevanceOf = c => c && c.relevance != null ? c.relevance : 2;
/* a course session in the shape the trips, receipts and claim code already use for a conference */
function sessionEvent(s, course) {
  const cpd = s.cpdHours > 0 && isHttps(s.cpdSource);
  return {
    id: 'crs-' + s.id, kind: 'course', sessionId: s.id, courseId: s.courseId, short: shortName(course) || s.courseId.toUpperCase(),
    name: course ? course.name : s.courseId, organiser: s.provider, city: s.city, region: s.region, country: COUNTRY[s.country] || s.country, countryCode: s.country,
    venue: s.venue || '', start: s.start, end: s.end, endInferred: !!s.endInferred, variant: s.variant || 'full',
    url: isHttps(s.bookingUrl) ? s.bookingUrl : s.sourceUrl, sourceUrl: s.sourceUrl, lastVerified: s.lastVerified, datesConfirmed: true, dateStatus: 'confirmed',
    datesSourceUrl: s.sourceUrl, datesQuote: s.datesQuote, verifiedOn: s.lastVerified, /* sessions always carry their quote (tools/check-courses.js) */
    specialty: 'Course', format: 'In person', attendees: 0, priceFrom: 0,
    cpdHours: cpd ? s.cpdHours : 0, cpdVerified: cpd, cpdBody: cpd ? s.provider : '',
    blurb: [course ? shortName(course) + ' course' : 'Course', s.provider, s.venue].filter(Boolean).join(' · ')
  };
}
/* "Plan trip" on a session: one trip per session, planned, holding a copy of the session so it still opens after the
   session drops off the data (finished sessions are removed on refresh) */
function planTrip(trips, s, course, id) {
  const ev = sessionEvent(s, course), have = (trips || []).find(t => t.confId === ev.id);
  if (have) return { trip: have, created: false };
  return { trip: { id, confId: ev.id, kind: 'course', status: 'planned', bookings: [], event: ev }, created: true };
}

/* where the user is, for "next sessions near you": profile region, else the home city or airport */
const CITY_REGION = { sydney: 'NSW', newcastle: 'NSW', wollongong: 'NSW', syd: 'NSW', ntl: 'NSW', melbourne: 'VIC', geelong: 'VIC', mel: 'VIC', avv: 'VIC', brisbane: 'QLD', 'gold coast': 'QLD', cairns: 'QLD', townsville: 'QLD', bne: 'QLD', ool: 'QLD', cns: 'QLD', tsv: 'QLD', perth: 'WA', per: 'WA', adelaide: 'SA', adl: 'SA', hobart: 'TAS', launceston: 'TAS', hba: 'TAS', lst: 'TAS', darwin: 'NT', 'alice springs': 'NT', drw: 'NT', asp: 'NT', canberra: 'ACT', cbr: 'ACT', auckland: 'Auckland', akl: 'Auckland', wellington: 'Wellington', 'lower hutt': 'Wellington', wlg: 'Wellington', nelson: 'Nelson', nsn: 'Nelson' };
function regionOf(profile) {
  const p = profile || {};
  if (p.region) return p.region;
  for (const k of [p.homeAirport, p.city]) { const r = CITY_REGION[String(k || '').trim().toLowerCase()]; if (r) return r; }
  return '';
}
/* the next sessions of a course: in the user's region first; if none there, the soonest anywhere (flagged) */
function nearSessions(sessions, courseId, region, today, n, country) {
  const all = filterSessions(sessions, { courseId }, today), here = region ? all.filter(s => s.region === region) : [];
  const home = country ? all.filter(s => s.country === country) : [];
  return here.length ? { list: here.slice(0, n || 3), local: true } : { list: (home.length ? home : all).slice(0, n || 3), local: false };
}
/* course types matching a search (name, short name, NZ equivalent) */
function searchCourses(cat, q) {
  q = String(q || '').trim().toLowerCase(); if (q.length < 2) return [];
  return ((cat && cat.courses) || []).filter(c => [c.name, shortName(c), equivalentLabel(cat, c)].join(' ').toLowerCase().includes(q));
}
const api = { COUNTRY, countryName, countryCodeOf, WORLD, worldOf, inPlace, placeLabel, langsOf, langOk, languageLabel, courseSummary, countFor, languagesIn, countriesIn, courseTotals, FAMILIES, familyOf, bodyLabel, recognitionOf, relevanceOf, ARC_LIST, STATES_AU, STATUS_LABEL, VARIANT_LABEL, addMonths, addYears, daysBetween, validityOf, expiryFor, certStatus, needsAttention, shortName, courseById, equivalentLabel, isArcList, lengthLabel, upcomingSessions, filterSessions, filterOptions, sessionEvent, planTrip, regionOf, nearSessions, searchCourses };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HoggyCourses = api;
})(typeof window !== 'undefined' ? window : globalThis);
