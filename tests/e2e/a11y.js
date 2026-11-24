'use strict';
/* Accessibility audit: axe-core (devDependency, pinned) on every route at 390x844 and 1280x900, plus the main dialogs.
   Prints violations by impact and exits 1 on any serious or critical one. Not part of npm test:
     NODE_PATH=/opt/node-tools/node_modules node tests/e2e/a11y.js [json report path]
   It starts its own server on a throwaway SQLite folder (with a signed-in run for the account pages). */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process'), path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const ROOT = path.join(__dirname, '..', '..'), AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
const OUT = process.argv[2] || '';

async function startServer(extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoggy-a11y-')), port = 21000 + Math.floor(Math.random() * 20000);
  const srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', HOGGY_DATA: dir, DATABASE_URL: '', HOGGY_ADMIN_KEY: 'a11y-admin-key', HOGGY_ADMINS: 'admin@example.com', ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  const B = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/healthz')).ok) return { B, srv }; } catch (e) { } await new Promise(r => setTimeout(r, 100)); }
  throw new Error('server did not start: ' + log);
}

const HASH_ROUTES = ['#/home', '#/discover', '#/courses', '#/courses/als2', '#/trips', '#/receipts', '#/claims', '#/cpd', '#/settings', '#/certs', '#/list-event'];
const PAGES = ['/privacy', '/terms', '/about', '/nope-404'];

async function axe(p) {
  await p.addScriptTag({ path: AXE });
  return p.evaluate(async () => { const r = await window.axe.run(document, { resultTypes: ['violations'] }); return r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map(n => n.target.join(' ')), count: v.nodes.length })); });
}

(async () => {
  const { B, srv } = await startServer();
  const browser = await chromium.launch();
  const all = [];
  try {
    for (const [tag, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
      const ctx = await browser.newContext({ viewport: vp, bypassCSP: true }), p = await ctx.newPage();
      const check = async (where) => { await p.waitForTimeout(350); for (const v of await axe(p)) all.push({ tag, where, ...v }); };
      await p.goto(B + '/'); await p.waitForSelector('#main h1');
      for (const h of HASH_ROUTES) { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(400); await check(h); }
      /* dialogs: a conference page, sign in */
      await p.evaluate(() => { location.hash = '#/discover'; }); await p.waitForSelector('#results .card');
      await p.click('#results .card'); await p.waitForSelector('#overlay .sheet'); await check('conference dialog');
      await p.keyboard.press('Escape');
      const signin = p.locator('[data-act=signin]:visible').first();
      if (!(await signin.count())) await p.evaluate(() => { location.hash = '#/settings'; }); if (await signin.count()) { await signin.click(); await p.waitForSelector('#af'); await check('sign-in dialog'); await p.keyboard.press('Escape'); }
      for (const u of PAGES) { const r = await p.goto(B + u); if (r && r.status() < 500) await check(u); }
      await ctx.close();
    }
  } finally { await browser.close(); srv.kill(); }
  const by = {}; for (const v of all) by[v.impact] = (by[v.impact] || 0) + 1;
  console.log('axe violations by impact (route x size):', JSON.stringify(by));
  const uniq = new Map(); for (const v of all) { const k = v.impact + ' ' + v.id; const u = uniq.get(k) || { ...v, where: new Set() }; u.where.add(v.tag + ' ' + v.where); uniq.set(k, u); }
  for (const [k, v] of [...uniq].sort()) console.log(`${k}: ${v.help}\n   on ${[...v.where].slice(0, 8).join(', ')}${v.where.size > 8 ? ' …' : ''}\n   e.g. ${v.nodes.join(' | ')}`);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(all, null, 1));
  const bad = all.filter(v => v.impact === 'serious' || v.impact === 'critical');
  console.log(bad.length ? `FAIL: ${bad.length} serious/critical` : 'PASS: 0 serious/critical');
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
