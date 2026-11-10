'use strict';
/* Run: node --test tests/ */
const test = require('node:test'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process'), path = require('node:path'), fs = require('node:fs'), os = require('node:os'), vm = require('node:vm');
const { parseReceipt } = require('../parse.js');

test('parser: totals, thousands, subtotal, forwarded sender, category', () => {
  const a = parseReceipt('Subject: Receipt\nFrom: Dr Me <me@x.com>\n---------- Forwarded message ---------\nFrom: Uber Receipts <u@uber.com>\nSubtotal $100.00\nTotal $110.00\nPaid on 12/03/2027');
  assert.equal(a.amount, 110); assert.equal(a.vendor, 'Uber Receipts'); assert.equal(a.category, 'Ground transport'); assert.equal(a.date, '2027-03-12');
  assert.equal(parseReceipt('From: Hilton\nTotal: $1,250\nCheck-in 5 Apr 2027').amount, 1250);
  assert.equal(parseReceipt('From: Cafe\nLunch\nUnited States\nTotal $18.40').category, 'Meals');
  assert.equal(parseReceipt('From: Air NZ\nSubject: Flight receipt\nTotal NZ$ 420.00').currency, 'NZD');
  assert.equal(parseReceipt('From: Hotel\nTotal nights: 3\nTotal $300.00').amount, 300);
  assert.equal(parseReceipt('nothing useful here').amount, undefined);
  const eur = parseReceipt('From: Hotel Zurich\nTotal: EUR 500.00\nDate 5 Apr 2027'); assert.equal(eur.currency, 'EUR'); assert.equal(eur.amount, 500);
  assert.equal(parseReceipt('From: X\nAmount paid £42.10').currency, 'GBP');
});

test('conference dataset: schema, unique ids, valid dates, https urls', () => {
  const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'data', 'conferences.js'), 'utf8'), ctx);
  const c = ctx.window.HOGGY_CONFERENCES; assert.ok(c.length >= 60);
  const ids = new Set();
  for (const x of c) {
    assert.ok(!ids.has(x.id), 'dup ' + x.id); ids.add(x.id);
    assert.match(x.start, /^\d{4}-\d{2}-\d{2}$/); assert.ok(x.end >= x.start, 'end<start ' + x.id);
    assert.match(x.url, /^https:\/\//, x.id); assert.match(x.countryCode, /^[A-Z]{2}$/, x.id);
    assert.ok(x.cpdHours >= 0 && x.name && x.city && x.specialty, x.id);
    if (x.datesConfirmed === true) assert.ok(x.sourceUrl && /^https:\/\//.test(x.sourceUrl), 'confirmed row needs sourceUrl ' + x.id);
    assert.ok(!/(largest|world's leading)/i.test(x.blurb), 'unsourced superlative ' + x.id);
  }
});

test('server API', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoggy-')), port = 20000 + Math.floor(Math.random() * 20000);
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(port), HOGGY_DATA: dir, HOST: '127.0.0.1', HOGGY_ADMIN_KEY: 'k', HOGGY_ADMINS: 'x@example.com', HOGGY_REPORT_MIN_AGE_H: '0' }, stdio: 'ignore' });
  t.after(() => { srv.kill(); });
  const B = `http://127.0.0.1:${port}`, H = { 'X-Requested-With': 'hoggy', 'Content-Type': 'application/json' };
  for (let i = 0; i < 50; i++) { try { await fetch(B + '/api/ratings'); break; } catch (e) { await new Promise(r => setTimeout(r, 100)); } }
  let cookie = ''; const call = async (p, o = {}, h = H) => { const r = await fetch(B + p, { ...o, headers: { ...h, cookie } }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; let j = null; try { j = await r.json(); } catch (e) { } return [r.status, j]; };
  assert.equal((await call('/api/register', { method: 'POST', body: '{}' }, { 'Content-Type': 'application/json' }))[0], 403, 'csrf header required');
  const email = `t${Date.now()}@example.com`;
  const [s1, reg] = await call('/api/register', { method: 'POST', body: JSON.stringify({ email, password: 'correct-horse-battery', name: 'T' }) });
  assert.equal(s1, 201); assert.match(reg.user.inbox, /^dr-[a-f0-9]{20}@/);
  assert.equal((await call('/api/register', { method: 'POST', body: JSON.stringify({ email, password: 'correct-horse-battery' }) }))[0], 409);
  assert.equal((await call('/api/state', { method: 'PUT', body: JSON.stringify({ state: { trips: [{ id: 't1', confId: 'esc-congress', status: 'attended' }] }, baseRev: 0 }) }))[0], 200);
  assert.equal((await call('/api/state', { method: 'PUT', body: JSON.stringify({ state: {}, baseRev: 0 }) }))[0], 409, 'stale write rejected');
  assert.equal((await call('/api/reviews', { method: 'POST', body: JSON.stringify({ confId: 'not-a-conference', rating: 5, text: 'twelve characters' }) }))[0], 400);
  assert.equal((await call('/api/reviews', { method: 'POST', body: JSON.stringify({ confId: 'esc-congress', rating: 4, text: 'Strong programme, well run', dims: { content: 5, value: 3 } }) }))[0], 200);
  const [, rv] = await call('/api/reviews?conf=esc-congress'); assert.equal(rv.length, 1); assert.equal(rv[0].verified, false, 'self-claimed attendance is NOT verification'); assert.equal(rv[0].dims.content, 5);
  const secret = fs.readFileSync(path.join(dir, 'inbound-secret.txt'), 'utf8').trim();
  assert.equal((await fetch(B + '/api/inbound/email', { method: 'POST', headers: { ...H, 'X-Hoggy-Secret': 'wrong' }, body: '{}' })).status, 401);
  const confs = (await (await fetch(B + '/api/conferences')).json()).conferences, esc1 = confs.find(c => c.id === 'esc-congress');
  const ok = await fetch(B + '/api/inbound/email', { method: 'POST', headers: { ...H, 'X-Hoggy-Secret': secret }, body: JSON.stringify({ To: reg.user.inbox, From: 'Hilton <n@h.com>', Subject: 'Receipt', TextBody: `Total $612.50\n${esc1.start}` }) });
  assert.equal(ok.status, 200);
  assert.equal((await call('/api/reviews', { method: 'POST', body: JSON.stringify({ confId: 'esc-congress', rating: 4, text: 'Strong programme, well run', dims: { content: 5, value: 3 } }) }))[0], 200);
  const [, rv2] = await call('/api/reviews?conf=esc-congress'); assert.equal(rv2[0].verified, true, 'receipt emailed in the event window verifies');
  const [, inbox] = await call('/api/inbox'); assert.equal(inbox.length, 1); assert.equal(inbox[0].amount, 612.5);
  const [fs1] = [(await fetch(B + `/api/files/${inbox[0].fileId}`, { headers: H })).status]; assert.equal(fs1, 401, 'files need a session');
  { /* C01: receipt files are kept server-side so they survive a cleared browser */
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF'), hdr = { 'X-Requested-With': 'hoggy', 'Content-Type': 'application/pdf', cookie };
    assert.equal((await fetch(B + '/api/rfile/f-abc123?name=r.pdf', { method: 'PUT', headers: hdr, body: pdf })).status, 200);
    assert.equal((await fetch(B + '/api/rfile/f-bad999', { method: 'PUT', headers: hdr, body: Buffer.from('MZ not a pdf') })).status, 415, 'magic bytes enforced');
    const [, keys] = await call('/api/rfiles'); assert.deepEqual(keys, ['f-abc123']);
    const got = await fetch(B + '/api/rfile/f-abc123', { headers: { ...H, cookie } }); assert.equal(got.status, 200); assert.ok(Buffer.from(await got.arrayBuffer()).equals(pdf));
    assert.equal((await fetch(B + '/api/rfile/f-abc123', { headers: H })).status, 401, 'needs a session');
    assert.equal((await call('/api/rfile/f-abc123', { method: 'DELETE' }))[0], 200);
    assert.equal((await call('/api/rfile/f-abc123'))[0], 404);
  }
  { /* R7: an emailed file moves into the receipt store on the server before the inbox row goes; other users cannot read it */
    const it = inbox[0];
    assert.equal((await call('/api/inbox/' + it.id + '/claim', { method: 'POST', body: JSON.stringify({ key: 'bad key!' }) }))[0], 400);
    assert.equal((await call('/api/inbox/' + it.id + '/claim', { method: 'POST', body: JSON.stringify({ key: 'f-moved1' }) }))[0], 200);
    const [, ib2] = await call('/api/inbox'); assert.equal(ib2.length, 0, 'inbox row removed only after the file landed');
    const [, keys2] = await call('/api/rfiles'); assert.ok(keys2.includes('f-moved1'));
    assert.equal((await call('/api/rfile/f-moved1'))[0], 200, 'moved file is readable');
    const saved = cookie; cookie = '';
    const [s2] = await call('/api/register', { method: 'POST', body: JSON.stringify({ email: `u2${Date.now()}@example.com`, password: 'correct-horse-battery', name: 'U2' }) }); assert.equal(s2, 201);
    assert.equal((await call('/api/rfile/f-moved1'))[0], 404, 'another user cannot read it');
    assert.deepEqual((await call('/api/rfiles'))[1], [], 'another user does not see it listed');
    cookie = saved;
  }
  assert.equal((await fetch(B + '/data-store/inbound-secret.txt')).status, 404);
  assert.equal((await fetch(B + '/server.js')).status, 404);
  assert.equal((await fetch(B + '/%')).status, 400);
  assert.equal((await call('/api/account', { method: 'DELETE', body: JSON.stringify({ password: 'nope' }) }))[0], 403);
});

