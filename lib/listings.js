/* "List your event" (organiser submissions) and "Report a problem with this listing": the rules, shared by the browser
   (labels, limits) and the server (validation, the row an approved submission becomes). Pure functions, no I/O.
   The evidence rule still holds for organiser listings: an admin approves only after opening the official page and pasting
   the line that gives the dates (datesQuote); the submitted URL is the source page and the approval date is verifiedOn. */
(function (root) {
'use strict';
const SPEC = typeof require === 'function' ? require('./specialties.js') : root.HoggySpecialties;
const FORMATS = ['In-person', 'Hybrid'];
const KINDS = { conference: 'Conference', course: 'Course session' };
const REASONS = { 'wrong-date': 'Wrong date', 'wrong-city': 'Wrong city or venue', duplicate: 'Duplicate listing', 'not-relevant': 'Not relevant to clinicians', other: 'Something else' };
const LIMITS = { name: 160, organiser: 120, url: 500, city: 80, blurb: 240, cpdBody: 60, note: 500, quote: 200, email: 254 };
const REGIONS = new Set(['Europe', 'North America', 'Asia-Pacific', 'Middle East', 'Africa', 'Latin America']);

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const emailOk = e => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(e) && e.length <= 254;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isIso = s => ISO.test(s || '') && !isNaN(Date.parse(s)) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const addDays = (iso, n) => { const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
function httpsUrl(u) {
  let x; try { x = new URL(String(u || '').trim()); } catch (e) { return null; }
  if (x.protocol !== 'https:' || x.username || x.password || !/\./.test(x.hostname)) return null;
  return x.href;
}

/* country code -> { name, region }, from the conference list itself, so a listing uses the same spelling as every other row */
function countryMap(confs) {
  const tally = new Map();
  for (const c of confs || []) {
    if (!/^[A-Z]{2}$/.test(c.countryCode || '') || !c.country || !REGIONS.has(c.region)) continue;
    const t = tally.get(c.countryCode) || new Map(), k = c.country + '|' + c.region; t.set(k, (t.get(k) || 0) + 1); tally.set(c.countryCode, t);
  }
  const out = {};
  for (const [cc, t] of tally) { const [name, region] = [...t].sort((a, b) => b[1] - a[1])[0][0].split('|'); out[cc] = { name, region }; }
  return out;
}

/* a submission from the public form -> { ok, value } or { ok: false, error, field }. today: ISO date. */
function validateSubmission(b, { countries, today }) {
  const bad = (field, error) => ({ ok: false, field, error });
  const v = {};
  v.kind = Object.prototype.hasOwnProperty.call(KINDS, b.kind) ? b.kind : 'conference';
  v.name = clean(b.name, LIMITS.name); if (v.name.length < 3) return bad('name', 'Add the event name.');
  v.organiser = clean(b.organiser, LIMITS.organiser); if (v.organiser.length < 2) return bad('organiser', 'Add the organiser or society.');
  v.url = httpsUrl(b.url); if (!v.url || v.url.length > LIMITS.url) return bad('url', 'Add the official event page, starting with https://');
  v.start = String(b.start || ''); v.end = String(b.end || b.start || '');
  if (!isIso(v.start)) return bad('start', 'Add the start date.');
  if (!isIso(v.end)) return bad('end', 'Add the end date.');
  if (v.end < v.start) return bad('end', 'The end date is before the start date.');
  if (addDays(v.start, 60) < v.end) return bad('end', 'Events longer than 60 days cannot be listed. Check the dates.');
  if (v.end < today) return bad('start', 'This event has already finished.');
  if (v.start > addDays(today, 3 * 366)) return bad('start', 'Hoggy lists events up to three years ahead.');
  v.city = clean(b.city, LIMITS.city); if (v.city.length < 2) return bad('city', 'Add the city.');
  v.countryCode = String(b.countryCode || '').toUpperCase(); if (!countries[v.countryCode]) return bad('countryCode', 'Choose the country.');
  v.specialty = SPEC.canon(b.specialty); if (!v.specialty) return bad('specialty', 'Choose a specialty from the list.');
  v.format = FORMATS.includes(b.format) ? b.format : null; if (!v.format) return bad('format', 'Choose in person or hybrid.');
  const h = b.cpdHours === '' || b.cpdHours == null ? null : Number(b.cpdHours);
  if (h != null && !(h >= 0 && h <= 100)) return bad('cpdHours', 'CPD hours should be between 0 and 100.');
  v.cpdHours = h ? Math.round(h * 4) / 4 : null;
  v.cpdBody = clean(b.cpdBody, LIMITS.cpdBody);
  v.blurb = clean(b.blurb, LIMITS.blurb);
  return { ok: true, value: v };
}
/* the contact details and the confirmation tick, kept apart from the listing */
function validateContact(b) {
  const email = clean(b.contactEmail, LIMITS.email).toLowerCase();
  if (!emailOk(email)) return { ok: false, field: 'contactEmail', error: 'Add an email address Hoggy can use to check the listing with you.' };
  if (b.authorised !== true) return { ok: false, field: 'authorised', error: 'Tick the box to confirm you are authorised to list this event.' };
  return { ok: true, email };
}
const slug = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60).replace(/-$/, '');
/* the conference row an approved submission becomes. quote: the admin's own copy of the date line on the official page. */
function listingRow(v, { countries, quote, today, submittedOn, cpdConfirmed, id }) {
  const c = countries[v.countryCode] || { name: v.countryCode, region: '' }, cpd = !!cpdConfirmed && v.cpdHours > 0;
  const row = {
    id, name: v.name, organiser: v.organiser, specialty: v.specialty, city: v.city, country: c.name, countryCode: v.countryCode, region: c.region,
    lat: 0, lng: 0, start: v.start, end: v.end, format: v.format, cpdHours: cpd ? v.cpdHours : 0, cpdBody: cpd ? v.cpdBody : '', cpdVerified: cpd,
    priceFrom: 0, attendees: 0, url: v.url, sourceUrl: v.url,
    blurb: v.blurb || `${KINDS[v.kind]} run by ${v.organiser} in ${v.city}.`,
    datesConfirmed: true, dateStatus: 'confirmed', datesSourceUrl: v.url, datesQuote: clean(quote, LIMITS.quote), verifiedOn: today, lastVerified: today,
    source: 'organiser-submitted', submittedOn: submittedOn || today,
  };
  if (v.kind === 'course') row.listingType = 'course';
  return row;
}
const idFor = v => 'org-' + slug(v.name + ' ' + v.start.slice(0, 4)).replace(/-(\d{4})-\1$/, '-$1');
function validateReport(b) {
  const kind = b.kind === 'course' ? 'course' : b.kind === 'conference' ? 'conference' : null;
  if (!kind) return { ok: false, error: 'Unknown listing.' };
  const id = String(b.id || ''); if (!/^[a-z0-9-]{1,80}$/.test(id)) return { ok: false, error: 'Unknown listing.' };
  if (!Object.prototype.hasOwnProperty.call(REASONS, b.reason)) return { ok: false, error: 'Choose what is wrong.' };
  const note = clean(b.note, LIMITS.note);
  if (b.reason === 'other' && note.length < 3) return { ok: false, error: 'Tell us what is wrong in the note.' };
  return { ok: true, value: { kind, id, reason: b.reason, note } };
}
const api = { FORMATS, KINDS, REASONS, LIMITS, countryMap, validateSubmission, validateContact, listingRow, idFor, validateReport, httpsUrl, slug };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HoggyListings = api;
})(typeof window !== 'undefined' ? window : globalThis);
