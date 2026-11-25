'use strict';
/* "Make a trip of it" (lib/trip.js): conference-first suggestions, the day plan and the work/personal split. */
const test = require('node:test'), assert = require('node:assert/strict');
const T = require('../lib/trip.js');

const SYD = { city: 'Sydney', countryCode: 'AU', lat: -33.87, lng: 151.21, radiusKm: 40 };
const EXP = [
  { id: 'vivid', place: SYD, title: 'Vivid Sydney 2027', category: 'festival-event', dateType: 'fixed-event', season: { dates: [{ start: '2027-05-28', end: '2027-06-19' }] }, summary: 'Lights' },
  { id: 'whales', place: SYD, title: 'Whale season', category: 'nature-wildlife', dateType: 'seasonal', season: { ranges: [{ from: '05-15', to: '11-30' }] }, summary: 'Whales', family: true },
  { id: 'wine', place: SYD, title: 'Wine weekend 2027', category: 'food-wine', dateType: 'fixed-event', season: { dates: [{ start: '2027-06-22', end: '2027-06-23' }] }, summary: 'Wine' }
];
const conf = (id, extra) => Object.assign({ id, name: id.toUpperCase(), city: 'Sydney', countryCode: 'AU', lat: -33.87, lng: 151.21, start: '2027-06-17', end: '2027-06-19', specialty: 'Anaesthesia', cpdHours: 0, cpdVerified: false }, extra || {});
const CONFS = [
  conf('a'), conf('b', { specialty: 'Cardiology', cpdHours: 12, cpdVerified: true, cpdBody: 'RACP' }),
  conf('ski', { city: 'Niseko', countryCode: 'JP', lat: 42.86, lng: 140.69, start: '2027-01-10', end: '2027-01-12', tags: ['destination', 'ski'] }),
  conf('past', { start: '2026-01-01', end: '2026-01-02' })
];
const ctx = { conferences: CONFS, experiences: EXP };
const ids = r => r.map(x => x.conference.id);

test('suggestTrips: conferences first (specialty, months, CPD), then what is on around them', () => {
  assert.deepEqual(ids(T.suggestTrips({ from: '2026-11-25', specialty: 'Anaesthesia' }, ctx)), ['a']);
  assert.deepEqual(ids(T.suggestTrips({ from: '2026-11-25', months: ['2027-06'] }, ctx)).sort(), ['a', 'b']);
  /* a CPD need only passes credits the organiser has stated; an experience never lifts a conference that fails it */
  assert.deepEqual(ids(T.suggestTrips({ from: '2026-11-25', cpdNeeds: { minHours: 10 } }, ctx)), ['b']);
  assert.deepEqual(ids(T.suggestTrips({ from: '2026-11-25', cpdNeeds: { minHours: 20 } }, ctx)), []);
  assert.ok(!ids(T.suggestTrips({ from: '2026-11-25' }, ctx)).includes('past'));
});
test('suggestTrips: interests narrow the matches; ski fits a meeting held at a ski resort; family takes family-flagged items', () => {
  const food = T.suggestTrips({ from: '2026-11-25', interests: ['food'], extraDays: 3 }, ctx);
  assert.deepEqual(ids(food).sort(), ['a', 'b']);
  assert.equal(food[0].matches[0].id, 'wine'); assert.match(food[0].line, /Wine weekend 2027 \(22–23 June?, \+3 days after\)/);
  assert.deepEqual(T.suggestTrips({ from: '2026-11-25', interests: ['food'], extraDays: 0 }, ctx), []);
  const ski = T.suggestTrips({ from: '2026-11-25', interests: ['Ski & snow'] }, ctx);
  assert.deepEqual(ids(ski), ['ski']); assert.match(ski[0].line, /held at a ski resort/);
  assert.equal(T.suggestTrips({ from: '2026-11-25', interests: ['family'], extraDays: 0 }, ctx)[0].matches[0].id, 'whales');
  assert.equal(T.headline(food[0].matches), '+ Wine weekend');
});
test('suggestTrips on the shipped data: ANZGOG in Adelaide with the Barossa Vintage Festival', () => {
  const r = T.suggestTrips({ from: '2026-11-25', interests: ['food'], limit: 0 });
  const a = r.find(x => x.conference.id === 'anzgog-asm-2027');
  assert.ok(a, 'ANZGOG is suggested for food and wine');
  assert.equal(a.matches[0].id, 'barossa-barossa-vintage-festival-2027'); assert.equal(a.matches[0].match.during, true);
});

