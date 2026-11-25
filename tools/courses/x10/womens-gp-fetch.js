'use strict';
/* x10 womens-gp desk: polite fetch of every page the build reads, into DIR (DIR/index.tsv + one file per URL).
   Usage: node tools/courses/x10/womens-gp-fetch.js --out DIR [--today YYYY-MM-DD]
   then:  node tools/courses/x10/womens-gp-build.js --cache DIR
   Uses tools/courses/http.js: generic UA, one request at a time, >= 3 s per host (11 s for shvic.org.au, which asks for
   Crawl-delay 10), robots.txt honoured, Cloudflare/CAPTCHA/401/403 reported as blocked and never retried.
   Behind an HTTPS proxy run it with NODE_USE_ENV_PROXY=1. About 140 requests, ~8 minutes. */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { makeClient } = require('../http');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const out = arg('--out'); if (!out) { console.error('need --out DIR'); process.exit(2); }
const today = arg('--today') || new Date().toISOString().slice(0, 10);
fs.mkdirSync(out, { recursive: true });
const client = makeClient({ gapMs: 3000, log: m => console.error(m) }), slow = makeClient({ gapMs: 11000, log: m => console.error(m) });
const idxFile = path.join(out, 'index.tsv'), blocked = [];
async function get(u) {
  const c = /shvic\.org\.au/.test(u) ? slow : client;
  try {
    const r = await c.getPage(u), f = path.join(out, crypto.createHash('md5').update(u).digest('hex').slice(0, 12) + '.html');
    fs.writeFileSync(f, r.body); fs.appendFileSync(idxFile, `${u}\t${f}\t${r.url}\n`); return r.body;
  } catch (e) { blocked.push(`${u}\t${e.code || 'error'}\t${e.message}`); return null; }
}
const links = (h, re) => [...new Set([...String(h || '').matchAll(/href="([^"#]+)"/g)].map(m => m[1]).filter(x => re.test(x)))];
const y2 = String(+today.slice(0, 4) + 2);
(async () => {
  /* FSEP feed: 50 events a page, about 3 pages; every page is read (the build parses each one) */
  for (let p = 1, pages = 1; p <= pages && p <= 10; p++) {
    const b = await get(`https://fsep.ranzcog.edu.au/wp-json/tribe/events/v1/events?per_page=50&start_date=${today}&end_date=${y2}-12-31${p > 1 ? '&page=' + p : ''}`);
    try { pages = b ? +JSON.parse(b).total_pages || 1 : 0; } catch (e) { pages = 0; }
  }
  for (const p of ['what-we-offer/available-programs/full-day-program/', 'about-fsep/target-audience/', 'what-we-offer/online-program/']) await get('https://fsep.ranzcog.edu.au/' + p);
  const ev = await get('https://www.skincancercollege.org/events');
  for (const k of links(ev, /EventDetail\?EventKey=(CSCM|ASSW|DERM)_/)) await get('https://www.skincancercollege.org' + k);
  for (const u of ['https://www.healthcert.com/workshops/calendar', 'https://www.healthcert.com/courses/certificates/advanced-workshop-intrauterine-systems', 'https://www.healthcert.com/courses/certificates/advanced-workshop-non-scalpel-vasectomy']) await get(u);
  const sem = await get('https://www.healthed.com.au/seminars/');
  for (const u of links(sem, /^https:\/\/www\.healthed\.com\.au\/events\/[a-z0-9]+\/$/)) await get(u);
  /* AIU: the store API lists products and their date terms; each product page with a future date is read (dates are taken from the page) */
  const store = await get('https://www.aiu.edu.au/wp-json/wc/store/v1/products?per_page=100');
  if (store) for (const p of JSON.parse(store)) {
    const a = (p.attributes || []).find(x => x.name === 'Course Date'); if (!a) continue;
    if (a.terms.some(t => { const [d, m, y] = t.slug.split('-'); return y && `${y}-${String(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m) + 1).padStart(2, '0')}-${d}` >= today; })) await get(p.permalink);
  }
  for (const p of ['advanced-airway', 'racm', 'pre-hospital-emergency-care-phec', 'point-of-care-ultrasound-for-rural-generalists']) await get('https://www.acrrm.org.au/courses/face-to-face/' + p);
  for (const p of ['course/iud-theory/', 'course/implant-training/', 'course/certificate-nursing/', 'course/certificate-nursing-cervical-screening-only/', 'course/unintended-pregnancy-counselling-training/', 'education/courses/']) await get('https://shq.org.au/' + p);
  for (const k of ['implanon-nxt-training-doctors', 'implanon-nurses', 'iud-train-trainer-program', 'certificate-in-sexual-health', 'srha', 'pregnancy-choices-training']) await get(`https://shinesa.org.au/activity/${k}/`);
  await get('https://www.shvic.org.au/courses/194-sexual-and-reproductive-health-australia-national-certificate-for-doctors-course-face-to-face/');
  for (const p of ['iud-insertion-training/', 'contraceptive-implant-implanon-nxt-insertion-and-removal-training/', 'srha-national-certificate-in-reproductive-and-sexual-health-for-doctors/']) await get('https://intheknow.org.au/training/hub/' + p);
  /* Rural Health West: listing, then each event page (related-event links on event pages add more) */
  const seen = new Set(), queue = links(await get('https://ruralhealthwest.com.au/events/'), /^https:\/\/ruralhealthwest\.com\.au\/events\/[a-z0-9-]+\/$/);
  while (queue.length) { const u = queue.shift(); if (seen.has(u) || /\/events\/(page|feed)\//.test(u)) continue; seen.add(u); for (const l of links(await get(u), /^https:\/\/ruralhealthwest\.com\.au\/events\/[a-z0-9-]+\/$/)) if (!seen.has(l)) queue.push(l); }
  for (const l of links(await get('https://sapmea.asn.au/education/calendar'), /^\/education\/events\/[a-z0-9-]+$/)) await get('https://sapmea.asn.au' + l);
  fs.writeFileSync(path.join(out, 'blocked.tsv'), blocked.join('\n') + '\n');
  console.error(`done; ${blocked.length} blocked/failed (see blocked.tsv)`);
})();
