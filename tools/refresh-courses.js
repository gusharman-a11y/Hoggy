#!/usr/bin/env node
'use strict';
/* B48: refresh data/courses/sessions.json from the course providers' own pages.
   Core sources (parsers in tools/courses/): APLS Australia Arlo API, ARC course-dates page, ACRRM course pages, NZDA-posted NZRC CORE events.
   Adds new sessions, refreshes dates/seats/prices/links on known ones (ids kept), drops finished and no-longer-listed ones
   (logged to data/courses/removed-log.json), keeps rows from a source that failed this run.
   x10 sources (data/courses/sources/<name>.*.json, runners in tools/courses/x10/) are then folded in by tools/merge-courses.js
   on every run, so the served files always hold core + every source. With --x10 the source runners are re-read first:
     resus      tools/courses/x10/resus-run.js            ~2 min   (AU/NZ resus, airway, critical care; daily)
     womens-gp  womens-gp-fetch.js + womens-gp-build.js   ~8 min   (women's health, GP skills, AIU ultrasound; daily)
     intl       tools/courses/x10/intl-run.js             ~9 min+  (RCUK, ERC CoSy, RCS England, RCSEd; weekly: slow pagers)
   A runner's output replaces its sources/ file only if the run exited 0 and did not lose more than half the rows held (a layout
   change, not mass cancellations). The whole result is gated with tools/check-courses.js and a report is written to
   docs/research/course-refresh-<date>.md.

   Usage: node tools/refresh-courses.js [--dry] [--today YYYY-MM-DD] [--save DIR] [--from DIR] [--quiet] [--x10 [LIST]] [--x10-weekly]
     --dry         print the diff, write nothing
     --save        also store every raw response in DIR (index.json maps URL -> file); --from replays such a DIR offline
     --x10         also re-read the daily x10 sources (resus, womens-gp); --x10 resus,intl names them
     --x10-weekly  the daily set plus intl (run it once a week, e.g. Mondays)
     (without --x10 the sources/ files are merged as they are; --from never runs the x10 sources)
   Exit codes: 0 ok, 1 check-courses failed (nothing written), 2 every core source failed. */
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
const MC = require('./merge-courses'), CC = require('./check-courses');

const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data', 'courses');
const today = opt('--today') || new Date().toISOString().slice(0, 10);
const DRY = flag('--dry'), QUIET = flag('--quiet'), SAVE = opt('--save'), FROM = opt('--from');
const log = m => { if (!QUIET) console.error(m); };
const X10_DAILY = ['resus', 'womens-gp'], X10_ALL = ['resus', 'womens-gp', 'intl'];
const x10i = args.indexOf('--x10'), x10Arg = x10i >= 0 && args[x10i + 1] && !args[x10i + 1].startsWith('--') ? args[x10i + 1].split(',') : null;
const X10 = FROM ? [] : flag('--x10-weekly') ? X10_ALL : x10i >= 0 ? (x10Arg || X10_DAILY) : [];
for (const n of X10) if (!X10_ALL.includes(n)) { console.error('unknown x10 source ' + n + ' (known: ' + X10_ALL.join(', ') + ')'); process.exit(2); }

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

/* x10 runners: each writes to a temp dir; the result is used (and, unless --dry, copied into data/courses/sources/) only when
   the run exited 0 and kept at least half the sessions the source file held */
function runX10(name, tmp) {
  const X = path.join(__dirname, 'courses', 'x10'), out = path.join(tmp, name), node = (f, a) => spawnSync(process.execPath, [path.join(X, f), ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60 * 60e3 });
  fs.mkdirSync(out, { recursive: true });
  let r;
  if (name === 'resus') r = node('resus-run.js', ['--today', today, '--out', path.join(out, 'resus.sessions.json')]);
  else if (name === 'intl') r = node('intl-run.js', ['--today', today, '--out', path.join(out, 'intl.sessions.json')]);
  else if (name === 'womens-gp') { const cache = path.join(tmp, 'wgp-cache'); r = node('womens-gp-fetch.js', ['--out', cache, '--today', today]); if (r.status === 0) r = node('womens-gp-build.js', ['--cache', cache, '--out', out, '--today', today]); }
  const held = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')).sessions.length; } catch (e) { return 0; } };
  const nf = path.join(out, name + '.sessions.json'), of = path.join(DATA, 'sources', name + '.sessions.json'), n = held(nf), o = held(of);
  const tail = String((r && (r.stderr || r.stdout)) || '').trim().split('\n').slice(-2).join(' / ').slice(0, 200);
  if (!r || r.status !== 0 || !fs.existsSync(nf)) return { name, status: `failed (exit ${r ? r.status : '?'}): ${tail}; kept the held file (${o} sessions)` };
  if (o >= 10 && n < o * 0.5) return { name, status: `suspicious: ${n} sessions vs ${o} held; kept the held file` };
  return { name, status: 'ok', sessions: n, held: o, dir: out };
}

