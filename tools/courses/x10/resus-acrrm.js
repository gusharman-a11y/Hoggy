'use strict';
/* ACRRM face-to-face courses not covered by tools/courses/acrrm.js (Advanced Airway, RACM, PHEC, POCUS-RG).
   Same page table as acrrm.js, so its rows() is reused; only the course list and end-date rules differ.
   parse(html, page, { today, verifiedOn }) -> { sessions, skipped }. */
const { slug } = require('../util');
const { rows, BASE } = require('../acrrm');

const SOURCE_KIND = 'ACRRM own course page';
/* days: face-to-face days. dayNote: why a one-day end was taken when the page does not print a length. */
const COURSES = [
  { page: 'advanced-airway', re: /^Advanced Airway\b/i, courseId: 'acrrm-advanced-airway', days: 1, inferred: false },
  { page: 'racm', re: /^Rural Anaesthetic Crisis Management\b/i, courseId: 'acrrm-racm', days: 1, inferred: true,
    dayNote: 'row gives one date; the RACM page refers to "the hands-on workshop day" (one day)' },
  { page: 'pre-hospital-emergency-care-phec', re: /^Pre-Hospital Emergency Care\b/i, courseId: 'acrrm-phec', days: 1, inferred: true,
    dayNote: 'row gives one date; the PHEC page describes one hands-on face-to-face workshop and does not print its length' },
  { page: 'point-of-care-ultrasound-for-rural-generalists', re: /^Point of Care Ultrasound for Rural Generalists\b/i, courseId: 'acrrm-pocus-rg', days: 1, inferred: false }
];
const STATES = /^(ACT|NSW|NT|QLD|SA|TAS|VIC|WA)$/;

function parse(html, page, { today, verifiedOn = today } = {}) {
  const sessions = [], skipped = [], src = BASE + page;
  for (const r of rows(html)) {
    const def = COURSES.find(d => d.page === page && d.re.test(r.course));
    if (!def) { skipped.push({ reason: 'course not in scope', course: r.course }); continue; }
    if (!r.date || !STATES.test(r.state)) { skipped.push({ reason: 'bad date/state', course: r.course }); continue; }
    if (r.date < today) continue;
    const last = r.location[r.location.length - 1] || '';
    let city = last.split(',').pop().trim();
    if (city === city.toUpperCase()) city = city.toLowerCase().replace(/\b[a-z]/g, x => x.toUpperCase());
    if (!city || /^online$/i.test(city)) { skipped.push({ reason: 'no city / online', course: r.course }); continue; }
    const venue = r.location.length > 1 || last.includes(',') ? r.location.join(', ') : null;
    const prices = [r.fees.member, r.fees['non member']].filter(x => x > 0);
    const spaces = /^\d+$/.test(r.spaces) ? +r.spaces : null;
    const seatsStatus = /waitlist/i.test(r.action) ? 'waitlist' : spaces === 0 ? 'full' : /register/i.test(r.action) ? 'open' : null;
    const eventId = r.href && (r.href.match(/[?&]ID=(\d+)/i) || [])[1];
    const cpd = /^\d+(\.\d+)?$/.test(r.cpd) ? +r.cpd : 0;
    const feeText = [r.fees.member != null && `Member: ${r.fees.member.toFixed(2)}`, r.fees['non member'] != null && `Non Member: ${r.fees['non member'].toFixed(2)}`].filter(Boolean).join(' ');
    sessions.push({
      id: slug(def.courseId, r.state, city, r.date), courseId: def.courseId, variant: 'full',
      provider: 'ACRRM (Australian College of Rural and Remote Medicine)', city, region: r.state, country: 'AU', venue,
      start: r.date, end: r.date, endInferred: def.inferred, ...(def.inferred ? { endNote: def.dayNote } : {}),
      priceFrom: prices.length ? Math.min(...prices) : null, currency: prices.length ? 'AUD' : null,
      ...(prices.length ? { priceNote: 'Member / Non Member fee as listed (currency not printed; ACRRM is an Australian college)' } : {}),
      seatsStatus, placesRemaining: spaces, cpdHours: cpd, ...(cpd ? { cpdSource: src } : {}),
      bookingUrl: r.href && /^https:\/\//.test(r.href) ? r.href : src, sourceUrl: src,
      datesQuote: `${r.dateCell} | ${r.course} | ${city} ${r.state} | CPD Hours ${r.cpd} | ${feeText} | Available Spaces ${r.spaces} | ${r.action}`.slice(0, 200),
      lastVerified: verifiedOn, datesConfirmed: true, sourceKind: SOURCE_KIND, ...(eventId ? { sourceRef: 'acrrm:' + eventId } : {})
    });
  }
  return { sessions, skipped };
}

module.exports = { parse, COURSES, PAGES: COURSES.map(c => c.page), SOURCE_KIND };
