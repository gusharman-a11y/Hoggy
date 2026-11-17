'use strict';
/* ACRRM face-to-face course pages (www.acrrm.org.au/courses/face-to-face/<course>): one HTML table per page with
   Dates | Course | Location | State | CPD Hours | Fees (Member/Non Member) | Available Spaces | Register.
   Each row's Register/Waitlist button links to mycollege.acrrm.org.au/...details?ID=<event id> (used as the stable key).
   parse(html, { today, sourceUrl }) -> { sessions, skipped, rows }. Only courses in COURSES are turned into sessions. */
const { text, slug, parseDate, addDays } = require('./util');

const BASE = 'https://www.acrrm.org.au/courses/face-to-face/';
const SOURCE_KIND = 'ACRRM own course page';
/* course title on the page -> catalogue course. days = face-to-face days stated on the course page (end inferred when > 1). */
const COURSES = [
  { re: /^Advanced Life Support Level 2\b/i, courseId: 'als2', variant: 'acrrm-one-day', page: 'als', days: 1, idPrefix: 'als2-acrrm' },
  { re: /^Rural Emergency Skills Training\b/i, courseId: 'acrrm-rest', variant: 'full', page: 'rest', days: 2 },
  { re: /^Paediatric Emergencies for Rural Generalists\b/i, courseId: 'acrrm-paediatric-emergencies', variant: 'full', page: 'paediatric-emergencies-for-rural-generalists', days: 2 },
  { re: /^Advanced Neonatal Resuscitation\b/i, courseId: 'acrrm-anr', variant: 'full', page: 'advanced-neonatal-resuscitation', days: 1 },
  { re: /^Rural Emergency Obstetrics? Training\b/i, courseId: 'acrrm-reot', variant: 'full', page: 'reot', days: 1 }
];
const PAGES = [...new Set(COURSES.map(c => c.page))];
const STATES = /^(ACT|NSW|NT|QLD|SA|TAS|VIC|WA)$/;
const CITY_FIX = { 'SYDNEY INTERNATIONAL AIRPORT': 'Sydney' };

function rows(html) {
  const out = [];
  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const tds = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => x[1]);
    if (tds.length < 8) continue;
    const c = tds.map(text);
    const date = parseDate(c[0]);
    const href = (tds[7].match(/href="([^"]+)"/) || [])[1] || null;
    const fees = {}; for (const f of c[5].split('\n')) { const x = f.match(/^(Member|Non Member):\s*([\d.,]+)/i); if (x) fees[x[1].toLowerCase()] = +x[2].replace(/,/g, ''); }
    out.push({ dateCell: c[0], date, course: c[1].replace(/\n/g, ' '), location: c[2].split('\n'), state: c[3], cpd: c[4], fees, spaces: c[6], action: c[7].replace(/\n/g, ' '), href: href && href.replace(/&amp;/g, '&') });
  }
  return out;
}

function parse(html, { today, verifiedOn = today, sourceUrl } = {}) {
  const sessions = [], skipped = [], rs = rows(html);
  for (const r of rs) {
    const def = COURSES.find(d => d.re.test(r.course));
    if (!def) { skipped.push({ reason: 'course not in scope', course: r.course }); continue; }
    if (!r.date || !STATES.test(r.state)) { skipped.push({ reason: 'bad date/state', course: r.course, dateCell: r.dateCell }); continue; }
    /* some titles print the range ("- Perth 27-28 Jan 2027"): use it when its first day matches the date cell */
    const tr = r.course.match(/(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    const titleEnd = tr && parseDate(`${tr[1]} ${tr[3]} ${tr[4]}`) === r.date ? parseDate(`${tr[2]} ${tr[3]} ${tr[4]}`) : null;
    const endInferred = !titleEnd && def.days > 1;
    const end = titleEnd || (def.days > 1 ? addDays(r.date, def.days - 1) : r.date);
    if (end < today) continue;
    const last = r.location[r.location.length - 1] || '';
    let city = last.split(',').pop().trim();
    city = CITY_FIX[city.toUpperCase()] || (city === city.toUpperCase() ? city.toLowerCase().replace(/\b[a-z]/g, x => x.toUpperCase()) : city);
    if (!city || /^online$/i.test(city)) { skipped.push({ reason: 'no city / online', course: r.course, date: r.date }); continue; }
    const venue = r.location.length > 1 || last.includes(',') ? r.location.join(', ') : null;
    const prices = [r.fees.member, r.fees['non member']].filter(x => x > 0);
    const spaces = /^\d+$/.test(r.spaces) ? +r.spaces : null;
    const seatsStatus = /waitlist/i.test(r.action) ? 'waitlist' : spaces === 0 ? 'full' : /register/i.test(r.action) ? 'open' : null;
    const eventId = r.href && (r.href.match(/[?&]ID=(\d+)/i) || [])[1];
    const cpd = /^\d+(\.\d+)?$/.test(r.cpd) ? +r.cpd : 0;
    const src = sourceUrl || BASE + def.page;
    const feeText = [r.fees.member != null && `Member: ${r.fees.member.toFixed(2)}`, r.fees['non member'] != null && `Non Member: ${r.fees['non member'].toFixed(2)}`].filter(Boolean).join(' ');
    sessions.push({
      id: def.idPrefix ? slug(def.idPrefix, r.state, city, r.date) : slug(def.courseId, r.state, city, r.date),
      courseId: def.courseId, variant: def.variant, provider: 'ACRRM (Australian College of Rural and Remote Medicine)',
      city, region: r.state, country: 'AU', venue, start: r.date, end, endInferred,
      ...(endInferred ? { endNote: `row gives the first day only; the ACRRM course page describes ${def.days} face-to-face workshop days` } : {}),
      priceFrom: prices.length ? Math.min(...prices) : null, currency: prices.length ? 'AUD' : null,
      ...(prices.length ? { priceNote: 'Member / Non Member fee as listed (currency not printed; ACRRM is an Australian college)' } : {}),
      seatsStatus, placesRemaining: spaces,
      cpdHours: cpd, ...(cpd ? { cpdSource: src } : {}),
      bookingUrl: r.href && /^https:\/\//.test(r.href) ? r.href : src, sourceUrl: src,
      datesQuote: `${r.dateCell} | ${r.course} | ${city} ${r.state} | CPD Hours ${r.cpd} | ${feeText} | Available Spaces ${r.spaces} | ${r.action}`.slice(0, 300),
      lastVerified: verifiedOn, datesConfirmed: true, sourceKind: SOURCE_KIND, ...(eventId ? { sourceRef: 'acrrm:' + eventId } : {})
    });
  }
  return { sessions, skipped, rows: rs.length };
}

module.exports = { parse, rows, COURSES, PAGES, BASE, SOURCE_KIND };
