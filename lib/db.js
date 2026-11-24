'use strict';
/* Small async database adapter with two backends and one set of calls:
     db.get(sql, ...params) -> first row or undefined     db.all(sql, ...params) -> rows
     db.run(sql, ...params) -> { changes }                db.exec(sql)  (several statements, no params)
     db.tx(async t => { ... })  t has get/all/run/exec; COMMIT on return, ROLLBACK on throw
   SQL is written once, in the dialect both engines accept (ON CONFLICT, RETURNING id, "quotedAlias", no json_extract/LIKE).
   - sqlite: node:sqlite DatabaseSync (local dev and the default test run). Statements are synchronous; a transaction holds a
     lock so statements from other requests cannot slip into it while it awaits.
   - pg: node-postgres Pool on DATABASE_URL (production: Supabase transaction pooler, port 6543). Only unnamed statements are
     used (no prepared-statement names), so PgBouncer/Supavisor transaction mode is fine. `?` placeholders become $1..$n and
     table names are qualified with the schema (default `hoggy`), so nothing depends on search_path, which a transaction
     pooler does not keep between statements. BIGINT and NUMERIC come back as JS numbers (timestamps are ms, < 2^53). */

const TABLES = ['users', 'sessions', 'state', 'inbox', 'conferences', 'candidates', 'ingest_runs', 'files', 'date_changes', 'review_reports', 'reviews', 'review_proofs', 'attend_receipts', 'meta', 'rate_hits', 'proofs', 'reviews_v1', 'receipt_checks', 'coverage', 'orgs', 'memberships', 'allowances', 'approvals', 'claims', 'notifications'];

/* ? -> $n, skipping quoted strings and identifiers */
function placeholders(sql) {
  let out = '', n = 0, quote = null;
  for (const ch of sql) {
    if (quote) { if (ch === quote) quote = null; out += ch; continue; }
    if (ch === "'" || ch === '"') { quote = ch; out += ch; continue; }
    out += ch === '?' ? '$' + (++n) : ch;
  }
  return out;
}
const TABLE_RE = new RegExp(`\\b(FROM|JOIN|INTO|UPDATE)(\\s+)(${TABLES.join('|')})\\b(?!\\.)`, 'gi');
function toPg(sql, schema) { return placeholders(sql).replace(TABLE_RE, (m, kw, sp, t) => `${kw}${sp}${schema}.${t.toLowerCase()}`); }

function sqliteBackend(file) {
  const { DatabaseSync } = require('node:sqlite');
  const d = new DatabaseSync(file), cache = new Map();
  const stmt = s => cache.get(s) || cache.set(s, d.prepare(s)).get(s);
  const raw = {
    get: (s, ...p) => stmt(s).get(...p),
    all: (s, ...p) => stmt(s).all(...p),
    run: (s, ...p) => { const r = stmt(s).run(...p); return { changes: Number(r.changes) }; },
    exec: s => { d.exec(s); },
  };
  let lock = null;
  const wait = async () => { while (lock) await lock; };
  const wrap = f => async (...a) => { await wait(); return f(...a); };
  return {
    kind: 'sqlite', raw: d,
    get: wrap(raw.get), all: wrap(raw.all), run: wrap(raw.run), exec: wrap(raw.exec),
    async tx(fn) {
      await wait();
      let release; lock = new Promise(r => { release = r; });
      try {
        d.exec('BEGIN');
        try { const out = await fn(raw); d.exec('COMMIT'); return out; } catch (e) { try { d.exec('ROLLBACK'); } catch (x) { } throw e; }
      } finally { lock = null; release(); }
    },
    async close() { d.close(); },
  };
}

/* Candidate transaction-pooler URLs for a Supabase direct address, or null when the URL is not one. Region from
   HOGGY_PG_REGION (default ap-southeast-2, where Hoggy's project lives); HOGGY_PG_POOLER_HOST forces one host. */
function supabasePoolerUrls(url, env = process.env) {
  let u; try { u = new URL(url); } catch (e) { return null; }
  const m = u.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/); if (!m) return null;
  const region = env.HOGGY_PG_REGION || 'ap-southeast-2';
  const hosts = env.HOGGY_PG_POOLER_HOST ? [env.HOGGY_PG_POOLER_HOST] : ['aws-1-' + region + '.pooler.supabase.com', 'aws-0-' + region + '.pooler.supabase.com'];
  return hosts.map(h => { const v = new URL(url); v.hostname = h; v.port = '6543'; v.username = 'postgres.' + m[1]; return v.toString(); });
}

