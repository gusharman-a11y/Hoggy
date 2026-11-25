'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { robotsRules, robotsAllows, makeClient, BlockedError, UA } = require('./http');

test('robots: * and Claude/Anthropic groups apply; others do not', () => {
  const r = robotsRules('User-agent: SemrushBot\nDisallow: /\n\nUser-agent: *\nDisallow: /calendar/action~*/\nAllow: /calendar/action~agenda/ok\n\nUser-agent: ClaudeBot\nUser-agent: anthropic-ai\nDisallow: /private\n');
  assert.ok(robotsAllows(r, '/courses/face-to-face/rest'));
  assert.ok(!robotsAllows(r, '/calendar/action~month/'));
  assert.ok(robotsAllows(r, '/calendar/action~agenda/ok'), 'longer Allow wins');
  assert.ok(!robotsAllows(r, '/private/x'));
  assert.ok(robotsAllows(robotsRules('User-agent: *\nDisallow:\n'), '/anything'), 'empty Disallow allows all');
});

test('client: generic UA, robots honoured, Cloudflare challenge reported not retried', async () => {
  const calls = [];
  const fake = async (url, o) => {
    calls.push([url, o.headers['User-Agent']]);
    if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nDisallow: /no\n');
    if (url.includes('/cf')) return new Response('<title>Just a moment...</title>', { status: 403, headers: { 'cf-mitigated': 'challenge' } });
    return new Response('ok');
  };
  const c = makeClient({ gapMs: 0, fetchImpl: fake });
  assert.equal(await c.get('https://h.example/yes'), 'ok');
  await assert.rejects(c.get('https://h.example/no'), e => e instanceof BlockedError && e.code === 'robots');
  await assert.rejects(c.get('https://h.example/cf'), e => e instanceof BlockedError && e.code === 'challenge');
  await assert.rejects(c.get('http://h.example/yes'), e => e.code === 'not-https');
  assert.equal(calls.filter(c => c[0].includes('/cf')).length, 1, 'no retry on a challenge');
  assert.equal(calls.filter(c => c[0].endsWith('robots.txt')).length, 1, 'robots.txt fetched once per host');
  assert.ok(calls.every(c => c[1] === UA) && !/@/.test(UA));
});

test('a redirect to another host is refused when that host\'s robots.txt disallows it (wave 5)', async () => {
  const { makeClient } = require('./http');
  const fetchImpl = async u => {
    const x = new URL(u);
    if (x.pathname === '/robots.txt') return { ok: true, status: 200, headers: { get: () => null }, text: async () => (x.host === 'b.example' ? 'User-agent: *\nDisallow: /' : ''), url: u };
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => 'page', url: 'https://b.example/page' };
  };
  const c = makeClient({ gapMs: 0, fetchImpl });
  await require('node:assert').rejects(() => c.get('https://a.example/x'), e => e.code === 'robots');
});
