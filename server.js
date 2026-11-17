'use strict';
/* Hoggy backend. Node 22+. Run: node server.js
   Storage: Postgres when DATABASE_URL is set (production: Supabase, schema `hoggy`, see db/postgres/001_init.sql to 003_*.sql),
   otherwise SQLite in HOGGY_DATA (node:sqlite; local dev and tests). Both go through lib/db.js. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const DB = require('./lib/db.js');
const { parseReceipt } = require('./parse.js');
const { pdfText } = require('./lib/pdftext.js');
const { makeIngest, validate: validateConf } = require('./lib/ingest.js');
const { seriesKey, seriesTitle, validKey } = require('./lib/series.js');
const COV = require('./lib/coverage.js');
const RV = require('./lib/reviews.js');
const { makeHospitalApi } = require('./lib/hospital-api.js');
const ADMIN_KEY = process.env.HOGGY_ADMIN_KEY || '';
const REPORT_MIN_AGE = (process.env.HOGGY_REPORT_MIN_AGE_H === undefined ? 24 : +process.env.HOGGY_REPORT_MIN_AGE_H) * 3600e3;
const ADMINS = new Set(String(process.env.HOGGY_ADMINS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean));
if (ADMINS.size && !ADMIN_KEY) console.warn('HOGGY_ADMINS is set but HOGGY_ADMIN_KEY is not: every admin endpoint stays off until the key is set');

const ON_VERCEL = !!process.env.VERCEL; /* serverless: read-only filesystem except /tmp, instances recycled, always behind Vercel's HTTPS proxy */
const DATABASE_URL = process.env.DATABASE_URL || '';
const PG = !!DATABASE_URL; /* shared, persistent database: several instances may run at once */
const DEMO = (ON_VERCEL && !PG) || process.env.HOGGY_DEMO === '1'; /* "Preview — resets" note only while data lives in /tmp */
const PORT = +process.env.PORT || 8123;
const HOST = process.env.HOST || '127.0.0.1';
const DATA = process.env.HOGGY_DATA || (ON_VERCEL ? '/tmp/hoggy-data' : path.join(__dirname, 'data-store'));
const MAIL_DOMAIN = process.env.HOGGY_MAIL_DOMAIN || 'receipts.hoggy.app';
const LOOPBACK = !ON_VERCEL && ['127.0.0.1', 'localhost', '::1'].includes(HOST);
const SECURE = process.env.HOGGY_INSECURE_COOKIES !== '1' && !LOOPBACK;
const TRUST_PROXY = ON_VERCEL || process.env.HOGGY_TRUST_PROXY === '1';
const CONF_FILE = path.join(__dirname, 'data', 'conferences.js');
const COURSE_DIR = path.join(__dirname, 'data', 'courses');
if (!PG) fs.mkdirSync(DATA, { recursive: true });

const db = PG
  ? DB.open({ url: DATABASE_URL, schema: process.env.HOGGY_PG_SCHEMA || 'hoggy', max: +process.env.HOGGY_PG_POOL || 3, ca: process.env.HOGGY_PG_CA || undefined })
  : DB.open({ file: path.join(DATA, 'hoggy.db') });

/* inbound-email shared secret: HOGGY_INBOUND_SECRET, else generated once and kept (SQLite: data-store/inbound-secret.txt;
   Postgres: meta.inbound_secret, so every instance agrees). Loaded by init(). */
const secretFile = path.join(DATA, 'inbound-secret.txt');
let INBOUND_SECRET = '';

const SQLITE_SCHEMA = `PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, pass TEXT NOT NULL, inbox TEXT UNIQUE NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(sid TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS state(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, json TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS inbox(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, vendor TEXT, amount REAL, currency TEXT, date TEXT, category TEXT, subject TEXT, sender TEXT, file_id TEXT, file_name TEXT, file_type TEXT, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS conferences(id TEXT PRIMARY KEY, json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'published', source TEXT, updated INTEGER NOT NULL, checked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS candidates(id TEXT PRIMARY KEY, source TEXT, json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS ingest_runs(id INTEGER PRIMARY KEY, started INTEGER, finished INTEGER, summary TEXT);
CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT, type TEXT, data BLOB NOT NULL);
CREATE TABLE IF NOT EXISTS date_changes(id INTEGER PRIMARY KEY, conf_id TEXT NOT NULL, patch TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created INTEGER NOT NULL, UNIQUE(conf_id, patch));
CREATE TABLE IF NOT EXISTS review_reports(review_id INTEGER NOT NULL, user_id INTEGER NOT NULL, created INTEGER NOT NULL, weight INTEGER DEFAULT 1, PRIMARY KEY(review_id, user_id));
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rate_hits(key TEXT NOT NULL, t INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS rate_hits_key_t ON rate_hits(key, t);
CREATE TABLE IF NOT EXISTS receipt_checks(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, series_key TEXT NOT NULL, edition_year INTEGER NOT NULL, conf_id TEXT NOT NULL, inbox_id TEXT, vendor TEXT, amount REAL, currency TEXT, receipt_date TEXT, subject TEXT, file_name TEXT, file_type TEXT, size INTEGER NOT NULL DEFAULT 0, data BLOB, status TEXT NOT NULL DEFAULT 'pending', note TEXT, created INTEGER NOT NULL, decided INTEGER, decided_by TEXT);
CREATE INDEX IF NOT EXISTS rc_edition ON receipt_checks(user_id, series_key, edition_year);
CREATE TABLE IF NOT EXISTS coverage(id INTEGER PRIMARY KEY, series_key TEXT NOT NULL, type TEXT NOT NULL CHECK (type IN ('meeting-report','abstract-supplement','society-journal','news')), title TEXT, publication TEXT NOT NULL CHECK (length(trim(publication)) > 0), year INTEGER, url TEXT NOT NULL CHECK (url LIKE 'https://%'), added_by INTEGER REFERENCES users(id) ON DELETE SET NULL, added_on INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', decided INTEGER, decided_by TEXT, UNIQUE(series_key, url));
CREATE INDEX IF NOT EXISTS coverage_series ON coverage(series_key, status);
CREATE TABLE IF NOT EXISTS orgs(id INTEGER PRIMARY KEY, name TEXT NOT NULL CHECK (length(trim(name)) > 0), join_code TEXT NOT NULL UNIQUE CHECK (length(join_code) = 8), claims_email TEXT, default_allowance_cents INTEGER NOT NULL DEFAULT 0 CHECK (default_allowance_cents >= 0), currency TEXT NOT NULL DEFAULT 'AUD', created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS memberships(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK (role IN ('doctor','manager','finance','admin')), created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS memberships_org ON memberships(org_id, role);
CREATE TABLE IF NOT EXISTS allowances(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE, year INTEGER NOT NULL, allowance_cents INTEGER NOT NULL CHECK (allowance_cents >= 0), set_by INTEGER REFERENCES users(id) ON DELETE SET NULL, updated INTEGER NOT NULL, PRIMARY KEY(user_id, org_id, year));
CREATE TABLE IF NOT EXISTS approvals(id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, trip_ref TEXT NOT NULL, conf_id TEXT, snapshot TEXT NOT NULL, year INTEGER NOT NULL, estimate_cents INTEGER NOT NULL CHECK (estimate_cents > 0), currency TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')), manager_comment TEXT, decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, decided INTEGER, UNIQUE(org_id, user_id, trip_ref));
CREATE INDEX IF NOT EXISTS approvals_org_status ON approvals(org_id, status);
CREATE INDEX IF NOT EXISTS approvals_user ON approvals(user_id, year);
CREATE TABLE IF NOT EXISTS claims(id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, approval_id INTEGER REFERENCES approvals(id) ON DELETE SET NULL, trip_ref TEXT NOT NULL, conf_id TEXT, snapshot TEXT NOT NULL, year INTEGER NOT NULL, total_cents INTEGER NOT NULL CHECK (total_cents > 0), currency TEXT NOT NULL, receipts INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','paid')), submitted INTEGER NOT NULL, paid INTEGER, paid_by INTEGER REFERENCES users(id) ON DELETE SET NULL, UNIQUE(org_id, user_id, trip_ref));
CREATE INDEX IF NOT EXISTS claims_org_status ON claims(org_id, status);
CREATE INDEX IF NOT EXISTS claims_user ON claims(user_id, year);
CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, org_id INTEGER REFERENCES orgs(id) ON DELETE CASCADE, kind TEXT NOT NULL, text TEXT NOT NULL, link TEXT, created INTEGER NOT NULL, seen INTEGER);
CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id, created);`;
/* receipt_checks and coverage: same tables as db/postgres/002_receipt_checks_coverage.sql; orgs to notifications: 003_hospitals.sql */
/* legacy (before B36): rows were tied to client-synced trips, so they no longer verify anything; kept only so old SQLite databases open */
const SQLITE_LEGACY = 'CREATE TABLE IF NOT EXISTS proofs(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, conf_id TEXT NOT NULL, receipt_date TEXT, created INTEGER NOT NULL, PRIMARY KEY(user_id, conf_id))';

