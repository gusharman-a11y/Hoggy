'use strict';
/* B30 evidence rule for conference dates. Shared by tools/merge-shards.js, tools/validate-data.js and tools/verify-dates.js.

   A row may have datesConfirmed: true only when it carries all three evidence fields:
     datesSourceUrl  the organiser's or society's page the dates were read from (https, not a bare domain root, not an aggregator)
     datesQuote      a short verbatim excerpt from that page containing the dates (at most 200 characters)
     verifiedOn      the ISO date the page was read (not in the future)
   and datesSourceUrl is on the organiser's own domain: the same registrable domain as the row's url (subdomains count),
   the row's organiserUrl/societyUrl when present, or an entry in tools/official-domains.json.

   Rows confirmed before the rule existed (17 Nov 2026) carry legacyConfirmed: true instead: dates kept, shown in the app as
   "confirmed, source not yet re-checked", and queued first by tools/verify-dates.js. */
const OFFICIAL = require('./official-domains.json');

/* second-level labels under a country TLD that are not registrable on their own (co.uk, com.au, or.jp, org.br, ...) */
const SLD = new Set(['ac', 'co', 'com', 'edu', 'gov', 'net', 'org', 'or', 'ne', 'go', 'asn', 'id', 'med', 'nhs', 'gob', 'gouv', 'mil', 'nom', 'sch', 'res', 'lg', 'gr', 'ed', 'in', 'firm', 'ltd', 'plc', 'info', 'biz']);
const hostOf = u => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return ''; } };
function registrable(host) {
  const p = String(host || '').toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
  if (p.length <= 2) return p.join('.');
  const tld = p[p.length - 1], sld = p[p.length - 2];
  return (tld.length === 2 && SLD.has(sld) ? p.slice(-3) : p.slice(-2)).join('.');
}
const LANGS = 'en|fr|de|es|pt|it|ja|jp|zh|cn|ko|kr|nl|ru|tr|ar|pl|sv|da|fi|no|nb|cs|el|he|th|vi|id|ms|hu|ro';
const ROOT_PATH = new RegExp('^(?:/(?:' + LANGS + ')(?:[-_][a-z]{2})?)?(?:/(?:index|home|default)(?:\\.\\w+)?)?$', 'i');
/* "https://x.org", "https://x.org/", "/en/", "/index.html", "/pt-br/home" are site roots: they say nothing about one event */
function isSiteRoot(u) {
  let x; try { x = new URL(u); } catch (e) { return true; }
  const p = x.pathname.replace(/\/+$/, '');
  return !x.search && ROOT_PATH.test(p);
}
const under = (host, d) => host === d || host.endsWith('.' + d);
const isAggregator = (u, list = OFFICIAL.aggregators) => { const h = hostOf(u); return !!h && list.some(d => under(h, d)); };
function officialEntry(u, list = OFFICIAL.official) {
  let x; try { x = new URL(u); } catch (e) { return null; }
  const h = x.hostname.toLowerCase().replace(/^www\./, '');
  return list.find(e => under(h, e.host) && (!e.path || x.pathname.startsWith(e.path))) || null;
}
/* does the source page sit on the organiser's or society's own domain? */
function onOrganiserDomain(row, u, official = OFFICIAL) {
  const h = hostOf(u); if (!h) return false;
  if (isAggregator(u, official.aggregators)) return false;
  for (const k of ['url', 'organiserUrl', 'societyUrl']) {
    const v = row[k]; if (!v || isAggregator(v, official.aggregators)) continue;
    const oh = hostOf(v); if (oh && registrable(oh) === registrable(h)) return true;
  }
  return !!officialEntry(u, official.official);
}
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isIso = s => ISO.test(s || '') && !isNaN(Date.parse(s)) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const hasAnyEvidence = r => !!(r && (r.datesSourceUrl || r.datesQuote || r.verifiedOn));
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/* null when the row meets the rule, otherwise the reason (a short sentence). today: ISO date for the "not in the future" check. */
function evidenceProblem(row, { today = new Date().toISOString().slice(0, 10), official = OFFICIAL } = {}) {
  const missing = ['datesSourceUrl', 'datesQuote', 'verifiedOn'].filter(k => !row[k]);
  if (missing.length) return 'missing ' + missing.join(', ');
  const u = String(row.datesSourceUrl);
  if (!/^https:\/\//.test(u)) return 'datesSourceUrl is not https';
  if (!hostOf(u)) return 'datesSourceUrl is not a URL';
  if (isSiteRoot(u)) return 'datesSourceUrl is a site root, not the event page';
  if (isAggregator(u, official.aggregators)) return 'datesSourceUrl is an aggregator or social site';
  if (!onOrganiserDomain(row, u, official)) return `datesSourceUrl host ${hostOf(u)} is not the organiser's domain (${hostOf(row.url)}) or in tools/official-domains.json`;
  const q = String(row.datesQuote);
  if (q.length > 200) return 'datesQuote is longer than 200 characters';
  if (!/\d/.test(q)) return 'datesQuote has no date in it';
  if (row.start && isIso(row.start)) {
    const d = +row.start.slice(8, 10);
    if (!new RegExp('(?<!\\d)0?' + d + '(?!\\d)').test(q) && !q.includes(row.start)) return `datesQuote does not contain the start day (${d})`;
  }
  if (!isIso(row.verifiedOn)) return 'verifiedOn is not an ISO date';
  if (row.verifiedOn > today) return 'verifiedOn is in the future';
  if (row.verifiedOn < '2026-01-01') return 'verifiedOn is before 2026';
  return null;
}
/* quote mentions the start year or month (a weaker check: warning only, quotes in other languages may name the month their way) */
function quoteNamesMonthOrYear(row) {
  const q = String(row.datesQuote || '').toLowerCase(), y = String(row.start || '').slice(0, 4), m = +String(row.start || '').slice(5, 7);
  if (y && q.includes(y)) return true;
  if (m && q.includes(MONTHS[m - 1])) return true;
  return /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(q);
}
module.exports = { OFFICIAL, registrable, hostOf, isSiteRoot, isAggregator, officialEntry, onOrganiserDomain, evidenceProblem, hasAnyEvidence, quoteNamesMonthOrYear, isIso };
