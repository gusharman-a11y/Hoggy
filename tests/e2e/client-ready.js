'use strict';
/* End to end, in a real browser (client-ready, Nov 2026), at 390x844 and 1280x900:
   first run signed out (hero search, no account) -> keyboard only: skip link, search, open a conference, focus stays in the
   dialog, Escape returns focus -> Report a problem with this listing -> List your event (errors, then sent) -> sign up with
   specialty, country and state -> Get started checklist -> account pages -> server-rendered public pages and the 404 page ->
   the admin desk approves the submitted event (desktop) -> a dark-theme pass -> the site with the database down.
   axe-core (devDependency) runs on every page and dialog: 0 serious or critical violations allowed. Fails on any console error
   (with the database down, only the expected 503 responses are allowed) or horizontal scroll. Not part of npm test:
     NODE_PATH=/opt/node-tools/node_modules node tests/e2e/client-ready.js [screenshot dir]
   Starts its own servers (throwaway SQLite folder; a closed port as the "down" database). */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process'), path = require('node:path'), fs = require('node:fs'), os = require('node:os'), assert = require('node:assert/strict');
const ROOT = path.join(__dirname, '..', '..'), OUT = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'hoggy-shots-'));
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
fs.mkdirSync(OUT, { recursive: true });
const ADMIN_KEY = 'e2e-admin-key';

