'use strict';
/* tools/merge-courses.js: per-source course files folded into the served catalogue/sessions. Run: node --test tools/courses/ */
const test = require('node:test'), assert = require('node:assert/strict');
const MC = require('../merge-courses');

const TODAY = '2026-11-24';
const course = (id, extra) => ({ id, name: id.toUpperCase() + ' course', providers: [{ name: 'P', url: 'https://p.example/' }], countries: ['AU'], ...extra });
const ses = (id, courseId, extra) => ({ id, courseId, variant: 'full', provider: 'Prov', city: 'Sydney', region: 'NSW', country: 'AU', start: '2027-02-01', end: '2027-02-02',
  bookingUrl: 'https://p.example/b', sourceUrl: 'https://p.example/s', datesQuote: '1-2 Feb 2027', lastVerified: '2026-11-18', datesConfirmed: true, ...extra });
const base = () => ({
  catalogue: { generated: '2026-11-01', courses: [course('als2')] },
  sessions: { generated: '2026-11-01', sessions: [ses('als2-a', 'als2', { provider: 'ARC centre' })] }
});

test('merge: adds a source, refuses reused ids, finished rows and duplicates (id or course+variant+provider+start+city)', () => {
  const b = base();
  const src = { name: 'resus', courses: [course('als2'), course('acccn-als')], updates: [], sessions: [
    ses('acccn-1', 'acccn-als'),
    ses('acccn-1', 'acccn-als', { city: 'Perth' }), /* same id */
    ses('acccn-2', 'acccn-als'), /* same natural key as acccn-1 */
    ses('acccn-3', 'acccn-als', { variant: 'refresher' }), /* variant differs: kept */
    ses('acccn-old', 'acccn-als', { start: '2026-11-01', end: '2026-11-02' }),
    ses('acccn-x', 'nope')
  ] };
  const m = MC.mergeSources({ ...b, sources: [src], today: TODAY });
  assert.deepEqual(m.catalogue.courses.map(c => c.id), ['als2', 'acccn-als']);
  assert.equal(m.report.refusedCourses.length, 1, 'a source may not reuse a core id');
  const ids = m.sessions.sessions.map(s => s.id).sort();
  assert.deepEqual(ids, ['acccn-1', 'acccn-3', 'als2-a']);
  const r = m.report.sources[0];
  assert.equal(r.duplicates, 2); assert.equal(r.finished, 1); assert.equal(r.refused, 1);
  assert.ok(m.sessions.sessions.filter(s => s.id !== 'als2-a').every(s => s.fromSource === 'resus'));
});

test('merge: idempotent; updates[] set price and seats with evidence and are undone before the next run', () => {
  const b = base();
  const upd = { id: 'als2-a', priceFrom: 1195, currency: 'AUD', seatsStatus: 'open', sourceUrl: 'https://centre.arlo.co/api', datesQuote: 'StartDateTime 2027-02-01', lastVerified: '2026-11-18' };
  const src = { name: 'resus', courses: [course('acccn-als')], sessions: [ses('acccn-1', 'acccn-als')], updates: [upd, { id: 'gone', priceFrom: 1, currency: 'AUD', sourceUrl: 'https://x.example', datesQuote: 'q', lastVerified: '2026-11-18' }] };
  const before = JSON.stringify(b);
  const m1 = MC.mergeSources({ ...b, sources: [src], today: TODAY });
  assert.equal(JSON.stringify(b), before, 'the inputs are not changed');
  const h = m1.sessions.sessions.find(s => s.id === 'als2-a');
  assert.equal(h.priceFrom, 1195); assert.equal(h.providerEvidence.sourceUrl, upd.sourceUrl); assert.equal(h.sourceUrl, 'https://p.example/s', 'the date evidence stays');
  assert.deepEqual(m1.report.updates.notFound, ['resus: gone']);
  /* second run on its own output: same result */
  const m2 = MC.mergeSources({ catalogue: m1.catalogue, sessions: m1.sessions, sources: [src], today: TODAY });
  assert.deepEqual(m2.sessions.sessions, m1.sessions.sessions);
  assert.deepEqual(m2.catalogue.courses, m1.catalogue.courses);
  /* dropping the source takes its rows and its update out again */
  const m3 = MC.mergeSources({ catalogue: m1.catalogue, sessions: m1.sessions, sources: [], today: TODAY });
  assert.deepEqual(m3.sessions.sessions.map(s => s.id), ['als2-a']);
  assert.equal(m3.sessions.sessions[0].priceFrom ?? null, null); assert.equal(m3.sessions.sessions[0].providerEvidence, undefined);
});

