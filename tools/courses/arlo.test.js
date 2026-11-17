'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const arlo = require('./arlo'), FX = require('./fixtures/arlo-eventsearch.json');

test('arlo: APLS events from the real feed (trimmed)', () => {
  const { sessions } = arlo.parse(FX, { today: '2026-11-17' });
  assert.equal(sessions.length, 3);
  const ref = sessions.find(s => s.variant === 'refresher');
  assert.equal(ref.id, 'apls-refresher-vic-melbourne-2026-12-02');
  assert.deepEqual([ref.start, ref.end, ref.seatsStatus, ref.priceFrom, ref.currency], ['2026-12-02', '2026-12-03', 'waitlist', 2120, 'AUD']);
  assert.match(ref.bookingUrl, /^https:\/\/apls\.arlo\.co\/waiting-list/);
  assert.equal(ref.sourceRef, 'arlo:1786');
  const open = sessions.find(s => s.seatsStatus === 'open');
  assert.ok(open.placesRemaining > 0);
  const lst = sessions.find(s => /launceston/.test(s.id));
  assert.equal(lst.city, 'Launceston', 'city from the event name, venue string kept as given');
  for (const s of sessions) { assert.equal(s.datesConfirmed, true); assert.equal(s.sourceUrl, arlo.SOURCE_URL); assert.match(s.datesQuote, /StartDateTime \d{4}-\d{2}-\d{2}T/); }
});

test('arlo: finished events are skipped, unknown templates reported', () => {
  const r = arlo.parse(FX, { today: '2027-06-01' });
  assert.equal(r.sessions.length, 0); assert.ok(r.skipped.every(x => x.reason === 'finished'));
  const odd = arlo.parse({ Items: [{ Name: 'GIC - Sydney 1 Mar 2027', StartDateTime: '2027-03-01T08:00', EndDateTime: '2027-03-01T17:00' }] }, { today: '2026-11-17' });
  assert.equal(odd.sessions.length, 0); assert.equal(odd.skipped[0].reason, 'unknown course');
  assert.deepEqual(arlo.classify({ Name: 'PLS - Perth 3 Mar 2027' }), { courseId: 'pls', variant: 'full' });
});
