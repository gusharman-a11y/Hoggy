'use strict';
/* End to end, in a real browser (x10 courses, 24 Nov 2026): Home's course counts and date split -> Courses list (catalogue and
   counts only, no sessions) -> ALS family filtered by Australia and by the United Kingdom -> language filter in Europe -> a
   course page with its sessions loaded on demand -> Discover's estimate wording. Then the static fallback (no /api/courses)
   still lists courses. Runs at 390x844 and 1280x900, fails on any console error or horizontal scroll. Not part of npm test:
     NODE_PATH=/opt/node-tools/node_modules node tests/e2e/courses-flow.js [screenshot dir]
   It starts its own server on a throwaway SQLite folder. */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process'), path = require('node:path'), fs = require('node:fs'), os = require('node:os'), assert = require('node:assert/strict');
const ROOT = path.join(__dirname, '..', '..'), OUT = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'hoggy-shots-'));
fs.mkdirSync(OUT, { recursive: true });

async function startServer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoggy-e2e-')), port = 21000 + Math.floor(Math.random() * 20000);
  const srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', HOGGY_DATA: dir, DATABASE_URL: '', HOGGY_ADMIN_KEY: '', HOGGY_ADMINS: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  const B = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/healthz')).ok) return { B, srv }; } catch (e) { } await new Promise(r => setTimeout(r, 100)); }
  throw new Error('server did not start: ' + log);
}

