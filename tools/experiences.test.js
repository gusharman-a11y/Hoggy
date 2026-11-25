'use strict';
/* Unit tests for tools/experiences.js and tools/check-experiences.js, with small fixtures (node --test). */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const X = require('./experiences');
const { check } = require('./check-experiences');

const place = (city, cc, lat, lng, radiusKm, nearby) => ({ city, countryCode: cc, lat, lng, radiusKm, nearby: nearby || [] });
const SYD = place('Sydney', 'AU', -33.87, 151.21, 40);
const FIX = [
  { id: 'syd-whales', place: SYD, title: 'Whales', category: 'nature-wildlife', dateType: 'seasonal', season: { ranges: [{ from: '05-15', to: '11-30' }] } },
  { id: 'syd-vivid', place: SYD, title: 'Vivid', category: 'festival-event', dateType: 'fixed-event', season: { dates: [{ start: '2027-05-28', end: '2027-06-19' }] } },
  { id: 'syd-yearround', place: SYD, title: 'Zoo', category: 'family', dateType: 'seasonal', season: { ranges: [{ from: '01-01', to: '12-31' }] } },
  // southern-hemisphere summer that wraps the year end
  { id: 'tas-summer', place: place('Tasmania', 'AU', -42.0, 146.6, 260, ['Hobart']), title: 'Summer', category: 'hiking-outdoors', dateType: 'seasonal', season: { ranges: [{ from: '12-01', to: '02-28' }] } },
  // northern-hemisphere winter that wraps the year end
  { id: 'hok-ski', place: place('Hokkaido ski', 'JP', 43.06, 141.35, 160, ['Sapporo', 'Niseko']), title: 'Ski', category: 'ski-snow', dateType: 'seasonal', season: { ranges: [{ from: '12-01', to: '04-30' }] } },
  { id: 'lapland-aurora', place: place('Lapland', 'FI', 66.5, 25.73, 750, ['Helsinki']), title: 'Aurora', category: 'nature-wildlife', dateType: 'seasonal', season: { ranges: [{ from: '08-25', to: '04-15' }] } },
  { id: 'rwc', place: Object.assign({}, SYD, { radiusKm: 4500 }), title: 'RWC', category: 'sport-event', dateType: 'fixed-event', season: { dates: [{ start: '2027-10-01', end: '2027-11-13' }] } },
  { id: 'leap', place: SYD, title: 'Leap day', category: 'city-break', dateType: 'seasonal', season: { ranges: [{ from: '02-29', to: '02-29' }] } },
  { id: 'two-editions', place: place('Adelaide', 'AU', -34.93, 138.6, 40), title: 'WOMAD', category: 'festival-event', dateType: 'fixed-event', season: { dates: [{ start: '2027-03-05', end: '2027-03-08' }, { start: '2028-03-10', end: '2028-03-13' }] } }
];
const conf = (city, cc, lat, lng, start, end, extra) => Object.assign({ id: city.toLowerCase() + '-' + start, city, countryCode: cc, lat, lng, start, end }, extra || {});
const ids = r => r.map(e => e.id);
const run = (c, o) => X.experiencesFor(c, Object.assign({ experiences: FIX }, o || {}));

test('seasonal match inside the season, fixed events listed before seasons', () => {
  const r = run(conf('Sydney', 'AU', -33.87, 151.21, '2027-06-01', '2027-06-03'));
  assert.deepEqual(ids(r).slice(0, 2), ['syd-vivid', 'syd-whales']);
  assert.equal(r[0].match.kind, 'event'); assert.equal(r[0].match.during, true); assert.equal(r[0].match.extraDaysNeeded, 0);
  assert.ok(r.find(e => e.id === 'syd-yearround').match.score < r.find(e => e.id === 'syd-whales').match.score, 'year-round ranks below a real season');
});

test('extraDays widens the window and reports the days needed', () => {
  const c = conf('Sydney', 'AU', -33.87, 151.21, '2027-05-24', '2027-05-25');
  assert.ok(!ids(run(c)).includes('syd-vivid'), 'Vivid starts 3 days after the meeting ends');
  const r = run(c, { extraDays: 3 }).find(e => e.id === 'syd-vivid');
  assert.ok(r); assert.equal(r.match.during, false); assert.equal(r.match.extraDaysAfter, 3); assert.equal(r.match.overlapStart, '2027-05-28');
  assert.ok(!ids(run(c, { extraDays: 2 })).includes('syd-vivid'));
  assert.ok(ids(run(c, { extraDays: 99 })).includes('syd-vivid'), 'extraDays is capped at 7, still enough here');
  const far = conf('Sydney', 'AU', -33.87, 151.21, '2027-05-10', '2027-05-11');
  assert.ok(!ids(run(far, { extraDays: 99 })).includes('syd-vivid'), 'cap of 7 days holds');
});

