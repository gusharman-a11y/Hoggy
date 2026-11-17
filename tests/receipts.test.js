'use strict';
/* Snap receipt reader, currency detection, receipt checklist, Australian tax-invoice checks and the claim pack schedule.
   The Anthropic API is never called: every reader test injects a fake client (lib/receipt-reader.js makeFakeClient). */
const test = require('node:test'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process'), path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const { parseReceipt, detectCurrency } = require('../parse.js');
const P = require('../pack.js');
const R = require('../lib/receipt-reader.js');
const TDB = require('./_db.js');
const ROOT = path.join(__dirname, '..');

/* ---------- currency ---------- */
test('currency: ISO codes and symbols at the total, before or after the amount', () => {
  const cur = s => parseReceipt('From: X\n' + s, 'AUD');
  assert.deepEqual([cur('Total JPY 20,000').amount, cur('Total JPY 20,000').currency], [20000, 'JPY'], 'the reported bug: JPY was read as AUD');
  assert.equal(cur('Total: 20,000 JPY').currency, 'JPY');
  assert.equal(cur('Total ¥20,000').currency, 'JPY');
  assert.equal(cur('合計 ¥20,000').currency, 'JPY', 'no "total" word: the symbol still decides');
  assert.equal(cur('Total US$ 1,200.00').currency, 'USD');
  assert.equal(cur('Total USD 1,200.00').currency, 'USD');
  assert.equal(cur('Amount paid €300.00').currency, 'EUR');
  assert.equal(cur('Total EUR 300.00').currency, 'EUR');
  assert.equal(cur('Total £42.10').currency, 'GBP');
  assert.equal(cur('Total NZ$420.00').currency, 'NZD');
  assert.equal(cur('Total S$ 250.00').currency, 'SGD');
  assert.equal(cur('Total SGD 250.00').currency, 'SGD');
  assert.equal(cur('Total A$ 99.00').currency, 'AUD');
});
test('currency: a bare $ is the home currency unless the document says which dollar', () => {
  assert.equal(parseReceipt('From: Hotel\nTotal $300.00', 'AUD').currency, 'AUD');
  assert.equal(parseReceipt('From: Hotel\nTotal $300.00', 'NZD').currency, 'NZD', 'home currency for a plain $');
  assert.equal(parseReceipt('From: Hotel\nABN 51 824 753 556\nTotal $300.00', 'NZD').currency, 'AUD', 'an ABN means Australian dollars');
  assert.equal(parseReceipt('From: Marriott\nAll amounts in USD\nTotal: $410.00', 'AUD').currency, 'USD');
  assert.equal(parseReceipt('From: Hotel\nPrices in EUR\nTotal $300.00', 'AUD').currency, 'AUD', 'a $ total never becomes euros');
  assert.equal(detectCurrency('Total JPY 1', 'JPY', 'AUD'), 'JPY');
  assert.equal(detectCurrency('nothing', '', 'GBP'), 'GBP');
});
test('parser also reads ABN, GST and "tax invoice"', () => {
  const r = parseReceipt('From: Qantas\nTAX INVOICE\nABN 16 009 661 901\nTotal $648.20\nIncludes GST of $58.93', 'AUD');
  assert.equal(r.abn, '16009661901'); assert.equal(r.gst, 58.93); assert.equal(r.taxInvoice, true);
  const b = parseReceipt('From: Hotel\nTotal (incl. GST) $110.00\nGST $10.00', 'AUD');
  assert.equal(b.amount, 110); assert.equal(b.gst, 10, 'the "incl. GST" total line is not the GST'); assert.equal(b.taxInvoice, false);
  assert.equal(parseReceipt('From: Cafe\nGST-free\nTotal $5.00').gst, 0);
});

/* ---------- ABN and tax-invoice flags ---------- */
test('ABN checksum (ATO): valid, invalid, formats', () => {
  assert.ok(P.abnValid('51 824 753 556'), 'the ATO worked example');
  assert.ok(P.abnValid('16009661901')); assert.ok(P.abnValid('16-009-661-901'));
  assert.ok(!P.abnValid('51 824 753 557'), 'one digit off');
  assert.ok(!P.abnValid('1234567890')); assert.ok(!P.abnValid('')); assert.ok(!P.abnValid(null)); assert.ok(!P.abnValid('5182475355a'));
  assert.equal(P.fmtAbn('51824753556'), '51 824 753 556');
});
test('tax-invoice flags: no ABN, bad ABN, GST without wording, $82.50 threshold, non-AUD skipped', () => {
  const codes = r => P.taxFlags({ currency: 'AUD', category: 'Flights', ...r }).map(f => f.code);
  assert.deepEqual(codes({ amount: 648.2, abn: '16009661901', gst: 58.93, taxInvoice: true }), [], 'a proper tax invoice');
  assert.deepEqual(codes({ amount: 648.2, abn: '16009661901', gst: 58.93, taxInvoice: false }), ['gst-no-wording']);
  assert.deepEqual(codes({ amount: 82.5 }), ['no-abn'], '$82.50 or more without an ABN');
  assert.deepEqual(codes({ amount: 82.49 }), ['no-abn-small'], 'under the threshold: a softer note');
  assert.deepEqual(codes({ amount: 200, abn: '51 824 753 557' }), ['abn-invalid']);
  assert.deepEqual(codes({ amount: 200, abn: '123' }), ['abn-invalid'], 'a typed ABN that is not 11 digits');
  assert.deepEqual(P.taxFlags({ currency: 'JPY', amount: 20000 }), [], 'only Australian-dollar receipts are checked');
  const f = P.taxFlags({ currency: 'AUD', category: 'Flights', amount: 300, abn: '16009661901', gst: 27.27, taxInvoice: false })[0];
  assert.match(f.t, /may not count as/); assert.match(f.help, /booking confirmation.*Manage booking/);
  assert.doesNotMatch(f.t + f.help, /must|illegal|invalid claim|guarantee/i, 'plain wording, no legal overstatement');
  assert.match(P.taxFlags({ currency: 'AUD', category: 'Accommodation', amount: 300 })[0].help, /hotel/);
});

/* ---------- checklist ---------- */
test('checklist: from the estimate, defaults for conferences and courses, ticks and reasons', () => {
  const rc = (category) => ({ category, amount: 1 });
  const keys = l => l.map(i => `${i.key}:${i.status}`);
  assert.deepEqual(keys(P.checklist({ kind: 'conference' }, [])), ['registration:missing', 'flights:missing', 'accommodation:missing'], 'conference default');
  assert.deepEqual(keys(P.checklist({ kind: 'course' }, [])), ['registration:missing'], 'course default');
  assert.deepEqual(keys(P.checklist({ kind: 'conference', estimate: { registration: 900, flights: 0, accommodation: 0, other: 50 } }, [rc('Meals')])), ['registration:missing', 'other:ok'], 'only categories with an estimate; Meals counts as Other');
  assert.deepEqual(keys(P.checklist({ kind: 'conference', estimate: { registration: 0, flights: 0 } }, [])), ['registration:missing', 'flights:missing', 'accommodation:missing'], 'an all-zero estimate falls back to the default');
  const l = P.checklist({ kind: 'conference' }, [rc('Flights'), rc('Flights')], { accommodation: { reason: 'Stayed with family' }, registration: { reason: '   ' } });
  assert.deepEqual(keys(l), ['registration:missing', 'flights:ok', 'accommodation:waived'], 'a blank reason does not count');
  assert.equal(l[1].receipts, 2); assert.equal(l[2].reason, 'Stayed with family');
  assert.deepEqual(P.missingOf(l).map(i => i.label), ['Registration']);
  assert.deepEqual(keys(P.checklist({ kind: 'conference' }, [rc('Flights')], { flights: { reason: 'old' } })).slice(1, 2), ['flights:ok'], 'a receipt beats an old reason');
});

/* ---------- currency totals and the pack schedule ---------- */
test('currency totals: per currency, converted only with a rate, never mixed silently', () => {
  const rs = [{ amount: 300, currency: 'AUD' }, { amount: 20000, currency: 'JPY', fxRate: 0.0102 }, { amount: 5000, currency: 'JPY', fxRate: 0.0102 }, { amount: 100, currency: 'USD' }];
  const home = r => r.currency === 'AUD' ? r.amount : r.amount * (+r.fxRate || 0);
  const by = P.currencyTotals(rs, home, 'AUD');
  assert.deepEqual(by.map(x => x.currency), ['AUD', 'JPY', 'USD'], 'home currency first');
  assert.deepEqual(by[1], { currency: 'JPY', amount: 25000, converted: 255, count: 2, noRate: 0 });
  assert.equal(by[2].noRate, 1); assert.equal(by[2].converted, 0, 'no rate: not added to the home total');
});
test('pack schedule lists missing receipts with reasons and tax-invoice flags', () => {
  const list = P.checklist({ kind: 'conference' }, [{ category: 'Flights' }], { accommodation: { reason: 'Stayed with family' } });
  const rs = [{ vendor: 'Qantas', category: 'Flights', amount: 648.2, currency: 'AUD', abn: '16009661901', gst: 58.93, taxInvoice: false }, { vendor: 'Tokyo hotel', category: 'Accommodation', amount: 20000, currency: 'JPY' }];
  const n = P.packNotes(list, rs);
  assert.deepEqual(n.missing.map(i => i.key), ['registration', 'accommodation']);
  const text = n.lines.join('\n');
  assert.match(text, /Receipts not attached:/); assert.match(text, /Accommodation: I don't have this receipt\. Reason: Stayed with family/); assert.match(text, /Registration: not added yet/);
  assert.match(text, /Tax invoice check/); assert.match(text, /R1 Qantas: GST is shown but the document does not say "tax invoice"/);
  assert.doesNotMatch(text, /Tokyo/, 'non-AUD receipts are not tax-checked');
  assert.deepEqual(n.csvRows[1], ['Missing receipt', 'Accommodation', 'Reason: Stayed with family']);
  assert.equal(n.csvRows[2][0], 'Tax invoice check');
  assert.deepEqual(P.packNotes(P.checklist({ kind: 'course' }, [{ category: 'Registration' }]), []).lines, [], 'nothing to add');
});

/* ---------- reader (fake client) ---------- */
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 2)]);
const HEIC = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), Buffer.alloc(64)]);
function textPdf(lines) {
  const stream = 'BT /F1 12 Tf 50 750 Td 14 TL ' + lines.map(l => `(${l}) Tj T*`).join(' ') + ' ET';
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out = '%PDF-1.4\n'; const off = [];
  objs.forEach((o, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}

test('reader: sniffs real types from magic bytes', () => {
  assert.equal(R.sniff(PNG), 'image/png'); assert.equal(R.sniff(JPG), 'image/jpeg'); assert.equal(R.sniff(HEIC), 'image/heic');
  assert.equal(R.sniff(Buffer.from('%PDF-1.4 hello world')), 'application/pdf');
  assert.equal(R.sniff(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')])), 'image/webp');
  assert.equal(R.sniff(Buffer.from('<html><script>alert(1)</script>')), ''); assert.equal(R.sniff(Buffer.alloc(3)), '');
});
test('reader: validation keeps only well-formed fields', () => {
  const now = Date.parse('2026-11-17T00:00:00Z');
  const v = R.validateReading({ supplierName: '  Qantas\u0000Airways  ', supplierAbn: '16 009 661 901', totalCents: 64820, gstCents: 5893, currency: 'aud', date: '2027-03-02', isTaxInvoice: false, category: 'Flights', confidence: 'high', extra: 'ignored' }, now);
  assert.deepEqual(v, { supplierName: 'Qantas Airways', supplierAbn: '16009661901', totalCents: 64820, gstCents: 5893, currency: 'AUD', date: '2027-03-02', isTaxInvoice: false, category: 'Flights', confidence: 'high' });
  const bad = R.validateReading({ supplierName: 'x'.repeat(500), supplierAbn: '123', totalCents: -5, gstCents: 10, currency: 'dollars', date: '2027-02-30', isTaxInvoice: 'yes', category: 'Spa', confidence: 'certain' }, now);
  assert.equal(bad.supplierName.length, 80); assert.equal(bad.supplierAbn, null); assert.equal(bad.totalCents, null); assert.equal(bad.currency, null);
  assert.equal(bad.date, null, 'not a real date'); assert.equal(bad.isTaxInvoice, null); assert.equal(bad.category, 'Other'); assert.equal(bad.confidence, 'low');
  assert.equal(R.validateReading({ totalCents: 1000, gstCents: 5000 }, now).gstCents, null, 'GST above the total is dropped');
  assert.equal(R.validateReading({ totalCents: 12.5 }, now).totalCents, null, 'cents must be whole');
  assert.equal(R.validateReading({ date: '1999-12-31' }, now).date, null); assert.equal(R.validateReading({ date: '2029-01-01' }, now).date, null, 'more than 400 days ahead');
  assert.equal(R.validateReading({ confidence: 'high' }, now).confidence, 'low', 'nothing read: low confidence whatever the model said');
  assert.deepEqual(R.validateReading('nope', now), { ...R.validateReading(null, now) });
});
test('reader: image goes to the (fake) Claude client with structured output; result validated', async () => {
  const calls = [], client = R.makeFakeClient(undefined, calls);
  const r = await R.readReceipt(JPG, 'image/jpeg', { client });
  assert.equal(r.source, 'claude'); assert.equal(r.supplierName, 'Qantas Airways'); assert.equal(r.totalCents, 64820); assert.equal(r.currency, 'AUD'); assert.equal(r.abnValid, true); assert.equal(r.confidence, 'high');
  const q = calls[0];
  assert.equal(q.model, 'claude-opus-5-5', 'default model'); assert.equal(q.output_config.effort, 'low'); assert.equal(q.output_config.format.type, 'json_schema');
  assert.deepEqual(q.betas, ['server-side-fallback-2026-07-01']); assert.equal(q.fallbacks, 'default');
  assert.equal(q.messages[0].content[0].type, 'image'); assert.equal(q.messages[0].content[0].source.media_type, 'image/jpeg'); assert.equal(q.messages[0].content[0].source.data, JPG.toString('base64'));
  assert.ok(!('thinking' in q) && !('temperature' in q), 'no thinking or sampling parameters');
  await R.readReceipt(PNG, 'image/png', { client, model: 'claude-sonnet-5-5' }); assert.equal(calls[1].model, 'claude-sonnet-5-5', 'RECEIPT_MODEL is passed through');
  const pdfCalls = []; await R.readReceipt(Buffer.from('%PDF-1.4\n%%EOF\n'), 'application/pdf', { client: R.makeFakeClient(undefined, pdfCalls), pdfText: async () => '' });
  assert.equal(pdfCalls[0].messages[0].content[0].type, 'document', 'a PDF without a text layer goes as a document');
});
test('reader: bad output, errors and refusals fall back to an empty low-confidence reading', async () => {
  const logs = [];
  for (const out of ['not json', new Error('529 overloaded'), JSON.stringify({ totalCents: 'lots', supplierName: 7 })]) {
    const r = await R.readReceipt(JPG, 'image/jpeg', { client: R.makeFakeClient(out), log: m => logs.push(m) });
    assert.equal(r.confidence, 'low'); assert.equal(r.totalCents, null); assert.equal(r.supplierName, null);
  }
  assert.ok(logs.length >= 2 && logs.every(l => !l.includes(JPG.toString('base64'))), 'failures are logged without the file');
  const refusal = { beta: { messages: { create: async () => ({ stop_reason: 'refusal', content: [] }) } } };
  assert.equal((await R.readReceipt(JPG, 'image/jpeg', { client: refusal })).source, 'none');
});
test('reader: without a key, images are not read and PDFs with text use the parser (nothing sent anywhere)', async () => {
  const img = await R.readReceipt(PNG, 'image/png', { client: null });
  assert.equal(img.source, 'none'); assert.equal(img.confidence, 'low'); assert.equal(img.totalCents, null);
  const calls = [], pdf = textPdf(['Hotel Shinjuku', 'Date: 2027-04-12', 'Total JPY 20,000']);
  const r = await R.readReceipt(pdf, 'application/pdf', { client: R.makeFakeClient(undefined, calls), pdfText: require('../lib/pdftext.js').pdfText });
  assert.equal(r.source, 'pdf-text'); assert.equal(calls.length, 0, 'a text PDF never goes to Claude');
  assert.equal(r.totalCents, 2000000); assert.equal(r.currency, 'JPY'); assert.equal(r.date, '2027-04-12');
  assert.equal(R.clientFromEnv({}), null, 'no key, no client');
  assert.equal(R.clientFromEnv({ HOGGY_FAKE_READER: '1' }).fake, true);
  assert.equal(R.clientFromEnv({ HOGGY_FAKE_READER: '1', VERCEL: '1' }), null, 'the fake reader never runs on Vercel');
  const real = R.clientFromEnv({ ANTHROPIC_API_KEY: 'sk-test-not-used' }); assert.equal(typeof real.beta.messages.create, 'function'); assert.ok(!real.fake);
});

/* ---------- server endpoint ---------- */
async function startServer(t, extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoggy-r-')), port = 20000 + Math.floor(Math.random() * 30000);
  let srv; t.after(() => srv.kill());
  const env = { ...process.env, PORT: String(port), HOGGY_DATA: dir, HOST: '127.0.0.1', HOGGY_ADMIN_KEY: '', HOGGY_ADMINS: '', ANTHROPIC_API_KEY: '', HOGGY_FAKE_READER: '', ...TDB.isolate(t), ...extra };
  srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; srv.stdout.on('data', d => out += d); srv.stderr.on('data', d => out += d);
  const B = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) { try { if ((await fetch(B + '/healthz')).ok) break; } catch (e) { } await new Promise(r => setTimeout(r, 100)); }
  return { B, log: () => out };
}
async function signedIn(B) {
  const r = await fetch(B + '/api/register', { method: 'POST', headers: { 'X-Requested-With': 'hoggy', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `snap${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.com`, password: 'correct-horse-battery', name: 'Dr Snap' }) });
  assert.equal(r.status, 201); const cookie = r.headers.get('set-cookie').split(';')[0];
  return async (body, type, h = {}) => { const x = await fetch(B + '/api/receipts/read?cur=AUD', { method: 'POST', headers: { 'X-Requested-With': 'hoggy', 'Content-Type': type, cookie, ...h }, body }); let j = null; try { j = await x.json(); } catch (e) { } return [x.status, j]; };
}

test('POST /api/receipts/read: sign-in, CSRF, magic bytes, size cap, HEIC, fake reader, rate limit', async t => {
  const { B, log } = await startServer(t, { HOGGY_FAKE_READER: '1', HOGGY_READ_PER_HOUR: '7' });
  assert.equal((await fetch(B + '/api/receipts/read', { method: 'POST', headers: { 'X-Requested-With': 'hoggy', 'Content-Type': 'image/png' }, body: PNG })).status, 401, 'signed out');
  const read = await signedIn(B);
  assert.equal((await read(PNG, 'image/png', { 'X-Requested-With': '' }))[0], 403, 'CSRF header required');
  let [s, j] = await read(PNG, 'image/png');
  assert.equal(s, 200, JSON.stringify(j)); assert.equal(j.source, 'claude'); assert.equal(j.supplierName, 'Qantas Airways'); assert.equal(j.totalCents, 64820); assert.equal(j.abnValid, true); assert.equal(j.category, 'Flights');
  assert.equal((await read(Buffer.from('<svg onload=alert(1)>' + 'x'.repeat(50)), 'image/png'))[0], 415, 'not a PNG');
  assert.equal((await read(JPG, 'image/png'))[0], 415, 'type and bytes disagree');
  assert.equal((await read(PNG, 'text/html'))[0], 415, 'type not allowed');
  [s, j] = await read(HEIC, 'image/heic'); assert.equal(s, 415); assert.match(j.error, /HEIC/);
  assert.equal((await read(Buffer.concat([JPG, Buffer.alloc(5.2e6)]), 'image/jpeg'))[0], 413, 'photos over 5 MB');
  assert.equal((await read(Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(10.2e6)]), 'application/pdf'))[0], 413, 'PDFs over 10 MB');
  [s, j] = await read(PNG, 'image/png'); assert.equal(s, 429, '7 per hour (every call above counted), in rate_hits'); assert.match(j.error, /by hand/);
  assert.match(log(), /HOGGY_FAKE_READER=1/, 'the server says the fixture reader is on');
});
test('POST /api/receipts/read without ANTHROPIC_API_KEY: photos come back unread, text PDFs are parsed', async t => {
  const { B } = await startServer(t);
  const read = await signedIn(B);
  let [s, j] = await read(PNG, 'image/png');
  assert.equal(s, 200); assert.equal(j.source, 'none'); assert.equal(j.confidence, 'low'); assert.equal(j.totalCents, null); assert.match(j.note, /Fill in the details/);
  [s, j] = await read(textPdf(['Tokyo Congress Centre', 'Date: 2027-04-12', 'Total JPY 20,000']), 'application/pdf');
  assert.equal(s, 200); assert.equal(j.source, 'pdf-text'); assert.equal(j.currency, 'JPY'); assert.equal(j.totalCents, 2000000);
});