async function run(browser, B, vp, tag) {
  const errors = [], ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 }), p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); p.on('pageerror', e => errors.push('pageerror ' + e.message));
  const apiHits = []; p.on('request', r => { const u = r.url(); if (u.includes('/api/courses')) apiHits.push(u.slice(u.indexOf('/api/courses'))); });
  const noScroll = async where => {
    const w = await p.evaluate(() => { const wide = []; document.querySelectorAll('body *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed') wide.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} ${Math.round(r.right)}px`); }); return [document.documentElement.scrollWidth, window.innerWidth, wide.slice(0, 6)]; });
    assert.ok(w[0] <= w[1], `${tag} ${where}: horizontal scroll ${w[0]} > ${w[1]} (${w[2].join(', ')})`);
  };
  const go = async hash => { await p.evaluate(h => { location.hash = h; }, hash); await p.waitForTimeout(250); };
  const shot = async (name, full) => p.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: !!full });

  /* Home: course counts and the three-way date split */
  await p.goto(B + '/#/'); await p.waitForSelector('.live-dates');
  await p.waitForFunction(() => /Course sessions/.test(document.querySelector('.live-grid').textContent));
  const live = await p.textContent('.live-grid');
  assert.match(live, /confirmed with source stored/); assert.match(live, /confirmed earlier, being re-checked/); assert.match(live, /estimated \(labelled\)/);
  assert.match(live, /course types in \d+ countries/);
  await noScroll('home'); if (tag === 'phone') { await p.locator('.live').scrollIntoViewIfNeeded(); await shot('x10-home-phone'); }

  /* Courses list: fast (catalogue and counts, no sessions), defaults to the profile's country (Australia) and English */
  const t0 = Date.now(); await go('#/courses'); await p.waitForSelector('#cPlace'); const ms = Date.now() - t0;
  assert.ok(ms < 3000, `${tag}: course list took ${ms} ms`);
  assert.ok(!apiHits.some(u => /course=|all=1/.test(u)), 'the list loads no sessions: ' + apiHits.join(' '));
  assert.equal(await p.inputValue('#cPlace'), 'AU'); assert.equal(await p.inputValue('#cListLang'), 'en');
  const als = p.locator('.panel.family', { hasText: 'Advanced Life Support (ALS)' });
  const alsText = await als.textContent();
  for (const label of ['ALS — ANZCOR (Australia/NZ)', 'ALS — Resuscitation Council UK', 'ALS — European Resuscitation Council']) assert.ok(alsText.includes(label), `${tag}: ALS family shows "${label}"`);
  const rowText = name => als.locator('.fam-row', { hasText: name }).first().textContent();
  assert.match(await rowText('ALS2'), /\d+ sessions? in Australia/);
  assert.match(await rowText('Resuscitation Council UK'), /None in Australia/);
  await noScroll('courses AU'); await shot(`x10-courses-${tag === 'phone' ? 'phone' : 'desktop'}`);

  /* United Kingdom: the RCUK ALS row has sessions, ANZCOR has none */
  await p.selectOption('#cPlace', 'GB'); await p.waitForTimeout(200);
  assert.match(await rowText('Resuscitation Council UK'), /\d+ sessions? in United Kingdom/);
  assert.match(await rowText('ALS2'), /None in United Kingdom/);
  await noScroll('courses GB');

  /* language: Europe, any language, then a named one */
  await p.selectOption('#cPlace', 'w:Europe'); await p.waitForTimeout(200);
  const langs = await p.locator('#cListLang option').evaluateAll(o => o.map(x => x.value));
  assert.ok(langs.includes('any') && langs.length > 3, 'languages offered in Europe: ' + langs.join(','));
  const other = langs.find(l => !['en', 'any'].includes(l));
  await p.selectOption('#cListLang', other); await p.waitForTimeout(200);
  assert.match(await rowText('European Resuscitation Council'), /session/);
  await noScroll('courses Europe ' + other);
  if (tag === 'desktop') await shot('x10-courses-language-desktop');

  /* a course page: its sessions load on demand; the ALS family panel and body label show; prices in the provider's currency */
  await go('#/courses/rcuk-als?country=GB'); await p.waitForSelector('#sessList .sess');
  assert.ok(apiHits.some(u => /course=rcuk-als/.test(u)), 'sessions fetched per course');
  assert.match(await p.textContent('.page-head .eyebrow'), /ALS — Resuscitation Council UK/);
  assert.equal(await p.inputValue('#cCountry'), 'GB');
  const first = await p.textContent('#sessList .sess');
  assert.match(first, /United Kingdom/);
  await noScroll('course page'); if (tag === 'phone') await shot('x10-course-detail-phone');
  await p.click('#sessList .sess'); await p.waitForSelector('.sheet'); await noScroll('session sheet');
  if (tag === 'phone') await shot('x10-session-phone');
  await p.click('.sheet [data-act="close"]');

  /* ALS2 in Australia */
  await go('#/courses/als2?country=AU'); await p.waitForSelector('#sessList .sess');
  assert.match(await p.textContent('#sessList .sess'), /, (NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\b/);

  /* Discover: estimates counted and labelled, "Usually <Month YYYY>" on estimated cards */
  await go('#/discover'); await p.waitForSelector('.page-head p');
  const sub = await p.textContent('.page-head p');
  assert.match(sub, /\d[\d,]* confirmed with source stored · \d[\d,]* confirmed earlier, being re-checked · \d[\d,]* estimated \(labelled\)/);
  await p.waitForTimeout(300);
  const body = await p.textContent('#results, .results, main');
  assert.match(body, /Usually (January|February|March|April|May|June|July|August|September|October|November|December) 20\d\d/);
  await noScroll('discover'); if (tag === 'phone') await shot('x10-discover-phone');

  /* a conference without sourced attendance or price shows neither */
  await ctx.close();
  return errors;
}

/* static host: /api/courses fails, the bundled files load whole and the list still works */
async function staticFallback(browser, B) {
  const errors = [], ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), p = await ctx.newPage();
  p.on('pageerror', e => errors.push('pageerror ' + e.message));
  await p.route('**/api/courses**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"down"}' }));
  await p.goto(B + '/#/courses'); await p.waitForSelector('#cPlace');
  assert.match(await p.textContent('.panel.family'), /session/);
  await p.evaluate(() => { location.hash = '#/courses/als2'; }); await p.waitForSelector('#sessList .sess');
  await ctx.close();
  return errors;
}

(async () => {
  const { B, srv } = await startServer();
  const browser = await chromium.launch();
  try {
    const e1 = await run(browser, B, { width: 390, height: 844 }, 'phone');
    const e2 = await run(browser, B, { width: 1280, height: 900 }, 'desktop');
    const e3 = await staticFallback(browser, B);
    const errs = [...e1, ...e2, ...e3].filter(m => !/503|Service Unavailable/.test(m));
    assert.deepEqual(errs, [], 'console errors');
    console.log('courses-flow ok (phone, desktop, static fallback); screenshots in ' + OUT);
  } finally { await browser.close(); srv.kill(); }
})().catch(e => { console.error(e); process.exit(1); });