const sha = v => crypto.createHash('sha256').update(String(v)).digest('hex');
const setMeta = (t, key, value) => t.run('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, value);

/* Schema. SQLite: CREATE IF NOT EXISTS plus the old column and review migrations. Postgres: db/postgres/NNN_*.sql (the
   same files you apply by hand), each run only when its hash differs from the one in meta, under an advisory lock so two
   cold starts never run DDL at the same time. */
async function migrate() {
  if (db.kind === 'sqlite') {
    await db.exec(SQLITE_SCHEMA);
    for (const s of ['ALTER TABLE conferences ADD COLUMN seedhash TEXT', 'ALTER TABLE review_reports ADD COLUMN weight INTEGER DEFAULT 1']) { try { await db.exec(s); } catch (e) { /* exists */ } }
    await db.exec(SQLITE_LEGACY);
    return; /* migrateReviews() runs after the seed: it looks up each old review's conference */
  }
  /* every numbered file in db/postgres, in order; each is tracked by its own hash (001: meta.schema_hash, later files:
     meta."schema_hash:NNN") so a new file runs once without re-running the ones before it */
  const files = fs.readdirSync(path.join(__dirname, 'db', 'postgres')).filter(f => /^\d{3}_[\w-]+\.sql$/.test(f)).sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(__dirname, 'db', 'postgres', f), 'utf8').replace(/\bhoggy\b/g, db.schema), h = sha(sql), n = f.slice(0, 3), mk = n === '001' ? 'schema_hash' : 'schema_hash:' + n;
    let cur = null; try { cur = await db.get('SELECT value FROM meta WHERE key=?', mk); } catch (e) { /* fresh database: no meta table yet */ }
    if (cur && cur.value === h) continue;
    try {
      await db.tx(async t => { await t.get('SELECT pg_advisory_xact_lock(hashtext(?))', 'hoggy-schema:' + db.schema); await t.exec(sql); await setMeta(t, mk, h); });
      console.log(`postgres schema ${db.schema} is up to date (${f} applied)`);
    } catch (e) {
      /* e.g. tables created by another role: keep serving if the tables are there, the queries will say if not */
      console.error(`postgres schema ${db.schema}: migration failed in ${f} (${e.message}); continuing with the existing schema`);
    }
  }
}

/* ---------- reviews v2: one review per user per conference SERIES per edition year ----------
   Older SQLite databases had one review per user per conference row, with a "verified" flag worked out from client-synced
   trip state (forgeable, B36). They move into the new table once, keeping their ids (so reports stay attached); every
   verified flag is reset; the old table is kept as reviews_v1 so nothing is lost. Postgres starts on the new model. */
const REVIEWS_V2 = `CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, series_key TEXT NOT NULL, edition_year INTEGER NOT NULL, conf_id TEXT, city TEXT,
    rating REAL NOT NULL, content INTEGER, networking INTEGER, venue INTEGER, value INTEGER, cpd INTEGER, text TEXT NOT NULL, author TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL,
    verify TEXT NOT NULL DEFAULT 'none', verified_by TEXT, UNIQUE(user_id, series_key, edition_year));
  CREATE INDEX IF NOT EXISTS rv2_series ON reviews(series_key);
  CREATE TABLE IF NOT EXISTS review_proofs(id TEXT PRIMARY KEY, review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, name TEXT, type TEXT NOT NULL, size INTEGER NOT NULL, data BLOB, status TEXT NOT NULL DEFAULT 'pending', note TEXT, created INTEGER NOT NULL, decided INTEGER, decided_by TEXT);
  CREATE INDEX IF NOT EXISTS rp_review ON review_proofs(review_id);
  CREATE TABLE IF NOT EXISTS attend_receipts(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, series_key TEXT NOT NULL, edition_year INTEGER NOT NULL, conf_id TEXT NOT NULL, inbox_id TEXT, receipt_date TEXT, created INTEGER NOT NULL, PRIMARY KEY(user_id, series_key, edition_year));`;
async function migrateReviews() {
  const cols = (await db.all('PRAGMA table_info(reviews)')).map(c => c.name);
  const legacy = cols.length > 0 && !cols.includes('series_key');
  if (!legacy) return db.exec(REVIEWS_V2);
  await db.tx(async t => { /* one transaction: rename, create and copy all happen or none do */
    t.exec('ALTER TABLE reviews RENAME TO reviews_v1'); t.exec(REVIEWS_V2);
    const old = t.all('PRAGMA table_info(reviews_v1)').map(c => c.name);
    let n = 0, kept = 0;
    for (const r of t.all(`SELECT id,user_id,conf_id,rating,text,author,created${old.includes('dims') ? ',dims' : ''} FROM reviews_v1`)) {
      const row = t.get('SELECT json FROM conferences WHERE id=?', r.conf_id), c = row ? JSON.parse(row.json) : null;
      let d = {}; try { d = JSON.parse(r.dims || '{}') || {}; } catch (e) { }
      const dim = k => { const v = Math.round(+d[k]); return v >= 1 && v <= 5 ? v : null; };
      const key = c ? seriesKey(c) : String(r.conf_id).replace(/-?(19|20)\d{2}$/, ''), year = c ? +c.start.slice(0, 4) : new Date(r.created).getUTCFullYear();
      const res = t.run(`INSERT INTO reviews(id,user_id,series_key,edition_year,conf_id,city,rating,content,networking,venue,value,cpd,text,author,created,updated,verify) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'none') ON CONFLICT DO NOTHING`, r.id, r.user_id, key, year, c ? c.id : r.conf_id, c ? c.city : null, r.rating, dim('content'), dim('networking'), dim('venue'), dim('value'), dim('cpd'), r.text, r.author, r.created, r.created);
      res.changes ? n++ : kept++;
    }
    console.log(`reviews migrated to series model: ${n}${kept ? `, ${kept} same-series duplicates left in reviews_v1` : ''}; verified flags reset`);
  });
}

/* Seed the live conference table from the curated static file. Skipped entirely while the file's hash matches
   meta.conf_seed_hash (no rewrite of every row on each cold start); otherwise new ids are inserted and curated rows whose
   content changed are updated. Live edits (source 'live-edited') are never overwritten. */
async function seedConferences() {
  try {
    const src = fs.readFileSync(CONF_FILE, 'utf8'), fileHash = sha(src);
    const cur = await db.get("SELECT value FROM meta WHERE key='conf_seed_hash'");
    if (cur && cur.value === fileHash) return;
    const ctx = { window: {} }; vm.runInNewContext(src, ctx, { timeout: 3000 });
    const have = new Map((await db.all('SELECT id, seedhash, source FROM conferences')).map(r => [r.id, r])), t0 = Date.now(), ins = [], upd = [];
    for (const c of ctx.window.HOGGY_CONFERENCES) {
      const js = JSON.stringify(c), h = crypto.createHash('sha1').update(js).digest('hex'), row = have.get(c.id);
      if (!row) ins.push([c.id, js, t0, h]);
      else if (row.source === 'curated' && row.seedhash !== h) upd.push([js, h, t0, c.id]);
    }
    await db.tx(async t => {
      for (let i = 0; i < ins.length; i += 100) { const ch = ins.slice(i, i + 100); await t.run(`INSERT INTO conferences(id,json,status,source,updated,checked,seedhash) VALUES ${ch.map(() => "(?,?,'published','curated',?,0,?)").join(',')} ON CONFLICT(id) DO NOTHING`, ...ch.flat()); }
      for (const u of upd) await t.run("UPDATE conferences SET json=?, seedhash=?, updated=? WHERE id=? AND source='curated'", ...u);
      await setMeta(t, 'conf_seed_hash', fileHash);
    });
    if (ins.length || upd.length) console.log(`seed: ${ins.length} new, ${upd.length} updated conferences`);
  } catch (e) { console.error('seed failed', e.message); }
}

async function loadInboundSecret() {
  if (process.env.HOGGY_INBOUND_SECRET) return process.env.HOGGY_INBOUND_SECRET;
  if (db.kind === 'sqlite') { try { return fs.readFileSync(secretFile, 'utf8').trim(); } catch (e) { const s = crypto.randomBytes(24).toString('hex'); fs.writeFileSync(secretFile, s, { mode: 0o600 }); return s; } }
  await db.run("INSERT INTO meta(key,value) VALUES('inbound_secret',?) ON CONFLICT(key) DO NOTHING", crypto.randomBytes(24).toString('hex'));
  if (ON_VERCEL) console.warn('HOGGY_INBOUND_SECRET is not set: the inbound-email webhook uses the secret stored in the database (meta.inbound_secret)');
  return (await db.get("SELECT value FROM meta WHERE key='inbound_secret'")).value;
}

/* Startup (schema, seed, inbound secret, local backup) runs once per process or serverless cold start. Requests wait for it;
   if it fails (database unreachable) the next request tries again. */
async function init() {
  await migrate();
  await seedConferences();
  if (db.kind === 'sqlite') await migrateReviews();
  INBOUND_SECRET = await loadInboundSecret();
  if (!ON_VERCEL && db.kind === 'sqlite') { await backup(); setInterval(backup, 6 * 3600e3).unref(); } /* /tmp backups on Vercel would vanish with the instance; Supabase backs up Postgres */
}
let ready = null;
const whenReady = () => ready || (ready = init().catch(e => { ready = null; throw e; }));

