'use strict';
/* Merge data/shards/*.json into data/conferences.js with validation and de-duplication.
   Optional destination fields (tools/destination-fields.js: tags, schedule, organiserType, accreditation, audience) are carried from
   conference shards and from provenance entries when valid; an invalid one is left out and listed, the row still merges.
   Usage: node tools/merge-shards.js [--dry] [--root DIR] [--today YYYY-MM-DD] [--migrate-legacy]
   Evidence rule (B30, tools/evidence.js): a row stays datesConfirmed only with datesSourceUrl + datesQuote + verifiedOn on the
   organiser's domain, or with legacyConfirmed (confirmed before the rule, quote not stored yet). Any other confirmed row is
   downgraded to an estimate with estimateReason; its data (dates, evidence fields) is kept.
   --migrate-legacy: one-off (run 17 Nov 2026): marks every confirmed row without evidence fields legacyConfirmed. Refuses to
   run again once any row carries the flag, so it can never re-legacy a row that lost its confirmation. */
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const root = path.resolve(opt('--root') || path.join(__dirname, '..')), dry = argv.includes('--dry'), MIGRATE = argv.includes('--migrate-legacy');
const { evidenceProblem, hasAnyEvidence } = require('./evidence');
const { pickDestination, hasDestinationFields } = require('./destination-fields'); // optional tags / schedule / organiserType / accreditation / audience
const mainFile = path.join(root, 'data', 'conferences.js'), shardDir = path.join(root, 'data', 'shards');
const { CANON, canon } = require('./specialties');
const { demangle } = require('./demangle'); // tools/specialties.json: one name per specialty
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(mainFile, 'utf8'), ctx);
const base = ctx.window.HOGGY_CONFERENCES;
const REQ = ['id', 'name', 'organiser', 'specialty', 'city', 'country', 'countryCode', 'region', 'start', 'end', 'format', 'cpdHours', 'url', 'blurb'];
const REGIONS = new Set(['Europe', 'North America', 'Asia-Pacific', 'Middle East', 'Africa', 'Latin America']);
const norm = s => String(s).toLowerCase().replace(/\b(20\d\d|annual|congress|meeting|conference|scientific|sessions|the|of|and|&)\b/g, '').replace(/[^a-z0-9]+/g, '');
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
/* wave 3: two rows on one host and one start day are the same meeting unless both urls are distinct event pages (aoa.org.au lists
   two branch meetings on one day, each with its own detail page). A site-root url still collides with anything on its host. */
const { isSiteRoot } = require('./evidence');
const urlPath = u => { try { return isSiteRoot(u) ? '' : new URL(u).pathname.replace(/\/+$/, ''); } catch (e) { return ''; } };
const urlDate = new Map();
const seenUrlDate = { has(c) { const l = urlDate.get(host(c.url) + c.start); if (!l) return false; const p = urlPath(c.url); return !p || l.some(q => !q || q === p); },
  add(c) { const k = host(c.url) + c.start; (urlDate.get(k) || urlDate.set(k, []).get(k)).push(urlPath(c.url)); } };
