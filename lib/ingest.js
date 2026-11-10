'use strict';
/* Continuous global-database updater.
   1) REFRESH: re-check organiser pages of known conferences (robots-aware, polite) and auto-update dates when the organiser
      publishes schema.org Event JSON-LD / iCal that clearly matches; flag dead links, cancellations and postponements.
   2) DISCOVER: poll registry sources (data/sources.json: iCal / RSS / JSON-LD / Crossref) and queue unknown events as
      PENDING candidates for an admin to approve. Nothing external is published without validation + approval.
   All fetches are https-only, blocked for private/loopback addresses (SSRF), size- and time-limited. */
const dns = require('node:dns').promises, net = require('node:net'), fs = require('node:fs'), path = require('node:path');
const UA = 'HoggyBot/1.0 (medical conference data freshness; respects robots.txt)';
const REGIONS = new Set(['Europe', 'North America', 'Asia-Pacific', 'Middle East', 'Africa', 'Latin America']);

function validate(c) {
  for (const k of ['id', 'name', 'organiser', 'specialty', 'city', 'country', 'countryCode', 'region', 'start', 'end', 'format', 'cpdHours', 'url', 'blurb']) if (c[k] == null || c[k] === '') return 'missing ' + k;
  if (!/^[a-z0-9-]{3,80}$/.test(c.id)) return 'bad id';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.start) || !/^\d{4}-\d{2}-\d{2}$/.test(c.end) || isNaN(Date.parse(c.start)) || isNaN(Date.parse(c.end)) || c.end < c.start) return 'bad dates';
  if (!/^https:\/\//.test(c.url)) return 'url must be https';
  if (!/^[A-Z]{2}$/.test(c.countryCode)) return 'bad countryCode';
  if (!REGIONS.has(c.region)) return 'bad region';
  if (!['In-person', 'Hybrid'].includes(c.format)) return 'bad format';
  if (typeof c.cpdHours !== 'number' || c.cpdHours < 0 || c.cpdHours > 100) return 'bad cpdHours';
  return null;
}