const C = conf('x', { start: '2027-04-21', end: '2027-04-23' });
test('day plan: conference days are work, added days personal unless marked travel', () => {
  const ds = T.days(C, { before: 1, after: 2, travel: ['2027-04-20'] });
  assert.deepEqual(ds.map(d => d.kind), ['travel', 'work', 'work', 'work', 'personal', 'personal']);
  assert.deepEqual(ds.map(d => d.confDay), [0, 1, 2, 3, 0, 0]);
  assert.equal(T.hasPersonal(C, {}), false);
  assert.deepEqual(T.normPlan({ before: 99, after: -2, fares: 'nonsense' }), { before: 7, after: 0, travel: [], pins: [], fares: 'auto' });
});
test('fares: majority of days counts them as work, otherwise apportioned; the user can override', () => {
  assert.equal(T.fareRule(C, { after: 2 }).mode, 'work');
  assert.match(T.fareRule(C, { after: 2 }).text, /most days are work days \(3 of 5\)/);
  const f = T.fareRule(C, { before: 1, after: 2 });
  assert.equal(f.mode, 'apportion'); assert.equal(f.share, .5); assert.match(f.text, /3\/6/);
  assert.equal(T.fareRule(C, { before: 1, after: 2, fares: 'work' }).share, 1);
  assert.equal(T.fareRule(C, { after: 2, fares: 'personal' }).share, 0);
  /* travel days are left out of the count */
  assert.equal(T.fareRule(C, { before: 1, after: 3, travel: ['2027-04-20'] }).share, .5);
});
test('split: registration work, nights before each conference day, day costs by day, a typed personal portion wins', () => {
  const plan = { before: 1, after: 2 };
  assert.deepEqual(T.nights(C, plan).map(n => n.work), [true, true, true, false, false]);
  const s = T.split(C, plan, [{ category: 'Registration', amount: 900 }, { category: 'Accommodation', amount: 1000 }, { category: 'Flights', amount: 600 },
    { category: 'Meals', amount: 40, date: '2027-04-22' }, { category: 'Meals', amount: 60, date: '2027-04-25' }, { category: 'Meals', amount: 50, date: '2027-04-25', personal: 10 }]);
  assert.deepEqual(s.lines.map(l => l.work), [900, 600, 300, 40, 0, 40]);
  assert.equal(s.work, 1880); assert.equal(s.personal, 770);
  assert.deepEqual(s.personalDays, ['2027-04-20', '2027-04-24', '2027-04-25']);
  /* no personal days: everything is work, exactly as before trips had plans */
  assert.deepEqual(T.split(C, {}, [{ category: 'Flights', amount: 600 }]).lines.map(l => [l.work, l.personal]), [[600, 0]]);
  /* booking types map to receipt categories */
  assert.equal(T.splitItem(C, plan, { category: 'Hotel', amount: 1000 }).work, 600);
});
test('pins: an experience lands on the first overlapping day, a personal one where it can; widening reaches it', () => {
  const e = { match: { dates: { start: '2027-04-21', end: '2027-04-25' }, extraDaysBefore: 0, extraDaysAfter: 0 } };
  assert.equal(T.pinDay(C, { after: 2 }, e), '2027-04-24');
  assert.equal(T.pinDay(C, {}, e), '2027-04-21');
  assert.equal(T.slotOf(C, { kind: 'work' }), 'evening'); assert.equal(T.slotOf({ ...C, schedule: {} }, { kind: 'work' }), 'free time');
  assert.deepEqual(T.widenFor(C, { before: 1 }, { match: { extraDaysBefore: 0, extraDaysAfter: 3 } }), { before: 1, after: 3 });
});
