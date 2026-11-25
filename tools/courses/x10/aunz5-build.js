'use strict';
/* Data wave 5 (25 Nov 2026): AU/NZ course providers added by hand-checked parsers, one source file pair per provider group:
     data/courses/sources/<group>.catalogue.json   course types (facts quoted from the provider's own pages)
     data/courses/sources/<group>.sessions.json    dated sessions read on the provider's own pages
   Usage: node tools/courses/x10/aunz5-build.js --cache DIR [--today YYYY-MM-DD] [--out DIR] [--only a,b]
   DIR/index.tsv lines: <url>\t<file>\t<final url>, written by a polite fetch (tools/courses/http.js: robots.txt honoured,
   one request at a time, >= 3 s per host, generic User-Agent, bot walls skipped). Nothing is fetched here.
   Every quote is checked against the cached page text; a session whose quote is not on the page is dropped.
   Never invents dates, venues, CPD or fees: an end worked out from a stated course length carries endInferred:true. */
const fs = require('node:fs'), path = require('node:path');
const { text, slug, addDays, decode } = require('../util');

const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const cacheDir = arg('--cache'), today = arg('--today') || new Date().toISOString().slice(0, 10);
const outDir = arg('--out') || path.join(__dirname, '..', '..', '..', 'data', 'courses', 'sources');
const only = arg('--only') ? new Set(arg('--only').split(',')) : null;
if (!cacheDir) { console.error('need --cache DIR'); process.exit(2); }
const idx = new Map();
for (const l of fs.readFileSync(path.join(cacheDir, 'index.tsv'), 'utf8').trim().split('\n')) {
  const [u, f] = l.split('\t'); const file = path.isAbsolute(f) ? f : path.join(cacheDir, f);
  if (fs.existsSync(file)) idx.set(u, file); /* later lines win: the newest read of a URL */
}
const page = u => (idx.has(u) ? fs.readFileSync(idx.get(u), 'utf8') : null);
const norm = s => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
const flat = new Map();
const pageText = u => { if (!flat.has(u)) { const h = page(u); flat.set(u, h ? norm(text(h).split('\n').join(' ')) : ''); } return flat.get(u); };
const lines = u => text(page(u) || '').split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
const warnings = [];
/* a quote made of page pieces joined with " | ": every piece must be on the page */
function onPage(u, quote) {
  const t = pageText(u);
  return String(quote).split(' | ').every(p => t.includes(norm(p)));
}
function ev(u, quote) {
  if (!page(u)) { warnings.push('no cached page ' + u); return null; }
  if (!onPage(u, quote)) { warnings.push(`quote not on page ${u}: ${quote.slice(0, 90)}`); return null; }
  return { sourceUrl: u, quote: quote.slice(0, 200), lastVerified: today };
}
const DAYWORD = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const groups = {};

