'use strict';
/* Validate data/shards/holidays.json and write data/holidays.js (window.HOGGY_HOLIDAYS). Usage: node tools/build-holidays.js */
const fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..'), src = path.join(root, 'data', 'shards', 'holidays.json');
const j = JSON.parse(fs.readFileSync(src, 'utf8')), ISO = /^\d{4}-\d{2}-\d{2}$/, out = [];
for (const r of j.regions || []) {
  if (r.unverified) { console.error('held back (unverified):', r.code); continue; }
  if (!/^[A-Z]{2,3}$/.test(r.code) || !/^https:\/\//.test(r.sourceUrl || '')) { console.error('skip region', r.code); continue; }
  const h = (r.holidays || []).filter(x => ISO.test(x.start) && ISO.test(x.end) && x.end >= x.start && x.end >= '2026-11-01').map(x => ({ label: String(x.label || 'School holidays').slice(0, 40), start: x.start, end: x.end })).sort((a, b) => a.start.localeCompare(b.start));
  if (h.length) out.push({ code: r.code, name: String(r.name || r.code).slice(0, 40), country: r.country, sourceUrl: r.sourceUrl, notes: String(r.notes || '').slice(0, 300), holidays: h });
}
fs.writeFileSync(path.join(root, 'data', 'holidays.js'), 'window.HOGGY_HOLIDAYS = ' + JSON.stringify({ checked: j.checked, regions: out }) + ';\n');
console.log('regions', out.map(r => r.code + ':' + r.holidays.length).join(' '));
