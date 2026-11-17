#!/usr/bin/env node
'use strict';
/* B28/B30: re-check conference dates on the organiser's own page and store the evidence.
   Takes the N soonest upcoming rows that are estimated or confirmed without stored evidence (legacyConfirmed), fetches the
   organiser page politely (tools/courses/http.js: robots.txt, at least 3 s between requests to a host, generic User-Agent,
   https only, Cloudflare / CAPTCHA / 403 recorded as blocked and never worked around), finds the date ranges written near the
   conference's name and year, and:
     exactly one plausible range, page on the organiser's domain  -> evidence entry (datesSourceUrl, datesQuote, verifiedOn) in
                                                                     data/shards/provenance-dates-<today>.json for the merge step
     several ranges, a range that disagrees with a confirmed row, a big move, a site-root page, nothing found -> human review
   and writes the "Date checks" section of docs/daily-report-<today>.md.

   Usage: node tools/verify-dates.js [--limit 40] [--only estimated|legacy] [--dry] [--today YYYY-MM-DD] [--ids a,b] [--root DIR] [--gap 3000]
                                     [--save DIR] [--from DIR] [--quiet]
     --dry   fetch and decide, print the report, write nothing
     --save  also store every page in DIR (index.json maps URL -> file); --from replays such a DIR offline (tests use this)
   Then run: node tools/merge-shards.js && node tools/validate-data.js
   Exit codes: 0 ok (whatever was found), 1 crash or an entry that would break the evidence rule (nothing written). */
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const X = require('./dates/extract');
const E = require('./evidence');
const { coreWords } = require('../lib/series.js');

const UA = 'Mozilla/5.0 (compatible; conference-dates-check/1.0)';
const ROBOT_NAMES = ['*', 'conference-dates-check', 'claudebot', 'claude-user', 'claude-searchbot', 'anthropic-ai'];
const MIN_GAP_MS = 3000, MAX_DAYS = 14, BIG_MOVE_DAYS = 120, NEAR_CHARS = 400;
const GENERIC = new Set(['annual', 'congress', 'meeting', 'conference', 'scientific', 'society', 'international', 'national', 'world', 'european', 'symposium', 'association', 'college', 'sessions', 'summit', 'course', 'congreso', 'congresso', 'congres', 'kongress', 'jornada', 'jornadas', 'forum', 'workshop', 'update', 'medicine', 'medical', 'sociedade', 'sociedad', 'societe', 'société', 'gesellschaft', 'deutsche', 'societa', 'società', 'brasileiro', 'brasileira', 'american', 'british', 'australian', 'zealand', 'canadian']);
const DEADLINE = /(deadline|submission|abstracts?\b|early[- ]?bird|cut-?off|closes|closing|due\b|until|prazo|inscri|fecha l[ií]mite|date limite|anmeldeschluss|frist|scadenza)[^\n]{0,60}$/i;
const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

/* the words a page about this conference would use: acronyms (RSNA, ESMO, SBOT) and the longer, specific name words */
function nameTokens(c) {
  const words = coreWords(c.name, c.city).concat(coreWords(String(c.organiser || '').replace(/[()]/g, ' '), ''));
  const acr = [...new Set(words.filter(w => /^[A-Z][A-Z0-9]{2,11}$/.test(w)).concat((String(c.name).match(/\(([A-Z][A-Za-z0-9]{2,11})\)/) || []).slice(1)))];
  const long = [...new Set(words.map(w => w.toLowerCase()).filter(w => w.length >= 6 && !GENERIC.has(w)))];
  const ym = String(c.name).match(/\b(20\d\d)\b/);
  return { acr, long, year: ym ? ym[1] : String(c.start).slice(0, 4) };
}
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function mentions(text, tok) {
  const pos = [];
  for (const a of tok.acr) for (const m of text.matchAll(new RegExp('(?<![A-Za-z])' + escRe(a) + '(?![A-Za-z])', 'g'))) pos.push(m.index);
  for (const w of tok.long) for (const m of text.matchAll(new RegExp(escRe(w), 'gi'))) pos.push(m.index);
  return pos;
}
const about = (s, tok) => tok.acr.some(a => new RegExp('(?<![A-Za-z])' + escRe(a) + '(?![A-Za-z])').test(s)) || tok.long.filter(w => s.toLowerCase().includes(w)).length >= Math.min(2, tok.long.length || 2);