/* ================= Zedu Ultrasound Training Solutions (Bundoora VIC), WooCommerce product pages ================= */
groups['zedu-ultrasound'] = () => {
  const ZEDU = 'https://www.ultrasoundtraining.com.au/';
  const LOC = 'https://www.ultrasoundtraining.com.au/contact-us/';
  const VENUE = 'Zedu HQ – Suite 37/Level 4, 240 Plenty Road, Bundoora VIC 3083';
  const courses = [], sessions = [];
  const venueOk = !!ev(LOC, VENUE);
  for (const u of [...idx.keys()].filter(u => u.startsWith(ZEDU) && /^https:\/\/www\.ultrasoundtraining\.com\.au\/[a-z0-9-]+\/[a-z0-9-]+\/$/.test(u)).sort()) {
    const h = page(u);
    const title = decode((h.match(/<h1 class="product_title[^"]*">([^<]+)/) || [])[1] || '').trim();
    const sel = h.match(/<select id="pa_[a-z0-9-]*start-date"[\s\S]*?<\/select>/);
    if (!title || !sel) continue;
    if (/\/(podiatry|veterinary)\//.test(u)) continue; /* not for doctors */
    const L = lines(u);
    const optLine = L.find(l => /^Choose an option (\d{2}\/\d{2}\/\d{4} ?)+/.test(l));
    const leadIdx = L.indexOf(optLine) - 1;
    const lead = leadIdx >= 0 && /(course|program) (commencing|beginning) on/i.test(L[leadIdx]) ? L[leadIdx] : null;
    const durM = pageText(u).match(/Duration \(days\) (\d+)/);
    const leadDays = lead && DAYWORD[(lead.match(/^(\w+) day/i) || [])[1]?.toLowerCase()];
    const days = leadDays || (durM ? +durM[1] : null);
    if (!days) { warnings.push('zedu: no course length on ' + u); continue; }
    const after = h.slice(h.indexOf('product_title'));
    const pm = after.match(/class="price">(?:\s|<[^>]+>|&#36;|\$|&nbsp;)*([\d,]+\.\d{2})/);
    const price = pm ? +pm[1].replace(/,/g, '') : null;
    const id = 'zedu-' + slug(title.replace(/\bCourse\b/gi, '').replace(/[–-]\s*$/, ''));
    const dates = [...sel[0].matchAll(/<option value="(\d{2})-(\d{2})-(\d{4})"/g)].map(m => iso(m[3], m[2], m[1]));
    let n = 0;
    for (const start of [...new Set(dates)].sort()) {
      if (start < today) continue;
      const [y, m, d] = start.split('-'), dmy = `${d}/${m}/${y}`;
      const end = addDays(start, days - 1);
      const quote = `${title} | ${lead || 'Duration (days) ' + days} | ${dmy}`;
      if (!onPage(u, quote)) { warnings.push('zedu quote not on page ' + quote); continue; }
      sessions.push({
        id: slug(id, start), courseId: id, variant: 'full', provider: 'Zedu Ultrasound Training Solutions',
        city: 'Bundoora (Melbourne)', region: 'VIC', country: 'AU', venue: venueOk ? VENUE : null,
        venueNote: venueOk ? "the course page gives no venue; Zedu's location page gives its training centre (Zedu HQ, Bundoora)" : undefined,
        start, end, endInferred: days > 1, ...(days > 1 ? { endNote: `start date from the course page's date list; "${lead || 'Duration (days) ' + days}" on the page, consecutive days assumed` } : {}),
        priceFrom: price, currency: price ? 'AUD' : null, ...(price ? { priceNote: 'course price shown on the course page' } : {}), seatsStatus: null,
        bookingUrl: u, sourceUrl: u, datesQuote: quote.slice(0, 200), lastVerified: today, datesConfirmed: true,
        sourceKind: 'Zedu Ultrasound Training Solutions own course page (WooCommerce product, date list)', sourceRef: 'zedu:' + u.split('/').slice(-2, -1)[0] + ':' + start,
        providerType: 'commercial'
      });
      n++;
    }
    if (!n) continue;
    const durQ = durM ? `Duration (days) ${durM[1]}` : lead;
    courses.push({
      id, name: `Zedu ${title}${/course|program/i.test(title) ? '' : ' Course'}`, cpdHours: 0, verified: true, lastVerified: today,
      providers: [{ name: 'Zedu Ultrasound Training Solutions', url: u, verified: true, calendar: 'https://www.ultrasoundtraining.com.au/course-calendar/', bookingPlatform: 'Zedu WooCommerce store (www.ultrasoundtraining.com.au)' }],
      countries: ['AU'], providerType: 'commercial',
      format: `Face-to-face hands-on ultrasound course at Zedu, Bundoora (Melbourne); ${days} day${days > 1 ? 's' : ''}.`,
      formatEvidence: ev(u, durQ), typicalLength: `${days} day${days > 1 ? 's' : ''}`,
      ...(price ? { feeRange: { currency: 'AUD', min: price, max: price, text: `$${price} (course page)` }, feeSource: u } : {}),
      cpdNote: 'check provider (the course page lists college CPD recognition)',
      notes: 'Commercial provider. Dates are the start dates in the course page booking list; the end is worked out from the stated course length.'
    });
  }
  return { courses, sessions, note: 'Zedu Ultrasound Training Solutions (ultrasoundtraining.com.au): course start dates from each course page booking list, read 25 Nov 2026.' };
};

/* ---------- run ---------- */
const extra = (() => { try { return require('./aunz5-groups'); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; return {}; } })();
Object.assign(groups, typeof extra === 'function' ? extra({ idx, page, pageText, lines, ev, onPage, warnings, today, slug, addDays, decode, text, iso }) : extra);
const summary = [];
for (const [name, fn] of Object.entries(groups)) {
  if (only && !only.has(name)) continue;
  const r = fn();
  if (!r || !r.sessions.length) { summary.push(`${name}: 0 sessions (not written)`); continue; }
  const ids = new Set(); r.sessions = r.sessions.filter(s => { if (ids.has(s.id)) { warnings.push('duplicate id ' + s.id); return false; } ids.add(s.id); return true; });
  const used = new Set(r.sessions.map(s => s.courseId)); r.courses = r.courses.filter(c => used.has(c.id) || c.keep);
  for (const s of r.sessions) for (const k of Object.keys(s)) if (s[k] === undefined) delete s[k];
  fs.writeFileSync(path.join(outDir, `${name}.catalogue.json`), JSON.stringify({ generated: today, note: r.note, courses: r.courses }, null, 1) + '\n');
  fs.writeFileSync(path.join(outDir, `${name}.sessions.json`), JSON.stringify({ generated: today, note: r.note, sessions: r.sessions }, null, 1) + '\n');
  summary.push(`${name}: ${r.courses.length} course types, ${r.sessions.length} sessions`);
}
for (const w of warnings) console.error('warn ' + w);
console.log(summary.join('\n'));
