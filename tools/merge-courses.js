#!/usr/bin/env node
'use strict';
/* x10: fold the per-source course files into the served data.
     data/courses/sources/<name>.catalogue.json   course types that source adds (facts quoted from provider pages)
     data/courses/sources/<name>.sessions.json    { sessions: [...], updates?: [...] } as the source's run wrote it
   into data/courses/catalogue.json and data/courses/sessions.json. The sources/ files stay as the per-source record (what each
   source said on its last run); the main files are what /api/courses serves.

   Idempotent: every row it adds is tagged fromSource: <name>, and every run first takes out all tagged rows (and undoes the
   updates it applied), then adds them again from the files. Untagged rows are the "core" set kept fresh by
   tools/refresh-courses.js (APLS Arlo, ARC, ACRRM, NZDA).
   Rules:
   - catalogue: a source may not reuse an id the core catalogue or an earlier source holds (refused, logged);
   - sessions: refused when they fail tools/check-courses.js's row check, name an unknown course, have finished, repeat an id,
     or repeat a held session (same course + variant + provider + start + city);
   - a source may add sessions to its own course types and to core ones, but not to a type another source owns: by default
     womens-gp's ACRRM rows (built only with --with-acrrm) stay out because resus owns those ids. --allow-shared lets them in;
   - updates[] (resus: ARC sessions it also read on the centre's own Arlo platform) set priceFrom/currency/priceNote, seats,
     placesRemaining and providerBookingUrl on the held row, with the evidence in providerEvidence; the row's own date
     evidence (ARC page, quote) is kept;
   - data/courses/fixes.json: expert-review corrections (names, notes, commercial labels, relevance, AIU length variants
     folded into one row, "Closed" in AIU's own date quote = seatsStatus closed), re-applied every run.
   The result must pass the full check, or nothing is written.
   Usage: node tools/merge-courses.js [--dry] [--today YYYY-MM-DD] [--dir DATA_DIR] [--only a,b] [--allow-shared] [--quiet]
     --only a,b  re-merge only these sources (other sources' tagged rows are kept as they are)
   Exit: 0 ok, 1 the merged data fails tools/check-courses.js (nothing written). */
const fs = require('node:fs'), path = require('node:path');
const C = require('./check-courses');

const ORDER = ['conf-courses', 'resus', 'womens-gp', 'intl']; /* earlier sources own a shared id; others follow alphabetically */
const UPDATE_FIELDS = ['priceFrom', 'currency', 'priceNote', 'seatsStatus', 'placesRemaining', 'providerBookingUrl'];
const COURSE_SET_OK = new Set(['name', 'userNote', 'providerType', 'relevance', 'certifyingBody']);
const SESSION_SET_OK = new Set(['providerType']);
const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const natKey = s => [s.courseId, s.variant || 'full', norm(s.provider), s.start, norm(s.city)].join('|');
const LENGTH_VARIANT = /^(\d+(?:\.\d+)?)-days?$/;

