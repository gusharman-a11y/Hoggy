#!/usr/bin/env node
'use strict';
/* B48: refresh data/courses/sessions.json from the course providers' own pages.
   Sources (parsers in tools/courses/): APLS Australia Arlo API, ARC course-dates page, ACRRM course pages, NZDA-posted NZRC CORE events.
   Adds new sessions, refreshes dates/seats/prices/links on known ones (ids kept), drops finished and no-longer-listed ones
   (logged to data/courses/removed-log.json), keeps rows from a source that failed this run, gates the result with
   tools/check-courses.js and writes docs/research/course-refresh-<date>.md.

   Usage: node tools/refresh-courses.js [--dry] [--today YYYY-MM-DD] [--save DIR] [--from DIR] [--quiet]
     --dry    print the diff, write nothing
     --save   also store every raw response in DIR (index.json maps URL -> file); --from replays such a DIR offline
   Exit codes: 0 ok, 1 check-courses failed (nothing written), 2 every source failed. */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2), flag = f => args.includes(f), opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

/* behind an HTTPS proxy (cloud sessions) Node's fetch needs NODE_USE_ENV_PROXY; on a laptop nothing changes */
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY && !opt('--from')) {
  const r = spawnSync(process.execPath, ['--no-warnings', __filename, ...args], { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } });
  process.exit(r.status == null ? 1 : r.status);
}

const { makeClient, BlockedError } = require('./courses/http');
const arlo = require('./courses/arlo'), arc = require('./courses/arc'), acrrm = require('./courses/acrrm'), nzda = require('./courses/nzda');
const { merge } = require('./courses/merge');

const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data', 'courses');
const today = opt('--today') || new Date().toISOString().slice(0, 10);
const DRY = flag('--dry'), QUIET = flag('--quiet'), SAVE = opt('--save'), FROM = opt('--from');
const log = m => { if (!QUIET) console.error(m); };