const ingest = makeIngest({ db, now: () => Date.now() });
let ingesting = false;
async function runIngest(limit) { if (ingesting) return { busy: true }; ingesting = true; try { await whenReady(); return await ingest.run({ limit }); } catch (e) { console.error('ingest failed', e); return { error: String(e.message) }; } finally { ingesting = false; confCache = null; } }
let confCache = null;
if (process.env.HOGGY_INGEST === '1' && !ON_VERCEL) { /* never on Vercel: no long-lived process to run it */ setTimeout(() => runIngest(60), 30e3).unref(); setInterval(() => runIngest(60), 6 * 3600e3).unref(); console.log('Continuous ingest ON (every 6h)'); }

/* Conference list, cached per process. With a shared database another instance may have changed it, so the cache is
   re-validated (row count and newest `updated`) at most every 10 s. */
async function getConfs() {
  if (confCache && (!PG || now() - confCache.checked < 10e3)) return confCache;
  if (confCache) {
    const s = await db.get("SELECT COUNT(*) n, COALESCE(MAX(updated),0) u FROM conferences WHERE status IN ('published','flagged')");
    if (s.n === confCache.list.length && s.u === confCache.updated) { confCache.checked = now(); return confCache; }
  }
  const rows = await db.all("SELECT id, json, status, updated FROM conferences WHERE status IN ('published','flagged') ORDER BY id");
  const list = rows.map(r => { const c = JSON.parse(r.json); if (r.status === 'flagged') c.flagged = true; return c; }).sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
  const cc = { updated: rows.reduce((a, r) => Math.max(a, r.updated), 0), list, checked: now() };
  cc.etag = '"' + cc.updated + '-' + cc.list.length + '"';
  return (confCache = cc);
}
/* Courses: read once per process from data/courses/*.json; sessions that have finished are dropped (re-filtered each day). */
let courseCache = null;
function getCourses() {
  const day = new Date().toISOString().slice(0, 10);
  if (courseCache && courseCache.day === day) return courseCache;
  const raw = courseCache ? courseCache.raw : (() => { const r = f => JSON.parse(fs.readFileSync(path.join(COURSE_DIR, f), 'utf8')); return { cat: r('catalogue.json'), ses: r('sessions.json') }; })();
  const sessions = (raw.ses.sessions || []).filter(s => s.end >= day).sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
  const body = JSON.stringify({ generated: raw.cat.generated, courses: raw.cat.courses, sessions });
  return (courseCache = { day, raw, body, etag: '"' + sha(body).slice(0, 20) + '"' });
}
/* series index, rebuilt with the conference cache: key -> editions [{id, year, city, start, end, name}], conference id -> key */
async function seriesIdx() {
  const cc = await getConfs(); if (cc.series) return cc.series;
  const by = new Map(), ofConf = new Map();
  for (const c of cc.list) { const k = seriesKey(c); ofConf.set(c.id, k); (by.get(k) || by.set(k, []).get(k)).push({ id: c.id, year: +c.start.slice(0, 4), city: c.city, country: c.country, specialty: c.specialty, start: c.start, end: c.end, name: c.name }); }
  return (cc.series = { by, ofConf });
}
const seriesName = (idx, key) => { const e = (idx.by.get(key) || []).slice().sort((a, b) => b.start.localeCompare(a.start))[0]; return e ? e.name : key; };

/* ---------- helpers ---------- */
const rid = (n = 12) => crypto.randomBytes(n).toString('hex');
const now = () => Date.now();
const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, (e, k) => e ? rej(e) : res(k)));
async function hashPw(pw) { const salt = crypto.randomBytes(16); const h = await scrypt(pw, salt); return salt.toString('hex') + ':' + h.toString('hex'); }
async function checkPw(pw, stored) { const [s, h] = String(stored).split(':'); if (!s || !h) return false; const x = await scrypt(pw, Buffer.from(s, 'hex')); const y = Buffer.from(h, 'hex'); return x.length === y.length && crypto.timingSafeEqual(x, y); }
const DUMMY = hashPw('dummy-password-for-timing');
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const emailOk = e => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(e) && e.length <= 254;
const magicOk = (t, d) => t === 'application/pdf' ? d.subarray(0, 5).toString('latin1') === '%PDF-' : t === 'image/png' ? d.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) : t === 'image/jpeg' ? d[0] === 0xff && d[1] === 0xd8 : t === 'image/webp' ? d.subarray(0, 4).toString('latin1') === 'RIFF' && d.subarray(8, 12).toString('latin1') === 'WEBP' : false;
const ALLOWED_FILES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
const PROOF_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']), PROOF_MAX = 5e6, REVIEW_MAX = 600;
const PW_MIN = 10;

/* Rate limits live in the database (rate_hits), so every serverless instance counts the same attempts. Keys are hashed:
   the table never holds an email or IP. Rows older than an hour (the longest window) are cleared by housekeeping. */
const rkey = k => sha(k).slice(0, 32);
const countHits = async (k, windowMs) => (await db.get('SELECT COUNT(*) n FROM rate_hits WHERE key=? AND t>?', k, now() - windowMs)).n;
async function limited(key, max, windowMs) { const k = rkey(key); if ((await countHits(k, windowMs)) >= max) return true; /* over the limit: refuse without adding rows */ await db.run('INSERT INTO rate_hits(key,t) VALUES(?,?)', k, now()); return false; }
const tooMany = async (key, max, windowMs) => (await countHits(rkey(key), windowMs)) >= max;
const hit = key => db.run('INSERT INTO rate_hits(key,t) VALUES(?,?)', rkey(key), now());
const clientIp = req => TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',').pop().trim() || req.socket.remoteAddress || '' : req.socket.remoteAddress || '';
/* public scores, cached per process; with a shared database other instances' new reviews show within 15 s */
let ratingsCache = null;
const RATINGS_TTL = PG ? 15e3 : 60e3;
/* scores per series (shared by /api/ratings and /api/top-rated); the ranking is derived from the same cache entry */
async function getRatings() {
  if (!ratingsCache || now() - ratingsCache.t > RATINGS_TTL) {
    const by = {};
    for (const r of await db.all(`SELECT series_key, user_id, verify, rating, content, networking, venue, value, cpd FROM reviews WHERE ${VISIBLE}`)) (by[r.series_key] || (by[r.series_key] = [])).push(r);
    ratingsCache = { t: now(), v: Object.fromEntries(Object.entries(by).map(([k, rows]) => [k, RV.scoreOf(rows)])) };
  }
  return ratingsCache;
}
/* a series' card details: the next upcoming edition (else the latest), its title without the year, its specialty */
function seriesMeta(idx, key) {
  const eds = idx.by.get(key); if (!eds || !eds.length) return null;
  const day = new Date().toISOString().slice(0, 10), up = eds.filter(e => e.end >= day).sort((a, b) => a.start.localeCompare(b.start))[0];
  const e = up || eds.slice().sort((a, b) => b.start.localeCompare(a.start))[0];
  return { title: seriesTitle({ name: e.name }), confId: e.id, specialty: e.specialty || '', city: e.city || '', country: e.country || '', start: e.start, upcoming: !!up };
}
/* a review counts unless 3 reports from accounts older than HOGGY_REPORT_MIN_AGE_H hide it */
const VISIBLE = '(SELECT COUNT(*) FROM review_reports x WHERE x.weight=1 AND x.review_id=reviews.id) < 3';
/* what anyone may see about a review; the verification state comes only from the server's own records */
function pubReview(r, me) {
  const mine = !!me && me.id === r.user_id;
  const o = { id: r.id, seriesKey: r.series_key, editionYear: r.edition_year, city: r.city || '', confId: r.conf_id || null, rating: r.rating, ratings: Object.fromEntries(DIMS.map(k => [k, r[k] ?? null])), text: r.text, author: r.author, created: r.created, updated: r.updated, verified: r.verify === 'verified', mine };
  if (mine) { o.verify = r.verify; o.proof = r.proof || null; }
  return o;
}
const DIMS = RV.DIMS;
const HOSP = makeHospitalApi({ db, now: () => now(), clean: (v, n) => clean(v, n), emailOk: e => emailOk(e), limited: (k, n, w) => limited(k, n, w), readJson: (r, l) => readJson(r, l), json: (r, c, o) => json(r, c, o), err: (r, c, msg) => err(r, c, msg), getConfs: () => getConfs(), isUnique: DB.isUnique });
/* housekeeping: every 10 minutes per process, and on the first request after that on a serverless instance */
let lastHk = 0;
async function housekeep() {
  lastHk = now(); const t = now(), old = t - 30 * 864e5;
  try {
    await db.run('DELETE FROM sessions WHERE expires < ?', t);
    await db.run('DELETE FROM rate_hits WHERE t < ?', t - 3600e3);
    await db.run('DELETE FROM files WHERE id IN (SELECT file_id FROM inbox WHERE created < ? AND file_id IS NOT NULL)', old);
    await db.run('DELETE FROM inbox WHERE created < ?', old);
    await db.run('DELETE FROM notifications WHERE created < ?', t - 120 * 864e5);
  } catch (e) { console.error('housekeeping failed', e.message); }
}
setInterval(() => { if (ready) housekeep(); }, 600e3).unref();

