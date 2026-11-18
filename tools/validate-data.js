#!/usr/bin/env node
'use strict';
/* B30: validate data/conferences.js and data/shards/*.json. Fast (no network); run by `npm test` and CI.
   Usage: node tools/validate-data.js [--root DIR] [--today YYYY-MM-DD] [--json] [--show N]
   Errors (exit 1): anything wrong in what the app serves (data/conferences.js), unreadable shards, and evidence entries in
   provenance shards that break the rule (what tools/verify-dates.js writes must pass). Warnings (exit 0): allowed but worth
   fixing, including shard rows the merge step will reject, fix or downgrade on its own.
   Rules: required fields, ISO dates, end >= start, https URLs, canonical specialty (tools/specialties.js), real ISO country
   codes with one spelling per country, lat/lng in range, unique ids, no two rows with the same series key (lib/series.js)
   and start, the evidence rule (tools/evidence.js), and the copy lint word list (tools/copy-lint.js). */
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { CANON } = require('./specialties');
const { lint } = require('./copy-lint');
const { seriesKey } = require('../lib/series.js');
const E = require('./evidence');

const REQ = ['id', 'name', 'organiser', 'specialty', 'city', 'country', 'countryCode', 'region', 'start', 'end', 'format', 'cpdHours', 'url', 'blurb'];
const REGIONS = new Set(['Europe', 'North America', 'Asia-Pacific', 'Middle East', 'Africa', 'Latin America']);
const FORMATS = new Set(['In-person', 'Hybrid']);
const REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });
const realCountry = cc => /^[A-Z]{2}$/.test(cc || '') && cc !== 'ZZ' && REGION_NAMES.of(cc) !== cc;
const isHttps = u => { try { return new URL(u).protocol === 'https:'; } catch (e) { return false; } };
/* string fields that are not copy: links, and the organiser's own wording quoted verbatim with its source */
const NOT_COPY = k => /url$/i.test(k) || k === 'datesQuote';

function loadConferences(file) {
  const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx, { timeout: 5000 });
  const rows = ctx.window.HOGGY_CONFERENCES;
  if (!Array.isArray(rows)) throw new Error('window.HOGGY_CONFERENCES is not an array');
  return rows;
}