test('ingest: parsers, similarity, SSRF guard, validation', async () => {
  const { jsonldEvents, icalEvents, similar, privateIp, safeFetch, validate } = require('../lib/ingest.js');
  const html = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Event","name":"ESC Congress 2027","startDate":"2027-08-27","endDate":"2027-08-30","location":{"address":{"addressLocality":"Milan"}}}</script>';
  const ev = jsonldEvents(html); assert.equal(ev.length, 1); assert.equal(ev[0].start, '2027-08-27'); assert.equal(ev[0].city, 'Milan');
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:ASCO Annual Meeting\r\nDTSTART;VALUE=DATE:20270528\r\nDTEND;VALUE=DATE:20270602\r\nLOCATION:Chicago\, IL\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const ie = icalEvents(ics); assert.equal(ie[0].start, '2027-05-28'); assert.equal(ie[0].end, '2027-06-01'); assert.equal(ie[0].city, 'Chicago, IL');
  assert.ok(similar('ESC Congress 2027', 'European Society of Cardiology ESC Congress')); assert.ok(!similar('ESC Congress', 'ASCO Annual Meeting'));
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.9', '169.254.169.254', '172.16.0.1', '::1']) assert.ok(privateIp(ip), ip);
  assert.ok(!privateIp('8.8.8.8'));
  assert.equal(await safeFetch('http://example.com/'), null, 'http refused');
  assert.equal(await safeFetch('https://127.0.0.1/'), null, 'loopback refused');
  assert.equal(await safeFetch('https://localhost/'), null, 'localhost refused');
  assert.equal(validate({ id: 'x-conf', name: 'N', organiser: 'O', specialty: 'S', city: 'C', country: 'AU', countryCode: 'AU', region: 'Asia-Pacific', start: '2027-01-02', end: '2027-01-01', format: 'In-person', cpdHours: 1, url: 'https://a.b', blurb: 'b' }), 'bad dates');
});

