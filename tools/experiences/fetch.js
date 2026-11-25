'use strict';
/* Polite fetcher for experience sources (docs/research/experiences.md): obeys robots.txt (User-agent: *), waits at least
   3.5 s between requests to a host, https only, records 403/429/bot challenges as "blocked" and never retries around them.
   Saves each page's HTML and plain text to the cache (XP_CACHE, default tools/experiences/.cache, not committed).
   Usage: node tools/experiences/fetch.js urls.txt [--force]   |   node tools/experiences/fetch.js --retext */
const { execFile } = require('child_process');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const CACHE = process.env.XP_CACHE || path.join(__dirname, '.cache');
const DIR = path.join(CACHE, 'pages');
const IDX = path.join(CACHE, 'index.json');
fs.mkdirSync(DIR, { recursive: true });
const idx = fs.existsSync(IDX) ? JSON.parse(fs.readFileSync(IDX, 'utf8')) : {};
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function curl(url) {
  return new Promise(res => {
    execFile('curl', ['-s', '-L', '--max-time', '30', '--compressed', '-A', UA, '-H', 'Accept-Language: en-AU,en;q=0.9', '-w', '\n__STATUS__%{http_code} %{url_effective}', url], { maxBuffer: 64 << 20, encoding: 'latin1' }, (e, out) => {
      out = Buffer.from(out || '', 'latin1').toString('utf8');
      const m = out.match(/\n__STATUS__(\d+) (\S*)$/);
      res({ status: m ? +m[1] : 0, final: m ? m[2] : url, body: m ? out.slice(0, m.index) : out });
    });
  });
}
const robotsCache = {};
async function robotsOk(u) {
  const { origin, pathname, search } = new URL(u);
  if (!(origin in robotsCache)) {
    const r = await curl(origin + '/robots.txt');
    const rules = [];
    if (r.status === 200 && !/<html/i.test(r.body.slice(0, 500))) {
      let applies = false, sawUA = false;
      for (let line of r.body.split(/\r?\n/)) {
        line = line.replace(/#.*/, '').trim(); if (!line) continue;
        const [k, ...v] = line.split(':'); const val = v.join(':').trim(); const key = k.toLowerCase();
        if (key === 'user-agent') { if (sawUA) { applies = false; sawUA = false; } if (val === '*') applies = true; continue; }
        sawUA = true;
        if (applies && (key === 'disallow' || key === 'allow') && val) rules.push({ allow: key === 'allow', p: val });
      }
    }
    robotsCache[origin] = rules; await sleep(3500);
  }
  const p = pathname + search; let best = null;
  for (const r of robotsCache[origin]) {
    const re = new RegExp('^' + r.p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (re.test(p) && (!best || r.p.length > best.p.length || (r.p.length === best.p.length && r.allow))) best = r;
  }
  return !best || best.allow;
}
function text(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/td|\/th)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&rsquo;|&lsquo;|&#8217;|&#x27;/g, "'").replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/g, '"')
    .replace(/&ndash;|&#8211;/g, '–').replace(/&mdash;|&#8212;/g, '—').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&(middot|deg|reg|copy|trade|eacute|egrave|aacute|oacute|uacute|iacute|ntilde|uuml|ouml|auml|ccedil|atilde|otilde|ecirc|acirc|ocirc|hellip|bull|times);/g, (_, n) => ({ middot: '·', deg: '°', reg: '®', copy: '©', trade: '™', eacute: 'é', egrave: 'è', aacute: 'á', oacute: 'ó', uacute: 'ú', iacute: 'í', ntilde: 'ñ', uuml: 'ü', ouml: 'ö', auml: 'ä', ccedil: 'ç', atilde: 'ã', otilde: 'õ', ecirc: 'ê', acirc: 'â', ocirc: 'ô', hellip: '…', bull: '•', times: '×' })[n]).replace(/&eacute;/g, 'é').replace(/&hellip;/g, '…')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}
if (process.argv[2] === '--retext') { for (const v of Object.values(idx)) if (v.file) fs.writeFileSync(path.join(DIR, v.file + '.txt'), text(fs.readFileSync(path.join(DIR, v.file + '.html'), 'utf8'))); process.exit(0); }
async function main() {
  const urls = [...new Set(fs.readFileSync(process.argv[2], 'utf8').split('\n').map(s => s.trim()).filter(s => /^https:\/\//.test(s)))].filter(u => process.argv.includes('--force') || !idx[u] || idx[u].status !== 200);
  const byHost = {};
  for (const u of urls) (byHost[new URL(u).host] = byHost[new URL(u).host] || []).push(u);
  await Promise.all(Object.values(byHost).map(async list => {
    for (const u of list) {
      try {
        if (!(await robotsOk(u))) { idx[u] = { status: 'robots' }; console.log('ROBOTS', u); continue; }
        const r = await curl(u);
        const h = crypto.createHash('md5').update(u).digest('hex').slice(0, 12);
        const blocked = r.status === 403 || r.status === 429 || /cf-challenge|challenge-platform|captcha/i.test(r.body.slice(0, 20000)) && r.body.length < 30000;
        fs.writeFileSync(path.join(DIR, h + '.html'), r.body); fs.writeFileSync(path.join(DIR, h + '.txt'), text(r.body));
        idx[u] = { status: blocked ? 'blocked' : r.status, file: h, final: r.final, fetched: new Date().toISOString().slice(0, 10), len: r.body.length };
        console.log(idx[u].status, r.body.length, u);
      } catch (e) { idx[u] = { status: 'error ' + e.message }; console.log('ERR', u, e.message); }
      fs.writeFileSync(IDX, JSON.stringify(idx, null, 1));
      await sleep(3500);
    }
  }));
  fs.writeFileSync(IDX, JSON.stringify(idx, null, 1));
}
main();
