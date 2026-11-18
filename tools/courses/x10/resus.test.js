'use strict';
/* Offline tests for the x10 resus parsers (fixtures trimmed from pages read on 2026-11-18). node --test tools/courses/x10/resus.test.js */
const test = require('node:test'), assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path');
const F = f => fs.readFileSync(path.join(__dirname, 'fixtures', 'resus', f), 'utf8');
const today = '2026-11-18';

test('ACCCN tiles -> course/variant/dates/state', () => {
  const { sessions } = require('./resus-acccn').parse(F('acccn.html'), { today });
  assert.ok(sessions.length >= 3);
  const s = sessions.find(x => x.sourceRef === 'acccn:11396');
  assert.deepStrictEqual([s.courseId, s.variant, s.region, s.city, s.start, s.end], ['acccn-adult-als', 'full', 'VIC', 'Werribee', '2026-11-26', '2026-11-27']);
  const i = sessions.find(x => x.sourceRef === 'acccn:11054');
  assert.deepStrictEqual([i.courseId, i.variant, i.start, i.end], ['acccn-als-instructor', 'recertification', '2026-11-21', '2026-11-21']);
  assert.strictEqual(require('./resus-acccn').dates('31 January & 1 February 2027').end, '2027-02-01');
});

test('PRIME rows: 5-day initial course, waitlist link', () => {
  const { sessions } = require('./resus-prime').parse(F('prime.html'), { today });
  const c = sessions.find(x => x.city === 'Christchurch');
  assert.deepStrictEqual([c.variant, c.start, c.end, c.region, c.seatsStatus], ['full', '2026-11-23', '2026-11-27', 'Canterbury', 'waitlist']);
  assert.match(c.bookingUrl, /^https:\/\/prime\.stjohn\.org\.nz\/booking\.aspx\?id=\d+$/);
});

test('Arlo: rules map events, others skipped, NZ region', () => {
  const src = { account: 'resuscitationmatters', provider: 'Resuscitation Matters Ltd', country: 'NZ', sourceKind: 'x',
    rules: [{ re: /^Advanced Resuscitation Course/i, courseId: 'nzrc-core-advanced', variant: 'full' }, { re: /^Advanced Cardiac Life Support/i, courseId: 'nz-acls', variant: 'full' }] };
  const r = require('./resus-arlo').parse(JSON.parse(F('arlo-resuscitationmatters.json')), src, { today });
  assert.ok(r.sessions.length >= 2 && r.skipped.length >= 1);
  for (const s of r.sessions) { assert.strictEqual(s.region, 'Canterbury'); assert.strictEqual(s.currency, 'NZD'); assert.ok(s.priceFrom > 0); assert.match(s.sourceRef, /^arlo:resuscitationmatters:\d+$/); }
});

test('CTEC: visible dates, sold out -> full, Eventbrite booking link', () => {
  const c = require('./resus-ctec'), u = 'https://www.ctec.uwa.edu.au/workshops/jdocs-emergency-airways';
  const { sessions } = c.parse(F('ctec-jdocs-emergency-airways.html'), { today, sourceUrl: u, courseId: 'ctec-jdocs-emergency-airways' });
  assert.deepStrictEqual(sessions.map(s => s.start), ['2026-11-27', '2027-02-26', '2027-06-25', '2027-11-26']);
  assert.strictEqual(sessions[0].seatsStatus, 'full');
  assert.match(sessions[2].bookingUrl, /^https:\/\/www\.eventbrite\.com\.au\//);
  assert.deepStrictEqual([c.fees(F('ctec-jdocs-emergency-airways.html')).min, c.fees(F('ctec-jdocs-emergency-airways.html')).max], [890, 1000]);
});

test('SPUMS: two ANZ courses, comma-separated ranges', () => {
  const { sessions } = require('./resus-spums').parse(F('spums.html'), { today });
  assert.deepStrictEqual(sessions.map(s => [s.courseId, s.start, s.end]), [
    ['diving-hyperbaric-intro', '2027-04-26', '2027-05-07'], ['ran-moum', '2027-03-08', '2027-03-19'], ['ran-moum', '2027-10-11', '2027-10-22']]);
});

test('RescueMED: Dates line with two ranges', () => {
  const R = require('./resus-rescuemed');
  const { sessions } = R.parse(F('rescuemed-canyon.html'), R.PAGES[0], { today });
  assert.deepStrictEqual(sessions.map(s => [s.start, s.end]), [['2027-03-08', '2027-03-12'], ['2027-10-25', '2027-10-29']]);
});

test('ACRRM RACM table -> one-day sessions with endInferred and CPD', () => {
  const { sessions } = require('./resus-acrrm').parse(F('acrrm-racm.html'), 'racm', { today });
  assert.ok(sessions.length >= 1);
  for (const s of sessions) { assert.strictEqual(s.courseId, 'acrrm-racm'); assert.strictEqual(s.endInferred, true); assert.strictEqual(s.cpdHours, 16); assert.strictEqual(s.priceFrom, 1635); }
});
