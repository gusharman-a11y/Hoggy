'use strict';
/* Hoggy backend: zero dependencies. Node 22+ (node:sqlite). Run: node server.js */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { parseReceipt } = require('./parse.js');
const { pdfText } = require('./lib/pdftext.js');
const { makeIngest, validate: validateConf } = require('./lib/ingest.js');
const ADMIN_KEY = process.env.HOGGY_ADMIN_KEY || '';
const REPORT_MIN_AGE = (process.env.HOGGY_REPORT_MIN_AGE_H === undefined ? 24 : +process.env.HOGGY_REPORT_MIN_AGE_H) * 3600e3;
const ADMINS = new Set(String(process.env.HOGGY_ADMINS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean));

const ON_VERCEL = !!process.env.VERCEL; /* serverless: read-only filesystem except /tmp, instances recycled, always behind Vercel's HTTPS proxy */
const DEMO = ON_VERCEL || process.env.HOGGY_DEMO === '1';
const PORT = +process.env.PORT || 8123;
const HOST = process.env.HOST || '127.0.0.1';
const DATA = process.env.HOGGY_DATA || (ON_VERCEL ? '/tmp/hoggy-data' : path.join(__dirname, 'data-store'));
const MAIL_DOMAIN = process.env.HOGGY_MAIL_DOMAIN || 'receipts.hoggy.app';
const LOOPBACK = !ON_VERCEL && ['127.0.0.1', 'localhost', '::1'].includes(HOST);
const SECURE = process.env.HOGGY_INSECURE_COOKIES !== '1' && !LOOPBACK;
const TRUST_PROXY = ON_VERCEL || process.env.HOGGY_TRUST_PROXY === '1';
const vm = require('node:vm');
const CONF_IDS = (() => { try { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'data', 'conferences.js'), 'utf8'), ctx, { timeout: 2000 }); return new Set(ctx.window.HOGGY_CONFERENCES.map(c => c.id)); } catch (e) { console.error('could not load conference ids', e.message); return null; } })();
fs.mkdirSync(DATA, { recursive: true });

/* inbound-email shared secret: env or generated once and persisted */
const secretFile = path.join(DATA, 'inbound-secret.txt');
let INBOUND_SECRET = process.env.HOGGY_INBOUND_SECRET || '';
if (!INBOUND_SECRET) { try { INBOUND_SECRET = fs.readFileSync(secretFile, 'utf8').trim(); } catch (e) { INBOUND_SECRET = crypto.randomBytes(24).toString('hex'); fs.writeFileSync(secretFile, INBOUND_SECRET, { mode: 0o600 }); } }

