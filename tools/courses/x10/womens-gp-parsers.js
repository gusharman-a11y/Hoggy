'use strict';
/* x10 "womens-gp" desk: parsers for AU/NZ women's health, sexual health, skin, ultrasound and GP-education providers.
   Every parser reads ONE page (or feed) from the provider's own site and returns sessions with the evidence fields used in
   data/courses/sessions.json (sourceUrl, datesQuote <= 200 chars copied from the page text, lastVerified, datesConfirmed).
   Parsers never invent fees, CPD or end dates: an end derived from a stated length is flagged endInferred:true.
   Signature: parseX(body, { url, today, verifiedOn, ... }) -> { sessions, skipped }. */
const { text, slug, parseDate, addDays } = require('../util');

const lines = html => text(html).split('\n').map(s => s.trim()).filter(Boolean);
const q = s => String(s).replace(/\s+/g, ' ').trim().slice(0, 200);
const base = (o, extra) => ({ lastVerified: o.verifiedOn || o.today, datesConfirmed: true, ...extra });
const STATE_RE = /\b(ACT|NSW|NT|QLD|SA|TAS|VIC|WA)\b\s*(\d{4})?/;
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const dedupe = arr => { const seen = new Set(); return arr.filter(s => { const k = [s.courseId, s.variant, s.city, s.start, s.end, s.venue].join('|'); if (seen.has(k)) return false; seen.add(k); return true; }); };
const decodeEnt = s => String(s || '').replace(/&#8211;|&ndash;/g, '–').replace(/&#8217;|&#039;|&rsquo;/g, '’').replace(/&#038;|&amp;/g, '&').replace(/&#8216;/g, '‘').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------- The Events Calendar (WordPress "tribe") REST feed: FSEP (RANZCOG) ---------- */
/* opts.classify(event) -> { courseId, variant, provider, skip?, accessNote? } */
function parseTribe(json, o) {
  const sessions = [], skipped = [];
  for (const e of (json && json.events) || []) {
    const title = decodeEnt(e.title);
    const start = String(e.start_date || '').slice(0, 10), end = String(e.end_date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) { skipped.push({ reason: 'no date', title }); continue; }
    if (end < o.today) continue;
    const desc = decodeEnt(e.description);
    const cf = Object.fromEntries(Object.values(e.custom_fields || {}).map(x => [x.label, x.value]));
    const c = o.classify(e, { title, desc, cf });
    if (!c || c.skip) { skipped.push({ reason: (c && c.skip) || 'not in scope', title, start }); continue; }
    const v = e.venue && !Array.isArray(e.venue) ? e.venue : null;
    const region = c.region || (v && (v.stateprovince || v.state || v.province)) || cf.Location || '';
    const country = c.country || (region === 'NZ' ? 'NZ' : 'AU');
    const city = c.city || (v && v.city) || title;
    sessions.push(base(o, {
      id: slug(c.courseId, region === 'NZ' ? 'nz' : region, city, start), courseId: c.courseId, variant: c.variant || 'full',
      provider: c.provider, city, region: region === 'NZ' ? (c.nzRegion || 'NZ') : region, country,
      venue: c.venue || title, start, end, endInferred: false, priceFrom: null, currency: null, seatsStatus: null,
      bookingUrl: e.url, sourceUrl: o.url, coursePage: e.url,
      datesQuote: q(`${title} | start_date ${e.start_date} | end_date ${e.end_date}${cf.Location ? ' | Location ' + cf.Location : ''}${cf['Event Type'] ? ' | Event Type ' + cf['Event Type'] : ''}`),
      sourceKind: o.sourceKind, sourceRef: 'tribe:' + e.id,
      ...(c.accessNote ? { accessNote: c.accessNote } : {})
    }));
  }
  return { sessions, skipped };
}

/* ---------- Skin Cancer College Australasia (iMIS EventDetail pages) ---------- */
/* Practical workshop dates = the face-to-face session. Online-only intakes (Certificate of Dermoscopy) are returned in onlineIntakes. */
function parseScca(html, o) {
  const L = lines(html), sessions = [], skipped = [], onlineIntakes = [];
  const title = L.find(l => /(Certificate of|Workshop|Webinar|Masterclass)/.test(l) && / - [A-Z][a-z]+ \d{4}$/.test(l)) || L.find(l => / - [A-Z][a-z]+ \d{4}$/.test(l));
  if (!title) return { sessions, skipped: [{ reason: 'no title' }], onlineIntakes };
  const i = L.indexOf('Practical Workshop');
  const feeLine = L.find(l => /^\$[\d,]+(\s*-\s*\$?[\d,]+)? inc GST$/.test(l));
  const fees = feeLine ? feeLine.match(/[\d,]+/g).map(x => +x.replace(/,/g, '')) : [];
  const fi = feeLine ? L.indexOf(feeLine) : -1;
  const venueLines = fi > 0 ? L.slice(fi + 1, fi + 4).filter(l => !/^(Quick Links|About Us|Online)$/i.test(l)) : [];
  const course = /Advanced Skin Surgery/i.test(title) ? 'scca-advanced-skin-surgery-workshop' : /Skin Cancer Medicine/i.test(title) ? 'scca-certificate-skin-cancer-medicine' : /Dermoscopy/i.test(title) ? 'scca-certificate-dermoscopy' : null;
  if (!course) return { sessions, skipped: [{ reason: 'course not in scope', title }], onlineIntakes };
  const cityM = title.match(/^(Sydney|Melbourne|Brisbane|Perth|Adelaide|Hobart|Auckland|Christchurch|Wellington|Gold Coast|Darwin|Canberra)\b/);
  if (i < 0) {
    /* online cohort course: keep the intake dates for the catalogue */
    const r = L.find(l => /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, \d{2} [A-Z][a-z]+ \d{4} to$/.test(l));
    const ri = r ? L.indexOf(r) : -1;
    if (ri >= 0) onlineIntakes.push({ courseId: course, title, start: parseDate(r.replace(/ to$/, '')), end: parseDate(L[ri + 1]), sourceUrl: o.url, quote: q(`${title} | ${r} ${L[ri + 1]}`), priceText: feeLine || null });
    return { sessions, skipped: [{ reason: 'online intake (catalogue only)', title }], onlineIntakes };
  }
  const when = L[i + 1];
  let start, end, m;
  if ((m = when.match(/^(\d{1,2}) ([A-Z][a-z]+) - (\d{1,2}) ([A-Z][a-z]+) (\d{4})$/))) { start = parseDate(`${m[1]} ${m[2]} ${m[5]}`); end = parseDate(`${m[3]} ${m[4]} ${m[5]}`); }
  else if ((m = when.match(/^(\d{1,2}) - (\d{1,2}) ([A-Z][a-z]+) (\d{4})$/))) { start = parseDate(`${m[1]} ${m[3]} ${m[4]}`); end = parseDate(`${m[2]} ${m[3]} ${m[4]}`); }
  else { start = end = parseDate(when); }
  if (!start || !end) return { sessions, skipped: [{ reason: 'unparsed workshop date', title, when }], onlineIntakes };
  if (end < o.today) return { sessions, skipped, onlineIntakes };
  const city = cityM ? cityM[1] : (venueLines.join(' ').match(/\b(Sydney|Melbourne|Brisbane|Auckland|Christchurch)\b/) || [])[1];
  if (!city) return { sessions, skipped: [{ reason: 'no city', title }], onlineIntakes };
  const nz = /^(Auckland|Christchurch|Wellington)$/.test(city);
  const vs = venueLines.join(', ');
  const st = (vs.match(STATE_RE) || [])[1] || { Sydney: 'NSW', Melbourne: 'VIC', Brisbane: 'QLD', Perth: 'WA', Adelaide: 'SA' }[city];
  const key = (o.url.match(/EventKey=([A-Z0-9_]+)/) || [])[1];
  const onl = L[L.indexOf('Online Learning') + 1];
  sessions.push(base(o, {
    id: slug(course, nz ? 'nz' : st, city, start), courseId: course, variant: 'practical-workshop', provider: 'Skin Cancer College Australasia (SCCA)',
    city, region: nz ? (city === 'Auckland' ? 'Auckland' : city === 'Christchurch' ? 'Canterbury' : 'Wellington') : st, country: nz ? 'NZ' : 'AU',
    venue: vs || null, start, end, endInferred: false,
    priceFrom: fees.length ? Math.min(...fees) : null, currency: fees.length ? (nz ? 'NZD' : 'AUD') : null,
    ...(fees.length ? { priceNote: 'course fee as listed on the event page (includes the online learning); page says "AUD / NZD", inc GST, member discount $110' } : {}),
    seatsStatus: null, bookingUrl: o.url, sourceUrl: o.url,
    datesQuote: q(`${title} | Online Learning ${onl || ''} | Practical Workshop ${when}`),
    sourceKind: 'SCCA own event page (iMIS)', ...(key ? { sourceRef: 'scca:' + key } : {}),
    sessionNote: `face-to-face practical workshop; online learning ${onl || 'before the workshop'}`
  }));
  return { sessions, skipped, onlineIntakes };
}

/* ---------- HealthCert practical workshops calendar ---------- */
const HC_COURSES = [
  [/^Advanced Skin Cancer Medicine Practical Workshop$/, 'healthcert-skin-cancer-medicine-workshop', 'advanced'],
  [/^Skin Cancer Medicine Practical Workshop$/, 'healthcert-skin-cancer-medicine-workshop', 'core'],
  [/^Complex Skin Cancer Surgery Practical Workshop$/, 'healthcert-skin-cancer-surgery-workshop', 'complex'],
  [/^Advanced Skin Cancer Surgery Practical Workshop$/, 'healthcert-skin-cancer-surgery-workshop', 'advanced'],
  [/^Skin Cancer Surgery Practical Workshop$/, 'healthcert-skin-cancer-surgery-workshop', 'core'],
  [/^Professional Certificate of Clinical Procedures$/, 'healthcert-clinical-procedures-workshop', 'full'],
  [/^Advanced Workshop of Non-Scalpel Vasectomy$/, 'no-scalpel-vasectomy-workshop', 'full'],
  [/^Advanced Workshop of Intrauterine Systems$/, 'iud-insertion-training', 'healthcert-advanced-workshop'],
  [/^Musculoskeletal and Sports Medicine Practical Workshop$/, 'healthcert-msk-sports-medicine-workshop', 'full']
];
function parseHealthcertCalendar(html, o) {
  const L = lines(html), sessions = [], skipped = [];
  let city = null, venue = null, day = null, dayLine = null;
  const startAt = L.findIndex(l => l === 'UPCOMING LEARNING OPPORTUNITIES');
  for (let i = Math.max(0, startAt); i < L.length; i++) {
    const l = L[i], m = l.match(/^(Brisbane|Sydney|Melbourne|Perth|Adelaide|Auckland) Practical Workshops$/);
    if (m) { city = m[1]; venue = L[i + 1]; continue; }
    if (/^Learn online, at your own pace/.test(l)) break;
    if (/^(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)$/.test(l) && parseDate(L[i + 1])) { day = parseDate(L[i + 1]); dayLine = `${l} ${L[i + 1]}`; i++; continue; }
    if (!city || !day) continue;
    const c = HC_COURSES.find(([re]) => re.test(l));
    if (!c) { if (/Workshop|Certificate/.test(l) && !/match that topic/.test(l)) skipped.push({ reason: 'course not in scope', title: l, city, day }); continue; }
    if (day < o.today) continue;
    const st = { Brisbane: 'QLD', Sydney: 'NSW', Melbourne: 'VIC', Perth: 'WA', Adelaide: 'SA' }[city];
    sessions.push(base(o, {
      id: slug(c[1], c[2] === 'full' ? '' : c[2], st, city, day), courseId: c[1], variant: c[2], provider: 'HealthCert Education',
      city, region: st, country: 'AU', venue: venue || null, start: day, end: day, endInferred: false,
      priceFrom: null, currency: null, seatsStatus: null, bookingUrl: o.url, sourceUrl: o.url,
      datesQuote: q(`${city} Practical Workshops | ${venue} | ${dayLine} | ${l}`), sourceKind: 'HealthCert own workshop calendar'
    }));
  }
  return { sessions: dedupe(sessions), skipped };
}

/* ---------- Healthed one-day GP seminars ---------- */
function parseHealthed(html, o) {
  const L = lines(html), sessions = [], skipped = [];
  const vi = L.findIndex(l => /^Venue for \d{4}$/.test(l));
  if (vi < 0) return { sessions, skipped: [{ reason: 'no venue block', url: o.url }] };
  const ti = L.findIndex(l => /^The Annual Women's & Children's Health Update$|^Healthed Medical Update$/.test(l));
  const city = ti > 0 ? L[ti - 1] : null, title = ti > 0 ? L[ti] : null;
  const d = parseDate(L[ti + 1]);
  const venue = L[vi + 1], d2 = parseDate(L[vi + 2]);
  if (!city || !d || d !== d2) return { sessions, skipped: [{ reason: 'date/venue mismatch', url: o.url }] };
  if (d < o.today) return { sessions, skipped };
  const courseId = /Women/.test(title) ? 'healthed-womens-childrens-health-update' : 'healthed-medical-update';
  const st = { Sydney: 'NSW', Melbourne: 'VIC', Brisbane: 'QLD', Perth: 'WA', Adelaide: 'SA', Hobart: 'TAS', Canberra: 'ACT', Darwin: 'NT' }[city];
  const addr = L[vi + 3] && !/located|^The /.test(L[vi + 3]) ? `, ${L[vi + 3]}` : '';
  sessions.push(base(o, {
    id: slug(courseId, st, city, d), courseId, variant: 'full', provider: 'Healthed', city, region: st, country: 'AU',
    venue: venue + addr, start: d, end: d, endInferred: false, priceFrom: null, currency: null, seatsStatus: null,
    bookingUrl: o.url, sourceUrl: o.url, datesQuote: q(`${city} | ${title} | ${L[ti + 1]} | Venue for ${d.slice(0, 4)} | ${venue} | ${L[vi + 2]}`),
    sourceKind: 'Healthed own seminar page'
  }));
  return { sessions, skipped };
}

/* ---------- Australian Institute of Ultrasound (WooCommerce product pages) ---------- */
function parseAiu(html, o) {
  const L = lines(html), sessions = [], skipped = [];
  const bi = L.findIndex(l => /^Home \/ Ultrasound Courses \//.test(l));
  if (bi < 0) return { sessions, skipped: [{ reason: 'no breadcrumb', url: o.url }] };
  const lenLine = L[bi + 1], name = decodeEnt(L[bi + 2]);
  const len = lenLine.match(/^(\d+(?:\.\d+)?) days?$/);
  const vi = L.indexOf('VENUE');
  const venue = vi > 0 ? L.slice(vi + 1, vi + 5).filter(l => !/^Directions/.test(l)).join(', ') : null;
  const st = venue && (venue.match(STATE_RE) || [])[1];
  const city = venue && /Broadbeach/.test(venue) ? 'Gold Coast' : venue ? (venue.split(', ').slice(-2, -1)[0] || null) : null;
  if (!venue || !st || !city) return { sessions, skipped: [{ reason: 'no venue/state', name }] };
  const days = len ? Math.ceil(+len[1]) : null;
  const pslug = (o.url.match(/ultrasound-courses\/(?:[^/]+\/)?([^/]+)\/?$/) || [])[1] || slug(name);
  const seen = new Set();
  for (const l of L) {
    const m = l.match(/^(\d{2}) ([A-Z][a-z]{2}) (\d{4}) (?:&#36;|\$)\s?([\d,]+\.\d{2})(.*)$/);
    if (!m) continue;
    const start = iso(m[3], MON[m[2].toLowerCase()], m[1]);
    if (seen.has(start)) continue; seen.add(start);
    if (start < o.today) continue;
    const end = days && days > 1 ? addDays(start, days - 1) : start;
    const status = /sold out|full/i.test(m[5]) ? 'full' : /wait/i.test(m[5]) ? 'waitlist' : /Book Now/i.test(m[5]) ? 'open' : null;
    sessions.push(base(o, {
      id: slug(o.courseIdFor(name), lenLine, start), courseId: o.courseIdFor(name), variant: lenLine.replace(/\s+/g, '-'),
      provider: 'Australian Institute of Ultrasound (AIU)', city, region: st, country: 'AU', venue, start, end,
      endInferred: !!(days && days > 1), ...(days && days > 1 ? { endNote: `start date from the booking list; course length "${lenLine}" on the page, consecutive days assumed` } : {}),
      priceFrom: +m[4].replace(/,/g, ''), currency: 'AUD', priceNote: 'price shown next to the date on the course page',
      seatsStatus: status, bookingUrl: o.url, sourceUrl: o.url,
      datesQuote: q(`${name} | ${lenLine} | ${l}`),
      sourceKind: 'AIU own course page (WooCommerce product)', sourceRef: `aiu:${pslug}:${start}`
    }));
  }
  return { sessions, skipped, name, lenLine };
}

/* ---------- Sexual Health Quarters (WA) course pages: "Dates Offered" ---------- */
function parseShq(html, o) {
  const L = lines(html), sessions = [], skipped = [];
  const di = L.indexOf('Dates Offered');
  if (di < 0) return { sessions, skipped: [{ reason: 'no Dates Offered', url: o.url }] };
  const vi = L.lastIndexOf('Venue');
  const venueLines = vi > 0 ? L.slice(vi + 1, vi + 3).filter(l => !/^(Course Fees|Register|Feedback)/.test(l)) : [];
  const physical = venueLines.find(l => /\bWA\b/.test(l));
  const regs = L.filter(l => /^Register for /i.test(l));
  for (let i = di + 1; i < L.length; i++) {
    const l = L[i];
    let m = l.match(/^(\d{1,2})(?:st|nd|rd|th)?(?: ([A-Z][a-z]+))?(?: (\d{4}))?(?: - (\d{1,2})(?:st|nd|rd|th)? ([A-Z][a-z]+) (\d{4}))? (\d{1,2}:\d{2} [ap]m) to (\d{1,2}:\d{2} [ap]m)$/);
    if (!m) { if (i > di + 1) break; continue; }
    let start, end;
    if (m[4]) { start = parseDate(`${m[1]} ${m[2] || m[5]} ${m[3] || m[6]}`); end = parseDate(`${m[4]} ${m[5]} ${m[6]}`); }
    else { start = end = parseDate(`${m[1]} ${m[2]} ${m[3]}`); }
    if (!start || !end) { skipped.push({ reason: 'bad date', line: l }); continue; }
    if (end < o.today) continue;
    const mon = new Date(start + 'T00:00:00Z').toLocaleString('en-AU', { month: 'long', timeZone: 'UTC' });
    const reg = regs.find(r => r.toLowerCase().includes(mon.toLowerCase()));
    if (reg && /online/i.test(reg)) { skipped.push({ reason: 'online (live webinar) session', line: l }); continue; }
    if (!physical) { skipped.push({ reason: 'no physical venue', line: l }); continue; }
    sessions.push(base(o, {
      id: slug(o.courseId, o.variant === 'full' ? '' : o.variant, 'wa', 'northbridge', start), courseId: o.courseId, variant: o.variant || 'full',
      provider: 'Sexual Health Quarters (SHQ, Family Planning WA)', city: 'Perth (Northbridge)', region: 'WA', country: 'AU', venue: physical,
      start, end, endInferred: false, priceFrom: null, currency: null, seatsStatus: null, bookingUrl: o.url, sourceUrl: o.url,
      datesQuote: q(`${o.title} | Dates Offered | ${l}${reg ? ' | ' + reg : ''}`), sourceKind: 'SHQ own course page',
      ...(o.sessionNote ? { sessionNote: o.sessionNote } : {})
    }));
  }
  return { sessions, skipped };
}

/* ---------- SHINE SA activity pages: "Title / Date: / Time: / Location: / Status:" blocks ---------- */
function parseShine(html, o) {
  const L = lines(html), sessions = [], skipped = [];
  const ci = L.indexOf('Course Dates');
  if (ci < 0) return { sessions, skipped: [{ reason: 'no Course Dates', url: o.url }] };
  for (let i = ci + 1; i < L.length && !/^For enquiries/.test(L[i]); i++) {
    if (!/^Date( start)?: /.test(L[i])) continue;
    const title = decodeEnt(L[i - 1]);
    const ds = parseDate(L[i].replace(/^Date( start)?: /, ''));
    let j = i + 1, de = ds;
    if (/^Date end: /.test(L[j])) { de = parseDate(L[j].replace(/^Date end: /, '')); j++; }
    const time = /^Time: /.test(L[j]) ? L[j++] : '';
    const loc = /^Location: /.test(L[j]) ? L[j++].replace(/^Location: /, '') : '';
    while (j < L.length && !/^Status: /.test(L[j]) && j < i + 8) j++;
    const status = (L[j] || '').replace(/^Status: /, '');
    if (!ds || !de) { skipped.push({ reason: 'bad date', title }); continue; }
    if (de < o.today) continue;
    if (/^online/i.test(loc)) { skipped.push({ reason: 'online session', title, ds }); continue; }
    const c = o.classify(title);
    if (!c) { skipped.push({ reason: 'not in scope', title }); continue; }
    sessions.push(base(o, {
      id: slug(c.courseId, c.variant === 'full' ? '' : c.variant, 'sa', 'woodville', ds), courseId: c.courseId, variant: c.variant || 'full',
      provider: 'SHINE SA', city: 'Adelaide (Woodville)', region: 'SA', country: 'AU', venue: loc.replace(/^Face-to-Face Simulation Workshop - /, ''),
      start: ds, end: de, endInferred: false, priceFrom: null, currency: null,
      seatsStatus: /open/i.test(status) ? 'open' : /full|waitlist/i.test(status) ? 'waitlist' : null,
      bookingUrl: o.url, sourceUrl: o.url, datesQuote: q(`${title} | ${L[i]}${de !== ds ? ' | ' + L[i + 1] : ''} | ${time} | Status: ${status}`),
      sourceKind: 'SHINE SA own course page', ...(c.sessionNote ? { sessionNote: c.sessionNote } : {})
    }));
  }
  return { sessions: dedupe(sessions), skipped };
}

/* ---------- Sexual Health Victoria course pages (Arlo WordPress plugin; register.shvic.org.au is robots-disallowed) ---------- */
/* Arlo prints "Mon 2 Aug" without a year: the year is the next one (from today) in which that weekday/date pair occurs. */
function parseShv(html, o) {
  const L = lines(html), sessions = [], skipped = [];
  const ci = L.indexOf('Course Dates');
  for (let i = ci + 1; ci >= 0 && i < L.length && L[i] !== 'Description'; i++) {
    const m = L[i].match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d{1,2}) ([A-Z][a-z]{2})$/);
    if (!m) continue;
    const dur = L[i + 1] || '';
    const dm = dur.match(/^(\d+) days?, /);
    let year = null;
    for (const y of [+o.today.slice(0, 4), +o.today.slice(0, 4) + 1]) {
      const d = iso(y, MON[m[3].toLowerCase()], m[2]);
      if (d >= o.today && ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(d + 'T00:00:00Z').getUTCDay()] === m[1]) { year = y; break; }
    }
    if (!year) { skipped.push({ reason: 'weekday/date does not fit the next 12 months', line: L[i] }); continue; }
    const start = iso(year, MON[m[3].toLowerCase()], m[2]);
    const days = dm ? +dm[1] : 1;
    if (days > 14) { skipped.push({ reason: 'long-running enrolment window, not a session', line: `${L[i]} ${dur}` }); continue; }
    const loc = L.slice(i + 2, i + 12).find(l => /^(Box Hill|Melbourne|Online)$/.test(l));
    if (!loc || loc === 'Online') { skipped.push({ reason: 'online or no location', line: L[i] }); continue; }
    sessions.push(base(o, {
      id: slug(o.courseId, o.variant === 'full' ? '' : o.variant, 'vic', 'box-hill', start), courseId: o.courseId, variant: o.variant || 'full',
      provider: 'Sexual Health Victoria (SHV)', city: 'Melbourne (Box Hill)', region: 'VIC', country: 'AU', venue: o.venue || 'Sexual Health Victoria, Box Hill',
      start, end: days > 1 ? addDays(start, days - 1) : start, endInferred: days > 1,
      endNote: `page prints "${L[i]}" and "${dur.trim()}" with no year: year ${year} is the next year in which ${m[2]} ${m[3]} falls on a ${m[1]}; end = start + ${days - 1} days`,
      priceFrom: o.priceFrom || null, currency: o.priceFrom ? 'AUD' : null, ...(o.priceNote ? { priceNote: o.priceNote } : {}),
      seatsStatus: /Sold out/i.test(L[i - 1]) ? 'full' : null, bookingUrl: o.url, sourceUrl: o.url,
      datesQuote: q(`${o.title} | Course Dates | ${L[i]} | ${dur} | ${loc}`), sourceKind: 'SHV own course page (Arlo plugin)', yearInferred: true
    }));
  }
  return { sessions, skipped };
}

/* ---------- Rural Health West event pages ---------- */
function parseRhw(html, o) {
  const L = lines(html), sessions = [], skipped = [];
  const di = L.indexOf('Event Details');
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1];
  const title = decodeEnt(h1 || '');
  if (di < 0 || !title) return { sessions, skipped: [{ reason: 'no event details', url: o.url }] };
  const start = parseDate(L[di + 1]); const end = L[di + 2] === '-' ? parseDate(L[di + 3]) : start;
  const price = L.slice(di + 1, di + 8).find(l => /^\$/.test(l));
  if (!start || !end) return { sessions, skipped: [{ reason: 'bad date', title }] };
  if (end < o.today) return { sessions, skipped };
  const c = o.classify(title);
  if (!c) return { sessions, skipped: [{ reason: 'not in scope', title }] };
  /* titles are "Name (ABBR) | Town"; one page prints "Name (ABBR) I Town" (capital i for the bar) */
  const city = ((title.split('|')[1] || '').trim()) || ((title.match(/\)\s+I\s+([A-Z][A-Za-z ]+)$/) || [])[1] || '').trim();
  if (!city) return { sessions, skipped: [{ reason: 'no town in title', title }] };
  const nums = price ? (price.match(/\d[\d,]*/g) || []).map(x => +x.replace(/,/g, '')) : [];
  const venueLine = L.find(l => /^(Venue|Location): /i.test(l));
  sessions.push(base(o, {
    id: slug(c.courseId, 'wa', city, start), courseId: c.courseId, variant: c.variant || 'full', provider: 'Rural Health West',
    city, region: 'WA', country: 'AU', venue: venueLine ? venueLine.replace(/^(Venue|Location): /i, '') : null,
    start, end, endInferred: false, priceFrom: nums.length ? Math.min(...nums) : null, currency: nums.length ? 'AUD' : null,
    ...(nums.length ? { priceNote: `price shown on the event page: ${price}` } : {}),
    seatsStatus: L.includes('Expression of Interest') && !L.includes('Register Now') ? null : null,
    bookingUrl: o.url, sourceUrl: o.url, datesQuote: q(`${title} | Event Details | ${L.slice(di + 1, di + 4).join(' ')}${price ? ' | ' + price : ''}`),
    sourceKind: 'Rural Health West own event page', ...(L.includes('Expression of Interest') ? { bookingNote: 'page offers an Expression of Interest form (registration not yet open)' } : {})
  }));
  return { sessions, skipped };
}