test('southern summer wraps the year end (December and February both match, June does not)', () => {
  const hob = (s, e) => conf('Hobart', 'AU', -42.88, 147.33, s, e);
  assert.ok(ids(run(hob('2026-12-10', '2026-12-12'))).includes('tas-summer'));
  assert.ok(ids(run(hob('2027-02-20', '2027-02-22'))).includes('tas-summer'));
  assert.ok(ids(run(hob('2027-01-01', '2027-01-01'))).includes('tas-summer'), 'New Year\'s Day');
  assert.ok(!ids(run(hob('2027-06-10', '2027-06-12'))).includes('tas-summer'));
  const r = run(hob('2027-02-27', '2027-03-03')).find(e => e.id === 'tas-summer');
  assert.equal(r.match.dates.start, '2026-12-01'); assert.equal(r.match.dates.end, '2027-02-28');
});

test('northern winter wraps the year end; a meeting spanning New Year matches', () => {
  const sap = (s, e) => conf('Sapporo', 'JP', 43.06, 141.35, s, e);
  for (const [s, e] of [['2026-12-30', '2027-01-02'], ['2027-02-04', '2027-02-06'], ['2027-04-29', '2027-05-02']]) assert.ok(ids(run(sap(s, e))).includes('hok-ski'), s);
  assert.ok(!ids(run(sap('2027-07-01', '2027-07-03'))).includes('hok-ski'));
  assert.ok(!ids(run(sap('2027-05-04', '2027-05-06'), { extraDays: 3 })).includes('hok-ski'));
  assert.ok(ids(run(sap('2027-05-04', '2027-05-06'), { extraDays: 4 })).includes('hok-ski'), 'four days back reaches 30 April');
});

test('radius: Lapland aurora reaches Helsinki (about 700 km) but not Copenhagen', () => {
  assert.ok(ids(run(conf('Helsinki', 'FI', 60.17, 24.94, '2027-01-20', '2027-01-22'))).includes('lapland-aurora'));
  assert.ok(!ids(run(conf('Copenhagen', 'DK', 55.68, 12.57, '2027-01-20', '2027-01-22'))).includes('lapland-aurora'));
  const melb = run(conf('Melbourne', 'AU', -37.81, 144.96, '2027-06-01', '2027-06-02'));
  assert.ok(!ids(melb).includes('syd-whales'), 'Sydney (40 km radius) does not reach Melbourne');
  assert.ok(ids(run(conf('Melbourne', 'AU', -37.81, 144.96, '2027-10-20', '2027-10-22'))).includes('rwc'), 'national event radius');
  const national = [Object.assign({}, FIX.find(e => e.id === 'rwc'), { place: Object.assign({}, SYD, { radiusKm: 4500, sameCountry: true }) })];
  assert.ok(!ids(run(conf('Auckland', 'NZ', -36.85, 174.76, '2027-10-20', '2027-10-22'), { experiences: national })).includes('rwc'), 'sameCountry keeps a host-country event out of NZ');
  assert.ok(ids(run(conf('Perth', 'AU', -31.95, 115.86, '2027-10-20', '2027-10-22'), { experiences: national })).includes('rwc'));
});

test('a row with wrong coordinates still matches by city name (same country only)', () => {
  const wrong = conf('Sapporo', 'JP', 35.18, 136.91, '2027-01-10', '2027-01-12'); // Nagoya's coordinates
  const r = run(wrong).find(e => e.id === 'hok-ski');
  assert.ok(r); assert.equal(r.match.placeMatchedBy, 'name'); assert.equal(r.match.distanceKm, null);
  assert.ok(!ids(run(conf('Sapporo', 'US', 0, 0, '2027-01-10', '2027-01-12'))).includes('hok-ski'), 'different country');
  assert.ok(ids(run(conf('Washington, DC', 'US', 0, 0, '2027-04-01', '2027-04-01'), { experiences: [{ id: 'dc', place: place('Washington DC', 'US', 38.9, -77.0, 40), category: 'city-break', dateType: 'seasonal', season: { ranges: [{ from: '03-01', to: '04-30' }] } }] })).includes('dc'));
});

test('a row carrying another city\'s coordinates is placed at its own city when the dataset knows it', () => {
  const list = [
    { id: 'gc-city', place: place('Gold Coast', 'AU', -28.02, 153.40, 40), category: 'beach-surf', dateType: 'seasonal', season: { ranges: [{ from: '01-01', to: '12-31' }] } },
    { id: 'melb-event', place: place('Albert Park', 'AU', -37.85, 144.97, 60, ['Melbourne']), category: 'sport-event', dateType: 'fixed-event', season: { dates: [{ start: '2027-04-01', end: '2027-04-04' }] } }
  ];
  const gc = conf('Gold Coast', 'AU', -37.81, 144.96, '2027-04-02', '2027-04-06'); // Melbourne's coordinates
  const r = X.experiencesFor(gc, { experiences: list });
  assert.deepEqual(ids(r), ['gc-city']);
  assert.equal(r[0].match.locationCorrected, true);
});

