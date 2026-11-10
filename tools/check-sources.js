'use strict';
/* Source freshness checker (tier 1 of the ingestion plan in docs/research/listing-sources.md).
   For every conference: fetch the organiser URL politely, record HTTP status, and extract any schema.org Event
   JSON-LD (startDate/endDate/location) or iCal link. Writes data/verification-report.json; never edits conferences.js.
   Usage: node tools/check-sources.js [--limit N] [--concurrency 4] */
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const LIMIT = arg('limit', 1e9), CONC = Math.min(arg('concurrency', 4), 8), UA = 'HoggyBot/1.0 (conference data freshness check; respects robots.txt)';
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'data', 'conferences.js'), 'utf8'), ctx);
const list = ctx.window.HOGGY_CONFERENCES.slice(0, LIMIT);
const robotsCache = new Map();
async function allowed(u) {
  const o = new URL(u); let rules = robotsCache.get(o.origin);
  if (!rules) { rules = []; try { const r = await fetch(o.origin + '/robots.txt', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) }); if (r.ok) { let on = false; for (const l of (await r.text()).split(/\r?\n/)) { const m = l.match(/^\s*(user-agent|disallow)\s*:\s*(.*?)\s*$/i); if (!m) continue; if (m[1].toLowerCase() === 'user-agent') on = m[2] === '*' || /hoggy/i.test(m[2]); else if (on && m[2]) rules.push(m[2]); } } } catch (e) { } robotsCache.set(o.origin, rules); }
  return !rules.some(r => o.pathname.startsWith(r));
}
const walk = (n, out) => { if (Array.isArray(n)) n.forEach(x => walk(x, out)); else if (n && typeof n === 'object') { const t = [].concat(n['@type'] || []); if (t.some(x => /Event$/.test(x))) out.push({ name: n.name, startDate: n.startDate, endDate: n.endDate, city: n.location && (n.location.address && (n.location.address.addressLocality || n.location.address) || n.location.name) }); Object.values(n).forEach(x => walk(x, out)); } };
async function check(c) {
  const rec = { id: c.id, url: c.url, checked: new Date().toISOString() };
  try {
    if (!(await allowed(c.url))) return { ...rec, status: 'robots-disallowed' };
    const r = await fetch(c.url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    rec.status = r.status; rec.finalUrl = r.url;
    if (r.ok && /html/.test(r.headers.get('content-type') || '')) {
      const html = (await r.text()).slice(0, 2e6), events = [];
      for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) { try { walk(JSON.parse(m[1]), events); } catch (e) { } }
      rec.events = events.slice(0, 5); rec.ical = (html.match(/href=["']([^"']+\.ics[^"']*)["']/i) || [])[1] || null;
      const hit = events.find(e => e.startDate && String(e.startDate).slice(0, 10) === c.start);
      rec.datesMatch = hit ? true : events.length ? false : null;
    }
  } catch (e) { rec.status = 'error'; rec.error = String(e.message || e).slice(0, 120); }
  return rec;
}
(async () => {
  const out = [], q = list.slice(); let done = 0;
  await Promise.all(Array.from({ length: CONC }, async () => { while (q.length) { const c = q.shift(); out.push(await check(c)); if (++done % 20 === 0) console.log(done + '/' + list.length); await new Promise(r => setTimeout(r, 400)); } }));
  const sum = { total: out.length, ok: out.filter(r => r.status >= 200 && r.status < 400).length, dead: out.filter(r => r.status === 404 || r.status === 410 || r.status === 'error').length, blocked: out.filter(r => r.status === 403 || r.status === 'robots-disallowed').length, jsonld: out.filter(r => r.events && r.events.length).length, datesMatch: out.filter(r => r.datesMatch === true).length, datesMismatch: out.filter(r => r.datesMatch === false).length };
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'verification-report.json'), JSON.stringify({ generated: new Date().toISOString(), summary: sum, results: out }, null, 1));
  console.log(JSON.stringify(sum));
})();
