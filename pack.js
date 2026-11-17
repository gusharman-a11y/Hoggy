(function (root) {
/* Claim-pack logic shared by the browser and the tests: employer policy checks, the .eml draft builder, study-leave maths.
   No defaults are shipped: every limit comes from figures the user typed from their own employer's policy. */

const num = v => (isFinite(+v) && +v > 0) ? +v : 0;
const r2 = n => Math.round(n * 100) / 100;

/* receipts: [{id, vendor, category, date, amount, currency, fxRate, nights, personal, note}]; home = (r)=>home-currency amount
   emp: {hotelPerNight, mealsPerDay, perReceipt:{cat:amount}, clause, claimDays}; conf: {start,end}
   returns [{lvl:'bad'|'warn', id, t, clause}] */
function evaluate(receipts, conf, emp, home) {
  const out = [], e = emp || {}, clause = e.clause ? ' (' + e.clause + ')' : '';
  const hn = num(e.hotelPerNight), md = num(e.mealsPerDay), pr = e.perReceipt || {};
  for (const r of receipts) {
    const a = home(r), per = num(r.personal), claim = Math.max(0, a - per);
    if (r.category === 'Accommodation' && hn) {
      const n = num(r.nights);
      if (!n) out.push({ lvl: 'bad', id: r.id, t: `${r.vendor || 'Accommodation'}: enter the number of nights; the nightly limit cannot be checked without it`, clause: e.clause || '' });
      else if (claim / n > hn + 0.005) out.push({ lvl: r.excuse ? 'warn' : 'bad', id: r.id, t: `${r.vendor || 'Accommodation'}: ${r2(claim / n)} a night is over the ${hn} nightly limit${clause}${r.excuse ? ' (justification given)' : '. Add a justification for exceeding policy, or fix the amount'}`, clause: e.clause || '' });
    }
    const cap = num(pr[r.category]);
    if (cap && claim > cap + 0.005) out.push({ lvl: r.excuse ? 'warn' : 'bad', id: r.id, t: `${r.vendor || r.category}: ${r2(claim)} is over the ${cap} ${r.category} limit${clause}${r.excuse ? ' (justification given)' : '. Add a justification for exceeding policy'}`, clause: e.clause || '' });
  }
  if (md) {
    const byDay = {};
    for (const r of receipts) if (r.category === 'Meals' && r.date) byDay[r.date] = (byDay[r.date] || 0) + Math.max(0, home(r) - num(r.personal));
    for (const d of Object.keys(byDay)) if (byDay[d] > md + 0.005) out.push({ lvl: receipts.some(r => r.category === 'Meals' && r.date === d && r.excuse) ? 'warn' : 'bad', id: '', t: `Meals on ${d} total ${r2(byDay[d])}, over the ${md} daily limit${clause}`, clause: e.clause || '' });
  }
  const dl = num(e.claimDays);
  if (dl && conf && conf.end) {
    const last = Date.parse(conf.end + 'T00:00:00Z') + dl * 864e5;
    if (Date.now() > last) out.push({ lvl: 'warn', id: '', t: `The ${dl}-day claim deadline after this trip has passed. Ask your admin whether a late claim is accepted${clause}`, clause: e.clause || '' });
  }
  return out;
}

/* Mon-Fri days from (start - before) to (end + after), inclusive. Public holidays are NOT removed: the request says so. */
function leaveDays(start, end, before, after) {
  const a = Date.parse(start + 'T00:00:00Z') - (before || 0) * 864e5, b = Date.parse(end + 'T00:00:00Z') + (after || 0) * 864e5;
  if (!isFinite(a) || !isFinite(b) || b < a) return 0;
  let n = 0; for (let t = a; t <= b; t += 864e5) { const d = new Date(t).getUTCDay(); if (d !== 0 && d !== 6) n++; }
  return n;
}

const wrap76 = s => s.replace(/(.{76})/g, '$1\r\n');
const hdr = s => /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + Buffer_b64(String(s)) + '?=';
function Buffer_b64(s) { if (typeof Buffer !== 'undefined') return Buffer.from(s, 'utf8').toString('base64'); const b = new TextEncoder().encode(s); let x = ''; b.forEach(c => x += String.fromCharCode(c)); return btoa(x); }
function u8b64(u8) { if (typeof Buffer !== 'undefined') return Buffer.from(u8).toString('base64'); let x = ''; for (let i = 0; i < u8.length; i += 0x8000) x += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(x); }
const safeName = s => String(s || 'file').replace(/[^\w.\- ]/g, '_').slice(0, 80);

/* An unsent RFC 5322 draft (X-Unsent: 1 makes Outlook open it as an editable draft). attachments: [{name,type,data:Uint8Array}] */
function buildEml({ to, subject, body, attachments }) {
  const b = '=_hoggy_' + Math.random().toString(36).slice(2) + Date.now().toString(36), L = [];
  L.push('X-Unsent: 1', 'To: ' + String(to || '').replace(/[\r\n]/g, ''), 'Subject: ' + hdr(String(subject || '').replace(/[\r\n]/g, ' ')), 'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${b}"`, '');
  L.push('--' + b, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap76(Buffer_b64(String(body || ''))));
  for (const a of attachments || []) L.push('--' + b, `Content-Type: ${a.type || 'application/octet-stream'}; name="${safeName(a.name)}"`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${safeName(a.name)}"`, '', wrap76(u8b64(a.data)));
  L.push('--' + b + '--', '');
  return L.join('\r\n');
}


/* ---------- Australian tax-invoice checks (ATO): plain flags, never a block ----------
   An ABN has 11 digits; subtract 1 from the first, weight by 10,1,3,5,...,19, and the sum divides by 89. A purchase of
   $82.50 or more including GST needs a tax invoice (supplier ABN, the words "tax invoice", GST) for the GST credit; many
   employers ask for one either way. We only say a receipt "may not count as a tax invoice": the employer decides. */
const ABN_W = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
const normAbn = s => { const d = String(s || '').replace(/[\s-]/g, ''); return /^\d{11}$/.test(d) ? d : ''; };
function abnValid(s) { const a = normAbn(s); if (!a) return false; const d = a.split('').map(Number); d[0] -= 1; return d.reduce((t, x, i) => t + x * ABN_W[i], 0) % 89 === 0; }
const fmtAbn = s => { const a = normAbn(s); return a ? `${a.slice(0, 2)} ${a.slice(2, 5)} ${a.slice(5, 8)} ${a.slice(8)}` : String(s || ''); };
const TAX_HELP = {
  Flights: 'This looks like a booking confirmation. Download the tax invoice from the airline\'s Manage booking page and add it.',
  Accommodation: 'Ask the hotel for a tax invoice at checkout, or download it from the booking site, and add it.',
  Registration: 'Download the tax invoice from the organiser\'s registration page, or ask the organiser for one, and add it.',
};
const taxHelp = cat => TAX_HELP[cat] || 'Ask the supplier for a tax invoice and add it.';
/* r: {category, amount, currency, abn, gst, taxInvoice}. AUD receipts only; returns [{code, t, help}] */
function taxFlags(r) {
  if (!r || String(r.currency || 'AUD').toUpperCase() !== 'AUD') return [];
  const out = [], amt = +r.amount || 0, gst = +r.gst || 0, typed = String(r.abn || '').trim(), abn = normAbn(typed);
  if (typed && !abnValid(typed)) out.push({ code: 'abn-invalid', t: `ABN ${fmtAbn(typed)} does not pass the ATO check, so this may not count as a tax invoice`, help: 'Check the ABN against the receipt. If it was typed correctly, ask the supplier for a corrected tax invoice.' });
  else if (!abn && amt >= 82.5) out.push({ code: 'no-abn', t: 'No supplier ABN on a receipt of $82.50 or more, so it may not count as a tax invoice', help: taxHelp(r.category) });
  else if (!abn) out.push({ code: 'no-abn-small', t: 'No supplier ABN found', help: 'Under $82.50 including GST, a receipt without an ABN is often accepted. Check with your employer.' });
  if (gst > 0 && r.taxInvoice !== true) out.push({ code: 'gst-no-wording', t: 'GST is shown but the document does not say "tax invoice", so it may not count as one', help: taxHelp(r.category) });
  return out;
}

/* ---------- receipt checklist per trip ----------
   Built from the trip's estimate (approval request, its saved estimate or the study-leave draft): every category with an
   estimate above 0. Without one: Registration, Flights and Accommodation for a conference, Registration for a course. */
const CHECK = [['registration', 'Registration'], ['flights', 'Flights'], ['accommodation', 'Accommodation'], ['other', 'Other']];
const MAIN = new Set(['Registration', 'Flights', 'Accommodation']);
const coversKey = (k, cat) => k === 'other' ? !MAIN.has(cat) : (CHECK.find(x => x[0] === k) || [])[1] === cat;
/* trip: {estimate:{registration,flights,accommodation,other}, kind:'conference'|'course'}; waived: {key:{reason}} */
function checklist(trip, receipts, waived) {
  const est = (trip && trip.estimate) || null, w = waived || {};
  let keys = est ? CHECK.filter(([k]) => +est[k] > 0).map(x => x[0]) : [];
  if (!keys.length) keys = trip && trip.kind === 'course' ? ['registration'] : ['registration', 'flights', 'accommodation'];
  return keys.map(k => {
    const label = CHECK.find(x => x[0] === k)[1], n = (receipts || []).filter(r => coversKey(k, r.category)).length, reason = String((w[k] && w[k].reason) || '').trim();
    return { key: k, label, receipts: n, status: n ? 'ok' : reason ? 'waived' : 'missing', reason: n ? '' : reason };
  });
}
const missingOf = list => list.filter(i => i.status === 'missing');

/* per-currency subtotals so a claim never silently adds yen to dollars. home(r) = amount in the home currency (0 without a rate) */
function currencyTotals(receipts, home, homeCur) {
  const by = new Map();
  for (const r of receipts || []) {
    const c = String(r.currency || homeCur).toUpperCase(), o = by.get(c) || { currency: c, amount: 0, converted: 0, count: 0, noRate: 0 };
    o.amount = r2(o.amount + (+r.amount || 0)); o.count++;
    if (c === homeCur) o.converted = r2(o.converted + (+r.amount || 0)); else if (+r.fxRate > 0) o.converted = r2(o.converted + home(r)); else o.noRate++;
    by.set(c, o);
  }
  return [...by.values()].sort((a, b) => (a.currency === homeCur ? -1 : b.currency === homeCur ? 1 : a.currency.localeCompare(b.currency)));
}

/* What the claim pack schedule says beyond the receipt lines: receipts the doctor does not have (with the reason) and
   receipts flagged by the tax-invoice check. Shared by the CSV, the printed pack and the email body. */
function packNotes(list, receipts) {
  const missing = (list || []).filter(i => i.status !== 'ok'), flagged = [];
  (receipts || []).forEach((r, i) => { const f = taxFlags(r); if (f.length) flagged.push({ ref: 'R' + (i + 1), vendor: r.vendor || r.category || 'Receipt', flags: f }); });
  const lines = [];
  if (missing.length) lines.push('Receipts not attached:', ...missing.map(i => `- ${i.label}: ${i.status === 'waived' ? 'I don\'t have this receipt. Reason: ' + i.reason : 'not added yet (no reason given)'}`));
  if (flagged.length) { if (lines.length) lines.push(''); lines.push('Tax invoice check (Australian receipts):', ...flagged.map(x => `- ${x.ref} ${x.vendor}: ${x.flags.map(f => f.t).join('; ')}`)); }
  const csvRows = [...missing.map(i => ['Missing receipt', i.label, i.status === 'waived' ? 'Reason: ' + i.reason : 'Not added yet']), ...flagged.map(x => ['Tax invoice check', x.ref + ' ' + x.vendor, x.flags.map(f => f.t).join('; ')])];
  return { missing, flagged, lines, csvRows };
}

const api = { evaluate, leaveDays, buildEml, safeName, u8b64, abnValid, normAbn, fmtAbn, taxFlags, taxHelp, checklist, missingOf, currencyTotals, packNotes, CHECK };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HoggyPack = api;
})(typeof window !== 'undefined' ? window : globalThis);
