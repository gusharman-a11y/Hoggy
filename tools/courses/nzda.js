'use strict';
/* NZ Resuscitation Council CORE courses, as posted by the delivering providers (Triple One Care, Emcare, Resus Nelson…)
   on the NZ Dental Association course portal. NZRC's own site (www.resus.org.nz) is not reachable from the session proxy.
   1) searchUrls(): title searches; parseSearch(html) -> event page URLs for CORE courses.
   2) parseEvent(html, url, { today }) -> { session } or { skip }. */
const { text, slug, parseDate, cleanUrl } = require('./util');

const BASE = 'https://www.nzda.org.nz/education/courses-events/';
const SEARCHES = ['core'].map(q => BASE + 'search-events?title=' + encodeURIComponent(q));
const SOURCE_KIND = 'provider-posted event on NZDA (NZ Dental Association) course portal; audience mainly dental teams';
const COURSE = [[/\bCORE Advanced\b/i, 'nzrc-core-advanced'], [/\bCORE Immediate\b/i, 'nzrc-core-immediate']];

function parseSearch(html) {
  const urls = new Set();
  for (const m of String(html).matchAll(/href="(https:\/\/www\.nzda\.org\.nz\/education\/courses-events\/([a-z0-9-]+))"/g))
    if (/(^|-)core-(advanced|immediate)(-|$)/.test(m[2])) urls.add(m[1]);
  return [...urls];
}

function parseEvent(html, url, { today, verifiedOn = today } = {}) {
  const h1 = text((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '');
  const def = COURSE.find(([re]) => re.test(h1));
  if (!def) return { skip: { reason: 'not a CORE course', url, title: h1 } };
  const when = (html.match(/<div class="when[^"]*">([\s\S]*?)<\/div>/) || [])[1] || '';
  const whenLines = text(when).split('\n');
  const start = parseDate(whenLines[0]);
  if (!start) return { skip: { reason: 'no date', url, title: h1, when: whenLines[0] } };
  if (start < today) return { skip: { reason: 'finished', url, title: h1 } };
  const field = name => { const m = html.match(new RegExp(`<strong>${name}:</strong>([\\s\\S]*?)</div>`)); return m ? text(m[1]).split('\n') : []; };
  const venueLines = field('Venue'), region = field('Region')[0] || null;
  const provider = text((html.match(/Brought to you by <strong>([\s\S]*?)<\/strong>/) || [])[1] || '') || null;
  const enrol = (html.match(/href="([^"]+)"[^>]*>\s*Enrol Now/) || [])[1];
  const book = enrol ? cleanUrl(enrol) : { url: null };
  const pre = h1.match(/^(.+?)\s+NZRC\b/);
  const city = (pre && pre[1].trim()) || venueLines[venueLines.length - 1] || region;
  if (!provider || !region || !city) return { skip: { reason: 'missing provider/region/city', url, title: h1 } };
  const session = {
    id: slug(def[1], region, city, start, provider), courseId: def[1], variant: 'full', provider, city, region, country: 'NZ',
    venue: venueLines.join(', ') || null, start, end: start, endInferred: false,
    priceFrom: null, currency: null, seatsStatus: null,
    bookingUrl: book.url || url, sourceUrl: url,
    datesQuote: `${whenLines.join(' | ')} | Venue: ${venueLines[0] || ''} | Region: ${region}`.slice(0, 300),
    lastVerified: verifiedOn, datesConfirmed: true, sourceKind: SOURCE_KIND, sourceRef: 'nzda:' + url.split('/').pop()
  };
  return { session };
}

module.exports = { parseSearch, parseEvent, SEARCHES, BASE, SOURCE_KIND };