async function startServer(extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoggy-e2e-')), port = 21000 + Math.floor(Math.random() * 20000);
  const srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', HOGGY_DATA: dir, DATABASE_URL: '', HOGGY_ADMIN_KEY: ADMIN_KEY, HOGGY_ADMINS: 'admin@example.com', ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  const B = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 150; i++) { try { const r = await fetch(B + (extra.DATABASE_URL ? '/robots.txt' : '/healthz')); if (r.ok) return { B, srv }; } catch (e) { } await new Promise(r => setTimeout(r, 100)); }
  throw new Error('server did not start: ' + log);
}
const addDays = (iso, n) => { const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const TODAY = new Date().toISOString().slice(0, 10);
const axeLog = [];

async function session(browser, B, vp, tag, opts = {}) {
  const errors = [], ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, bypassCSP: true, colorScheme: opts.dark ? 'dark' : 'light' }), p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error' && !(opts.allow && opts.allow.test(m.text()))) errors.push(m.text()); }); p.on('pageerror', e => errors.push('pageerror ' + e.message));
  p.on('dialog', d => d.type() === 'prompt' ? d.accept(ADMIN_KEY) : d.accept());
  const noScroll = async where => {
    const w = await p.evaluate(() => { const wide = []; document.querySelectorAll('body *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('.grid.ex,.chips,.selects,.hp')) wide.push(e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]); }); return [document.documentElement.scrollWidth, innerWidth, wide.slice(0, 5)]; });
    assert.ok(w[0] <= w[1], `${tag} ${where}: horizontal scroll ${w[0]} > ${w[1]} (${w[2].join(', ')})`);
  };
  const axe = async where => {
    await p.waitForTimeout(250); await p.addScriptTag({ path: AXE });
    const v = await p.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.map(x => ({ id: x.id, impact: x.impact, nodes: x.nodes.slice(0, 3).map(n => n.target.join(' ')) })));
    for (const x of v) axeLog.push({ tag, where, ...x });
    const bad = v.filter(x => x.impact === 'serious' || x.impact === 'critical');
    assert.equal(bad.length, 0, `${tag} ${where}: axe ${JSON.stringify(bad)}`);
  };
  const check = async where => { await noScroll(where); await axe(where); };
  const go = async hash => { await p.evaluate(h => { location.hash = h; }, hash); await p.waitForTimeout(300); };
  const shot = (name, full) => p.screenshot({ path: path.join(OUT, name), fullPage: !!full });
  const focusInOverlay = () => p.evaluate(() => { const o = document.getElementById('overlay'); return !o.hidden && o.contains(document.activeElement); });
  /* a visible focus indicator: an outline, or the accent border the inputs use, or the card outline around a title link */
  const focusShows = () => p.evaluate(() => {
    const el = document.activeElement; if (!el || el === document.body) return false;
    const vis = n => { const s = getComputedStyle(n); return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none'; };
    const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const border = n => { const c = getComputedStyle(n).borderTopColor, t = document.createElement('i'); t.style.color = acc; document.body.appendChild(t); const a = getComputedStyle(t).color; t.remove(); return c === a; };
    return vis(el) || border(el) || (el.closest('.card') && vis(el.closest('.card'))) || (el.closest('.search') && border(el.closest('.search'))) || (el.closest('.snap-btn') && vis(el.closest('.snap-btn')));
  });
  return { ctx, p, errors, noScroll, axe, check, go, shot, focusInOverlay, focusShows };
}

async function run(browser, B, vp, tag) {
  const phone = tag === 'phone', S = await session(browser, B, vp, tag), { p } = S;

  /* 1. signed out, Home: a clear path without an account */
  await p.goto(B + '/'); await p.waitForSelector('.hero-intro');
  assert.equal(await p.title(), 'Hoggy · Medical conferences and courses');
  assert.match(await p.textContent('.hero-intro'), /No sign-up needed/);
  await p.waitForSelector('.hero-intro [data-act="register"]'); /* once the app has reached the server */
  assert.equal(await p.locator('.app-foot a[href="/privacy"]').count(), 1, 'footer links');
  await S.check('home'); if (phone) await S.shot('cr-home-phone.png');

  /* 2. keyboard only: skip link, hero search, a conference card, the dialog keeps focus, Escape returns it */
  await p.keyboard.press('Tab'); assert.equal(await p.evaluate(() => document.activeElement.className), 'skip', 'first Tab reaches the skip link');
  await p.keyboard.press('Enter'); assert.equal(await p.evaluate(() => document.activeElement.id), 'main');
  let found = false;
  for (let i = 0; i < 40 && !found; i++) { await p.keyboard.press('Tab'); found = await p.evaluate(() => document.activeElement.id === 'hq'); assert.ok(await S.focusShows(), `${tag}: focus visible on tab ${i}`); }
  assert.ok(found, 'the hero search is reachable by keyboard');
  await p.keyboard.type('cardiology'); await p.keyboard.press('Enter'); await p.waitForSelector('#results .card-link');
  assert.equal(await p.inputValue('#q'), 'cardiology'); assert.match(await p.textContent('#count'), /\d+ result/);
  await p.focus('#q'); found = false;
  for (let i = 0; i < 120 && !found; i++) { await p.keyboard.press('Tab'); found = await p.evaluate(() => document.activeElement.matches('#results .card-link')); }
  assert.ok(found, 'a conference link is reachable by keyboard'); assert.ok(await S.focusShows(), 'focus visible on the card');
  const confName = await p.evaluate(() => document.activeElement.textContent), confId = await p.evaluate(() => document.activeElement.dataset.id);
  await p.keyboard.press('Enter'); await p.waitForSelector('#overlay .sheet h2');
  assert.equal((await p.textContent('#overlay .sheet h2')).trim(), confName.trim());
  assert.ok(await S.focusInOverlay(), 'focus moves into the dialog');
  for (let i = 0; i < 60; i++) { await p.keyboard.press('Tab'); assert.ok(await S.focusInOverlay(), `${tag}: Tab ${i} stayed in the dialog`); }
  await p.keyboard.press('Shift+Tab'); assert.ok(await S.focusInOverlay());
  await S.check('conference dialog');
  await p.keyboard.press('Escape'); await p.waitForSelector('#overlay', { state: 'hidden' });
  assert.equal(await p.evaluate(() => document.activeElement.dataset.id), confId, 'Escape returns focus to the card');

  /* 3. Report a problem with this listing (signed out) */
  await p.keyboard.press('Enter'); await p.waitForSelector('#overlay [data-act="report"]');
  await p.click('#overlay [data-act="report"]'); await p.waitForSelector('#rpf');
  assert.ok(await S.focusInOverlay()); await S.check('report dialog');
  await p.click('#rpf button[type=submit]'); assert.match(await p.textContent('#rperr'), /Choose what is wrong/);
  await p.check('#rpf input[value="wrong-date"]'); await p.fill('#rpn', 'The organiser page now gives different dates');
  await p.click('#rpf button[type=submit]'); await p.waitForSelector('.toast:text("Report sent")');
  await p.waitForSelector('#overlay .sheet h2'); await p.keyboard.press('Escape');

  /* 4. List your event: errors at the field, then sent */
  await S.go('#/list-event'); await p.waitForSelector('#lef'); assert.equal(await p.title(), 'List your event · Hoggy');
  await S.check('list your event');
  await p.click('#le-send'); await p.waitForSelector('#le-err:not(:empty)');
  assert.match(await p.textContent('#le-err'), /Add the event name/); assert.equal(await p.evaluate(() => document.activeElement.id), 'le-name', 'focus on the first problem');
  await S.axe('list your event, with an error');
  const start = addDays(TODAY, 150 + (phone ? 0 : 7)), end = addDays(start, 2);
  await p.selectOption('#le-kind', 'conference'); await p.fill('#le-name', `Harbour Emergency Medicine Forum ${tag} ${start.slice(0, 4)}`); await p.fill('#le-organiser', 'Harbour Emergency Physicians Society');
  await p.fill('#le-url', `https://hems.example.org/forum-${tag}-${start.slice(0, 4)}`); await p.fill('#le-start', start); await p.fill('#le-end', end);
  await p.fill('#le-city', 'Wollongong'); await p.selectOption('#le-countryCode', 'AU'); await p.selectOption('#le-specialty', 'Emergency Medicine'); await p.selectOption('#le-format', 'Hybrid');
  await p.fill('#le-cpdHours', '10'); await p.fill('#le-cpdBody', 'ACEM'); await p.fill('#le-contactEmail', `organiser-${tag}@hems.example.org`);
  await p.click('#le-send'); assert.match(await p.textContent('#le-err'), /authorised/); await p.check('#le-authorised');
  if (phone) await S.shot('cr-submit-phone.png', true);
  await p.click('#le-send'); await p.waitForSelector('#leDone'); assert.equal(await p.evaluate(() => document.activeElement.id), 'leDone');
  await S.check('list your event, sent');

  /* 5. sign up: name, email, password, specialty, country and state; then the Get started checklist */
  await S.go('#/home'); await p.click('.hero-intro [data-act="register"]'); await p.waitForSelector('#au4');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'au1', 'focus on the first field'); await S.check('sign-up dialog');
  await p.fill('#au1', 'Dr Ana Tanaka'); await p.fill('#au2', `ana-${tag}-${Date.now()}@example.com`); await p.fill('#au3', 'correct-horse-battery');
  await p.selectOption('#au4', 'Emergency Medicine'); await p.selectOption('#au5', 'New Zealand'); await p.waitForSelector('#au6'); await p.selectOption('#au6', 'Wellington');
  await p.selectOption('#au5', 'Australia'); await p.waitForSelector('#au6 option:text("QLD")', { state: 'attached' }); await p.selectOption('#au6', 'QLD');
  await p.click('#asub'); await p.waitForSelector('.getstarted');
  assert.match(await p.textContent('.hero-dash h1'), /^Welcome, Ana\./);
  assert.match(await p.textContent('.getstarted'), /1 of 4 done/); assert.match(await p.textContent('.getstarted'), /Emergency Medicine/);
  await S.check('get started'); if (phone) await S.shot('cr-getstarted-phone.png');
  /* save a conference and plan a trip from Discover: the checklist follows */
  await S.go('#/discover'); await p.waitForSelector('#results .card');
  await p.click('#results .card .save'); await p.click('#results .card-link'); await p.click('#overlay [data-act="plan"]'); await p.waitForSelector('#main h1:text("Trips")');
  await S.go('#/home'); assert.match(await p.textContent('.getstarted'), /3 of 4 done/);
  await S.go('#/courses'); await p.waitForSelector('#cPlace', { state: 'attached' }); /* on phones the selects sit in the filter sheet */ assert.equal(await p.inputValue('#cPlace'), 'AU', 'Courses default to the sign-up country');
  await S.go('#/settings'); assert.equal(await p.inputValue('#prg'), 'QLD', 'state from sign-up'); assert.equal(await p.inputValue('#ps'), 'Emergency Medicine');
  for (const h of ['#/trips', '#/receipts', '#/claims', '#/cpd', '#/settings', '#/certs', '#/courses/als2']) { await S.go(h); await p.waitForSelector('#main h1'); await S.check(h); }
  assert.ok(await p.locator('[data-act="report"][data-kind="course"]').count(), 'course page: report a problem');
  await S.go('#/home'); await p.click('[data-act="dismissonboard"]'); await p.waitForSelector('.getstarted', { state: 'detached' });

  /* 6. server-rendered public pages, the 404 page */
  for (const [u, h] of [['/privacy', 'Privacy'], ['/terms', 'Terms of use'], ['/about', 'About Hoggy'], ['/conferences/' + confId, null], ['/courses/als2', null], ['/no-such-page', 'Page not found']]) {
    const before = S.errors.length, r = await p.goto(B + u); assert.equal(r.status(), u === '/no-such-page' ? 404 : 200, u);
    if (u === '/no-such-page') { await p.waitForTimeout(200); const extra = S.errors.splice(before); assert.ok(extra.every(x => /status of 404/.test(x)), 'only the 404 itself: ' + extra); } /* the browser logs the page's own 404 status */
    if (h) assert.equal((await p.textContent('h1')).trim(), h);
    assert.ok(await p.locator('.site-foot a[href="/terms"]').count(), u + ': footer'); await S.check(u);
    if (u === '/privacy' && phone) await S.shot('cr-privacy-phone.png');
  }
  await p.goto(B + '/conferences/' + confId); await p.click('a[href^="/#/report/conference/"]'); await p.waitForSelector('#rpf'); await S.axe('report from the conference page');
  assert.deepEqual(S.errors, [], `${tag}: console errors`);
  await S.ctx.close();
}

async function adminDesk(browser, B) {
  const S = await session(browser, B, { width: 1280, height: 900 }, 'desktop'), { p } = S;
  await p.goto(B + '/');
  assert.equal(await p.evaluate(async () => (await fetch('/api/register', { method: 'POST', headers: { 'X-Requested-With': 'hoggy', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.com', password: 'correct-horse-battery', name: 'Admin' }) })).status), 201);
  await p.goto(B + '/admin.html'); await p.waitForSelector('#subs form.sub');
  assert.match(await p.textContent('#subs h3'), /2 submitted events to check/);
  const f = p.locator('#subs form.sub').first(); assert.match(await f.textContent(), /Official page: https:\/\/hems\.example\.org\//); assert.match(await f.textContent(), /\(private\)/);
  assert.match(await p.textContent('#lreports'), /Wrong date/);
  await S.axe('admin desk'); await S.shot('cr-admin-submissions.png');
  await f.locator('[data-sa="approve"]').click(); assert.match(await f.locator('.err').textContent(), /Paste the date line/);
  const start = await f.locator('input[name=start]').inputValue(), end = await f.locator('input[name=end]').inputValue();
  const mon = new Date(start + 'T00:00:00Z').toLocaleDateString('en-AU', { timeZone: 'UTC', month: 'long', year: 'numeric' });
  await f.locator('textarea[name=datesQuote]').fill(`${+start.slice(8)}–${+end.slice(8)} ${mon}, Wollongong and online`); await f.locator('input[name=cpdConfirmed]').check();
  await f.locator('[data-sa="approve"]').click(); await p.waitForFunction(() => document.querySelectorAll('#subs form.sub').length === 1);
  const list = await p.evaluate(async () => (await (await fetch('/api/conferences')).json()).conferences.filter(c => c.source === 'organiser-submitted'));
  assert.equal(list.length, 1); assert.equal(list[0].dateStatus, 'confirmed'); assert.ok(list[0].datesQuote.includes(mon)); assert.equal(list[0].cpdHours, 10);
  await p.goto(B + '/#/discover'); await p.fill('#q', 'Harbour Emergency'); await p.waitForSelector('#results .card-link');
  await p.click('#results .card-link'); await p.waitForSelector('#overlay .pill:text-is("Confirmed")');
  assert.deepEqual(S.errors, [], 'admin: console errors'); await S.ctx.close();
}

async function dark(browser, B) {
  const S = await session(browser, B, { width: 390, height: 844 }, 'phone-dark', { dark: true }), { p } = S;
  await p.goto(B + '/'); await p.waitForSelector('.hero-intro'); await S.check('dark home');
  for (const h of ['#/discover', '#/courses', '#/list-event', '#/settings']) { await S.go(h); await p.waitForSelector('#main h1'); await S.check('dark ' + h); }
  await S.go('#/discover'); await p.waitForSelector('#results .card-link'); await p.click('#results .card-link'); await p.waitForSelector('#overlay .sheet'); await S.axe('dark conference dialog');
  for (const u of ['/privacy', '/about', '/courses/als2']) { await p.goto(B + u); await S.check('dark ' + u); }
  assert.deepEqual(S.errors, [], 'dark: console errors'); await S.ctx.close();
}

async function dbDown(browser, B, vp, tag) {
  const S = await session(browser, B, vp, tag + '-db-down', { allow: /Failed to load resource: the server responded with a status of 503/ }), { p } = S;
  await p.goto(B + '/'); await p.waitForSelector('.net-banner');
  assert.match(await p.textContent('.net-banner'), /Can’t connect\. Try again shortly\./);
  assert.doesNotMatch(await p.textContent('body'), /database unavailable|\{"error"/, 'no raw JSON');
  await S.check('home, database down'); if (tag === 'phone') await S.shot('cr-db-down-phone.png');
  await S.go('#/discover'); await p.waitForSelector('#results .card'); assert.ok(await p.locator('#results .card').count() > 10, 'conferences from the bundled list');
  await S.go('#/courses'); await p.waitForSelector('#cPlace', { state: 'attached' }); assert.ok(await p.locator('.course-card').count() > 3, 'courses still load');
  await S.go('#/settings'); await p.click('.acct-panel [data-act="retry"]'); await p.waitForSelector('.toast');
  await S.go('#/list-event'); await p.waitForSelector('#lef'); await S.check('list your event, database down');
  await p.goto(B + '/privacy'); await p.waitForSelector('h1'); await S.check('privacy, database down');
  const r = await p.goto(B + '/conferences/org-not-in-the-bundle-2027'); assert.equal(r.status(), 503); assert.match(await p.textContent('h1'), /Can’t connect/); await S.check('trouble page');
  assert.deepEqual(S.errors, [], `${tag} database down: console errors`); await S.ctx.close();
}

(async () => {
  const up = await startServer(), down = await startServer({ DATABASE_URL: 'postgres://hoggy:nope@127.0.0.1:1/hoggy' });
  const browser = await chromium.launch();
  try {
    await run(browser, up.B, { width: 390, height: 844 }, 'phone');
    await run(browser, up.B, { width: 1280, height: 900 }, 'desktop');
    await adminDesk(browser, up.B);
    await dark(browser, up.B);
    await dbDown(browser, down.B, { width: 390, height: 844 }, 'phone');
    await dbDown(browser, down.B, { width: 1280, height: 900 }, 'desktop');
  } finally { await browser.close(); up.srv.kill(); down.srv.kill(); }
  const by = {}; for (const v of axeLog) by[v.impact] = (by[v.impact] || 0) + 1;
  console.log('axe (all pages and dialogs, both sizes, light and dark):', JSON.stringify(by), axeLog.length ? axeLog.map(v => `${v.tag} ${v.where}: ${v.impact} ${v.id}`).join('; ') : '');
  console.log('client-ready e2e passed; screenshots in', OUT);
})().catch(e => { console.error(e); process.exit(1); });
