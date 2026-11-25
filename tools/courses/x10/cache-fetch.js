'use strict';
/* Polite page cache for the hand-checked course builds (aunz5-build.js, aunz6-build.js).
   Usage: node tools/courses/x10/cache-fetch.js --cache DIR url [url ...]   (or --list FILE, one URL per line)
   Uses tools/courses/http.js: robots.txt honoured (also on redirect targets), >= 3 s per host, generic User-Agent, https only,
   bot walls / 401 / 403 recorded as blocked and skipped. Appends "<url>\t<file>\t<final url>" to DIR/index.tsv and
   "<url>\t<code>\t<message>" to DIR/blocked.tsv. */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { makeClient, BlockedError } = require('../http');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const dir = arg('--cache'); if (!dir) { console.error('need --cache DIR'); process.exit(2); }
const skip = new Set(['--cache', dir, '--list', arg('--list')].filter(Boolean));
let urls = process.argv.slice(2).filter(a => !skip.has(a));
if (arg('--list')) urls = urls.concat(fs.readFileSync(arg('--list'), 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#')));
fs.mkdirSync(dir, { recursive: true });
const client = makeClient({ log: m => console.error(m) });
(async () => {
  for (const u of urls) {
    try {
      const { body, url } = await client.getPage(u);
      const f = crypto.createHash('sha1').update(u).digest('hex').slice(0, 16) + '.html';
      fs.writeFileSync(path.join(dir, f), body);
      fs.appendFileSync(path.join(dir, 'index.tsv'), `${u}\t${f}\t${url}\n`);
      console.log(`ok ${u} -> ${url} ${body.length}`);
    } catch (e) {
      fs.appendFileSync(path.join(dir, 'blocked.tsv'), `${u}\t${e instanceof BlockedError ? e.code : 'error'}\t${String(e.message).replace(/\s+/g, ' ')}\n`);
      console.log(`FAIL ${u} ${e instanceof BlockedError ? e.code : 'error'} ${e.message}`);
    }
  }
})();