test('multi-day event overlapping only the last conference day, and multiple editions', () => {
  const r = run(conf('Sydney', 'AU', -33.87, 151.21, '2027-06-19', '2027-06-21')).find(e => e.id === 'syd-vivid');
  assert.equal(r.match.during, true); assert.equal(r.match.overlapStart, '2027-06-19'); assert.equal(r.match.overlapEnd, '2027-06-19');
  const a = conf('Adelaide', 'AU', -34.93, 138.6, '2028-03-12', '2028-03-14');
  assert.equal(run(a).find(e => e.id === 'two-editions').match.dates.start, '2028-03-10');
});

test('29 February season falls back to 28 February in a common year', () => {
  assert.ok(ids(run(conf('Sydney', 'AU', -33.87, 151.21, '2027-02-28', '2027-02-28'))).includes('leap'));
  assert.ok(ids(run(conf('Sydney', 'AU', -33.87, 151.21, '2028-02-29', '2028-02-29'))).includes('leap'));
});

test('categories filter and bad input', () => {
  const c = conf('Sydney', 'AU', -33.87, 151.21, '2027-06-01', '2027-06-03');
  assert.deepEqual(ids(run(c, { categories: ['nature-wildlife'] })), ['syd-whales']);
  assert.deepEqual(run({}), []); assert.deepEqual(run(null), []);
});

test('bestTrips ranks conferences by fit with the interests', () => {
  const confs = [
    conf('Sydney', 'AU', -33.87, 151.21, '2027-06-01', '2027-06-03', { id: 'a' }),
    conf('Sapporo', 'JP', 43.06, 141.35, '2027-02-04', '2027-02-06', { id: 'b' }),
    conf('Hobart', 'AU', -42.88, 147.33, '2027-06-10', '2027-06-12', { id: 'c' }),
    conf('Sapporo', 'JP', 43.06, 141.35, '2025-02-04', '2025-02-06', { id: 'past' })
  ];
  const ski = X.bestTrips(confs, ['ski-snow'], { experiences: FIX, from: '2026-11-25' });
  assert.deepEqual(ski.map(t => t.conference.id), ['b']);
  const any = X.bestTrips(confs, [], { experiences: FIX, from: '2026-11-25' });
  assert.equal(any[0].conference.id, 'a', 'Vivid (fixed event) plus whales beats a single season');
  assert.ok(!any.some(t => t.conference.id === 'past'));
  assert.ok(any.every(t => t.matches.length <= 5));
});

test('check-experiences: fixture rules', () => {
  const good = { id: 'ok-one', place: Object.assign({}, SYD), title: 'Whale watching', category: 'nature-wildlife', dateType: 'seasonal', season: { ranges: [{ from: '05-15', to: '11-30' }] },
    summary: 'Humpbacks pass the coast.', sourceUrl: 'https://www.sydney.com/x', sourceQuote: 'Each year from May to November', verifiedOn: '2026-11-25' };
  assert.deepEqual(check({ experiences: [good] }).errors, []);
  const bad = (patch, re) => { const r = check({ experiences: [Object.assign({}, good, patch)] }).errors; assert.ok(r.some(e => re.test(e)), JSON.stringify(patch) + ' -> ' + r.join('; ')); };
  bad({ sourceUrl: 'http://www.sydney.com/x' }, /https/);
  bad({ sourceUrl: 'https://www.tripadvisor.com/x' }, /listing/);
  bad({ category: 'shopping' }, /vocabulary/);
  bad({ sourceQuote: '' }, /missing sourceQuote/);
  bad({ sourceQuote: 'x'.repeat(201) }, /max 200/);
  bad({ summary: 'The best whale watching.' }, /copy lint/);
  bad({ summary: 'See the colors.' }, /US spelling/);
  bad({ summary: 'y'.repeat(161) }, /max 160/);
  bad({ dateType: 'fixed-event' }, /exact dates/);
  bad({ season: { ranges: [{ from: '02-30', to: '03-01' }] } }, /MM-DD/);
  bad({ dateType: 'fixed-event', season: { dates: [{ start: '2027-02-30', end: '2027-03-01' }] } }, /bad date/);
  bad({ dateType: 'fixed-event', season: { dates: [{ start: '2027-03-02', end: '2027-03-01' }] } }, /before it starts/);
  bad({ verifiedOn: '25/11/2026' }, /ISO/);
  assert.ok(check({ experiences: [good, good] }).errors.some(e => /duplicate/.test(e)));
});

test('the shipped dataset passes the validator and matches real conferences', () => {
  const file = path.join(__dirname, '..', 'data', 'experiences', 'experiences.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(check(doc).errors, []);
  assert.ok(doc.experiences.length >= 300, 'dataset has ' + doc.experiences.length);
  const rwc = X.experiencesFor({ city: 'Brisbane', countryCode: 'AU', lat: -27.47, lng: 153.03, start: '2027-10-20', end: '2027-10-22' });
  assert.ok(rwc.some(e => /rugby-world-cup-2027/.test(e.id)));
});