/* ---------- safe fetch ---------- */
const privateIp = ip => net.isIP(ip) === 4 ? /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(ip) : /^(::1$|::$|fc|fd|fe80|::ffff:(10\.|127\.|192\.168\.|169\.254\.))/i.test(ip);
async function publicHost(host) { if (net.isIP(host)) return !privateIp(host); try { const a = await dns.lookup(host, { all: true }); return a.length > 0 && a.every(x => !privateIp(x.address)); } catch (e) { return false; } }
const robots = new Map();
async function robotsAllowed(u) {
  const o = new URL(u); let rules = robots.get(o.origin);
  if (!rules) { rules = []; const r = await safeFetch(o.origin + '/robots.txt', { noRobots: true, max: 2e5 }); if (r && r.ok) { let on = false; for (const l of r.text.split(/\r?\n/)) { const m = l.match(/^\s*(user-agent|disallow)\s*:\s*(.*?)\s*$/i); if (!m) continue; if (m[1].toLowerCase() === 'user-agent') on = m[2] === '*' || /hoggy/i.test(m[2]); else if (on && m[2]) rules.push(m[2]); } } robots.set(o.origin, rules); setTimeout(() => robots.delete(o.origin), 3600e3).unref(); }
  return !rules.some(x => o.pathname.startsWith(x));
}
async function safeFetch(url, o = {}) {
  try {
    let u = new URL(url);
    for (let hop = 0; hop < 4; hop++) {
      if (u.protocol !== 'https:') return null;
      if (!(await publicHost(u.hostname))) return null;
      if (!o.noRobots && !(await robotsAllowed(u.href))) return { ok: false, status: 'robots-disallowed', text: '' };
      const r = await fetch(u.href, { headers: { 'User-Agent': UA, Accept: o.accept || 'text/html,text/calendar,application/rss+xml,application/json' }, redirect: 'manual', signal: AbortSignal.timeout(15000) });
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { u = new URL(r.headers.get('location'), u); continue; }
      const reader = r.body.getReader(), chunks = []; let n = 0; const max = o.max || 2e6;
      while (true) { const { done, value } = await reader.read(); if (done) break; n += value.length; chunks.push(value); if (n > max) { reader.cancel(); break; } }
      return { ok: r.ok, status: r.status, url: u.href, type: r.headers.get('content-type') || '', text: Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf8') };
    }
  } catch (e) { return { ok: false, status: 'error', text: '', error: String(e.message || e).slice(0, 100) }; }
  return null;
}

/* ---------- parsing ---------- */
function jsonldEvents(html) {
  const out = [], walk = n => { if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === 'object') { const t = [].concat(n['@type'] || []); if (t.some(x => /Event$/.test(x))) { const loc = n.location || {}, addr = loc.address || {}; out.push({ name: n.name, start: String(n.startDate || '').slice(0, 10), end: String(n.endDate || n.startDate || '').slice(0, 10), city: typeof addr === 'string' ? addr : addr.addressLocality || '', country: addr.addressCountry && (addr.addressCountry.name || addr.addressCountry) || '', url: n.url }); } Object.values(n).forEach(walk); } };
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) { try { walk(JSON.parse(m[1])); } catch (e) { } }
  return out.filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.start));
}
function icalEvents(text) {
  const t = text.replace(/\r?\n[ \t]/g, ''), out = [];
  for (const b of t.split('BEGIN:VEVENT').slice(1)) {
    const g = k => { const m = b.match(new RegExp('^' + k + '[^:\\n]*:(.*)$', 'mi')); return m ? m[1].trim().replace(/\\,/g, ',').replace(/\\n/g, ' ') : ''; };
    const d = v => { const m = v.match(/^(\d{4})(\d{2})(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : ''; };
    const s = d(g('DTSTART')); let e = d(g('DTEND')) || s;
    if (/DTEND;VALUE=DATE/i.test(b) && e > s) { const x = new Date(e + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() - 1); e = x.toISOString().slice(0, 10); }
    if (s) out.push({ name: g('SUMMARY'), start: s, end: e, city: g('LOCATION'), url: g('URL') });
  }
  return out;
}
function rssItems(xml) { return [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].slice(0, 100).map(m => ({ name: ((m[0].match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i) || [])[1] || '').trim(), url: ((m[0].match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i) || [])[1] || '').trim() })).filter(x => x.name); }
const STOP = new Set(['the', 'and', 'annual', 'congress', 'meeting', 'conference', 'scientific', 'sessions', 'international', 'world', 'society', 'national', 'symposium', 'for', 'of', 'in']);
const words = s => new Set(String(s).toLowerCase().replace(/\b20\d\d\b/g, '').split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w)));
const acr = s => (String(s).match(/\b[A-Z]{2,8}\b/g) || []).map(x => x.toLowerCase());
function similar(a, b) { const A = words(a), B = words(b); if (!A.size || !B.size) return false; let i = 0; for (const w of A) if (B.has(w)) i++; const j = i / (A.size + B.size - i); const ac = acr(a).filter(x => acr(b).includes(x)); return j >= 0.6 || (ac.length > 0 && j >= 0.3); }

