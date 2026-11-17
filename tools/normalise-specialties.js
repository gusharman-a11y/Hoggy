'use strict';
/* Rewrite every "specialty" value in data/conferences.js and data/shards/*.json to its canonical name
   (tools/specialties.json). Only the specialty string changes; the rest of each file is left byte-for-byte.
   Usage: node tools/normalise-specialties.js [--dry]    Exits 1 if any value has no mapping. */
const fs = require('node:fs'), path = require('node:path');
const { canon } = require('./specialties');
const root = path.join(__dirname, '..'), dry = process.argv.includes('--dry');
const files = [path.join(root, 'data', 'conferences.js')];
const shardDir = path.join(root, 'data', 'shards');
if (fs.existsSync(shardDir)) for (const f of fs.readdirSync(shardDir).sort()) if (f.endsWith('.json')) files.push(path.join(shardDir, f));
const RE = /("specialty"\s*:\s*)"((?:[^"\\]|\\.)*)"/g;
const unknown = new Map(), changed = new Map();
let touched = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  let n = 0;
  const outSrc = src.replace(RE, (all, pre, raw) => {
    const v = JSON.parse('"' + raw + '"'), c = canon(v);
    if (!c) { unknown.set(v, (unknown.get(v) || 0) + 1); return all; }
    if (c === v) return all;
    n++; changed.set(v + ' -> ' + c, (changed.get(v + ' -> ' + c) || 0) + 1);
    return pre + JSON.stringify(c);
  });
  if (n) { touched++; console.log(path.relative(root, file) + ': ' + n + ' row(s)'); if (!dry) fs.writeFileSync(file, outSrc); }
}
for (const [k, v] of [...changed].sort()) console.log('  ' + v + '\t' + k);
console.log((dry ? '[dry] ' : '') + 'files changed: ' + touched + ', values changed: ' + [...changed.values()].reduce((a, b) => a + b, 0));
if (unknown.size) { console.error('no canonical mapping for: ' + [...unknown].map(([k, v]) => `"${k}" (${v})`).join(', ') + ' - add to tools/specialties.json'); process.exit(1); }
