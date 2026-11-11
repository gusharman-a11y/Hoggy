'use strict';
/* Series reviews: series keys, score weighting, verification rules (server-side only), proofs, migration. Run: node --test tests/ */
const test = require('node:test'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process'), path = require('node:path'), fs = require('node:fs'), os = require('node:os'), vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const { seriesKey, seriesTitle, validKey } = require('../lib/series.js');
const RV = require('../lib/reviews.js');
const ROOT = path.join(__dirname, '..');
const CONFS = (() => { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data', 'conferences.js'), 'utf8'), ctx); return ctx.window.HOGGY_CONFERENCES; })();
const byId = id => { const c = CONFS.find(x => x.id === id); assert.ok(c, 'fixture missing ' + id); return c; };

test('series key: editions of the same meeting match across years (real names from data/conferences.js)', () => {
  const jsca = byId('jsca-46th-2026');
  assert.equal(seriesKey(jsca), 'annual-meeting-japan-society-clinical-anesthesia--jsca');
  assert.equal(seriesKey({ ...jsca, name: '47th Annual Meeting of the Japan Society for Clinical Anesthesia', start: '2027-11-11', city: 'Osaka' }), seriesKey(jsca), '46th 2026 = 47th 2027');
  const same = [['jscc-65th-autumn-meeting-2026', '66th Autumn Meeting of the Japanese Society of Clinical Cytology'], ['ash-annual-meeting-2026', 'ASH Annual Meeting and Exposition 2028'], ['snfmi-congres-93-2026', 'Congrès de la SNFMI 2027'], ['sbot-58-congresso-anual-2026', 'Congresso Anual SBOT 2027'], ['socich-xcviii-congreso-cirugia-2026-la-serena', 'XCIX Congreso Chileno e Internacional de Cirugía'], ['isah-2026', 'International Subarachnoid Haemorrhage Conference (ISAH28)'], ['rsna-annual-meeting-2026', 'RSNA Annual Meeting'], ['gp26-racgp', 'GP27']];
  for (const [id, next] of same) { const c = byId(id); assert.equal(seriesKey({ ...c, name: next }), seriesKey(c), `${c.name} ~ ${next}`); }
  /* pairs already in the data set as separate rows */
  const groups = new Map(); for (const c of CONFS) { const k = seriesKey(c); (groups.get(k) || groups.set(k, []).get(k)).push(c); }
  assert.equal(groups.get(seriesKey(byId('bts-winter-meeting-2026'))).length >= 3, true, 'BTS Winter Meeting 2026/2027/2028 form one series');
  assert.ok(groups.size < CONFS.length * 0.8, 'many rows share a series');
});

test('series key: different meetings stay apart', () => {
  assert.notEqual(seriesKey(byId('espen-live-course-ljubljana-2026')), seriesKey(byId('espen-live-course-warsaw-2026')), 'different ESPEN courses');
  assert.notEqual(seriesKey({ name: 'XX Congreso Nacional de Urología', organiser: 'Asociación Española de Urología', city: 'Madrid' }), seriesKey({ name: 'XX Congreso Nacional de Urología', organiser: 'Sociedad Mexicana de Urología', city: 'Cancún' }), 'same name, different organiser');
  assert.match(seriesKey(byId('sabcs-2026')), /^san-antonio-breast-cancer-symposium/, 'a city that is part of the name stays');
  assert.equal(seriesKey({ name: 'ESPEN Live Course on Nutrition in Obesity, Ljubljana', organiser: 'ESPEN', city: 'Ljubljana' }), seriesKey({ name: 'ESPEN Live Course on Nutrition in Obesity, Riga', organiser: 'ESPEN', city: 'Riga' }), 'a trailing host city is dropped');
  for (const c of CONFS) assert.ok(validKey(seriesKey(c)), 'valid key for ' + c.id + ': ' + seriesKey(c));
  assert.equal(seriesTitle(byId('gp26-racgp')), 'GP26'); assert.equal(seriesTitle({ name: 'BTS Winter Meeting 2026' }), 'BTS Winter Meeting');
});

test('scores: verified x1, unverified x0.5, nothing shown under 3 reviews', () => {
  const r = (verify, v, uid) => ({ user_id: uid, verify, rating: v, content: v, networking: v, venue: v, value: v, cpd: null });
  assert.equal(RV.MIN_REVIEWS, 3);
  const two = RV.scoreOf([r('verified', 5, 1), r('none', 1, 2)]);
  assert.equal(two.n, 2); assert.equal(two.avg, null, 'hidden under 3'); assert.equal(two.dims, null);
  const s = RV.scoreOf([r('verified', 5, 1), r('none', 2, 2), r('pending_proof', 2, 3)]);
  assert.equal(s.n, 3); assert.equal(s.verified, 1); assert.equal(s.people, 3);
  assert.equal(s.avg, 3.5, '(5*1 + 2*0.5 + 2*0.5) / 2');
  assert.deepEqual(s.dims.content, { avg: 3.5, n: 3 }); assert.equal(s.dims.cpd, undefined, 'areas nobody rated are left out');
  assert.equal(RV.scoreOf([r('none', 4, 1), r('none', 4, 1), r('none', 4, 2)]).people, 2, 'one person can review several years');
  assert.equal(RV.parseRatings({ content: 5, networking: 4, venue: 3, value: 2, cpd: 1 }).cpd, 1);
  assert.equal(RV.parseRatings({ content: 5, networking: 4, venue: 3, value: 2 }), null, 'all five required');
  assert.equal(RV.parseRatings({ content: 6, networking: 4, venue: 3, value: 2, cpd: 1 }), null);
  assert.equal(RV.parseRatings({ content: 4.5, networking: 4, venue: 3, value: 2, cpd: 1 }), null);
});

test('receipt match: names the conference and sits in the date window', () => {
  const c = { name: '46th Annual Meeting of the Japan Society for Clinical Anesthesia', start: '2025-11-12', end: '2025-11-14' };
  assert.ok(RV.mentions('Thank you for registering for the 46th Annual Meeting of the Japan Society for Clinical Anesthesia.', c));
  assert.ok(!RV.mentions('Hilton Wakayama. Total JPY 40,000', c));
  assert.ok(RV.mentions('Your ESC Congress 2025 delegate registration', { name: 'ESC Congress 2025', start: '2025-08-29' }));
  assert.ok(!RV.mentions('ESC newsletter for 2024 members', { name: 'ESC Congress 2025', start: '2025-08-29' }), 'acronym needs the edition year');
  assert.ok(RV.inWindow('2025-03-01', c), 'early-bird months ahead'); assert.ok(RV.inWindow('2025-11-20', c)); assert.ok(!RV.inWindow('2025-11-30', c)); assert.ok(!RV.inWindow('2024-01-01', c));
});

/* ---------- server ---------- */
async function startServer(t, dir, extra = {}) {
  const port = 20000 + Math.floor(Math.random() * 30000);
  const srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, PORT: String(port), HOGGY_DATA: dir, HOST: '127.0.0.1', HOGGY_ADMIN_KEY: 'test-admin-key', HOGGY_ADMINS: 'admin@example.com', HOGGY_REPORT_MIN_AGE_H: '0', ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; srv.stdout.on('data', d => out += d); srv.stderr.on('data', d => out += d);
  t.after(() => srv.kill());
  const B = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) { try { await fetch(B + '/healthz'); break; } catch (e) { await new Promise(r => setTimeout(r, 100)); } }
  return { B, log: () => out };
}
function client(B) {
  let cookie = '';
  const H = { 'X-Requested-With': 'hoggy', 'Content-Type': 'application/json' };
  const call = async (p, o = {}, h = {}) => { const r = await fetch(B + p, { ...o, headers: { ...H, ...h, cookie } }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; let j = null; try { j = await r.clone().json(); } catch (e) { } return [r.status, j, r]; };
  return { call, register: (email, name) => call('/api/register', { method: 'POST', body: JSON.stringify({ email, password: 'correct-horse-battery', name }) }) };
}
const ALL5 = v => ({ content: v, networking: v, venue: v, value: v, cpd: v });
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF');

test('reviews API: series, one per edition, client cannot forge verified, proof privacy, admin approve, receipt auto-verify', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoggy-rv-')), { B } = await startServer(t, dir);
  const key = seriesKey(byId('jsca-46th-2026')), Y = new Date().getUTCFullYear();
  const a = client(B), b = client(B), c = client(B), admin = client(B);
  const [s1, ra] = await a.register(`a${Date.now()}@example.com`, 'Dr A'); assert.equal(s1, 201);
  await b.register(`b${Date.now()}@example.com`, 'Dr B'); await c.register(`c${Date.now()}@example.com`, 'Dr C'); await admin.register('admin@example.com', 'Admin');

  /* signed out: may read, may not post */
  assert.equal((await client(B).call('/api/reviews', { method: 'POST', body: JSON.stringify({ series: key, editions: [{ year: Y - 1 }], ratings: ALL5(4), text: 'Good programme' }) }))[0], 401);
  assert.equal((await a.call('/api/reviews', { method: 'POST', body: JSON.stringify({ series: 'nope-not-a-series', editions: [{ year: Y - 1 }], ratings: ALL5(4), text: 'Good programme' }) }))[0], 400, 'unknown series');
  assert.equal((await a.call('/api/reviews', { method: 'POST', body: JSON.stringify({ series: key, editions: [{ year: Y - 1 }], ratings: { content: 4 }, text: 'Good programme' }) }))[0], 400, 'all five ratings');
  assert.equal((await a.call('/api/reviews', { method: 'POST', body: JSON.stringify({ series: key, editions: [{ year: Y - 11 }], ratings: ALL5(4), text: 'Good programme' }) }))[0], 400, 'more than 10 years back');
  assert.equal((await a.call('/api/reviews', { method: 'POST', body: JSON.stringify({ series: key, editions: [{ year: Y + 1 }], ratings: ALL5(4), text: 'Good programme' }) }))[0], 400, 'future year');
  { const today = new Date().toISOString().slice(0, 10), fut = CONFS.find(x => x.start.startsWith(String(Y)) && x.start > today);
    if (fut) assert.equal((await a.call('/api/reviews', { method: 'POST', body: JSON.stringify({ series: seriesKey(fut), editions: [{ year: Y }], ratings: ALL5(4), text: 'Good programme' }) }))[0], 400, 'this year\'s meeting has not happened yet'); }

  /* forge attempts: synced state claims an attended trip with proof; the request claims verified */
  assert.equal((await a.call('/api/state', { method: 'PUT', body: JSON.stringify({ state: { trips: [{ id: 't1', confId: 'jsca-46th-2026', status: 'attended', verified: true }], proofs: [{ confId: 'jsca-46th-2026' }] }, baseRev: 0 }) }))[0], 200);
  const [s2, made] = await a.call('/api/reviews', { method: 'POST', body: JSON.stringify({ series: key, editions: [{ year: Y - 8, city: 'Kobe' }, { year: Y - 9, city: 'Sapporo' }], ratings: { ...ALL5(4), content: 5 }, text: 'Strong programme, well run', verified: true, verify: 'verified', status: 'verified', role: 'Verified attendee', verified_by: 'admin' }) });
  assert.equal(s2, 201); assert.equal(made.reviews.length, 2, 'two past years in one go');
  assert.ok(made.reviews.every(r => r.verify === 'none'), 'client fields and synced state never verify');
  const [, list1] = await a.call('/api/reviews?series=' + key);
  assert.equal(list1.length, 2); assert.equal(list1[0].editionYear, Y - 8); assert.equal(list1[0].city, 'Kobe'); assert.equal(list1[0].verified, false); assert.equal(list1[0].mine, true); assert.equal(list1[0].ratings.content, 5); assert.equal(list1[0].rating, 4.2);
  const [, byConf] = await a.call('/api/reviews?conf=jsca-46th-2026'); assert.equal(byConf.length, 2, 'a conference page shows its whole series');
  const [, asB] = await b.call('/api/reviews?series=' + key); assert.equal(asB[0].mine, false); assert.equal(asB[0].verify, undefined, 'others do not see proof state');

  /* one review per user per series per edition year; editable by its author only */
  const [s3, j3] = await a.call('/api/reviews', { method: 'POST', body: JSON.stringify({ series: key, editions: [{ year: Y - 8 }], ratings: ALL5(3), text: 'Second go at it' }) });
  assert.equal(s3, 409); assert.deepEqual(j3.years, [Y - 8]);
  const rid = list1[0].id;
  assert.equal((await b.call('/api/reviews/' + rid, { method: 'PUT', body: JSON.stringify({ ratings: ALL5(1), text: 'Hijacked review text' }) }))[0], 404, 'another user cannot edit');
  assert.equal((await b.call('/api/reviews/' + rid, { method: 'DELETE' }))[0], 404, 'another user cannot delete');
  assert.equal((await a.call('/api/reviews/' + rid, { method: 'PUT', body: JSON.stringify({ ratings: ALL5(3), text: 'Updated after a rethink', verify: 'verified' }) }))[0], 200);
  const [, list2] = await a.call('/api/reviews?series=' + key); const mine = list2.find(r => r.id === rid);
  assert.equal(mine.text, 'Updated after a rethink'); assert.equal(mine.rating, 3); assert.equal(mine.verified, false, 'edit cannot verify');

  /* score: hidden under 3 reviews, then weighted */
  let [, rt] = await a.call('/api/ratings'); assert.equal(rt[key].n, 2); assert.equal(rt[key].avg, null, 'not enough reviews yet');
  assert.equal((await b.call('/api/reviews', { method: 'POST', body: JSON.stringify({ series: key, editions: [{ year: Y - 7 }], ratings: ALL5(5), text: 'Excellent workshops' }) }))[0], 201);
  [, rt] = await a.call('/api/ratings'); assert.equal(rt[key].n, 3); assert.equal(rt[key].verified, 0); assert.ok(rt[key].avg > 3 && rt[key].avg < 5);

  /* proof upload: type, magic bytes, size, owner */
  const up = (cl, id, body, type = 'application/pdf', kind = 'certificate') => cl.call(`/api/reviews/${id}/proof?kind=${kind}&name=cert.pdf`, { method: 'POST', body }, { 'Content-Type': type });
  assert.equal((await up(b, rid, PDF))[0], 404, 'only the author can add proof');
  assert.equal((await up(a, rid, Buffer.from('MZ not a pdf')))[0], 415, 'magic bytes checked');
  assert.equal((await up(a, rid, PDF, 'image/webp'))[0], 415, 'PDF/JPG/PNG only');
  assert.equal((await up(a, rid, PDF, 'application/pdf', 'selfie'))[0], 400);
  assert.equal((await client(B).call(`/api/reviews/${rid}/proof?kind=cpd`, { method: 'POST', body: PDF }, { 'Content-Type': 'application/pdf' }))[0], 401, 'needs a session');
  const big = await up(a, rid, Buffer.concat([PDF, Buffer.alloc(5.2e6)])).then(r => r[0], () => 413); assert.equal(big, 413, 'size limit (5 MB)');
  const [s4, j4] = await up(a, rid, PDF); assert.equal(s4, 201); assert.equal(j4.verify, 'pending_proof');
  const [, list3] = await a.call('/api/reviews?series=' + key); const pend = list3.find(r => r.id === rid);
  assert.equal(pend.verify, 'pending_proof'); assert.equal(pend.proof, 'pending'); assert.equal(pend.verified, false, 'pending is still unverified');

  /* proof file privacy */
  const [, q1] = await admin.call('/api/admin/proofs', {}, { 'X-Admin-Key': 'test-admin-key' }); assert.equal(q1.length, 1); const pid = q1[0].id;
  assert.equal(q1[0].reviewId, rid); assert.equal(q1[0].editionYear, Y - 8); assert.equal(q1[0].kindLabel, 'Certificate of attendance');
  assert.equal((await a.call(`/api/admin/proofs/${pid}/file`, {}, { 'X-Admin-Key': 'test-admin-key' }))[0], 403, 'the author is not an admin');
  assert.equal((await b.call(`/api/admin/proofs/${pid}/file`))[0], 403, 'other users: 403');
  assert.equal((await client(B).call(`/api/admin/proofs/${pid}/file`))[0], 401, 'signed out: 401');
  assert.equal((await admin.call(`/api/admin/proofs/${pid}/file`))[0], 403, 'admin without the key: 403');
  assert.equal((await a.call(`/api/reviews/${rid}/proof`))[0], 404, 'no public GET for proofs');
  assert.equal((await fetch(B + '/data-store/hoggy.db')).status, 404); assert.equal((await a.call(`/api/proofs/${pid}`))[0], 404); assert.equal((await a.call(`/api/files/${pid}`))[0], 404, "not a receipt file either");
  assert.equal((await a.call(`/api/admin/proofs/${pid}`, { method: 'POST', body: JSON.stringify({ action: 'approve' }) }, { 'X-Admin-Key': 'test-admin-key' }))[0], 403, 'author cannot approve own proof');
  const [sf, , rf] = await admin.call(`/api/admin/proofs/${pid}/file`, {}, { 'X-Admin-Key': 'test-admin-key' }); assert.equal(sf, 200);
  assert.ok(Buffer.from(await rf.arrayBuffer()).equals(PDF)); assert.match(rf.headers.get('cache-control'), /no-store/); assert.match(rf.headers.get('content-disposition'), /attachment/);

  /* admin approve -> verified; file deleted */
  assert.equal((await admin.call(`/api/admin/proofs/${pid}`, { method: 'POST', body: JSON.stringify({ action: 'approve' }) }, { 'X-Admin-Key': 'test-admin-key' }))[0], 200);
  const [, list4] = await b.call('/api/reviews?series=' + key); assert.equal(list4.find(r => r.id === rid).verified, true, 'approved proof verifies');
  assert.equal((await admin.call(`/api/admin/proofs/${pid}/file`, {}, { 'X-Admin-Key': 'test-admin-key' }))[0], 410, 'file deleted after the decision');
  assert.equal((await up(a, rid, PDF))[0], 409, 'already verified');
  [, rt] = await a.call('/api/ratings'); assert.equal(rt[key].verified, 1);
  /* reject flow: back to unverified */
  const other = made.reviews.find(r => r.id !== rid).id; await up(a, other, PDF, 'application/pdf', 'cpd');
  const [, q2] = await admin.call('/api/admin/proofs', {}, { 'X-Admin-Key': 'test-admin-key' });
  assert.equal((await admin.call(`/api/admin/proofs/${q2[0].id}`, { method: 'POST', body: JSON.stringify({ action: 'reject', note: 'name does not match' }) }, { 'X-Admin-Key': 'test-admin-key' }))[0], 200);
  const [, list5] = await a.call('/api/reviews?series=' + key); const rej = list5.find(r => r.id === other); assert.equal(rej.verify, 'none'); assert.equal(rej.proof, 'rejected');

  /* reports reuse the moderation queue */
  assert.equal((await a.call(`/api/reviews/${rid}/report`, { method: 'POST' }))[0], 400, 'cannot report own');
  assert.equal((await b.call(`/api/reviews/${rid}/report`, { method: 'POST' }))[0], 200);
  const [, rep] = await admin.call('/api/admin/reported', {}, { 'X-Admin-Key': 'test-admin-key' }); assert.equal(rep[0].id, rid); assert.equal(rep[0].editionYear, Y - 8); assert.match(rep[0].title, /Clinical Anesthesia/);

  /* automatic verification: a registration receipt the server received by email for an edition that has happened */
  assert.equal((await admin.call('/api/admin/conferences/jsca-46th-2026', { method: 'POST', body: JSON.stringify({ patch: { start: `${Y - 5}-11-12`, end: `${Y - 5}-11-14` } }) }, { 'X-Admin-Key': 'test-admin-key' }))[0], 200, 'test fixture: an edition that has happened');
  const [, cm] = await c.call('/api/me'); const secret = fs.readFileSync(path.join(dir, 'inbound-secret.txt'), 'utf8').trim();
  const mail = body => fetch(B + '/api/inbound/email', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hoggy-Secret': secret }, body: JSON.stringify({ To: cm.user.inbox, From: 'Congress Secretariat <reg@congre.co.jp>', ...body }) });
  assert.equal((await mail({ Subject: 'Hotel receipt', TextBody: `Hilton Wakayama\nTotal JPY 40,000.00\n${Y - 5}-11-12\n46th Annual Meeting of the Japan Society for Clinical Anesthesia` })).status, 200);
  const [s5, mc] = await c.call('/api/reviews', { method: 'POST', body: JSON.stringify({ series: key, editions: [{ year: Y - 5 }], ratings: ALL5(4), text: 'Useful refresher sessions' }) });
  assert.equal(s5, 201); assert.equal(mc.reviews[0].verify, 'none', 'a hotel receipt is not a registration receipt');
  assert.equal((await mail({ Subject: 'Registration confirmation', TextBody: `Thank you for registering for the 46th Annual Meeting of the Japan Society for Clinical Anesthesia.\nTotal JPY 20,000.00\nPaid ${Y - 5}-08-01` })).status, 200);
  const [, list6] = await c.call('/api/reviews?series=' + key); assert.equal(list6.find(r => r.id === mc.reviews[0].id).verified, true, 'matching registration receipt verifies the existing review');
  const [, myc] = await c.call('/api/my-reviews'); assert.equal(myc[0].verify, 'verified');
});

test('migration: old per-conference reviews move into the series model; client-derived verified flags are reset', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoggy-mig-')), d = new DatabaseSync(path.join(dir, 'hoggy.db'));
  d.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, pass TEXT NOT NULL, inbox TEXT UNIQUE NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE reviews(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, conf_id TEXT NOT NULL, rating INTEGER NOT NULL, text TEXT NOT NULL, author TEXT NOT NULL, role TEXT, created INTEGER NOT NULL, dims TEXT, verified INTEGER DEFAULT 0, UNIQUE(user_id, conf_id));
    CREATE TABLE review_reports(review_id INTEGER NOT NULL, user_id INTEGER NOT NULL, created INTEGER NOT NULL, weight INTEGER DEFAULT 1, PRIMARY KEY(review_id, user_id));
    INSERT INTO users VALUES(1,'old@example.com','Old','x:y','dr-00000000000000000001',1);
    INSERT INTO reviews VALUES(7,1,'jsca-46th-2026',5,'Great meeting, would go again','Old','Verified attendee',1700000000000,'{"content":5,"value":4}',1);
    INSERT INTO reviews VALUES(8,1,'not-in-the-data-2024',3,'An event that no longer exists','Old','Member',1700000000000,NULL,0);
    INSERT INTO review_reports VALUES(7,1,1,1);`);
  d.close();
  const { B, log } = await startServer(t, dir);
  const [, rv] = await client(B).call('/api/reviews?series=' + seriesKey(byId('jsca-46th-2026')));
  assert.equal(rv.length, 1); assert.equal(rv[0].id, 7, 'id kept, so reports stay attached'); assert.equal(rv[0].text, 'Great meeting, would go again');
  assert.equal(rv[0].verified, false, 'verified flag from client state reset'); assert.equal(rv[0].editionYear, 2026); assert.equal(rv[0].city, 'Wakayama');
  assert.equal(rv[0].ratings.content, 5); assert.equal(rv[0].ratings.value, 4); assert.equal(rv[0].ratings.networking, null); assert.equal(rv[0].rating, 5);
  assert.match(log(), /reviews migrated to series model: 2/);
  const d2 = new DatabaseSync(path.join(dir, 'hoggy.db'));
  assert.equal(d2.prepare('SELECT COUNT(*) n FROM reviews_v1').get().n, 2, 'legacy table kept');
  assert.equal(d2.prepare("SELECT COUNT(*) n FROM reviews WHERE verify='verified'").get().n, 0);
  assert.equal(d2.prepare("SELECT series_key k FROM reviews WHERE id=8").get().k, 'not-in-the-data', 'unknown conference kept with a best-effort key');
  d2.close();
});

test('admin endpoints need the account in HOGGY_ADMINS and HOGGY_ADMIN_KEY', async (t) => {
  const { B, log } = await startServer(t, fs.mkdtempSync(path.join(os.tmpdir(), 'hoggy-nokey-')), { HOGGY_ADMIN_KEY: '' });
  const adm = client(B); await adm.register('admin@example.com', 'Admin');
  const [s, j] = await adm.call('/api/admin/proofs', {}, { 'X-Admin-Key': '' }); assert.equal(s, 403); assert.match(j.error, /HOGGY_ADMIN_KEY/);
  assert.match(log(), /HOGGY_ADMINS is set but HOGGY_ADMIN_KEY is not/);
});
