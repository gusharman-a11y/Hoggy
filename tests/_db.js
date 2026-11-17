'use strict';
/* Test helpers for the two storage backends. `npm test` runs on SQLite (a fresh HOGGY_DATA folder per server).
   A DATABASE_URL in your shell is ignored: servers started by the tests get DATABASE_URL='' (SQLite).
   `npm run test:pg` sets HOGGY_TEST_DATABASE_URL to a local Postgres: each server then gets DATABASE_URL and its own throwaway schema
   (HOGGY_PG_SCHEMA=t_<random>), dropped when the test ends, so tests never see each other's rows. */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const PG_URL = process.env.HOGGY_TEST_DATABASE_URL || '';
const PG = !!PG_URL;
if (PG) { /* never run the suite against a real project by accident: it creates and drops schemas */
  const host = new URL(PG_URL).hostname;
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host) && process.env.HOGGY_TEST_ALLOW_REMOTE !== '1') throw new Error(`HOGGY_TEST_DATABASE_URL points at ${host}: tests only run against a local Postgres (set HOGGY_TEST_ALLOW_REMOTE=1 to override)`);
}

async function pgQuery(sql, params = []) {
  const { Client } = require('pg');
  const c = new Client({ connectionString: PG_URL });
  await c.connect();
  try { return (await c.query(sql, params)).rows; } finally { await c.end(); }
}
/* env additions for one server (or a group of servers that must share data); registers the cleanup */
function isolate(t, schema) {
  if (!PG) return { DATABASE_URL: '' };
  const s = schema || 't_' + crypto.randomBytes(6).toString('hex');
  t.after(async () => { await new Promise(r => setTimeout(r, 200)); await pgQuery(`DROP SCHEMA IF EXISTS ${s} CASCADE`).catch(() => { }); });
  return { DATABASE_URL: PG_URL, HOGGY_PG_SCHEMA: s };
}
/* the inbound-email secret the server generated: a file next to the SQLite database, or meta.inbound_secret in Postgres */
async function inboundSecret(dir, env) {
  if (!PG) return fs.readFileSync(path.join(dir, 'inbound-secret.txt'), 'utf8').trim();
  return (await pgQuery(`SELECT value FROM ${env.HOGGY_PG_SCHEMA}.meta WHERE key='inbound_secret'`))[0].value;
}
module.exports = { PG, PG_URL, pgQuery, isolate, inboundSecret };
