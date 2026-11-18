'use strict';
/* Royal College of Surgeons of Edinburgh (services.rcsed.ac.uk).
   Listing: /events-courses/rcsed-courses-and-events?page=N (15 a page) -> course pages /events-courses/<slug>/.
   Course page "Key Facts" -> "View locations and dates": <li><strong>Location</strong><ul><li><a title="...">DD Mon YYYY ...</a>.
   Only start dates are printed. The end date is derived from the length the course page states in its own text
   ("This 2.5 day ... course", "two-and-a-half day course", "one-day") and flagged endInferred; a course page that
   states no length is skipped (no end invented). robots.txt disallows /events-courses/event-entry (not used).
   Booking links on web.rcsed.ac.uk carry session tokens, so bookingUrl is the course page. */
const { text, slug, addDays } = require('../util');

const HOST = 'https://services.rcsed.ac.uk';
const LISTING = HOST + '/events-courses/rcsed-courses-and-events';
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const iso = (d, m, y) => { const n = MON[m.slice(0, 3).toLowerCase()]; if (!n) return null; const s = `${y}-${String(n).padStart(2, '0')}-${String(d).padStart(2, '0')}`; const t = new Date(s + 'T00:00:00Z'); return !isNaN(t) && t.toISOString().slice(0, 10) === s ? s : null; };
const WORD = { half: 0.5, one: 1, two: 2, three: 3, four: 4, five: 5, 'two-and-a-half': 2.5, 'one-and-a-half': 1.5, 'three-and-a-half': 3.5 };

/* -> { days, quote } or null. Looks only in the course's own overview text. */
function courseLength(plain) {
  const ov = plain.slice(Math.max(0, plain.indexOf('Overview')));
  const m = ov.match(/\b(\d(?:\.5)?|half|one|two|three|four|five|(?:one|two|three)-and-a-half)[- ]day\b/i);
  if (!m) return null;
  const k = m[1].toLowerCase(), n = WORD[k] != null ? WORD[k] : +k;
  if (!(n > 0 && n <= 5)) return null;
  const i = ov.indexOf(m[0]);
  const from = Math.max(ov.lastIndexOf('. ', i) + 2, ov.lastIndexOf('Overview ', i) + 9, i - 80);
  let to = ov.indexOf('. ', i); if (to < 0 || to > i + 120) to = i + m[0].length + 60;
  return { days: Math.max(1, Math.ceil(n)), quote: ov.slice(from, to).trim() };
}

function listingLinks(html) {
  return [...new Set([...String(html).matchAll(/href="((?:https:\/\/services\.rcsed\.ac\.uk)?\/events-courses\/[a-z0-9-]+\/?)"/g)].map(m => m[1].startsWith('http') ? m[1] : HOST + m[1]))]
    .filter(u => !/\/(rcsed-courses-and-events|events-and-courses-calendar|external-courses-and-events|abstract-submission|surgical-skills-competition)\/?$/.test(u));
}

function parseCoursePage(html, { today, verifiedOn = today, pageUrl }) {
  const H = String(html), sessions = [], skipped = [];
  const title = text((H.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1] || '').trim();
  const block = (H.match(/<ul id="hover1"[\s\S]*?<\/ul>\s*<\/li>\s*<\/ul>/) || [])[0] || '';
  if (!block) return { title, sessions, skipped: [{ reason: 'no dated sessions', title }] };
  const plain = text(H).replace(/\s+/g, ' ');
  const len = courseLength(plain);
  const cpd = (plain.match(/Is CPD awarded for this course\? Yes, (\d+(?:\.\d+)?) Hours/) || [])[1];
  const cost = (plain.match(/How much does this course cost\? From £([\d,]+(?:\.\d\d)?)/) || [])[1];
  for (const loc of block.split(/<li><strong>/).slice(1)) {
    const where = text(loc.split('</strong>')[0]).trim();
    for (const a of loc.matchAll(/<a title="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)) {
      const t = text(a[2]).replace(/\s+/g, ' ').trim();
      const m = t.match(/^(\d{1,2}) ([A-Za-z]{3,9}) (\d{4})(?:\s*-\s*(\d{1,2}) ([A-Za-z]{3,9}) (\d{4}))?/);
      if (!m) { skipped.push({ reason: 'no date', title, t }); continue; }
      const start = iso(m[1], m[2], m[3]); if (!start) continue;
      let end, endInferred = false, endNote;
      if (m[4]) end = iso(m[4], m[5], m[6]);
      else if (len) { end = addDays(start, len.days - 1); endInferred = len.days > 1; if (endInferred) endNote = `RCSEd lists only the start date; the course page says "${len.quote}", so end = start + ${len.days - 1} (assumes consecutive days)`; }
      else { skipped.push({ reason: 'course page states no length; end unknown', title, start }); continue; }
      if (end < today) continue;
      const full = /full/i.test(a[1]) || /\bFULL\b/.test(t), wait = /waiting list/i.test(a[1]);
      const city = where.split(/\s+-\s+/)[0].trim();
      sessions.push({
        id: slug('rcsed', title, city, start), courseId: null, courseTitle: title, variant: 'full',
        provider: 'Royal College of Surgeons of Edinburgh', city, region: 'UK', country: 'GB', venue: where,
        start, end, endInferred, ...(endNote ? { endNote } : {}),
        priceFrom: cost ? +cost.replace(/,/g, '') : null, currency: cost ? 'GBP' : null, ...(cost ? { priceNote: 'course page "From" price (lowest fee band)' } : {}),
        seatsStatus: wait ? 'waitlist' : full ? 'full' : 'open',
        ...(cpd ? { cpdHours: +cpd, cpdSource: pageUrl, cpdNote: `RCSEd course page: "Is CPD awarded for this course? Yes, ${cpd} Hours"` } : {}),
        bookingUrl: pageUrl, sourceUrl: pageUrl,
        datesQuote: `${title} | ${where} | ${t}`.slice(0, 200),
        lastVerified: verifiedOn, datesConfirmed: true, sourceKind: 'RCSEd course page, Key Facts "View locations and dates"'
      });
    }
  }
  return { title, sessions, skipped, length: len };
}

async function fetchAll(client, { today, verifiedOn = today, log = () => {} } = {}) {
  const links = new Set(), blocked = [], sessions = [], skipped = [], perCourse = {};
  /* pager is 1-based (?page=1 is the first page) */
  for (let p = 1; p < 15; p++) {
    let h; try { h = await client.get(LISTING + (p > 1 ? `?page=${p}` : '')); } catch (e) { blocked.push({ url: LISTING, error: e.message }); break; }
    const before = links.size; listingLinks(h).forEach(u => links.add(u));
    if (links.size === before) break;
  }
  log(`rcsed: ${links.size} course pages`);
  for (const u of links) {
    let h; try { h = await client.get(u); } catch (e) { blocked.push({ url: u, error: e.message }); continue; }
    const r = parseCoursePage(h, { today, verifiedOn, pageUrl: u });
    sessions.push(...r.sessions); skipped.push(...r.skipped); perCourse[r.title || u] = r.sessions.length;
    log(`rcsed ${r.title}: ${r.sessions.length}${r.length ? ' (' + r.length.days + 'd)' : ''}`);
  }
  return { sessions, skipped, blocked, perCourse };
}

module.exports = { fetchAll, parseCoursePage, courseLength, listingLinks };
