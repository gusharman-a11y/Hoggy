'use strict';
/* "Highest rated by attendees" ranking and "Covered in" journal and press links. Run: node --test tests/ */
const test = require('node:test'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process'), path = require('node:path'), fs = require('node:fs'), os = require('node:os'), vm = require('node:vm');
const { seriesKey } = require('../lib/series.js');
const RV = require('../lib/reviews.js');
const COV = require('../lib/coverage.js');
const TDB = require('./_db.js');
const ROOT = path.join(__dirname, '..');
const CONFS = (() => { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data', 'conferences.js'), 'utf8'), ctx); return ctx.window.HOGGY_CONFERENCES; })();
const byId = id => { const c = CONFS.find(x => x.id === id); assert.ok(c, 'fixture missing ' + id); return c; };

test('top rated: weighted score, 3-review threshold, tie-breaks, specialty filter, limit', () => {
  const r = (verify, v, uid) => ({ user_id: uid, verify, rating: v, content: v, networking: v, venue: v, value: v, cpd: v });
  const scores = {
    a: RV.scoreOf([r('verified', 5, 1), r('none', 3, 2), r('none', 3, 3)]),          /* (5 + 1.5 + 1.5) / 2 = 4.0 */
    b: RV.scoreOf([r('none', 5, 1), r('none', 5, 2), r('none', 4, 3)]),              /* 4.67, nobody verified */
    c: RV.scoreOf([r('verified', 5, 1), r('verified', 5, 2)]),                       /* only 2 reviews: never ranked */
    d: RV.scoreOf([r('verified', 4, 1), r('verified', 4, 2), r('none', 4, 3)]),      /* 4.0, 2 verified */
    e: RV.scoreOf([r('verified', 4, 1), r('none', 4, 2), r('none', 4, 3), r('none', 4, 4)]), /* 4.0, 1 verified, 4 reviews */
    f: RV.scoreOf([r('verified', 4, 1), r('none', 4, 2), r('none', 4, 3), r('none', 4, 4)]), /* same as e: title decides */
    gone: RV.scoreOf([r('none', 5, 1), r('none', 5, 2), r('none', 5, 3)]),            /* no longer listed: left out */
  };
  assert.equal(scores.a.avg, 4); assert.equal(scores.b.avg, 4.67);
  const meta = { a: { title: 'Alpha', specialty: 'Cardiology' }, b: { title: 'Beta', specialty: 'Oncology' }, c: { title: 'Gamma', specialty: 'Cardiology' }, d: { title: 'Delta', specialty: 'Cardiology' }, e: { title: 'Zeta', specialty: 'Oncology' }, f: { title: 'Epsilon', specialty: 'Cardiology' } };
  const top = RV.topRated(scores, k => meta[k] || null, { limit: 10 });
  assert.deepEqual(top.map(x => x.seriesKey), ['b', 'd', 'f', 'e', 'a'], 'score, then verified, then review count, then title');
  assert.ok(top.every(x => x.n >= RV.MIN_REVIEWS), 'threshold');
  assert.deepEqual(Object.keys(top[0]).sort(), ['avg', 'n', 'seriesKey', 'specialty', 'title', 'verified']);
  assert.deepEqual(RV.topRated(scores, k => meta[k] || null, { specialty: 'Cardiology' }).map(x => x.seriesKey), ['d', 'f', 'a']);
  assert.equal(RV.topRated(scores, k => meta[k] || null).length, 5, 'default limit 6');
  assert.equal(RV.topRated(scores, k => meta[k] || null, { limit: 2 }).length, 2);
  assert.deepEqual(RV.topRated({}, () => null), [], 'nothing qualifies yet');
});

test('coverage: validation and link attributes', () => {
  const ok = { type: 'meeting-report', title: 'Highlights from Kobe', publication: 'Journal of Anesthesia', year: 2025, url: 'https://link.springer.com/article/10.1007/s00540-025-0001' };
  const v = COV.validate(ok); assert.equal(v.ok, true); assert.equal(v.value.publication, 'Journal of Anesthesia');
  assert.equal(COV.validate({ ...ok, url: 'http://example.org/a' }).ok, false, 'https only');
  assert.equal(COV.validate({ ...ok, url: 'javascript:alert(1)' }).ok, false);
  assert.equal(COV.validate({ ...ok, url: 'https://user:pw@example.org/' }).ok, false, 'no credentials in the link');
  assert.equal(COV.validate({ ...ok, url: 'example.org/a' }).ok, false, 'absolute link');
  assert.equal(COV.validate({ ...ok, publication: '   ' }).ok, false, 'a publication is required');
  assert.equal(COV.validate({ ...ok, type: 'blog' }).ok, false);
  assert.equal(COV.validate({ ...ok, year: 1900 }).ok, false);
  assert.equal(COV.validate({ ...ok, year: '' }).value.year, null, 'year optional');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const html = COV.itemHtml({ ...ok, title: '<b>x</b>' }, esc);
  assert.match(html, /target="_blank"/); assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /href="https:\/\/link\.springer\.com\//); assert.doesNotMatch(html, /<b>x/, 'text escaped');
  assert.match(html, /Journal of Anesthesia · 2025 · Meeting report/);
  assert.equal(COV.itemHtml({ ...ok, url: 'http://x.org' }, esc), '', 'never renders a non-https link');
  /* the conference page uses this renderer and loads only approved links */
  const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  assert.match(app, /HoggyCoverage\.itemHtml/); assert.match(app, /\/api\/coverage\?series=/);
});

/* ---------- server ---------- */
async function startServer(t, extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoggy-top-')), port = 20000 + Math.floor(Math.random() * 30000);
  let srv; t.after(() => srv.kill());
  const env = { ...process.env, PORT: String(port), HOGGY_DATA: dir, HOST: '127.0.0.1', HOGGY_ADMIN_KEY: 'test-admin-key', HOGGY_ADMINS: 'admin@example.com', HOGGY_REPORT_MIN_AGE_H: '0', ...TDB.isolate(t), ...extra };
  srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; srv.stdout.on('data', d => out += d); srv.stderr.on('data', d => out += d);
  const B = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) { try { await fetch(B + '/healthz'); break; } catch (e) { await new Promise(r => setTimeout(r, 100)); } }
  return { B, log: () => out };
}
function client(B) {
  let cookie = '';
  const call = async (p, o = {}, h = {}) => { const r = await fetch(B + p, { ...o, headers: { 'X-Requested-With': 'hoggy', 'Content-Type': 'application/json', ...h, cookie } }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; let j = null; try { j = await r.clone().json(); } catch (e) { } return [r.status, j, r]; };
  return { call, register: (email, name) => call('/api/register', { method: 'POST', body: JSON.stringify({ email, password: 'correct-horse-battery', name }) }) };
}
const ALL5 = v => ({ content: v, networking: v, venue: v, value: v, cpd: v });
const post = o => ({ method: 'POST', body: JSON.stringify(o) });

test('GET /api/top-rated: only series with 3+ reviews, weighted order, specialty filter', async (t) => {
  const { B } = await startServer(t), Y = new Date().getUTCFullYear();
  const users = [client(B), client(B), client(B)];
  for (const [i, u] of users.entries()) assert.equal((await u.register(`u${i}${Date.now()}@example.com`, 'Dr ' + i))[0], 201);
  assert.deepEqual((await users[0].call('/api/top-rated'))[1], { min: 3, specialty: null, series: [] }, 'nothing qualifies yet');
  const jsca = seriesKey(byId('jsca-46th-2026')), ash = seriesKey(byId('ash-annual-meeting-2026')), rsna = seriesKey(byId('rsna-annual-meeting-2026'));
  const rate = async (key, vals) => { for (const [i, v] of vals.entries()) assert.equal((await users[i].call('/api/reviews', post({ series: key, editions: [{ year: Y - 4 }], ratings: ALL5(v), text: 'Fair and useful meeting' })))[0], 201); };
  await rate(jsca, [4, 4, 4]); await rate(ash, [5, 5, 4]); await rate(rsna, [5, 5]);
  const [s, top, r] = await users[0].call('/api/top-rated');
  assert.equal(s, 200); assert.match(r.headers.get('cache-control'), /max-age=\d+/, 'cached briefly');
  assert.deepEqual(top.series.map(x => x.seriesKey), [ash, jsca], 'RSNA has only 2 reviews');
  const first = top.series[0];
  assert.equal(first.avg, 4.67); assert.equal(first.n, 3); assert.equal(first.verified, 0); assert.equal(first.specialty, 'Haematology'); assert.ok(first.confId && first.title);
  assert.ok(byId(first.confId), 'links to a real edition');
  const [, onlyAn] = await users[0].call('/api/top-rated?specialty=' + encodeURIComponent('Anaesthesia')); assert.deepEqual(onlyAn.series.map(x => x.seriesKey), [jsca]);
  assert.deepEqual((await users[0].call('/api/top-rated?specialty=Dermatology'))[1].series, []);
  assert.equal((await users[0].call('/api/top-rated?limit=1'))[1].series.length, 1);
  /* a third RSNA review lifts it in, and its 5.0 ranks first */
  const extra = client(B); await extra.register(`x${Date.now()}@example.com`, 'Dr X');
  assert.equal((await extra.call('/api/reviews', post({ series: rsna, editions: [{ year: Y - 4 }], ratings: ALL5(5), text: 'Excellent sessions all round' })))[0], 201);
  assert.deepEqual((await users[0].call('/api/top-rated'))[1].series.map(x => x.seriesKey), [rsna, ash, jsca]);
  /* a review hidden by 3 reports no longer counts: RSNA is back under the threshold */
  const rid = (await users[0].call('/api/my-reviews'))[1].find(m => m.seriesKey === rsna).id;
  for (const u of [users[1], users[2], extra]) assert.equal((await u.call(`/api/reviews/${rid}/report`, { method: 'POST' }))[0], 200);
  assert.deepEqual((await users[0].call('/api/top-rated'))[1].series.map(x => x.seriesKey), [ash, jsca]);
});

test('coverage API: suggestions are pending, only admins approve, public sees approved links only', async (t) => {
  const { B } = await startServer(t), key = seriesKey(byId('jsca-46th-2026')), AK = { 'X-Admin-Key': 'test-admin-key' };
  const u = client(B), v = client(B), admin = client(B);
  await u.register(`cu${Date.now()}@example.com`, 'Dr U'); await v.register(`cv${Date.now()}@example.com`, 'Dr V'); await admin.register('admin@example.com', 'Admin');
  const link = { series: key, type: 'meeting-report', title: 'Meeting highlights', publication: 'Journal of Anesthesia', year: 2025, url: 'https://example.org/ja/2025/highlights' };
  assert.equal((await client(B).call('/api/coverage', post(link)))[0], 401, 'sign in to suggest');
  assert.equal((await u.call('/api/coverage', post({ ...link, url: 'http://example.org/x' })))[0], 400, 'https only');
  const [sp, jp] = await u.call('/api/coverage', post({ ...link, publication: '' })); assert.equal(sp, 400); assert.match(jp.error, /publication/);
  assert.equal((await u.call('/api/coverage', post({ ...link, series: 'not-a-series' })))[0], 400);
  const [s1, j1] = await u.call('/api/coverage', post({ ...link, status: 'approved' })); assert.equal(s1, 201); assert.equal(j1.status, 'pending', 'a client cannot approve its own suggestion');
  assert.equal((await v.call('/api/coverage', post(link)))[0], 409, 'one listing per link per conference');
  assert.deepEqual((await client(B).call('/api/coverage?series=' + key))[1], [], 'pending links are not public');
  assert.deepEqual((await u.call('/api/coverage?conf=jsca-46th-2026'))[1], [], 'not even to the person who suggested it');
  /* only an admin (in HOGGY_ADMINS, with the key) approves */
  assert.equal((await u.call(`/api/admin/coverage/${j1.id}`, post({ action: 'approve' }), AK))[0], 403);
  assert.equal((await admin.call(`/api/admin/coverage/${j1.id}`, post({ action: 'approve' })))[0], 403, 'admin without the key');
  const [, q] = await admin.call('/api/admin/coverage', {}, AK); assert.equal(q.length, 1); assert.equal(q[0].addedBy, (await u.call('/api/me'))[1].user.email); assert.match(q[0].seriesTitle, /Clinical Anesthesia/);
  assert.equal((await admin.call(`/api/admin/coverage/${j1.id}`, post({ action: 'approve' }), AK))[0], 200);
  assert.equal((await admin.call(`/api/admin/coverage/${j1.id}`, post({ action: 'reject' }), AK))[0], 404, 'decided once');
  /* a second suggestion, rejected, never shows */
  const [, j2] = await v.call('/api/coverage', post({ ...link, type: 'news', url: 'https://news.example.com/jsca', title: 'Congress report' }));
  assert.equal((await admin.call(`/api/admin/coverage/${j2.id}`, post({ action: 'reject' }), AK))[0], 200);
  /* admin-added links are published straight away; a conference id works as well as a series key */
  assert.equal((await admin.call('/api/admin/coverage', post({ conf: 'jsca-46th-2026', type: 'abstract-supplement', publication: 'Journal of Anesthesia', year: 2026, url: 'https://example.org/ja/2026/suppl' }), AK))[0], 201);
  assert.equal((await admin.call('/api/admin/coverage', post({ conf: 'jsca-46th-2026', type: 'news', publication: 'X', url: 'ftp://example.org/' }), AK))[0], 400);
  const [, pub] = await client(B).call('/api/coverage?conf=jsca-46th-2026');
  assert.deepEqual(pub.map(x => x.url), ['https://example.org/ja/2026/suppl', 'https://example.org/ja/2025/highlights'], 'approved only, newest year first');
  assert.deepEqual(Object.keys(pub[0]).sort(), ['addedOn', 'id', 'publication', 'seriesKey', 'title', 'type', 'typeLabel', 'url', 'year'], 'who suggested it is not public');
  assert.equal(pub[1].typeLabel, 'Meeting report');
});

test('specialties: the browser copy matches tools/specialties.json, and a saved profile specialty is mapped once', () => {
  const HS = require('../lib/specialties.js'), src = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'specialties.json'), 'utf8'));
  assert.deepEqual(HS.DATA.canonical, src.canonical, 'lib/specialties.js canonical list is out of date: copy it from tools/specialties.json');
  assert.deepEqual(HS.DATA.map, src.map, 'lib/specialties.js map is out of date: copy it from tools/specialties.json');
  const tools = require('../tools/specialties.js');
  for (const v of [...Object.keys(src.map), ...src.canonical, 'Anaesthesiology', 'anesthesiology', 'Pediatrics', 'Obstetrics and Gynecology', 'Not a specialty']) assert.equal(HS.canon(v), tools.canon(v), 'same answer as tools/specialties.js for ' + v);
  assert.equal(HS.canon('Anaesthesiology'), 'Anaesthesia');
  for (const c of CONFS) assert.ok(HS.CANON.has(c.specialty), 'conference specialty is canonical: ' + c.id + ' ' + c.specialty);
  /* app.js runs the migration on load and on state pulled from the server; specV stops it running twice */
  const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8'), fn = app.match(/const SPEC_V = \d+;\nfunction migrateSpecialty\(p\) \{[\s\S]*?\n\}/);
  assert.ok(fn, 'migrateSpecialty in app.js');
  const ctx = { window: { HoggySpecialties: HS } }; vm.runInNewContext(fn[0] + '\nwindow.m = migrateSpecialty;', ctx);
  const p = { specialty: 'Anaesthesiology' }; assert.equal(ctx.window.m(p), true); assert.equal(p.specialty, 'Anaesthesia'); assert.equal(p.specV, 1);
  p.specialty = 'Anaesthesiology'; assert.equal(ctx.window.m(p), false, 'once only: a later choice is left alone'); assert.equal(p.specialty, 'Anaesthesiology');
  const q = { specialty: 'Underwater Basket Medicine' }; ctx.window.m(q); assert.equal(q.specialty, 'Underwater Basket Medicine', 'unknown names are kept');
  assert.match(app, /if \(migrateSpecialty\(S\.profile\)\)/); assert.match(app, /if \(migrateSpecialty\(S\.profile\)\) scheduleSync\(\)/);
  assert.match(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), /<script src="lib\/specialties\.js"><\/script>[\s\S]*<script src="app\.js">/, 'loaded before app.js');
});
