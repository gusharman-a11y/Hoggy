'use strict';
/* End to end, in a real browser: admin sets up a hospital -> doctor joins with the code -> plans a conference trip and asks
   for approval -> manager approves -> doctor adds a receipt and builds the claim pack -> marks it submitted -> finance marks
   it paid -> the doctor's study budget shows it as spent. Runs at 390x844 (phone) and 1280x900 (desktop), fails on any
   console error or horizontal scroll. Not part of npm test (needs Playwright):
     NODE_PATH=/opt/node-tools/node_modules node tests/e2e/hospital-flow.js [screenshot dir]
   It starts its own server on a throwaway SQLite folder. */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process'), path = require('node:path'), fs = require('node:fs'), os = require('node:os'), vm = require('node:vm'), assert = require('node:assert/strict');
const ROOT = path.join(__dirname, '..', '..'), OUT = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'hoggy-shots-'));
fs.mkdirSync(OUT, { recursive: true });
const CONFS = (() => { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data', 'conferences.js'), 'utf8'), ctx); return ctx.window.HOGGY_CONFERENCES; })();
const CONF = CONFS.find(c => c.start >= '2027-04-01' && c.datesConfirmed !== false && c.sourceUrl && /^[A-Za-z0-9 ]+$/.test(c.name) && c.name.length < 60);
const YEAR = CONF.start.slice(0, 4), PW = 'correct-horse-battery';
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

async function startServer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoggy-e2e-')), port = 21000 + Math.floor(Math.random() * 20000);
  const srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', HOGGY_DATA: dir, DATABASE_URL: '', HOGGY_ADMIN_KEY: '', HOGGY_ADMINS: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  const B = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/healthz')).ok) return { B, srv, log: () => log }; } catch (e) { } await new Promise(r => setTimeout(r, 100)); }
  throw new Error('server did not start: ' + log);
}