/* problems with one conference row: [{ level: 'error'|'warn', msg }] */
function rowProblems(c, today) {
  const P = [], err = m => P.push({ level: 'error', msg: m }), warn = m => P.push({ level: 'warn', msg: m });
  for (const k of REQ) if (c[k] == null || c[k] === '') err('missing ' + k);
  if (c.id != null && !/^[a-z0-9-]{3,80}$/.test(c.id)) err('bad id');
  if (!E.isIso(c.start)) err('start is not an ISO date'); if (!E.isIso(c.end)) err('end is not an ISO date');
  if (E.isIso(c.start) && E.isIso(c.end) && c.end < c.start) err('end before start');
  if (E.isIso(c.start) && E.isIso(c.end) && (Date.parse(c.end) - Date.parse(c.start)) / 864e5 > 31) warn('runs longer than 31 days');
  for (const k of ['url', 'sourceUrl', 'datesSourceUrl', 'organiserUrl', 'societyUrl', 'cpdSourceUrl']) if (c[k] != null && c[k] !== '' && !isHttps(c[k])) err(k + ' is not https');
  if (c.specialty && !CANON.has(c.specialty)) err(`specialty "${c.specialty}" is not canonical (tools/specialties.json)`);
  if (c.countryCode && !realCountry(c.countryCode)) err(`countryCode ${c.countryCode} is not an ISO 3166 code`);
  if (c.region && !REGIONS.has(c.region)) err('bad region ' + c.region);
  if (c.format && !FORMATS.has(c.format)) err('bad format ' + c.format);
  if (c.cpdHours != null && (typeof c.cpdHours !== 'number' || c.cpdHours < 0 || c.cpdHours > 100)) err('bad cpdHours');
  if (c.lat != null && (typeof c.lat !== 'number' || c.lat < -90 || c.lat > 90)) err('bad lat');
  if (c.lng != null && (typeof c.lng !== 'number' || c.lng < -180 || c.lng > 180)) err('bad lng');
  if (!c.lat && !c.lng) warn('no map pin (lat/lng 0)');
  /* x10 expert review: figures shown to users need a source (the app hides them otherwise) */
  if (c.attendees > 0 && !c.attendeesSourceUrl) warn('unsourced figure: attendees (hidden in the app)');
  if (c.priceFrom > 0 && !c.priceSourceUrl) warn('unsourced figure: priceFrom (hidden in the app)');
  if (c.cpdBody && !c.cpdVerified) warn('unsourced figure: cpdBody without cpdVerified (hidden in the app)');
  if (c.datesConfirmed !== true && c.datesConfirmed !== false) err('datesConfirmed must be true or false');
  if (c.dateStatus && c.dateStatus !== (c.datesConfirmed === false ? 'estimated' : 'confirmed')) err('dateStatus disagrees with datesConfirmed');
  /* evidence rule */
  if (c.datesConfirmed === true) {
    const why = E.evidenceProblem(c, { today });
    if (why && !(c.legacyConfirmed && !E.hasAnyEvidence(c))) err('confirmed without valid evidence: ' + why);
    if (!why && !E.quoteNamesMonthOrYear(c)) warn('datesQuote names neither the year nor the month');
    if (c.estimateReason) err('estimateReason on a confirmed row');
  } else {
    if (c.legacyConfirmed) err('legacyConfirmed on an estimated row');
    if (c.verifiedOn && c.lastVerified) warn('estimated row still carries lastVerified');
  }
  for (const [k, v] of Object.entries(c)) if (typeof v === 'string' && !NOT_COPY(k)) for (const h of lint(v)) err(`copy lint: "${h.word}" in ${k}`);
  return P;
}

