'use strict';
/* Merge data/shards/*.json into data/conferences.js with validation and de-duplication.
   Usage: node tools/merge-shards.js [--dry] */
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '..'), dry = process.argv.includes('--dry');
const mainFile = path.join(root, 'data', 'conferences.js'), shardDir = path.join(root, 'data', 'shards');
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(mainFile, 'utf8'), ctx);
const base = ctx.window.HOGGY_CONFERENCES;
const REQ = ['id', 'name', 'organiser', 'specialty', 'city', 'country', 'countryCode', 'region', 'start', 'end', 'format', 'cpdHours', 'url', 'blurb'];
const REGIONS = new Set(['Europe', 'North America', 'Asia-Pacific', 'Middle East', 'Africa', 'Latin America']);
const norm = s => String(s).toLowerCase().replace(/\b(20\d\d|annual|congress|meeting|conference|scientific|sessions|the|of|and|&)\b/g, '').replace(/[^a-z0-9]+/g, '');
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const valid = c => {
  for (const k of REQ) if (c[k] == null || c[k] === '') return 'missing ' + k;
  if (!/^[a-z0-9-]{3,80}$/.test(c.id)) return 'bad id';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.start) || !/^\d{4}-\d{2}-\d{2}$/.test(c.end) || isNaN(Date.parse(c.start)) || isNaN(Date.parse(c.end)) || c.end < c.start) return 'bad dates';
  if (c.start < '2026-11-01' || c.start > '2028-12-31') return 'out of range';
  if (!/^https:\/\//.test(c.url)) return 'url must be https';
  if (!/^[A-Z]{2}$/.test(c.countryCode)) return 'bad countryCode';
  if (!REGIONS.has(c.region)) return 'bad region';
  if (!['In-person', 'Hybrid'].includes(c.format)) return 'bad format';
  if (typeof c.cpdHours !== 'number' || c.cpdHours < 0 || c.cpdHours > 100) return 'bad cpdHours';
  return null;
};
const CONFIRMED_ONLY = new Set(['late2026-2028.json', 'r8-aunz.json', 'r8-na.json', 'r8-eu.json', 'r8-asia.json', 'r8-latam-africa.json']); // shards whose unconfirmed rows had unopened URLs
const DROP = new Set(['jsog-annual-meeting']); // dates matched a different congress; re-add only once JSOG's own page is read
const TODAY = new Date().toISOString().slice(0, 10);
const out = base.map(c => { const r = { dateStatus: c.datesConfirmed === false ? 'estimated' : 'confirmed', sourceUrl: c.url, ...c }; if (r.lastVerified === '2026-11-06' && !r.provenance) delete r.lastVerified; return r; }), seenId = new Set(out.map(c => c.id)), seenKey = new Set(out.map(c => norm(c.name) + c.start.slice(0, 4))), seenUrlDate = new Set(out.map(c => host(c.url) + c.start));
const stats = { added: 0, dupId: 0, dupName: 0, invalid: 0 }, rejects = [];
const shardFiles = fs.existsSync(shardDir) ? fs.readdirSync(shardDir).filter(x => x.endsWith('.json') && x !== 'holidays.json') : [];
for (const f of shardFiles.filter(x => !x.startsWith('provenance-') && !x.startsWith('cpd-'))) {
  let arr; try { arr = JSON.parse(fs.readFileSync(path.join(shardDir, f), 'utf8')); } catch (e) { console.error(f, 'unparseable:', e.message); continue; }
  for (const c of arr) {
    if ((CONFIRMED_ONLY.has(f) || f.startsWith('desk-')) && c.datesConfirmed !== true) { stats.skippedUnconfirmed = (stats.skippedUnconfirmed || 0) + 1; continue; }
    if (f.startsWith('exp-')) { c.datesConfirmed = false; c.dateStatus = 'estimated'; c.cpdHours = c.cpdHours || 0; if (!c.end) c.end = c.start; }
    if (DROP.has(c.id)) continue;
    const why = valid(c); if (why) { stats.invalid++; rejects.push(`${f}: ${c.id || c.name}: ${why}`); continue; }
    const key = norm(c.name) + c.start.slice(0, 4);
    if (seenId.has(c.id)) { stats.dupId++; continue; }
    if (seenKey.has(key) || seenUrlDate.has(host(c.url) + c.start)) { stats.dupName++; continue; }
    seenId.add(c.id); seenKey.add(key); seenUrlDate.add(host(c.url) + c.start);
    out.push({ id: c.id, name: c.name, organiser: c.organiser, specialty: c.specialty, city: c.city, country: c.country, countryCode: c.countryCode, region: c.region, lat: +c.lat || 0, lng: +c.lng || 0, start: c.start, end: c.end, format: c.format, cpdHours: c.cpdHours, cpdBody: c.cpdBody || '', priceFrom: +c.priceFrom || 0, attendees: +c.attendees || 0, url: c.url, blurb: String(c.blurb).slice(0, 240), datesConfirmed: c.datesConfirmed === true, dateStatus: c.datesConfirmed === true ? 'confirmed' : 'estimated', sourceUrl: c.sourceUrl || c.url, ...(c.lastVerified || (c.datesConfirmed === true && c.sourceUrl && c.sourceUrl !== c.url) ? { lastVerified: c.lastVerified || TODAY } : {}) });
    stats.added++;
  }
}
/* normalisation: never present guesses as facts */
for (const c of out) {
  if (!c.cpdVerified && c.cpdHours) c.cpdHours = 0; // 20 was a placeholder guess
  c.blurb = String(c.blurb).replace(/(?:the )?(?:[A-Za-z]+ )?[A-Za-z]+['’]s (?:largest|biggest|leading|premier|foremost) /gi, 'a major ').replace(/(?:the )?(?:largest|biggest) /gi, 'a major ').replace(/a a major/gi, 'a major').replace(/The (?:Middle|Far|Near) a major/g, 'A major').replace(/^a major/, 'A major');
}
const prov = { verified: 0, downgraded: 0, corrected: 0 };
for (const f of shardFiles.filter(x => x.startsWith('provenance-'))) {
  let arr; try { arr = JSON.parse(fs.readFileSync(path.join(shardDir, f), 'utf8')); } catch (e) { console.error(f, 'unparseable'); continue; }
  for (const e of arr) {
    const row = out.find(c => c.id === e.id); if (!row) continue;
    const weak = /third[- ]party|aggregator|docthub|(?:^|[^a-z])ilds(?:[^a-z]|$)|tourism|santetropicale|listing site|js bundle|script bundle/i.test((e.note || '') + ' ' + (e.sourceUrl || '')) || /phaa|population-health/i.test(e.id) || !e.end;
    if (e.verified === true && weak) { if (row.datesConfirmed === true && !row.provenance) { row.datesConfirmed = false; row.dateStatus = 'estimated'; delete row.lastVerified; prov.weak = (prov.weak || 0) + 1; } continue; }
    if (e.verified === true && /^https:\/\//.test(e.sourceUrl || '') && /^\d{4}-\d{2}-\d{2}$/.test(e.start) && e.end >= e.start) {
      if (row.start !== e.start || row.end !== e.end || (e.city && row.city !== e.city)) prov.corrected++;
      Object.assign(row, { start: e.start, end: e.end, city: e.city || row.city, country: e.country || row.country, sourceUrl: e.sourceUrl, lastVerified: TODAY, provenance: 'organiser-page', datesConfirmed: true, dateStatus: 'confirmed' }); prov.verified++;
    } else if (e.verified === false) { row.datesConfirmed = false; row.dateStatus = 'estimated'; delete row.lastVerified; delete row.provenance; prov.downgraded++; }
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
console.log('cpd', JSON.stringify(cpdStats));
console.log('provenance', JSON.stringify(prov));
out.sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
console.log(JSON.stringify(stats), 'total', out.length, 'specialties', new Set(out.map(c => c.specialty)).size, 'countries', new Set(out.map(c => c.country)).size, 'confirmed', out.filter(c => c.datesConfirmed).length);
if (rejects.length) console.log('rejected:\n  ' + rejects.slice(0, 40).join('\n  '));
if (!dry) fs.writeFileSync(mainFile, 'window.HOGGY_CONFERENCES = ' + JSON.stringify(out, null, 1) + ';\n');
