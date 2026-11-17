'use strict';
/* B30: the evidence rule (tools/evidence.js), the validator (tools/validate-data.js) and the merge step's downgrade
   (tools/merge-shards.js). The validator must pass on the shipped data and fail on each seeded bad row. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const E = require('../tools/evidence');
const { rowProblems } = require('../tools/validate-data');
const ROOT = path.join(__dirname, '..'), DAY = '2026-11-17';
const node = (...a) => spawnSync(process.execPath, a, { cwd: ROOT, encoding: 'utf8' });

const GOOD = { id: 'abc-congress-2027', name: 'ABC Congress 2027', organiser: 'ABC Society', specialty: 'Cardiology', city: 'Porto', country: 'Portugal', countryCode: 'PT', region: 'Europe', lat: 41.15, lng: -8.61, start: '2027-03-12', end: '2027-03-14', format: 'In-person', cpdHours: 0, cpdBody: '', priceFrom: 0, attendees: 0, url: 'https://www.abc.example', blurb: 'Annual congress.', datesConfirmed: true, dateStatus: 'confirmed', sourceUrl: 'https://congress.abc.example/2027', datesSourceUrl: 'https://congress.abc.example/2027', datesQuote: '12–14 March 2027, Porto', verifiedOn: '2026-11-17' };
const errs = r => rowProblems(r, DAY).filter(p => p.level === 'error').map(p => p.msg);

test('evidence rule: all three fields, https, not a site root, organiser domain or allowlist, short quote with the dates', () => {
  assert.equal(E.evidenceProblem(GOOD, { today: DAY }), null);
  const bad = {
    'missing datesQuote': { datesQuote: '' }, 'not https': { datesSourceUrl: 'http://congress.abc.example/2027' },
    'site root': { datesSourceUrl: 'https://congress.abc.example/' }, 'site root (language)': { datesSourceUrl: 'https://www.abc.example/en/' },
    'aggregator': { datesSourceUrl: 'https://10times.com/abc-congress' }, 'organiser': { datesSourceUrl: 'https://abc-congress.example/2027' },
    'longer than 200': { datesQuote: '12–14 March 2027 ' + 'x'.repeat(200) }, 'start day': { datesQuote: '13–14 March 2027' },
    'future': { verifiedOn: '2026-12-01' }, 'ISO': { verifiedOn: '17/11/2026' }
  };
  for (const [k, ch] of Object.entries(bad)) assert.match(String(E.evidenceProblem({ ...GOOD, ...ch }, { today: DAY })), new RegExp(k.replace(/ \(.*\)/, '').split(' ')[0], 'i'), k);
  assert.equal(E.evidenceProblem({ ...GOOD, url: 'https://10times.com/abc', datesSourceUrl: 'https://10times.com/abc/2027' }, { today: DAY }) !== null, true, 'an aggregator url never vouches for itself');
  assert.equal(E.evidenceProblem({ ...GOOD, url: 'https://www.ranzcog.edu.au', datesSourceUrl: 'https://ranzcog.eventsair.com/ranzcog-2027-regional-symposium/key-dates', datesQuote: '12-14 March 2027' }, { today: DAY }), null, 'allowlisted platform host');
  assert.notEqual(E.evidenceProblem({ ...GOOD, url: 'https://lornegenome.org', datesSourceUrl: 'https://web.cvent.com/event/another-event/summary' }, { today: DAY }), null, 'a platform entry is limited to its path');
  assert.equal(E.registrable('asm.asohns.org.au'), 'asohns.org.au'); assert.equal(E.registrable('events.aats.org'), 'aats.org'); assert.equal(E.registrable('site2.convention.co.jp'), 'convention.co.jp');
  assert.ok(E.isSiteRoot('https://x.org') && E.isSiteRoot('https://x.org/index.html') && E.isSiteRoot('https://x.org/pt-br/') && !E.isSiteRoot('https://x.org/asm') && !E.isSiteRoot('https://x.org/?p=12'));
});

test('tools/official-domains.json: every entry has a host, the rows it is for and a note', () => {
  const J = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'official-domains.json'), 'utf8'));
  for (const e of J.official) { assert.match(e.host, /^[a-z0-9.-]+\.[a-z]{2,}$/, JSON.stringify(e)); assert.ok(Array.isArray(e.for) && e.for.length && e.note, e.host); }
  for (const a of J.aggregators) assert.ok(!J.official.some(e => e.host === a || e.host.endsWith('.' + a)), a + ' is both official and an aggregator');
});

test('validator: rows that break a rule are errors', () => {
  assert.deepEqual(errs(GOOD), []);
  const cases = [
    [{ datesQuote: undefined }, /confirmed without valid evidence: missing datesQuote/], [{ datesSourceUrl: 'https://www.abc.example/' }, /site root/],
    [{ legacyConfirmed: true, datesSourceUrl: 'https://www.abc.example/' }, /site root/], [{ datesConfirmed: false, dateStatus: 'estimated', legacyConfirmed: true }, /legacyConfirmed on an estimated row/],
    [{ end: '2027-03-10' }, /end before start/], [{ start: '2027-3-12' }, /start is not an ISO date/], [{ url: 'http://www.abc.example' }, /url is not https/],
    [{ specialty: 'Cardio' }, /not canonical/], [{ countryCode: 'XX' }, /not an ISO 3166 code/], [{ blurb: 'The largest congress.' }, /copy lint/],
    [{ name: '' }, /missing name/], [{ lat: 123 }, /bad lat/]];
  for (const [ch, re] of cases) assert.ok(errs({ ...GOOD, ...ch }).some(m => re.test(m)), `${JSON.stringify(ch)} -> ${errs({ ...GOOD, ...ch }).join('; ')}`);
  assert.deepEqual(errs({ ...GOOD, datesSourceUrl: undefined, datesQuote: undefined, verifiedOn: undefined, legacyConfirmed: true }), [], 'legacy rows are allowed (warning in the summary)');
  assert.deepEqual(errs({ ...GOOD, datesQuote: 'Le congrès le plus important: 12–14 March 2027' }).filter(m => /copy/.test(m)), [], 'the organiser\'s quote is not linted as Hoggy copy');
});

function tmpRoot(rows, shards = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-'));
  fs.mkdirSync(path.join(dir, 'data', 'shards'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'data', 'conferences.js'), 'window.HOGGY_CONFERENCES = ' + JSON.stringify(rows, null, 1) + ';\n');
  for (const [f, v] of Object.entries(shards)) fs.writeFileSync(path.join(dir, 'data', 'shards', f), typeof v === 'string' ? v : JSON.stringify(v));
  return dir;
}
const load = dir => { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(dir, 'data', 'conferences.js'), 'utf8'), ctx); return ctx.window.HOGGY_CONFERENCES; };

test('validator CLI: exits 0 on the shipped data, non-zero on a seeded bad row, duplicates, spellings and bad shards', () => {
  const ok = node('tools/validate-data.js');
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /confirmed \d+: with evidence \d+, legacy \(source not yet re-checked\) \d+/);
  assert.match(ok.stdout, /confirmed rows whose source is a site root: \d+/); assert.match(ok.stdout, /errors: 0/);
  const B = { ...GOOD, id: 'xyz-meeting-2027', name: 'XYZ Meeting 2027', organiser: 'XYZ', start: '2027-05-03', end: '2027-05-04', datesQuote: '3-4 May 2027', datesSourceUrl: 'https://www.abc.example/xyz-2027' };
  const seeded = [
    [[GOOD, { ...B, datesQuote: undefined }], /missing datesQuote/],
    [[GOOD, { ...GOOD }], /duplicate id/],
    [[GOOD, { ...GOOD, id: 'abc-congress-2027-b' }], /same series and start/],
    [[GOOD, { ...B, country: 'Portugal (PT)' }], /countryCode PT has 2 country names/],
    [[GOOD, B], null, { 'bad.json': '[{"id": ' }, /unparseable/],
    [[GOOD, B], null, { 'provenance-dates-2026-11-17.json': [{ id: 'xyz-meeting-2027', verified: true, start: '2027-05-03', end: '2027-05-04', datesSourceUrl: 'https://elsewhere.example/xyz', datesQuote: '3-4 May 2027', verifiedOn: DAY }] }, /evidence breaks the rule: datesSourceUrl host elsewhere\.example/]
  ];
  for (const [rows, re, shards, re2] of seeded) {
    const r = node('tools/validate-data.js', '--root', tmpRoot(rows, shards || {}), '--today', DAY);
    assert.equal(r.status, 1, 'should fail: ' + (re || re2)); assert.match(r.stdout, re || re2);
  }
  const fine = node('tools/validate-data.js', '--root', tmpRoot([GOOD, B]), '--today', DAY); assert.equal(fine.status, 0, fine.stdout);
});

test('merge: confirmed rows without valid evidence become estimates with a reason (data kept); legacy rows stay; migration runs once', () => {
  const legacy = { ...GOOD, id: 'leg-meeting-2027', name: 'LEG Meeting 2027', start: '2027-06-01', end: '2027-06-02', datesSourceUrl: undefined, datesQuote: undefined, verifiedOn: undefined, lastVerified: '2026-11-07' };
  const noEv = { ...legacy, id: 'new-meeting-2027', name: 'NEW Meeting 2027', start: '2027-07-01', end: '2027-07-02' };
  const wrongHost = { ...GOOD, id: 'wh-meeting-2027', name: 'WH Meeting 2027', start: '2027-08-03', end: '2027-08-04', datesSourceUrl: 'https://other.example/wh', datesQuote: '3-4 August 2027' };
  const dir = tmpRoot([GOOD, legacy, noEv, wrongHost].map(r => JSON.parse(JSON.stringify(r))));
  const mig = node('tools/merge-shards.js', '--root', dir, '--today', DAY, '--migrate-legacy'); assert.equal(mig.status, 0, mig.stderr);
  let L = load(dir), by = id => L.find(c => c.id === id);
  assert.equal(by('leg-meeting-2027').legacyConfirmed, true); assert.equal(by('new-meeting-2027').legacyConfirmed, true, 'migration marks every evidence-less confirmed row');
  assert.equal(by('wh-meeting-2027').datesConfirmed, false, 'partial or wrong evidence is never legacy');
  assert.match(by('wh-meeting-2027').estimateReason, /not the organiser's domain/); assert.equal(by('wh-meeting-2027').datesQuote, '3-4 August 2027', 'evidence kept for review');
  assert.equal(by('abc-congress-2027').datesConfirmed, true); assert.equal(by('abc-congress-2027').legacyConfirmed, undefined);
  assert.equal(node('tools/merge-shards.js', '--root', dir, '--migrate-legacy').status, 1, 'the migration refuses to run twice');
  /* after the migration a new evidence-less confirmed row (e.g. from a desk shard) is an estimate */
  fs.writeFileSync(path.join(dir, 'data', 'shards', 'desk-pt-2026-11-17.json'), JSON.stringify([{ ...noEv, id: 'desk-meeting-2027', name: 'DESK Meeting 2027', start: '2027-09-01', end: '2027-09-02', legacyConfirmed: true }]));
  assert.equal(node('tools/merge-shards.js', '--root', dir, '--today', DAY).status, 0);
  L = load(dir);
  assert.equal(by('desk-meeting-2027').datesConfirmed, false); assert.match(by('desk-meeting-2027').estimateReason, /missing datesSourceUrl, datesQuote, verifiedOn/);
  assert.equal(by('leg-meeting-2027').legacyConfirmed, true); assert.equal(by('leg-meeting-2027').lastVerified, '2026-11-07', 'a merge never re-stamps lastVerified');
  const before = fs.readFileSync(path.join(dir, 'data', 'conferences.js'), 'utf8');
  node('tools/merge-shards.js', '--root', dir, '--today', '2026-12-24');
  assert.equal(fs.readFileSync(path.join(dir, 'data', 'conferences.js'), 'utf8'), before, 'merging again (another day) changes nothing');
  assert.equal(node('tools/validate-data.js', '--root', dir, '--today', DAY).status, 0);
});
