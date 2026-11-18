'use strict';
/* ACCCN (Australian College of Critical Care Nurses) ALS course listing: https://acccn.com.au/events/courses/
   One tile per course: <h4>STATE Title DATES - Venue</h4> ... <a href="?event=N">Open</a>. No feed or JSON-LD.
   parse(html, { today, verifiedOn }) -> { sessions, skipped }. */
const { decode, slug, parseDate } = require('../util');

const SOURCE_URL = 'https://acccn.com.au/events/courses/';
const SOURCE_KIND = 'ACCCN own ALS course listing (course owner and provider)';
const STATES = /^(NSW|ACT|QLD|SA|NT|TAS|VIC|WA)\s+/;
/* venue text on the tile -> display city (+ region when the branch label differs). Venue string itself is kept as given. */
const VENUES = [
  [/welshpool/i, 'Welshpool'], [/women's and children's hospital/i, 'North Adelaide'], [/werribee/i, 'Werribee'],
  [/^ANMF$/i, 'Melbourne'], [/westmead/i, 'Westmead'], [/calvary bruce/i, 'Bruce', 'ACT']
];

/* "21 & 22 November 2026" | "7 December 2026" | "31 January & 1 February 2027" -> { start, end } */
function dates(s) {
  let m = s.match(/(\d{1,2})\s*(?:&|-|–|and)\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m) return { start: parseDate(`${m[1]} ${m[3]} ${m[4]}`), end: parseDate(`${m[2]} ${m[3]} ${m[4]}`), text: m[0] };
  m = s.match(/(\d{1,2})\s+([A-Za-z]+)\s*(?:&|-|–|and)\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m) return { start: parseDate(`${m[1]} ${m[2]} ${m[5]}`), end: parseDate(`${m[3]} ${m[4]} ${m[5]}`), text: m[0] };
  m = s.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m) { const d = parseDate(m[0]); return { start: d, end: d, text: m[0] }; }
  return null;
}

function classify(title) {
  const recert = /recertification/i.test(title);
  if (/instructor/i.test(title)) {
    const sub = /paediatric/i.test(title) ? 'paediatric-' : /adult/i.test(title) ? 'adult-' : '';
    return { courseId: 'acccn-als-instructor', variant: sub + (recert ? 'recertification' : 'full') };
  }
  if (/paediatric/i.test(title)) return { courseId: 'acccn-paediatric-als', variant: recert ? 'recertification' : 'full' };
  if (/adult/i.test(title)) return { courseId: 'acccn-adult-als', variant: recert ? 'recertification' : 'full' };
  return null;
}

function parse(html, { today, verifiedOn = today } = {}) {
  const sessions = [], skipped = [];
  for (const m of String(html).matchAll(/<div class="acccn-tile[^"]*"[^>]*>\s*<h4>([\s\S]*?)<\/h4>[\s\S]*?href="\?event=(\d+)"/g)) {
    const title = decode(m[1]).replace(/\s+/g, ' ').trim(), eventId = m[2];
    const st = title.match(STATES);
    const kind = classify(title), d = dates(title);
    if (!st || !kind || !d || !d.start || !d.end) { skipped.push({ reason: 'unparsed tile', title }); continue; }
    if (d.end < today) continue;
    const venue = (title.split(/\s+-\s+/).slice(1).join(' - ') || '').trim();
    const v = VENUES.find(([re]) => re.test(venue));
    const city = v ? v[1] : venue, region = v && v[2] ? v[2] : st[1];
    if (!city) { skipped.push({ reason: 'no venue', title }); continue; }
    sessions.push({
      id: slug(kind.courseId, kind.variant === 'full' ? null : kind.variant, region, city, d.start),
      courseId: kind.courseId, variant: kind.variant, provider: 'ACCCN (Australian College of Critical Care Nurses)',
      city, region, country: 'AU', venue: venue || null, start: d.start, end: d.end, endInferred: false,
      priceFrom: null, currency: null, seatsStatus: null,
      bookingUrl: `${SOURCE_URL}?event=${eventId}`, sourceUrl: SOURCE_URL,
      datesQuote: title.slice(0, 200), lastVerified: verifiedOn, datesConfirmed: true, sourceKind: SOURCE_KIND,
      sourceRef: 'acccn:' + eventId,
      ...(v ? { cityNote: 'city derived from the venue named on the tile' } : {}),
      priceNote: 'ACCCN publishes one rate card for all courses (member / non-member); see catalogue feeRange'
    });
  }
  return { sessions, skipped };
}

module.exports = { parse, dates, classify, SOURCE_URL, SOURCE_KIND };