const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' blob: data:; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-src 'self' about:; frame-ancestors 'none'";
function secHeaders(res) { res.setHeader('Content-Security-Policy', CSP); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Frame-Options', 'DENY'); }
function json(res, code, obj, extra = {}) { const b = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra }); res.end(b); }
const err = (res, code, msg) => json(res, code, { error: msg });
function readBody(req, limit) { return new Promise((res, rej) => { let n = 0; const c = []; req.on('data', d => { n += d.length; if (n > limit) { rej(Object.assign(new Error('too large'), { code: 413 })); req.destroy(); } else c.push(d); }); req.on('end', () => res(Buffer.concat(c))); req.on('error', rej); }); }
async function readJson(req, limit) { const b = await readBody(req, limit); try { const v = JSON.parse(b.toString('utf8') || '{}'); if (v === null || typeof v !== 'object') throw 0; return v; } catch (e) { throw Object.assign(new Error('bad json'), { code: 400 }); } }

function cookies(req) { const o = {}; String(req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) { const v = p.slice(i + 1).trim(); try { o[p.slice(0, i).trim()] = decodeURIComponent(v); } catch (e) { o[p.slice(0, i).trim()] = v; } } }); return o; }
async function setSession(res, uid) { const sid = rid(24), exp = now() + 30 * 864e5; await db.run('INSERT INTO sessions(sid,user_id,expires) VALUES(?,?,?)', sha(sid), uid, exp); res.setHeader('Set-Cookie', `hoggy_sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 86400}${SECURE ? '; Secure' : ''}`); }
async function userOf(req) { const sid = cookies(req).hoggy_sid; if (!sid) return null; const r = await db.get('SELECT u.id,u.email,u.name,u.inbox,s.expires FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.sid=?', sha(sid)); if (!r || r.expires < now()) return null; return r; }
const pub = u => ({ id: u.id, email: u.email, name: u.name, inbox: `${u.inbox}@${MAIL_DOMAIN}`, admin: ADMINS.has(String(u.email).toLowerCase()) });
const MSG = {
  email: 'Enter a valid email address.',
  pwLen: `Use at least ${PW_MIN} characters for your password.`,
  taken: 'That email is already registered.',
  wrong: 'Wrong email or password.',
  regLimit: 'Too many sign-ups from this network. Try again in an hour.',
  loginLimit: 'Too many sign-in attempts. Wait 15 minutes, then try again.',
  pwBad: 'That password is not right, so the account was not deleted.',
};

