'use strict';
/* UWA CTEC (Clinical Training & Evaluation Centre, Perth) workshop pages: https://www.ctec.uwa.edu.au/workshops/<slug>
   Each page has a "Dates" section of <div class="workshop ..."> blocks: <time>start</time> [- <time>end</time>],
   per-role availability ("Doctor Sold out"), and a Book now (Eventbrite, published by CTEC) or Register interest link.
   Fees (#workshop-fees) are read for the catalogue, not per session. The visible date text is used (the datetime
   attribute carries odd times). parse(html, { today, verifiedOn, sourceUrl, courseId }) -> { sessions, skipped }. */
const { text, slug, parseDate, cleanUrl } = require('../util');

const SOURCE_KIND = 'UWA CTEC own workshop page (bookings via CTEC-published Eventbrite events)';
const VENUE = 'CTEC, The University of Western Australia, Entrance No.2, Hackett Drive, Crawley, Perth, Western Australia';

function parse(html, { today, verifiedOn = today, sourceUrl, courseId } = {}) {
  const sessions = [], skipped = [];
  const h = String(html), i = h.indexOf('id="workshop-dates"'), j = h.indexOf('id="workshop-overview"');
  if (i < 0) return { sessions, skipped: [{ reason: 'no dates section' }] };
  const sec = h.slice(i, j > i ? j : undefined);
  for (const b of sec.split(/<div class="workshop rounded/).slice(1)) {
    const times = [...b.matchAll(/<time[^>]*>([^<]+)<\/time>/g)].map(x => x[1].trim());
    const start = parseDate(times[0]), end = times[1] ? parseDate(times[1]) : start;
    if (!start || !end) { skipped.push({ reason: 'no date', text: text(b).slice(0, 80) }); continue; }
    if (end < today) continue;
    const status = [...b.matchAll(/>\s*(Doctor|Nurse|Observer)\s*<span[^>]*>([^<]+)<\/span>/g)].map(x => `${x[1].trim()} ${x[2].trim()}`);
    const doc = status.find(s => /^Doctor/i.test(s)) || status[0] || '';
    const link = b.match(/<a href="([^"]+)"[^>]*title="(Book now|Register interest)"/);
    const href = link && /^https:\/\//.test(link[1]) ? cleanUrl(link[1]).url : null;
    const seatsStatus = /sold out/i.test(doc) ? 'full' : /available/i.test(doc) ? (link && link[2] === 'Book now' ? 'open' : null) : null;
    sessions.push({
      id: slug(courseId, 'WA', 'Perth', start, 'ctec'), courseId, variant: 'full', provider: 'UWA CTEC (Clinical Training & Evaluation Centre)',
      city: 'Perth', region: 'WA', country: 'AU', venue: VENUE, start, end, endInferred: false,
      priceFrom: null, currency: null, seatsStatus,
      bookingUrl: href || sourceUrl, sourceUrl,
      datesQuote: [times.join(' - '), ...status, link ? link[2] : ''].filter(Boolean).join(' | ').slice(0, 200),
      lastVerified: verifiedOn, datesConfirmed: true, sourceKind: SOURCE_KIND,
      ...(link && link[2] === 'Register interest' ? { bookingNote: 'page shows "Register interest" (no booking link yet)' } : {}),
      priceNote: 'fees on the workshop page (WA / non-WA participant); see catalogue feeRange'
    });
  }
  return { sessions, skipped };
}

/* "WA Participant: $890 Non-WA Participant: $1000" -> { min, max, text } */
function fees(html) {
  const h = String(html), i = h.indexOf('id="workshop-fees"');
  if (i < 0) return null;
  const t = text(h.slice(i, i + 3000)).split('\n').slice(1, 8).filter(l => /\$\d/.test(l));
  const nums = t.map(l => +(l.match(/\$([\d,]+)/)[1].replace(/,/g, '')));
  return nums.length ? { min: Math.min(...nums), max: Math.max(...nums), lines: t } : null;
}

module.exports = { parse, fees, SOURCE_KIND, VENUE };