test('healthz, review report/delete, seed versioning', async (t) => {
  const dir = require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'hoggy2-')), port = 20000 + Math.floor(Math.random() * 20000);
  const srv = require('node:child_process').spawn(process.execPath, [require('node:path').join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(port), HOGGY_DATA: dir, HOST: '127.0.0.1', HOGGY_ADMIN_KEY: 'k', HOGGY_ADMINS: 'x@example.com', HOGGY_REPORT_MIN_AGE_H: '0' }, stdio: 'ignore' });
  t.after(() => srv.kill());
  const B = `http://127.0.0.1:${port}`, H = { 'X-Requested-With': 'hoggy', 'Content-Type': 'application/json' };
  let hz; for (let i = 0; i < 50; i++) { try { hz = await (await fetch(B + '/healthz')).json(); break; } catch (e) { await new Promise(r => setTimeout(r, 100)); } }
  assert.equal(hz.ok, true); assert.ok(hz.conferences >= 60);
  const list = await (await fetch(B + '/api/conferences')).json(); assert.ok(list.conferences.length >= 60);
  assert.ok(require('node:fs').readdirSync(require('node:path').join(dir, 'backups')).length >= 1, 'backup written');
  const mk = async (n) => { let cookie = ''; const r = await fetch(B + '/api/register', { method: 'POST', headers: H, body: JSON.stringify({ email: `u${n}${Date.now()}@example.com`, password: 'correct-horse-battery', name: 'U' + n }) }); cookie = r.headers.get('set-cookie').split(';')[0]; return (p, o = {}) => fetch(B + p, { ...o, headers: { ...H, cookie } }).then(async x => [x.status, await x.json().catch(() => null)]); };
  const a = await mk('a'), b = await mk('b'), c = await mk('c'), d = await mk('d');
  const id = list.conferences[0].id;
  await a('/api/reviews', { method: 'POST', body: JSON.stringify({ confId: id, rating: 4, text: 'A decent programme overall' }) });
  const [, rv] = await a('/api/reviews?conf=' + id); assert.equal(rv[0].mine, true);
  assert.equal((await a(`/api/reviews/${rv[0].id}/report`, { method: 'POST' }))[0], 400, 'cannot report own');
  for (const x of [b, c, d]) assert.equal((await x(`/api/reviews/${rv[0].id}/report`, { method: 'POST' }))[0], 200);
  const [, after] = await b('/api/reviews?conf=' + id); assert.equal(after.length, 0, 'hidden after 3 reports');
  assert.equal((await a('/api/admin/candidates'))[0], 403, 'admin only');
});
