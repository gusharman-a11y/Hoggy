'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { merge } = require('./merge');

const S = (o = {}) => ({ id: 'als2-nsw-sydney-2027-01-10-x', courseId: 'als2', variant: 'full', provider: 'X Pty', city: 'Sydney', region: 'NSW', country: 'AU', venue: 'Hall, 1 St, Sydney NSW 2000', start: '2027-01-10', end: '2027-01-11', seatsStatus: null, sourceUrl: 'https://a.example/list', datesQuote: 'q', lastVerified: '2026-11-01', ...o });
const key = s => s.sourceUrl;

test('merge: ids kept, changes reported, new rows added with unique ids', () => {
  const old = [S(), S({ id: 'b', start: '2027-02-01', end: '2027-02-02', city: 'Sydney CBD' })];
  const fresh = [S({ seatsStatus: 'full', lastVerified: '2026-11-17', id: 'whatever' }), S({ id: 'b-new-slug', start: '2027-02-01', end: '2027-02-02', city: 'Sydney', lastVerified: '2026-11-17' }), S({ start: '2027-03-01', end: '2027-03-02', id: 'b' })];
  const m = merge(old, fresh, { today: '2026-11-17', readSources: new Set([old[0].sourceUrl]), sourceKeyOf: key });
  assert.equal(m.sessions.length, 3);
  assert.deepEqual(m.updated.map(u => [u.id, Object.keys(u.changes)]), [['als2-nsw-sydney-2027-01-10-x', ['seatsStatus']]]);
  assert.deepEqual(m.unchanged.map(u => u.id), ['b'], 'city kept, lastVerified is not a change');
  assert.equal(m.sessions.find(s => s.start === '2027-02-01').city, 'Sydney CBD');
  assert.deepEqual(m.added.map(s => s.id), ['b-2'], 'id collision gets a suffix');
});

test('merge: sourceRef wins over a changed date', () => {
  const old = [S({ sourceRef: 'acrrm:1' })];
  const m = merge(old, [S({ sourceRef: 'acrrm:1', id: 'new', start: '2027-01-17', end: '2027-01-18' })], { today: '2026-11-17', readSources: new Set(), sourceKeyOf: key });
  assert.equal(m.sessions[0].id, old[0].id); assert.deepEqual(m.updated[0].changes.start, ['2027-01-10', '2027-01-17']);
});

test('merge: finished and unlisted rows removed; rows of a failed source kept', () => {
  const old = [S({ id: 'done', start: '2026-11-01', end: '2026-11-02' }), S({ id: 'gone', start: '2027-05-01', end: '2027-05-02' }), S({ id: 'other', sourceUrl: 'https://b.example/' })];
  const m = merge(old, [], { today: '2026-11-17', readSources: new Set(['https://a.example/list']), sourceKeyOf: key });
  assert.deepEqual(m.removed.map(s => [s.id, s.reason.split(' ')[0]]), [['done', 'finished'], ['gone', 'no']]);
  assert.deepEqual(m.kept.map(s => s.id), ['other']); assert.deepEqual(m.sessions.map(s => s.id), ['other']);
});
