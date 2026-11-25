'use strict';
/* Data wave 6 (25 Nov 2026): more AU/NZ course providers, same rules and cache format as aunz5-build.js (wave 5); the groups
   live in aunz6-groups.js. One source file pair per provider group:
     data/courses/sources/<group>.catalogue.json   course types (facts quoted from the provider's own pages)
     data/courses/sources/<group>.sessions.json    dated sessions read on the provider's own pages
   Usage: node tools/courses/x10/aunz6-build.js --cache DIR [--today YYYY-MM-DD] [--out DIR] [--only a,b]
   DIR/index.tsv lines: <url>\t<file>\t<final url>, written by tools/courses/x10/cache-fetch.js (tools/courses/http.js: robots.txt honoured,
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

/* ---------- run ---------- */
const extra = (() => { try { return require('./aunz6-groups'); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; return {}; } })();
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