function validate({ root = path.join(__dirname, '..'), today = new Date().toISOString().slice(0, 10) } = {}) {
  const errors = [], warnings = [], E_ = (where, msg) => errors.push(where + ': ' + msg), W = (where, msg) => warnings.push(where + ': ' + msg);
  const mainFile = path.join(root, 'data', 'conferences.js');
  let rows = [];
  try { rows = loadConferences(mainFile); } catch (e) { E_('data/conferences.js', 'unreadable: ' + e.message); }
  const ids = new Map(), series = new Map(), seriesYear = new Map(), nameOf = new Map(), codeOf = new Map();
  for (const c of rows) {
    const where = 'conferences.js ' + (c.id || c.name || '?');
    for (const p of rowProblems(c, today)) (p.level === 'error' ? E_ : W)(where, p.msg);
    if (ids.has(c.id)) E_(where, 'duplicate id'); ids.set(c.id, c);
    const sk = seriesKey(c);
    if (series.has(sk + '|' + c.start)) E_(where, `same series and start as ${series.get(sk + '|' + c.start)} (${sk})`); else series.set(sk + '|' + c.start, c.id);
    const sy = sk + '|' + String(c.start).slice(0, 4);
    if (seriesYear.has(sy)) W(where, `possible duplicate edition of ${seriesYear.get(sy)} (same series and year, different start)`); else seriesYear.set(sy, c.id);
    if (c.countryCode && c.country) {
      if (!nameOf.has(c.countryCode)) nameOf.set(c.countryCode, new Map()); const m = nameOf.get(c.countryCode); m.set(c.country, (m.get(c.country) || 0) + 1);
      if (!codeOf.has(c.country)) codeOf.set(c.country, new Map()); const n = codeOf.get(c.country); n.set(c.countryCode, (n.get(c.countryCode) || 0) + 1);
    }
  }
  /* one spelling per country, one code per spelling */
  for (const [cc, m] of nameOf) if (m.size > 1) E_('conferences.js', `countryCode ${cc} has ${m.size} country names: ${[...m].map(([k, v]) => `${k} (${v})`).join(', ')}`);
  for (const [name, m] of codeOf) if (m.size > 1) E_('conferences.js', `country ${name} has ${m.size} codes: ${[...m].map(([k, v]) => `${k} (${v})`).join(', ')}`);

  /* shards */
  const shardDir = path.join(root, 'data', 'shards'), files = fs.existsSync(shardDir) ? fs.readdirSync(shardDir).filter(f => f.endsWith('.json')).sort() : [];
  const shardStats = { files: files.length, rows: 0, merged: 0, pending: 0, evidenceEntries: 0 };
  /* fix-*.json: corrections tools/merge-shards.js applies on every merge (removals, specialty, stripped figures) */
  const removedByFix = new Set();
  for (const f of files.filter(x => x.startsWith('fix-'))) { try { for (const e of JSON.parse(fs.readFileSync(path.join(shardDir, f), 'utf8'))) if (e && e.remove) removedByFix.add(e.id); } catch (e) { /* reported below */ } }
  for (const f of files) {
    let arr; try { arr = JSON.parse(fs.readFileSync(path.join(shardDir, f), 'utf8')); } catch (e) { E_('shards/' + f, 'unparseable: ' + e.message); continue; }
    if (f === 'holidays.json') continue;
    if (!Array.isArray(arr)) { E_('shards/' + f, 'not a JSON array'); continue; }
    shardStats.rows += arr.length;
    for (const [i, e] of arr.entries()) {
      const where = `shards/${f} ${e && (e.id || e.name) || '#' + i}`;
      if (!e || typeof e !== 'object') { E_(where, 'not an object'); continue; }
      if (f.startsWith('cpd-')) { if (!e.id) W(where, 'cpd entry without id'); continue; }
      if (f.startsWith('fix-')) {
        if (!e.id || !e.note) E_(where, 'fix entry needs id and note');
        if (e.remove && ids.has(e.id)) E_(where, 'row is marked remove but is still in conferences.js (run tools/merge-shards.js)');
        if (!e.remove && !ids.has(e.id)) W(where, 'fix for an id not in conferences.js');
        if (e.set && e.set.specialty && !CANON.has(e.set.specialty)) E_(where, 'set.specialty is not canonical');
        if (e.set && e.set.specialty && ids.has(e.id) && ids.get(e.id).specialty !== e.set.specialty) E_(where, 'specialty fix not applied (run tools/merge-shards.js)');
        continue;
      }
      if (f.startsWith('provenance-')) {
        if (!e.id) { E_(where, 'provenance entry without id'); continue; }
        const row = ids.get(e.id); if (!row) W(where, 'id not in conferences.js (entry ignored by the merge)');
        if (e.verified === true) {
          if (!E.isIso(e.start) || !E.isIso(e.end) || e.end < e.start) W(where, 'verified entry with bad start/end (ignored by the merge)');
          if (e.sourceUrl && !isHttps(e.sourceUrl)) W(where, 'sourceUrl is not https (ignored by the merge)');
        }
        if (e.datesQuote || e.datesSourceUrl || e.verifiedOn) { /* B30 evidence entry: must confirm the row cleanly */
          shardStats.evidenceEntries++;
          if (e.verified !== true) E_(where, 'evidence fields on an entry that is not verified: true');
          else if (row) { const why = E.evidenceProblem({ ...row, start: e.start, end: e.end, datesSourceUrl: e.datesSourceUrl || e.sourceUrl, datesQuote: e.datesQuote, verifiedOn: e.verifiedOn }, { today }); if (why) E_(where, 'evidence breaks the rule: ' + why); }
        }
        continue;
      }
      /* conference rows: the merge validates, fixes (exp- shards) and de-duplicates these; problems here are warnings.
         Rows already in conferences.js are skipped by the merge (duplicate id), so only new rows are checked. */
      if (ids.has(e.id)) { shardStats.merged++; continue; }
      if (removedByFix.has(e.id)) { shardStats.merged++; continue; } /* dropped on purpose by a fix-*.json entry */
      shardStats.pending++;
      const exp = f.startsWith('exp-'), probs = rowProblems({ datesConfirmed: false, ...e, ...(exp ? { datesConfirmed: false, end: e.end || e.start, cpdHours: e.cpdHours || 0 } : {}), dateStatus: undefined }, today)
        .filter(p => !/^missing (cpdHours|format)$|^no map pin|^bad format/.test(p.msg) || !exp);
      for (const p of probs) W(where, p.msg.startsWith('confirmed without valid evidence') ? p.msg + ' (if the merge takes it, it becomes an estimate)' : p.msg);
    }
  }

  const up = rows.filter(c => c.end >= today), st = c => c.datesConfirmed === false ? 'estimated' : (!E.evidenceProblem(c, { today }) ? 'evidence' : 'legacy');
  const count = (L, s) => L.filter(c => st(c) === s).length;
  const summary = {
    total: rows.length, upcoming: up.length,
    confirmed: rows.filter(c => c.datesConfirmed === true).length,
    confirmedWithEvidence: count(rows, 'evidence'),
    legacyConfirmed: rows.filter(c => c.datesConfirmed === true && c.legacyConfirmed).length,
    estimated: count(rows, 'estimated'),
    downgradedByRule: rows.filter(c => c.datesConfirmed === false && c.estimateReason).length,
    confirmedSiteRootSource: rows.filter(c => c.datesConfirmed === true && E.isSiteRoot(c.sourceUrl || c.url)).length,
    upcomingConfirmedWithEvidence: count(up, 'evidence'), upcomingLegacy: count(up, 'legacy'), upcomingEstimated: count(up, 'estimated'),
    countries: new Set(rows.map(c => c.countryCode)).size, specialties: new Set(rows.map(c => c.specialty)).size,
    shardFiles: shardStats.files, shardRows: shardStats.rows, shardRowsNotMerged: shardStats.pending, shardEvidenceEntries: shardStats.evidenceEntries,
    errors: errors.length, warnings: warnings.length
  };
  return { summary, errors, warnings };
}