/* fetcher: network (polite) or a saved directory */
const fname = u => crypto.createHash('sha1').update(u).digest('hex').slice(0, 12) + (/\/api\//.test(u) ? '.json' : '.html');
function fetcher() {
  if (FROM) {
    const idx = JSON.parse(fs.readFileSync(path.join(FROM, 'index.json'), 'utf8'));
    return { get: async u => { if (!idx[u]) throw new Error('not in saved set: ' + u); return fs.readFileSync(path.join(FROM, idx[u]), 'utf8'); } };
  }
  const c = makeClient({ log });
  if (!SAVE) return c;
  fs.mkdirSync(SAVE, { recursive: true });
  const ip = path.join(SAVE, 'index.json'), idx = fs.existsSync(ip) ? JSON.parse(fs.readFileSync(ip, 'utf8')) : {};
  return { get: async u => { const b = await c.get(u); idx[u] = fname(u); fs.writeFileSync(path.join(SAVE, idx[u]), b); fs.writeFileSync(ip, JSON.stringify(idx, null, 1)); return b; } };
}

/* which source an existing row came from (for "source failed -> keep its rows") */
function sourceKeyOf(s) {
  const u = String(s.sourceUrl || '');
  if (u.startsWith('https://apls.arlo.co/')) return 'arlo';
  if (u === arc.SOURCE_URL) return 'arc';
  if (u.startsWith('https://www.acrrm.org.au/')) return 'acrrm:' + u;
  if (u.startsWith(nzda.BASE)) return 'nzda:' + u;
  return 'other:' + u;
}

async function readSources(http, oldSessions) {
  const fresh = [], read = new Set(), report = [];
  const oldCount = key => oldSessions.filter(s => sourceKeyOf(s) === key && s.end >= today).length;
  const note = (name, url, status, extra) => report.push({ name, url, status, ...extra });
  /* a parse that suddenly finds far fewer sessions than we hold is treated as a layout change, not as cancellations */
  const sane = (key, n) => { const o = oldCount(key); return !(o >= 10 && n < o * 0.5); };
  const fail = (e) => (e instanceof BlockedError ? `blocked (${e.code}): ` : 'failed: ') + e.message;

  // APLS (Arlo)
  try {
    let body = JSON.parse(await http.get(arlo.SOURCE_URL)), items = body.Items || [];
    while (body.Count > items.length && items.length < 2000) {
      body = JSON.parse(await http.get(arlo.SOURCE_URL + '&skip=' + items.length));
      if (!(body.Items || []).length) break; items = items.concat(body.Items);
    }
    const r = arlo.parse({ Items: items, Count: body.Count }, { today });
    if (!sane('arlo', r.sessions.length)) note('APLS Australia (Arlo API)', arlo.SOURCE_URL, `suspicious: ${r.sessions.length} sessions vs ${oldCount('arlo')} held; kept old rows`);
    else { fresh.push(...r.sessions); read.add('arlo'); note('APLS Australia (Arlo API)', arlo.SOURCE_URL, 'ok', { items: items.length, sessions: r.sessions.length, skipped: r.skipped.filter(x => x.reason !== 'finished') }); }
  } catch (e) { note('APLS Australia (Arlo API)', arlo.SOURCE_URL, fail(e)); }

  // ARC
  try {
    const r = arc.parse(await http.get(arc.SOURCE_URL), { today });
    if (!sane('arc', r.sessions.length)) note('ARC course-dates page', arc.SOURCE_URL, `suspicious: ${r.sessions.length} sessions vs ${oldCount('arc')} held; kept old rows`);
    else { fresh.push(...r.sessions); read.add('arc'); note('ARC course-dates page', arc.SOURCE_URL, 'ok', { items: r.rows, sessions: r.sessions.length, skipped: r.skipped }); }
  } catch (e) { note('ARC course-dates page', arc.SOURCE_URL, fail(e)); }

  // ACRRM (one page per course)
  for (const p of acrrm.PAGES) {
    const url = acrrm.BASE + p, key = 'acrrm:' + url;
    try {
      const r = acrrm.parse(await http.get(url), { today, sourceUrl: url });
      if (!sane(key, r.sessions.length)) note('ACRRM ' + p, url, `suspicious: ${r.sessions.length} sessions vs ${oldCount(key)} held; kept old rows`);
      else { fresh.push(...r.sessions); read.add(key); note('ACRRM ' + p, url, 'ok', { items: r.rows, sessions: r.sessions.length, skipped: r.skipped.filter(x => x.reason !== 'course not in scope') }); }
    } catch (e) { note('ACRRM ' + p, url, fail(e)); }
  }

  // NZDA (NZRC CORE events posted by providers)
  try {
    const urls = new Set();
    for (const s of nzda.SEARCHES) for (const u of nzda.parseSearch(await http.get(s))) urls.add(u);
    const failed = new Set(), skipped = [];
    let n = 0;
    for (const u of urls) {
      try { const r = nzda.parseEvent(await http.get(u), u, { today }); if (r.session) { fresh.push(r.session); n++; } else skipped.push(r.skip); }
      catch (e) { failed.add(u); skipped.push({ reason: fail(e), url: u }); }
    }
    for (const s of oldSessions) if (sourceKeyOf(s).startsWith('nzda:') && !failed.has(s.sourceUrl)) read.add(sourceKeyOf(s));
    note('NZDA course portal (NZRC CORE)', nzda.SEARCHES.join(' '), 'ok', { items: urls.size, sessions: n, skipped });
  } catch (e) { note('NZDA course portal (NZRC CORE)', nzda.SEARCHES.join(' '), fail(e)); }

  return { fresh, read, report };
}

const fmt = v => v == null ? '—' : typeof v === 'string' ? (v.length > 90 ? v.slice(0, 87) + '…' : v) : JSON.stringify(v);
const md = s => String(s).replace(/\|/g, '\\|');
function reportMd(r) {
  const L = [];
  L.push(`# Course refresh ${today}`, '', `Run: \`node tools/refresh-courses.js${DRY ? ' --dry' : ''}\`${FROM ? ' (replayed from saved responses)' : ''}. Sessions before: ${r.before}, after: ${r.after}. Added ${r.m.added.length}, updated ${r.m.updated.length}, unchanged ${r.m.unchanged.length}, removed ${r.m.removed.length}, kept from failed sources ${r.m.kept.length}.`, '');
  L.push(`check-courses: ${r.check}`, '', '## Sources', '', '| Source | Status | Rows read | Sessions | URL |', '|---|---|---|---|---|');
  for (const s of r.report) L.push(`| ${md(s.name)} | ${md(s.status)} | ${s.items ?? '—'} | ${s.sessions ?? '—'} | ${s.url.split(' ').map(u => `<${u}>`).join(' ')} |`);
  const sk = r.report.flatMap(s => (s.skipped || []).map(x => `- ${s.name}: ${md(JSON.stringify(x))}`));
  if (sk.length) L.push('', '### Rows not used', '', ...sk);
  if (r.dropped.length) L.push('', '### Sessions for courses not in the catalogue (not added)', '', ...r.dropped.map(s => `- ${s.courseId}: ${s.datesQuote}`));
  const by = list => { const c = {}; for (const s of list) c[s.courseId] = (c[s.courseId] || 0) + 1; return Object.entries(c).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'; };
  L.push('', `## Added (${r.m.added.length}: ${by(r.m.added)})`, '');
  for (const s of r.m.added) L.push(`- \`${s.id}\` ${s.start}${s.end !== s.start ? '–' + s.end : ''} ${s.city} ${s.region} · ${s.provider}`);
  L.push('', `## Updated (${r.m.updated.length})`, '');
  for (const u of r.m.updated) L.push(`- \`${u.id}\`: ` + Object.entries(u.changes).map(([k, [a, b]]) => `${k} ${md(fmt(a))} → ${md(fmt(b))}`).join('; '));
  L.push('', `## Removed (${r.m.removed.length}; logged in data/courses/removed-log.json)`, '');
  for (const s of r.m.removed) L.push(`- \`${s.id}\` ${s.start} ${s.city} ${s.region}: ${s.reason}`);
  if (r.m.kept.length) L.push('', `## Kept unchanged because their source failed (${r.m.kept.length})`, '', ...r.m.kept.map(s => `- \`${s.id}\` (${s.sourceUrl})`));
  return L.join('\n') + '\n';
}

function runCheck(dir) {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'check-courses.js'), '--today', today, ...(dir ? ['--dir', dir] : [])], { encoding: 'utf8' });
  const last = (r.stdout.trim().split('\n').pop() || '').trim();
  return { ok: r.status === 0, line: last, out: r.stdout + r.stderr };
}