function readSources(dir, only) {
  const sdir = path.join(dir, 'sources'), out = [];
  if (!fs.existsSync(sdir)) return out;
  const names = [...new Set(fs.readdirSync(sdir).map(f => (f.match(/^(.+)\.(catalogue|sessions)\.json$/) || [])[1]).filter(Boolean))];
  names.sort((a, b) => ((ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99)) || a.localeCompare(b));
  for (const name of names) {
    if (only && !only.has(name)) continue;
    const rd = k => { const f = path.join(sdir, `${name}.${k}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
    const cat = rd('catalogue'), ses = rd('sessions');
    out.push({ name, courses: (cat && cat.courses) || [], sessions: (ses && ses.sessions) || [], updates: (ses && ses.updates) || [], generated: (ses && ses.generated) || (cat && cat.generated) || null });
  }
  return out;
}

/* AIU sells one course start in several lengths (3, 4, 5 or 5.5 days), one product each: show one row with the options */
function collapseLengthVariants(rows) {
  const groups = new Map(), rest = [];
  for (const s of rows) {
    const m = LENGTH_VARIANT.exec(s.variant || ''); if (!m) { rest.push(s); continue; }
    const k = [s.courseId, norm(s.provider), s.start, norm(s.city)].join('|');
    (groups.get(k) || groups.set(k, []).get(k)).push({ s, days: +m[1] });
  }
  let folded = 0;
  for (const g of groups.values()) {
    if (g.length === 1) { rest.push(g[0].s); continue; }
    g.sort((a, b) => a.days - b.days); folded += g.length - 1;
    const first = g[0].s, prices = g.map(x => x.s.priceFrom).filter(p => typeof p === 'number');
    const open = g.filter(x => x.s.seatsStatus !== 'closed');
    rest.push({
      ...first, id: first.id.replace(/-\d+(?:-\d+)?-days?(?=-\d{4}-\d{2}-\d{2})/, ''), variant: 'length-options',
      priceFrom: prices.length ? Math.min(...prices) : null, seatsStatus: open.length ? (open.some(x => x.s.seatsStatus === 'open') ? 'open' : open[0].s.seatsStatus) : 'closed',
      priceNote: 'lowest price of the length options; each length is priced on its own course page',
      durationOptions: g.map(({ s, days }) => ({ variant: s.variant, days, end: s.end, priceFrom: s.priceFrom, currency: s.currency, seatsStatus: s.seatsStatus, bookingUrl: s.bookingUrl, sourceUrl: s.sourceUrl, datesQuote: s.datesQuote, sourceRef: s.sourceRef || null }))
    });
  }
  return { rows: rest, folded };
}

function applyFixes(catalogue, sessions, fixes, log) {
  const st = { courses: 0, sessions: 0, folded: 0, closed: 0 };
  if (!fixes) return st;
  const byId = new Map(catalogue.map(c => [c.id, c]));
  const setCourse = (c, set) => { for (const [k, v] of Object.entries(set)) { if (!COURSE_SET_OK.has(k)) throw new Error(`fixes.json: cannot set ${k} on a course`); c[k] = v; } st.courses++; };
  for (const r of fixes.catalogueRules || []) for (const c of catalogue) if ((r.idPrefix && c.id.startsWith(r.idPrefix)) || (r.ids || []).includes(c.id)) setCourse(c, r.set);
  for (const f of fixes.catalogue || []) { const c = byId.get(f.id); if (!c) { log(`fixes.json: course ${f.id} not in the catalogue (skipped)`); continue; } setCourse(c, f.set || {}); }
  let rows = sessions;
  for (const r of fixes.sessionRules || []) {
    const re = new RegExp(r.provider, 'i'), mine = [], other = [];
    for (const s of rows) (re.test(s.provider || '') ? mine : other).push(s);
    for (const s of mine) {
      for (const [k, v] of Object.entries(r.set || {})) { if (!SESSION_SET_OK.has(k)) throw new Error(`fixes.json: cannot set ${k} on a session`); s[k] = v; }
      if (r.closedFromQuote && s.seatsStatus == null && /\bClosed\b/.test(s.datesQuote || '')) { s.seatsStatus = 'closed'; st.closed++; }
      st.sessions++;
    }
    let keep = mine;
    if (r.collapseLengthVariants) { const c = collapseLengthVariants(mine); keep = c.rows; st.folded += c.folded; }
    rows = other.concat(keep);
  }
  sessions.length = 0; sessions.push(...rows);
  return st;
}

/* -> { catalogue, sessions, report } ; catalogue/sessions are the main files' objects ({ courses } / { sessions }) */
function mergeSources({ catalogue, sessions, sources, today, allowShared = false, only = null, fixes = null, log = () => {} }) {
  const strip = x => !x.fromSource || (only && !only.has(x.fromSource));
  /* undo updates applied by an earlier run (only for the sources being merged again) */
  const base = (sessions.sessions || []).filter(strip).map(s => {
    if (!s.appliedUpdate || !strip({ fromSource: s.appliedUpdate.source })) return s;
    const r = { ...s, ...s.appliedUpdate.prior }; for (const k of Object.keys(r)) if (r[k] === undefined) delete r[k];
    delete r.appliedUpdate; delete r.providerEvidence; return r;
  });
  const courses = (catalogue.courses || []).filter(strip).map(c => ({ ...c }));
  const owner = new Map(courses.map(c => [c.id, c.fromSource || 'core']));
  const report = { sources: [], refusedCourses: [], refused: [], updates: { applied: 0, notFound: [], refused: [] } };
  const today_ = today;

  for (const src of sources) {
    const r = { name: src.name, generated: src.generated, courses: 0, sessions: 0, finished: 0, duplicates: 0, shared: 0, refused: 0, updates: 0 };
    for (const c of src.courses) {
      if (owner.has(c.id)) { report.refusedCourses.push(`${src.name}: ${c.id} (held by ${owner.get(c.id)})`); continue; }
      const errs = C.courseProblems(c, { today: today_ }).filter(p => p.level === 'error');
      if (errs.length) { report.refusedCourses.push(`${src.name}: ${c.id}: ${errs.map(e => e.msg).join('; ')}`); continue; }
      courses.push({ ...c, fromSource: src.name }); owner.set(c.id, src.name); r.courses++;
    }
    report.sources.push(r);
  }
  const courseIds = new Set(courses.map(c => c.id));
  const ids = new Set(base.map(s => s.id)), keys = new Set(base.map(natKey)), fullKeys = new Set(base.map(C.sessionKey));
  const added = [];
  for (const src of sources) {
    const r = report.sources.find(x => x.name === src.name);
    for (const s of src.sessions) {
      const o = owner.get(s.courseId);
      if (o && o !== 'core' && o !== src.name && !allowShared) { r.shared++; continue; }
      if (s.end < today_) { r.finished++; continue; }
      const errs = C.sessionProblems(s, { today: today_, courseIds }).filter(p => p.level === 'error');
      if (errs.length) { r.refused++; report.refused.push(`${src.name}: ${s.id}: ${errs.map(e => e.msg).join('; ')}`); continue; }
      if (ids.has(s.id) || keys.has(natKey(s)) || fullKeys.has(C.sessionKey(s))) { r.duplicates++; continue; }
      ids.add(s.id); keys.add(natKey(s)); fullKeys.add(C.sessionKey(s));
      added.push({ ...s, fromSource: src.name }); r.sessions++;
    }
    /* updates for held rows: price, seats and the provider's own booking link, with the evidence */
    const byId = new Map(base.map(s => [s.id, s]));
    for (const u of src.updates) {
      const h = byId.get(u.id); if (!h) { report.updates.notFound.push(`${src.name}: ${u.id}`); continue; }
      const prior = {}, next = { ...h };
      for (const k of UPDATE_FIELDS) if (u[k] != null) { prior[k] = h[k] === undefined ? null : h[k]; next[k] = u[k]; }
      if (!Object.keys(prior).length) continue;
      next.providerEvidence = { sourceUrl: u.sourceUrl, datesQuote: u.datesQuote, sourceRef: u.sourceRef || null, lastVerified: u.lastVerified, sourceKind: u.sourceKind || null };
      next.appliedUpdate = { source: src.name, prior };
      const errs = C.sessionProblems(next, { today: today_, courseIds }).filter(p => p.level === 'error');
      if (!C.isHttps(u.sourceUrl) || !u.datesQuote || !C.isDate(u.lastVerified)) errs.push({ msg: 'update without evidence (https sourceUrl, datesQuote, lastVerified)' });
      if (errs.length) { report.updates.refused.push(`${src.name}: ${u.id}: ${errs.map(e => e.msg).join('; ')}`); continue; }
      Object.assign(h, next); r.updates++; report.updates.applied++;
    }
  }
  const all = base.concat(added);
  report.fixes = applyFixes(courses, all, fixes, log);
  all.sort((a, b) => (a.start + a.courseId + a.region + a.city + a.id).localeCompare(b.start + b.courseId + b.region + b.city + b.id));
  return {
    catalogue: { ...catalogue, generated: today_, courses },
    sessions: { ...sessions, generated: today_, sessions: all },
    report
  };
}

function summaryLine(rep) {
  return rep.sources.map(r => `${r.name}: +${r.courses} types, +${r.sessions} sessions${r.updates ? `, ${r.updates} updates` : ''}${r.duplicates ? `, ${r.duplicates} duplicates` : ''}${r.shared ? `, ${r.shared} on another source's course` : ''}${r.refused ? `, ${r.refused} refused` : ''}${r.finished ? `, ${r.finished} finished` : ''}`).join('; ')
    + `; fixes: ${rep.fixes.courses} course patches, ${rep.fixes.folded} length variants folded, ${rep.fixes.closed} marked closed`;
}

module.exports = { mergeSources, readSources, collapseLengthVariants, applyFixes, summaryLine, natKey };

if (require.main === module) {
  const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const dir = path.resolve(opt('--dir') || path.join(__dirname, '..', 'data', 'courses'));
  const today = opt('--today') || new Date().toISOString().slice(0, 10), quiet = argv.includes('--quiet');
  const only = opt('--only') ? new Set(opt('--only').split(',')) : null;
  const rd = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const fixes = fs.existsSync(path.join(dir, 'fixes.json')) ? rd('fixes.json') : null;
  const m = mergeSources({ catalogue: rd('catalogue.json'), sessions: rd('sessions.json'), sources: readSources(dir, only), today, only, fixes, allowShared: argv.includes('--allow-shared'), log: x => console.error(x) });
  const chk = C.check({ catalogue: m.catalogue, sessions: m.sessions, today });
  const rep = m.report;
  if (!quiet) {
    for (const x of rep.refusedCourses) console.log('course refused: ' + x);
    for (const x of rep.refused.slice(0, 50)) console.log('session refused: ' + x);
    for (const x of rep.updates.notFound) console.log('update for a row not held: ' + x);
    for (const x of rep.updates.refused) console.log('update refused: ' + x);
  }
  console.log('merge-courses ' + today + ': ' + summaryLine(rep));
  console.log(`result: ${m.catalogue.courses.length} course types, ${m.sessions.sessions.length} sessions; check-courses errors ${chk.errors.length}, warnings ${chk.warnings.length}`);
  if (chk.errors.length) { console.log(chk.errors.slice(0, 30).map(e => 'ERROR ' + e).join('\n')); console.error('merged data fails the check; nothing written'); process.exit(1); }
  if (argv.includes('--dry')) process.exit(0);
  fs.writeFileSync(path.join(dir, 'catalogue.json'), JSON.stringify(m.catalogue, null, 1) + '\n');
  fs.writeFileSync(path.join(dir, 'sessions.json'), JSON.stringify(m.sessions, null, 1) + '\n');
}
