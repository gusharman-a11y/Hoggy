'use strict';
/* Australian Resuscitation Council course-dates page: one static HTML page, an accordion per state
   (<h2 class="e-accordion__title">State</h2>), one <tr> per session listed by an ARC-accredited course centre.
   Row layouts vary (some give Starts/Ends/Location, ~2/3 give only a date). parse(html, { today }) -> { sessions, skipped, rows }. */
const { text, slug, parseDate, addDays, cleanUrl, AU_STATES } = require('./util');

const SOURCE_URL = 'https://www.resus.org.au/training-and-education/advanced-life-support-courses/course-dates';
const SOURCE_KIND = 'ARC course-dates page (lists ARC-accredited course centres)';
const STATE_RE = /(ACT|NSW|NT|QLD|Qld|SA|TAS|Tas|VIC|Vic|WA)/;
const CITY_FIX = { 'Bayberry Lane Robina': 'Robina', 'MT NASURA': 'Mount Nasura' };

/* raw rows: { state, dateCell, title, start, end, location, centre, links, lines } */
function rows(html) {
  const heads = [...html.matchAll(/<h2 class="e-accordion__title">([^<]+)<\/h2>/g)].map(m => [m.index, m[1].trim()]);
  const stateAt = pos => { let s = null; for (const [p, n] of heads) if (p < pos) s = n; return s; };
  const out = [], bad = [];
  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const tds = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => x[1]);
    if (tds.length < 2) continue;
    const dateCell = text(tds[0]).replace(/\n/g, ' ');
    if (/Course Date/i.test(dateCell)) continue;
    const info = text(tds[1]);
    if (!info) continue;
    const lines = info.split('\n');
    const et = tds[1].match(/class="event-title"[^>]*>([\s\S]*?)<\/span>/);
    const title = et ? text(et[1]).replace(/\n/g, ' ') : lines[0];
    const get = re => { const x = info.match(re); return x ? x[1].trim() : null; };
    const sm = get(/Starts?:\s*([^\n]+)/), em = get(/Ends?:\s*([^\n]+)/);
    const start = sm ? parseDate(sm) : parseDate(dateCell);
    const rec = {
      state: stateAt(m.index), dateCell, title, start, end: em ? parseDate(em) : null,
      location: get(/Location:\s*([^\n]+)/), centre: get(/Course Ce[nm]tre:\s*([^\n]+)/),
      links: [...tds.slice(1).join(' ').matchAll(/href="(https?:\/\/[^"]+)"/g)].map(x => x[1]), lines
    };
    (start ? out : bad).push(rec);
  }
  return { ok: out, bad };
}

function cityOf(r) {
  let loc = r.location, city = null;
  if (!loc) { const c = r.lines.slice(1, 4).filter(x => !/^(Course Ce|Contact|Starts|Ends|Date)/.test(x)); loc = c[0] || null; }
  const pick = s => { const m = s.trim().match(new RegExp(`([A-Za-z' .]+?),?\\s+${STATE_RE.source}\\.?,?\\s*(\\d{4})?\\s*$`)); return m ? m[1].split(',').pop().trim().replace(/^\d+[\w/-]*\s+/, '') : null; };
  if (loc) city = pick(loc);
  if (!city) for (const x of r.lines) {
    if (/^(Course|Contact)/.test(x)) continue;
    if (/(VIC|NSW|QLD|SA|TAS|WA|ACT|NT)\s+\d{4}\s*$/.test(x)) { city = pick(x); if (city) { if (loc && !loc.includes(x)) loc = loc + ', ' + x; break; } }
  }
  if (!city) { const m = r.title.match(/-\s*([A-Za-z ]+)$/); city = m ? m[1].trim() : null; if (city && Object.values(AU_STATES).includes(city.toUpperCase())) city = null; }
  return { city: city ? CITY_FIX[city] || city : null, venue: loc };
}

function parse(html, { today, verifiedOn = today } = {}) {
  const { ok, bad } = rows(html), sessions = [], skipped = bad.map(r => ({ reason: 'no start date', title: r.title, dateCell: r.dateCell }));
  const seen = new Set();
  for (const r of ok) {
    if (r.start < today && !(r.end && r.end >= today)) continue; /* finished */
    const t = r.title, region = AU_STATES[String(r.state || '').toLowerCase()];
    const courseId = /Level 1/.test(t) ? 'als1' : /Level 2/.test(t) ? 'als2' : null;
    if (!courseId || !region) { skipped.push({ reason: courseId ? 'no state' : 'not ALS1/ALS2', title: t }); continue; }
    const recert = /Recertif|Refresher/i.test(t);
    let end = r.end, endInferred = false;
    if (!end) {
      endInferred = true;
      const one = /1\s*-?\s*Day/i.test(t) || recert || courseId === 'als1', two = /2\s*-?\s*Day/i.test(t) || (courseId === 'als2' && !recert);
      if (one && !two) end = r.start; else if (two) end = addDays(r.start, 1); else { skipped.push({ reason: 'no end', title: t }); continue; }
    }
    if (end < r.start) { skipped.push({ reason: 'end before start', title: t, start: r.start, end }); continue; }
    if (end < today) continue;
    const { city, venue } = cityOf(r);
    if (!city) { skipped.push({ reason: 'no city', title: t }); continue; }
    const centre = (r.centre || '').trim();
    if (!centre) { skipped.push({ reason: 'no course centre', title: t }); continue; }
    const key = [courseId, recert, centre.toLowerCase(), r.start, end, (venue || '').toLowerCase()].join('|');
    if (seen.has(key)) continue; seen.add(key);
    let q = r.lines.filter(x => /^(Advanced Life|Starts|Ends|Date:)/.test(x)).join(' / ');
    if (!/Starts|Date:/.test(q)) q = r.dateCell + ' / ' + q;
    const link = r.links.map(cleanUrl).find(x => x.url) || null;
    const firstNote = r.links.length ? cleanUrl(r.links[0]).note : undefined;
    sessions.push({
      id: slug(courseId + (recert ? '-recert' : ''), region, city, r.start, centre), courseId, variant: recert ? 'recertification' : 'full',
      provider: centre, city, region, country: 'AU', venue: venue || null, start: r.start, end, endInferred,
      priceFrom: null, currency: null, seatsStatus: null,
      bookingUrl: link ? link.url : SOURCE_URL, sourceUrl: SOURCE_URL, datesQuote: q.slice(0, 300),
      lastVerified: verifiedOn, datesConfirmed: true, sourceKind: SOURCE_KIND,
      ...((link && link.note) || (!link && firstNote) ? { bookingUrlNote: (link && link.note) || firstNote } : {})
    });
  }
  return { sessions, skipped, rows: ok.length + bad.length };
}

module.exports = { parse, rows, SOURCE_URL, SOURCE_KIND };