/* read one page: every plausible range for this row, with the reason others were left out */
function readPage(c, html, url) {
  const tok = nameTokens(c), { title, h1, text } = X.pageText(html), single = c.start === c.end;
  const pageAbout = about(title + ' ' + h1, tok), pos = pageAbout ? [] : mentions(text, tok);
  const mdy = ['US', 'PH'].includes(c.countryCode); /* numeric dates month first only on US/PH pages; a part above 12 settles it anyway */
  const found = X.findRanges(text, { mdy }), plausible = [], otherYears = new Set(), dropped = [];
  for (const r of found) {
    const len = days(r.start, r.end);
    if (r.start.slice(0, 4) !== tok.year && r.end.slice(0, 4) !== tok.year) { otherYears.add(r.start.slice(0, 4)); continue; }
    if (len > MAX_DAYS || (len === 0 && !single)) { dropped.push(r.raw + ' (length)'); continue; }
    if (r.ambiguous) { dropped.push(r.raw + ' (day/month order unclear)'); continue; }
    const before = text.slice(Math.max(0, text.lastIndexOf('\n', r.index) + 1), r.index);
    if (DEADLINE.test(before)) { dropped.push(r.raw + ' (deadline)'); continue; }
    if (!pageAbout && !pos.some(p => Math.abs(p - r.index) <= NEAR_CHARS)) { dropped.push(r.raw + ' (not near the name)'); continue; }
    plausible.push({ ...r, quote: X.quoteAround(text, r.index, r.length), via: 'text' });
  }
  for (const ev of X.jsonLdEvents(html)) {
    if (ev.start.slice(0, 4) !== tok.year) { otherYears.add(ev.start.slice(0, 4)); continue; }
    if (!pageAbout && !about(ev.name, tok)) continue;
    const t = plausible.find(p => p.start === ev.start && p.end === ev.end);
    if (!t && days(ev.start, ev.end) <= MAX_DAYS) plausible.push({ start: ev.start, end: ev.end, raw: `${ev.start}/${ev.end}`, via: 'json-ld', quote: jsonLdQuote(html, ev) });
  }
  const distinct = [...new Map(plausible.map(p => [p.start + '|' + p.end, p])).values()];
  return { distinct, otherYears: [...otherYears].sort(), dropped, pageAbout, title, text: title + '\n' + text + '\n' + JSON.stringify(X.jsonLdEvents(html)) + (String(html).match(/"addressLocality"\s*:\s*"[^"]*"/g) || []).join(' ') };
}
/* verbatim slice of the page source holding the JSON-LD dates, when it is short enough to quote */
function jsonLdQuote(html, ev) {
  const m = String(html).match(new RegExp('"startDate"\\s*:\\s*"' + escRe(ev.start) + '[^"]*"[\\s\\S]{0,120}?"endDate"\\s*:\\s*"' + escRe(ev.end) + '[^"]*"'));
  return m && m[0].length <= 200 ? m[0] : null;
}

/* where to look: the row's own pages on the organiser's domain (never an aggregator) */
function urlsFor(c) {
  const seen = new Set(), out = [];
  for (const u of [c.datesSourceUrl, c.sourceUrl, c.url]) {
    if (!u || seen.has(u) || !/^https:\/\//.test(u) || E.isAggregator(u) || !E.onOrganiserDomain(c, u)) continue;
    seen.add(u); out.push(u);
  }
  return out;
}
/* from a site root, at most two links on the same domain that name this edition (acronym, or a name word plus the year) */
function eventLinks(c, html, base) {
  const tok = nameTokens(c), dom = E.registrable(E.hostOf(base));
  const score = l => { const u = new URL(l.url), s = decodeURIComponent(u.pathname + u.search) + ' ' + l.text; /* path and link text: the host names the society on every link */ return (tok.acr.some(a => s.toLowerCase().includes(a.toLowerCase())) ? 2 : 0) + (s.includes(tok.year) ? 1 : 0) + (tok.long.some(w => s.toLowerCase().includes(w)) ? 1 : 0); };
  return [...new Map(X.links(html, base).filter(l => E.registrable(E.hostOf(l.url)) === dom && !E.isSiteRoot(l.url) && l.url !== base && score(l) >= 2).map(l => [l.url, l])).values()]
    .sort((a, b) => score(b) - score(a)).slice(0, 2).map(l => l.url);
}

async function checkRow(c, http, today) {
  const was = { start: c.start, end: c.end, status: c.datesConfirmed === false ? 'estimated' : 'legacy' };
  const base = { id: c.id, name: c.name, was };
  const queue = urlsFor(c), tried = new Set();
  if (!queue.length) return { ...base, status: 'review', reason: 'no https page on the organiser\'s domain to check (url ' + (c.url || 'missing') + ')' };
  let rootOnly = null, lastNone = null, blocked = null;
  while (queue.length && tried.size < 4) {
    const url = queue.shift(); if (tried.has(url)) continue; tried.add(url);
    let page;
    try { page = http.getPage ? await http.getPage(url) : { body: await http.get(url), url }; }
    catch (e) { if (e && e.code) { blocked = blocked || { url, code: e.code, msg: e.message }; continue; } return { ...base, status: 'error', url, reason: String(e && e.message || e).slice(0, 160) }; }
    const at = page.url || url, r = readPage(c, page.body, at), root = E.isSiteRoot(at);
    if (root) for (const l of eventLinks(c, page.body, at)) if (!tried.has(l)) queue.unshift(l);
    if (r.distinct.length > 1) return { ...base, status: 'review', url: at, reason: `${r.distinct.length} different date ranges for ${nameTokens(c).year} on the page`, candidates: r.distinct.map(p => `${p.start}..${p.end} "${p.raw}"`) };
    if (r.distinct.length === 1) {
      const p = r.distinct[0];
      if (root) { rootOnly = rootOnly || { url: at, p }; continue; }
      if (!p.quote) return { ...base, status: 'review', url: at, reason: `dates ${p.start}..${p.end} only in the page's data, too long to quote`, range: p };
      const next = { ...c, start: p.start, end: p.end, datesSourceUrl: at, datesQuote: p.quote, verifiedOn: today, datesConfirmed: true };
      const why = E.evidenceProblem(next, { today });
      if (why) return { ...base, status: 'review', url: at, range: p, reason: 'page found but it fails the evidence rule: ' + why };
      const same = p.start === c.start && p.end === c.end;
      /* an estimated row's city is a guess too (B28 found rows that copied the previous edition's city): the page must name it */
      if (was.status === 'estimated' && c.city && !fold(r.text).includes(fold(c.city))) return { ...base, status: 'review', url: at, range: p, reason: `page says ${p.start}..${p.end} but does not name ${c.city}: check the city before confirming` };
      if (!same && was.status === 'legacy') return { ...base, status: 'review', url: at, range: p, reason: `page says ${p.start}..${p.end}, the row (confirmed earlier) says ${c.start}..${c.end}` };
      if (!same && Math.abs(days(c.start, p.start)) > BIG_MOVE_DAYS) return { ...base, status: 'review', url: at, range: p, reason: `page says ${p.start}..${p.end}, ${Math.abs(days(c.start, p.start))} days from the estimate: check it is the same meeting` };
      return { ...base, status: same ? 'confirmed' : 'corrected', url: at, range: p, quote: p.quote, entry: { id: c.id, verified: true, start: p.start, end: p.end, sourceUrl: at, datesSourceUrl: at, datesQuote: p.quote, verifiedOn: today, note: `tools/verify-dates.js ${today}: read from the ${p.via === 'json-ld' ? 'schema.org data' : 'text'} of the organiser page${same ? '' : `; was ${c.start}..${c.end} (${was.status})`}` } };
    }
    lastNone = { url: at, otherYears: r.otherYears, dropped: r.dropped };
  }
  if (rootOnly) return { ...base, status: 'review', url: rootOnly.url, range: rootOnly.p, reason: `dates ${rootOnly.p.start}..${rootOnly.p.end} found only on the site root; find the event page and add it as sourceUrl` };
  if (lastNone) return { ...base, status: 'none', url: lastNone.url, reason: lastNone.otherYears.length ? `no ${nameTokens(c).year} dates; the page shows ${lastNone.otherYears.join(', ')}` : 'no dates for this edition on the page', dropped: lastNone.dropped.slice(0, 4) };
  return { ...base, status: 'blocked', url: blocked.url, reason: `${blocked.code}: ${blocked.msg}`.slice(0, 160) };
}

function loadRows(root) { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(root, 'data', 'conferences.js'), 'utf8'), ctx); return ctx.window.HOGGY_CONFERENCES; }
function pick(rows, { today, limit = 40, ids, only } = {}) {
  if (ids && ids.length) return ids.map(id => rows.find(c => c.id === id)).filter(Boolean);
  const want = c => c.datesConfirmed === false ? only !== 'legacy' : !!E.evidenceProblem(c, { today }) && only !== 'estimated';
  return rows.filter(c => c.end >= today && want(c))
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id)).slice(0, limit);
}

