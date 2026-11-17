'use strict';
/* End to end, in a real browser: a doctor plans a conference trip, snaps a receipt photo on the trip, the "Check this
   receipt" card fills in from the reader, "Looks right" saves it, the trip's receipt checklist ticks Flights, the receipt
   shows its tax-invoice flag with help text, "I don't have this receipt" takes a reason that lands in the claim schedule,
   and a photo snapped while offline is still saved. Runs at 390x844 and 1280x900; fails on any console error or horizontal
   scroll. The server runs with HOGGY_FAKE_READER=1 (a fixture stands in for Claude; nothing leaves the machine).
     NODE_PATH=/opt/node-tools/node_modules node tests/e2e/snap-flow.js [screenshot dir] */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process'), path = require('node:path'), fs = require('node:fs'), os = require('node:os'), vm = require('node:vm'), zlib = require('node:zlib'), assert = require('node:assert/strict');
const ROOT = path.join(__dirname, '..', '..'), OUT = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'hoggy-shots-'));
fs.mkdirSync(OUT, { recursive: true });
const CONFS = (() => { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data', 'conferences.js'), 'utf8'), ctx); return ctx.window.HOGGY_CONFERENCES; })();
const CONF = CONFS.find(c => c.start >= '2027-04-01' && c.datesConfirmed !== false && /^[A-Za-z0-9 ]+$/.test(c.name) && c.name.length < 60);
const PW = 'correct-horse-battery';

/* a real (decodable) PNG that looks a little like a till receipt: white paper, grey "text" lines */
function receiptPng(w = 240, h = 400) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1); raw[row] = 0;
    const line = y > 20 && y < h - 20 && (y % 22) < 7, len = 40 + ((y * 37) % (w - 80));
    for (let x = 0; x < w; x++) { const ink = line && x > 20 && x < 20 + len; const v = ink ? 70 : 250; raw.fill(v, row + 1 + x * 3, row + 4 + x * 3); }
  }
  const crc = b => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const PHOTO = { name: 'qantas-booking.png', mimeType: 'image/png', buffer: receiptPng() };

async function startServer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoggy-e2e-')), port = 21000 + Math.floor(Math.random() * 20000);
  const srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', HOGGY_DATA: dir, DATABASE_URL: '', HOGGY_ADMIN_KEY: '', HOGGY_ADMINS: '', ANTHROPIC_API_KEY: '', HOGGY_FAKE_READER: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  const B = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/healthz')).ok) return { B, srv, log: () => log }; } catch (e) { } await new Promise(r => setTimeout(r, 100)); }
  throw new Error('server did not start: ' + log);
}