function pgBackend(url, o = {}) {
  const pg = require('pg');
  const schema = o.schema || 'hoggy';
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(schema)) throw new Error('bad schema name: ' + schema);
  const num = v => v === null ? null : Number(v);
  const types = { getTypeParser: (oid, fmt) => (oid === 20 || oid === 1700) ? num : pg.types.getTypeParser(oid, fmt) };
  let host = ''; try { host = new URL(url).hostname; } catch (e) { }
  const local = ['localhost', '127.0.0.1', '::1', ''].includes(host) || host.startsWith('/');
  /* TLS for anything that is not this machine. Supabase signs with its own CA: set HOGGY_PG_CA to its PEM to verify the
     certificate; without it the link is still encrypted but the certificate is not checked. An sslmode in the URL wins. */
  const ssl = /[?&]sslmode=/.test(url) ? undefined : local ? false : (o.ca ? { ca: o.ca, rejectUnauthorized: true } : { rejectUnauthorized: false });
  const mk = u => { const p = new pg.Pool({ connectionString: u, ...(ssl === undefined ? {} : { ssl }), types, max: o.max || 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 15000, allowExitOnIdle: true, application_name: 'hoggy' }); p.on('error', e => console.error('postgres pool error', e.message)); return p; };
  /* A Supabase *direct* address (db.<ref>.supabase.co) is IPv6-only and unreachable from Vercel. Try the project's
     transaction pooler instead (same password, user postgres.<ref>, port 6543); the first pooler that accepts wins. */
  const cands = supabasePoolerUrls(url);
  /* Pick the pool once it works; on failure retry on the next request (never fall back to the direct address, which
     Vercel cannot reach). Cold starts sometimes time out on the first connection, so try each host up to twice. */
  let poolP = null;
  const pick = async () => {
    if (!cands) return mk(url);
    let last;
    for (let attempt = 0; attempt < 2; attempt++) {
      for (const u of cands) {
        const p = mk(u);
        try { const c = await p.connect(); c.release(); console.log('postgres: direct Supabase address given; using pooler ' + new URL(u).hostname); return p; }
        catch (e) { last = e; console.warn('postgres: pooler ' + new URL(u).hostname + ' not usable (try ' + (attempt + 1) + '): ' + e.message); await p.end().catch(() => { }); }
      }
    }
    throw last || new Error('no usable postgres pooler');
  };
  const getPool = () => { if (!poolP) poolP = pick().catch(e => { poolP = null; throw e; }); return poolP; };
  const pool = { query: async (...a) => (await getPool()).query(...a), connect: async () => (await getPool()).connect(), end: async () => { if (poolP) (await poolP.catch(() => null))?.end(); } };
  const sqlCache = new Map();
  const conv = s => sqlCache.get(s) || sqlCache.set(s, toPg(s, schema)).get(s);
  const on = c => ({
    get: async (s, ...p) => (await c.query(conv(s), p)).rows[0],
    all: async (s, ...p) => (await c.query(conv(s), p)).rows,
    run: async (s, ...p) => ({ changes: (await c.query(conv(s), p)).rowCount || 0 }),
    exec: async s => { await c.query(s); }, /* simple protocol: several statements, no params, sent as written */
  });
  return {
    kind: 'pg', schema, pool, ...on(pool),
    async tx(fn) {
      const c = await pool.connect(); let bad = null;
      try {
        await c.query('BEGIN');
        try { const out = await fn(on(c)); await c.query('COMMIT'); return out; } catch (e) { try { await c.query('ROLLBACK'); } catch (x) { bad = x; } throw e; }
      } finally { c.release(bad || undefined); }
    },
    async close() { await pool.end(); },
  };
}

function open({ url, file, schema, max, ca } = {}) { return url ? pgBackend(url, { schema, max, ca }) : sqliteBackend(file); }
/* unique-constraint violation, in either engine */
const isUnique = e => !!e && (e.code === '23505' || /UNIQUE constraint failed/.test(String(e.message)));
module.exports = { open, toPg, placeholders, isUnique, TABLES, supabasePoolerUrls };
