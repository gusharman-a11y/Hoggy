'use strict';
/* npm run test:pg — the whole suite against a real, LOCAL Postgres (each server gets its own throwaway schema).
   Database: HOGGY_TEST_DATABASE_URL, default postgres://postgres:postgres@127.0.0.1:5432/hoggy_test (create it first:
   `createdb hoggy_test`). Refuses a remote host unless HOGGY_TEST_ALLOW_REMOTE=1. Never point this at Supabase. */
const { spawnSync } = require('node:child_process'), fs = require('node:fs'), path = require('node:path');
const url = process.env.HOGGY_TEST_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/hoggy_test';
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort().map(f => path.join('tests', f));
const r = spawnSync(process.execPath, ['--test', ...files], { cwd: path.join(__dirname, '..'), env: { ...process.env, HOGGY_TEST_DATABASE_URL: url }, stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