(async () => {
  const cat = JSON.parse(fs.readFileSync(path.join(DATA, 'catalogue.json'), 'utf8'));
  const sesFile = path.join(DATA, 'sessions.json'), ses = JSON.parse(fs.readFileSync(sesFile, 'utf8'));
  const known = new Set(cat.courses.map(c => c.id));
  const { fresh, read, report } = await readSources(fetcher(), ses.sessions);
  if (!read.size) { console.error('every source failed; nothing changed'); for (const s of report) console.error(`  ${s.name}: ${s.status}`); process.exit(2); }
  const dropped = fresh.filter(s => !known.has(s.courseId)), usable = fresh.filter(s => known.has(s.courseId));
  const m = merge(ses.sessions, usable, { today, readSources: read, sourceKeyOf });
  const out = { ...ses, generated: today, sessions: m.sessions };

  /* gate: run the checker on a temp copy before touching the real files */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'courses-refresh-'));
  fs.copyFileSync(path.join(DATA, 'catalogue.json'), path.join(tmp, 'catalogue.json'));
  fs.writeFileSync(path.join(tmp, 'sessions.json'), JSON.stringify(out, null, 1) + '\n');
  const chk = runCheck(tmp); fs.rmSync(tmp, { recursive: true, force: true });
  const r = { before: ses.sessions.length, after: m.sessions.length, m, report, dropped, check: chk.ok ? chk.line : 'FAILED: ' + chk.line };
  const text = reportMd(r);

  const summary = `refresh ${today}: added ${m.added.length}, updated ${m.updated.length}, unchanged ${m.unchanged.length}, removed ${m.removed.length}, kept ${m.kept.length} (failed sources: ${report.filter(s => s.status !== 'ok').map(s => s.name).join(', ') || 'none'}); ${r.check}`;
  if (DRY) { process.stdout.write(text); console.log(summary); process.exit(chk.ok ? 0 : 1); }
  if (!chk.ok) { console.error(chk.out); console.error('check-courses failed on the refreshed data; nothing written'); process.exit(1); }

  fs.writeFileSync(sesFile, JSON.stringify(out, null, 1) + '\n');
  const logFile = path.join(DATA, 'removed-log.json');
  const lg = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : { note: 'Sessions dropped by tools/refresh-courses.js (newest last).', entries: [] };
  for (const s of m.removed) lg.entries.push({ removedOn: today, reason: s.reason, id: s.id, courseId: s.courseId, variant: s.variant, provider: s.provider, city: s.city, region: s.region, country: s.country, start: s.start, end: s.end, sourceUrl: s.sourceUrl, datesQuote: s.datesQuote });
  lg.entries = lg.entries.slice(-5000);
  fs.writeFileSync(logFile, JSON.stringify(lg, null, 1) + '\n');
  const rep = path.join(ROOT, 'docs', 'research', `course-refresh-${today}.md`);
  fs.writeFileSync(rep, text);
  console.log(summary); console.log('report: ' + path.relative(ROOT, rep));
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