async function run({ root, http, today, limit, ids, only, log = () => {} }) {
  const rows = pick(loadRows(root), { today, limit, ids, only }), results = [];
  for (const c of rows) { const r = await checkRow(c, http, today); log(`${r.status.padEnd(9)} ${c.id}${r.reason ? ': ' + r.reason : ''}`); results.push(r); }
  return results;
}

const md = s => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
function reportSection(results, { today, limit, shardRel, only }) {
  const by = s => results.filter(r => r.status === s), ok = by('confirmed'), fixed = by('corrected'), rev = by('review'), blk = by('blocked'), none = by('none'), err = by('error');
  const L = ['## Date checks', '', `Run: \`node tools/verify-dates.js --limit ${limit}${only ? ' --only ' + only : ''}\` on ${today}. Checked ${results.length} rows (the soonest ${only === 'estimated' ? 'estimated' : only === 'legacy' ? 'not-yet-re-checked' : 'estimated or not-yet-re-checked'} ones): ${ok.length} confirmed as listed, ${fixed.length} corrected, ${rev.length} for review, ${none.length} with no dates for the edition, ${blk.length} blocked, ${err.length} errors.${ok.length + fixed.length ? ` Evidence written to \`${shardRel}\`; the merge step applies it.` : ''}`, ''];
  if (ok.length + fixed.length) {
    L.push('### Confirmed with evidence', '', '| id | was | now | source | quote |', '|---|---|---|---|---|');
    for (const r of [...fixed, ...ok]) L.push(`| ${r.id} | ${r.was.start}..${r.was.end} (${r.was.status}) | ${r.range.start}..${r.range.end}${r.status === 'corrected' ? ' (changed)' : ''} | <${r.url}> | ${md(r.quote)} |`);
    L.push('');
  }
  if (rev.length) { L.push('### Needs human review', ''); for (const r of rev) L.push(`- \`${r.id}\` (${r.was.start}, ${r.was.status}): ${md(r.reason)}${r.candidates ? '; candidates: ' + r.candidates.map(md).join('; ') : ''}${r.url ? ` <${r.url}>` : ''}`); L.push(''); }
  if (none.length) { L.push('### No dates for this edition found', ''); for (const r of none) L.push(`- \`${r.id}\` (${r.was.start}): ${md(r.reason)} <${r.url}>`); L.push(''); }
  if (blk.length) { L.push('### Blocked (skipped, not bypassed)', ''); for (const r of blk) L.push(`- \`${r.id}\`: ${md(r.reason)}`); L.push(''); }
  if (err.length) { L.push('### Errors', ''); for (const r of err) L.push(`- \`${r.id}\`: ${md(r.reason)}${r.url ? ` <${r.url}>` : ''}`); L.push(''); }
  return L.join('\n');
}
/* replace the "## Date checks" section of the day's report, or add it */
function writeReport(file, section, today) {
  let txt = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : `# Hoggy daily report, ${today}\n\n`;
  const i = txt.search(/^## Date checks\s*$/m);
  if (i >= 0) { const rest = txt.slice(i + 3), j = rest.search(/^## /m); txt = txt.slice(0, i) + section + (j >= 0 ? '\n' + rest.slice(j) : ''); }
  else txt = txt.replace(/\s*$/, '\n\n') + section;
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, txt.replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '\n'));
}
/* add or replace this run's entries in the day's evidence shard */
function writeShard(file, entries) {
  const old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [], m = new Map(old.map(e => [e.id, e]));
  for (const e of entries) m.set(e.id, e);
  fs.writeFileSync(file, '[\n' + [...m.values()].map(e => ' ' + JSON.stringify(e)).join(',\n') + '\n]\n');
}

function fetcher({ from, save, gapMs, log }) {
  if (from) {
    const idx = JSON.parse(fs.readFileSync(path.join(from, 'index.json'), 'utf8'));
    return { getPage: async u => { const e = idx[u]; if (!e) throw new Error('not in saved set: ' + u); if (e.blocked) { const er = new Error(e.blocked); er.code = e.blocked; throw er; } return { body: fs.readFileSync(path.join(from, e.file || e), 'utf8'), url: e.url || u }; } };
  }
  const { makeClient } = require('./courses/http');
  const c = makeClient({ gapMs: Math.max(MIN_GAP_MS, gapMs || 0), ua: UA, robotNames: ROBOT_NAMES, log });
  if (!save) return c;
  fs.mkdirSync(save, { recursive: true });
  const ip = path.join(save, 'index.json'), idx = fs.existsSync(ip) ? JSON.parse(fs.readFileSync(ip, 'utf8')) : {};
  return { getPage: async u => { const p = await c.getPage(u), f = crypto.createHash('sha1').update(u).digest('hex').slice(0, 12) + '.html'; fs.writeFileSync(path.join(save, f), p.body); idx[u] = { file: f, url: p.url }; fs.writeFileSync(ip, JSON.stringify(idx, null, 1)); return p; } };
}

async function main(argv) {
  const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; }, flag = k => argv.includes(k);
  const root = path.resolve(opt('--root') || path.join(__dirname, '..')), today = opt('--today') || new Date().toISOString().slice(0, 10);
  const only = opt('--only'), limit = +(opt('--limit') || 40), ids = opt('--ids') ? opt('--ids').split(',').map(s => s.trim()).filter(Boolean) : null, DRY = flag('--dry'), QUIET = flag('--quiet');
  const log = m => { if (!QUIET) console.error(m); };
  const http = fetcher({ from: opt('--from'), save: opt('--save'), gapMs: +(opt('--gap') || MIN_GAP_MS), log });
  if (only && !['estimated', 'legacy'].includes(only)) { console.error('--only takes estimated or legacy'); return 1; }
  const results = await run({ root, http, today, limit, ids, only, log });
  const entries = results.filter(r => r.entry).map(r => r.entry);
  /* belt and braces: every entry must pass the rule against the row it updates, or nothing is written */
  const rows = new Map(loadRows(root).map(c => [c.id, c]));
  for (const e of entries) { const why = E.evidenceProblem({ ...rows.get(e.id), ...e, datesConfirmed: true }, { today }); if (why) { console.error(`internal: entry for ${e.id} breaks the evidence rule (${why}); nothing written`); return 1; } }
  const shardRel = `data/shards/provenance-dates-${today}.json`, section = reportSection(results, { today, limit, shardRel, only });
  const n = s => results.filter(r => r.status === s).length;
  const summary = `verify-dates ${today}: checked ${results.length}, confirmed ${n('confirmed')}, corrected ${n('corrected')}, review ${n('review')}, none ${n('none')}, blocked ${n('blocked')}, errors ${n('error')}`;
  if (DRY) { process.stdout.write(section + '\n'); console.log(summary + ' (dry run, nothing written)'); return 0; }
  if (entries.length) writeShard(path.join(root, shardRel), entries);
  writeReport(path.join(root, 'docs', `daily-report-${today}.md`), section, today);
  console.log(summary); if (entries.length) console.log('shard: ' + shardRel); console.log(`report: docs/daily-report-${today}.md (section "Date checks")`);
  return 0;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  /* behind an HTTPS proxy (cloud sessions) Node's fetch needs NODE_USE_ENV_PROXY; on a laptop nothing changes */
  if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY && !argv.includes('--from')) {
    const r = spawnSync(process.execPath, ['--no-warnings', __filename, ...argv], { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } });
    process.exit(r.status == null ? 1 : r.status);
  }
  main(argv).then(code => process.exit(code), e => { console.error(e && e.stack || e); process.exit(1); });
}
module.exports = { run, checkRow, readPage, nameTokens, urlsFor, eventLinks, pick, reportSection, writeReport, writeShard, main, UA, ROBOT_NAMES, MIN_GAP_MS };
