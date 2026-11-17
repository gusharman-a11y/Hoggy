'use strict';
/* Hospitals: roles, join codes, trip approval, study budget, claims to finance, notifications, and the security rules
   (membership filter, cross-hospital 404, role 403, no self-approval, join-code rate limit). Run: node --test tests/ */
const test = require('node:test'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process'), path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const H = require('../lib/hospital.js');
const TDB = require('./_db.js');
const ROOT = path.join(__dirname, '..');

test('roles, join codes and cost parsing', () => {
  assert.deepEqual(H.ROLES, ['doctor', 'manager', 'finance', 'admin']);
  assert.ok(H.can('manager', 'approve') && H.can('admin', 'approve') && !H.can('doctor', 'approve') && !H.can('finance', 'approve'));
  assert.ok(H.can('finance', 'finance') && H.can('admin', 'finance') && !H.can('manager', 'finance') && !H.can('doctor', 'finance'));
  assert.ok(H.can('manager', 'team') && !H.can('finance', 'team'));
  assert.ok(H.can('admin', 'admin') && !H.can('manager', 'admin') && !H.can('doctor', 'nonsense'));
  const codes = new Set(Array.from({ length: 500 }, H.newCode));
  assert.equal(codes.size, 500, 'no repeats in 500 codes');
  for (const c of codes) { assert.match(c, /^[A-HJ-NP-Z2-9]{8}$/, 'no 0, O, 1 or I'); assert.equal(H.normCode(H.showCode(c).toLowerCase()), c, 'dash and case do not matter'); }
  assert.equal(H.normCode(' abcd efgh '), 'ABCDEFGH'); assert.equal(H.normCode('ABCD-EFG0'), '', 'zero is not a code character'); assert.equal(H.normCode('ABC'), ''); assert.equal(H.normCode(null), '');
  assert.deepEqual(H.parseCosts({ registration: 120000, flights: 60000 }), { ok: true, costs: { registration: 120000, flights: 60000, accommodation: 0, other: 0 }, total: 180000 });
  assert.equal(H.parseCosts({}).ok, false, 'nothing estimated');
  assert.equal(H.parseCosts({ flights: -1 }).ok, false); assert.equal(H.parseCosts({ flights: 1.5 }).ok, false, 'whole cents'); assert.equal(H.parseCosts({ flights: 1e9 }).ok, false); assert.equal(H.parseCosts(null).ok, false);
});

test('budget: committed = approved and not claimed, spent = claim totals, pending shown not subtracted, by event year', () => {
  const ap = (trip_ref, status, estimate_cents, year = 2027) => ({ trip_ref, status, estimate_cents, year });
  const cl = (trip_ref, status, total_cents, year = 2027) => ({ trip_ref, status, total_cents, year });
  const b = H.budget({ year: 2027, allowance: 500000, approvals: [ap('a', 'approved', 200000), ap('b', 'approved', 100000), ap('c', 'pending', 50000), ap('d', 'rejected', 90000), ap('e', 'approved', 70000, 2028)], claims: [cl('b', 'paid', 95000), cl('x', 'submitted', 30000), cl('y', 'paid', 10000, 2026)] });
  assert.equal(b.committed, 200000, 'trip a only: b has a claim, e is another year, d was rejected');
  assert.equal(b.spent, 125000, 'actual claim totals (95,000 for b, not its estimate) plus a claim without approval');
  assert.equal(b.pending, 50000); assert.equal(b.remaining, 500000 - 200000 - 125000, 'pending is not subtracted');
  assert.equal(H.budget({ year: 2027, allowance: 0, approvals: [ap('a', 'approved', 1000)] }).remaining, -1000, 'can go below zero');
});

/* ---------- server ---------- */
async function startServer(t, extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoggy-h-')), port = 20000 + Math.floor(Math.random() * 30000);
  let srv; t.after(() => srv.kill());
  const env = { ...process.env, PORT: String(port), HOGGY_DATA: dir, HOST: '127.0.0.1', HOGGY_ADMIN_KEY: '', HOGGY_ADMINS: '', HOGGY_TRUST_PROXY: '1', ...TDB.isolate(t), ...extra };
  srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; srv.stdout.on('data', d => out += d); srv.stderr.on('data', d => out += d);
  const B = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) { try { if ((await fetch(B + '/healthz')).ok) break; } catch (e) { } await new Promise(r => setTimeout(r, 100)); }
  return { B, log: () => out };
}
let ipN = 0;
function client(B, ip) {
  let cookie = ''; const fwd = ip || `198.51.100.${(ipN++ % 200) + 1}`;
  const call = async (p, o = {}, h = {}) => { const r = await fetch(B + p, { ...o, headers: { 'X-Requested-With': 'hoggy', 'Content-Type': 'application/json', 'X-Forwarded-For': fwd, ...h, cookie } }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; let j = null; try { j = await r.clone().json(); } catch (e) { } return [r.status, j]; };
  const post = (p, b) => call(p, { method: 'POST', body: JSON.stringify(b || {}) });
  return { call, post, register: async (name) => { const [s, j] = await post('/api/register', { email: `${name.replace(/\W/g, '').toLowerCase()}${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.com`, password: 'correct-horse-battery', name }); assert.equal(s, 201, JSON.stringify(j)); return j.user; } };
}
const CONF = 'jsca-46th-2026';
const EV = { name: 'APLS course, Sydney', city: 'Sydney', country: 'Australia', start: '2027-03-10', end: '2027-03-11', kind: 'course' };

test('hospitals: create, join, roles, approvals, budget, claims, security', async (t) => {
  const { B } = await startServer(t);
  const admin = client(B), doc = client(B), mgr = client(B), fin = client(B), out = client(B), outMgr = client(B);
  const ua = await admin.register('Dr Admin'), ud = await doc.register('Dr Doctor'), um = await mgr.register('Dr Manager'), uf = await fin.register('Ms Finance');
  await out.register('Dr Outsider'); const uo2 = await outMgr.register('Dr Other Manager');

  /* no hospital: every hospital page is closed, Hoggy works as before */
  assert.deepEqual((await doc.call('/api/org'))[1], { org: null });
  assert.equal((await doc.call('/api/budget'))[0], 403); assert.equal((await doc.call('/api/approvals'))[0], 403);
  assert.deepEqual((await doc.call('/api/approvals/mine'))[1], []); assert.deepEqual((await doc.call('/api/claims/mine'))[1], []);
  assert.equal((await doc.post('/api/approvals', { tripRef: 'trip-1', confId: CONF, costs: { flights: 1000 } }))[0], 403, 'no hospital, no request');
  assert.equal((await client(B).call('/api/org'))[0], 401, 'signed out');
  assert.equal((await fetch(B + '/api/org', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: '' }, body: '{}' })).status, 403, 'CSRF header required');

  /* create: validation, creator is admin with a join code */
  assert.equal((await admin.post('/api/org', { name: 'X' }))[0], 400);
  assert.equal((await admin.post('/api/org', { name: 'St Elsewhere', claimsEmail: 'not-an-email' }))[0], 400);
  assert.equal((await admin.post('/api/org', { name: 'St Elsewhere', defaultAllowanceCents: -5 }))[0], 400);
  const [s1, made] = await admin.post('/api/org', { name: 'St Elsewhere Hospital', claimsEmail: 'Claims@StElsewhere.example', defaultAllowanceCents: 500000, currency: 'AUD' });
  assert.equal(s1, 201); assert.equal(made.org.role, 'admin'); assert.equal(made.org.claimsEmail, 'claims@stelsewhere.example'); assert.equal(made.org.defaultAllowanceCents, 500000);
  assert.match(made.org.joinCode, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal((await admin.post('/api/org', { name: 'Second Hospital' }))[0], 409, 'one hospital per user');
  const code = made.org.joinCode;

  /* a second hospital, to try crossing over */
  const [, other] = await outMgr.post('/api/org', { name: 'Other Hospital', defaultAllowanceCents: 100 });

  /* join: a wrong code gives no hint; doctors do not see the code */
  const [s2, j2] = await doc.post('/api/org/join', { code: 'AAAA-AAAA' }); assert.equal(s2, 404); assert.match(j2.error, /No hospital has that code/);
  const [s3, j3] = await doc.post('/api/org/join', { code: code.toLowerCase().replace('-', ' ') }); assert.equal(s3, 200); assert.equal(j3.org.role, 'doctor'); assert.equal(j3.org.joinCode, undefined, 'only admins see the code');
  assert.equal(j3.org.name, 'St Elsewhere Hospital'); assert.equal(j3.org.claimsEmail, 'claims@stelsewhere.example', 'members see the claims email');
  assert.equal((await doc.post('/api/org/join', { code }))[0], 409, 'already a member');
  for (const c of [mgr, fin]) assert.equal((await c.post('/api/org/join', { code }))[0], 200);
  assert.equal((await admin.call('/api/notifications'))[1].unread, 3, 'admin is told who joined');

  /* roles: admin only; at least one admin; cross-hospital ids are 404 */
  assert.equal((await mgr.post(`/api/org/members/${um.id}`, { role: 'admin' }))[0], 403, 'a doctor cannot make themselves admin');
  assert.equal((await admin.post(`/api/org/members/${um.id}`, { role: 'boss' }))[0], 400);
  assert.equal((await admin.post(`/api/org/members/${um.id}`, { role: 'manager' }))[0], 200);
  assert.equal((await admin.post(`/api/org/members/${uf.id}`, { role: 'finance' }))[0], 200);
  assert.equal((await admin.post(`/api/org/members/${ua.id}`, { role: 'doctor' }))[0], 409, 'last admin cannot step down');
  assert.equal((await admin.post(`/api/org/members/${uo2.id}`, { role: 'doctor' }))[0], 404, 'member of another hospital: not found');
  assert.equal((await admin.post(`/api/org/members/${ua.id}`, { action: 'remove' }))[0], 400, 'leave instead of removing yourself');
  assert.equal((await mgr.call('/api/org'))[1].org.role, 'manager');
  assert.equal((await mgr.post('/api/org/code'))[0], 403, 'only admin regenerates the code');
  assert.equal((await mgr.post('/api/org/settings', { name: 'Hacked' }))[0], 403);

  /* the doctor plans a trip and asks for approval (conference details come from the server's own row) */
  const req1 = { tripRef: 'trip-abc1', confId: CONF, event: { name: 'Forged name', start: '2020-01-01', end: '2020-01-02' }, costs: { registration: 120000, flights: 80000, accommodation: 60000, other: 0 }, note: 'Presenting a poster' };
  assert.equal((await doc.post('/api/approvals', { ...req1, costs: {} }))[0], 400, 'costs required');
  assert.equal((await doc.post('/api/approvals', { ...req1, tripRef: 'x' }))[0], 400);
  const [s4, a1] = await doc.post('/api/approvals', req1); assert.equal(s4, 201, JSON.stringify(a1));
  assert.equal(a1.status, 'pending'); assert.equal(a1.estimateCents, 260000); assert.equal(a1.event.name, '46th Annual Meeting of the Japan Society for Clinical Anesthesia', 'server conference row wins over the client'); assert.equal(a1.year, 2026);
  assert.equal(a1.approvers, 2, 'manager and admin are notified');
  assert.equal((await doc.post('/api/approvals', req1))[0], 409, 'already waiting');
  /* a course (not in the server's conference list) uses the cleaned client description */
  const [, a2] = await doc.post('/api/approvals', { tripRef: 'trip-crs1', confId: 'apls-ses-1', event: EV, costs: { registration: 150000 } }); assert.equal(a2.year, 2027); assert.equal(a2.event.kind, 'course');
  assert.equal((await doc.post('/api/approvals', { tripRef: 'trip-bad1', event: { name: 'No dates' }, costs: { other: 100 } }))[0], 400);

  /* who sees what */
  assert.equal((await doc.call('/api/approvals'))[0], 403, 'doctor: no approvals page');
  assert.equal((await fin.call('/api/approvals'))[0], 403, 'finance: no approvals page');
  const [, pend] = await mgr.call('/api/approvals'); assert.equal(pend.length, 2);
  const p1 = pend.find(x => x.id === a1.id); assert.equal(p1.doctor, 'Dr Doctor'); assert.equal(p1.budget.allowance, 500000); assert.equal(p1.budget.pending, 260000); assert.equal(p1.budget.remaining, 500000, 'pending not subtracted');
  assert.deepEqual((await outMgr.call('/api/approvals'))[1], [], 'other hospital sees none');
  assert.equal((await outMgr.post(`/api/approvals/${a1.id}`, { action: 'approve' }))[0], 404, 'other hospital manager: 404');
  assert.equal((await doc.post(`/api/approvals/${a1.id}`, { action: 'approve' }))[0], 403, 'doctor cannot approve');
  assert.deepEqual((await out.call('/api/approvals/mine'))[1], []);
  assert.equal((await mgr.call('/api/org'))[1].counts.approvals, 2);

  /* nobody decides their own request: the manager asks for approval and cannot approve it */
  const [, own] = await mgr.post('/api/approvals', { tripRef: 'trip-mgr1', confId: CONF, costs: { flights: 50000 } });
  const [s5, j5] = await mgr.post(`/api/approvals/${own.id}`, { action: 'approve' }); assert.equal(s5, 403); assert.match(j5.error, /own request/);
  assert.equal((await mgr.call('/api/approvals'))[1].find(x => x.id === own.id).mine, true);
  assert.equal((await admin.post(`/api/approvals/${own.id}`, { action: 'approve' }))[0], 200, 'another approver can');

  /* reject needs a comment; the doctor sees it, edits and resubmits; then approval */
  assert.equal((await mgr.post(`/api/approvals/${a1.id}`, { action: 'reject', comment: '  ' }))[0], 400);
  assert.equal((await mgr.post(`/api/approvals/${a1.id}`, { action: 'reject', comment: 'Flights look high, try economy' }))[0], 200);
  assert.equal((await mgr.post(`/api/approvals/${a1.id}`, { action: 'approve' }))[0], 409, 'already decided');
  let mine = (await doc.call('/api/approvals/mine'))[1].find(x => x.id === a1.id);
  assert.equal(mine.status, 'rejected'); assert.equal(mine.comment, 'Flights look high, try economy'); assert.equal(mine.decidedBy, 'Dr Manager');
  const notes = (await doc.call('/api/notifications'))[1]; assert.ok(notes.items.some(n => /not approved by Dr Manager/.test(n.text)), 'in-app notice');
  assert.equal((await doc.post('/api/notifications/read'))[0], 200); assert.equal((await doc.call('/api/notifications'))[1].unread, 0);
  const [s6, re] = await doc.post('/api/approvals', { ...req1, costs: { registration: 120000, flights: 50000, accommodation: 60000 } }); assert.equal(s6, 200, 'resubmitted');
  assert.equal(re.id, a1.id); assert.equal(re.status, 'pending'); assert.equal(re.comment, '', 'old comment cleared'); assert.equal(re.estimateCents, 230000);
  assert.equal((await mgr.post(`/api/approvals/${a1.id}`, { action: 'approve', comment: 'Enjoy' }))[0], 200);
  assert.equal((await doc.post('/api/approvals', req1))[0], 409, 'approved: no resubmit');

  /* budget: committed after approval; team page; per-person allowance (managers, not doctors or finance) */
  let [, bud] = await doc.call('/api/budget?year=2026'); assert.deepEqual([bud.allowance, bud.committed, bud.spent, bud.pending, bud.remaining], [500000, 230000, 0, 0, 270000]);
  [, bud] = await doc.call('/api/budget?year=2027'); assert.equal(bud.pending, 150000, 'the course is pending in 2027');
  assert.equal((await doc.call('/api/org/team'))[0], 403); assert.equal((await fin.call('/api/org/team'))[0], 403);
  const [, team] = await mgr.call('/api/org/team?year=2026'); assert.equal(team.members.length, 4); assert.equal(team.canAdmin, false);
  assert.equal(team.members.find(x => x.userId === ud.id).budget.committed, 230000);
  assert.equal((await doc.post('/api/org/allowance', { userId: ud.id, year: 2026, allowanceCents: 9e7 }))[0], 403, 'a doctor cannot raise their own allowance');
  assert.equal((await mgr.post('/api/org/allowance', { userId: uo2.id, year: 2026, allowanceCents: 1 }))[0], 404, 'not in this hospital');
  const [s7, al] = await mgr.post('/api/org/allowance', { userId: ud.id, year: 2026, allowanceCents: 800000 }); assert.equal(s7, 200); assert.equal(al.budget.allowance, 800000); assert.equal(al.budget.ownAllowance, true);
  assert.equal((await doc.call('/api/budget?year=2027'))[1].allowance, 500000, 'override is per year');
  assert.equal((await mgr.post('/api/org/allowance', { userId: ud.id, year: 2026, allowanceCents: null }))[1].budget.allowance, 500000, 'back to the hospital default');

  /* claims: currency must match; finance sees it; nobody else; paid; budget spent */
  assert.equal((await doc.post('/api/claims', { tripRef: 'trip-abc1', confId: CONF, totalCents: 215050, currency: 'NZD', receipts: 3 }))[0], 400, 'other currency');
  assert.equal((await doc.post('/api/claims', { tripRef: 'trip-abc1', confId: CONF, totalCents: 0, currency: 'AUD' }))[0], 400);
  const [s8, c1] = await doc.post('/api/claims', { tripRef: 'trip-abc1', confId: CONF, totalCents: 215050, currency: 'AUD', receipts: 3 }); assert.equal(s8, 201);
  assert.equal(c1.status, 'submitted'); assert.equal(c1.approvalId, a1.id, 'linked to the approval'); assert.equal(c1.year, 2026);
  [, bud] = await doc.call('/api/budget?year=2026'); assert.deepEqual([bud.committed, bud.spent, bud.remaining], [0, 215050, 500000 - 215050], 'moved from committed to spent at the actual total');
  assert.equal((await doc.call('/api/claims'))[0], 403, 'doctor: no finance view'); assert.equal((await mgr.call('/api/claims'))[0], 403, 'manager: no finance view');
  const [, fl] = await fin.call('/api/claims'); assert.equal(fl.length, 1); assert.equal(fl[0].doctor, 'Dr Doctor'); assert.equal(fl[0].event.name, a1.event.name); assert.equal(fl[0].totalCents, 215050);
  assert.deepEqual((await outMgr.call('/api/claims'))[1], [], 'other hospital admin sees none');
  assert.equal((await outMgr.post(`/api/claims/${c1.id}/paid`))[0], 404, 'other hospital: 404');
  assert.equal((await doc.post(`/api/claims/${c1.id}/paid`))[0], 403, 'doctor cannot mark paid');
  assert.equal((await fin.post(`/api/claims/${c1.id}/paid`))[0], 200);
  assert.equal((await fin.post(`/api/claims/${c1.id}/paid`))[0], 409);
  assert.equal((await doc.call('/api/claims/mine'))[1][0].status, 'paid');
  assert.equal((await doc.post('/api/claims', { tripRef: 'trip-abc1', confId: CONF, totalCents: 999999, currency: 'AUD' }))[0], 409, 'paid claims are closed');
  [, bud] = await doc.call('/api/budget?year=2026'); assert.equal(bud.spent, 215050, 'paid still counts as spent');
  /* finance cannot pay their own claim */
  const [, fc] = await fin.post('/api/claims', { tripRef: 'trip-fin1', event: EV, totalCents: 1000, currency: 'AUD' });
  assert.equal((await fin.post(`/api/claims/${fc.id}/paid`))[0], 403); assert.equal((await admin.post(`/api/claims/${fc.id}/paid`))[0], 200);
  assert.ok((await doc.call('/api/notifications'))[1].items.some(n => /paid by St Elsewhere Hospital/.test(n.text)));

  /* admin: settings, new code (the old one stops working), remove a member */
  const [, st] = await admin.post('/api/org/settings', { claimsEmail: 'finance@stelsewhere.example', defaultAllowanceCents: 600000 }); assert.equal(st.org.claimsEmail, 'finance@stelsewhere.example');
  const [, nc] = await admin.post('/api/org/code'); assert.notEqual(nc.org.joinCode, code);
  const late = client(B); await late.register('Dr Late');
  assert.equal((await late.post('/api/org/join', { code }))[0], 404, 'old code dead'); assert.equal((await late.post('/api/org/join', { code: nc.org.joinCode }))[0], 200);
  assert.equal((await admin.post(`/api/org/members/${ud.id}`, { action: 'remove' }))[0], 200);
  assert.deepEqual((await doc.call('/api/org'))[1], { org: null }, 'removed'); assert.equal((await doc.call('/api/budget'))[0], 403);
  assert.ok(!(await mgr.call('/api/approvals'))[1].some(x => x.doctor === 'Dr Doctor'), 'a removed member\'s requests leave the queue');

  /* leaving: the last admin must hand over first; the last member takes the hospital with them */
  assert.equal((await admin.post('/api/org/leave'))[0], 409);
  assert.equal((await admin.post(`/api/org/members/${um.id}`, { role: 'admin' }))[0], 200);
  assert.equal((await admin.post('/api/org/leave'))[0], 200);
  assert.equal((await outMgr.post('/api/org/leave'))[1].deleted, true, 'sole member: hospital removed');
  assert.equal((await late.post('/api/org/join', { code: other.org.joinCode }))[0], 409);

  /* account deletion hands the admin role on */
  assert.equal((await mgr.call('/api/account', { method: 'DELETE', body: JSON.stringify({ password: 'correct-horse-battery' }) }))[0], 200);
  const roles = (await fin.call('/api/org'))[1].org.role; assert.equal(roles, 'admin', 'finance (longest-standing member) becomes admin');
});

