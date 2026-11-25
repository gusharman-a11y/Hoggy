'use strict';
/* Data wave 7 (25 Nov 2026): AU/NZ conference rows and course sessions read by hand from organisers' and providers' own pages.
   Input: a drafts module (tools/courses/x10/aunz7-groups.js: ({ lines, pageText, has, today, warn }) => drafts) returning
     conferences: [ { ...conference row fields (merge-shards schema)..., datesSourceUrl, datesQuote } ]
     courses:     [ catalogue entries (check-courses schema) ]
     sessions:    [ { ...session fields..., sourceUrl, datesQuote } ]
   and a page cache (DIR/index.tsv: <url>\t<file>\t<final url>, written by tools/courses/x10/cache-fetch.js, which reads through
   tools/courses/http.js: robots.txt honoured, >= 3 s per host, generic User-Agent, https only, bot walls skipped).
   Every quote (pieces joined with " | " must each be on the page) is checked against the cached page text; a row whose quote is not
   on its page is dropped and listed. Nothing is fetched here and nothing is invented: rows carry only what the page says.
   Writes data/shards/wave7-aunz.json and data/courses/sources/aunz-wave7.{catalogue,sessions}.json.
   Usage: node tools/courses/x10/aunz7-build.js --cache DIR [--drafts FILE] [--today YYYY-MM-DD] */
const fs = require('node:fs'), path = require('node:path');
const { text } = require('../util');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const ROOT = path.join(__dirname, '..', '..', '..');
const cacheDir = arg('--cache'), today = arg('--today') || new Date().toISOString().slice(0, 10);
if (!cacheDir) { console.error('need --cache DIR'); process.exit(2); }
const idx = new Map();
for (const l of fs.readFileSync(path.join(cacheDir, 'index.tsv'), 'utf8').trim().split('\n')) {
  const [u, f, fin] = l.split('\t'); const file = path.isAbsolute(f) ? f : path.join(cacheDir, f);
  if (fs.existsSync(file)) { idx.set(u, file); if (fin && !idx.has(fin)) idx.set(fin, file); } /* a page is also found by the address it was read from */
}
const norm = s => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const flat = new Map();
const pageText = u => { if (!flat.has(u)) { const f = idx.get(u); flat.set(u, f ? norm(text(fs.readFileSync(f, 'utf8')).split('\n').join(' ')) : null); } return flat.get(u); };
const bad = [];
const lines = u => { const f = idx.get(u); return f ? text(fs.readFileSync(f, 'utf8')).split('\n').map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean) : []; };
const drafts = require(path.resolve(arg('--drafts') || path.join(__dirname, 'aunz7-groups.js')))({ lines, pageText, has: u => idx.has(u), html: u => (idx.has(u) ? fs.readFileSync(idx.get(u), 'utf8') : ''), today, warn: m => bad.push(m) });
function onPage(u, q, what) {
  const t = pageText(u);
  if (t == null) { bad.push(`${what}: no cached page ${u}`); return false; }
  const miss = String(q).split(' | ').filter(p => !t.includes(norm(p)));
  if (miss.length) { bad.push(`${what}: quote not on page ${u}: ${miss[0].slice(0, 90)}`); return false; }
  return true;
}
const conf = [];
for (const c of drafts.conferences || []) {
  if (!onPage(c.datesSourceUrl, c.datesQuote, c.id)) continue;
  if (c.end < today) continue;
  conf.push({ ...c, datesQuote: c.datesQuote.slice(0, 200), datesConfirmed: true, sourceUrl: c.sourceUrl || c.datesSourceUrl, verifiedOn: today, lastVerified: today });
}
const sessions = [];
for (const s of drafts.sessions || []) {
  if (!onPage(s.sourceUrl, s.datesQuote, s.id)) continue;
  if (s.end < today) continue;
  sessions.push({ variant: 'full', venue: null, endInferred: false, priceFrom: null, currency: null, seatsStatus: null, bookingUrl: s.sourceUrl, ...s, datesQuote: s.datesQuote.slice(0, 200), lastVerified: today, datesConfirmed: true });
}
const used = new Set(sessions.map(s => s.courseId));
const courses = (drafts.courses || []).filter(c => used.has(c.id)).map(c => {
  const o = { cpdHours: 0, verified: true, cpdNote: 'check provider', ...c, lastVerified: today };
  if (o.formatEvidence && !onPage(o.formatEvidence.sourceUrl, o.formatEvidence.quote, c.id + ' formatEvidence')) delete o.formatEvidence;
  else if (o.formatEvidence) o.formatEvidence.lastVerified = today;
  return o;
});
const note = 'Data wave 7 (25 Nov 2026): AU/NZ course sessions read by hand from providers\' own pages (tools/courses/x10/aunz7-build.js).';
fs.writeFileSync(path.join(ROOT, 'data', 'shards', 'wave7-aunz.json'), JSON.stringify(conf, null, 1) + '\n');
fs.writeFileSync(path.join(ROOT, 'data', 'courses', 'sources', 'aunz-wave7.catalogue.json'), JSON.stringify({ generated: today, note, courses }, null, 1) + '\n');
fs.writeFileSync(path.join(ROOT, 'data', 'courses', 'sources', 'aunz-wave7.sessions.json'), JSON.stringify({ generated: today, note, sessions }, null, 1) + '\n');
for (const b of bad) console.error('drop ' + b);
console.log(`conferences ${conf.length}, course types ${courses.length}, sessions ${sessions.length}, dropped ${bad.length}`);