function printSummary(s, out = console.log) {
  out(`validate-data: ${s.total} rows (${s.upcoming} upcoming), ${s.countries} countries, ${s.specialties} specialties`);
  out(`  confirmed ${s.confirmed}: with evidence ${s.confirmedWithEvidence}, legacy (source not yet re-checked) ${s.legacyConfirmed}`);
  out(`  estimated ${s.estimated} (downgraded by the evidence rule: ${s.downgradedByRule})`);
  out(`  confirmed rows whose source is a site root: ${s.confirmedSiteRootSource}`);
  out(`  upcoming: ${s.upcomingConfirmedWithEvidence} with evidence, ${s.upcomingLegacy} legacy, ${s.upcomingEstimated} estimated`);
  out(`  shards: ${s.shardFiles} files, ${s.shardRows} rows (${s.shardRowsNotMerged} conference rows not in conferences.js), ${s.shardEvidenceEntries} evidence entries`);
  out(`  errors: ${s.errors}, warnings: ${s.warnings}`);
}

if (require.main === module) {
  const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const r = validate({ root: opt('--root') ? path.resolve(opt('--root')) : undefined, today: opt('--today') || undefined });
  const show = +(opt('--show') || 20);
  if (argv.includes('--json')) console.log(JSON.stringify(r, null, 1));
  else {
    if (r.errors.length) console.log('ERRORS:\n  ' + r.errors.slice(0, show).join('\n  ') + (r.errors.length > show ? `\n  ... and ${r.errors.length - show} more` : ''));
    if (r.warnings.length) {
      const kinds = {}; for (const w of r.warnings) { const k = w.replace(/^[^:]+: /, '').replace(/"[^"]*"|\b[A-Z]{2}\b|\d+/g, '…').slice(0, 70); kinds[k] = (kinds[k] || 0) + 1; }
      console.log('warnings by kind:\n  ' + Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, show).map(([k, v]) => `${v} × ${k}`).join('\n  '));
    }
    printSummary(r.summary);
  }
  process.exit(r.errors.length ? 1 : 0);
}
module.exports = { validate, rowProblems, printSummary };
