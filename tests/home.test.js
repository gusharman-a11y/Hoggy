'use strict';
/* Home page facts, travel links, external-link attributes and the drawer re-render loop. Run: node --test tests/ */
const test = require('node:test'), assert = require('node:assert/strict');
const path = require('node:path'), fs = require('node:fs'), vm = require('node:vm');
const { homeStats, exampleConfs, travelLinks, dateEvidence } = require('../stats.js');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const confs = () => { const ctx = { window: {} }; vm.runInNewContext(read('data/conferences.js'), ctx); return ctx.window.HOGGY_CONFERENCES; };

test('home stats: exact counts, percentage rounded down, no padding', () => {
  const C = confs(), day = '2026-11-11', up = C.filter(c => c.end >= day), s = homeStats(C, day);
  assert.equal(s.conferences, up.length);
  assert.equal(s.countries, new Set(up.map(c => c.countryCode)).size);
  assert.equal(s.specialties, new Set(up.map(c => c.specialty)).size);
  /* B30: "confirmed" counts only rows with stored evidence; legacy confirmations are counted apart */
  const conf = up.filter(c => c.datesConfirmed === true && c.datesSourceUrl && c.datesQuote && c.verifiedOn && !c.legacyConfirmed).length;
  const legacy = up.filter(c => c.datesConfirmed !== false && !(c.datesSourceUrl && c.datesQuote && c.verifiedOn && !c.legacyConfirmed)).length;
  assert.equal(s.confirmed, conf); assert.equal(s.unchecked, legacy);
  assert.ok(s.confirmedPct <= conf / up.length * 100 && s.confirmedPct > conf / up.length * 100 - 1, 'floor, never rounded up');
  const ev = { datesSourceUrl: 'https://x/2027', datesQuote: '1 January 2027', verifiedOn: '2026-01-01' };
  const t = homeStats([{ end: '2027-01-01', countryCode: 'AU', specialty: 'A', datesConfirmed: true, sourceUrl: 'https://x', ...ev }, { end: '2027-01-01', countryCode: 'AU', specialty: 'A', datesConfirmed: false }, { end: '2027-01-01', countryCode: 'NZ', specialty: 'B', datesConfirmed: false }], '2026-01-01');
  assert.deepEqual(t, { conferences: 3, countries: 2, specialties: 2, confirmed: 1, confirmedPct: 33, unchecked: 0, uncheckedPct: 0, estimated: 2 });
  const u = homeStats([{ end: '2027-01-01', datesConfirmed: true, legacyConfirmed: true, sourceUrl: 'https://x' }, { end: '2027-01-01', datesConfirmed: true, sourceUrl: 'https://x', ...ev, legacyConfirmed: true }], '2026-01-01');
  assert.equal(u.confirmed, 0, 'legacy rows are never counted as confirmed, even with partial evidence'); assert.equal(u.unchecked, 2);
  assert.equal(homeStats([], day).confirmedPct, 0);
  assert.equal(homeStats([{ end: '2020-01-01' }], day).conferences, 0, 'past events not counted');
});