test('join codes: brute force is rate-limited per account and per network', async (t) => {
  const { B } = await startServer(t);
  const admin = client(B), att = client(B, '203.0.113.50');
  await admin.register('Dr Admin'); const [, o] = await admin.post('/api/org', { name: 'Code Hospital' });
  await att.register('Dr Guess');
  for (let i = 0; i < 10; i++) assert.equal((await att.post('/api/org/join', { code: H.newCode() }))[0], 404);
  const [s, j] = await att.post('/api/org/join', { code: o.org.joinCode }); assert.equal(s, 429, 'the 11th try is refused even with the right code'); assert.match(j.error, /Too many join attempts/);
  /* fresh accounts from the same network: 30 per hour in total */
  let blocked = 0;
  for (let k = 0; k < 3; k++) { const c = client(B, '203.0.113.50'); await c.register('Dr Guess ' + k); for (let i = 0; i < 10; i++) if ((await c.post('/api/org/join', { code: H.newCode() }))[0] === 429) blocked++; }
  assert.ok(blocked >= 10, 'the network limit stops new accounts too: ' + blocked);
});

test('app: hospital pages stay off the phone tab bar, copy has no superlatives, claims default to the hospital email', () => {
  const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8'), i = src.indexOf('/* ---------- hospital:'), body = src.slice(i, src.indexOf('/* ---------- overlays ---------- */', i));
  assert.ok(body.length > 5000, 'hospital section found');
  assert.match(body, /approvals: \['Approvals', 'check', true\], team: \['Team', 'users', true\], finance: \['Finance claims', 'claim', true\]/, 'hidden from the 7-tab bar');
  assert.match(src, /href="#\/\$\{k\}" class="desk"/, 'role links are desktop-only in the nav');
  assert.match(src, /hcan\(w\)\)\.map/, 'role links only for roles that use them');
  assert.doesNotMatch(body, /\b(largest|leading|best|guarantee\w*|seamless|world's)\b/i);
  assert.match(src, /const claimsTo = \(\) => EMP\(\)\.adminEmail \|\| \(inHosp\(\) && HOSP\.org\.claimsEmail\)/);
  assert.match(src, /buildEml\(\{ to, subject/);
});