/* ---------- jobs ---------- */
function makeIngest({ db, now }) {
  const q = s => db.prepare(s);
  const log = [];
  const note = m => { log.push(m); };

  async function refresh(limit = 40) {
    const rows = q("SELECT id, json, checked FROM conferences WHERE status IN ('published','flagged') ORDER BY checked ASC LIMIT ?").all(limit);
    let ok = 0, updated = 0, dead = 0, flagged = 0;
    for (const r of rows) {
      const c = JSON.parse(r.json), res = await safeFetch(c.url); let status = 'published', patch = null;
      if (!res || res.status === 'robots-disallowed') { q('UPDATE conferences SET checked=? WHERE id=?').run(now(), r.id); continue; }
      if (res.status === 404 || res.status === 410 || res.status === 'error') { c.deadChecks = (c.deadChecks || 0) + 1; dead++; if (c.deadChecks >= 3) { status = 'flagged'; flagged++; note(`flag ${c.id}: link dead x${c.deadChecks}`); } }
      else if (res.ok) {
        ok++; c.deadChecks = 0;
        const evs = [...jsonldEvents(res.text), ...(/BEGIN:VCALENDAR/.test(res.text) ? icalEvents(res.text) : [])];
        const hit = evs.find(e => similar(e.name || '', c.name) && e.start >= '2026-11-01' && e.start <= '2028-12-31');
        if (hit && c.datesConfirmed !== false && hit.start === c.start && hit.end === (hit.end >= hit.start ? hit.end : hit.start)) { c.lastVerified = new Date(now()).toISOString().slice(0, 10); c.provenance = 'organiser-jsonld'; }
        else if (hit) { const p = JSON.stringify({ start: hit.start, end: hit.end >= hit.start ? hit.end : hit.start, city: hit.city || undefined, evidenceUrl: res.url }); if (!q('SELECT 1 FROM date_changes WHERE conf_id=? AND patch=?').get(r.id, p)) { q('INSERT INTO date_changes(conf_id,patch,status,created) VALUES(?,?,?,?)').run(r.id, p, 'pending', now()); updated++; note(`queued date change ${c.id}: ${hit.start}..${hit.end}`); } }
        const txt = res.text.replace(/<[^>]+>/g, ' ').slice(0, 300000);
        if (new RegExp('(cancel+ed|postponed)[^.]{0,120}' + c.start.slice(0, 4), 'i').test(txt) && new RegExp(words(c.name).values().next().value || '$^', 'i').test(txt)) { status = 'flagged'; flagged++; note(`flag ${c.id}: cancelled/postponed wording`); }
      }
      q('UPDATE conferences SET json=?, status=?, checked=?, updated=COALESCE(?, updated) WHERE id=?').run(JSON.stringify(c), status, now(), (patch || status === 'flagged') ? now() : null, r.id);
      await new Promise(r2 => setTimeout(r2, 500));
    }
    return { checked: rows.length, ok, updated, dead, flagged };
  }

  async function discover() {
    let sources = []; try { sources = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sources.json'), 'utf8')); } catch (e) { return { sources: 0, queued: 0 }; }
    const known = q("SELECT json FROM conferences").all().map(r => JSON.parse(r.json)); let queued = 0, seen = 0;
    for (const s of sources.filter(x => x.verified !== false && /^https:/.test(x.url || ''))) {
      const res = await safeFetch(s.url, { max: 3e6 }); if (!res || !res.ok) { note(`source ${s.id}: ${res ? res.status : 'unreachable'}`); continue; }
      let evs = [];
      if (s.type === 'ical') evs = icalEvents(res.text); else if (s.type === 'jsonld' || s.type === 'html') evs = jsonldEvents(res.text);
      else if (s.type === 'rss') evs = rssItems(res.text);
      else if (s.type === 'crossref') { try { const J = JSON.parse(res.text); if (J.resultList) { evs = (J.resultList.result || []).map(i => ({ name: i.title || '', start: '', end: '', city: '', url: i.doi ? 'https://doi.org/' + i.doi : '' })).filter(x => x.name); } else evs = (J.message.items || []).map(i => ({ name: (i.event && i.event.name) || (i['container-title'] || [])[0] || '', start: '', end: '', city: (i.event && i.event.location) || '', url: i.URL })).filter(x => x.name); } catch (e) { } }
      for (const e of evs.slice(0, 300)) {
        seen++; if (!e.name || known.some(k => similar(k.name, e.name) && (!e.start || k.start.slice(0, 4) === e.start.slice(0, 4)))) continue;
        const cid = 'cand-' + require('node:crypto').createHash('sha1').update(s.id + e.name + e.start).digest('hex').slice(0, 14);
        if (q('SELECT 1 FROM candidates WHERE id=?').get(cid)) continue;
        q('INSERT INTO candidates(id,source,json,status,created) VALUES(?,?,?,?,?)').run(cid, s.id, JSON.stringify({ name: String(e.name).slice(0, 200), start: e.start || '', end: e.end || '', location: String(e.city || '').slice(0, 200), url: e.url || '', specialty: s.specialty || '', region: s.region || '', sourceUrl: s.url }), 'pending', now()); queued++;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    return { sources: sources.length, seen, queued };
  }

  async function run(opts = {}) {
    log.length = 0; const t0 = now(), r1 = await refresh(opts.limit || 40), r2 = await discover();
    const summary = { refresh: r1, discover: r2, changes: log.slice(0, 100) };
    q('INSERT INTO ingest_runs(started,finished,summary) VALUES(?,?,?)').run(t0, now(), JSON.stringify(summary));
    return summary;
  }
  return { run, refresh, discover };
}
module.exports = { makeIngest, validate, jsonldEvents, icalEvents, similar, privateIp, safeFetch };