test('merge: another source\'s course is left alone unless --allow-shared (womens-gp ACRRM rows vs resus)', () => {
  const b = base();
  const resus = { name: 'resus', courses: [course('acrrm-anr')], sessions: [ses('anr-1', 'acrrm-anr')], updates: [] };
  const wgp = { name: 'womens-gp', courses: [], sessions: [ses('anr-2', 'acrrm-anr', { city: 'Perth' }), ses('wgp-als2', 'als2', { city: 'Perth' })], updates: [] };
  const m = MC.mergeSources({ ...b, sources: [resus, wgp], today: TODAY });
  assert.ok(!m.sessions.sessions.some(s => s.id === 'anr-2'));
  assert.ok(m.sessions.sessions.some(s => s.id === 'wgp-als2'), 'core course types are open to every source');
  assert.equal(m.report.sources[1].shared, 1);
  assert.ok(MC.mergeSources({ ...base(), sources: [resus, wgp], today: TODAY, allowShared: true }).sessions.sessions.some(s => s.id === 'anr-2'));
});

test('fixes: AIU length variants fold into one row with options; "Closed" in the quote marks it closed; course patches', () => {
  const aiu = (days, extra) => ses(`aiu-pocus-${days}-days-2027-06-02`, 'aiu-pocus', { provider: 'Australian Institute of Ultrasound', city: 'Gold Coast', region: 'QLD', variant: `${days}-days`, start: '2027-06-02', end: `2027-06-0${1 + Math.ceil(days)}`, priceFrom: 1000 * days, currency: 'AUD', ...extra });
  const src = { name: 'womens-gp', courses: [course('aiu-pocus'), course('erc-als', { countries: ['NL'] })], updates: [], sessions: [aiu(3, { seatsStatus: 'open' }), aiu(5), aiu(4, { datesQuote: '2 Jun 2027 Closed' })] };
  const fixes = { catalogue: [{ id: 'erc-als', set: { relevance: 0 } }], catalogueRules: [{ idPrefix: 'aiu-', set: { providerType: 'commercial' } }],
    sessionRules: [{ provider: '^Australian Institute of Ultrasound', set: { providerType: 'commercial' }, collapseLengthVariants: true, closedFromQuote: true }] };
  const m = MC.mergeSources({ ...base(), sources: [src], today: TODAY, fixes });
  const rows = m.sessions.sessions.filter(s => s.courseId === 'aiu-pocus');
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.id, 'aiu-pocus-2027-06-02'); assert.equal(r.variant, 'length-options'); assert.equal(r.priceFrom, 3000); assert.equal(r.providerType, 'commercial');
  assert.deepEqual(r.durationOptions.map(o => [o.days, o.seatsStatus || null]), [[3, 'open'], [4, 'closed'], [5, null]]);
  assert.equal(r.seatsStatus, 'open');
  assert.equal(m.catalogue.courses.find(c => c.id === 'aiu-pocus').providerType, 'commercial');
  assert.equal(m.catalogue.courses.find(c => c.id === 'erc-als').relevance, 0);
  assert.throws(() => MC.mergeSources({ ...base(), sources: [src], today: TODAY, fixes: { catalogue: [{ id: 'erc-als', set: { priceFrom: 1 } }] } }), /cannot set priceFrom/);
});

test('the served files are the merge of the source files (re-running changes nothing)', () => {
  const fs = require('node:fs'), path = require('node:path'), dir = path.join(__dirname, '..', '..', 'data', 'courses');
  const rd = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const cat = rd('catalogue.json'), sesF = rd('sessions.json'), today = sesF.generated;
  const m = MC.mergeSources({ catalogue: cat, sessions: sesF, sources: MC.readSources(dir), today, fixes: rd('fixes.json') });
  assert.equal(m.sessions.sessions.length, sesF.sessions.length);
  assert.equal(m.catalogue.courses.length, cat.courses.length);
  assert.ok(!sesF.sessions.some(s => s.fromSource === 'womens-gp' && /^acrrm-/.test(s.courseId)), 'womens-gp ACRRM rows stay out by default');
});
