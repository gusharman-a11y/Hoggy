'use strict';
/* tools/verify-dates.js (B28/B30): date extraction, the decision rules, politeness, and a full offline run on hand-made
   fixtures (tools/dates/fixtures: invented societies under .example; the build session could not reach organiser sites)
   whose output must pass tools/merge-shards.js and tools/validate-data.js. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawnSync } = require('node:child_process');
const X = require('../tools/dates/extract');
const V = require('../tools/verify-dates');
const { makeClient, BlockedError } = require('../tools/courses/http');
const ROOT = path.join(__dirname, '..'), FIX = path.join(ROOT, 'tools', 'dates', 'fixtures'), DAY = '2026-11-17';
const node = (...a) => spawnSync(process.execPath, a, { cwd: ROOT, encoding: 'utf8' });
const ranges = (s, o) => X.findRanges(s, o).map(r => [r.start, r.end]);

test('extract: common date formats in six languages', () => {
  const T = [
    ['12–14 March 2027', '2027-03-12', '2027-03-14'], ['12 to 14 Mar. 2027', '2027-03-12', '2027-03-14'], ['12th-14th March 2027', '2027-03-12', '2027-03-14'],
    ['30 March – 2 April 2027', '2027-03-30', '2027-04-02'], ['30 December 2026 – 2 January 2027', '2026-12-30', '2027-01-02'],
    ['March 12-14, 2027', '2027-03-12', '2027-03-14'], ['March 30 – April 2, 2027', '2027-03-30', '2027-04-02'], ['March 12, 2027 – March 14, 2027', '2027-03-12', '2027-03-14'],
    ['12/03/2027 – 14/03/2027', '2027-03-12', '2027-03-14'], ['12-14.03.2027', '2027-03-12', '2027-03-14'], ['2027-03-12 to 2027-03-14', '2027-03-12', '2027-03-14'],
    ['17 a 20 de março de 2027', '2027-03-17', '2027-03-20'], ['del 12 al 14 de marzo de 2027', '2027-03-12', '2027-03-14'], ['du 12 au 14 mars 2027', '2027-03-12', '2027-03-14'],
    ['12.–14. März 2027', '2027-03-12', '2027-03-14'], ['dal 12 al 14 maggio 2027', '2027-05-12', '2027-05-14'], ['Thursday 6 – Saturday 8 May 2027', '2027-05-06', '2027-05-08'],
    ['May 3, 2027', '2027-05-03', '2027-05-03'], ['2027-05-03', '2027-05-03', '2027-05-03']];
  for (const [s, a, b] of T) assert.deepEqual(ranges(s), [[a, b]], s);
  assert.deepEqual(ranges('31 February 2027'), [], 'not a real date');
  assert.ok(!ranges('14-12 March 2027').some(([a, b]) => a === '2027-03-14' && b === '2027-03-12'), 'end before start is not a range');
  assert.equal(X.findRanges('04/05/2027')[0].ambiguous, true, 'day/month order unclear');
  assert.deepEqual(ranges('04/15/2027', { mdy: true }), [['2027-04-15', '2027-04-15']]);
  assert.deepEqual(ranges('15/04/2027'), [['2027-04-15', '2027-04-15']], 'a part above 12 settles the order');
  assert.deepEqual(ranges('Key dates: 12–14 March 2027; abstracts by 15 January 2027'), [['2027-03-12', '2027-03-14'], ['2027-01-15', '2027-01-15']], 'longest match wins, each date once');
});

test('extract: quotes are verbatim, at most 200 characters, and contain the dates', () => {
  const html = '<p>Join us on Thursday 6 &ndash; Saturday 8 May 2027 at the Grand Chancellor, Hobart.</p>';
  const { text } = X.pageText(html), r = X.findRanges(text)[0], q = X.quoteAround(text, r.index, r.length);
  assert.equal(q, 'Join us on Thursday 6 – Saturday 8 May 2027 at the Grand Chancellor, Hobart.');
  const long = 'x'.repeat(300) + ' 12–14 March 2027 ' + 'y'.repeat(300), r2 = X.findRanges(long)[0], q2 = X.quoteAround(long, r2.index, r2.length);
  assert.ok(q2.length <= 200 && q2.includes('12–14 March 2027'), q2.length);
  assert.ok(!X.pageText('<script>var d="1-3 June 2027"</script><p>hi</p>').text.includes('June'), 'scripts are not page text');
  assert.deepEqual(X.jsonLdEvents('<script type="application/ld+json">{"@type":"Event","name":"A","startDate":"2027-03-17T09:00","endDate":"2027-03-20"}</script>'), [{ name: 'A', start: '2027-03-17', end: '2027-03-20' }]);
});

test('decisions: deadlines, past editions and far-away dates are ignored; two ranges go to review', () => {
  const c = { id: 'x', name: 'ABC Congress 2027', organiser: 'ABC Society', city: 'Porto', countryCode: 'PT', start: '2027-03-01', end: '2027-03-03', url: 'https://abc.example/c27', datesConfirmed: false };
  const page = '<title>ABC 2027</title><p>ABC Congress 2027, Porto: 12–14 March 2027</p><p>Abstract deadline: 10–11 January 2027</p><p>ABC 2026 was 11–13 March 2026</p><p>Also on 1 June 2027 we hold a webinar</p>';
  const r = V.readPage(c, page, c.url);
  assert.deepEqual(r.distinct.map(p => [p.start, p.end]), [['2027-03-12', '2027-03-14']]);
  assert.ok(r.dropped.some(d => /deadline/.test(d)) && r.dropped.some(d => /length/.test(d)));
  const two = V.readPage(c, '<title>ABC 2027</title><p>ABC course: 9–10 March 2027</p><p>ABC Congress: 12–14 March 2027</p>', c.url);
  assert.equal(two.distinct.length, 2);
  const far = V.readPage({ ...c, name: 'Lorem Meeting 2027', organiser: 'Lorem Society' }, '<title>Lorem Society news</title><p>Lorem Meeting 2027 is coming.</p><p>' + 'filler '.repeat(120) + '</p><p>Board day: 3–4 May 2027</p>', c.url);
  assert.equal(far.distinct.length, 0, 'a range far from the name on a general page is not taken');
});

test('urls: only the organiser\'s own domain, never an aggregator; site roots lead one hop to the event page', () => {
  assert.deepEqual(V.urlsFor({ url: 'https://10times.com/x', sourceUrl: 'https://10times.com/x' }), []);
  assert.deepEqual(V.urlsFor({ url: 'https://soc.example/', sourceUrl: 'https://other.example/c27' }), ['https://soc.example/'], 'another domain is not used');
  const c = { name: 'Congresso SOCBR 2027', organiser: 'SOCBR', city: 'Recife', start: '2027-03-31' };
  assert.deepEqual(V.eventLinks(c, fs.readFileSync(path.join(FIX, 'socbr-home.html'), 'utf8'), 'https://www.socbr.example/'), ['https://www.socbr.example/congresso-2027/']);
});

test('selection: soonest upcoming rows without evidence; --only narrows to estimated or legacy', () => {
  const rows = JSON.parse(fs.readFileSync(path.join(FIX, 'rows.json'), 'utf8'));
  const all = V.pick(rows, { today: DAY, limit: 40 });
  assert.ok(!all.some(c => c.id === 'past-row-2026')); assert.deepEqual(all.map(c => c.start), all.map(c => c.start).slice().sort());
  assert.ok(V.pick(rows, { today: DAY, limit: 40, only: 'estimated' }).every(c => c.datesConfirmed === false));
  assert.ok(V.pick(rows, { today: DAY, limit: 40, only: 'legacy' }).every(c => c.legacyConfirmed));
  assert.equal(V.pick(rows, { today: DAY, limit: 2 }).length, 2);
});

test('politeness: generic User-Agent, 3 s minimum gap per host, robots.txt, blocks recorded and not retried', async () => {
  assert.ok(V.MIN_GAP_MS >= 3000);
  assert.doesNotMatch(V.UA, /@|hoggy|claude|anthropic/i, 'generic UA, no contact details');
  const calls = [];
  const fake = async (url, o) => {
    calls.push({ url, ua: o.headers['User-Agent'], t: Date.now() });
    if (url.endsWith('/robots.txt')) return new Response(url.includes('nobots') ? 'User-agent: conference-dates-check\nDisallow: /\n' : 'User-agent: *\nDisallow: /private\n');
    if (url.includes('cf.example')) return new Response('<title>Just a moment...</title>', { status: 403, headers: { 'cf-mitigated': 'challenge' } });
    if (url.includes('forbidden.example')) return new Response('no', { status: 403 });
    return new Response('<title>ABC 2027</title><p>ABC Congress 2027, Porto: 12–14 March 2027</p>');
  };
  const http = makeClient({ gapMs: 150, fetchImpl: fake, ua: V.UA, robotNames: V.ROBOT_NAMES });
  const row = (id, url) => ({ id, name: 'ABC Congress 2027', organiser: 'ABC', city: 'Porto', countryCode: 'PT', start: '2027-03-01', end: '2027-03-03', url, datesConfirmed: false });
  assert.equal((await V.checkRow(row('a', 'https://ok.example/c27'), http, DAY)).status, 'corrected');
  const t = calls.filter(c => c.url.startsWith('https://ok.example')).map(c => c.t);
  assert.ok(t[1] - t[0] >= 140, 'robots.txt and page are spaced by the gap');
  assert.equal((await V.checkRow(row('b', 'https://cf.example/c27'), http, DAY)).status, 'blocked');
  assert.equal(calls.filter(c => c.url === 'https://cf.example/c27').length, 1, 'a challenge is not retried');
  assert.equal((await V.checkRow(row('c', 'https://forbidden.example/c27'), http, DAY)).status, 'blocked');
  const nb = await V.checkRow(row('d', 'https://nobots.example/c27'), http, DAY);
  assert.equal(nb.status, 'blocked'); assert.match(nb.reason, /robots/);
  assert.ok(!calls.some(c => c.url === 'https://nobots.example/c27'), 'a disallowed page is never fetched');
  assert.equal((await V.checkRow(row('e', 'http://ok.example/c27'), http, DAY)).status, 'review', 'http only: nothing to fetch');
  assert.ok(calls.every(c => c.ua === V.UA));
});

test('full run on the fixtures: shard and report written, merge applies them, validate-data passes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-dates-'));
  fs.mkdirSync(path.join(dir, 'data', 'shards'), { recursive: true }); fs.mkdirSync(path.join(dir, 'docs'));
  const rows = JSON.parse(fs.readFileSync(path.join(FIX, 'rows.json'), 'utf8'));
  fs.writeFileSync(path.join(dir, 'data', 'conferences.js'), 'window.HOGGY_CONFERENCES = ' + JSON.stringify(rows, null, 1) + ';\n');
  fs.writeFileSync(path.join(dir, 'docs', `daily-report-${DAY}.md`), `# Hoggy daily report, ${DAY}\n\n## Totals\n- earlier sections stay\n\n## Date checks\n\nold text\n\n## Needs human review\n- kept\n`);
  const dry = node('tools/verify-dates.js', '--root', dir, '--from', FIX, '--today', DAY, '--dry', '--quiet');
  assert.equal(dry.status, 0, dry.stderr); assert.ok(!fs.existsSync(path.join(dir, 'data', 'shards', `provenance-dates-${DAY}.json`)), '--dry writes nothing');
  const r = node('tools/verify-dates.js', '--root', dir, '--from', FIX, '--today', DAY, '--quiet');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /checked 10, confirmed 4, corrected 1, review 3, none 1, blocked 1, errors 0/);
  const shard = JSON.parse(fs.readFileSync(path.join(dir, 'data', 'shards', `provenance-dates-${DAY}.json`), 'utf8'));
  assert.deepEqual(shard.map(e => e.id).sort(), ['anzpm-asm', 'aspc-annual-meeting-2027', 'dgkn-jahrestagung-2027', 'esgi-congress-2027', 'socbr-congresso-2027']);
  for (const e of shard) { assert.equal(e.verifiedOn, DAY); assert.ok(e.datesQuote.length <= 200); assert.match(e.datesSourceUrl, /^https:\/\//); }
  assert.equal(shard.find(e => e.id === 'socbr-congresso-2027').datesSourceUrl, 'https://www.socbr.example/congresso-2027/', 'the event page, not the site root');
  const rep = fs.readFileSync(path.join(dir, 'docs', `daily-report-${DAY}.md`), 'utf8');
  assert.equal((rep.match(/^## Date checks/gm) || []).length, 1); assert.doesNotMatch(rep, /old text/);
  assert.match(rep, /## Totals[\s\S]*## Date checks[\s\S]*## Needs human review\n- kept/, 'other sections kept in place');
  assert.match(rep, /jsdr-58th-2027.*the row \(confirmed earlier\) says 2027-06-10/);
  assert.match(rep, /cso-congress-2027.*2 different date ranges/);
  assert.match(rep, /bsn-winter-meeting-2027.*challenge/);
  assert.match(rep, /wcpr-2027.*no https page on the organiser's domain/);
  assert.doesNotMatch(rep, /past-row-2026/, 'finished conferences are not checked');
  const again = node('tools/verify-dates.js', '--root', dir, '--from', FIX, '--today', DAY, '--quiet');
  assert.equal(again.status, 0); assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'data', 'shards', `provenance-dates-${DAY}.json`), 'utf8')).length, 5, 'a re-run replaces, never duplicates');

  const m = node('tools/merge-shards.js', '--root', dir, '--today', DAY); assert.equal(m.status, 0, m.stderr);
  const v = node('tools/validate-data.js', '--root', dir, '--today', DAY); assert.equal(v.status, 0, v.stdout + v.stderr);
  assert.match(v.stdout, /with evidence 5, legacy \(source not yet re-checked\) 1/);
  const vm = require('node:vm'), ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(dir, 'data', 'conferences.js'), 'utf8'), ctx);
  const by = id => ctx.window.HOGGY_CONFERENCES.find(c => c.id === id);
  assert.deepEqual([by('esgi-congress-2027').start, by('esgi-congress-2027').end, by('esgi-congress-2027').datesConfirmed], ['2027-03-12', '2027-03-14', true]);
  assert.equal(by('anzpm-asm').legacyConfirmed, undefined, 'evidence replaces the legacy flag');
  assert.equal(by('jsdr-58th-2027').legacyConfirmed, true, 'a mismatch leaves the row as it was');
  assert.equal(by('cso-congress-2027').datesConfirmed, false);
  const { dateEvidence } = require('../stats.js');
  assert.equal(dateEvidence(by('esgi-congress-2027')), 'confirmed'); assert.equal(dateEvidence(by('jsdr-58th-2027')), 'unchecked');
});