const db = new DatabaseSync(path.join(DATA, 'hoggy.db'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, pass TEXT NOT NULL, inbox TEXT UNIQUE NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(sid TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS state(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, json TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, conf_id TEXT NOT NULL, rating INTEGER NOT NULL, text TEXT NOT NULL, author TEXT NOT NULL, role TEXT, created INTEGER NOT NULL, UNIQUE(user_id, conf_id));
CREATE INDEX IF NOT EXISTS rv_conf ON reviews(conf_id);
CREATE TABLE IF NOT EXISTS inbox(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, vendor TEXT, amount REAL, currency TEXT, date TEXT, category TEXT, subject TEXT, sender TEXT, file_id TEXT, file_name TEXT, file_type TEXT, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS conferences(id TEXT PRIMARY KEY, json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'published', source TEXT, updated INTEGER NOT NULL, checked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS candidates(id TEXT PRIMARY KEY, source TEXT, json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS ingest_runs(id INTEGER PRIMARY KEY, started INTEGER, finished INTEGER, summary TEXT);
CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT, type TEXT, data BLOB NOT NULL);`);
for (const col of ['dims TEXT', 'verified INTEGER DEFAULT 0']) { try { db.exec('ALTER TABLE reviews ADD COLUMN ' + col); } catch (e) { /* exists */ } }
const q = (sql) => db.prepare(sql);
const DIMS = ['content', 'networking', 'value', 'venue', 'cpd'];
try { db.exec('ALTER TABLE conferences ADD COLUMN seedhash TEXT'); } catch (e) { }
try { db.exec('ALTER TABLE review_reports ADD COLUMN weight INTEGER DEFAULT 1'); } catch (e) { /* exists */ }
db.exec('CREATE TABLE IF NOT EXISTS proofs(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, conf_id TEXT NOT NULL, receipt_date TEXT, created INTEGER NOT NULL, PRIMARY KEY(user_id, conf_id))');
db.exec("CREATE TABLE IF NOT EXISTS date_changes(id INTEGER PRIMARY KEY, conf_id TEXT NOT NULL, patch TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created INTEGER NOT NULL, UNIQUE(conf_id, patch)); CREATE TABLE IF NOT EXISTS review_reports(review_id INTEGER NOT NULL, user_id INTEGER NOT NULL, created INTEGER NOT NULL, weight INTEGER DEFAULT 1, PRIMARY KEY(review_id, user_id));");
/* seed the live conference table from the curated static file (new ids only; live edits are never overwritten) */
function seedConferences() {
  try {
    const ctx = { window: {} }; require('node:vm').runInNewContext(fs.readFileSync(path.join(__dirname, 'data', 'conferences.js'), 'utf8'), ctx, { timeout: 3000 });
    const ins = db.prepare("INSERT INTO conferences(id,json,status,source,updated,checked,seedhash) VALUES(?,?,'published','curated',?,0,?)"), upd = db.prepare("UPDATE conferences SET json=?, seedhash=?, updated=? WHERE id=?"), get = db.prepare('SELECT seedhash, source FROM conferences WHERE id=?'); let n = 0, u2 = 0;
    db.exec('BEGIN');
    for (const c of ctx.window.HOGGY_CONFERENCES) {
      const js = JSON.stringify(c), h = crypto.createHash('sha1').update(js).digest('hex'), row = get.get(c.id);
      if (!row) { ins.run(c.id, js, Date.now(), h); n++; }
      else if (row.source === 'curated' && row.seedhash !== h) { upd.run(js, h, Date.now(), c.id); u2++; }
    }
    db.exec('COMMIT');
    if (n || u2) console.log(`seed: ${n} new, ${u2} updated conferences`);
  } catch (e) { try { db.exec('ROLLBACK'); } catch (x) { } console.error('seed failed', e.message); }
}
seedConferences();
const ingest = makeIngest({ db, now: () => Date.now() });
let ingesting = false;
async function runIngest(limit) { if (ingesting) return { busy: true }; ingesting = true; try { return await ingest.run({ limit }); } catch (e) { console.error('ingest failed', e); return { error: String(e.message) }; } finally { ingesting = false; confCache = null; } }
let confCache = null;
if (process.env.HOGGY_INGEST === '1' && !ON_VERCEL) { /* never on Vercel: no long-lived process to run it */ setTimeout(() => runIngest(60), 30e3).unref(); setInterval(() => runIngest(60), 6 * 3600e3).unref(); console.log('Continuous ingest ON (every 6h)'); }

/* ---------- helpers ---------- */
const rid = (n = 12) => crypto.randomBytes(n).toString('hex');
const now = () => Date.now();
const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, (e, k) => e ? rej(e) : res(k)));
async function hashPw(pw) { const salt = crypto.randomBytes(16); const h = await scrypt(pw, salt); return salt.toString('hex') + ':' + h.toString('hex'); }
async function checkPw(pw, stored) { const [s, h] = String(stored).split(':'); if (!s || !h) return false; const x = await scrypt(pw, Buffer.from(s, 'hex')); const y = Buffer.from(h, 'hex'); return x.length === y.length && crypto.timingSafeEqual(x, y); }
const DUMMY = hashPw('dummy-password-for-timing');
const sha = v => crypto.createHash('sha256').update(String(v)).digest('hex');
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const emailOk = e => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(e) && e.length <= 254;
const magicOk = (t, d) => t === 'application/pdf' ? d.subarray(0, 5).toString('latin1') === '%PDF-' : t === 'image/png' ? d.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) : t === 'image/jpeg' ? d[0] === 0xff && d[1] === 0xd8 : t === 'image/webp' ? d.subarray(0, 4).toString('latin1') === 'RIFF' && d.subarray(8, 12).toString('latin1') === 'WEBP' : false;
const ALLOWED_FILES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

const rate = new Map(); // ip -> [timestamps]
function limited(key, max, windowMs) { const t = now(), a = (rate.get(key) || []).filter(x => t - x < windowMs); a.push(t); rate.set(key, a); return a.length > max; }
const tooMany = (key, max, windowMs) => (rate.get(key) || []).filter(x => now() - x < windowMs).length >= max;
const hit = key => { const a = rate.get(key) || []; a.push(now()); rate.set(key, a); };
const clientIp = req => TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',').pop().trim() || req.socket.remoteAddress || '' : req.socket.remoteAddress || '';
let ratingsCache = null;
setInterval(() => { const t = now(); for (const [k, a] of rate) if (!a.some(x => t - x < 3600e3)) rate.delete(k); q('DELETE FROM sessions WHERE expires < ?').run(t); const old = t - 30 * 864e5; q('DELETE FROM files WHERE id IN (SELECT file_id FROM inbox WHERE created < ? AND file_id IS NOT NULL)').run(old); q('DELETE FROM inbox WHERE created < ?').run(old); }, 600e3).unref();

const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' blob: data:; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-src 'self' about:; frame-ancestors 'none'";
function secHeaders(res) { res.setHeader('Content-Security-Policy', CSP); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Frame-Options', 'DENY'); }
function json(res, code, obj, extra = {}) { const b = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra }); res.end(b); }
const err = (res, code, msg) => json(res, code, { error: msg });
function readBody(req, limit) { return new Promise((res, rej) => { let n = 0; const c = []; req.on('data', d => { n += d.length; if (n > limit) { rej(Object.assign(new Error('too large'), { code: 413 })); req.destroy(); } else c.push(d); }); req.on('end', () => res(Buffer.concat(c))); req.on('error', rej); }); }
async function readJson(req, limit) { const b = await readBody(req, limit); try { const v = JSON.parse(b.toString('utf8') || '{}'); if (v === null || typeof v !== 'object') throw 0; return v; } catch (e) { throw Object.assign(new Error('bad json'), { code: 400 }); } }

function cookies(req) { const o = {}; String(req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) { const v = p.slice(i + 1).trim(); try { o[p.slice(0, i).trim()] = decodeURIComponent(v); } catch (e) { o[p.slice(0, i).trim()] = v; } } }); return o; }
function setSession(res, uid) { const sid = rid(24), exp = now() + 30 * 864e5; q('INSERT INTO sessions(sid,user_id,expires) VALUES(?,?,?)').run(sha(sid), uid, exp); res.setHeader('Set-Cookie', `hoggy_sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 86400}${SECURE ? '; Secure' : ''}`); }
function userOf(req) { const sid = cookies(req).hoggy_sid; if (!sid) return null; const r = q('SELECT u.id,u.email,u.name,u.inbox,s.expires FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.sid=?').get(sha(sid)); if (!r || r.expires < now()) return null; return r; }
const pub = u => ({ id: u.id, email: u.email, name: u.name, inbox: `${u.inbox}@${MAIL_DOMAIN}`, admin: ADMINS.has(String(u.email).toLowerCase()) });

/* ---------- API ---------- */
async function api(req, res, url) {
  const p = url.pathname, m = req.method, ip = clientIp(req);

  /* inbound email: authenticated by shared secret, not by cookie */
  if (p === '/api/inbound/email' && m === 'POST') {
    if (limited('inb', 120, 60e3)) return err(res, 429, 'slow down');
    const given = String(req.headers['x-hoggy-secret'] || (/^Basic /i.test(req.headers.authorization || '') ? Buffer.from(req.headers.authorization.slice(6), 'base64').toString().split(':').pop() : ''));
    const a = Buffer.from(given), b = Buffer.from(INBOUND_SECRET);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return err(res, 401, 'bad secret');
    const body = await readJson(req, 12e6);
    return await inbound(res, body);
  }

  /* CSRF: mutating calls must be JSON-ish with a custom header (cannot be sent cross-site without CORS preflight, which we never allow) */
  if (m !== 'GET' && m !== 'HEAD' && req.headers['x-requested-with'] !== 'hoggy') return err(res, 403, 'missing header');

  if (p === '/api/register' && m === 'POST') {
    if (limited('reg:' + ip, 10, 3600e3)) return err(res, 429, 'too many attempts');
    const b = await readJson(req, 4e3), email = clean(b.email, 254).toLowerCase(), pw = String(b.password || ''), name = clean(b.name, 80);
    if (!emailOk(email)) return err(res, 400, 'enter a valid email');
    if (pw.length < 10 || pw.length > 200) return err(res, 400, 'password must be 10+ characters');
    if (q('SELECT 1 FROM users WHERE email=?').get(email)) return err(res, 409, 'that email is already registered');
    const inbox = 'dr-' + crypto.randomBytes(10).toString('hex');
    const r = q('INSERT INTO users(email,name,pass,inbox,created) VALUES(?,?,?,?,?)').run(email, name, await hashPw(pw), inbox, now());
    setSession(res, Number(r.lastInsertRowid));
    return json(res, 201, { user: pub({ id: Number(r.lastInsertRowid), email, name, inbox }) });
  }
  if (p === '/api/login' && m === 'POST') {
    const b = await readJson(req, 4e3), email = clean(b.email, 254).toLowerCase(), u = q('SELECT * FROM users WHERE email=?').get(email);
    if (tooMany('login:' + ip, 20, 900e3) || tooMany('loginE:' + email, 10, 900e3)) return err(res, 429, 'too many attempts, try again later');
    const ok = await checkPw(String(b.password || ''), u ? u.pass : await DUMMY);
    if (!u || !ok) { hit('login:' + ip); hit('loginE:' + email); return err(res, 401, 'wrong email or password'); }
    setSession(res, u.id);
    return json(res, 200, { user: pub(u) });
  }
  if (p === '/api/logout' && m === 'POST') { const sid = cookies(req).hoggy_sid; if (sid) q('DELETE FROM sessions WHERE sid=?').run(sha(sid)); res.setHeader('Set-Cookie', 'hoggy_sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); return json(res, 200, { ok: true }); }

  if (p === '/api/conferences' && m === 'GET') {
    if (!confCache) { const rows = q("SELECT json, status, updated FROM conferences WHERE status IN ('published','flagged') ORDER BY json_extract(json,'$.start')").all(); confCache = { updated: rows.reduce((a, r) => Math.max(a, r.updated), 0), list: rows.map(r => { const c = JSON.parse(r.json); if (r.status === 'flagged') c.flagged = true; return c; }) }; confCache.etag = '"' + confCache.updated + '-' + confCache.list.length + '"'; }
    if (req.headers['if-none-match'] === confCache.etag) { res.writeHead(304, { ETag: confCache.etag }); return res.end(); }
    return json(res, 200, { updated: confCache.updated, conferences: confCache.list }, { ETag: confCache.etag });
  }
  /* public: community ratings */
  if (p === '/api/ratings' && m === 'GET') {
    if (!ratingsCache || now() - ratingsCache.t > 60e3) {
      const agg = {};
      for (const r of q('SELECT conf_id, rating, dims, verified FROM reviews WHERE (SELECT COUNT(*) FROM review_reports x WHERE x.weight=1 AND x.review_id=reviews.id) < 3').all()) {
        const a = agg[r.conf_id] || (agg[r.conf_id] = { sum: 0, n: 0, verified: 0, dims: {} });
        a.sum += r.rating; a.n++; a.verified += r.verified ? 1 : 0;
        try { const d = JSON.parse(r.dims || '{}'); for (const k of DIMS) if (d[k]) { (a.dims[k] = a.dims[k] || []).push(d[k]); } } catch (e) { }
      }
      ratingsCache = { t: now(), v: Object.fromEntries(Object.entries(agg).map(([k, a]) => [k, { avg: a.sum / a.n, n: a.n, verified: a.verified, dims: Object.fromEntries(Object.entries(a.dims).map(([d, v]) => [d, v.reduce((x, y) => x + y, 0) / v.length])) }])) };
    }
    return json(res, 200, ratingsCache.v);
  }
  if (p === '/api/reviews' && m === 'GET') {
    const conf = clean(url.searchParams.get('conf'), 80), me = userOf(req);
    return json(res, 200, q('SELECT id, user_id, conf_id confId, rating, text, author, role, created, dims, verified FROM reviews WHERE conf_id=? AND (SELECT COUNT(*) FROM review_reports x WHERE x.weight=1 AND x.review_id=reviews.id) < 3 ORDER BY verified DESC, created DESC LIMIT 100').all(conf).map(({ user_id, ...r }) => { let d = {}; try { d = JSON.parse(r.dims || '{}'); } catch (e) { } return { ...r, dims: d, verified: !!r.verified, mine: !!me && me.id === user_id }; }));
  }

  let mm0;
  const u = userOf(req);
  if (p === '/api/me' && m === 'GET') return json(res, 200, { user: u ? pub(u) : null });
  if (!u) return err(res, 401, 'sign in required');

  if (p.startsWith('/api/admin/')) {
    if (!ADMINS.has(String(u.email).toLowerCase())) return err(res, 403, 'admin only');
    if (!ADMIN_KEY) return err(res, 403, 'admin disabled: set HOGGY_ADMIN_KEY');
    { const k = Buffer.from(String(req.headers['x-admin-key'] || '')), w = Buffer.from(ADMIN_KEY); if (k.length !== w.length || !crypto.timingSafeEqual(k, w)) return err(res, 403, 'admin key required'); }
    let am;
    if (p === '/api/admin/candidates' && m === 'GET') return json(res, 200, q("SELECT id, source, json, status, created FROM candidates WHERE status='pending' ORDER BY created DESC LIMIT 200").all().map(r => ({ ...r, json: JSON.parse(r.json) })));
    if ((am = p.match(/^\/api\/admin\/candidates\/(cand-[a-f0-9]{14})$/)) && m === 'POST') {
      const b = await readJson(req, 8e3);
      if (b.action === 'reject') { q("UPDATE candidates SET status='rejected' WHERE id=?").run(am[1]); return json(res, 200, { ok: true }); }
      if (b.action !== 'approve' || !b.conference) return err(res, 400, 'action approve|reject');
      const c = { ...b.conference, cpdHours: +b.conference.cpdHours, lat: +b.conference.lat || 0, lng: +b.conference.lng || 0, datesConfirmed: b.conference.datesConfirmed === true, dateStatus: b.conference.datesConfirmed === true ? 'confirmed' : 'estimated', lastVerified: new Date().toISOString().slice(0, 10) };
      const why = validateConf(c); if (why) return err(res, 400, why);
      if (q('SELECT 1 FROM conferences WHERE id=?').get(c.id)) return err(res, 409, 'id exists');
      q("INSERT INTO conferences(id,json,status,source,updated,checked) VALUES(?,?,'published','approved-candidate',?,0)").run(c.id, JSON.stringify(c), now());
      q("UPDATE candidates SET status='approved' WHERE id=?").run(am[1]); confCache = null; return json(res, 200, { ok: true });
    }
    if ((am = p.match(/^\/api\/admin\/conferences\/([a-z0-9-]{3,80})$/)) && m === 'POST') {
      const b = await readJson(req, 8e3), row = q('SELECT json FROM conferences WHERE id=?').get(am[1]); if (!row) return err(res, 404, 'not found');
      if (['published', 'hidden', 'flagged'].includes(b.status)) q('UPDATE conferences SET status=?, updated=? WHERE id=?').run(b.status, now(), am[1]);
      if (b.patch && typeof b.patch === 'object') { const c = { ...JSON.parse(row.json), ...b.patch, id: am[1] }; const why = validateConf(c); if (why) return err(res, 400, why); q("UPDATE conferences SET json=?, updated=?, source='live-edited' WHERE id=?").run(JSON.stringify(c), now(), am[1]); }
      confCache = null; return json(res, 200, { ok: true });
    }
    if (p === '/api/admin/changes' && m === 'GET') return json(res, 200, q("SELECT d.id, d.conf_id confId, d.patch, d.created, c.json cj FROM date_changes d JOIN conferences c ON c.id=d.conf_id WHERE d.status='pending' ORDER BY d.created DESC LIMIT 200").all().map(r => { const cur = JSON.parse(r.cj); return { id: r.id, confId: r.confId, name: cur.name, current: { start: cur.start, end: cur.end, city: cur.city }, proposed: JSON.parse(r.patch), created: r.created }; }));
    if ((am = p.match(/^\/api\/admin\/changes\/(\d{1,12})$/)) && m === 'POST') {
      const b = await readJson(req, 2e3), ch = q("SELECT * FROM date_changes WHERE id=? AND status='pending'").get(+am[1]); if (!ch) return err(res, 404, 'not found');
      if (b.action === 'reject') { q("UPDATE date_changes SET status='rejected' WHERE id=?").run(ch.id); return json(res, 200, { ok: true }); }
      if (b.action !== 'approve') return err(res, 400, 'approve|reject');
      const row = q('SELECT json FROM conferences WHERE id=?').get(ch.conf_id), pt = JSON.parse(ch.patch), c = { ...JSON.parse(row.json), start: pt.start, end: pt.end, datesConfirmed: true, dateStatus: 'confirmed', lastVerified: new Date().toISOString().slice(0, 10), provenance: 'organiser-jsonld', sourceUrl: pt.evidenceUrl || JSON.parse(row.json).sourceUrl };
      if (pt.city && b.useCity) c.city = pt.city;
      const why = validateConf(c); if (why) return err(res, 400, why);
      q("UPDATE conferences SET json=?, updated=?, source='live-edited' WHERE id=?").run(JSON.stringify(c), now(), ch.conf_id); q("UPDATE date_changes SET status='approved' WHERE id=?").run(ch.id); confCache = null; return json(res, 200, { ok: true });
    }
    if (p === '/api/admin/reported' && m === 'GET') return json(res, 200, q('SELECT r.id, r.conf_id confId, r.rating, r.text, r.author, (SELECT COUNT(*) FROM review_reports x WHERE x.weight=1 AND x.review_id=r.id) reports FROM reviews r WHERE (SELECT COUNT(*) FROM review_reports x WHERE x.weight=1 AND x.review_id=r.id) >= 1 ORDER BY reports DESC LIMIT 100').all());
    if ((am = p.match(/^\/api\/admin\/reviews\/(\d{1,12})$/)) && m === 'POST') { const b = await readJson(req, 1e3); if (b.action === 'delete') q('DELETE FROM reviews WHERE id=?').run(+am[1]); else if (b.action === 'restore') q('DELETE FROM review_reports WHERE review_id=?').run(+am[1]); else return err(res, 400, 'delete|restore'); ratingsCache = null; return json(res, 200, { ok: true }); }
    if (p === '/api/admin/ingest' && m === 'POST') { runIngest(60); return json(res, 202, { started: true }); }
    if (p === '/api/admin/runs' && m === 'GET') return json(res, 200, q('SELECT id, started, finished, summary FROM ingest_runs ORDER BY id DESC LIMIT 20').all().map(r => ({ ...r, summary: JSON.parse(r.summary) })));
    return err(res, 404, 'not found');
  }
  if (p === '/api/state' && m === 'GET') { const r = q('SELECT json, rev FROM state WHERE user_id=?').get(u.id); return json(res, 200, r ? { state: JSON.parse(r.json), rev: r.rev } : { state: null, rev: 0 }); }
  if (p === '/api/state' && m === 'PUT') {
    if (limited('st:' + u.id, 60, 60e3)) return err(res, 429, 'slow down');
    const b = await readJson(req, 1.5e6), cur = q('SELECT rev FROM state WHERE user_id=?').get(u.id), rev = cur ? cur.rev : 0;
    if (typeof b.state !== 'object' || !b.state) return err(res, 400, 'state required');
    if (Number(b.baseRev) !== rev) return json(res, 409, { error: 'conflict', rev });
    const st = JSON.stringify(b.state);
    q('INSERT INTO state(user_id,json,rev,updated) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET json=excluded.json, rev=excluded.rev, updated=excluded.updated').run(u.id, st, rev + 1, now());
    return json(res, 200, { rev: rev + 1 });
  }
  if (p === '/api/reviews' && m === 'POST') {
    const b = await readJson(req, 4e3), conf = clean(b.confId, 80), rating = Math.round(+b.rating), text = clean(b.text, 600);
    if (!conf || !(rating >= 1 && rating <= 5) || text.length < 10) return err(res, 400, 'rating 1–5 and at least 10 characters required');
    if (CONF_IDS && !CONF_IDS.has(conf)) return err(res, 400, 'unknown conference');
    if (limited('rv:' + u.id, 20, 3600e3)) return err(res, 429, 'too many reviews, try later');
    ratingsCache = null;
    const dims = {}; for (const k of DIMS) { const v = Math.round(+((b.dims || {})[k])); if (v >= 1 && v <= 5) dims[k] = v; }
    let verified = 0; try { const st = q('SELECT json FROM state WHERE user_id=?').get(u.id); const S = st ? JSON.parse(st.json) : null; verified = S && (S.trips || []).some(t => t.confId === conf && t.status === 'attended') && q('SELECT 1 FROM proofs WHERE user_id=? AND conf_id=?').get(u.id, conf) ? 1 : 0; } catch (e) { }
    q('INSERT INTO reviews(user_id,conf_id,rating,text,author,role,created,dims,verified) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,conf_id) DO UPDATE SET rating=excluded.rating,text=excluded.text,author=excluded.author,created=excluded.created,dims=excluded.dims,verified=excluded.verified').run(u.id, conf, rating, text, u.name || 'Clinician', verified ? 'Verified attendee' : 'Member', now(), JSON.stringify(dims), verified);
    return json(res, 200, { ok: true });
  }
  if (p === '/api/reviews' && m === 'DELETE') { const conf = clean(url.searchParams.get('conf'), 80); q('DELETE FROM reviews WHERE user_id=? AND conf_id=?').run(u.id, conf); ratingsCache = null; return json(res, 200, { ok: true }); }
  if ((mm0 = p.match(/^\/api\/reviews\/(\d{1,12})\/report$/)) && m === 'POST') { const rv = q('SELECT user_id FROM reviews WHERE id=?').get(+mm0[1]); if (!rv) return err(res, 404, 'not found'); if (rv.user_id === u.id) return err(res, 400, 'cannot report your own review'); if (limited('rp:' + u.id, 30, 3600e3)) return err(res, 429, 'slow down'); q('INSERT OR IGNORE INTO review_reports(review_id,user_id,created,weight) VALUES(?,?,?,?)').run(+mm0[1], u.id, now(), (now() - (q('SELECT created FROM users WHERE id=?').get(u.id).created) >= REPORT_MIN_AGE) ? 1 : 0); ratingsCache = null; return json(res, 200, { ok: true }); }
  if (p === '/api/inbox' && m === 'GET') return json(res, 200, q('SELECT id,vendor,amount,currency,date,category,subject,sender,file_id fileId,file_name fileName,file_type fileType,created FROM inbox WHERE user_id=? ORDER BY created').all(u.id));
  let mm;
  if ((mm = p.match(/^\/api\/inbox\/([a-f0-9]{8,40})\/claim$/)) && m === 'POST') { /* move an emailed file into the user's receipt store on the server, then drop the inbox row; never delete unless the file landed */
    const b = await readJson(req, 500), key = String(b.key || ''); if (!/^[\w-]{3,60}$/.test(key)) return err(res, 400, 'bad key');
    const it = q('SELECT file_id FROM inbox WHERE id=? AND user_id=?').get(mm[1], u.id); if (!it) return err(res, 404, 'not found');
    db.exec('BEGIN');
    try {
      if (it.file_id) {
        const f = q('SELECT name,type,data FROM files WHERE id=? AND user_id=?').get(it.file_id, u.id); if (!f) { db.exec('ROLLBACK'); return err(res, 409, 'file missing'); }
        q('INSERT INTO files(id,user_id,name,type,data) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,type=excluded.type,data=excluded.data').run('u' + u.id + ':' + key, u.id, f.name, f.type, f.data);
        q('DELETE FROM files WHERE id=? AND user_id=?').run(it.file_id, u.id);
      }
      q('DELETE FROM inbox WHERE id=? AND user_id=?').run(mm[1], u.id); db.exec('COMMIT');
    } catch (e) { try { db.exec('ROLLBACK'); } catch (x) { } return err(res, 500, 'could not store file'); }
    return json(res, 200, { ok: true });
  }
  if ((mm = p.match(/^\/api\/inbox\/([a-f0-9]{8,40})$/)) && m === 'DELETE') { q('DELETE FROM files WHERE user_id=? AND id=(SELECT file_id FROM inbox WHERE id=? AND user_id=?)').run(u.id, mm[1], u.id); q('DELETE FROM inbox WHERE id=? AND user_id=?').run(mm[1], u.id); return json(res, 200, { ok: true }); }
  /* receipt files: a server copy per signed-in user so receipts survive a cleared browser and open on any device */
  if (p === '/api/rfiles' && m === 'GET') return json(res, 200, q("SELECT substr(id, length(?)+1) k FROM files WHERE user_id=? AND id LIKE ? ESCAPE '\\'").all('u' + u.id + ':', u.id, 'u' + u.id + ':%').map(x => x.k));
  if ((mm = p.match(/^\/api\/rfile\/([\w-]{3,60})$/))) {
    const fid = 'u' + u.id + ':' + mm[1];
    if (m === 'GET') {
      const f = q('SELECT name,type,data FROM files WHERE id=? AND user_id=?').get(fid, u.id);
      if (!f) return err(res, 404, 'not found');
      res.writeHead(200, { 'Content-Type': f.type, 'Content-Disposition': 'attachment; filename="' + String(f.name || 'receipt').replace(/[^\w.\- ]/g, '_') + '"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
      return res.end(Buffer.from(f.data));
    }
    if (m === 'PUT') {
      if (limited('rf:' + u.id, 60, 60e3)) return err(res, 429, 'slow down');
      const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase(), data = await readBody(req, 16e6);
      const isText = type === 'text/plain' && data.length <= 100e3;
      if (!data.length || !(isText || (ALLOWED_FILES.has(type) && magicOk(type, data)))) return err(res, 415, 'unsupported file');
      const used = q("SELECT COALESCE(SUM(length(data)),0) n FROM files WHERE user_id=? AND id!=?").get(u.id, fid).n;
      if (used + data.length > 100e6) return err(res, 413, 'storage full');
      q('INSERT INTO files(id,user_id,name,type,data) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,type=excluded.type,data=excluded.data').run(fid, u.id, clean(url.searchParams.get('name') || 'receipt', 100), type, data);
      return json(res, 200, { ok: true });
    }
    if (m === 'DELETE') { q('DELETE FROM files WHERE id=? AND user_id=?').run(fid, u.id); return json(res, 200, { ok: true }); }
  }
  if ((mm = p.match(/^\/api\/files\/([a-f0-9]{8,40})$/)) && m === 'GET') {
    const f = q('SELECT name,type,data FROM files WHERE id=? AND user_id=?').get(mm[1], u.id);
    if (!f) return err(res, 404, 'not found');
    res.writeHead(200, { 'Content-Type': f.type, 'Content-Disposition': `attachment; filename="${String(f.name || 'receipt').replace(/[^\w.\- ]/g, '_')}"`, 'Cache-Control': 'private, no-store' });
    return res.end(Buffer.from(f.data));
  }
  if (p === '/api/account' && m === 'DELETE') { const b = await readJson(req, 2e3), row = q('SELECT pass FROM users WHERE id=?').get(u.id); if (!(await checkPw(String(b.password || ''), row.pass))) return err(res, 403, 'password incorrect'); q('DELETE FROM users WHERE id=?').run(u.id); res.setHeader('Set-Cookie', 'hoggy_sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); return json(res, 200, { ok: true }); }
  return err(res, 404, 'not found');
}

/* Accepts Postmark-style {To, From, Subject, TextBody, HtmlBody, Attachments:[{Name,ContentType,Content(b64)}]} or simple {to,from,subject,text,attachments}. */
async function inbound(res, b) {
  const get = (...k) => { for (const x of k) if (b[x] != null) return b[x]; return ''; };
  const to = String(get('OriginalRecipient', 'To', 'to')), subject = clean(get('Subject', 'subject'), 200), sender = clean(get('From', 'from'), 200);
  let text = String(get('TextBody', 'text') || '');
  if (!text && b.HtmlBody) text = String(b.HtmlBody).replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const m = to.match(new RegExp('(dr-[a-f0-9]{20})@' + MAIL_DOMAIN.replace(/\./g, '\\.'), 'i'));
  if (!m) return json(res, 202, { ok: false, reason: 'no matching inbox' });
  const u = q('SELECT id FROM users WHERE inbox=?').get(m[1].toLowerCase());
  if (!u) return json(res, 202, { ok: false, reason: 'no matching inbox' });
  if (q('SELECT COUNT(*) n FROM inbox WHERE user_id=?').get(u.id).n >= 50) return json(res, 202, { ok: false, reason: 'inbox full' });
  const forParse = `Subject: ${subject}\n${text.slice(0, 20000)}`;
  let parsed = parseReceipt(forParse.includes('From:') ? forParse : `From: ${sender}\n${forParse}`, 'AUD');
  const atts = Array.isArray(b.Attachments || b.attachments) ? (b.Attachments || b.attachments).slice(0, 5) : [];
  let fileId = null, fileName = null, fileType = null;
  for (const a of atts) {
    const type = String(a.ContentType || a.type || '').toLowerCase(), data = Buffer.from(String(a.Content || a.content || ''), 'base64');
    if (!ALLOWED_FILES.has(type) || !data.length || data.length > 8e6 || !magicOk(type, data)) continue;
    fileId = rid(16); fileName = clean(a.Name || a.name || 'receipt', 100); fileType = type;
    if (type === 'application/pdf' && (parsed.amount == null || !parsed.date)) { /* fill gaps from the PDF's text layer; the email body wins where it already parsed */
      const pt = await pdfText(data);
      if (pt) { const pp = parseReceipt(`From: ${sender}
Subject: ${subject}
${pt}`, 'AUD'); parsed = { ...pp, ...Object.fromEntries(Object.entries(parsed).filter(([k, v]) => v != null && v !== '' && !(k === 'category' && v === 'Other'))) }; }
    }
    q('INSERT INTO files(id,user_id,name,type,data) VALUES(?,?,?,?,?)').run(fileId, u.id, fileName, type, data); break;
  }
  if (!fileId && text) { fileId = rid(16); fileName = 'forwarded-email.txt'; fileType = 'text/plain'; q('INSERT INTO files(id,user_id,name,type,data) VALUES(?,?,?,?,?)').run(fileId, u.id, fileName, 'text/plain', Buffer.from(text.slice(0, 50000))); }
  if (parsed.date) { /* proof of attendance: a receipt emailed to this user's private address, dated inside the event window of one of their trips */
    try {
      const st = q('SELECT json FROM state WHERE user_id=?').get(u.id), trips = st ? (JSON.parse(st.json).trips || []) : [];
      for (const t of trips) { const row = q('SELECT json FROM conferences WHERE id=?').get(String(t.confId || '')); if (!row) continue; const c = JSON.parse(row.json), d = Date.parse(parsed.date + 'T00:00:00Z'); if (d >= Date.parse(c.start + 'T00:00:00Z') - 7 * 864e5 && d <= Date.parse(c.end + 'T00:00:00Z') + 7 * 864e5) q('INSERT OR IGNORE INTO proofs(user_id,conf_id,receipt_date,created) VALUES(?,?,?,?)').run(u.id, c.id, parsed.date, now()); }
    } catch (e) { }
  }
  const id = rid(12);
  q('INSERT INTO inbox(id,user_id,vendor,amount,currency,date,category,subject,sender,file_id,file_name,file_type,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id, u.id, clean(parsed.vendor || subject, 80), parsed.amount ?? null, clean(parsed.currency || 'AUD', 3), parsed.date || null, parsed.category || 'Other', subject, sender, fileId, fileName, fileType, now());
  return json(res, 200, { ok: true, id });
}

/* ---------- backups ---------- */
function backup() {
  try {
    const dir = path.join(DATA, 'backups'); fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, `hoggy-${new Date().toISOString().slice(0, 10)}.db`);
    if (!fs.existsSync(f)) { db.exec(`VACUUM INTO '${f.replace(/'/g, "''")}'`); console.log('backup written', path.basename(f)); }
    fs.readdirSync(dir).filter(x => /^hoggy-\d{4}-\d{2}-\d{2}\.db$/.test(x)).sort().slice(0, -7).forEach(x => fs.unlinkSync(path.join(dir, x)));
  } catch (e) { console.error('backup failed', e.message); }
}
if (!ON_VERCEL) { backup(); setInterval(backup, 6 * 3600e3).unref(); } /* /tmp backups on Vercel would vanish with the instance */
/* ---------- static ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const PUBLIC = new Set(['index.html', 'app.js', 'parse.js', 'pack.js', 'styles.css', 'data/conferences.js', 'data/holidays.js', 'data/cpd-nz.js', 'admin.html', 'admin.js']);
const DEMO_NOTE = '<div class="demo-note" role="note">Preview — accounts and receipts reset from time to time.</div>';
function serveStatic(req, res, url) {
  let rel; try { rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html'; } catch (e) { res.writeHead(400); return res.end('Bad request'); }
  if (!PUBLIC.has(rel)) { res.writeHead(404); return res.end('Not found'); }
  const f = path.join(__dirname, rel);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('Not found'); } if (DEMO && rel === 'index.html') d = Buffer.from(String(d).replace('<body>', '<body>\n' + DEMO_NOTE)); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(req.method === 'HEAD' ? undefined : d); });
}

async function handler(req, res) {
  secHeaders(res);
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/healthz') { q('SELECT 1').get(); return json(res, 200, { ok: true, conferences: q("SELECT COUNT(*) n FROM conferences WHERE status='published'").get().n }); }
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    serveStatic(req, res, url);
  } catch (e) {
    if (e && e.code === 413) return err(res, 413, 'payload too large');
    if (e && e.code === 400) return err(res, 400, e.message);
    console.error(e); if (!res.headersSent) err(res, 500, 'server error'); else res.end();
  }
}
/* Startup (DB, migrations, seed, inbound secret) runs once at module load, i.e. once per process or serverless cold start.
   `node server.js` listens; require('./server.js') only exports the handler (api/index.js uses it on Vercel). */
const server = http.createServer(handler);
if (require.main === module) server.listen(PORT, HOST, () => {
  console.log(`Hoggy running at http://${HOST}:${PORT}`);
  console.log(`Inbound email webhook: POST /api/inbound/email with header X-Hoggy-Secret (see ${secretFile}); mail domain ${MAIL_DOMAIN}`);
});
module.exports = { handler, server };
