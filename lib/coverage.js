/* "Covered in": links to journal and press coverage of a conference SERIES (every edition). Links only: Hoggy never
   copies or scrapes article text. Shared by the server (require) and the browser (window.HoggyCoverage).
   Model: { seriesKey, type, title, publication, year, url (https), addedBy, addedOn, status: pending|approved|rejected }.
   Suggestions from signed-in users start as pending; only an admin approves; the public sees approved links only. */
(function (root) {
'use strict';
const TYPES = { 'meeting-report': 'Meeting report', 'abstract-supplement': 'Abstract supplement', 'society-journal': 'Society journal', news: 'News' };
const LIMITS = { title: 200, publication: 120, url: 500 };
const tidy = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

/* an absolute https URL with a host and no user:password part, or null */
function httpsUrl(u) {
  const s = String(u || '').trim();
  if (!s || s.length > LIMITS.url) return null;
  let x; try { x = new URL(s); } catch (e) { return null; }
  if (x.protocol !== 'https:' || !x.hostname || x.username || x.password) return null;
  return x.href;
}
/* -> { ok: true, value } or { ok: false, error } (error is a sentence for the form) */
function validate(b, nowYear = new Date().getUTCFullYear()) {
  b = b && typeof b === 'object' ? b : {};
  const type = String(b.type || '');
  if (!TYPES[type]) return { ok: false, error: 'Pick a type: meeting report, abstract supplement, society journal or news.' };
  const url = httpsUrl(b.url);
  if (!url) return { ok: false, error: 'Use a full https:// link to the article or issue.' };
  const publication = tidy(b.publication, LIMITS.publication);
  if (!publication) return { ok: false, error: 'Add the publication (journal, society or news outlet).' };
  const title = tidy(b.title, LIMITS.title);
  let year = null;
  if (b.year !== undefined && b.year !== null && b.year !== '') {
    year = Number(b.year);
    if (!Number.isInteger(year) || year < 1950 || year > nowYear + 1) return { ok: false, error: `Use a year from 1950 to ${nowYear + 1}.` };
  }
  return { ok: true, value: { type, url, publication, title, year } };
}
/* one approved link as HTML (esc escapes text). Opens in a new tab without passing the opener or the referrer. */
function itemHtml(l, esc) {
  const url = httpsUrl(l.url); if (!url) return '';
  const label = l.title || l.publication;
  const meta = [l.publication, l.year, TYPES[l.type] || ''].filter(Boolean).map(esc).join(' · ');
  return `<li class="cov-item"><a class="u" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a><div class="note cov-meta">${meta}</div></li>`;
}

const api = { TYPES, LIMITS, httpsUrl, validate, itemHtml };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HoggyCoverage = api;
})(typeof window !== 'undefined' ? window : globalThis);
