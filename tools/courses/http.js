'use strict';
/* Polite HTTP for the course refresh: generic User-Agent, one request at a time, a minimum gap per host, robots.txt
   honoured (for * and for Claude/Anthropic agent names), bot challenges (Cloudflare, CAPTCHA, 403) reported and never
   worked around, a couple of retries for network hiccups only. Uses Node's built-in fetch (Node 18+). */

const UA = 'Mozilla/5.0 (compatible; course-dates-refresh/1.0)';
const ROBOT_NAMES = ['*', 'course-dates-refresh', 'claudebot', 'claude-user', 'claude-searchbot', 'anthropic-ai'];

class BlockedError extends Error { constructor(msg, code) { super(msg); this.code = code || 'blocked'; } }

/* robots.txt -> list of Disallow/Allow rules that apply to any of our names */
function robotsRules(txt, names = ROBOT_NAMES) {
  const rules = []; let agents = [], inRules = false;
  for (const raw of String(txt || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') { if (inRules) { agents = []; inRules = false; } agents.push(v.toLowerCase()); }
    else if (k === 'disallow' || k === 'allow') { inRules = true; if (agents.some(a => names.includes(a)) && v) rules.push({ allow: k === 'allow', path: v }); }
  }
  return rules;
}
function robotsAllows(rules, pathAndQuery) {
  let best = null;
  for (const r of rules) {
    const re = new RegExp('^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (re.test(pathAndQuery) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) best = r;
  }
  return !best || best.allow;
}

/* ua / robotNames: tools/verify-dates.js uses its own generic name; the defaults are the course refresh's */
function makeClient({ gapMs = 3000, retries = 2, timeoutMs = 30000, log = () => {}, fetchImpl = globalThis.fetch, ua = UA, robotNames = ROBOT_NAMES } = {}) {
  const last = new Map(), robots = new Map();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function wait(host) { const t = last.get(host) || 0, d = t + gapMs - Date.now(); if (d > 0) await sleep(d); last.set(host, Date.now()); }
  async function raw(url) {
    const u = new URL(url); await wait(u.host);
    const ac = new AbortController(), timer = setTimeout(() => ac.abort(), timeoutMs);
    try { return await fetchImpl(url, { headers: { 'User-Agent': ua, Accept: 'text/html,application/json;q=0.9,*/*;q=0.8' }, redirect: 'follow', signal: ac.signal }); }
    finally { clearTimeout(timer); }
  }
  async function allowed(url) {
    const u = new URL(url);
    if (!robots.has(u.host)) {
      let rules = [];
      try { const r = await raw(`${u.protocol}//${u.host}/robots.txt`); if (r.ok) rules = robotsRules(await r.text(), robotNames); } catch { /* no robots.txt reachable: treat as allowed */ }
      robots.set(u.host, rules);
    }
    return robotsAllows(robots.get(u.host), u.pathname + u.search);
  }
  async function get(url) { return (await getPage(url)).body; }
  /* -> { body, url } where url is the address after redirects (that is the page the text was read from) */
  async function getPage(url) {
    if (!/^https:\/\//.test(url)) throw new BlockedError('https only: ' + url, 'not-https');
    if (!(await allowed(url))) throw new BlockedError('robots.txt disallows ' + url, 'robots');
    let lastErr;
    for (let i = 0; i <= retries; i++) {
      try {
        const r = await raw(url), body = await r.text();
        if (r.headers.get('cf-mitigated') || (r.status >= 400 && /<title>\s*Just a moment|challenge-platform|captcha/i.test(body.slice(0, 5000))))
          throw new BlockedError(`bot challenge (HTTP ${r.status}) at ${url}`, 'challenge');
        if (r.status === 401 || r.status === 403) throw new BlockedError(`HTTP ${r.status} at ${url}`, 'forbidden');
        if (r.status === 404 || r.status === 410) throw new BlockedError(`HTTP ${r.status} at ${url}`, 'gone');
        if (!r.ok) throw new Error(`HTTP ${r.status} at ${url}`);
        log(`GET ${url} -> ${r.status} (${body.length} bytes)`);
        const finalUrl = r.url || url;
        if (finalUrl !== url && !/^https:\/\//.test(finalUrl)) throw new BlockedError('redirected off https: ' + finalUrl, 'not-https');
        /* wave 5: a redirect to another host must also be allowed by that host's robots.txt (hawkesbay.health.nz redirects to
           www.healthnz.govt.nz, whose robots.txt disallows all agents); the body is discarded if not */
        if (finalUrl !== url && new URL(finalUrl).host !== new URL(url).host && !(await allowed(finalUrl))) throw new BlockedError('robots.txt disallows the redirect target ' + finalUrl, 'robots');
        return { body, url: finalUrl };
      } catch (e) {
        if (e instanceof BlockedError) throw e;
        lastErr = e; log(`GET ${url} failed (${e.message}); ${i < retries ? 'retrying' : 'giving up'}`);
        if (i < retries) await sleep(gapMs * (i + 2));
      }
    }
    throw lastErr;
  }
  return { get, getPage, allowed, gapMs };
}

module.exports = { makeClient, robotsRules, robotsAllows, BlockedError, UA };
