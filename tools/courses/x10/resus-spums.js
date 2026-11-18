'use strict';
/* SPUMS (South Pacific Underwater Medicine Society) "Approved courses for Doctors" page:
   https://spums.au/index.php/education/spums-approved-courses-for-doctors
   Free text per course: heading, "Dates: 26 April -7 May 2027 (...)", "Venue: ...", "Cost: ...".
   Only the two ANZ courses are mapped (ANZHMG introductory course, RAN MOUM); overseas ones are skipped.
   parse(html, { today, verifiedOn }) -> { sessions, skipped }. */
const { text, slug, parseDate } = require('../util');

const SOURCE_URL = 'https://spums.au/index.php/education/spums-approved-courses-for-doctors';
const SOURCE_KIND = 'SPUMS approved-courses page (course approver; dates as published there for each provider)';
const COURSES = [
  { head: /Introductory Course in Diving and Hyperbaric Medicine/i, courseId: 'diving-hyperbaric-intro', provider: 'Australian and New Zealand Hyperbaric Medicine Group (ANZHMG)', city: 'Fremantle', region: 'WA' },
  { head: /Medical Officers.? Underwater Medicine Course/i, courseId: 'ran-moum', provider: 'Royal Australian Navy, Submarine and Underwater Medicine Unit (HMAS Penguin)', city: 'Sydney', region: 'NSW' }
];

/* "26 April -7 May 2027" | "8-19 March 2027" -> [{start,end,text}] (comma-separated list allowed) */
function ranges(s) {
  const out = [];
  for (const part of String(s).split(/,\s*/)) {
    let m = part.match(/(\d{1,2})\s+([A-Za-z]+)\s*[-–]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (m) { out.push({ start: parseDate(`${m[1]} ${m[2]} ${m[5]}`), end: parseDate(`${m[3]} ${m[4]} ${m[5]}`), text: m[0] }); continue; }
    m = part.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (m) out.push({ start: parseDate(`${m[1]} ${m[3]} ${m[4]}`), end: parseDate(`${m[2]} ${m[3]} ${m[4]}`), text: m[0] });
  }
  return out.filter(r => r.start && r.end);
}

function parse(html, { today, verifiedOn = today } = {}) {
  const lines = text(html).split('\n'), sessions = [], skipped = [];
  for (const c of COURSES) {
    const i = lines.findIndex(l => c.head.test(l));
    if (i < 0) { skipped.push({ reason: 'course heading not found', course: c.courseId }); continue; }
    const block = lines.slice(i, i + 12);
    const dl = block.find(l => /^Dates?:/i.test(l)), vl = block.find(l => /^Venue:/i.test(l));
    if (!dl) { skipped.push({ reason: 'no Dates line', course: c.courseId }); continue; }
    for (const r of ranges(dl.replace(/\(.*$/, ''))) {
      if (r.end < today) continue;
      sessions.push({
        id: slug(c.courseId, c.region, c.city, r.start), courseId: c.courseId, variant: 'full', provider: c.provider,
        city: c.city, region: c.region, country: 'AU', venue: vl ? vl.replace(/^Venue:\s*/i, '') : null,
        start: r.start, end: r.end, endInferred: false, priceFrom: null, currency: null,
        seatsStatus: /now full|waiting list/i.test(dl) ? 'waitlist' : null,
        bookingUrl: SOURCE_URL, sourceUrl: SOURCE_URL, datesQuote: `${lines[i]} | ${dl}`.slice(0, 200),
        lastVerified: verifiedOn, datesConfirmed: true, sourceKind: SOURCE_KIND,
        bookingNote: 'apply by e-mail to the contact named on the SPUMS page'
      });
    }
  }
  return { sessions, skipped };
}

module.exports = { parse, ranges, SOURCE_URL, SOURCE_KIND };
