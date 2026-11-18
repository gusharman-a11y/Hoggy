'use strict';
/* x10 "resus" desk: resuscitation / emergency / critical care / anaesthesia / airway / retrieval / wilderness courses (AU + NZ).
   Reads every source below politely (tools/courses/http.js: robots.txt, >=3 s per host, generic UA, no bot-wall bypass),
   parses with the resus-*.js parsers, drops sessions already held in data/courses/sessions.json, and writes
     data/courses/sources/resus.sessions.json   { generated, note, sessions: [...new rows], updates: [...facts for held rows] }
   updates = price / places / seats read on a provider's own platform for a session the main file already holds (matched on
   course + start + region + provider); the merge step may apply them (fields + evidence) instead of adding a duplicate.
   Usage: node tools/courses/x10/resus-run.js [--today YYYY-MM-DD] [--from DIR] [--dry] [--out FILE]
     --out FILE  write there instead of data/courses/sources/resus.sessions.json (tools/refresh-courses.js checks it first)
     --from DIR  replay saved pages offline: DIR/index.json maps URL -> file name in DIR
   The catalogue for the new course ids is data/courses/sources/resus.catalogue.json (hand-written, quotes from provider pages). */
const fs = require('node:fs'), path = require('node:path');
const { makeClient } = require('../http');
const arlo = require('./resus-arlo'), acccn = require('./resus-acccn'), prime = require('./resus-prime'), ctec = require('./resus-ctec');
const acrrmX = require('./resus-acrrm'), spums = require('./resus-spums'), rescuemed = require('./resus-rescuemed');
const { BASE: ACRRM_BASE } = require('../acrrm');

const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const today = arg('--today') || new Date().toISOString().slice(0, 10);
const fromDir = arg('--from'), dry = process.argv.includes('--dry');
const outFile = path.resolve(arg('--out') || path.join(__dirname, '..', '..', '..', 'data/courses/sources/resus.sessions.json'));
const ROOT = path.join(__dirname, '..', '..', '..');

const ARLO = [
  { account: 'emcareservicesltd', provider: 'Emcare Services Limited', country: 'NZ', idTag: 'emcare',
    sourceKind: 'Emcare Services own Arlo platform (public event API)',
    rules: [
      { re: /^NZRC CORE Advanced/i, courseId: 'nzrc-core-advanced', variant: 'full' },
      { re: /^ACLS6\b/i, courseId: 'nz-acls', variant: 'acls6' },
      { re: /^Principles of Advanced Cardiac Life Support/i, courseId: 'pacls', variant: 'full' }
    ] },
  { account: 'resuscitationmatters', provider: 'Resuscitation Matters Ltd', country: 'NZ', idTag: 'resuscitation-matters',
    sourceKind: 'Resuscitation Matters own Arlo platform (public event API)',
    rules: [
      { re: /^Advanced Resuscitation Course/i, courseId: 'nzrc-core-advanced', variant: 'full' },
      { re: /^Immediate Resuscitation Course/i, courseId: 'nzrc-core-immediate', variant: 'full',
        note: 'provider lists it as "Immediate Resuscitation Course" (Immediate Adult and Child); NZRC not named on the event' },
      { re: /^Advanced Cardiac Life Support/i, courseId: 'nz-acls', variant: 'full' }
    ] },
  { account: 'advancedresuscitationtraining', provider: 'Advanced Resuscitation Training', country: 'AU', idTag: 'art',
    sourceKind: 'Advanced Resuscitation Training own Arlo platform (public event API; ARC course centre)',
    rules: [
      { re: /^ALS 1 \(ARC\)/i, courseId: 'als1', variant: 'full' },
      { re: /^ALS 2 Recertification \(ARC\)/i, courseId: 'als2', variant: 'recertification' },
      { re: /^ALS 2 \(ARC\)/i, courseId: 'als2', variant: 'full' },
      { re: /^Paediatric ALS 1\b/i, courseId: 'paediatric-als', variant: 'full' },
      { re: /^BLS Instructors Course for Health Professionals/i, courseId: 'bls-instructor', variant: 'full' }
    ] },
  { account: 'medicaltrainingsolutions', provider: 'Medical Training Solutions, WA', country: 'AU', idTag: 'mts',
    sourceKind: 'Medical Training Solutions own Arlo platform (public event API; ARC course centre)',
    rules: [
      { re: /^ALS1\b/i, courseId: 'als1', variant: 'full' },
      { re: /^ALS 2 - Recertification/i, courseId: 'als2', variant: 'recertification' },
      { re: /^ALS2\b/i, courseId: 'als2', variant: 'full' },
      { re: /^Paediatric Advanced Life Support/i, courseId: 'paediatric-als', variant: 'full' },
      { re: /^12-Lead ECG Course/i, courseId: 'ecg-12-lead', variant: 'full' }
    ] }
];
const CTEC = ['jdocs-emergency-airways', 'jdocs-emergency-procedures', 'critical-care-procedures-workshop',
  'emergency-department-procedures-workshop', 'cutting-edge-emergency-procedures', 'cutting-edge-practical-ed-skills']
  .map(p => ({ page: p, url: 'https://www.ctec.uwa.edu.au/workshops/' + p, courseId: 'ctec-' + p.replace(/-workshop$/, '') }));

