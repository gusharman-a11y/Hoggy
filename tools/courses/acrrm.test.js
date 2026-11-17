'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const acrrm = require('./acrrm');
const fx = f => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');
const T = '2026-11-17';

test('acrrm REST: seats, waitlist, fees, CPD, two-day end inferred', () => {
  const src = acrrm.BASE + 'rest', { sessions } = acrrm.parse(fx('acrrm-rest.html'), { today: T, sourceUrl: src });
  assert.equal(sessions.length, 3);
  const [syd, bne] = sessions;
  assert.deepEqual([syd.courseId, syd.start, syd.end, syd.endInferred, syd.seatsStatus, syd.placesRemaining], ['acrrm-rest', '2026-11-26', '2026-11-27', true, 'waitlist', 0]);
  assert.deepEqual([syd.priceFrom, syd.currency, syd.cpdHours, syd.cpdSource], [3630, 'AUD', 28, src]);
  assert.equal(syd.bookingUrl, 'https://mycollege.acrrm.org.au/search/find-college-event/details?ID=41835'); assert.equal(syd.sourceRef, 'acrrm:41835');
  assert.equal(bne.venue, 'ACRRM Head Office, Level 1, 324 Queen Street, Brisbane'); assert.equal(bne.city, 'Brisbane');
});

test('acrrm paediatric: end date read from the title range', () => {
  const { sessions } = acrrm.parse(fx('acrrm-paediatric-emergencies.html'), { today: T });
  assert.deepEqual(sessions.map(s => [s.start, s.end, s.endInferred]), [['2026-12-06', '2026-12-07', false], ['2027-01-27', '2027-01-28', false]]);
});

test('acrrm REOT and ALS2: one day, airport venue gives city Sydney, ALS2 ids unchanged', () => {
  const reot = acrrm.parse(fx('acrrm-reot.html'), { today: T }).sessions;
  assert.equal(reot[0].city, 'Sydney'); assert.match(reot[0].venue, /Rydges Sydney Airport/); assert.equal(reot[0].end, reot[0].start);
  assert.equal(reot[1].seatsStatus, 'waitlist');
  const als = acrrm.parse(fx('acrrm-als.html'), { today: T }).sessions;
  assert.equal(als[0].id, 'als2-acrrm-nsw-sydney-2026-11-25'); assert.equal(als[0].variant, 'acrrm-one-day');
});

test('acrrm: rows for courses not in scope are skipped', () => {
  const html = fx('acrrm-reot.html').replace(/Rural Emergency Obstetrics Training \(REOT\)/g, 'Advanced Airway');
  const r = acrrm.parse(html, { today: T });
  assert.equal(r.sessions.length, 0); assert.ok(r.skipped.every(x => x.reason === 'course not in scope'));
});
