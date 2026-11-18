'use strict';
/* node --test tools/courses/x10/womens-gp-parsers.test.js — fixtures trimmed from the provider pages read on 2026-11-18 */
const test = require('node:test'), assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path');
const P = require('./womens-gp-parsers');
const fx = f => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');
const today = '2026-11-18';
const evidence = s => { assert.ok(/^https:\/\//.test(s.sourceUrl)); assert.ok(s.datesQuote && s.datesQuote.length <= 200); assert.strictEqual(s.datesConfirmed, true); assert.strictEqual(s.lastVerified, today); };

test('FSEP tribe feed: closed hospital sessions skipped, NZ mapped', () => {
  const r = P.parseTribe(JSON.parse(fx('womens-gp-fsep-tribe.json')), { url: 'https://fsep.ranzcog.edu.au/wp-json/tribe/events/v1/events', today, sourceKind: 'x',
    classify: (e, { desc, cf }) => /^For internal staff only/.test(desc) ? { skip: 'closed' } : { courseId: 'fsep-full-day', provider: 'FSEP', city: e.title.split(' ')[0], region: cf.Location === 'NZ' ? 'Bay of Plenty' : cf.Location, country: cf.Location === 'NZ' ? 'NZ' : 'AU' } });
  assert.strictEqual(r.sessions.length, 2); assert.strictEqual(r.skipped.length, 1);
  const nz = r.sessions.find(s => s.country === 'NZ'); assert.strictEqual(nz.start, '2026-11-20'); assert.strictEqual(nz.region, 'Bay of Plenty');
  r.sessions.forEach(evidence);
});
test('SCCA: practical workshop date is the session; fee read', () => {
  const r = P.parseScca(fx('womens-gp-scca.html'), { url: 'https://www.skincancercollege.org/EventDetail?EventKey=CSCM_FEB27', today });
  assert.strictEqual(r.sessions.length, 1); const s = r.sessions[0];
  assert.deepStrictEqual([s.start, s.end, s.city, s.region, s.priceFrom], ['2027-03-20', '2027-03-20', 'Sydney', 'NSW', 2930]); evidence(s);
});
test('AIU: one session per bookable date, end inferred from stated length', () => {
  const r = P.parseAiu(fx('womens-gp-aiu.html'), { url: 'https://www.aiu.edu.au/ultrasound-courses/msk/lower-limb-2day/', today, courseIdFor: () => 'aiu-msk' });
  assert.strictEqual(r.sessions.length, 4); const s = r.sessions[0];
  assert.deepStrictEqual([s.start, s.end, s.endInferred, s.priceFrom, s.city, s.region], ['2027-01-14', '2027-01-15', true, 2440, 'Gold Coast', 'QLD']); evidence(s);
});
test('SHINE SA: date start/end block', () => {
  const r = P.parseShine(fx('womens-gp-shine.html'), { url: 'https://shinesa.org.au/activity/srha/', today, classify: () => ({ courseId: 'srha' }) });
  assert.strictEqual(r.sessions.length, 1); assert.deepStrictEqual([r.sessions[0].start, r.sessions[0].end, r.sessions[0].seatsStatus], ['2027-06-07', '2027-06-11', 'open']); evidence(r.sessions[0]);
});
test('Healthed: city/title/date and venue block agree', () => {
  const r = P.parseHealthed(fx('womens-gp-healthed.html'), { url: 'https://www.healthed.com.au/events/swch27/', today });
  assert.strictEqual(r.sessions.length, 1); assert.deepStrictEqual([r.sessions[0].start, r.sessions[0].region], ['2027-05-01', 'NSW']); evidence(r.sessions[0]);
});
test('SHQ: date ranges with ordinal suffixes', () => {
  const r = P.parseShq(fx('womens-gp-shq.html'), { url: 'https://shq.org.au/course/certificate-nursing/', today, courseId: 'c', title: 'T' });
  assert.deepStrictEqual(r.sessions.map(s => [s.start, s.end]), [['2027-02-15', '2027-02-18'], ['2027-05-24', '2027-05-27'], ['2027-08-09', '2027-08-12']]);
});
test('SHV: year inferred from weekday, end from stated days', () => {
  const r = P.parseShv(fx('womens-gp-shv.html'), { url: 'https://www.shvic.org.au/courses/194/', today, courseId: 'srha', title: 'T' });
  assert.strictEqual(r.sessions.length, 1); assert.deepStrictEqual([r.sessions[0].start, r.sessions[0].end, r.sessions[0].endInferred], ['2027-08-02', '2027-08-05', true]);
});
test('SAPMEA: weekday picks the year; URL stamp conflicts are skipped', () => {
  const html = fx('womens-gp-sapmea.html');
  const ok = P.parseSapmea(html, { url: 'https://sapmea.asn.au/education/events/copd-management-and-spirometry-mount-gambier', today, classify: () => ({ courseId: 'copd' }) });
  assert.strictEqual(ok.sessions[0].start, '2026-11-23');
  const bad = P.parseSapmea(html, { url: 'https://sapmea.asn.au/education/events/copd-231125', today, classify: () => ({ courseId: 'copd' }) });
  assert.strictEqual(bad.sessions.length, 0);
});
