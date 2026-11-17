'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const arc = require('./arc');
const HTML = fs.readFileSync(path.join(__dirname, 'fixtures', 'arc-course-dates.html'), 'utf8');

test('arc: every row layout on the real page', () => {
  const r = arc.parse(HTML, { today: '2026-11-17' });
  const by = id => { const s = r.sessions.find(x => x.id === id); assert.ok(s, 'missing ' + id + ' in ' + r.sessions.map(x => x.id)); return s; };
  const full = by('als1-act-braddon-2026-12-04-code-blue-medical'); /* Starts/Ends/Location layout */
  assert.deepEqual([full.start, full.end, full.endInferred, full.region], ['2026-12-04', '2026-12-04', false, 'ACT']);
  assert.equal(full.bookingUrl, 'https://v2.rtopilot.com.au/enrol/CBM/courses');
  const two = by('als2-act-canberra-2027-02-13-parasol-emt-pty-ltd'); /* date-only row, "2-Day Course" in title */
  assert.deepEqual([two.end, two.endInferred], ['2027-02-14', true]);
  const rc = by('als2-recert-nsw-sydney-2027-02-10-parasol-emt-pty-ltd');
  assert.deepEqual([rc.variant, rc.end, rc.endInferred], ['recertification', '2027-02-10', true]);
  const sl = r.sessions.find(s => /safelinks/.test(s.bookingUrlNote || ''));
  assert.ok(sl && !/safelinks/.test(sl.bookingUrl), 'safelinks unwrapped');
  const sj = by('als1-wa-belmont-2026-11-24-st-john-wa');
  assert.equal(sj.bookingUrl, 'https://www.stjohnwa.com.au/first-aid-training/als1-course', 'tracking (and the stray e-mail) removed');
  const gee = by('als2-vic-geelong-2026-11-24-revise-simulation-centre'); /* "Course Cemtre" typo, mailto only */
  assert.equal(gee.provider, 'ReVISE Simulation Centre'); assert.equal(gee.bookingUrl, arc.SOURCE_URL);
  assert.ok(r.skipped.some(x => x.reason === 'no start date' && /Sunday 1 Nov/.test(x.dateCell)), 'a date with no year is reported, not guessed');
  assert.ok(!r.sessions.some(s => s.start < '2026-01-01'), 'past rows dropped');
  for (const s of r.sessions) { assert.equal(s.sourceUrl, arc.SOURCE_URL); assert.ok(s.datesQuote.length > 10); assert.match(s.bookingUrl, /^https:\/\//); }
});

test('arc: header-only page gives nothing', () => {
  assert.deepEqual(arc.parse('<table><tr><td><h5>Course Date</h5></td><td>x</td></tr></table>', { today: '2026-11-17' }).sessions, []);
});
