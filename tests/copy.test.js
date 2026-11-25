'use strict';
/* Copy lint (B35): no unsourced superlatives or promises in anything a user reads (word list: tools/copy-lint.js).
   History: the first version of this check (tests/hoggy.test.js) held `\b` as literal backspace characters, so it never
   fired. The control-character guard below stops that happening again. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* The word list and lint() live in tools/copy-lint.js (also used by tools/validate-data.js). */
const { BANNED, lint } = require('../tools/copy-lint.js');
const show = (f, hits) => hits.map(h => `${f}:${h.line} "${h.word}" in: ${h.text}`).join('\n');

/* Every file whose strings reach a user (UI, admin desk, claim pack, server messages, README). */
const SOURCES = ['index.html', 'app.js', 'admin.html', 'admin.js', 'courses.js', 'stats.js', 'pack.js', 'server.js', 'README.md',
  ...fs.readdirSync(path.join(ROOT, 'lib')).filter(f => f.endsWith('.js')).map(f => 'lib/' + f)];

test('copy lint: the patterns themselves are sound (no control characters, they fire on seeded copy)', () => {
  for (const re of BANNED) assert.doesNotMatch(re.source, /[\x00-\x08\x0b-\x1f]/, 'control character in ' + re);
  for (const bad of ["The world's largest radiology meeting.", 'A leading congress', 'Best match', 'Guaranteed claim', 'be guaranteed an expense claim',
    'Top rated', 'top-rated meetings', 'The #1 meeting', 'Highest rated', 'Number one for CPD', 'never lose a receipt', 'World-leading course'])
    assert.ok(lint(bad).length, 'should flag: ' + bad);
  for (const ok of ['Highest rated by attendees', 'misleading dates are labelled', 'GET /api/top-rated?limit=12', '&#10003;', 'color:#1a1a1a', 'claim-ready', 'A major congress'])
    assert.deepEqual(lint(ok), [], 'should pass: ' + ok);
});

test('copy lint: no test or tool file hides a control character in a regex', () => {
  for (const dir of ['tests', 'tools']) for (const f of fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith('.js')))
    assert.doesNotMatch(read(dir + '/' + f), /[\x00-\x08\x0b\x0c\x0e-\x1f]/, `${dir}/${f} contains a control character (a \\b typed as a backspace?)`);
});

test('copy lint: every user-facing source is clean', () => {
  const all = [];
  for (const f of SOURCES) { const h = lint(read(f)); if (h.length) all.push(show(f, h)); }
  assert.equal(all.length, 0, 'banned copy found:\n' + all.join('\n'));
});

test('copy lint: every conference string field is clean (names, blurbs, notes)', () => {
  const ctx = { window: {} }; vm.runInNewContext(read('data/conferences.js'), ctx);
  const rows = ctx.window.HOGGY_CONFERENCES, bad = [];
  assert.ok(rows.length > 100);
  /* datesQuote is the organiser's own wording, quoted verbatim with its source (B30), so it is not Hoggy's copy */
  for (const c of rows) for (const [k, v] of Object.entries(c)) if (typeof v === 'string' && !/url$/i.test(k) && k !== 'datesQuote' && lint(v).length) bad.push(`${c.id}.${k}: ${v.slice(0, 100)}`);
  assert.equal(bad.length, 0, 'superlatives in data/conferences.js:\n' + bad.join('\n'));
  /* the same check fails on a seeded row, so it cannot silently stop working again */
  assert.ok(lint('The largest gastroenterology congress.').length);
});

test('Discover subtitle is computed from the data, not a fixed year or "worldwide"', () => {
  const src = read('app.js'), i = src.indexOf('  discover() {'), body = src.slice(i, src.indexOf('</h1>', i) + 400);
  assert.match(body, /discoverSummary\(CONFS, today\(\)\)/);
  assert.doesNotMatch(body, /worldwide|mostly 20\d\d/i);
  const { discoverSummary } = require('../stats.js');
  const ev = { datesConfirmed: true, datesSourceUrl: 'https://y/2028', datesQuote: '1-2 February 2028', verifiedOn: '2026-05-01' };
  const L = [{ start: '2026-01-02', end: '2026-01-03', countryCode: 'AU', specialty: 'A', sourceUrl: 'https://x' },
    { start: '2027-05-01', end: '2027-05-03', countryCode: 'NZ', specialty: 'B', datesConfirmed: false },
    { start: '2027-06-01', end: '2027-06-03', countryCode: 'NZ', specialty: 'B', datesConfirmed: true, legacyConfirmed: true, sourceUrl: 'https://z' },
    { start: '2028-02-01', end: '2028-02-02', countryCode: 'AU', specialty: 'A', sourceUrl: 'https://y', ...ev }];
  assert.deepEqual(discoverSummary(L, '2026-06-01'), { conferences: 3, countries: 2, specialties: 2, confirmed: 1, confirmedPct: 33, unchecked: 1, uncheckedPct: 33, estimated: 1, from: '2027-05-01', to: '2028-02-01' });
  assert.deepEqual(discoverSummary([], '2026-06-01'), { conferences: 0, countries: 0, specialties: 0, confirmed: 0, confirmedPct: 0, unchecked: 0, uncheckedPct: 0, estimated: 0, from: '', to: '' });
  assert.match(body, /\$\{n\(ds\.conferences\)\} conferences · \$\{n\(ds\.countries\)\} countries/, 'one short count line, from the data');
  /* estimates and not-yet-re-checked rows are labelled on every card instead (voice.md: no paragraph of counts) */
  assert.match(src, /title="Dates not yet published">Estimate<\/span>/); assert.match(src, />Re-checking<\/span>/);
});