async function run(browser, B, vp, tag) {
  const phone = vp.width < 900, errors = [], ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, acceptDownloads: true }), p = await ctx.newPage();
  let offline = false;
  p.on('console', m => { if (m.type() === 'error' && !(offline && /ERR_INTERNET_DISCONNECTED|Failed to fetch/.test(m.text()))) errors.push(m.text()); });
  p.on('pageerror', e => errors.push('pageerror ' + e.message)); p.on('dialog', d => d.accept());
  const noScroll = async where => {
    const w = await p.evaluate(() => { const wide = []; document.querySelectorAll('body *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed') wide.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} ${Math.round(r.right)}px`); }); return [document.documentElement.scrollWidth, window.innerWidth, wide.slice(0, 6)]; });
    assert.ok(w[0] <= w[1], `${tag} ${where}: horizontal scroll ${w[0]} > ${w[1]} (${w[2].join(', ')})`);
  };
  const go = async hash => { await p.evaluate(h => { location.hash = h; }, hash); await p.waitForTimeout(250); };
  const shot = async (name, el) => { await p.waitForSelector('.toast', { state: 'detached' }); if (el) await p.locator(el).first().scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(OUT, `${name}-${tag}.png`), fullPage: false }); };

  /* sign up, plan a conference trip (no estimate: the checklist is Registration, Flights, Accommodation) */
  await p.goto(B + '/#/settings'); await p.click('.acct-panel [data-act="signin"]'); await p.click('#amode');
  await p.fill('#au1', 'Dr Sam Snap'); await p.fill('#au2', `sam.${tag}.${Date.now()}@example.com`); await p.fill('#au3', PW); await p.click('#asub'); await p.waitForSelector('#af', { state: 'detached' });
  await go('#/discover'); await p.fill('#q', CONF.name); await p.click(`.card[data-id="${CONF.id}"]`); await p.click(`.sheet [data-act="plan"][data-id="${CONF.id}"]`);
  await p.waitForSelector('#overlay', { state: 'hidden' }).catch(() => { }); await go('#/trips');
  const list = p.locator('[data-testid="checklist"]'); await list.waitFor();
  const tripId = await list.getAttribute('data-trip');
  assert.deepEqual(await list.locator('li').evaluateAll(ls => ls.map(l => `${l.dataset.key}:${l.dataset.status}`)), ['registration:missing', 'flights:missing', 'accommodation:missing']);

  /* snap on the trip: the check card fills in from the reader */
  await p.setInputFiles(`input[data-snap="${tripId}"]`, PHOTO);
  const card = p.locator('[data-testid="snap-card"]'); await card.waitFor();
  await p.waitForFunction(() => document.querySelector('#sc3') && document.querySelector('#sc3').value === '648.20');
  const val = async s => p.inputValue(s);
  assert.equal(await val('#sc1'), 'Qantas Airways'); assert.equal(await val('#sc2'), 'Flights'); assert.equal(await val('#sc4'), 'AUD'); assert.equal(await val('#sc5'), '2027-03-02');
  assert.equal(await val('#sc6'), tripId, 'the trip it was snapped on'); assert.equal(await val('#sc7'), '16 009 661 901'); assert.equal(await val('#sc8'), '58.93'); assert.equal(await p.isChecked('#sc9'), false);
  assert.match(await p.textContent('#scmsg'), /Check every field/); assert.match(await p.textContent('[data-testid="snap-confidence"]'), /High confidence/);
  const flag = card.locator('[data-testid="tax-flag"][data-code="gst-no-wording"]'); await flag.waitFor();
  assert.match(await flag.textContent(), /may not count as one.*booking confirmation.*Manage booking page/);
  await noScroll('check card'); await shot('snap-check'); await shot('snap-check-flag', '#scflags');
  /* every field stays editable; a typed change survives */
  await p.fill('#sc1', 'Qantas Airways Ltd'); assert.equal(await val('#sc1'), 'Qantas Airways Ltd');
  await p.click('#scok'); await card.waitFor({ state: 'detached' });

  /* the checklist ticks Flights */
  await p.waitForSelector('[data-testid="checklist"] li[data-key="flights"][data-status="ok"]');
  assert.match(await p.textContent('[data-testid="checklist"] li[data-key="flights"]'), /✓\s*Flights\s*1 receipt/);
  /* "I don't have this receipt" needs a reason */
  await p.click('[data-testid="checklist"] li[data-key="accommodation"] [data-act="noreceipt"]');
  await p.click('#sf button[type=submit]'); assert.equal(await p.locator('#sf').count(), 1, 'a reason is required');
  await p.fill('#nr1', 'Stayed with family in town'); await p.click('#sf button[type=submit]'); await p.waitForSelector('#sf', { state: 'detached' });
  await p.waitForSelector('[data-testid="checklist"] li[data-key="accommodation"][data-status="waived"]');
  await noScroll('trips'); await shot('checklist', '[data-testid="checklist"]');

  /* Receipts: the flag and its help text */
  await go('#/receipts'); const rf = p.locator('.li [data-testid="tax-flag"][data-code="gst-no-wording"]'); await rf.waitFor();
  assert.match(await rf.textContent(), /Download the tax invoice from the airline's Manage booking page and add it/);
  await noScroll('receipts'); await shot('tax-flag', '.li [data-testid="tax-flag"]');

  /* Claims: the warning lists what is missing; export stays enabled and the schedule carries the reason and the flag */
  await go('#/claims'); const warn = p.locator('[data-testid="claim-warn"]'); await warn.waitFor();
  assert.match(await warn.textContent(), /Missing receipts:\s*Registration\./); assert.match(await warn.textContent(), /May not count as a tax invoice:\s*Qantas Airways Ltd/);
  const exp = p.locator(`[data-act="exportcsv"][data-id="${tripId}"]`); assert.equal(await exp.isEnabled(), true, 'not hard-blocked');
  const [dl] = await Promise.all([p.waitForEvent('download'), exp.click()]); const sched = fs.readFileSync(await dl.path(), 'utf8');
  assert.match(sched, /Schedule notes/); assert.match(sched, /Missing receipt,Accommodation,Reason: Stayed with family in town/); assert.match(sched, /Missing receipt,Registration,Not added yet/); assert.match(sched, /Tax invoice check,R1 Qantas Airways Ltd/);
  await noScroll('claims');

  /* offline: a snapped photo is still saved, just not read */
  offline = true; await ctx.setOffline(true);
  await go('#/receipts'); await p.setInputFiles('input[data-snap=""]', { ...PHOTO, name: 'taxi.png' });
  await p.waitForSelector('[data-testid="snap-card"]'); await p.waitForFunction(() => /not read|offline/i.test(document.querySelector('#scmsg').textContent));
  assert.equal(await val('#sc3'), '', 'nothing auto-filled offline');
  await p.fill('#sc1', 'Silver Service taxi'); await p.selectOption('#sc2', 'Ground transport'); await p.fill('#sc3', '64.50'); await p.fill('#sc5', CONF.start); await p.selectOption('#sc6', tripId);
  await p.click('#scok'); await p.waitForSelector('[data-testid="snap-card"]', { state: 'detached' });
  await p.waitForSelector('.li .t:text("Silver Service taxi")');
  assert.equal(await p.evaluate(() => { const s = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /hoggy/i.test(k) && localStorage.getItem(k).includes('"receipts"')))); return s.receipts.filter(r => r.fileKey).length; }), 2, 'both receipts kept their photo');
  await ctx.setOffline(false); offline = false;
  await noScroll('receipts offline');
  await ctx.close();
  return errors;
}

(async () => {
  assert.ok(CONF, 'a confirmed 2027 conference to plan');
  const s = await startServer(), browser = await chromium.launch();
  try {
    for (const [vp, tag] of [[{ width: 390, height: 844 }, 'phone'], [{ width: 1280, height: 900 }, 'desktop']]) {
      const errors = await run(browser, s.B, vp, tag);
      console.log(`${tag} ${vp.width}x${vp.height}: snap flow passed, console errors: ${errors.length}`); if (errors.length) { console.log(errors.join('\n')); process.exitCode = 1; }
    }
    console.log('conference used:', CONF.id, '| screenshots in', OUT);
  } catch (e) { console.error(e); console.error(s.log().slice(-2000)); process.exitCode = 1; } finally { await browser.close(); s.srv.kill(); }
})();