const valid = c => {
  for (const k of REQ) if (c[k] == null || c[k] === '') return 'missing ' + k;
  if (!/^[a-z0-9-]{3,80}$/.test(c.id)) return 'bad id';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.start) || !/^\d{4}-\d{2}-\d{2}$/.test(c.end) || isNaN(Date.parse(c.start)) || isNaN(Date.parse(c.end)) || c.end < c.start) return 'bad dates';
  if (c.start < '2026-11-01' || c.start > '2028-12-31') return 'out of range';
  if (!/^https:\/\//.test(c.url)) return 'url must be https';
  if (!/^[A-Z]{2}$/.test(c.countryCode)) return 'bad countryCode';
  if (!REGIONS.has(c.region)) return 'bad region';
  if (!CANON.has(c.specialty)) return 'unknown specialty "' + c.specialty + '" (add it to tools/specialties.json)';
  if (!['In-person', 'Hybrid'].includes(c.format)) return 'bad format';
  if (typeof c.cpdHours !== 'number' || c.cpdHours < 0 || c.cpdHours > 100) return 'bad cpdHours';
  return null;
};
const EVIDENCE_KEYS = ['datesSourceUrl', 'datesQuote', 'verifiedOn', 'organiserUrl', 'societyUrl'];
const pick = (o, ks) => Object.fromEntries(ks.filter(k => o[k] != null && o[k] !== '').map(k => [k, o[k]]));
const CONFIRMED_ONLY = new Set(['late2026-2028.json', 'r8-aunz.json', 'r8-na.json', 'r8-eu.json', 'r8-asia.json', 'r8-latam-africa.json']); // shards whose unconfirmed rows had unopened URLs
const DROP = new Set(['jsog-annual-meeting']); // dates matched a different congress; re-add only once JSOG's own page is read
const TODAY = opt('--today') || new Date().toISOString().slice(0, 10);
if (MIGRATE && base.some(c => c.legacyConfirmed)) { console.error('--migrate-legacy already ran (rows carry legacyConfirmed); refusing'); process.exit(1); }
if (MIGRATE) for (const c of base) if (c.datesConfirmed !== false && !hasAnyEvidence(c)) c.legacyConfirmed = true;
const wasLegacy = new Set(base.filter(c => c.legacyConfirmed).map(c => c.id));
const out = base.map(c => { const r = { ...c, dateStatus: c.dateStatus || (c.datesConfirmed === false ? 'estimated' : 'confirmed'), sourceUrl: c.sourceUrl || c.url }; if (r.lastVerified === '2026-11-06' && !r.provenance) delete r.lastVerified; return r; }), seenId = new Set(out.map(c => c.id)), seenKey = new Set(out.map(c => norm(c.name) + c.start.slice(0, 4)));
for (const c of out) seenUrlDate.add(c);
const stats = { added: 0, dupId: 0, dupName: 0, invalid: 0 }, rejects = [];
const dest = { rows: 0, provenance: 0, dropped: [] }; /* destination fields: carried when valid, left out (and listed) when not; never a reason to reject a row */
const shardFiles = fs.existsSync(shardDir) ? fs.readdirSync(shardDir).filter(x => x.endsWith('.json') && x !== 'holidays.json') : [];
for (const f of shardFiles.filter(x => !x.startsWith('provenance-') && !x.startsWith('cpd-') && !x.startsWith('fix-'))) {
  let arr; try { arr = JSON.parse(fs.readFileSync(path.join(shardDir, f), 'utf8')); } catch (e) { console.error(f, 'unparseable:', e.message); continue; }
  for (const c of arr) {
    if ((CONFIRMED_ONLY.has(f) || f.startsWith('desk-')) && c.datesConfirmed !== true) { stats.skippedUnconfirmed = (stats.skippedUnconfirmed || 0) + 1; continue; }
    if (f.startsWith('exp-')) { c.datesConfirmed = false; c.dateStatus = 'estimated'; c.cpdHours = c.cpdHours || 0; if (!c.end) c.end = c.start; }
    if (DROP.has(c.id)) continue;
    if (c.specialty != null && c.specialty !== '') c.specialty = canon(c.specialty) || c.specialty; // variants -> canonical; unknown ones fail valid()
    const why = valid(c); if (why) { stats.invalid++; rejects.push(`${f}: ${c.id || c.name}: ${why}`); continue; }
    const key = norm(c.name) + c.start.slice(0, 4);
    if (seenId.has(c.id)) { stats.dupId++; continue; }
    if (seenKey.has(key) || seenUrlDate.has(c)) { stats.dupName++; continue; }
    seenId.add(c.id); seenKey.add(key); seenUrlDate.add(c);
    out.push({ id: c.id, name: c.name, organiser: c.organiser, specialty: c.specialty, city: c.city, country: c.country, countryCode: c.countryCode, region: c.region, lat: +c.lat || 0, lng: +c.lng || 0, start: c.start, end: c.end, format: c.format, cpdHours: c.cpdHours, cpdBody: c.cpdBody || '', priceFrom: +c.priceFrom || 0, attendees: +c.attendees || 0, url: c.url, blurb: String(c.blurb).slice(0, 240), datesConfirmed: c.datesConfirmed === true, dateStatus: c.datesConfirmed === true ? 'confirmed' : 'estimated', sourceUrl: c.sourceUrl || c.url, ...pick(c, EVIDENCE_KEYS), ...pickDestination(c, dest.dropped), ...(c.lastVerified || (c.datesConfirmed === true && c.sourceUrl && c.sourceUrl !== c.url) ? { lastVerified: c.lastVerified || TODAY } : {}) });
    if (hasDestinationFields(c)) dest.rows++;
    stats.added++;
  }
}
/* normalisation: never present guesses as facts */
const badSpec = new Map();
for (const c of out) {
  const sp = canon(c.specialty); if (sp) c.specialty = sp; else badSpec.set(c.specialty, (badSpec.get(c.specialty) || 0) + 1);
  if (!c.cpdVerified && c.cpdHours) c.cpdHours = 0; // 20 was a placeholder guess
  for (const k of ['name', 'organiser', 'blurb']) if (typeof c[k] === 'string') c[k] = demangle(c[k]);
  c.blurb = String(c.blurb).replace(/(?:the )?(?:[A-Za-z]+ )?[A-Za-z]+['’]s (?:largest|biggest|leading|premier|foremost) /gi, 'a major ').replace(/(?:the )?(?:largest|biggest) /gi, 'a major ').replace(/a a major/gi, 'a major').replace(/The (?:Middle|Far|Near) a major/g, 'A major').replace(/^a major/, 'A major');
}
/* a provenance entry that moves a row to another country must also move its code and map pin (B30 found Auckland filed under AU
   with Adelaide's pin, Helsinki under CZ with Prague's) */
const codeOf = name => { const m = out.find(c => c.country === name && c.countryCode); return m ? m.countryCode : null; };
const pinOf = (city, country) => { const m = out.find(c => c.city === city && c.country === country && (c.lat || c.lng)); return m ? { lat: m.lat, lng: m.lng } : null; };
function place(row, e) {
  const city = e.city || row.city, country = e.country || row.country, moved = city !== row.city || country !== row.country;
  const r = { city, country, countryCode: e.countryCode || (country !== row.country ? codeOf(country) || row.countryCode : row.countryCode) };
  const pin = e.lat != null && e.lng != null ? { lat: +e.lat, lng: +e.lng } : moved ? pinOf(city, country) : null;
  return pin ? { ...r, ...pin } : r;
}
const prov = { verified: 0, withEvidence: 0, downgraded: 0, corrected: 0, noEvidence: 0 }, noEvidence = [];
for (const f of shardFiles.filter(x => x.startsWith('provenance-'))) {
  let arr; try { arr = JSON.parse(fs.readFileSync(path.join(shardDir, f), 'utf8')); } catch (e) { console.error(f, 'unparseable'); continue; }
  for (const e of arr) {
    const row = out.find(c => c.id === e.id); if (!row) continue;
    /* destination fields ride on any provenance entry (a tags-only entry needs no `verified`): they describe the meeting, not its dates */
    if (hasDestinationFields(e)) { const d = pickDestination(e, dest.dropped); if (Object.keys(d).length) { Object.assign(row, d); dest.provenance++; } }
    const weak = /third[- ]party|aggregator|docthub|(?:^|[^a-z])ilds(?:[^a-z]|$)|tourism|santetropicale|listing site|js bundle|script bundle/i.test((e.note || '') + ' ' + (e.sourceUrl || '')) || /phaa|population-health/i.test(e.id) || !e.end;
    if (e.verified === true && weak) { if (row.datesConfirmed === true && !row.provenance) { row.datesConfirmed = false; row.dateStatus = 'estimated'; delete row.lastVerified; delete row.legacyConfirmed; prov.weak = (prov.weak || 0) + 1; } continue; }
    if (e.verified === true && /^https:\/\//.test(e.sourceUrl || e.datesSourceUrl || '') && /^\d{4}-\d{2}-\d{2}$/.test(e.start) && e.end >= e.start) {
      const changed = row.start !== e.start || row.end !== e.end || (e.city && row.city !== e.city);
      if (e.datesQuote) { /* B30: an entry with evidence (tools/verify-dates.js or a desk) confirms the row on its own merits */
        if (changed) prov.corrected++;
        Object.assign(row, { start: e.start, end: e.end, ...place(row, e), sourceUrl: e.datesSourceUrl || e.sourceUrl, datesSourceUrl: e.datesSourceUrl || e.sourceUrl, datesQuote: e.datesQuote, verifiedOn: e.verifiedOn, lastVerified: e.verifiedOn || TODAY, provenance: 'organiser-page', datesConfirmed: true, dateStatus: 'confirmed' });
        delete row.legacyConfirmed; delete row.estimateReason; prov.withEvidence++;
      } else if (wasLegacy.has(row.id)) { /* pre-rule entry replayed: same result as before the rule, still legacy, and no fresh lastVerified (nobody re-read the page today) */
        if (changed) prov.corrected++;
        Object.assign(row, { start: e.start, end: e.end, ...place(row, e), sourceUrl: e.sourceUrl, lastVerified: row.lastVerified || e.verifiedOn || (f.match(/\d{4}-\d{2}-\d{2}/) || [])[0] || TODAY, provenance: 'organiser-page', datesConfirmed: true, dateStatus: 'confirmed', legacyConfirmed: true }); prov.verified++;
      } else { prov.noEvidence++; noEvidence.push(`${f}: ${e.id}`); } /* no quote: cannot confirm a row any more */
    } else if (e.verified === false) { row.datesConfirmed = false; row.dateStatus = 'estimated'; delete row.lastVerified; delete row.provenance; delete row.legacyConfirmed; prov.downgraded++; }
  }
}
const CPD_ALLOW = new Set(['bsr-annual-conference']); // page states '22 credits' beside 'April 2027'
const cpdStats = { applied: 0 };
for (const f of shardFiles.filter(x => x.startsWith('cpd-'))) {
  let arr; try { arr = JSON.parse(fs.readFileSync(path.join(shardDir, f), 'utf8')); } catch (e) { console.error(f, 'unparseable'); continue; }
  for (const e of arr) {
    const row = out.find(c => c.id === e.id); if (!row) continue;
    if (!CPD_ALLOW.has(e.id)) continue; // only figures re-checked by hand against the row's own 2027/2028 edition
    if (e.stated === true && typeof e.cpdHours === 'number' && e.cpdHours > 0 && e.cpdHours <= 100 && /^https:\/\//.test(e.sourceUrl || '')) { Object.assign(row, { cpdHours: e.cpdHours, cpdBody: String(e.cpdBody || '').slice(0, 80), cpdVerified: true, cpdSourceUrl: e.sourceUrl }); cpdStats.applied++; }
  }
}
/* fix-*.json (x10 expert review, 18 Nov 2026): corrections the daily merge must keep re-applying, because conferences.js is
   the merge's own base. Entry: { id, note, remove?: true, evidenceTo?: id, set?: { specialty|name|organiser|blurb }, strip?: [fields],
   estimateReason? }. remove drops the row (a shard re-adding it is dropped again); evidenceTo first moves its B30 evidence (dates,
   place, quote) onto the row that is kept; strip zeroes unsourced figures; set fields are checked (specialty must be canonical). */
const SET_OK = new Set(['specialty', 'name', 'organiser', 'blurb', 'lat', 'lng']) /* lat/lng (wave 2): map-pin fixes, numbers in range */, STRIP_OK = new Set(['attendees', 'priceFrom', 'cpdBody', 'cpdHours']);
const fixStats = { removed: 0, evidenceMoved: 0, set: 0, stripped: 0, missing: [] };
for (const f of shardFiles.filter(x => x.startsWith('fix-'))) {
  let arr; try { arr = JSON.parse(fs.readFileSync(path.join(shardDir, f), 'utf8')); } catch (e) { console.error(f, 'unparseable'); process.exit(1); }
  for (const e of arr) {
    const i = out.findIndex(c => c.id === e.id); if (i < 0) { fixStats.missing.push(`${f}: ${e.id}`); continue; }
    const row = out[i];
    if (e.set) for (const [k, v] of Object.entries(e.set)) {
      if (!SET_OK.has(k)) { console.error(`FAIL: ${f} ${e.id}: cannot set ${k}`); process.exit(1); }
      if (k === 'specialty' && !CANON.has(v)) { console.error(`FAIL: ${f} ${e.id}: specialty "${v}" is not canonical`); process.exit(1); }
      if ((k === 'lat' || k === 'lng') && !(typeof v === 'number' && Math.abs(v) <= (k === 'lat' ? 90 : 180))) { console.error(`FAIL: ${f} ${e.id}: ${k} must be a number in range`); process.exit(1); }
      row[k] = v; fixStats.set++;
    }
    for (const k of e.strip || []) { if (!STRIP_OK.has(k)) { console.error(`FAIL: ${f} ${e.id}: cannot strip ${k}`); process.exit(1); } row[k] = k === 'cpdBody' ? '' : 0; if (k.startsWith('cpd')) delete row.cpdVerified; fixStats.stripped++; }
    if (e.estimateReason && row.datesConfirmed === false) row.estimateReason = String(e.estimateReason).slice(0, 300);
    if (e.remove) {
      const to = e.evidenceTo && out.find(c => c.id === e.evidenceTo);
      if (e.evidenceTo && !to) fixStats.missing.push(`${f}: evidenceTo ${e.evidenceTo}`);
      if (to && row.datesConfirmed === true && row.datesQuote) {
        for (const k of ['start', 'end', 'city', 'country', 'countryCode', 'lat', 'lng', 'datesSourceUrl', 'datesQuote', 'verifiedOn', 'sourceUrl', 'organiserUrl', 'societyUrl']) if (row[k] != null && row[k] !== '') to[k] = row[k];
        Object.assign(to, { datesConfirmed: true, dateStatus: 'confirmed', lastVerified: row.verifiedOn || TODAY, provenance: 'organiser-page' }); delete to.legacyConfirmed; delete to.estimateReason; fixStats.evidenceMoved++;
      }
      out.splice(i, 1); fixStats.removed++;
    }
  }
}
console.log('fixes', JSON.stringify({ ...fixStats, missing: fixStats.missing.length }));
if (fixStats.missing.length) console.log('fix entries whose row is not there:\n  ' + fixStats.missing.join('\n  '));
/* B30 evidence rule, last so it sees every change above */
const ev = { confirmedWithEvidence: 0, legacy: 0, downgraded: 0 }, downgrades = [];
for (const c of out) {
  if (c.datesConfirmed === false) { c.dateStatus = 'estimated'; delete c.legacyConfirmed; continue; }
  const why = evidenceProblem(c, { today: TODAY });
  if (!why) { ev.confirmedWithEvidence++; delete c.legacyConfirmed; delete c.estimateReason; c.datesConfirmed = true; c.dateStatus = 'confirmed'; continue; }
  if (c.legacyConfirmed && !hasAnyEvidence(c)) { ev.legacy++; c.datesConfirmed = true; c.dateStatus = 'confirmed'; continue; }
  Object.assign(c, { datesConfirmed: false, dateStatus: 'estimated', estimateReason: 'Dates not confirmed: ' + why });
  delete c.legacyConfirmed; delete c.lastVerified; delete c.provenance; ev.downgraded++; downgrades.push(`${c.id}: ${why}`);
}
console.log('evidence', JSON.stringify(ev));
if (downgrades.length) console.log('downgraded to estimate (evidence rule):\n  ' + downgrades.slice(0, 40).join('\n  '));
if (noEvidence.length) console.log('provenance entries ignored (verified without datesQuote, row not legacy):\n  ' + noEvidence.slice(0, 40).join('\n  '));
if (dest.rows || dest.provenance || dest.dropped.length) console.log('destination fields', JSON.stringify({ newRows: dest.rows, fromProvenance: dest.provenance, dropped: dest.dropped.length }));
if (dest.dropped.length) console.log('destination fields left out (invalid):\n  ' + dest.dropped.slice(0, 40).join('\n  '));
console.log('cpd', JSON.stringify(cpdStats));
console.log('provenance', JSON.stringify(prov));
out.sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
console.log(JSON.stringify(stats), 'total', out.length, 'specialties', new Set(out.map(c => c.specialty)).size, 'countries', new Set(out.map(c => c.country)).size, 'confirmed', out.filter(c => c.datesConfirmed).length);
if (rejects.length) console.log('rejected:\n  ' + rejects.slice(0, 40).join('\n  '));
if (badSpec.size) { console.error('FAIL: specialties not in tools/specialties.json: ' + [...badSpec].map(([k, v]) => `"${k}" (${v})`).join(', ')); process.exit(1); }
if (!dry) fs.writeFileSync(mainFile, 'window.HOGGY_CONFERENCES = ' + JSON.stringify(out, null, 1) + ';\n');