async function main() {
  const log = m => process.stderr.write(m + '\n');
  let get;
  if (fromDir) {
    const idx = JSON.parse(fs.readFileSync(path.join(fromDir, 'index.json'), 'utf8'));
    get = async u => { if (!idx[u]) throw new Error('not in --from dir: ' + u); return fs.readFileSync(path.join(fromDir, idx[u]), 'utf8'); };
  } else { const c = makeClient({ log }); get = c.get; }
  const report = [], fresh = [];
  async function run(name, url, fn) {
    try { const body = await get(url); const r = fn(body); fresh.push(...r.sessions); report.push({ name, url, sessions: r.sessions.length, skipped: (r.skipped || []).length }); }
    catch (e) { report.push({ name, url, error: e.message, code: e.code }); log(`FAIL ${name}: ${e.message}`); }
  }
  for (const s of ARLO) await run('arlo:' + s.account, arlo.apiUrl(s.account), b => arlo.parse(JSON.parse(b), s, { today }));
  await run('acccn', acccn.SOURCE_URL, b => acccn.parse(b, { today }));
  await run('prime', prime.SOURCE_URL, b => prime.parse(b, { today }));
  for (const c of CTEC) await run('ctec:' + c.page, c.url, b => ctec.parse(b, { today, sourceUrl: c.url, courseId: c.courseId }));
  for (const p of acrrmX.PAGES) await run('acrrm:' + p, ACRRM_BASE + p, b => acrrmX.parse(b, p, { today }));
  await run('spums', spums.SOURCE_URL, b => spums.parse(b, { today }));
  for (const d of rescuemed.PAGES) await run('rescuemed:' + d.slug, rescuemed.BASE + d.slug + '/', b => rescuemed.parse(b, d, { today }));

  /* split into new rows and updates for rows the main file already has */
  /* only the core rows (refresh-courses.js sources): rows tools/merge-courses.js added from sources/ carry fromSource, and this
     desk's own rows must come back as new rows, not as updates of themselves */
  const main = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/courses/sessions.json'), 'utf8')).sessions.filter(s => !s.fromSource);
  const pk = p => String(p || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 10);
  const held = new Map();
  for (const s of main) { const k = [s.courseId, s.start, s.region, pk(s.provider)].join('|'); if (!held.has(k)) held.set(k, s); }
  const sessions = [], updates = [], ids = new Set(main.map(s => s.id)), seen = new Set();
  for (const s of fresh) {
    const k = [s.courseId, s.start, s.region, pk(s.provider)].join('|');
    const h = held.get(k);
    if (h) {
      if (s.priceFrom != null || s.placesRemaining != null) updates.push({
        id: h.id, priceFrom: s.priceFrom, currency: s.currency, priceNote: s.priceNote, seatsStatus: s.seatsStatus,
        placesRemaining: s.placesRemaining, providerBookingUrl: s.bookingUrl, sourceUrl: s.sourceUrl, datesQuote: s.datesQuote,
        sourceRef: s.sourceRef, lastVerified: s.lastVerified, sourceKind: s.sourceKind
      });
      continue;
    }
    const dk = [s.courseId, s.provider, s.city, s.start, s.end, s.venue || ''].join('|').toLowerCase();
    if (seen.has(dk)) continue; seen.add(dk);
    let id = s.id, n = 2; while (ids.has(id)) id = `${s.id}-${n++}`; ids.add(id);
    sessions.push({ ...s, id });
  }
  sessions.sort((a, b) => a.courseId.localeCompare(b.courseId) || a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  const out = {
    generated: today,
    note: 'x10 resus desk (AU/NZ resuscitation, emergency, critical care, anaesthesia, airway, retrieval, wilderness). Sessions read on the provider\'s own page or booking platform on lastVerified. updates[] = price/places for sessions already in data/courses/sessions.json (matched on course + start + region + provider), with the evidence read.',
    sessions, updates
  };
  for (const r of report) log(JSON.stringify(r));
  log(`new sessions ${sessions.length}, updates ${updates.length}`);
  if (!dry) { fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, JSON.stringify(out, null, 1) + '\n'); }
  if (report.every(r => r.error)) process.exit(2);
}
main().catch(e => { console.error(e); process.exit(1); });