const fmt = v => v == null ? '—' : typeof v === 'string' ? (v.length > 90 ? v.slice(0, 87) + '…' : v) : JSON.stringify(v);
const md = s => String(s).replace(/\|/g, '\\|');
function reportMd(r) {
  const L = [];
  L.push(`# Course refresh ${today}`, '', `Run: \`node tools/refresh-courses.js${DRY ? ' --dry' : ''}\`${FROM ? ' (replayed from saved responses)' : ''}. Sessions before: ${r.before}, after: ${r.after}. Added ${r.m.added.length}, updated ${r.m.updated.length}, unchanged ${r.m.unchanged.length}, removed ${r.m.removed.length}, kept from failed sources ${r.m.kept.length}.`, '');
  L.push(`check-courses: ${r.check}`, '', '## Sources', '', '| Source | Status | Rows read | Sessions | URL |', '|---|---|---|---|---|');
  for (const s of r.report) L.push(`| ${md(s.name)} | ${md(s.status)} | ${s.items ?? '—'} | ${s.sessions ?? '—'} | ${s.url.split(' ').map(u => `<${u}>`).join(' ')} |`);
  if (r.x10 && r.x10.length) { L.push('', '## x10 source runs', '', '| Source | Status | Sessions (new file / held) |', '|---|---|---|'); for (const x of r.x10) L.push(`| ${x.name} | ${md(x.status)} | ${x.sessions != null ? x.sessions + ' / ' + x.held : '—'} |`); }
  if (r.merged) L.push('', `merge-courses: ${md(MC.summaryLine(r.merged))}`);
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
  /* core rows only: tools/merge-courses.js adds the x10 rows again below, and an update it applied (price from a centre's
     Arlo platform) is undone first so the core diff does not report it every day */
  const core = ses.sessions.filter(s => !s.fromSource).map(s => { if (!s.appliedUpdate) return s; const r = { ...s, ...s.appliedUpdate.prior }; delete r.appliedUpdate; delete r.providerEvidence; return r; });
  const known = new Set(cat.courses.map(c => c.id));
  const { fresh, read, report } = await readSources(fetcher(), core);
  if (!read.size) { console.error('every source failed; nothing changed'); for (const s of report) console.error(`  ${s.name}: ${s.status}`); process.exit(2); }
  const dropped = fresh.filter(s => !known.has(s.courseId)), usable = fresh.filter(s => known.has(s.courseId));
  const m = merge(core, usable, { today, readSources: read, sourceKeyOf });

  /* x10 sources: optional re-read, then always merged */
  const tmpX = fs.mkdtempSync(path.join(os.tmpdir(), 'courses-x10-')), x10 = [];
  for (const n of X10) { log('x10: running ' + n); x10.push(runX10(n, tmpX)); }
  const sources = MC.readSources(DATA).map(src => {
    const x = x10.find(y => y.name === src.name && y.status === 'ok'); if (!x) return src;
    const rd = k => { const f = path.join(x.dir, `${src.name}.${k}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
    const c = rd('catalogue'), sj = rd('sessions');
    return { ...src, courses: c ? c.courses : src.courses, sessions: sj.sessions || [], updates: sj.updates || [], generated: sj.generated };
  });
  const fixes = fs.existsSync(path.join(DATA, 'fixes.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'fixes.json'), 'utf8')) : null;
  const mc = MC.mergeSources({ catalogue: cat, sessions: { ...ses, sessions: m.sessions }, sources, today, fixes, log });
  const out = mc.sessions, outCat = mc.catalogue;

  /* gate: the checker on the whole result before touching the real files */
  const chkR = CC.check({ catalogue: outCat, sessions: out, today });
  const chk = { ok: !chkR.errors.length, line: `courses: ${outCat.courses.length}, sessions: ${out.sessions.length}, errors: ${chkR.errors.length}, warnings: ${chkR.warnings.length}`, out: chkR.errors.slice(0, 40).join('\n') };
  const r = { before: ses.sessions.length, after: out.sessions.length, m, report, dropped, x10, merged: mc.report, check: chk.ok ? chk.line : 'FAILED: ' + chk.line };
  const text = reportMd(r);

  const summary = `refresh ${today}: core added ${m.added.length}, updated ${m.updated.length}, unchanged ${m.unchanged.length}, removed ${m.removed.length}, kept ${m.kept.length} (failed sources: ${report.filter(s => s.status !== 'ok').map(s => s.name).concat(x10.filter(x => x.status !== 'ok').map(x => 'x10 ' + x.name)).join(', ') || 'none'}); ${r.check}`;
  const done = code => { fs.rmSync(tmpX, { recursive: true, force: true }); process.exitCode = code; }; /* exitCode, not exit(): a piped stdout is flushed first */
  if (DRY) { process.stdout.write(text); console.log(summary); return done(chk.ok ? 0 : 1); }
  if (!chk.ok) { console.error(chk.out); console.error('check-courses failed on the refreshed data; nothing written'); return done(1); }

  for (const x of x10.filter(y => y.status === 'ok')) for (const f of fs.readdirSync(x.dir)) if (f.endsWith('.json')) fs.copyFileSync(path.join(x.dir, f), path.join(DATA, 'sources', f));
  fs.writeFileSync(path.join(DATA, 'catalogue.json'), JSON.stringify(outCat, null, 1) + '\n');
  fs.writeFileSync(sesFile, JSON.stringify(out, null, 1) + '\n');
  const logFile = path.join(DATA, 'removed-log.json');
  const lg = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : { note: 'Sessions dropped by tools/refresh-courses.js (newest last).', entries: [] };
  for (const s of m.removed) lg.entries.push({ removedOn: today, reason: s.reason, id: s.id, courseId: s.courseId, variant: s.variant, provider: s.provider, city: s.city, region: s.region, country: s.country, start: s.start, end: s.end, sourceUrl: s.sourceUrl, datesQuote: s.datesQuote });
  lg.entries = lg.entries.slice(-5000);
  fs.writeFileSync(logFile, JSON.stringify(lg, null, 1) + '\n');
  const rep = path.join(ROOT, 'docs', 'research', `course-refresh-${today}.md`);
  fs.writeFileSync(rep, text);
  console.log(summary); console.log('report: ' + path.relative(ROOT, rep));
  return done(0);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
