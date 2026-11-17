'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const nzda = require('./nzda');
const fx = f => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');

test('nzda search: only CORE event pages', () => {
  const urls = nzda.parseSearch(fx('nzda-search.html'));
  assert.equal(urls.length, 4);
  assert.ok(urls.every(u => /core-(advanced|immediate)/.test(u)));
});

test('nzda event pages: date, venue, region, provider, enrol link', () => {
  const a = nzda.parseEvent(fx('nzda-core-advanced-206.html'), nzda.BASE + 'core-advanced-206', { today: '2026-11-17' }).session;
  assert.deepEqual([a.courseId, a.start, a.region, a.provider, a.country], ['nzrc-core-advanced', '2026-11-21', 'Wellington', 'Emcare Services Limited', 'NZ']);
  assert.equal(a.bookingUrl, 'https://www.emcare.co.nz/nzrc-core-advanced.html');
  assert.match(a.datesQuote, /^Saturday 21st Nov 2026 \| 8:30am - 5:00pm/);
  const i = nzda.parseEvent(fx('nzda-auckland-nzrc-core-immediate-8.html'), nzda.BASE + 'auckland-nzrc-core-immediate-8', { today: '2026-11-17' }).session;
  assert.deepEqual([i.courseId, i.city, i.provider], ['nzrc-core-immediate', 'Auckland', 'Triple One Care Ltd']);
  assert.equal(nzda.parseEvent(fx('nzda-core-advanced-206.html'), nzda.BASE + 'x', { today: '2027-01-01' }).skip.reason, 'finished');
});
