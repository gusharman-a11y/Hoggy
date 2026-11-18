'use strict';
/* St John PRIME (Primary Response in Medical Emergencies, NZ) course calendar: https://prime.stjohn.org.nz/calendar/
   ASP.NET DataList rows: city | one line per day "23.11.2026 - 8.30am to 5pm" | Book now / Go on wait list (booking.aspx?id=N).
   Rows with several consecutive days are the five-day initial course; single-day rows are the one-day refresher
   (the page: "The initial course is five days, Mon – Fri (40 hours), the refresher is one day (Sat or Sun) 8 hours").
   parse(html, { today, verifiedOn }) -> { sessions, skipped }. */
const { text, slug } = require('../util');
const { nzRegion, dotDate } = require('./resus-util');

const SOURCE_URL = 'https://prime.stjohn.org.nz/calendar/';
const SOURCE_KIND = 'St John New Zealand PRIME course calendar (provider page)';

function parse(html, { today, verifiedOn = today } = {}) {
  const sessions = [], skipped = [];
  for (const m of String(html).matchAll(/<tr bgcolor="#ffffff">([\s\S]*?)<\/tr>\s*<\/td>/g)) {
    const tds = [...m[1].matchAll(/<td class="Content"[^>]*>([\s\S]*?)<\/td>\s*(?=<td|$)/gi)].map(x => x[1]);
    const cityM = m[1].match(/CityLabel">([^<]+)</);
    const lines = text((m[1].match(/<td class="Content" valign="top">((?:\d{1,2}\.\d{1,2}\.\d{4}[^<]*<br>)+)<\/td>/) || [])[1] || '').split('\n').filter(Boolean);
    const days = lines.map(l => dotDate(l.split(/\s+-\s+/)[0])).filter(Boolean).sort();
    const book = m[1].match(/booking\.aspx\?id=(\d+)'[^>]*>([^<]+)</);
    if (!cityM || !days.length) { skipped.push({ reason: 'unparsed row', cells: tds.length }); continue; }
    const city = cityM[1].trim(), region = nzRegion(city);
    if (!region) { skipped.push({ reason: 'region unknown', city }); continue; }
    const start = days[0], end = days[days.length - 1];
    if (end < today) continue;
    const variant = days.length >= 2 ? 'full' : 'refresher';
    sessions.push({
      id: slug('nz-prime', variant === 'full' ? null : variant, region, city, start),
      courseId: 'nz-prime', variant, provider: 'St John New Zealand (PRIME)',
      city, region, country: 'NZ', venue: null, start, end, endInferred: false,
      priceFrom: null, currency: null,
      seatsStatus: book && /wait/i.test(book[2]) ? 'waitlist' : book ? 'open' : null,
      bookingUrl: book ? `https://prime.stjohn.org.nz/booking.aspx?id=${book[1]}` : SOURCE_URL, sourceUrl: SOURCE_URL,
      datesQuote: `${city} ${lines.join(' ')}${book ? ' ' + book[2].trim() : ''}`.slice(0, 200),
      lastVerified: verifiedOn, datesConfirmed: true, sourceKind: SOURCE_KIND, ...(book ? { sourceRef: 'prime:' + book[1] } : {})
    });
  }
  return { sessions, skipped };
}

module.exports = { parse, SOURCE_URL, SOURCE_KIND };
