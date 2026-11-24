'use strict';
/* Postgres only (npm run test:pg; skipped by npm test): the schema file, security, and two serverless instances sharing one
   database. Run: npm run test:pg */
const test = require('node:test'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process'), path = require('node:path'), fs = require('node:fs'), crypto = require('node:crypto'), vm = require('node:vm');
const TDB = require('./_db.js');
const { toPg, placeholders } = require('../lib/db.js');
const ROOT = path.join(__dirname, '..');
const SKIP = !TDB.PG && 'needs Postgres: npm run test:pg';
const INIT = fs.readFileSync(path.join(ROOT, 'db', 'postgres', '001_init.sql'), 'utf8');
const STEP2 = fs.readFileSync(path.join(ROOT, 'db', 'postgres', '002_receipt_checks_coverage.sql'), 'utf8');
const STEP3 = fs.readFileSync(path.join(ROOT, 'db', 'postgres', '003_hospitals.sql'), 'utf8');
const STEP4 = fs.readFileSync(path.join(ROOT, 'db', 'postgres', '004_submissions_reports.sql'), 'utf8');
const N_CONFS = (() => { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data', 'conferences.js'), 'utf8'), ctx); return ctx.window.HOGGY_CONFERENCES.length; })();

test('adapter: placeholders and schema-qualified table names', () => {
  assert.equal(placeholders("SELECT 1 FROM t WHERE a=? AND b='?' AND c=?"), "SELECT 1 FROM t WHERE a=$1 AND b='?' AND c=$2");
  assert.equal(toPg('SELECT r.*, (SELECT status FROM review_proofs p WHERE p.review_id=r.id) proof FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.id=?', 'hoggy'),
    'SELECT r.*, (SELECT status FROM hoggy.review_proofs p WHERE p.review_id=r.id) proof FROM hoggy.reviews r JOIN hoggy.users u ON u.id=r.user_id WHERE r.id=$1');
  assert.equal(toPg('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', 's1'), 'INSERT INTO s1.meta(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  assert.equal(toPg('UPDATE reviews_v1 SET a=1', 'h'), 'UPDATE h.reviews_v1 SET a=1');
  /* every table the server queries is known to the adapter (an unqualified table would fail in Postgres) */
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'lib', 'ingest.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'lib', 'hospital-api.js'), 'utf8');
  const used = new Set([...src.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE)\s+([a-z_][a-z0-9_]*)\b(?!\s*\.)/g)].map(m => m[1]));
  const { TABLES } = require('../lib/db.js');
  for (const t of used) if (!['reviews_v1', 'set'].includes(t)) assert.ok(TABLES.includes(t), 'adapter does not qualify table ' + t);
  assert.match(JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')).functions['api/index.js'].includeFiles, /db\/\*\*/, 'the schema file ships to Vercel');
  /* the schema file creates every table the server uses */
  for (const t of TABLES.filter(x => !['proofs', 'reviews_v1'].includes(x))) assert.match(INIT + STEP2 + STEP3 + STEP4, new RegExp(`CREATE TABLE IF NOT EXISTS hoggy\\.${t}\\(`), 'missing in db/postgres/*.sql: ' + t);
  assert.deepEqual(fs.readdirSync(path.join(ROOT, 'db', 'postgres')).sort(), ['001_init.sql', '002_receipt_checks_coverage.sql', '003_hospitals.sql', '004_submissions_reports.sql'], 'numbered schema files');
});

test('001_init.sql: runs on a fresh database, runs again, RLS on with no policies, nothing for anon/authenticated', { skip: SKIP }, async (t) => {
  /* a fresh database, so the file runs exactly as written (schema `hoggy`) */
  const dbName = 'hoggy_fresh_' + crypto.randomBytes(4).toString('hex'), u = new URL(TDB.PG_URL); u.pathname = '/' + dbName;
  await TDB.pgQuery(`CREATE DATABASE ${dbName}`);
  const { Client } = require('pg'), c = new Client({ connectionString: u.href }); let srv = null;
  c.on('error', () => { });
  t.after(async () => { /* one hook, in order: server, client, database */
    if (srv) srv.kill(); await c.end().catch(() => { }); await new Promise(r => setTimeout(r, 300));
    await TDB.pgQuery(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() => { });
  });
  await c.connect();
  /* Supabase has these roles; a plain Postgres does not */
  for (const r of ['anon', 'authenticated']) await c.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${r}') THEN CREATE ROLE ${r} NOLOGIN; END IF; END $$`);
  await c.query(INIT);
  await c.query(INIT); /* idempotent */
  await c.query(STEP2); await c.query(STEP2); /* 002 on top of 001, twice */
  await c.query(STEP3); await c.query(STEP3); /* 003 on top, twice */
  await c.query(STEP4); await c.query(STEP4); /* 004 on top, twice */
  const tables = (await c.query("SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='hoggy' AND c.relkind='r' ORDER BY 1")).rows;
  assert.deepEqual(tables.map(r => r.relname), ['allowances', 'approvals', 'attend_receipts', 'candidates', 'claims', 'conferences', 'coverage', 'date_changes', 'files', 'inbox', 'ingest_runs', 'listing_reports', 'memberships', 'meta', 'notifications', 'orgs', 'rate_hits', 'receipt_checks', 'review_proofs', 'review_reports', 'reviews', 'sessions', 'state', 'submissions', 'users']);
  /* 002's checks: https only, a publication, a known type */
  await assert.rejects(c.query("INSERT INTO hoggy.coverage(series_key,type,publication,url,added_on) VALUES('s','news','BMJ','http://x.org',1)"), e => e.code === '23514', 'http refused');
  await assert.rejects(c.query("INSERT INTO hoggy.coverage(series_key,type,publication,url,added_on) VALUES('s','news','  ','https://x.org',1)"), e => e.code === '23514', 'empty publication refused');
  await assert.rejects(c.query("INSERT INTO hoggy.coverage(series_key,type,publication,url,added_on) VALUES('s','blog','BMJ','https://x.org',1)"), e => e.code === '23514', 'unknown type refused');
  /* 003's checks: join code alphabet, one hospital per user, known roles and statuses, positive amounts */
  await assert.rejects(c.query("INSERT INTO hoggy.orgs(name,join_code,created) VALUES('H','ABCD0FGH',1)"), e => e.code === '23514', 'code without 0/O/1/I');
  await c.query("INSERT INTO hoggy.orgs(name,join_code,created) VALUES('H','ABCDEFGH',1)");
  await assert.rejects(c.query("INSERT INTO hoggy.orgs(name,join_code,created) VALUES('H2','ABCDEFGH',1)"), e => e.code === '23505', 'unique join code');
  await c.query("INSERT INTO hoggy.users(email,pass,inbox,created) VALUES('m@example.com','x:y','dr-m',1)");
  const ids = (await c.query("SELECT (SELECT id FROM hoggy.users WHERE email='m@example.com') u, (SELECT id FROM hoggy.orgs WHERE join_code='ABCDEFGH') o")).rows[0];
  await assert.rejects(c.query('INSERT INTO hoggy.memberships(user_id,org_id,role,created) VALUES($1,$2,$3,1)', [ids.u, ids.o, 'owner']), e => e.code === '23514', 'unknown role');
  await c.query('INSERT INTO hoggy.memberships(user_id,org_id,role,created) VALUES($1,$2,$3,1)', [ids.u, ids.o, 'admin']);
  await assert.rejects(c.query('INSERT INTO hoggy.memberships(user_id,org_id,role,created) VALUES($1,$2,$3,1)', [ids.u, ids.o, 'doctor']), e => e.code === '23505', 'one hospital per user');
  await assert.rejects(c.query("INSERT INTO hoggy.approvals(org_id,user_id,trip_ref,snapshot,year,estimate_cents,currency,status,created,updated) VALUES($1,$2,'t1','{}',2027,100,'AUD','maybe',1,1)", [ids.o, ids.u]), e => e.code === '23514', 'unknown approval status');
  await assert.rejects(c.query("INSERT INTO hoggy.claims(org_id,user_id,trip_ref,snapshot,year,total_cents,currency,submitted) VALUES($1,$2,'t1','{}',2027,0,'AUD',1)", [ids.o, ids.u]), e => e.code === '23514', 'claim total above zero');
  await c.query('DELETE FROM hoggy.users WHERE id=$1', [ids.u]);
  assert.equal((await c.query('SELECT COUNT(*)::int n FROM hoggy.memberships')).rows[0].n, 0, 'membership goes with the user');
  await c.query('DELETE FROM hoggy.orgs');
  /* 004's checks: known statuses and report reasons */
  await assert.rejects(c.query("INSERT INTO hoggy.submissions(id,json,contact_email,status,created) VALUES('s1','{}','a@b.org','live',1)"), e => e.code === '23514', 'unknown submission status');
  await assert.rejects(c.query("INSERT INTO hoggy.listing_reports(kind,ref_id,reason,created) VALUES('conference','x','rude',1)"), e => e.code === '23514', 'unknown report reason');
  assert.ok(tables.every(r => r.relrowsecurity), 'RLS enabled on every table');
  assert.equal((await c.query("SELECT COUNT(*)::int n FROM pg_policies WHERE schemaname='hoggy'")).rows[0].n, 0, 'no policies');
  /* even if someone grants anon SELECT, RLS without policies returns nothing */
  await c.query("INSERT INTO hoggy.users(email,pass,inbox,created) VALUES('rls@example.com','x:y','dr-rls',1)");
  await c.query('GRANT USAGE ON SCHEMA hoggy TO anon; GRANT SELECT ON hoggy.users TO anon');
  await c.query('SET ROLE anon'); assert.equal((await c.query('SELECT COUNT(*)::int n FROM hoggy.users')).rows[0].n, 0, 'RLS hides every row from anon'); await c.query('RESET ROLE');
  /* running the file again (as the server does on a cold start) takes that grant away */
  await c.query(INIT); await c.query(STEP2); await c.query(STEP3); await c.query(STEP4);
  await c.query('GRANT SELECT ON hoggy.coverage TO anon'); await c.query(STEP2); /* 002 takes a stray grant away too */
  await c.query('GRANT SELECT ON hoggy.approvals, hoggy.claims TO anon'); await c.query(STEP3); /* and 003 */
  await c.query('GRANT SELECT ON hoggy.submissions, hoggy.listing_reports TO anon'); await c.query(STEP4); /* and 004 */
  for (const r of ['anon', 'authenticated']) {
    await c.query(`SET ROLE ${r}`);
    await assert.rejects(c.query('SELECT 1 FROM hoggy.users'), e => e.code === '42501', r + ' has no access');
    await c.query('RESET ROLE');
    for (const tb of tables) assert.equal((await c.query(`SELECT has_table_privilege('${r}', 'hoggy.${tb.relname}', 'SELECT') p`)).rows[0].p, false, `${r} cannot read ${tb.relname}`);
  }
  /* the server's own migration is safe on top of a hand-applied schema: it re-runs the file once and records its hash */
  const port = 20000 + Math.floor(Math.random() * 30000);
  srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATABASE_URL: u.href, HOGGY_PG_SCHEMA: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; srv.stdout.on('data', d => out += d); srv.stderr.on('data', d => out += d);
  let hz; for (let i = 0; i < 150 && !hz; i++) { try { hz = await (await fetch(`http://127.0.0.1:${port}/healthz`)).json(); } catch (e) { await new Promise(r => setTimeout(r, 100)); } }
  assert.equal(hz.db, 'pg'); assert.equal(hz.conferences, N_CONFS, out);
  assert.match(out, /postgres schema hoggy is up to date \(001_init\.sql applied\)/); assert.match(out, /postgres schema hoggy is up to date \(002_receipt_checks_coverage\.sql applied\)/); assert.match(out, /\(003_hospitals\.sql applied\)/); assert.match(out, /\(004_submissions_reports\.sql applied\)/); assert.doesNotMatch(out, /migration failed/);
  assert.equal((await c.query("SELECT COUNT(*)::int n FROM hoggy.meta WHERE key IN ('schema_hash','schema_hash:002','schema_hash:003','schema_hash:004','conf_seed_hash','inbound_secret')")).rows[0].n, 6);
});

/* ---------- two serverless instances: two processes, each loading api/index.js (as Vercel does), one database ---------- */
function instance(t, env, name) {
  const port = 20000 + Math.floor(Math.random() * 30000);
  const code = `const h = require(${JSON.stringify(path.join(ROOT, 'api', 'index.js'))}); require('node:http').createServer(h).listen(${port}, '127.0.0.1', () => console.log('listening'));`;
  const p = spawn(process.execPath, ['-e', code], { env: { ...process.env, VERCEL: '1', HOGGY_ADMIN_KEY: 'k2', HOGGY_ADMINS: 'boss@example.com', HOGGY_REPORT_MIN_AGE_H: '0', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d); t.after(() => p.kill());
  return { B: `http://127.0.0.1:${port}`, name, log: () => out };
}
async function up(i) { for (let k = 0; k < 200; k++) { try { const r = await fetch(i.B + '/healthz'); if (r.ok) return r.json(); } catch (e) { } await new Promise(r => setTimeout(r, 100)); } throw new Error(i.name + ' did not start: ' + i.log()); }
/* a browser-like client; X-Forwarded-For is set because on Vercel the client IP comes from the proxy */
function client(ip = '203.0.113.7') {
  let cookie = '';
  const call = async (inst, p, o = {}, h = {}) => {
    const r = await fetch(inst.B + p, { ...o, headers: { 'X-Requested-With': 'hoggy', 'Content-Type': 'application/json', 'X-Forwarded-For': ip, ...h, cookie } });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    let j = null; try { j = await r.clone().json(); } catch (e) { } return [r.status, j, r];
  };
  return { call, get cookie() { return cookie; }, set cookie(v) { cookie = v; } };
}
const body = o => ({ method: 'POST', body: JSON.stringify(o) });

test('two instances on one Postgres: accounts, sessions, reviews, files, inbound secret and rate limits are shared', { skip: SKIP }, async (t) => {
  const env = TDB.isolate(t); /* one schema for both instances; no HOGGY_INBOUND_SECRET: it must come from the database */
  delete process.env.HOGGY_INBOUND_SECRET;
  const A = instance(t, env, 'A'), B = instance(t, env, 'B'); /* both cold-start at once: schema lock and seed race */
  const [ha, hb] = await Promise.all([up(A), up(B)]);
  assert.equal(ha.db, 'pg'); assert.equal(hb.db, 'pg'); assert.equal(ha.conferences, N_CONFS); assert.equal(hb.conferences, N_CONFS, 'no duplicate seed rows');
  assert.doesNotMatch(await (await fetch(A.B + '/')).text(), /demo-note|Preview/, 'no "Preview — resets" note with a database');

  /* register on A, sign in on B */
  const email = `doc${Date.now()}@example.com`, pw = 'correct-horse-battery', u1 = client();
  const [s1, reg] = await u1.call(A, '/api/register', body({ email, password: pw, name: 'Dr One' })); assert.equal(s1, 201);
  assert.equal((await u1.call(B, '/api/me'))[1].user.email, email, 'a session made on A works on B');
  const u2 = client();
  const [s2, lg] = await u2.call(B, '/api/login', body({ email, password: pw })); assert.equal(s2, 200, 'log in on B with an account made on A'); assert.equal(lg.user.id, reg.user.id);
  assert.equal((await u2.call(A, '/api/me'))[1].user.email, email);
  const [s3, j3] = await client().call(B, '/api/register', body({ email, password: pw })); assert.equal(s3, 409); assert.match(j3.error, /already registered/);
  const [s4, j4] = await client().call(A, '/api/login', body({ email, password: 'not-the-password' })); assert.equal(s4, 401); assert.match(j4.error, /Wrong email or password/);
  const [s5, j5] = await client().call(A, '/api/register', body({ email: 'short@example.com', password: 'abc' })); assert.equal(s5, 400); assert.match(j5.error, /at least 10 characters/);

  /* synced state: a write accepted on A makes the same base revision stale on B */
  assert.equal((await u1.call(A, '/api/state', { method: 'PUT', body: JSON.stringify({ state: { trips: [] }, baseRev: 0 }) }))[0], 200);
  assert.equal((await u2.call(B, '/api/state', { method: 'PUT', body: JSON.stringify({ state: { trips: [1] }, baseRev: 0 }) }))[0], 409);
  assert.deepEqual((await u2.call(B, '/api/state'))[1], { state: { trips: [] }, rev: 1 });

  /* reviews written on A are visible on B */
  const confs = (await (await fetch(B.B + '/api/conferences')).json()).conferences, c0 = confs.find(c => c.id === 'jsca-46th-2026');
  const key = require('../lib/series.js').seriesKey(c0), Y = new Date().getUTCFullYear();
  const [s6, made] = await u1.call(A, '/api/reviews', body({ series: key, editions: [{ year: Y - 3, city: 'Kobe' }], ratings: { content: 5, networking: 4, venue: 4, value: 3, cpd: 4 }, text: 'Strong programme, well run' }));
  assert.equal(s6, 201);
  const [, onB] = await client().call(B, '/api/reviews?series=' + key); assert.equal(onB.length, 1); assert.equal(onB[0].text, 'Strong programme, well run'); assert.equal(onB[0].mine, false);
  assert.equal((await u2.call(B, '/api/reviews?series=' + key))[1][0].mine, true);
  assert.equal((await u2.call(B, '/api/reviews', body({ series: key, editions: [{ year: Y - 3 }], ratings: { content: 1, networking: 1, venue: 1, value: 1, cpd: 1 }, text: 'Duplicate from B' })))[0], 409, 'one review per edition, across instances');

  /* proof upload on A (BYTEA), admin reads and approves it on B */
  const PDF = Buffer.from('%PDF-1.4\n' + 'x'.repeat(200000) + '\n%%EOF'), rid = made.reviews[0].id;
  assert.equal((await u1.call(A, `/api/reviews/${rid}/proof?kind=certificate&name=cert.pdf`, { method: 'POST', body: PDF }, { 'Content-Type': 'application/pdf' }))[0], 201);
  const boss = client('198.51.100.9'); assert.equal((await boss.call(B, '/api/register', body({ email: 'boss@example.com', password: pw, name: 'Boss' })))[0], 201);
  const [, queue] = await boss.call(B, '/api/admin/proofs', {}, { 'X-Admin-Key': 'k2' }); assert.equal(queue.length, 1);
  const [, , fr] = await boss.call(B, `/api/admin/proofs/${queue[0].id}/file`, {}, { 'X-Admin-Key': 'k2' }); assert.ok(Buffer.from(await fr.arrayBuffer()).equals(PDF), 'file bytes intact across instances');
  assert.equal((await boss.call(B, `/api/admin/proofs/${queue[0].id}`, body({ action: 'approve' }), { 'X-Admin-Key': 'k2' }))[0], 200);
  assert.equal((await client().call(A, '/api/reviews?series=' + key))[1][0].verified, true, 'approval on B shows on A');

  /* receipt files: stored on A, read on B */
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), crypto.randomBytes(5000)]);
  assert.equal((await u1.call(A, '/api/rfile/r-1?name=r.png', { method: 'PUT', body: png }, { 'Content-Type': 'image/png' }))[0], 200);
  assert.deepEqual((await u2.call(B, '/api/rfiles'))[1], ['r-1']);
  const [, , gr] = await u2.call(B, '/api/rfile/r-1'); assert.ok(Buffer.from(await gr.arrayBuffer()).equals(png));

  /* inbound email: both instances use the secret stored once in the database */
  const secret = (await TDB.pgQuery(`SELECT value FROM ${env.HOGGY_PG_SCHEMA}.meta WHERE key='inbound_secret'`))[0].value;
  assert.match(secret, /^[a-f0-9]{48}$/);
  for (const inst of [A, B]) {
    const r = await fetch(inst.B + '/api/inbound/email', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hoggy-Secret': secret }, body: JSON.stringify({ To: reg.user.inbox, From: 'Hotel <a@h.com>', Subject: 'Receipt ' + inst.name, TextBody: 'Total $100.00' }) });
    assert.equal(r.status, 200, 'secret accepted by ' + inst.name);
  }
  assert.equal((await u1.call(A, '/api/inbox'))[1].length, 2);

  /* login rate limit is shared: 10 failures for one email, split over A and B, lock it on both */
  const victim = `v${Date.now()}@example.com`; assert.equal((await client('192.0.2.1').call(A, '/api/register', body({ email: victim, password: pw })))[0], 201);
  for (let k = 0; k < 10; k++) assert.equal((await client(`192.0.2.${10 + k}`).call(k % 2 ? A : B, '/api/login', body({ email: victim, password: 'wrong-password-' + k })))[0], 401);
  const [s7, j7] = await client('192.0.2.99').call(A, '/api/login', body({ email: victim, password: pw }));
  assert.equal(s7, 429, 'the 11th try is refused even with the right password'); assert.match(j7.error, /Too many sign-in attempts/);
  assert.equal((await client('192.0.2.98').call(B, '/api/login', body({ email: victim, password: pw })))[0], 429);
  const hits = await TDB.pgQuery(`SELECT key FROM ${env.HOGGY_PG_SCHEMA}.rate_hits`);
  assert.ok(hits.length > 10 && hits.every(h => /^[a-f0-9]{32}$/.test(h.key)), 'rate keys are hashed, no emails or IPs stored');

  /* sign out on A ends the session on B; account deleted on B cannot sign in on A */
  const gone = client(); gone.cookie = u1.cookie;
  assert.equal((await u1.call(A, '/api/logout', { method: 'POST' }))[0], 200);
  assert.equal((await gone.call(B, '/api/me'))[1].user, null, 'signed out on A: that session is gone on B too');
  assert.equal((await u2.call(B, '/api/me'))[1].user.email, email, 'the other session (u2) is still signed in');
  const [s8, j8] = await u2.call(B, '/api/account', { method: 'DELETE', body: JSON.stringify({ password: 'nope' }) }); assert.equal(s8, 403); assert.match(j8.error, /password is not right/);
  assert.equal((await u2.call(B, '/api/account', { method: 'DELETE', body: JSON.stringify({ password: pw }) }))[0], 200);
  assert.equal((await client('192.0.2.200').call(A, '/api/login', body({ email, password: pw })))[0], 401, 'deleted account is gone everywhere');
  assert.equal((await client().call(A, '/api/reviews?series=' + key))[1].length, 0, 'its reviews went with it');

  /* a third cold start: schema and seed are unchanged, so nothing is rewritten */
  const before = (await TDB.pgQuery(`SELECT COUNT(*)::int n, MAX(updated)::text u FROM ${env.HOGGY_PG_SCHEMA}.conferences`))[0];
  const C = instance(t, env, 'C'); await up(C);
  const after = (await TDB.pgQuery(`SELECT COUNT(*)::int n, MAX(updated)::text u FROM ${env.HOGGY_PG_SCHEMA}.conferences`))[0];
  assert.deepEqual(after, before); assert.equal(after.n, N_CONFS);
  assert.doesNotMatch(C.log(), /seed:|schema .* is up to date|migration failed/, 'warm database: no DDL, no seed writes');
  assert.match(A.log() + B.log(), /seed: \d+ new/);
});
