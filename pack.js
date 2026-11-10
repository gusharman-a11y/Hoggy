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

const api = { evaluate, leaveDays, buildEml, safeName, u8b64 };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HoggyPack = api;
})(typeof window !== 'undefined' ? window : globalThis);
