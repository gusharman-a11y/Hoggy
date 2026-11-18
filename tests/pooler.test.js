const test = require('node:test'), assert = require('node:assert');
const { supabasePoolerUrls } = require('../lib/db.js');
test('Supabase direct address maps to the Sydney transaction poolers, same password', () => {
  const u = supabasePoolerUrls('postgresql://postgres:p%40ss@db.ipnkzavrbfzuphicycuc.supabase.co:5432/postgres', {});
  assert.deepStrictEqual(u, [
    'postgresql://postgres.ipnkzavrbfzuphicycuc:p%40ss@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
    'postgresql://postgres.ipnkzavrbfzuphicycuc:p%40ss@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres']);
});
test('pooler, local and other URLs are left alone', () => {
  assert.strictEqual(supabasePoolerUrls('postgresql://postgres.abc:x@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres', {}), null);
  assert.strictEqual(supabasePoolerUrls('postgresql://x@localhost/y', {}), null);
});
test('HOGGY_PG_POOLER_HOST forces one host', () => {
  assert.deepStrictEqual(supabasePoolerUrls('postgresql://postgres:p@db.ipnkzavrbfzuphicycuc.supabase.co:5432/postgres', { HOGGY_PG_POOLER_HOST: 'aws-0-x.pooler.supabase.com' }),
    ['postgresql://postgres.ipnkzavrbfzuphicycuc:p@aws-0-x.pooler.supabase.com:6543/postgres']);
});