test('home examples: upcoming, confirmed, one per specialty', () => {
  const ex = exampleConfs(confs(), '2026-11-11', 4);
  assert.equal(ex.length, 4);
  assert.equal(new Set(ex.map(c => c.specialty)).size, 4);
  for (const c of ex) { assert.ok(c.end >= '2026-11-11'); assert.notEqual(c.datesConfirmed, false); assert.match(c.sourceUrl, /^https:\/\//); }
});

test('date status (B30): confirmed needs stored evidence; legacy and evidence-less rows are "unchecked"', () => {
  const ev = { datesConfirmed: true, datesSourceUrl: 'https://a.org/c27', datesQuote: '3-5 May 2027', verifiedOn: '2026-11-17' };
  assert.equal(dateEvidence(ev), 'confirmed');
  assert.equal(dateEvidence({ ...ev, legacyConfirmed: true }), 'unchecked');
  assert.equal(dateEvidence({ ...ev, datesQuote: '' }), 'unchecked');
  assert.equal(dateEvidence({ datesConfirmed: true, sourceUrl: 'https://a.org' }), 'unchecked');
  assert.equal(dateEvidence({ ...ev, datesConfirmed: false }), 'estimated');
  const L = [{ id: 'a', start: '2027-01-01', end: '2027-01-02', specialty: 'A', sourceUrl: 'https://a', datesConfirmed: true, legacyConfirmed: true },
    { id: 'b', start: '2027-02-01', end: '2027-02-02', specialty: 'B', sourceUrl: 'https://b', ...ev }];
  assert.deepEqual(exampleConfs(L, '2026-11-17', 1).map(c => c.id), ['b'], 'rows with evidence come first');
  assert.deepEqual(exampleConfs(L, '2026-11-17', 2).map(c => c.id), ['b', 'a'], 'legacy rows only fill the row');
  const src = read('app.js');
  assert.match(src, /every\(c => dateEv\(c\) === 'confirmed'\) \? 'Coming up, dates confirmed' : 'Coming up'/, 'the examples heading only claims "dates confirmed" when every card has evidence');
  assert.match(src, /source not yet re-checked/);
});

test('travel links: prefilled Google Flights and Booking.com searches', () => {
  const c = { city: 'Wakayama', country: 'Japan', start: '2026-11-12', end: '2026-11-14' };
  const L = travelLinks(c, 'SYD');
  const f = new URL(L.flights); assert.equal(f.origin + f.pathname, 'https://www.google.com/travel/flights');
  assert.equal(f.searchParams.get('q'), 'Flights to Wakayama, Japan from SYD on 2026-11-12 through 2026-11-14');
  const h = new URL(L.hotels); assert.equal(h.hostname, 'www.booking.com');
  assert.equal(h.searchParams.get('ss'), 'Wakayama, Japan'); assert.equal(h.searchParams.get('checkin'), '2026-11-12'); assert.equal(h.searchParams.get('checkout'), '2026-11-14');
  assert.equal(new URL(travelLinks(c, '').flights).searchParams.get('q'), 'Flights to Wakayama, Japan on 2026-11-12 through 2026-11-14', 'no empty "from"');
  const one = travelLinks({ ...c, end: c.start }, 'MEL'); assert.equal(new URL(one.hotels).searchParams.get('checkout'), '2026-11-13', 'one-day event still books a night');
  assert.match(new URL(travelLinks({ ...c, start: '2027-12-31', end: '2027-12-31' }).hotels).searchParams.get('checkout'), /^2028-01-01$/);
});

test('every external link opens in a new tab with rel="noopener noreferrer"', () => {
  for (const f of ['app.js', 'admin.js', 'index.html', 'admin.html']) {
    const src = read(f), tags = src.match(/<a\s[^>]*>/g) || [];
    for (const tag of tags) {
      const external = /href="(https?:|\$\{esc\((safeUrl|L\.|c\.url|b\.url))/.test(tag) || /href="' \+ esc\((c|b)\.url/.test(tag) || /target="_blank"/.test(tag);
      if (!external) continue;
      assert.match(tag, /target="_blank"/, f + ': ' + tag.slice(0, 120));
      assert.match(tag, /rel="noopener noreferrer"/, f + ': ' + tag.slice(0, 120));
    }
  }
});

test('conference drawer fetches reviews once (the re-render must not refetch, or it loops)', () => {
  const src = read('app.js'), i = src.indexOf('function detail(id, fetchReviews = true)');
  assert.ok(i > 0, 'detail takes a fetchReviews flag');
  const body = src.slice(i, src.indexOf('\nfunction ', i + 10));
  assert.match(body, /NET\.online && fetchReviews\) loadReviews\(id\)/);
  assert.match(body, /detail\(id, false\)/);
  assert.doesNotMatch(body.replace(/detail\(id, false\)/g, ''), /loadReviews\(id\)\.then\([^)]*\)\s*=>[^;]*detail\(id\)/);
});

test('home copy: no superlatives or guarantees', () => {
  const src = read('app.js'), i = src.indexOf('  home() {'), body = src.slice(i, src.indexOf('  discover() {', i));
  assert.ok(body.length > 1000);
  assert.doesNotMatch(body, /\b(largest|leading|best|guarantee\w*|world's|number one|#1)\b/i);
  assert.match(body, /claim-ready/);
  assert.doesNotMatch(read('index.html'), /\b(largest|leading|best|guarantee\w*)\b/i);
});

test('every file the server publishes ships to Vercel', () => {
  const pub = read('server.js').match(/const PUBLIC = new Set\(\[([^\]]+)\]\)/)[1].match(/'([^']+)'/g).map(s => s.slice(1, -1));
  const inc = JSON.parse(read('vercel.json')).functions['api/index.js'].includeFiles;
  for (const f of pub) { const top = f.split('/')[0]; assert.ok(inc.includes(f) || inc.includes(top + '/**'), f + ' missing from vercel.json includeFiles'); }
  for (const m of read('index.html').match(/<script src="([^"]+)"/g)) { const f = m.slice(13, -1); assert.ok(pub.includes(f), f + ' is not in PUBLIC'); }
});

test('type: whole-pixel tokens, the system stack for text, Plex Condensed only for posters and the wordmark', () => {
  const css = read('styles.css');
  assert.doesNotMatch(css, /\d(\.\d+)?rem\b|clamp\(/, 'no rem or clamp maths in the stylesheet');
  for (const m of css.match(/font(-size)?:[^;}]*/g)) assert.doesNotMatch(m, /\d\.\d+px/, 'fractional size: ' + m);
  assert.match(css, /--font:-apple-system,BlinkMacSystemFont,"SF Pro Text"/);
  assert.doesNotMatch(css, /plex-sans-(400|600)/);
  assert.doesNotMatch(read('server.js').match(/const PUBLIC = new Set\(\[([^\]]+)\]\)/)[1], /plex-sans-(400|600)/, 'Plex Sans text files are not served');
  assert.doesNotMatch(read('index.html') + read('lib/pages.js'), /plex-sans-(400|600)/, 'nor preloaded');
  assert.doesNotMatch(read('server.js'), /demo-note/, 'the Preview line lives under You, not over the page');
});
