'use strict';
/* Builds data/experiences/experiences.json from tools/experiences/src/*.js (P = place, X = experience). Every sourceQuote
   must appear, after whitespace and quote-mark normalisation, in the text of sourceUrl saved by fetch.js; otherwise the
   row is reported and the build fails. verifiedOn is the date the page was fetched; sourceUrl is the final URL after
   redirects. Usage: node tools/experiences/build.js [out.json]  (default data/experiences/experiences.json) */
const fs = require('fs'), path = require('path');
const CACHE = process.env.XP_CACHE || path.join(__dirname, '.cache');
const idx = JSON.parse(fs.readFileSync(path.join(CACHE, 'index.json'), 'utf8'));
const OUT = process.argv[2] || path.join(__dirname, '..', '..', 'data', 'experiences', 'experiences.json');
const norm = s => String(s).replace(/[\u200b\u200c\u200d\ufeff]/g, '').replace(/[ \s]+/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim();
const pageCache = {};
function page(url) {
  const v = idx[url];
  if (!v || v.status !== 200) return null;
  return pageCache[url] || (pageCache[url] = norm(fs.readFileSync(path.join(CACHE, 'pages', v.file + '.txt'), 'utf8')));
}
const places = {}; const items = []; const errors = [];
global.P = (key, city, region, countryCode, lat, lng, radiusKm, nearby, sameCountry) => { places[key] = { city, region, countryCode, lat, lng, radiusKm, nearby: nearby || [] }; if (sameCountry) places[key].sameCountry = true; };
global.X = (placeKey, category, title, season, summary, sourceUrl, sourceQuote, extra) => items.push({ placeKey, category, title, season, summary, sourceUrl, sourceQuote, extra: extra || {} });
for (const f of fs.readdirSync(path.join(__dirname, 'src')).sort()) require(path.join(__dirname, 'src', f));
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function parseSeason(s, forceSeasonal) {
  const parts = Array.isArray(s) ? s : [s];
  if (parts.every(p => /^\d{4}-\d{2}-\d{2}(\.\.\d{4}-\d{2}-\d{2})?$/.test(p))) {
    const dates = parts.map(p => { const [a, b] = p.split('..'); return { start: a, end: b || a }; });
    return { dateType: forceSeasonal ? 'seasonal' : 'fixed-event', season: { dates } };
  }
  if (parts.every(p => /^\d{2}-\d{2}\.\.\d{2}-\d{2}$/.test(p))) {
    return { dateType: 'seasonal', season: { ranges: parts.map(p => { const [from, to] = p.split('..'); return { from, to }; }) } };
  }
  throw new Error('bad season ' + JSON.stringify(s));
}
const out = []; const ids = new Set();
for (const it of items) {
  const pl = places[it.placeKey];
  if (!pl) { errors.push('no place ' + it.placeKey + ' for ' + it.title); continue; }
  let ps; try { ps = parseSeason(it.season, it.extra.seasonal); } catch (e) { errors.push(e.message + ' ' + it.title); continue; }
  const yr = ps.season.dates ? '-' + ps.season.dates[0].start.slice(0, 4) : '';
  let id = slug(it.placeKey + '-' + (it.extra.idHint || it.title)) + (yr && !slug(it.extra.idHint || it.title).includes(yr.slice(1)) ? yr : '');
  while (ids.has(id)) id += '-b';
  ids.add(id);
  const v = idx[it.sourceUrl] || {};
  const pg = page(it.sourceUrl);
  if (!pg) errors.push(id + ': page not saved/200 ' + it.sourceUrl);
  else if (!pg.includes(norm(it.sourceQuote))) errors.push(id + ': quote not on page: ' + it.sourceQuote.slice(0, 90));
  const row = {
    id,
    place: { key: it.placeKey, city: pl.city, region: pl.region, countryCode: pl.countryCode, lat: pl.lat, lng: pl.lng, radiusKm: it.extra.radiusKm || pl.radiusKm, nearby: pl.nearby, ...((pl.sameCountry || it.extra.sameCountry) ? { sameCountry: true } : {}) },
    title: it.title, category: it.category, dateType: ps.dateType, season: ps.season,
    summary: it.summary, sourceUrl: (v.final && /^https:/.test(v.final) ? v.final : it.sourceUrl), sourceQuote: norm(it.sourceQuote), verifiedOn: v.fetched || null
  };
  for (const k of ['family', 'note', 'tags', 'where']) if (it.extra[k] !== undefined) row[k] = it.extra[k];
  out.push(row);
}
if (errors.length) { console.error(errors.join('\n')); console.error(errors.length + ' errors'); process.exitCode = 1; }
const doc = { generated: new Date().toISOString().slice(0, 10), note: 'Experiences keyed by place and time for "Make a trip of it". Every sourceQuote was read on sourceUrl (official tourism board, park agency, government or event organiser) on verifiedOn and machine-checked against the saved page. Seasonal ranges recur each year (MM-DD, may wrap the year end); fixed events carry exact dates from the organiser.', vocabulary: ['ski-snow', 'beach-surf', 'dive-reef', 'food-wine', 'nature-wildlife', 'hiking-outdoors', 'culture-history', 'festival-event', 'sport-event', 'family', 'wellness', 'city-break'], count: out.length, experiences: out };
if (!errors.length) fs.writeFileSync(OUT, JSON.stringify(doc, null, 1) + '\n');
console.log(out.length, 'experiences', errors.length, 'errors');
const c = {}; for (const r of out) c[r.category] = (c[r.category] || 0) + 1; console.log(c);