/* ---------- ASHM training listing cards: "Title / In Person / N CPD Hours / dd-dd Mon, time / City, ST" ---------- */
function parseAshmListing(html, o) {
  const L = lines(html), sessions = [], skipped = [];
  for (let i = 0; i < L.length; i++) {
    if (L[i] !== 'In Person' && L[i] !== 'Hybrid') continue;
    const title = decodeEnt(L[i - 1]);
    let j = i + 1; const cpd = /CPD Hours?$/.test(L[j]) ? L[j++] : null;
    const when = L[j], where = L[j + 1] || '';
    const m = when.match(/^(\d{1,2})(?:-(\d{1,2}))? ([A-Z][a-z]{2})(?: (\d{4}))?,/);
    const w = where.match(/^(.+), (ACT|NSW|NT|QLD|SA|TAS|VIC|WA)$/);
    if (!m || !w) { skipped.push({ reason: 'unparsed card', title, when, where }); continue; }
    const c = o.classify(title);
    if (!c) { skipped.push({ reason: 'not in scope', title }); continue; }
    /* the card prints no year: take the next occurrence on/after today (cards list upcoming events only) */
    let y = m[4] ? +m[4] : +o.today.slice(0, 4);
    let start = iso(y, MON[m[3].toLowerCase()], m[1]);
    if (!m[4] && start < o.today) { y++; start = iso(y, MON[m[3].toLowerCase()], m[1]); }
    const end = m[2] ? iso(y, MON[m[3].toLowerCase()], m[2]) : start;
    sessions.push(base(o, {
      id: slug(c.courseId, w[2], w[1], start), courseId: c.courseId, variant: c.variant || 'full', provider: 'ASHM Health',
      city: w[1], region: w[2], country: 'AU', venue: null, start, end, endInferred: false, priceFrom: null, currency: null, seatsStatus: null,
      bookingUrl: c.page || o.url, sourceUrl: o.url, coursePage: c.page,
      datesQuote: q(`${title} | ${L[i]} | ${cpd ? cpd + ' | ' : ''}${when} | ${where}`), sourceKind: 'ASHM own training listing', yearInferred: !m[4],
      ...(!m[4] ? { endNote: `listing prints "${when}" without a year; ${y} is the next such date on/after ${o.today}` } : {})
    }));
  }
  return { sessions, skipped };
}

