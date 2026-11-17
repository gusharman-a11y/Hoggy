/* Hoggy courses: certificate expiry, session filters, plan-trip and "near you". Shared by the browser (window.HoggyCourses)
   and tests. Data: data/courses/catalogue.json and data/courses/sessions.json (served by GET /api/courses).
   Honesty rules: expiry is computed only from a validity the catalogue sources (years + https source + quote, verified entry);
   otherwise the user types the expiry from their certificate. No date is ever made up for a course with no sessions. */
(function (root) {
'use strict';
const ARC_LIST = 'https://www.resus.org.au/training-and-education/advanced-life-support-courses/course-dates';
const STATES_AU = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];
const STATUS_LABEL = { valid: 'Valid', due6: 'Due in ≤6 months', due3: 'Due in ≤3 months', expired: 'Expired', unknown: 'Expiry unknown' };
const VARIANT_LABEL = { refresher: 'Refresher', recertification: 'Recertification', 'acrrm-one-day': 'ACRRM one-day' };
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
function lengthLabel(s) { const n = daysBetween(s.start, s.end) + 1; return `${n} day${n === 1 ? '' : 's'}${s.endInferred ? ' (inferred)' : ''}`; }
const upcomingSessions = (sessions, today) => (sessions || []).filter(s => s && s.end >= today).sort((a, b) => a.start.localeCompare(b.start) || a.city.localeCompare(b.city));
/* filters: state (region), city, month (YYYY-MM of the start date); sorted soonest */
function filterSessions(sessions, f, today) {
  f = f || {};
  return upcomingSessions(sessions, today).filter(s => (!f.courseId || s.courseId === f.courseId) && (!f.state || s.region === f.state) && (!f.city || s.city === f.city) && (!f.month || s.start.slice(0, 7) === f.month));
}
/* options for the filter selects, from the course's upcoming sessions; cities follow the chosen state */
function filterOptions(sessions, f, today) {
  const L = filterSessions(sessions, { courseId: f && f.courseId }, today), uniq = a => [...new Set(a)];
  const states = uniq(L.map(s => s.region)).sort((a, b) => (STATES_AU.includes(a) ? 0 : 1) - (STATES_AU.includes(b) ? 0 : 1) || a.localeCompare(b));
  const cities = uniq(L.filter(s => !f || !f.state || s.region === f.state).map(s => s.city)).sort();
  const months = uniq(L.map(s => s.start.slice(0, 7))).sort();
  return { states, cities, months };
}
const COUNTRY = { AU: 'Australia', NZ: 'New Zealand' };
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
function nearSessions(sessions, courseId, region, today, n) {
  const all = filterSessions(sessions, { courseId }, today), here = region ? all.filter(s => s.region === region) : [];
  return here.length ? { list: here.slice(0, n || 3), local: true } : { list: all.slice(0, n || 3), local: false };
}
/* course types matching a search (name, short name, NZ equivalent) */
function searchCourses(cat, q) {
  q = String(q || '').trim().toLowerCase(); if (q.length < 2) return [];
  return ((cat && cat.courses) || []).filter(c => [c.name, shortName(c), equivalentLabel(cat, c)].join(' ').toLowerCase().includes(q));
}
const api = { ARC_LIST, STATES_AU, STATUS_LABEL, VARIANT_LABEL, addMonths, addYears, daysBetween, validityOf, expiryFor, certStatus, needsAttention, shortName, courseById, equivalentLabel, isArcList, lengthLabel, upcomingSessions, filterSessions, filterOptions, sessionEvent, planTrip, regionOf, nearSessions, searchCourses };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HoggyCourses = api;
})(typeof window !== 'undefined' ? window : globalThis);
