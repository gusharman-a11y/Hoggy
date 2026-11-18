'use strict';
/* RescueMED (wilderness / austere medicine, AU + NZ) course pages: https://rescuemed.com.au/courses/<slug>/
   Each page has label/value lines: "Dates:" / "8 - 12 March 2027 | 25 - 29 October 2027", "Investment:", "Location:".
   parse(html, def, { today, verifiedOn }) -> { sessions, skipped }. def = { slug, courseId, variant, city, region, country } */
const { text, slug } = require('../util');
const { ranges } = require('./resus-spums');

const BASE = 'https://rescuemed.com.au/courses/';
const SOURCE_KIND = 'RescueMED own course page';
const PAGES = [
  { slug: 'canyon-rescue-medicine', courseId: 'wilderness-rescue-medicine', variant: 'canyon', city: 'Blue Mountains', region: 'NSW', country: 'AU' },
  { slug: 'wilderness-rescue-medicine', courseId: 'wilderness-rescue-medicine', variant: 'bay-of-fires', city: 'Bay of Fires', region: 'TAS', country: 'AU' },
  { slug: 'wilderness-life-support-medical-professional', courseId: 'awls', variant: 'full', city: 'Mount Buller', region: 'VIC', country: 'AU' },
  { slug: 'wilderness-rescue-medicine-awls-fundamentals', courseId: 'awls', variant: 'full', city: 'Kinloch', region: 'Waikato', country: 'NZ' }
];
const after = (lines, label) => { const i = lines.findIndex(l => l.toLowerCase() === label); return i >= 0 ? lines[i + 1] : null; };
/* "7-10 December 2026" has no space around the dash; ranges() handles both */
function parse(html, def, { today, verifiedOn = today } = {}) {
  const lines = text(html).split('\n'), sessions = [], skipped = [], src = BASE + def.slug + '/';
  const d = after(lines, 'dates:'), loc = after(lines, 'location:'), inv = after(lines, 'investment:');
  if (!d) return { sessions, skipped: [{ reason: 'no Dates line', page: def.slug }] };
  for (const r of ranges(d.split('|').join(','))) {
    if (r.end < today) continue;
    sessions.push({
      id: slug(def.courseId, def.variant === 'full' ? null : def.variant, def.region, def.city, r.start), courseId: def.courseId, variant: def.variant,
      provider: 'RescueMED', city: def.city, region: def.region, country: def.country, venue: loc || null,
      start: r.start, end: r.end, endInferred: false, priceFrom: null, currency: null, seatsStatus: null,
      bookingUrl: src, sourceUrl: src, datesQuote: `Dates: ${d} | Location: ${loc || ''}`.slice(0, 200),
      lastVerified: verifiedOn, datesConfirmed: true, sourceKind: SOURCE_KIND,
      ...(inv ? { priceNote: `page "Investment": ${inv}` } : {})
    });
  }
  return { sessions, skipped };
}
module.exports = { parse, PAGES, BASE, SOURCE_KIND };