/* ---------- API ---------- */
async function api(req, res, url) {
  const p = url.pathname, m = req.method, ip = clientIp(req);

  /* inbound email: authenticated by shared secret, not by cookie */
  if (p === '/api/inbound/email' && m === 'POST') {
    if (await limited('inb', 120, 60e3)) return err(res, 429, 'slow down');
    const given = String(req.headers['x-hoggy-secret'] || (/^Basic /i.test(req.headers.authorization || '') ? Buffer.from(req.headers.authorization.slice(6), 'base64').toString().split(':').pop() : ''));
    const a = Buffer.from(given), b = Buffer.from(INBOUND_SECRET);
    if (!b.length || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return err(res, 401, 'bad secret');
    const body = await readJson(req, 12e6);
    return await inbound(res, body);
  }

  /* CSRF: mutating calls must be JSON-ish with a custom header (cannot be sent cross-site without CORS preflight, which we never allow) */
  if (m !== 'GET' && m !== 'HEAD' && req.headers['x-requested-with'] !== 'hoggy') return err(res, 403, 'missing header');

  if (p === '/api/register' && m === 'POST') {
    if (await limited('reg:' + ip, 10, 3600e3)) return err(res, 429, MSG.regLimit);
    const b = await readJson(req, 4e3), email = clean(b.email, 254).toLowerCase(), pw = String(b.password || ''), name = clean(b.name, 80);
    if (!emailOk(email)) return err(res, 400, MSG.email);
    if (pw.length < PW_MIN || pw.length > 200) return err(res, 400, pw.length > 200 ? 'Use at most 200 characters for your password.' : MSG.pwLen);
    if (await db.get('SELECT 1 FROM users WHERE email=?', email)) return err(res, 409, MSG.taken);
    const inbox = 'dr-' + crypto.randomBytes(10).toString('hex');
    let r;
    try { r = await db.get('INSERT INTO users(email,name,pass,inbox,created) VALUES(?,?,?,?,?) RETURNING id', email, name, await hashPw(pw), inbox, now()); } catch (e) { if (DB.isUnique(e)) return err(res, 409, MSG.taken); throw e; }
    await setSession(res, r.id);
    return json(res, 201, { user: pub({ id: r.id, email, name, inbox }) });
  }
  if (p === '/api/login' && m === 'POST') {
    const b = await readJson(req, 4e3), email = clean(b.email, 254).toLowerCase(), u = await db.get('SELECT * FROM users WHERE email=?', email);
    if ((await tooMany('login:' + ip, 20, 900e3)) || (await tooMany('loginE:' + email, 10, 900e3))) return err(res, 429, MSG.loginLimit);
    const ok = await checkPw(String(b.password || ''), u ? u.pass : await DUMMY);
    if (!u || !ok) { await hit('login:' + ip); await hit('loginE:' + email); return err(res, 401, MSG.wrong); }
    await setSession(res, u.id);
    return json(res, 200, { user: pub(u) });
  }
  if (p === '/api/logout' && m === 'POST') { const sid = cookies(req).hoggy_sid; if (sid) await db.run('DELETE FROM sessions WHERE sid=?', sha(sid)); res.setHeader('Set-Cookie', 'hoggy_sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); return json(res, 200, { ok: true }); }

  if (p === '/api/conferences' && m === 'GET') {
    const cc = await getConfs();
    if (req.headers['if-none-match'] === cc.etag) { res.writeHead(304, { ETag: cc.etag }); return res.end(); }
    return json(res, 200, { updated: cc.updated, conferences: cc.list }, { ETag: cc.etag });
  }
  /* public: course catalogue and upcoming sessions (static files bundled with the function, like data/conferences.js) */
  if (p === '/api/courses' && m === 'GET') {
    const cc = getCourses();
    if (req.headers['if-none-match'] === cc.etag) { res.writeHead(304, { ETag: cc.etag }); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache', ETag: cc.etag }); return res.end(cc.body);
  }
  /* public: community scores per conference SERIES (all editions), weighted verified x1, unverified x0.5, hidden under 3 reviews */
  if (p === '/api/ratings' && m === 'GET') return json(res, 200, (await getRatings()).v);
  /* public: "Highest rated by attendees" — series with 3+ reviews, by the weighted score; ?specialty= filters, ?limit= 1..50 */
  if (p === '/api/top-rated' && m === 'GET') {
    const rc = await getRatings(), idx = await seriesIdx(), spec = clean(url.searchParams.get('specialty'), 80), lim = Math.min(50, Math.max(1, Math.floor(+url.searchParams.get('limit')) || 6));
    if (!rc.top || rc.topIdx !== idx) { rc.top = RV.topRated(rc.v, k => seriesMeta(idx, k), { limit: 1e6 }); rc.topIdx = idx; }
    const list = (spec ? rc.top.filter(x => x.specialty === spec) : rc.top).slice(0, lim);
    return json(res, 200, { min: RV.MIN_REVIEWS, specialty: spec || null, series: list }, { 'Cache-Control': 'public, max-age=30' });
  }
  /* public: approved "Covered in" links for a series (?series=<key> or ?conf=<id>) */
  if (p === '/api/coverage' && m === 'GET') {
    const key = url.searchParams.has('series') ? clean(url.searchParams.get('series'), 80) : (await seriesIdx()).ofConf.get(clean(url.searchParams.get('conf'), 80));
    if (!key || !validKey(key)) return json(res, 200, []);
    return json(res, 200, (await db.all("SELECT id, series_key \"seriesKey\", type, title, publication, year, url, added_on \"addedOn\" FROM coverage WHERE series_key=? AND status='approved' ORDER BY year DESC, added_on DESC LIMIT 50", key)).map(r => ({ ...r, typeLabel: COV.TYPES[r.type] || r.type })));
  }
  if (p === '/api/reviews' && m === 'GET') {
    const me = await userOf(req), key = url.searchParams.has('series') ? clean(url.searchParams.get('series'), 80) : (await seriesIdx()).ofConf.get(clean(url.searchParams.get('conf'), 80));
    if (!key) return json(res, 200, []);
    return json(res, 200, (await db.all(`SELECT r.*, (SELECT status FROM review_proofs p WHERE p.review_id=r.id ORDER BY p.created DESC LIMIT 1) proof FROM reviews r WHERE r.series_key=? AND ${VISIBLE.replace(/reviews\.id/g, 'r.id')} ORDER BY r.edition_year DESC, (r.verify='verified') DESC, r.created DESC LIMIT 200`, key)).map(r => pubReview(r, me)));
  }

  let mm0;
  const u = await userOf(req);
  if (p === '/api/me' && m === 'GET') return json(res, 200, { user: u ? pub(u) : null });
  if (!u) return err(res, 401, 'sign in required');

  if (p.startsWith('/api/admin/')) {
    if (!ADMINS.has(String(u.email).toLowerCase())) return err(res, 403, 'admin only');
    if (!ADMIN_KEY) return err(res, 403, 'admin disabled: set HOGGY_ADMIN_KEY');
    { const k = Buffer.from(String(req.headers['x-admin-key'] || '')), w = Buffer.from(ADMIN_KEY); if (k.length !== w.length || !crypto.timingSafeEqual(k, w)) return err(res, 403, 'admin key required'); }
    let am;
    if (p === '/api/admin/candidates' && m === 'GET') return json(res, 200, (await db.all("SELECT id, source, json, status, created FROM candidates WHERE status='pending' ORDER BY created DESC LIMIT 200")).map(r => ({ ...r, json: JSON.parse(r.json) })));
    if ((am = p.match(/^\/api\/admin\/candidates\/(cand-[a-f0-9]{14})$/)) && m === 'POST') {
      const b = await readJson(req, 8e3);
      if (b.action === 'reject') { await db.run("UPDATE candidates SET status='rejected' WHERE id=?", am[1]); return json(res, 200, { ok: true }); }
      if (b.action !== 'approve' || !b.conference) return err(res, 400, 'action approve|reject');
      const c = { ...b.conference, cpdHours: +b.conference.cpdHours, lat: +b.conference.lat || 0, lng: +b.conference.lng || 0, datesConfirmed: b.conference.datesConfirmed === true, dateStatus: b.conference.datesConfirmed === true ? 'confirmed' : 'estimated', lastVerified: new Date().toISOString().slice(0, 10) };
      const why = validateConf(c); if (why) return err(res, 400, why);
      if (await db.get('SELECT 1 FROM conferences WHERE id=?', c.id)) return err(res, 409, 'id exists');
      await db.run("INSERT INTO conferences(id,json,status,source,updated,checked) VALUES(?,?,'published','approved-candidate',?,0)", c.id, JSON.stringify(c), now());
      await db.run("UPDATE candidates SET status='approved' WHERE id=?", am[1]); confCache = null; return json(res, 200, { ok: true });
    }
    if ((am = p.match(/^\/api\/admin\/conferences\/([a-z0-9-]{3,80})$/)) && m === 'POST') {
      const b = await readJson(req, 8e3), row = await db.get('SELECT json FROM conferences WHERE id=?', am[1]); if (!row) return err(res, 404, 'not found');
      if (['published', 'hidden', 'flagged'].includes(b.status)) await db.run('UPDATE conferences SET status=?, updated=? WHERE id=?', b.status, now(), am[1]);
      if (b.patch && typeof b.patch === 'object') { const c = { ...JSON.parse(row.json), ...b.patch, id: am[1] }; const why = validateConf(c); if (why) return err(res, 400, why); await db.run("UPDATE conferences SET json=?, updated=?, source='live-edited' WHERE id=?", JSON.stringify(c), now(), am[1]); }
      confCache = null; return json(res, 200, { ok: true });
    }
    if (p === '/api/admin/changes' && m === 'GET') return json(res, 200, (await db.all(`SELECT d.id, d.conf_id "confId", d.patch, d.created, c.json cj FROM date_changes d JOIN conferences c ON c.id=d.conf_id WHERE d.status='pending' ORDER BY d.created DESC LIMIT 200`)).map(r => { const cur = JSON.parse(r.cj); return { id: r.id, confId: r.confId, name: cur.name, current: { start: cur.start, end: cur.end, city: cur.city }, proposed: JSON.parse(r.patch), created: r.created }; }));
    if ((am = p.match(/^\/api\/admin\/changes\/(\d{1,12})$/)) && m === 'POST') {
      const b = await readJson(req, 2e3), ch = await db.get("SELECT * FROM date_changes WHERE id=? AND status='pending'", +am[1]); if (!ch) return err(res, 404, 'not found');
      if (b.action === 'reject') { await db.run("UPDATE date_changes SET status='rejected' WHERE id=?", ch.id); return json(res, 200, { ok: true }); }
      if (b.action !== 'approve') return err(res, 400, 'approve|reject');
      const row = await db.get('SELECT json FROM conferences WHERE id=?', ch.conf_id), pt = JSON.parse(ch.patch), c = { ...JSON.parse(row.json), start: pt.start, end: pt.end, datesConfirmed: true, dateStatus: 'confirmed', lastVerified: new Date().toISOString().slice(0, 10), provenance: 'organiser-jsonld', sourceUrl: pt.evidenceUrl || JSON.parse(row.json).sourceUrl };
      if (pt.city && b.useCity) c.city = pt.city;
      const why = validateConf(c); if (why) return err(res, 400, why);
      await db.run("UPDATE conferences SET json=?, updated=?, source='live-edited' WHERE id=?", JSON.stringify(c), now(), ch.conf_id); await db.run("UPDATE date_changes SET status='approved' WHERE id=?", ch.id); confCache = null; return json(res, 200, { ok: true });
    }
    if (p === '/api/admin/reported' && m === 'GET') { const idx = await seriesIdx(); return json(res, 200, (await db.all('SELECT r.id, r.series_key "seriesKey", r.edition_year "editionYear", r.city, r.rating, r.text, r.author, (SELECT COUNT(*) FROM review_reports x WHERE x.weight=1 AND x.review_id=r.id) reports FROM reviews r WHERE (SELECT COUNT(*) FROM review_reports x WHERE x.weight=1 AND x.review_id=r.id) >= 1 ORDER BY reports DESC LIMIT 100')).map(r => ({ ...r, title: seriesName(idx, r.seriesKey) }))); }
    /* proof-of-attendance queue: the only place a proof file can be read */
    if (p === '/api/admin/proofs' && m === 'GET') { const idx = await seriesIdx(); return json(res, 200, (await db.all(`SELECT p.id, p.kind, p.name, p.type, p.size, p.created, r.id "reviewId", r.series_key "seriesKey", r.edition_year "editionYear", r.city, r.author, r.text, r.rating, u.email FROM review_proofs p JOIN reviews r ON r.id=p.review_id JOIN users u ON u.id=p.user_id WHERE p.status='pending' AND r.verify='pending_proof' ORDER BY p.created LIMIT 200`)).map(r => ({ ...r, kindLabel: RV.PROOF_KINDS[r.kind] || r.kind, title: seriesName(idx, r.seriesKey) }))); }
    if ((am = p.match(/^\/api\/admin\/proofs\/([a-f0-9]{32})\/file$/)) && m === 'GET') {
      const f = await db.get('SELECT name, type, data FROM review_proofs WHERE id=?', am[1]); if (!f) return err(res, 404, 'not found'); if (!f.data) return err(res, 410, 'file deleted after the decision');
      res.writeHead(200, { 'Content-Type': f.type, 'Content-Disposition': 'attachment; filename="' + String(f.name || 'proof').replace(/[^\w.\- ]/g, '_') + '"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
      return res.end(Buffer.from(f.data));
    }
    if ((am = p.match(/^\/api\/admin\/proofs\/([a-f0-9]{32})$/)) && m === 'POST') {
      const b = await readJson(req, 2e3), pf = await db.get("SELECT id, review_id FROM review_proofs WHERE id=? AND status='pending'", am[1]); if (!pf) return err(res, 404, 'not found');
      if (b.action !== 'approve' && b.action !== 'reject') return err(res, 400, 'approve|reject');
      await db.tx(async t => { /* the file is deleted either way; only the decision is kept */
        await t.run('UPDATE review_proofs SET status=?, note=?, decided=?, decided_by=?, data=NULL WHERE id=?', b.action === 'approve' ? 'approved' : 'rejected', clean(b.note, 200) || null, now(), u.email, pf.id);
        if (b.action === 'approve') await t.run("UPDATE reviews SET verify='verified', verified_by='admin' WHERE id=?", pf.review_id);
        else await t.run("UPDATE reviews SET verify=CASE WHEN EXISTS (SELECT 1 FROM receipt_checks k WHERE k.user_id=reviews.user_id AND k.series_key=reviews.series_key AND k.edition_year=reviews.edition_year AND k.status='pending') THEN 'pending_receipt' ELSE 'none' END WHERE id=? AND verify='pending_proof'", pf.review_id);
      });
      ratingsCache = null; return json(res, 200, { ok: true });
    }
    /* emailed registration receipts that matched an edition (decision B): admin approves or rejects; the file is admin-only */
    if (p === '/api/admin/receipts' && m === 'GET') {
      const idx = await seriesIdx();
      const rows = await db.all(`SELECT k.id, k.series_key "seriesKey", k.edition_year "editionYear", k.conf_id "confId", k.vendor, k.amount, k.currency, k.receipt_date "receiptDate", k.subject, k.file_name "fileName", k.file_type "fileType", k.size, k.created, u.email, u.name,
          r.id "reviewId", r.author, r.text, r.rating, r.city, r.verify FROM receipt_checks k JOIN users u ON u.id=k.user_id LEFT JOIN reviews r ON r.user_id=k.user_id AND r.series_key=k.series_key AND r.edition_year=k.edition_year WHERE k.status='pending' ORDER BY k.created LIMIT 200`);
      return json(res, 200, rows.map(({ reviewId, author, text, rating, city, verify, ...k }) => ({ ...k, title: seriesName(idx, k.seriesKey), hasFile: k.size > 0, review: reviewId ? { id: reviewId, author, text, rating, city: city || '', verify } : null })));
    }
    if ((am = p.match(/^\/api\/admin\/receipts\/([a-f0-9]{32})\/file$/)) && m === 'GET') {
      const f = await db.get('SELECT file_name name, file_type type, data FROM receipt_checks WHERE id=?', am[1]); if (!f) return err(res, 404, 'not found'); if (!f.data) return err(res, 410, 'file deleted after the decision');
      res.writeHead(200, { 'Content-Type': f.type || 'application/octet-stream', 'Content-Disposition': 'attachment; filename="' + String(f.name || 'receipt').replace(/[^\w.\- ]/g, '_') + '"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
      return res.end(Buffer.from(f.data));
    }
    if ((am = p.match(/^\/api\/admin\/receipts\/([a-f0-9]{32})$/)) && m === 'POST') {
      const b = await readJson(req, 2e3), k = await db.get("SELECT id, user_id, series_key, edition_year FROM receipt_checks WHERE id=? AND status='pending'", am[1]); if (!k) return err(res, 404, 'not found');
      if (b.action !== 'approve' && b.action !== 'reject') return err(res, 400, 'approve|reject');
      await db.tx(async t => { /* the admin copy of the file is deleted either way (the user keeps theirs); the decision is kept */
        await t.run('UPDATE receipt_checks SET status=?, note=?, decided=?, decided_by=?, data=NULL WHERE id=?', b.action === 'approve' ? 'approved' : 'rejected', clean(b.note, 200) || null, now(), u.email, k.id);
        if (b.action === 'approve') await t.run("UPDATE reviews SET verify='verified', verified_by='receipt' WHERE user_id=? AND series_key=? AND edition_year=? AND verify!='verified'", k.user_id, k.series_key, k.edition_year);
        else await t.run("UPDATE reviews SET verify='none' WHERE user_id=? AND series_key=? AND edition_year=? AND verify='pending_receipt'", k.user_id, k.series_key, k.edition_year);
      });
      ratingsCache = null; return json(res, 200, { ok: true });
    }
    /* "Covered in" links: pending suggestions, approve/reject, and admin-added links (published straight away) */
    if (p === '/api/admin/coverage' && m === 'GET') {
      const idx = await seriesIdx();
      return json(res, 200, (await db.all(`SELECT c.id, c.series_key "seriesKey", c.type, c.title, c.publication, c.year, c.url, c.added_on "addedOn", u.email "addedBy" FROM coverage c LEFT JOIN users u ON u.id=c.added_by WHERE c.status='pending' ORDER BY c.added_on LIMIT 200`)).map(r => ({ ...r, typeLabel: COV.TYPES[r.type] || r.type, seriesTitle: seriesName(idx, r.seriesKey) })));
    }
    if (p === '/api/admin/coverage' && m === 'POST') {
      const b = await readJson(req, 4e3), idx = await seriesIdx(), ref = clean(b.series || b.conf, 80), key = idx.by.has(ref) ? ref : idx.ofConf.get(ref);
      if (!key) return err(res, 400, 'unknown conference: use a conference id or series key');
      const v = COV.validate(b); if (!v.ok) return err(res, 400, v.error);
      try { const r = await db.get("INSERT INTO coverage(series_key,type,title,publication,year,url,added_by,added_on,status,decided,decided_by) VALUES(?,?,?,?,?,?,?,?,'approved',?,?) RETURNING id", key, v.value.type, v.value.title || null, v.value.publication, v.value.year, v.value.url, u.id, now(), now(), u.email); return json(res, 201, { ok: true, id: r.id, seriesKey: key, status: 'approved' }); }
      catch (e) { if (DB.isUnique(e)) return err(res, 409, 'that link is already listed for this conference'); throw e; }
    }
    if ((am = p.match(/^\/api\/admin\/coverage\/(\d{1,12})$/)) && m === 'POST') {
      const b = await readJson(req, 1e3); if (b.action !== 'approve' && b.action !== 'reject') return err(res, 400, 'approve|reject');
      const r = await db.run("UPDATE coverage SET status=?, decided=?, decided_by=? WHERE id=? AND status='pending'", b.action === 'approve' ? 'approved' : 'rejected', now(), u.email, +am[1]);
      if (!r.changes) return err(res, 404, 'not found'); return json(res, 200, { ok: true });
    }
    if ((am = p.match(/^\/api\/admin\/reviews\/(\d{1,12})$/)) && m === 'POST') { const b = await readJson(req, 1e3); if (b.action === 'delete') await db.run('DELETE FROM reviews WHERE id=?', +am[1]); else if (b.action === 'restore') await db.run('DELETE FROM review_reports WHERE review_id=?', +am[1]); else return err(res, 400, 'delete|restore'); ratingsCache = null; return json(res, 200, { ok: true }); }
    if (p === '/api/admin/ingest' && m === 'POST') { runIngest(60); return json(res, 202, { started: true }); }
    if (p === '/api/admin/runs' && m === 'GET') return json(res, 200, (await db.all('SELECT id, started, finished, summary FROM ingest_runs ORDER BY id DESC LIMIT 20')).map(r => ({ ...r, summary: JSON.parse(r.summary) })));
    return err(res, 404, 'not found');
  }
  /* hospitals: organisations, roles, approvals, budgets, claims to finance, notifications (lib/hospital-api.js) */
  if (await HOSP.handle(req, res, url, u, ip)) return;
  if (p === '/api/state' && m === 'GET') { const r = await db.get('SELECT json, rev FROM state WHERE user_id=?', u.id); return json(res, 200, r ? { state: JSON.parse(r.json), rev: r.rev } : { state: null, rev: 0 }); }
  if (p === '/api/state' && m === 'PUT') {
    if (await limited('st:' + u.id, 60, 60e3)) return err(res, 429, 'slow down');
    const b = await readJson(req, 1.5e6), cur = await db.get('SELECT rev FROM state WHERE user_id=?', u.id), rev = cur ? cur.rev : 0;
    if (typeof b.state !== 'object' || !b.state) return err(res, 400, 'state required');
    if (Number(b.baseRev) !== rev) return json(res, 409, { error: 'conflict', rev });
    /* compare-and-set on rev, so two instances cannot both accept a write from the same base */
    const r = await db.run('INSERT INTO state(user_id,json,rev,updated) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET json=excluded.json, rev=excluded.rev, updated=excluded.updated WHERE state.rev=?', u.id, JSON.stringify(b.state), rev + 1, now(), rev);
    if (!r.changes) { const c2 = await db.get('SELECT rev FROM state WHERE user_id=?', u.id); return json(res, 409, { error: 'conflict', rev: c2 ? c2.rev : 0 }); }
    return json(res, 200, { rev: rev + 1 });
  }
  /* a signed-in user suggests a "Covered in" link: always pending until an admin approves it */
  if (p === '/api/coverage' && m === 'POST') {
    const b = await readJson(req, 4e3), idx = await seriesIdx(), key = clean(b.series, 80);
    if (!validKey(key) || !idx.by.has(key)) return err(res, 400, 'unknown conference');
    const v = COV.validate(b); if (!v.ok) return err(res, 400, v.error);
    if (await limited('cov:' + u.id, 20, 3600e3)) return err(res, 429, 'too many suggestions, try later');
    try { const r = await db.get("INSERT INTO coverage(series_key,type,title,publication,year,url,added_by,added_on,status) VALUES(?,?,?,?,?,?,?,?,'pending') RETURNING id", key, v.value.type, v.value.title || null, v.value.publication, v.value.year, v.value.url, u.id, now()); return json(res, 201, { ok: true, id: r.id, status: 'pending' }); }
    catch (e) { if (DB.isUnique(e)) return err(res, 409, 'That link has already been suggested for this conference.'); throw e; }
  }
  if (p === '/api/my-reviews' && m === 'GET') return json(res, 200, await db.all('SELECT id, series_key "seriesKey", edition_year "editionYear", verify FROM reviews WHERE user_id=?', u.id));
  /* Post one review per year attended (several past years in one go). Ratings and comment are the user's; verification never
     comes from the request: only an admin-approved registration receipt the server received by email, or an admin-approved proof. */
  if (p === '/api/reviews' && m === 'POST') {
    const b = await readJson(req, 8e3), key = clean(b.series, 80), eds = validKey(key) ? (await seriesIdx()).by.get(key) : null;
    if (!eds) return err(res, 400, 'unknown conference');
    const R = RV.parseRatings(b.ratings), text = clean(b.text, REVIEW_MAX);
    if (!R) return err(res, 400, 'rate all five areas from 1 to 5');
    if (text.length < 10) return err(res, 400, 'write at least 10 characters');
    const asked = Array.isArray(b.editions) ? b.editions.slice(0, 12) : [], Y = new Date().getUTCFullYear(), todayIso = new Date().toISOString().slice(0, 10), list = [], seen = new Set();
    for (const e of asked) {
      const year = Number(e && e.year); if (!Number.isInteger(year) || year < Y - 10 || year > Y) return err(res, 400, `pick years from ${Y - 10} to ${Y}`);
      if (seen.has(year)) continue; seen.add(year);
      const known = eds.filter(x => x.year === year).sort((x, y) => x.start.localeCompare(y.start))[0];
      if (known && known.start > todayIso) return err(res, 400, `the ${year} meeting has not happened yet`);
      list.push({ year, confId: known ? known.id : null, city: known ? known.city : (clean(e.city, 60) || null) });
    }
    if (!list.length) return err(res, 400, 'pick the year you attended');
    const dup = []; for (const e of list) if (await db.get('SELECT 1 FROM reviews WHERE user_id=? AND series_key=? AND edition_year=?', u.id, key, e.year)) dup.push(e.year);
    if (dup.length) return json(res, 409, { error: `you have already reviewed ${dup.join(', ')}: edit that review instead`, years: dup });
    if (await limited('rv:' + u.id, 20, 3600e3)) return err(res, 429, 'too many reviews, try later');
    let out;
    try {
      out = await db.tx(async t => {
        const o = [];
        for (const e of list) {
          /* an emailed receipt for this edition: verified only once an admin approved it; while it waits, pending_receipt */
          const rc = await t.get("SELECT status FROM receipt_checks WHERE user_id=? AND series_key=? AND edition_year=? AND status IN ('pending','approved') ORDER BY (status='approved') DESC LIMIT 1", u.id, key, e.year);
          const verify = !rc ? 'none' : rc.status === 'approved' ? 'verified' : 'pending_receipt';
          const r = await t.get('INSERT INTO reviews(user_id,series_key,edition_year,conf_id,city,rating,content,networking,venue,value,cpd,text,author,created,updated,verify,verified_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id', u.id, key, e.year, e.confId, e.city, RV.overall(R), R.content, R.networking, R.venue, R.value, R.cpd, text, u.name || 'Clinician', now(), now(), verify, verify === 'verified' ? 'receipt' : null);
          o.push({ id: r.id, editionYear: e.year, city: e.city || '', verify });
        }
        return o;
      });
    } catch (e) { if (DB.isUnique(e)) return json(res, 409, { error: 'you have already reviewed that year: edit that review instead', years: list.map(x => x.year) }); throw e; }
    ratingsCache = null;
    return json(res, 201, { reviews: out });
  }
  if ((mm0 = p.match(/^\/api\/reviews\/(\d{1,12})$/)) && (m === 'PUT' || m === 'DELETE')) { /* author only; organisers and other users cannot edit or delete */
    const rv = await db.get('SELECT id, conf_id FROM reviews WHERE id=? AND user_id=?', +mm0[1], u.id); if (!rv) return err(res, 404, 'not found');
    if (m === 'DELETE') { await db.run('DELETE FROM reviews WHERE id=?', rv.id); ratingsCache = null; return json(res, 200, { ok: true }); }
    const b = await readJson(req, 8e3), R = RV.parseRatings(b.ratings), text = clean(b.text, REVIEW_MAX);
    if (!R) return err(res, 400, 'rate all five areas from 1 to 5');
    if (text.length < 10) return err(res, 400, 'write at least 10 characters');
    const setCity = !rv.conf_id; /* a known edition's city comes from the conference row */
    await db.run(`UPDATE reviews SET rating=?, content=?, networking=?, venue=?, value=?, cpd=?, text=?, updated=?${setCity ? ', city=?' : ''} WHERE id=?`, RV.overall(R), R.content, R.networking, R.venue, R.value, R.cpd, text, now(), ...(setCity ? [clean(b.city, 60) || null] : []), rv.id);
    ratingsCache = null; return json(res, 200, { ok: true });
  }
  /* proof of attendance: kept private, read only through the admin endpoints, deleted once an admin decides */
  if ((mm0 = p.match(/^\/api\/reviews\/(\d{1,12})\/proof$/)) && m === 'POST') {
    const rv = await db.get('SELECT id, verify FROM reviews WHERE id=? AND user_id=?', +mm0[1], u.id); if (!rv) return err(res, 404, 'not found');
    if (rv.verify === 'verified') return err(res, 409, 'this review is already verified');
    const kind = String(url.searchParams.get('kind') || ''); if (!RV.PROOF_KINDS[kind]) return err(res, 400, 'kind: certificate, cpd or receipt');
    if (await limited('pf:' + u.id, 10, 3600e3)) return err(res, 429, 'slow down');
    const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase(), data = await readBody(req, PROOF_MAX);
    if (!data.length || !PROOF_TYPES.has(type) || !magicOk(type, data)) return err(res, 415, 'PDF, JPG or PNG only');
    const id = rid(16);
    await db.tx(async t => {
      await t.run("DELETE FROM review_proofs WHERE review_id=? AND status='pending'", rv.id);
      await t.run('INSERT INTO review_proofs(id,review_id,user_id,kind,name,type,size,data,status,created) VALUES(?,?,?,?,?,?,?,?,?,?)', id, rv.id, u.id, kind, clean(url.searchParams.get('name') || 'proof', 100), type, data.length, data, 'pending', now());
      await t.run("UPDATE reviews SET verify='pending_proof' WHERE id=?", rv.id);
    });
    return json(res, 201, { ok: true, verify: 'pending_proof' });
  }
  if ((mm0 = p.match(/^\/api\/reviews\/(\d{1,12})\/report$/)) && m === 'POST') {
    const rv = await db.get('SELECT user_id FROM reviews WHERE id=?', +mm0[1]); if (!rv) return err(res, 404, 'not found'); if (rv.user_id === u.id) return err(res, 400, 'cannot report your own review');
    if (await limited('rp:' + u.id, 30, 3600e3)) return err(res, 429, 'slow down');
    const age = now() - (await db.get('SELECT created FROM users WHERE id=?', u.id)).created;
    await db.run('INSERT INTO review_reports(review_id,user_id,created,weight) VALUES(?,?,?,?) ON CONFLICT DO NOTHING', +mm0[1], u.id, now(), age >= REPORT_MIN_AGE ? 1 : 0); ratingsCache = null; return json(res, 200, { ok: true });
  }
  if (p === '/api/inbox' && m === 'GET') return json(res, 200, await db.all('SELECT id,vendor,amount,currency,date,category,subject,sender,file_id "fileId",file_name "fileName",file_type "fileType",created FROM inbox WHERE user_id=? ORDER BY created', u.id));
  let mm;
  if ((mm = p.match(/^\/api\/inbox\/([a-f0-9]{8,40})\/claim$/)) && m === 'POST') { /* move an emailed file into the user's receipt store on the server, then drop the inbox row; never delete unless the file landed */
    const b = await readJson(req, 500), key = String(b.key || ''); if (!/^[\w-]{3,60}$/.test(key)) return err(res, 400, 'bad key');
    const it = await db.get('SELECT file_id FROM inbox WHERE id=? AND user_id=?', mm[1], u.id); if (!it) return err(res, 404, 'not found');
    let out;
    try {
      out = await db.tx(async t => {
        if (it.file_id) {
          const f = await t.get('SELECT name,type,data FROM files WHERE id=? AND user_id=?', it.file_id, u.id); if (!f) return 'missing';
          await t.run('INSERT INTO files(id,user_id,name,type,data) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,type=excluded.type,data=excluded.data', 'u' + u.id + ':' + key, u.id, f.name, f.type, f.data);
          await t.run('DELETE FROM files WHERE id=? AND user_id=?', it.file_id, u.id);
        }
        await t.run('DELETE FROM inbox WHERE id=? AND user_id=?', mm[1], u.id);
        return 'ok';
      });
    } catch (e) { console.error('claim failed', e.message); return err(res, 500, 'could not store file'); }
    if (out === 'missing') return err(res, 409, 'file missing');
    return json(res, 200, { ok: true });
  }
  if ((mm = p.match(/^\/api\/inbox\/([a-f0-9]{8,40})$/)) && m === 'DELETE') { await db.run('DELETE FROM files WHERE user_id=? AND id=(SELECT file_id FROM inbox WHERE id=? AND user_id=?)', u.id, mm[1], u.id); await db.run('DELETE FROM inbox WHERE id=? AND user_id=?', mm[1], u.id); return json(res, 200, { ok: true }); }
  /* receipt files: a server copy per signed-in user so receipts survive a cleared browser and open on any device */
  if (p === '/api/rfiles' && m === 'GET') { const pre = 'u' + u.id + ':'; return json(res, 200, (await db.all('SELECT id FROM files WHERE user_id=? ORDER BY id', u.id)).map(x => x.id).filter(id => id.startsWith(pre)).map(id => id.slice(pre.length))); }
  if ((mm = p.match(/^\/api\/rfile\/([\w-]{3,60})$/))) {
    const fid = 'u' + u.id + ':' + mm[1];
    if (m === 'GET') {
      const f = await db.get('SELECT name,type,data FROM files WHERE id=? AND user_id=?', fid, u.id);
      if (!f) return err(res, 404, 'not found');
      res.writeHead(200, { 'Content-Type': f.type, 'Content-Disposition': 'attachment; filename="' + String(f.name || 'receipt').replace(/[^\w.\- ]/g, '_') + '"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
      return res.end(Buffer.from(f.data));
    }
    if (m === 'PUT') {
      if (await limited('rf:' + u.id, 60, 60e3)) return err(res, 429, 'slow down');
      const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase(), data = await readBody(req, 16e6);
      const isText = type === 'text/plain' && data.length <= 100e3;
      if (!data.length || !(isText || (ALLOWED_FILES.has(type) && magicOk(type, data)))) return err(res, 415, 'unsupported file');
      const used = (await db.get('SELECT COALESCE(SUM(length(data)),0) n FROM files WHERE user_id=? AND id!=?', u.id, fid)).n;
      if (used + data.length > 100e6) return err(res, 413, 'storage full');
      await db.run('INSERT INTO files(id,user_id,name,type,data) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,type=excluded.type,data=excluded.data', fid, u.id, clean(url.searchParams.get('name') || 'receipt', 100), type, data);
      return json(res, 200, { ok: true });
    }
    if (m === 'DELETE') { await db.run('DELETE FROM files WHERE id=? AND user_id=?', fid, u.id); return json(res, 200, { ok: true }); }
  }
  if ((mm = p.match(/^\/api\/files\/([a-f0-9]{8,40})$/)) && m === 'GET') {
    const f = await db.get('SELECT name,type,data FROM files WHERE id=? AND user_id=?', mm[1], u.id);
    if (!f) return err(res, 404, 'not found');
    res.writeHead(200, { 'Content-Type': f.type, 'Content-Disposition': `attachment; filename="${String(f.name || 'receipt').replace(/[^\w.\- ]/g, '_')}"`, 'Cache-Control': 'private, no-store' });
    return res.end(Buffer.from(f.data));
  }
  if (p === '/api/account' && m === 'DELETE') {
    const b = await readJson(req, 2e3), row = await db.get('SELECT pass FROM users WHERE id=?', u.id);
    if (!(await checkPw(String(b.password || ''), row.pass))) return err(res, 403, MSG.pwBad);
    await HOSP.beforeAccountDelete(u.id); /* the hospital keeps an admin, or is removed with its last member */
    await db.run('DELETE FROM users WHERE id=?', u.id); ratingsCache = null;
    res.setHeader('Set-Cookie', 'hoggy_sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); return json(res, 200, { ok: true });
  }
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
  const u = await db.get('SELECT id FROM users WHERE inbox=?', m[1].toLowerCase());
  if (!u) return json(res, 202, { ok: false, reason: 'no matching inbox' });
  if ((await db.get('SELECT COUNT(*) n FROM inbox WHERE user_id=?', u.id)).n >= 50) return json(res, 202, { ok: false, reason: 'inbox full' });
  const forParse = `Subject: ${subject}\n${text.slice(0, 20000)}`;
  let parsed = parseReceipt(forParse.includes('From:') ? forParse : `From: ${sender}\n${forParse}`, 'AUD');
  const atts = Array.isArray(b.Attachments || b.attachments) ? (b.Attachments || b.attachments).slice(0, 5) : [];
  let fileId = null, fileName = null, fileType = null, fileData = null, pdfT = '';
  for (const a of atts) {
    const type = String(a.ContentType || a.type || '').toLowerCase(), data = Buffer.from(String(a.Content || a.content || ''), 'base64');
    if (!ALLOWED_FILES.has(type) || !data.length || data.length > 8e6 || !magicOk(type, data)) continue;
    fileId = rid(16); fileName = clean(a.Name || a.name || 'receipt', 100); fileType = type;
    if (type === 'application/pdf') pdfT = (await pdfText(data)) || '';
    if (type === 'application/pdf' && (parsed.amount == null || !parsed.date)) { /* fill gaps from the PDF's text layer; the email body wins where it already parsed */
      const pt = pdfT;
      if (pt) { const pp = parseReceipt(`From: ${sender}
Subject: ${subject}
${pt}`, 'AUD'); parsed = { ...pp, ...Object.fromEntries(Object.entries(parsed).filter(([k, v]) => v != null && v !== '' && !(k === 'category' && v === 'Other'))) }; }
    }
    await db.run('INSERT INTO files(id,user_id,name,type,data) VALUES(?,?,?,?,?)', fileId, u.id, fileName, type, data); fileData = data; break;
  }
  if (!fileId && text) { fileId = rid(16); fileName = 'forwarded-email.txt'; fileType = 'text/plain'; fileData = Buffer.from(text.slice(0, 50000)); await db.run('INSERT INTO files(id,user_id,name,type,data) VALUES(?,?,?,?,?)', fileId, u.id, fileName, 'text/plain', fileData); }
  const id = rid(12);
  try { await matchAttendance(u.id, id, { ...parsed, subject }, `${subject}\n${text.slice(0, 20000)}\n${pdfT.slice(0, 20000)}`, fileData ? { name: fileName, type: fileType, data: fileData } : null); } catch (e) { console.error('attendance match failed', e.message); }
  await db.run('INSERT INTO inbox(id,user_id,vendor,amount,currency,date,category,subject,sender,file_id,file_name,file_type,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', id, u.id, clean(parsed.vendor || subject, 80), parsed.amount ?? null, clean(parsed.currency || 'AUD', 3), parsed.date || null, parsed.category || 'Other', subject, sender, fileId, fileName, fileType, now());
  return json(res, 200, { ok: true, id });
}

/* A registration receipt this server received by email at the user's private address, that names the conference and is
   dated from 400 days before it to 7 days after. Since the owner's decision B it does NOT verify on its own: each match
   becomes a pending item on the admin desk (with a private copy of the receipt file, deleted once an admin decides) and the
   review shows "Attended (not verified)" until an admin approves. Client-synced trips are never consulted. */
async function matchAttendance(userId, inboxId, parsed, text, file) {
  if (parsed.category !== 'Registration' || !parsed.date) return 0;
  let n = 0;
  for (const c of (await getConfs()).list) {
    if (c.start > new Date().toISOString().slice(0, 10) || !RV.inWindow(parsed.date, c) || !RV.mentions(text, c)) continue;
    const key = seriesKey(c), year = +c.start.slice(0, 4);
    /* one open item per edition: a second receipt for the same year adds nothing while one waits or was approved */
    if (await db.get("SELECT 1 FROM receipt_checks WHERE user_id=? AND series_key=? AND edition_year=? AND status IN ('pending','approved')", userId, key, year)) continue;
    await db.run('INSERT INTO receipt_checks(id,user_id,series_key,edition_year,conf_id,inbox_id,vendor,amount,currency,receipt_date,subject,file_name,file_type,size,data,status,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      rid(16), userId, key, year, c.id, inboxId, clean(parsed.vendor, 80) || null, parsed.amount ?? null, clean(parsed.currency || 'AUD', 3), parsed.date, clean(parsed.subject, 200) || null, file ? file.name : null, file ? file.type : null, file ? file.data.length : 0, file ? file.data : null, 'pending', now());
    await db.run("UPDATE reviews SET verify='pending_receipt' WHERE user_id=? AND series_key=? AND edition_year=? AND verify='none'", userId, key, year);
    n++;
  }
  return n;
}

/* ---------- backups (SQLite only; Supabase backs up Postgres) ---------- */
async function backup() {
  try {
    const dir = path.join(DATA, 'backups'); fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, `hoggy-${new Date().toISOString().slice(0, 10)}.db`);
    if (!fs.existsSync(f)) { await db.exec(`VACUUM INTO '${f.replace(/'/g, "''")}'`); console.log('backup written', path.basename(f)); }
    fs.readdirSync(dir).filter(x => /^hoggy-\d{4}-\d{2}-\d{2}\.db$/.test(x)).sort().slice(0, -7).forEach(x => fs.unlinkSync(path.join(dir, x)));
  } catch (e) { console.error('backup failed', e.message); }
}
/* ---------- static ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const PUBLIC = new Set(['index.html', 'app.js', 'parse.js', 'pack.js', 'stats.js', 'courses.js', 'data/courses/catalogue.json', 'data/courses/sessions.json', 'styles.css', 'lib/series.js', 'lib/coverage.js', 'lib/specialties.js', 'data/conferences.js', 'data/holidays.js', 'data/cpd-nz.js', 'admin.html', 'admin.js']);
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
    const dynamic = url.pathname === '/healthz' || url.pathname.startsWith('/api/');
    if (dynamic) {
      try { await whenReady(); } catch (e) { console.error('startup failed', e.message); return err(res, 503, 'database unavailable, try again shortly'); }
      if (now() - lastHk > 600e3) housekeep();
    }
    if (url.pathname === '/healthz') { const n = (await db.get("SELECT COUNT(*) n FROM conferences WHERE status='published'")).n; return json(res, 200, { ok: true, db: db.kind, conferences: n }); }
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    serveStatic(req, res, url);
  } catch (e) {
    if (e && e.code === 413) return err(res, 413, 'payload too large');
    if (e && e.code === 400) return err(res, 400, e.message);
    console.error(e); if (!res.headersSent) err(res, 500, 'server error'); else res.end();
  }
}
/* Startup begins at module load, i.e. once per process or serverless cold start.
   `node server.js` listens; require('./server.js') only exports the handler (api/index.js uses it on Vercel). */
whenReady().catch(e => console.error('startup failed (will retry on the next request):', e.message));
const server = http.createServer(handler);
if (require.main === module) server.listen(PORT, HOST, () => {
  console.log(`Hoggy running at http://${HOST}:${PORT} (${PG ? `postgres, schema ${db.schema}` : 'sqlite ' + path.join(DATA, 'hoggy.db')})`);
  console.log(`Inbound email webhook: POST /api/inbound/email with header X-Hoggy-Secret (${process.env.HOGGY_INBOUND_SECRET ? 'HOGGY_INBOUND_SECRET' : PG ? 'meta.inbound_secret in the database' : 'see ' + secretFile}); mail domain ${MAIL_DOMAIN}`);
});
module.exports = { handler, server, ready: whenReady, db };