async function run(browser, B, vp, tag) {
  const phone = vp.width < 900, errors = [], pages = [];
  async function person(name) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, acceptDownloads: true }), p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); }); p.on('pageerror', e => errors.push(`${name}: pageerror ${e.message}`));
    p.on('dialog', d => d.accept()); pages.push(p);
    const email = `${name.toLowerCase().replace(/\W/g, '')}.${tag}.${Date.now()}@example.com`;
    await p.goto(B + '/#/settings'); await p.waitForSelector('.acct-panel [data-act="signin"]');
    await p.click('.acct-panel [data-act="signin"]'); await p.click('#amode');
    await p.fill('#au1', name); await p.fill('#au2', email); await p.fill('#au3', PW); await p.click('#asub');
    await p.waitForSelector('#af', { state: 'detached' }); await p.waitForSelector('.getstarted'); /* sign-up lands on Home's Get started */ await p.evaluate(() => { location.hash = '#/settings'; }); await p.waitForSelector('#hosp form, #hosp [data-testid="hosp-name"]');
    return { p, email, name };
  }
  const noScroll = async (p, where) => {
    const w = await p.evaluate(() => { const wide = []; document.querySelectorAll('body *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed') wide.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} ${Math.round(r.right)}px`); }); return [document.documentElement.scrollWidth, window.innerWidth, wide.slice(0, 6)]; });
    assert.ok(w[0] <= w[1], `${tag} ${where}: horizontal scroll ${w[0]} > ${w[1]} (${w[2].join(', ')})`);
  };
  const go = async (p, hash) => { await p.evaluate(h => { location.hash = h; }, hash); await p.waitForTimeout(250); };
  const openHospPage = async (p, k, label) => { /* phones: from Settings, Your hospital; desktop: the sidebar */
    if (phone) { await go(p, '#/settings'); await p.click(`#hosp a[href="#/${k}"]`); }
    else { await p.click(`#nav a[href="#/${k}"]`); }
    await p.waitForSelector(`h1:text-is("${label}")`); await p.waitForSelector('.loading', { state: 'detached' });
  };

  /* 1. admin sets up the hospital */
  const admin = await person('Dr Ada Admin');
  await admin.p.click('details.hnew summary');
  await admin.p.fill('#hn1', 'Harbour City Hospital'); await admin.p.fill('#hn2', 'claims@harbourcity.example'); await admin.p.fill('#hn3', '5000');
  await admin.p.click('#hnew button[type=submit]'); await admin.p.waitForSelector('[data-testid="join-code"]');
  const code = (await admin.p.textContent('[data-testid="join-code"]')).trim(); assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  await admin.p.waitForSelector('.toast', { state: 'detached' }); await admin.p.locator('#hosp').scrollIntoViewIfNeeded(); await noScroll(admin.p, 'settings');
  await admin.p.screenshot({ path: path.join(OUT, `hospital-settings-${tag}.png`), fullPage: !phone });

  /* 2. colleagues join with the code; the admin gives the manager and finance roles */
  const join = async who => { await who.p.fill('#hj', code.toLowerCase()); await who.p.click('#hjoin button[type=submit]'); await who.p.waitForSelector('[data-testid="hosp-name"]'); assert.equal((await who.p.textContent('[data-testid="hosp-name"]')).trim(), 'Harbour City Hospital'); };
  const doc = await person('Dr Dana Doctor'), mgr = await person('Dr Max Manager'), fin = await person('Fay Finance');
  for (const w of [doc, mgr, fin]) await join(w);
  assert.equal(await doc.p.locator('#hosp a[href="#/approvals"]').count(), 0, 'a doctor gets no Approvals link');
  await admin.p.reload(); await openHospPage(admin.p, 'team', 'Team'); await noScroll(admin.p, 'team');
  for (const [w, role] of [[mgr, 'manager'], [fin, 'finance']]) {
    await admin.p.selectOption(`[data-testid="team-member"][data-email="${w.email}"] select`, role);
    await admin.p.waitForFunction(([e, r]) => { const s = document.querySelector(`[data-testid="team-member"][data-email="${e}"] select`); return s && s.value === r && !document.querySelector('.loading'); }, [w.email, role]);
  }

  /* 3. the doctor plans a conference trip and asks for approval */
  await go(doc.p, '#/discover'); await doc.p.fill('#q', CONF.name); await doc.p.click(`.card[data-id="${CONF.id}"]`);
  await doc.p.click(`.sheet [data-act="plan"][data-id="${CONF.id}"]`); await doc.p.waitForSelector('[data-testid="trip-approval"]');
  await doc.p.click('[data-act="reqapproval"]'); await doc.p.fill('#ap-registration', '1200'); await doc.p.fill('#ap-flights', '650'); await doc.p.fill('#ap-accommodation', '900');
  await doc.p.fill('#ap-note', 'Presenting a poster'); await doc.p.click('#sf button[type=submit]');
  await doc.p.waitForSelector('[data-testid="trip-approval"] .pill.w:text("Awaiting approval")'); await noScroll(doc.p, 'trips');

  /* 4. the manager approves (and cannot see a decision button on their own requests) */
  await mgr.p.reload(); await mgr.p.waitForSelector('#hosp [data-testid="hosp-name"]');
  if (phone) assert.ok(await mgr.p.locator('#nav a[href="#/settings"] .badge').count(), 'Settings carries the badge on phones');
  await openHospPage(mgr.p, 'approvals', 'Approvals');
  const card = mgr.p.locator(`[data-testid="approval-req"][data-doctor="Dr Dana Doctor"]`); await card.waitFor();
  assert.match(await card.textContent(), /\$2,750\.00/); assert.match(await card.textContent(), /Left if approved/);
  await noScroll(mgr.p, 'approvals'); await mgr.p.screenshot({ path: path.join(OUT, `approvals-${tag}.png`), fullPage: !phone });
  await card.locator('[data-act="apdecide"][data-v="approve"]').click(); await mgr.p.waitForSelector('.empty h2:text("Nothing waiting")');

  /* 5. the doctor sees the approval, adds a receipt, builds the claim pack and marks it submitted */
  await doc.p.reload(); await go(doc.p, '#/trips'); await doc.p.waitForSelector('[data-testid="trip-approval"] .pill.g:text("Approved")');
  await doc.p.waitForSelector(`[data-testid="budget-${YEAR}"] dd[data-k="committed"]:text("$2,750.00")`);
  await doc.p.click('[data-act="addreceipt"][data-id]');
  await doc.p.setInputFiles('#rfile', { name: 'registration.pdf', mimeType: 'application/pdf', buffer: PDF });
  await doc.p.fill('#rv1', 'Congress registration'); await doc.p.selectOption('#rv2', 'Registration'); await doc.p.fill('#rv3', '1180.50'); await doc.p.fill('#rv5', CONF.start);
  await doc.p.selectOption('#rv6', { index: 1 }); await doc.p.click('#rf button[type=submit]'); await doc.p.waitForSelector('#rf', { state: 'detached' });
  await go(doc.p, '#/claims'); const email = doc.p.locator('[data-act="emailpack"]'); await email.waitFor();
  assert.match(await email.textContent(), /Email to Harbour City Hospital claims/, 'defaults to the hospital claims email');
  const [dl] = await Promise.all([doc.p.waitForEvent('download'), email.click()]);
  const eml = fs.readFileSync(await dl.path(), 'utf8'); assert.match(eml, /^X-Unsent: 1\r\nTo: claims@harbourcity\.example\r\n/); assert.match(eml, /claim-schedule\.csv/);
  await doc.p.click('[data-act="submitclaim"]'); await doc.p.waitForSelector('[data-testid="claim-hosp"]'); await noScroll(doc.p, 'claims');

  /* 6. finance marks it paid */
  await fin.p.reload(); await fin.p.waitForSelector('#hosp [data-testid="hosp-name"]'); await openHospPage(fin.p, 'finance', 'Finance claims');
  const row = fin.p.locator('[data-testid="fin-claim"][data-doctor="Dr Dana Doctor"]'); await row.waitFor(); assert.match(await row.textContent(), /\$1,180\.50/);
  await noScroll(fin.p, 'finance'); await fin.p.screenshot({ path: path.join(OUT, `finance-claims-${tag}.png`), fullPage: !phone });
  await row.locator('[data-act="markpaid"]').click(); await fin.p.waitForSelector('[data-testid="fin-claim"] .status.paid');

  /* 7. the doctor sees Paid, and the budget shows the claim as spent (committed back to zero) */
  await doc.p.reload(); await go(doc.p, '#/claims'); await doc.p.waitForSelector('[data-testid="claim-hosp"] b:text("Paid")');
  await go(doc.p, '#/home'); const bud = `[data-testid="budget-${YEAR}"]`; await doc.p.waitForSelector(`${bud} dd[data-k="spent"]:text("$1,180.50")`);
  assert.equal((await doc.p.textContent(`${bud} dd[data-k="committed"]`)).trim(), '$0.00'); assert.equal((await doc.p.textContent(`${bud} dd[data-k="remaining"]`)).trim(), '$3,819.50');
  assert.match(await doc.p.textContent('.hosp-home'), /paid by Harbour City Hospital/);
  await noScroll(doc.p, 'home'); await doc.p.locator(bud).scrollIntoViewIfNeeded(); await doc.p.screenshot({ path: path.join(OUT, `budget-${tag}.png`), fullPage: !phone });
  for (const p of pages) await p.context().close();
  return errors;
}

/* the four screenshots named in the brief */
const CANON = { 'hospital-settings-phone.png': 'hospital-settings.png', 'approvals-phone.png': 'approvals-phone.png', 'budget-phone.png': 'budget-phone.png', 'finance-claims-desktop.png': 'finance-claims.png' };
(async () => {
  assert.ok(CONF, 'a confirmed 2027 conference to plan');
  const s = await startServer(), browser = await chromium.launch();
  try {
    for (const [vp, tag] of [[{ width: 390, height: 844 }, 'phone'], [{ width: 1280, height: 900 }, 'desktop']]) {
      const errors = await run(browser, s.B, vp, tag);
      console.log(`${tag} ${vp.width}x${vp.height}: flow passed, console errors: ${errors.length}`); if (errors.length) { console.log(errors.join('\n')); process.exitCode = 1; }
    }
    for (const [a, b] of Object.entries(CANON)) if (a !== b) fs.copyFileSync(path.join(OUT, a), path.join(OUT, b));
    console.log('conference used:', CONF.id, '| screenshots in', OUT);
  } catch (e) { console.error(e); console.error(s.log().slice(-2000)); process.exitCode = 1; } finally { await browser.close(); s.srv.kill(); }
})();