/* ---------- SAPMEA (SA GP education) event pages: "Title / Monday, November 23 / 6:30pm-9:30pm ... Location / address" ---------- */
/* No year is printed: the year is the first one (today .. +13 months) where that date falls on the printed weekday.
   If the URL carries a ddmmyy stamp that disagrees, the row is skipped (ambiguous). */
function parseSapmea(html, o) {
  const L = lines(html), sessions = [], skipped = [];
  const di = L.findIndex(l => /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), [A-Z][a-z]+ \d{1,2}$/.test(l));
  if (di < 1) return { sessions, skipped: [{ reason: 'no date line', url: o.url }] };
  const title = decodeEnt(L[di - 1]), time = L[di + 1];
  const [, wd, mon, d] = L[di].match(/^(\w+), ([A-Z][a-z]+) (\d{1,2})$/);
  const mi = MON[mon.slice(0, 3).toLowerCase()];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const limit = addDays(o.today, 400);
  const fits = [0, 1].map(k => +o.today.slice(0, 4) + k).map(y => iso(y, mi, d)).filter(x => x >= o.today && x <= limit && DAYS[new Date(x + 'T00:00:00Z').getUTCDay()] === wd);
  if (fits.length !== 1) return { sessions, skipped: [{ reason: 'year not determinable from weekday', title, line: L[di] }] };
  const start = fits[0];
  const stamp = (o.url.match(/-(\d{2})(\d{2})(\d{2})$/) || []);
  if (stamp.length && `20${stamp[3]}-${stamp[2]}-${stamp[1]}` !== start) return { sessions, skipped: [{ reason: `URL stamp ${stamp[0]} disagrees with weekday-derived ${start}`, title }] };
  const li = L.lastIndexOf('Location');
  const loc = li > 0 ? L[li + 1] : '';
  if (!loc || /online|zoom|webinar/i.test(loc + ' ' + title)) return { sessions, skipped: [{ reason: 'online', title }] };
  const c = o.classify(title);
  if (!c) return { sessions, skipped: [{ reason: 'not in scope', title }] };
  const city = c.city || (title.split(/\s[-–]\s/).pop() || '').trim();
  sessions.push(base(o, {
    id: slug(c.courseId, 'sa', city, start), courseId: c.courseId, variant: 'full', provider: 'SAPMEA (South Australian Postgraduate Medical Education Association)',
    city, region: 'SA', country: 'AU', venue: loc, start, end: start, endInferred: false, priceFrom: null, currency: null, seatsStatus: null,
    bookingUrl: o.url, sourceUrl: o.url, datesQuote: q(`${title} | ${L[di]} | ${time} | Location ${loc}`), sourceKind: 'SAPMEA own event page', yearInferred: true,
    yearNote: `page prints "${L[di]}" without a year; ${start.slice(0, 4)} is the only year within 13 months where that date is a ${wd}`
  }));
  return { sessions, skipped };
}

module.exports = { parseSapmea, parseTribe, parseScca, parseHealthcertCalendar, parseHealthed, parseAiu, parseShq, parseShine, parseShv, parseRhw, parseAshmListing, lines, HC_COURSES };
