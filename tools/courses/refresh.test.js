'use strict';
/* End to end on the saved fixtures: tools/refresh-courses.js --dry --from fixtures (no network, nothing written). */
const test = require('node:test'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process'), path = require('node:path'), fs = require('node:fs');
const ROOT = path.join(__dirname, '..', '..');

test('refresh --dry --from fixtures: partial pages are not taken as cancellations; missing pages keep old rows', () => {
  const ses = path.join(ROOT, 'data', 'courses', 'sessions.json'), before = fs.readFileSync(ses, 'utf8');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'refresh-courses.js'), '--dry', '--quiet', '--from', path.join(__dirname, 'fixtures'), '--today', JSON.parse(before).generated], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^# Course refresh /m);
  assert.match(r.stdout, /ARC course-dates page \| suspicious: \d+ sessions vs \d+ held; kept old rows/, 'a 9-row ARC page must not drop hundreds of sessions');
  assert.match(r.stdout, /ACRRM advanced-neonatal-resuscitation \| failed: not in saved set/);
  assert.match(r.stdout, /refresh \d{4}-\d{2}-\d{2}: added \d+, updated \d+, unchanged \d+, removed \d+, kept \d+/);
  assert.equal(fs.readFileSync(ses, 'utf8'), before, '--dry writes nothing');
});
