/* Hoggy — medical conference scanner. Vanilla JS, no build. State in localStorage, receipt files in IndexedDB. */
(function () {
'use strict';
const CONFS = (window.HOGGY_CONFERENCES || []).slice();
const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const uid = () => Math.random().toString(36).slice(2, 10);
const cpdLabel = c => c.cpdVerified && c.cpdHours ? c.cpdHours + ' CPD hrs' : 'CPD: check organiser';
const FLAG = cc => /^[A-Za-z]{2}$/.test(cc || '') ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : '';

/* ---------- icons ---------- */
const I = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plane: '<path d="M2 16l20-6-3-3-6 2L8 3 6 4l3 7-5 2-2 3z"/>',
  receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  claim: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 12l3 3 5-6"/>',
  cpd: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2L10 21h4l.6-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/>',
  heart: '<path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.700-8 11-8 11z"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'
};
const icon = (n, c = 'ico') => `<svg class="${c}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;

/* ---------- storage ---------- */
const KEY = 'hoggy.v1';
const defaults = () => ({
  profile: { name: '', specialty: 'General Practice', country: 'Australia', city: 'Sydney', homeAirport: 'SYD', currency: 'AUD', cpdTarget: 50, cpdBody: 'RACGP', cpdYear: new Date().getFullYear(), inbox: 'dr-' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 20) : uid() + uid()), theme: 'auto',
    caps: {}, employer: {} },
  saved: [], trips: [], receipts: [], cpd: [], reviews: [], claims: {}
});
const LEGACY_CAPS = { Meals: 100, 'Ground transport': 150, Accommodation: 450, Flights: 2500, Registration: 4000, Other: 200 };
const hasLegacyCaps = c => c && Object.keys(LEGACY_CAPS).every(k => +c[k] === LEGACY_CAPS[k]);
const OWNER = 'hoggy.owner';
const getOwner = () => { try { return localStorage.getItem(OWNER) || ''; } catch (e) { return ''; } };
const setOwner = v => { try { v ? localStorage.setItem(OWNER, String(v)) : localStorage.removeItem(OWNER); } catch (e) { } };
let S = (() => { try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && v.profile) { const d = defaults(); return { ...d, ...v, profile: { ...d.profile, ...v.profile, caps: { ...d.profile.caps, ...(v.profile.caps || {}) } } }; } } catch (e) {} return defaults(); })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Storage full — export your data'); } scheduleSync(); };
/* IndexedDB for receipt files */
const DB = { db: null,
  open() { return this.db || (this.db = new Promise((res, rej) => { const r = indexedDB.open('hoggy-files', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); },
  async put(k, blob) { const d = await this.open(); return new Promise((res, rej) => { const t = d.transaction('f', 'readwrite'); t.objectStore('f').put(blob, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); },
  async get(k) { const d = await this.open(); return new Promise((res, rej) => { const q = d.transaction('f').objectStore('f').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  async del(k) { const d = await this.open(); return new Promise(res => { const t = d.transaction('f', 'readwrite'); t.objectStore('f').delete(k); t.oncomplete = t.onerror = t.onabort = res; }); },
  async wipe() { try { const d = await this.open(); d.close(); } catch (e) {} this.db = null; return new Promise(res => { const q = indexedDB.deleteDatabase('hoggy-files'); q.onsuccess = q.onerror = q.onblocked = res; }); }
};

/* ---------- helpers ---------- */
const fmtD = (s, o) => { const d = new Date(s + (String(s).length === 10 ? 'T00:00:00' : '')); return isNaN(d) ? '—' : d.toLocaleDateString('en-AU', o || { day: 'numeric', month: 'short', year: 'numeric' }); };
const range = c => { if (c.datesConfirmed === false) return 'Expected ' + new Date(c.start + 'T00:00:00').toLocaleDateString('en-AU', { month: 'short', year: 'numeric' }); const a = new Date(c.start + 'T00:00:00'), b = new Date(c.end + 'T00:00:00'); if (c.end === c.start) return a.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${a.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}` : `${fmtD(c.start, { day: 'numeric', month: 'short' })} – ${fmtD(c.end)}`; };
const money = (n, cur) => { try { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: cur || S.profile.currency, maximumFractionDigits: 2 }).format(n || 0); } catch (e) { return (cur || '') + ' ' + (n || 0).toFixed(2); } };
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const HUES = { Cardiology: 350, Oncology: 300, 'General Practice': 160, 'Emergency Medicine': 15, Neurology: 262, Anaesthesia: 200, Surgery: 5, Paediatrics: 45, Psychiatry: 280, Radiology: 220, Dermatology: 25, 'Critical Care': 340, 'Public Health': 140, Endocrinology: 190, Respiratory: 205, 'Infectious Disease': 95, 'Obstetrics & Gynaecology': 320, Orthopaedics: 30, Ophthalmology: 235, 'Medical Education': 120 };
const hue = c => HUES[c.specialty] ?? hash(c.specialty) % 360;
const grad = c => { const h = hue(c); return `linear-gradient(135deg,hsl(${h} 70% 42%),hsl(${(h + 40) % 360} 75% 28%))`; };
const initials = c => { const m = c.name.match(/\b[A-Z]{2,6}\b/); return m ? m[0] : c.name.split(/\s+/).filter(w => /^[A-Za-z]/.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase(); };
const byId = id => CONFS.find(c => c.id === id);
const ofTrip = t => byId(t.confId);
const stars = r => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
const csv = rows => rows.map(r => r.map(v => { v = String(v ?? ''); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\r\n');
const download = (name, text, type = 'text/csv') => { const a = document.createElement('a'); const u = URL.createObjectURL(new Blob([text], { type })); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1500); };
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 2800); }
const safeUrl = u => { try { const x = new URL(u); return x.protocol === 'https:' ? x.href : '#'; } catch (e) { return '#'; } };

/* ---------- reviews: per conference series (every edition), from the Hoggy server ---------- */
const DIM_LABELS = [['content', 'Content & speakers'], ['networking', 'Networking'], ['venue', 'Venue & organisation'], ['value', 'Value for money'], ['cpd', 'CPD worth']];
const NET = { online: false, user: null, rev: 0, ratings: {}, reviews: {}, mine: [], busy: false };
const SKEYS = new WeakMap(); /* computed once per conference object */
const skey = c => { let k = SKEYS.get(c); if (!k) { k = window.HoggySeries ? window.HoggySeries.seriesKey(c) : c.id; SKEYS.set(c, k); } return k; };
const editionsOf = key => CONFS.filter(c => skey(c) === key).sort((a, b) => a.start.localeCompare(b.start));
const reviewsFor = c => NET.online ? (NET.reviews[skey(c)] || []) : S.reviews.filter(r => r.confId === c.id);
const scoreOf = c => NET.online ? NET.ratings[skey(c)] || null : null;
const scoreShown = c => { const s = scoreOf(c); return s && s.avg != null ? s.avg : null; };
const reviewCount = c => { const s = scoreOf(c); return s ? s.n : 0; };
const rating = c => scoreShown(c);
const reviewedYear = (key, year) => NET.mine.some(r => r.seriesKey === key && r.editionYear === year);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/* ---------- travel links (deep-link search, real booking happens with the partner) ---------- */
const links = (c, from = S.profile.homeAirport || S.profile.city) => window.HoggyStats.travelLinks(c, from);

/* ---------- calendar ---------- */
const icsEsc = v => String(v).replace(/([\\;,])/g, '\\$1').replace(/\r?\n/g, '\\n');
function ics(c) {
  const d = x => x.replace(/-/g, ''), end = new Date(c.end + 'T00:00:00'); end.setDate(end.getDate() + 1);
  const e = `${end.getFullYear()}${String(end.getMonth() + 1).padStart(2, '0')}${String(end.getDate()).padStart(2, '0')}`;
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hoggy//EN', 'BEGIN:VEVENT', `UID:${c.id}@hoggy`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, `DTSTART;VALUE=DATE:${d(c.start)}`, `DTEND;VALUE=DATE:${e}`, `SUMMARY:${icsEsc(c.name)}`, `LOCATION:${icsEsc(c.city + ', ' + c.country)}`, `URL:${c.url}`, `DESCRIPTION:${icsEsc(c.blurb + (c.datesConfirmed === false ? ' (dates estimated, confirm with organiser)' : ''))}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
/* ---------- CPD ---------- */
const NZ = window.HOGGY_CPD_NZ || null;
const themeBoxes = () => NZ ? '<fieldset class="field" style="border:0;padding:0;margin:8px 0 0"><legend style="font-weight:600;margin-bottom:4px">Counts toward (tick what applies)</legend>' + NZ.themes.map(([k, l]) => '<label style="display:inline-flex;gap:6px;margin:4px 14px 4px 0;font-weight:400"><input type="checkbox" name="theme" value="' + k + '"> ' + esc(l) + '</label>').join('') + '</fieldset>' : '';
const themeKeys = f => NZ ? f.getAll('theme').filter(k => NZ.themes.some(t => t[0] === k)) : [];
function nzPanel() {
  if (!NZ) return '';
  const p = S.profile, b = NZ.bodies.find(x => x.id === p.nzBody) || NZ.bodies[0], yr = String(p.cpdYear);
  const es = S.cpd.filter(e => String(e.date).startsWith(yr));
  const themed = NZ.themes.map(([k, l]) => { const m = es.filter(e => (e.themes || []).includes(k)); return { k, l, n: m.length, h: m.reduce((s, e) => s + Number(e.hours || 0), 0) }; });
  const courses = NZ.courses || [];
  return '<div class="panel" style="margin-top:20px"><h3 style="margin:0 0 6px">New Zealand requirements</h3><p style="color:var(--muted);margin:0 0 12px">What your regulator and college ask for, from their own pages (checked ' + esc(NZ.asOf) + '). Pick your college, then tick the themes on each CPD entry so you can see what you have covered in ' + esc(yr) + '.</p>'
    + '<div class="field" style="max-width:420px"><label for="nzBody">Your college</label><select id="nzBody">' + NZ.bodies.map(x => '<option value="' + esc(x.id) + '"' + (x.id === b.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></div>'
    + '<div class="cols" style="margin-top:12px"><div><h4 style="margin:0 0 6px">' + esc(b.name) + ' <span class="pill ' + (b.verified ? 'g' : '') + '">' + (b.verified ? esc(b.total) : 'Not verified') + '</span></h4><ul style="margin:0 0 8px 18px;padding:0">' + b.items.map(i => '<li style="margin:4px 0">' + esc(i) + '</li>').join('') + '</ul>'
    + (b.note ? '<p class="note">' + esc(b.note) + '</p>' : '') + '<p class="note"><a href="' + esc(b.url) + '" target="_blank" rel="noopener noreferrer">Source: college or Council page</a></p>'
    + '<p class="note">' + esc(NZ.teReoNote) + '</p></div>'
    + '<div><h4 style="margin:0 0 6px">Logged this year, by theme</h4><table><tbody>' + themed.map(t => '<tr><td>' + esc(t.l) + '</td><td style="text-align:right">' + t.n + (t.n === 1 ? ' activity' : ' activities') + '</td><td style="text-align:right;font-weight:700">' + t.h + ' h</td></tr>').join('') + '</tbody></table>'
    + '<p class="note">Counts only entries you ticked. Whether an activity counts is your college\'s decision; Hoggy does not assess that.</p></div></div>'
    + (courses.length ? '<h4 style="margin:18px 0 6px">Learning activities for cultural safety, Māori health and te reo</h4><p class="note" style="margin:0 0 8px">Listed from public pages. Check with your college that an activity counts, and how many hours it earns.</p><div class="list">' + courses.map(c => '<a class="li" style="text-decoration:none;color:inherit" href="' + esc(c.url) + '" target="_blank" rel="noopener noreferrer"><div class="grow"><div class="t">' + esc(c.name) + '</div><div class="s">' + esc(c.provider || '') + (c.format ? ' · ' + esc(c.format) : '') + (c.note ? ' · ' + esc(c.note).slice(0, 140) : '') + '</div></div><span class="pill">' + esc(c.type || '') + '</span></a>').join('') + '</div>' : '')
    + '</div>';
}
const cpdTotal = () => S.cpd.filter(e => String(e.date).startsWith(String(S.profile.cpdYear))).reduce((a, e) => a + Number(e.hours || 0), 0);

/* ---------- receipt files: device copy (IndexedDB) plus a server copy when signed in ---------- */
if (hasLegacyCaps(S.profile.caps)) { S.profile.caps = {}; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } window.__capsCleared = true; }
const FILES = new Set(); const UNSAVED = new Set(); let FILES_LOADED = false;
const RH = { 'X-Requested-With': 'hoggy' };
const fileUrl = (k, name) => '/api/rfile/' + encodeURIComponent(k) + (name ? '?name=' + encodeURIComponent(name) : '');
async function upFile(k, blob, name) { try { return (await fetch(fileUrl(k, name), { method: 'PUT', headers: { ...RH, 'Content-Type': blob.type || 'application/octet-stream' }, credentials: 'same-origin', body: blob })).ok; } catch (e) { return false; } }
async function putFile(k, blob, name) { await DB.put(k, blob); FILES.add(k); if (NET.user) { if (await upFile(k, blob, name)) UNSAVED.delete(k); else { UNSAVED.add(k); render(); } } }
async function getFile(k) {
  let b = null; try { b = await DB.get(k); } catch (e) { }
  if (b) return b; if (!NET.user) return null;
  try { const r = await fetch(fileUrl(k), { headers: RH, credentials: 'same-origin' }); if (r.ok) { b = await r.blob(); await DB.put(k, b); FILES.add(k); return b; } } catch (e) { }
  return null;
}
async function delFile(k) { FILES.delete(k); try { await DB.del(k); } catch (e) { } if (NET.user) { try { await fetch(fileUrl(k), { method: 'DELETE', headers: RH, credentials: 'same-origin' }); } catch (e) { } } }
async function syncFiles() { /* learn what is on this device, then reconcile with the server copy */
  try { const d = await DB.open(); (await new Promise((res, rej) => { const q = d.transaction('f').objectStore('f').getAllKeys(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); })).forEach(k => FILES.add(k)); } catch (e) { }
  if (NET.user) {
    const srv = await api('/api/rfiles'), have = new Set(Array.isArray(srv) ? srv : []);
    if (Array.isArray(srv)) for (const r of S.receipts) if (r.fileKey) {
      if (FILES.has(r.fileKey) && !have.has(r.fileKey)) { try { const b = await DB.get(r.fileKey); if (b && await upFile(r.fileKey, b, r.fileName)) UNSAVED.delete(r.fileKey); else UNSAVED.add(r.fileKey); } catch (e) { UNSAVED.add(r.fileKey); } }
      else if (!FILES.has(r.fileKey) && have.has(r.fileKey)) await getFile(r.fileKey);
    }
  }
  FILES_LOADED = true; bgRender();
}
async function openFile(r) {
  const b = r.fileKey && await getFile(r.fileKey); if (!b) return toast('This receipt file is not on this device. Sign in to restore it, or attach it again.');
  const u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = r.fileName || ('receipt-' + r.id); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 30000);
}
/* ---------- receipts: parsing, checks ---------- */
const CATS = ['Flights', 'Accommodation', 'Registration', 'Ground transport', 'Meals', 'Other'];
const parseReceipt = t => window.HoggyParse.parseReceipt(t, S.profile.currency);
const claimAmt = r => Math.max(0, homeAmt(r) - (+r.personal || 0));
const homeAmt = r => (!r.currency || r.currency === S.profile.currency) ? (r.amount || 0) : (r.amount || 0) * (+r.fxRate || 0);
function receiptIssues(r) {
  const issues = [], trip = S.trips.find(t => t.id === r.tripId), c = trip && ofTrip(trip);
  if (!r.fileKey) issues.push({ lvl: 'bad', t: 'No receipt image or PDF attached' });
  else if (FILES_LOADED && !FILES.has(r.fileKey)) issues.push({ lvl: 'bad', t: NET.user ? 'File missing on this device and not found in your account. Attach it again' : 'File missing on this device. Sign in to restore it, or attach it again' });
  else if (NET.user && UNSAVED.has(r.fileKey)) issues.push({ lvl: 'warn', t: 'Not backed up to your account yet. It will retry; keep a copy elsewhere until it does' });
  if (!(r.amount > 0)) issues.push({ lvl: 'bad', t: 'Amount missing' });
  if (!r.date) issues.push({ lvl: 'bad', t: 'Date missing' });
  if (!r.tripId) issues.push({ lvl: 'bad', t: 'Not linked to a trip' });
  if (c && r.date && r.category !== 'Flights' && r.category !== 'Registration') { const a = new Date(c.start + 'T00:00:00') - 864e5 * 3, b = new Date(c.end + 'T00:00:00').getTime() + 864e5 * 3, d = new Date(r.date + 'T00:00:00'); if (d < a || d > b) issues.push({ lvl: 'warn', t: 'Dated outside the conference window (±3 days)' }); }
  const dup = S.receipts.find(o => o.id !== r.id && o.vendor === r.vendor && o.amount === r.amount && o.date === r.date);
  if (dup) issues.push({ lvl: 'warn', t: 'Possible duplicate of another receipt' });
  if (r.currency && r.currency !== S.profile.currency && !(+r.fxRate > 0)) issues.push({ lvl: 'bad', t: `Add the exchange rate from ${r.currency} to ${S.profile.currency}` });
  return issues;
}
const ready = r => !receiptIssues(r).some(i => i.lvl === 'bad');

/* ---------- router / shell ---------- */
const ROUTES = { home: ['Home', 'home'], discover: ['Discover', 'search'], trips: ['Trips', 'plane'], receipts: ['Receipts', 'receipt'], claims: ['Claims', 'claim'], cpd: ['CPD', 'cpd'], settings: ['Settings', 'gear'] };
const reviewHash = () => { const m = location.hash.match(/^#\/review\/([a-z0-9-]{1,80})$/); return m ? m[1] : null; };
const route = () => { if (reviewHash()) return 'discover'; const r = (location.hash.replace(/^#\/?/, '') || 'home').split('?')[0]; return Object.prototype.hasOwnProperty.call(ROUTES, r) ? r : 'home'; };
/* share links (#/review/<seriesKey>) open the review form straight away, after sign-in if needed */
function openReviewLink() { const k = reviewHash(); if (!k || !NET.booted) return; if (!startReview(k)) history.replaceState(null, '', '#/discover'); }
function renderNav() {
  renderAcct();
  const cur = route(), open = S.receipts.filter(r => r.status === 'captured').length;
  $('#nav').innerHTML = Object.entries(ROUTES).map(([k, [l, ic]]) => `<a href="#/${k}" ${k === cur ? 'aria-current="page"' : ''}>${icon(ic)}<span>${l}</span>${k === 'receipts' && open ? `<span class="badge">${open}</span>` : ''}</a>`).join('');
  $('#savedList').innerHTML = S.saved.map(byId).filter(Boolean).slice(0, 12).map(c => `<button data-act="open" data-id="${esc(c.id)}"><span class="mini" style="background:${grad(c)}"></span><span class="t">${esc(c.name)}</span></button>`).join('') || '<div class="saved-title" style="text-transform:none;letter-spacing:0;font-weight:400">Tap the heart on a conference to save it.</div>';
}
function applyTheme() { const t = S.profile.theme; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }
/* background refresh (data arrived from the server): keep the scroll position and never wipe a field the user is typing in */
function bgRender() {
  if (route() === 'discover' && $('#results')) { renderNav(); results(); return; }
  const a = document.activeElement; if (a && $('#main').contains(a) && a.matches('input,textarea,select')) { a.addEventListener('blur', () => setTimeout(bgRender, 0), { once: true }); return; }
  const y = window.scrollY; render(); if (window.scrollY !== y) window.scrollTo(0, y);
}
function render() { applyTheme(); renderNav(); const r = route(); $('#main').innerHTML = VIEWS[r](); (AFTER[r] || (() => { }))(); document.title = `${ROUTES[r][0]} · Hoggy`; }

/* ---------- cards ---------- */
const holPill = c => { if (typeof holHits !== 'function') return ''; const h = holHits(c, 'ANZ'); return h.length ? `<span class="pill g" title="${esc('School holidays overlap this conference in: ' + h.map(r => r.name).join(', '))}">School hols: ${esc(h.map(r => r.code).join(' '))}</span>` : ''; };
function card(c) {
  const on = S.saved.includes(c.id), r = rating(c);
  return `<article class="card" tabindex="0" role="button" data-act="open" data-id="${esc(c.id)}" aria-label="${esc(c.name)}">
    <div class="art" style="background:${grad(c)}"><b>${esc(initials(c))}</b><span class="cc">${FLAG(c.countryCode)} ${esc(c.countryCode)}</span>
      <button class="save ${on ? 'on' : ''}" data-act="save" data-id="${esc(c.id)}" aria-label="${on ? 'Unsave' : 'Save'} ${esc(c.name)}" aria-pressed="${on}">${icon('heart')}</button></div>
    <div><h3>${esc(c.name)}</h3><div class="meta"><span>${esc(c.city)}, ${esc(c.country)}</span><span>${esc(range(c))}</span></div></div>
    <div class="pills"><span class="pill ${c.cpdVerified && c.cpdHours ? 'g' : ''}" title="${c.cpdVerified ? 'Credits stated by the organiser' : 'Credits not confirmed — ask the organiser'}">${esc(cpdLabel(c))}</span><span class="pill">${esc(c.specialty)}</span>${holPill(c)}<span class="pill">${scoreShown(c) != null ? '<span class="stars">★</span> ' + scoreShown(c).toFixed(1) : reviewCount(c) ? reviewCount(c) + ' early review' + (reviewCount(c) > 1 ? 's' : '') : 'New'}</span></div></article>`;
}

/* ---------- views ---------- */
const upcoming = () => CONFS.filter(c => new Date(c.end + 'T23:59:59') >= new Date()).sort((a, b) => a.start.localeCompare(b.start));
const matchScore = c => (c.specialty === S.profile.specialty ? 50 : 0) + (c.country === S.profile.country ? 25 : 0) + (c.region === 'Asia-Pacific' ? 5 : 0) + c.cpdHours;
const VIEWS = {
  home() {
    const p = S.profile, trips = S.trips.filter(t => t.status === 'planned').sort((a, b) => ofTrip(a).start.localeCompare(ofTrip(b).start)), next = trips[0];
    const unclaimed = S.receipts.filter(r => r.status === 'captured').reduce((a, r) => a + homeAmt(r), 0), pending = S.receipts.filter(r => r.status === 'claimed').reduce((a, r) => a + homeAmt(r), 0);
    const tot = cpdTotal(), pct = Math.min(100, Math.round(tot / (p.cpdTarget || 1) * 100));
    const active = S.trips.length || S.receipts.length || S.cpd.length;
    const HS = window.HoggyStats, st = HS ? HS.homeStats(CONFS, today()) : null, examples = HS ? HS.exampleConfs(CONFS, today(), 4) : upcoming().slice(0, 4), n = v => Number(v).toLocaleString('en-AU');
    const dash = `<section class="hero hero-dash"><h1>${p.name ? 'Welcome back, ' + esc(p.name.split(' ')[0]) + '.' : 'Welcome back.'}</h1>
      <p>Your conferences, trips, receipts and CPD in one place.</p>
      <div class="row"><a class="btn primary" href="#/discover">Find conferences</a><a class="btn ghost" href="#/receipts">Add a receipt</a></div></section>
    <div class="tiles">
      <a class="tile" href="#/trips"><div class="k">Next trip</div><div class="v" style="font-size:22px;line-height:1.15">${next ? esc(ofTrip(next).name) : 'None planned'}</div><div class="s">${next ? esc(ofTrip(next).city) + ' · ' + esc(range(ofTrip(next))) : 'Plan one from Discover'}</div></a>
      <a class="tile" href="#/cpd"><div class="k">CPD ${esc(p.cpdYear)}</div><div class="v">${tot}<span style="font-size:18px;color:var(--muted)"> / ${esc(p.cpdTarget)} h</span></div><div class="bar" style="margin-top:10px"><i style="width:${pct}%"></i></div></a>
      <a class="tile" href="#/claims"><div class="k">Not yet claimed</div><div class="v">${money(unclaimed)}</div><div class="s">${S.receipts.filter(r => r.status === 'captured').length} receipts waiting</div></a>
      <a class="tile" href="#/claims"><div class="k">Awaiting reimbursement</div><div class="v">${money(pending)}</div><div class="s">Submitted, not yet paid</div></a></div>
    <div class="section"><h2>Picked for ${esc(p.specialty)}</h2><a href="#/discover">See all</a></div>
    <div class="grid">${upcoming().sort((a, b) => matchScore(b) - matchScore(a)).slice(0, 4).map(card).join('') || '<div class="empty">Conference data is loading or missing.</div>'}</div>`;
    const hero = `<section class="hero hero-intro"><span class="eyebrow">Medical conference planner</span>
      <h1>Find the conference. Hoggy handles the admin.</h1>
      <p>For doctors and clinicians who travel for CPD: find a meeting, plan the trip, keep every receipt and hand your hospital or employer a claim-ready pack.</p>
      <div class="row"><a class="btn primary lg" href="#/discover">Find conferences</a><button type="button" class="btn ghost lg" data-act="howto">See how it works</button></div></section>`;
    const steps = [
      ['search', 'Find a conference', 'Search by specialty, country, month and CPD. Each listing says whether its dates are confirmed by the organiser or still an estimate.'],
      ['plane', 'Plan the trip', 'Save it as a trip. Hoggy opens flight and hotel searches prefilled with your dates, and you book with the provider.'],
      ['receipt', 'Forward or snap receipts', 'Forward booking emails to your private Hoggy address, or add a PDF or photo. Hoggy reads the amount and date where it can and suggests the trip.'],
      ['claim', 'Claim-ready pack, CPD logged', 'Missing details are flagged before you export. Print or email the pack, then mark the trip attended to log your CPD hours.']];
    const how = `<section class="how" id="how" tabindex="-1" aria-labelledby="howH"><div class="section"><h2 id="howH">How it works</h2></div>
      <ol class="steps">${steps.map(([ic, t, d], i) => `<li class="step"><div class="step-top"><span class="step-n">${i + 1}</span>${icon(ic)}</div><h3>${t}</h3><p>${d}</p></li>`).join('')}</ol></section>`;
    const benefits = [
      ['One place for the whole trip', 'The conference, your bookings, receipts and CPD sit together, so nothing lives in a stray inbox folder.'],
      ['A claim pack your employer can check', 'Every receipt needs a file, amount, date and trip before export. Print it, email it or download a CSV.'],
      ['CPD hours tracked as you go', 'Log hours from conferences and courses and see progress against your yearly target. Export the log for your college.'],
      ['Dates you can check', 'Confirmed dates come from the organiser\'s own page, with the link and the date Hoggy checked it. Estimates are labelled.']];
    const ben = `<section aria-labelledby="benH"><div class="section"><h2 id="benH">What you get</h2></div>
      <div class="benefits">${benefits.map(([t, d]) => `<div class="benefit"><span class="tick" aria-hidden="true">✓</span><div><h3>${t}</h3><p>${d}</p></div></div>`).join('')}</div></section>`;
    const live = st && st.conferences ? `<section class="live" aria-labelledby="liveH"><div class="live-head"><h2 id="liveH">Live data</h2><span>Counted from Hoggy's conference list just now</span></div>
      <dl class="live-grid"><div><dt>Upcoming conferences</dt><dd>${n(st.conferences)}</dd></div><div><dt>Countries</dt><dd>${n(st.countries)}</dd></div><div><dt>Specialties</dt><dd>${n(st.specialties)}</dd></div><div><dt>Dates confirmed by organiser</dt><dd>${st.confirmedPct}%</dd><span class="live-sub">${n(st.confirmed)} of ${n(st.conferences)}. The rest are estimates and say so.</span></div></dl></section>` : '';
    const ex = examples.length ? `<div class="section"><h2>Coming up, dates confirmed</h2><a href="#/discover">Browse all</a></div><div class="grid ex">${examples.map(card).join('')}</div>` : '';
    const close = `<section class="hero hero-close"><h2>Ready for your next conference?</h2><p>Start with a search. No account needed to browse; sign in when you want your trips and receipts synced.</p>
      <div class="row"><a class="btn primary lg" href="#/discover">Find conferences</a>${NET.online && !NET.user ? '<button type="button" class="btn ghost lg" data-act="signin">Sign in</button>' : ''}</div></section>`;
    return active ? dash + how + ben + live : hero + how + ben + live + ex + close;
  },
  discover() {
    const specs = [...new Set(CONFS.map(c => c.specialty))].sort(), regs = [...new Set(CONFS.map(c => c.region))].sort(), ctry = [...new Set(CONFS.map(c => c.country))].sort();
    return `<div class="page-head"><div><h1>Discover</h1><p>${CONFS.length} conferences worldwide, mostly 2027. Filter by specialty, country, month and CPD value.</p></div></div>
    <div class="filters"><label class="search">${icon('search')}<input id="q" type="search" placeholder="Search conferences, cities, organisers…" aria-label="Search conferences" autocomplete="off"></label>
      <div class="chips" id="specChips" role="group" aria-label="Specialty"><button class="chip" aria-pressed="true" data-spec="All">All</button>${specs.map(s => `<button class="chip" aria-pressed="false" data-spec="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <div class="selects"><select id="fRegion" aria-label="Region"><option value="">All regions</option>${regs.map(r => `<option>${esc(r)}</option>`).join('')}</select>
        <select id="fCountry" aria-label="Country"><option value="">All countries</option>${ctry.map(r => `<option>${esc(r)}</option>`).join('')}</select>
        <select id="fMonth" aria-label="Month"><option value="">Any month</option>${Array.from({ length: 12 }, (_, i) => `<option value="${i}">${new Date(2027, i, 1).toLocaleDateString('en-AU', { month: 'long' })}</option>`).join('')}</select>
        ${HOL.length ? `<select id="fHol" aria-label="School holidays"><option value="">Any time of year</option><option value="ANZ">In any AU or NZ school holidays</option><option value="AU">In any Australian school holidays</option>${HOL.map(r => `<option value="${esc(r.code)}">In ${esc(r.name)} school holidays</option>`).join('')}</select>` : ''}
        <select id="fCpd" aria-label="CPD credits"><option value="0">Any CPD</option><option value="1">CPD credits published</option></select>
        <select id="fConf" aria-label="Date status"><option value="">Any dates</option><option value="1">Confirmed dates only</option></select>
        <select id="fSort" aria-label="Sort"><option value="date">Soonest</option><option value="rating">Top rated</option><option value="cpd">Most CPD (published)</option><option value="price">Lowest price</option><option value="match">Best match</option></select>
        <span class="count" id="count"></span></div></div>
    <div class="grid" id="results"></div>`;
  },
  trips() {
    const ts = S.trips.slice().sort((a, b) => ofTrip(a).start.localeCompare(ofTrip(b).start));
    return `<div class="page-head"><div><h1>Trips</h1><p>Plan travel, log bookings and mark conferences attended to bank your CPD.</p></div><a class="btn primary" href="#/discover">${icon('plus')} Add a conference</a></div>` +
      (ts.length ? ts.map(t => { const c = ofTrip(t), L = links(c, t.from || undefined), spent = S.receipts.filter(r => r.tripId === t.id).reduce((a, r) => a + homeAmt(r), 0), booked = (t.bookings || []).reduce((a, b) => a + Number(b.amount || 0), 0);
        return `<div class="panel"><div class="row" style="justify-content:space-between;align-items:flex-start"><div class="row" style="gap:14px;align-items:flex-start"><div class="thumb" style="width:64px;height:64px;background:${grad(c)};color:#fff;font-weight:800">${esc(initials(c))}</div><div><h3 style="margin:0">${esc(c.name)}</h3><div class="s" style="color:var(--muted)">${FLAG(c.countryCode)} ${esc(c.city)}, ${esc(c.country)} · ${esc(range(c))}</div><div class="pills" style="margin-top:8px"><span class="pill ${t.status === 'attended' ? 'g' : 'w'}">${t.status === 'attended' ? 'Attended' : 'Planned'}</span><span class="pill ${c.cpdVerified && c.cpdHours ? 'g' : ''}">${esc(cpdLabel(c))}</span><span class="pill">Booked ${money(booked)}</span><span class="pill">Receipts ${money(spent)}</span></div></div></div>
          <div class="row"><button class="btn sm" data-act="open" data-id="${esc(c.id)}">Details</button>${t.status === 'planned' ? `<button class="btn sm primary" data-act="attend" data-id="${esc(t.id)}">Mark attended</button>` : ''}<button class="btn sm danger" data-act="rmtrip" data-id="${esc(t.id)}">Remove</button></div></div>
          ${NET.online && c.end < today() && !reviewedYear(skey(c), +c.start.slice(0, 4)) ? `<div class="rv-prompt"><span><b>How was it?</b> Review it in a minute. It helps colleagues choose.</span><button class="btn sm primary" data-act="review" data-id="${esc(c.id)}" data-year="${esc(c.start.slice(0, 4))}">Review ${esc(c.start.slice(0, 4))}</button></div>` : ''}
          <div class="row" style="margin-top:16px"><label class="from-field">Flying from <input type="text" data-from="${esc(t.id)}" value="${esc(t.from || S.profile.homeAirport || S.profile.city || '')}" maxlength="40" placeholder="City or airport" aria-label="Flying from (city or airport code) for ${esc(c.name)}"></label><a class="btn sm" target="_blank" rel="noopener noreferrer" data-flights="${esc(t.id)}" href="${esc(L.flights)}">✈ Search flights ${icon('ext')}</a><a class="btn sm" target="_blank" rel="noopener noreferrer" href="${esc(L.hotels)}">🛏 Search hotels ${icon('ext')}</a><button class="btn sm ghost" data-act="addbook" data-id="${esc(t.id)}">${icon('plus')} Log a booking</button><button class="btn sm ghost" data-act="addreceipt" data-id="${esc(t.id)}">${icon('receipt')} Add receipt</button></div>
          ${(t.bookings || []).length ? `<div class="list" style="margin-top:12px">${t.bookings.map(b => `<div class="li"><div class="grow"><div class="t">${esc(b.type)} · ${esc(b.vendor)}</div><div class="s">Ref ${esc(b.ref || '—')} · ${esc(b.date ? fmtD(b.date) : '')}</div></div><div class="amt">${money(b.amount)}</div><button class="icon-btn" data-act="rmbook" data-id="${esc(t.id)}" data-b="${esc(b.id)}" aria-label="Remove booking">${icon('x')}</button></div>`).join('')}</div>` : ''}</div>`; }).join('')
        : `<div class="empty"><h3>No trips yet</h3><p>Save a conference and hit “Plan trip” to start. Hoggy prefills flight and hotel searches for the exact dates.</p><p style="margin-top:16px"><a class="btn primary" href="#/discover">Browse conferences</a></p></div>`) +
      `<p class="note">Hoggy opens prefilled search pages with Google Flights and Booking.com. You complete the purchase with the provider, then log the booking and forward the receipt here.</p>`;
  },
  receipts() {
    const rs = S.receipts.slice().sort((a, b) => (b.created || 0) - (a.created || 0)), addr = NET.user ? NET.user.inbox : '';
    return `<div class="page-head"><div><h1>Receipts</h1><p>Every receipt in one place, checked against your claim rules the moment it arrives.</p></div><button class="btn primary" data-act="addreceipt">${icon('plus')} Add receipt</button></div>
    <div class="cols"><div>
      <div class="drop" id="drop"><p style="color:var(--text);font-weight:700;font-size:17px">Drop receipts here</p><p style="margin-top:4px">PDF, JPG or PNG — or paste a forwarded email in the add dialog.</p><p style="margin-top:14px"><button class="btn" data-act="addreceipt">Choose files</button></p></div>
      <div class="panel" style="margin-top:14px"><h3>${rs.length} receipt${rs.length === 1 ? '' : 's'}</h3>${rs.length ? `<div class="list">${rs.map(r => { const iss = receiptIssues(r), bad = iss.filter(i => i.lvl === 'bad').length, trip = S.trips.find(t => t.id === r.tripId);
        return `<div class="li"><div class="thumb" data-file="${esc(r.fileKey || '')}">${icon('file')}</div><div class="grow"><div class="t">${esc(r.vendor || 'Unnamed')}</div><div class="s">${esc(r.category)} · ${esc(r.date ? fmtD(r.date) : 'no date')}${trip ? ' · ' + esc(ofTrip(trip).name) : ''}</div>${iss.slice(0, 2).map(i => `<div class="check ${i.lvl}">${i.lvl === 'bad' ? '✕' : '!'} ${esc(i.t)}</div>`).join('')}</div><div style="text-align:right"><div class="amt">${money(r.amount, r.currency)}</div><span class="status ${esc(r.status)}">${esc(r.status === 'captured' ? (bad ? 'Needs info' : 'Ready') : r.status)}</span></div>${r.fileKey ? `<button class="icon-btn" data-act="openfile" data-id="${esc(r.id)}" aria-label="Download receipt file" title="Download receipt file">${icon('file')}</button>` : ''}<button class="icon-btn" data-act="editreceipt" data-id="${esc(r.id)}" aria-label="Edit receipt">${icon('gear')}</button></div>`; }).join('')}</div>` : '<div class="empty"><h3>Nothing yet</h3><p>Forward an email or drop a file to get started.</p></div>'}</div></div>
    <div><div class="panel"><h3>Your forwarding address</h3>${addr ? `<div class="copybox"><span style="flex:1">${esc(addr)}</span><button class="icon-btn" data-act="copy" data-v="${esc(addr)}" aria-label="Copy address">${icon('copy')}</button></div><p class="note">Auto-forward travel and booking emails here. They land in your Receipts within a minute with the vendor, amount and date read for you and a suggested trip, which you confirm.</p><p style="margin-top:10px"><button class="btn sm" data-act="checkinbox">Check inbox now</button></p>` : `<p style="color:var(--muted)">${NET.online ? 'Sign in to get your personal forwarding address.' : 'The Hoggy server is not running, so email forwarding is off. Paste emails or drop files instead.'}</p>${NET.online ? '<p style="margin-top:10px"><button class="btn sm primary" data-act="signin">Sign in</button></p>' : ''}`}</div>
      <div class="panel"><h3>How Hoggy makes your claim claim-ready</h3>${['Every receipt must have a file, amount, date and trip','Amounts are checked against the caps you enter in Settings, and dates against the conference window','Duplicates and foreign currency are flagged','Export and submit unlock once every receipt has its file, amount, date and trip'].map(t => `<div class="check ok">✓ ${esc(t)}</div>`).join('')}</div></div></div>`;
  },
  claims() {
    const ts = S.trips.filter(t => S.receipts.some(r => r.tripId === t.id));
    const orphan = S.receipts.filter(r => !r.tripId);
    return `<div class="page-head"><div><h1>Claims</h1><p>One claim per trip. Fix what's flagged, export the pack, then track it to reimbursement.</p></div></div>` +
      (orphan.length ? `<div class="panel"><div class="check warn">! ${orphan.length} receipt${orphan.length > 1 ? 's are' : ' is'} not linked to a trip and can't be claimed. <a href="#/receipts" style="text-decoration:underline">Fix in Receipts</a></div></div>` : '') +
      (ts.length ? ts.map(t => { const c = ofTrip(t), rs = S.receipts.filter(r => r.tripId === t.id), tot = rs.reduce((a, r) => a + claimAmt(r), 0), rd = rs.filter(ready).length, pct = Math.round(rd / rs.length * 100), allReady0 = rd === rs.length, pol = policyFor(t, rs), allReady = allReady0 && !pol.some(i => i.lvl === 'bad'), claim = S.claims[t.id] || {}, st = rs.every(r => r.status === 'paid') ? 'paid' : rs.some(r => r.status === 'claimed' || r.status === 'paid') ? 'claimed' : 'draft';
        const cats = CATS.map(k => [k, rs.filter(r => r.category === k).reduce((a, r) => a + claimAmt(r), 0)]).filter(x => x[1]);
        return `<div class="panel"><div class="row" style="justify-content:space-between"><div><h3 style="margin:0">${esc(c.name)}</h3><div class="s" style="color:var(--muted)">${esc(c.city)} · ${esc(range(c))}</div></div><div style="text-align:right"><div style="font-size:28px;font-weight:800;letter-spacing:-.04em">${money(tot)}</div><span class="status ${st === 'draft' ? 'captured' : st}">${st === 'draft' ? 'Draft' : st === 'claimed' ? 'Submitted' : 'Reimbursed'}</span></div></div>
          <div class="row" style="margin:14px 0 6px;justify-content:space-between"><span style="font-weight:600">Claim readiness</span><span style="color:${allReady ? 'var(--ok)' : 'var(--warn)'};font-weight:700">${rd}/${rs.length} receipts ready</span></div><div class="bar"><i class="${allReady ? '' : 'warn'}" style="width:${pct}%"></i></div>
          ${rs.filter(r => !ready(r)).map(r => `<div class="check bad">✕ ${esc(r.vendor || 'Receipt')}: ${esc(receiptIssues(r).filter(i => i.lvl === 'bad').map(i => i.t).join(', '))} <a href="#/receipts" data-act="editreceipt" data-id="${esc(r.id)}" style="text-decoration:underline;margin-left:6px">Fix</a></div>`).join('')}
          ${pol.map(i => `<div class="check ${i.lvl}">${i.lvl === 'bad' ? '✕' : '!'} ${esc(i.t)}</div>`).join('')}
          <div class="pills" style="margin-top:14px">${cats.map(([k, v]) => `<span class="pill">${esc(k)} ${money(v)}</span>`).join('')}</div>
          <div class="row" style="margin-top:16px"><button class="btn sm" data-act="exportcsv" data-id="${esc(t.id)}" ${allReady ? '' : 'disabled'}>Export CSV</button><button class="btn sm" data-act="printpack" data-id="${esc(t.id)}" ${allReady ? '' : 'disabled'}>Print claim pack</button><button class="btn sm primary" data-act="emailpack" data-id="${esc(t.id)}" ${allReady ? '' : 'disabled'}>Email to claims admin</button><button class="btn sm" data-act="mailtopack" data-id="${esc(t.id)}" ${allReady ? '' : 'disabled'} title="For webmail: downloads the schedule and opens a prefilled email; you attach the files">Webmail instead</button>
            ${st === 'draft' || rs.some(r => r.status === 'captured') ? `<button class="btn sm primary" data-act="submitclaim" data-id="${esc(t.id)}" ${allReady ? '' : 'disabled'}>Mark submitted</button>` : ''}${st === 'claimed' ? `<button class="btn sm primary" data-act="paidclaim" data-id="${esc(t.id)}">Mark reimbursed</button>` : ''}</div>
          ${claim.submitted ? `<p class="note">Submitted ${esc(fmtD(claim.submitted))}${claim.paid ? ' · reimbursed ' + esc(fmtD(claim.paid)) : ''}</p>` : ''}</div>`; }).join('')
        : `<div class="empty"><h3>No claims yet</h3><p>Add receipts to a trip and they'll appear here with a readiness check.</p></div>`);
  },
  cpd() {
    const p = S.profile, tot = cpdTotal(), pct = Math.min(100, Math.round(tot / (p.cpdTarget || 1) * 100)), es = S.cpd.slice().sort((a, b) => b.date.localeCompare(a.date)), left = Math.max(0, p.cpdTarget - tot);
    const fut = upcoming().filter(c => c.specialty === p.specialty || true).sort((a, b) => b.cpdHours - a.cpdHours).slice(0, 4);
    return `<div class="page-head"><div><h1>CPD tracker</h1><p>Hours banked automatically when you mark a conference attended. Add anything else manually.</p></div><div class="row"><button class="btn" data-act="exportcpd">Export log</button><button class="btn primary" data-act="addcpd">${icon('plus')} Add entry</button></div></div>
    <div class="cols"><div class="panel"><div class="row" style="gap:28px"><div class="ring" style="--p:${pct}"><span>${tot}<small>of ${esc(p.cpdTarget)} hrs</small></span></div><div><h3 style="margin:0 0 6px">${esc(p.cpdYear)} target · ${esc(p.cpdBody || 'your college')}</h3><p style="color:var(--muted)">${left ? `${left} hours to go.` : 'Target reached 🎉'}</p><p class="note">Change the target and body in Settings. Check your college's rules for how conference hours are weighted.</p></div></div>
      <h3 style="margin-top:26px">Log</h3>${es.length ? `<table><thead><tr><th>Date</th><th>Activity</th><th>Source</th><th style="text-align:right">Hours</th><th></th></tr></thead><tbody>${es.map(e => `<tr><td>${esc(fmtD(e.date))}</td><td>${esc(e.title)}</td><td><span class="pill ${e.source === 'conference' ? 'g' : ''}">${esc(e.source)}</span></td><td style="text-align:right;font-weight:700">${esc(e.hours)}</td><td><button class="icon-btn" data-act="rmcpd" data-id="${esc(e.id)}" aria-label="Delete entry">${icon('x')}</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty"><h3>No hours logged</h3><p>Mark a trip attended or add an entry.</p></div>'}</div>
    <div><div class="panel"><h3>Close the gap</h3><p style="color:var(--muted);margin-bottom:10px">Upcoming conferences with published credits (otherwise soonest in your field):</p><div class="list">${fut.map(c => `<div class="li" style="cursor:pointer" tabindex="0" role="button" data-act="open" data-id="${esc(c.id)}"><div class="thumb" style="background:${grad(c)}"></div><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${esc(c.city)} · ${esc(range(c))}</div></div><span class="pill">${c.cpdVerified && c.cpdHours ? esc(c.cpdHours) + 'h' : 'CPD?'}</span></div>`).join('')}</div></div></div></div>${nzPanel()}`;
  },
  settings() {
    const p = S.profile, specs = [...new Set(CONFS.map(c => c.specialty))].sort();
    return `<div class="page-head"><div><h1>Settings</h1><p>Your profile drives recommendations, CPD targets and claim checks. Employer details such as your employee ID and approver stay on this device only. Trips, receipts and CPD sync with your account when you sign in.</p></div></div>
    <div class="cols"><div class="panel"><h3>Profile</h3><form id="pf"><div class="two"><div class="field"><label for="pn">Name</label><input id="pn" type="text" name="name" value="${esc(p.name)}"></div><div class="field"><label for="ps">Specialty</label><select id="ps" name="specialty">${specs.map(s => `<option ${s === p.specialty ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div></div>
      <div class="two"><div class="field"><label for="pc">Home country</label><input id="pc" type="text" name="country" value="${esc(p.country)}"></div><div class="field"><label for="pci">Home city / airport code</label><input id="pci" type="text" name="homeAirport" value="${esc(p.homeAirport)}"></div></div>
      <div class="two"><div class="field"><label for="pcu">Currency</label><select id="pcu" name="currency">${['AUD', 'NZD', 'USD', 'GBP', 'EUR', 'CAD', 'SGD'].map(s => `<option ${s === p.currency ? 'selected' : ''}>${s}</option>`).join('')}</select></div><div class="field"><label for="pth">Theme</label><select id="pth" name="theme">${['auto', 'dark', 'light'].map(s => `<option ${s === p.theme ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
      <div class="two"><div class="field"><label for="pct">Annual CPD target (hours)</label><input id="pct" type="number" min="1" max="500" name="cpdTarget" value="${esc(p.cpdTarget)}"></div><div class="field"><label for="pcb">CPD body</label><input id="pcb" type="text" name="cpdBody" value="${esc(p.cpdBody)}"></div></div>
      <div class="field"><label for="pcy">CPD year</label><input id="pcy" type="number" name="cpdYear" value="${esc(p.cpdYear)}"></div>
      <h3 style="margin:18px 0 4px">Your employer</h3><p class="note" style="margin:0 0 10px">Used to address claim emails and check receipts. Type figures from your own policy; Hoggy assumes none. Stored on this device only; not sent to Hoggy's server.</p><div class="two">${[['name','Employer / health service','text'],['adminEmail',"Claims admin's email",'email'],['approverName',"Approver's name (head of department)",'text'],['approverEmail',"Approver's email",'email'],['employeeId','Employee ID','text'],['costCentre','Cost centre','text'],['claimDays','Claim within (days after the trip)','number'],['hotelPerNight','Hotel limit per night (' + S.profile.currency + ')','number'],['mealsPerDay','Meals limit per day (' + S.profile.currency + ')','number'],['clause','Policy name and clause (printed beside any limit)','text']].map(([k, l, ty]) => `<div class="field"><label for="emp-${k}">${l}</label><input id="emp-${k}" type="${ty}" data-emp="${k}" ${ty === 'number' ? 'min="0" step="any"' : 'maxlength="120"'} value="${esc((p.employer || {})[k] || '')}"></div>`).join('')}</div><h3 style="margin:18px 0 4px">Expense caps per receipt (optional)</h3><p class="note" style="margin:0 0 10px">Leave blank unless your employer sets a limit. Enter your own policy figures; Hoggy does not assume any.</p><div class="two">${CATS.map(k => `<div class="field"><label for="cap-${esc(k)}">${esc(k)}</label><input id="cap-${esc(k)}" type="number" min="0" data-cap="${esc(k)}" value="${esc(p.caps[k] || '')}"></div>`).join('')}</div>
      <button class="btn primary" type="submit">Save</button></form></div>
    <div>${NET.online ? `<div class="panel acct-panel"><h3>Account</h3>${NET.user ? `<p style="color:var(--muted);margin-bottom:12px">Signed in as ${esc(NET.user.email || NET.user.name)}. Trips, receipts and CPD sync to your account.</p><button class="btn" data-act="signout">Sign out</button>` : '<p style="color:var(--muted);margin-bottom:12px">Sign in to sync your trips, receipts and CPD across devices and get your receipt forwarding address.</p><button class="btn primary" data-act="signin">Sign in or create an account</button>'}</div>` : ''}<div class="panel"><h3>Your data</h3><p style="color:var(--muted);margin-bottom:12px">Stored on this device, and synced with your account if you sign in. Export a backup of your trips, receipts metadata and CPD log.</p><div class="row"><button class="btn" data-act="backup">Download backup</button><button class="btn danger" data-act="wipe">Erase everything</button>${NET.user ? '<button class="btn danger" data-act="delaccount">Delete account</button>' : ''}</div></div></div></div>`;
  }
};

/* ---------- post-render wiring ---------- */
const HOL = (window.HOGGY_HOLIDAYS && window.HOGGY_HOLIDAYS.regions) || [];
const holRegions = code => code === 'AU' ? HOL.filter(r => r.country === 'AU') : code === 'ANZ' ? HOL : HOL.filter(r => r.code === code);
/* the school-holiday regions whose break overlaps this conference (any day of it) */
const holHits = (c, code) => holRegions(code).filter(r => r.holidays.some(h => h.start <= c.end && h.end >= c.start));
const UI = { hol: '', confirmed: '', limit: 48, q: '', spec: 'All', region: '', country: '', month: '', cpd: 0, sort: 'date' };
function results() {
  let L = upcoming();
  const q = UI.q.trim().toLowerCase();
  if (q) L = L.filter(c => [c.name, c.city, c.country, c.organiser, c.specialty, c.blurb].join(' ').toLowerCase().includes(q));
  if (UI.spec !== 'All') L = L.filter(c => c.specialty === UI.spec);
  if (UI.region) L = L.filter(c => c.region === UI.region);
  if (UI.country) L = L.filter(c => c.country === UI.country);
  if (UI.month !== '') L = L.filter(c => new Date(c.start + 'T00:00:00').getMonth() === +UI.month || new Date(c.end + 'T00:00:00').getMonth() === +UI.month);
  if (UI.hol) L = L.filter(c => holHits(c, UI.hol).length);
  if (UI.cpd) L = L.filter(c => c.cpdVerified && c.cpdHours >= UI.cpd);
  if (UI.confirmed) L = L.filter(c => c.datesConfirmed !== false);
  const srt = { date: (a, b) => a.start.localeCompare(b.start), rating: (a, b) => (rating(b) || 0) - (rating(a) || 0), cpd: (a, b) => (b.cpdVerified ? b.cpdHours : 0) - (a.cpdVerified ? a.cpdHours : 0), price: (a, b) => a.priceFrom - b.priceFrom, match: (a, b) => matchScore(b) - matchScore(a) };
  L.sort(srt[UI.sort]);
  $('#count').textContent = `${L.length} result${L.length === 1 ? '' : 's'}`;
  $('#results').innerHTML = L.slice(0, UI.limit).map(card).join('') + (L.length > UI.limit ? `<div style="grid-column:1/-1;text-align:center;padding:14px"><button class="btn" data-act="more">Show more (${L.length - UI.limit} left)</button></div>` : '') || '<div class="empty" style="grid-column:1/-1"><h3>No conferences match</h3><p>Try removing a filter.</p></div>';
}
const AFTER = {
  discover() {
    const sync = () => { $('#q').value = UI.q; $('#fRegion').value = UI.region; $('#fCountry').value = UI.country; $('#fMonth').value = UI.month; $('#fCpd').value = UI.cpd; $('#fConf').value = UI.confirmed; if ($('#fHol')) $('#fHol').value = UI.hol; $('#fSort').value = UI.sort; document.querySelectorAll('[data-spec]').forEach(b => b.setAttribute('aria-pressed', b.dataset.spec === UI.spec)); };
    sync(); results();
    $('#q').addEventListener('input', e => { UI.q = e.target.value; UI.limit = 48; results(); });
    [['fRegion', 'region'], ['fCountry', 'country'], ['fMonth', 'month'], ['fCpd', 'cpd'], ['fConf', 'confirmed'], ['fSort', 'sort'], ['fHol', 'hol']].forEach(([id, k]) => $('#' + id) &&  $('#' + id).addEventListener('change', e => { UI[k] = k === 'cpd' ? +e.target.value : e.target.value; UI.limit = 48; results(); }));
    $('#specChips').addEventListener('click', e => { const b = e.target.closest('[data-spec]'); if (!b) return; UI.spec = b.dataset.spec; UI.limit = 48; sync(); results(); });
  },
  receipts() {
    const dz = $('#drop'); if (!dz) return;
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', e => { const f = [...e.dataTransfer.files]; if (f.length) receiptDialog({ files: f }); });
    document.querySelectorAll('[data-file]').forEach(async el => { const k = el.dataset.file; if (!k) return; try { const b = await getFile(k); if (b && /^image\//.test(b.type)) { const u = URL.createObjectURL(b); el.innerHTML = `<img alt="" src="${u}">`; } } catch (e) {} });
  },
  settings() {
    $('#pf').addEventListener('submit', e => { e.preventDefault(); const f = new FormData(e.target); const p = S.profile;
      ['name', 'specialty', 'country', 'homeAirport', 'currency', 'theme', 'cpdBody'].forEach(k => p[k] = String(f.get(k) || '').slice(0, 80)); p.cpdTarget = Math.max(1, +f.get('cpdTarget') || 50); p.cpdYear = +f.get('cpdYear') || p.cpdYear;
      document.querySelectorAll('[data-cap]').forEach(i => p.caps[i.dataset.cap] = Math.max(0, +i.value || 0));
      p.employer = p.employer || {}; document.querySelectorAll('[data-emp]').forEach(i => { const v = i.type === 'number' ? Math.max(0, +i.value || 0) : String(i.value || '').trim().slice(0, 120); p.employer[i.dataset.emp] = v; }); save(); applyTheme(); toast('Settings saved'); renderNav(); });
  }
};

/* ---------- overlays ---------- */
function openOverlay(html, center) {
  const o = $('#overlay'), wasOpen = !o.hidden, sh = o.querySelector('.sheet'), top = sh ? sh.scrollTop : 0, act = document.activeElement, actKey = act && o.contains(act) ? act.getAttribute('data-act') || act.id : '';
  o.className = 'overlay' + (center ? ' c' : '') + (wasOpen ? ' still' : ''); o.innerHTML = html;
  if (!wasOpen) { o.hidden = false; o._prev = document.activeElement; document.body.style.overflow = 'hidden'; const f = o.querySelector('[autofocus],button.close'); f && f.focus({ preventScroll: true }); return; }
  /* re-render of an open dialog: keep scroll position and focus, no re-animation */
  const ns = o.querySelector('.sheet'); if (ns) ns.scrollTop = top;
  const back = actKey && (o.querySelector(`[data-act="${CSS.escape(actKey)}"]`) || document.getElementById(actKey)); if (back) back.focus({ preventScroll: true });
}
function closeOverlay(keepHash) { if (!keepHash && reviewHash()) history.replaceState(null, '', '#/discover'); const o = $('#overlay'); const pv = o._prev && o._prev.isConnected ? o._prev : null; o._prev = null; o.hidden = true; o.className = 'overlay'; o.innerHTML = ''; document.body.style.overflow = ''; if (pv) pv.focus({ preventScroll: true }); }
function detail(id, fetchReviews = true) {
  const c = byId(id); if (!c) return;
  const on = S.saved.includes(id), trip = S.trips.find(t => t.confId === id), L = links(c), R = reviewsFor(c), r = rating(c);
  openOverlay(`<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(c.name)}"><div class="sheet-wrap"><button class="icon-btn close" data-act="close" aria-label="Close">${icon('x')}</button><div class="art" style="background:${grad(c)}"><b>${esc(initials(c))}</b></div></div>
  <div class="body"><h2>${esc(c.name)}</h2><p style="color:var(--muted)">${esc(c.blurb)}</p>
  <div class="row" style="margin-top:16px"><button class="btn primary" data-act="plan" data-id="${esc(id)}" ${trip ? 'disabled' : ''}>${trip ? 'In your trips' : 'Plan trip'}</button><button class="btn" data-act="leave" data-id="${esc(id)}">Request leave</button><button class="btn ${on ? 'primary' : ''}" data-act="save" data-id="${esc(id)}">${icon('heart')} ${on ? 'Saved' : 'Save'}</button><a class="btn ghost" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(c.url))}">Official site ${icon('ext')}</a></div>
  <div class="facts"><div class="fact"><div class="k">When</div><div class="v">${esc(range(c))}</div><div class="note" style="margin:2px 0 0">${c.datesConfirmed === false ? 'Estimated — confirm with organiser' : 'Dates confirmed by organiser' + (c.lastVerified ? ' · checked ' + esc(c.lastVerified) : '') + (c.sourceUrl && safeUrl(c.sourceUrl) !== '#' ? ` · <a class="u" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(c.sourceUrl))}">source page</a>` : '')}</div></div><div class="fact"><div class="k">Where</div><div class="v">${FLAG(c.countryCode)} ${esc(c.city)}, ${esc(c.country)}</div>${c.datesConfirmed === false ? '<div class="note" style="margin:2px 0 0">City is an estimate until the organiser confirms</div>' : ''}</div><div class="fact"><div class="k">CPD</div><div class="v">${c.cpdVerified && c.cpdHours ? esc(c.cpdHours) + ' hrs' + (c.cpdBody ? ' · ' + esc(c.cpdBody) : '') : 'Not confirmed'}</div>${c.cpdVerified && c.cpdHours ? '' : '<div class="note" style="margin:2px 0 0">Hoggy has not confirmed credits for this event. Ask the organiser before relying on it.</div>'}</div><div class="fact"><div class="k">Registration (indicative)</div><div class="v">${c.priceFrom ? 'about US$' + esc(Number(c.priceFrom).toLocaleString()) : 'See organiser'}</div></div><div class="fact"><div class="k">Specialty</div><div class="v">${esc(c.specialty)}</div></div><div class="fact"><div class="k">Size · format</div><div class="v">~${esc(Number(c.attendees).toLocaleString())} · ${esc(c.format)}</div></div></div>
  ${c.flagged ? '<p class="check warn" style="margin:0 0 10px">! Hoggy\'s updater noticed a change or problem on the organiser site (dead link or cancellation wording). Check the official site before booking.</p>' : ''}<div class="pills" style="margin:0 0 14px" aria-label="Quality signals">${c.cpdBody && c.cpdVerified ? `<span class="pill g">Accreditation: ${esc(c.cpdBody)}</span>` : '<span class="pill w">Accreditation: confirm with organiser</span>'}<span class="pill ${c.datesConfirmed === false ? 'w' : 'g'}">${c.datesConfirmed === false ? 'Dates estimated' : 'Dates confirmed'}</span><span class="pill">Run by ${esc(c.organiser)}</span><span class="pill">${esc(c.format)}</span>${c.attendees >= 3000 ? '<span class="pill">Large (3,000+)</span>' : c.attendees ? '<span class="pill">~' + esc(Number(c.attendees).toLocaleString()) + ' attendees</span>' : ''}</div>
  <p class="note" style="margin:-6px 0 12px">Elsewhere on the web: <a style="text-decoration:underline" target="_blank" rel="noopener noreferrer" href="https://www.google.com/search?q=${encodeURIComponent(c.name + ' ' + c.start.slice(0, 4) + ' review')}">search reviews</a> (external, not part of Hoggy's score)</p>
  <div class="row"><a class="btn sm" target="_blank" rel="noopener noreferrer" href="${esc(L.flights)}">✈ Flights ${icon('ext')}</a><a class="btn sm" target="_blank" rel="noopener noreferrer" href="${esc(L.hotels)}">🛏 Hotels ${icon('ext')}</a><button class="btn sm ghost" data-act="ics" data-id="${esc(id)}">+ Calendar</button></div>
  ${reviewsSection(c, R)}</div></div>`);
  if (NET.online && fetchReviews) loadReviews(id).then(ok => { if (ok && !$('#overlay').hidden && $('#rvsec') && $('#rvsec').dataset.id === id) detail(id, false); }); /* fetch once per open; re-rendering with fetch again looped forever */
}
/* ---------- reviews section, review form, proof upload ---------- */
const HOW_SCORES = 'Scores cover every year of this conference. A verified review counts in full and an unverified one counts half. A score shows once there are at least 3 reviews. "Verified attendee" means Hoggy holds a registration receipt you emailed to your Hoggy address, or an admin has checked your certificate or receipt.';
const edLabel = r => 'Attended ' + r.editionYear + (r.city ? ' · ' + r.city : '');
const shareLink = key => location.origin + location.pathname + '#/review/' + key;
function scoreLine(sc) {
  if (!sc || !sc.n) return 'No reviews yet';
  if (sc.avg == null) return `Not enough reviews yet · ${plural(sc.n, 'review')} so far`;
  return `<span class="stars" aria-hidden="true">${stars(sc.avg)}</span> <b>${sc.avg.toFixed(1)}</b> from ${plural(sc.n, 'review')} (${sc.verified} verified)`;
}
function reviewItem(v, c) {
  const dims = DIM_LABELS.filter(([k]) => v.ratings && v.ratings[k]).map(([k, l]) => `${l} ${v.ratings[k]}`).join(' · ');
  const state = v.verified ? '<span class="pill g">✓ Verified attendee</span>' : '<span class="pill">Attended (not verified)</span>';
  const own = v.mine ? (v.verify === 'pending_proof' ? '<span class="pill w">Proof sent · being checked</span>' : v.proof === 'rejected' && !v.verified ? '<span class="pill b">Proof not accepted</span>' : '') : '';
  const acts = !NET.user ? '' : v.mine ? `<div class="row rv-acts"><button class="btn sm ghost" data-act="rvedit" data-id="${esc(v.id)}" data-conf="${esc(c.id)}">Edit</button>${v.verified || v.verify === 'pending_proof' ? '' : `<button class="btn sm ghost" data-act="rvproof" data-id="${esc(v.id)}" data-conf="${esc(c.id)}">Add proof</button>`}<button class="btn sm ghost danger" data-act="rvdel" data-id="${esc(v.id)}" data-conf="${esc(c.id)}">Delete</button></div>` : `<div class="row rv-acts"><button class="btn sm ghost" data-act="rvreport" data-id="${esc(v.id)}" data-conf="${esc(c.id)}">Report</button></div>`;
  return `<div class="review"><div class="who rv-who"><span>${esc(v.author)}</span> ${state}${own}<span class="stars rv-stars" aria-label="${esc(Number(v.rating).toFixed(1))} out of 5">${stars(v.rating)}</span></div><div class="note rv-ed">${esc(edLabel(v))}</div>${dims ? `<div class="note rv-dims">${esc(dims)}</div>` : ''}<p>${esc(v.text)}</p>${acts}</div>`;
}
function reviewsSection(c, R) {
  const key = skey(c), sc = scoreOf(c);
  if (!NET.online) return `<div class="section" style="margin-top:28px"><h2 style="font-size:20px">Reviews</h2></div><p class="note">Reviews need the Hoggy server and an account. Offline mode cannot post or show shared reviews.</p>${R.map(v => `<div class="review"><div class="who">${esc(v.author)} <span class="pill">On this device only</span></div><p>${esc(v.text)}</p></div>`).join('')}`;
  const dimsHtml = sc && sc.avg != null ? `<div class="dimgrid wide">${DIM_LABELS.filter(([k]) => sc.dims && sc.dims[k]).map(([k, l]) => `<div class="dim"><span>${l}</span><b>${sc.dims[k].avg.toFixed(1)} <small>(${sc.dims[k].n})</small></b></div>`).join('')}</div>` : '';
  return `<section id="rvsec" data-id="${esc(c.id)}" aria-labelledby="rvh"><div class="section" style="margin-top:28px"><h2 id="rvh" style="font-size:20px">Reviews</h2><span class="rv-score">${scoreLine(sc)}</span></div>
  ${dimsHtml}<details class="how"><summary>How scores work</summary><p class="note">${esc(HOW_SCORES)}</p></details>
  <div class="row" style="margin:12px 0 4px"><button class="btn sm primary" data-act="review" data-id="${esc(c.id)}">Review this conference</button><button class="btn sm ghost" data-act="copy" data-v="${esc(shareLink(key))}">${icon('copy')} Copy review link</button></div>
  <p class="note" style="margin:6px 0 4px">Went in an earlier year? That counts. Share the link with colleagues who attended.</p>
  ${R.length ? R.map(v => reviewItem(v, c)).join('') : '<p class="note">No reviews yet. If you have been to this conference in any year, yours can be the first.</p>'}</section>`;
}
const GUIDE = 'Keep it honest and about the event: the programme, speakers, venue, value and CPD. Do not name or criticise individuals, and never include patient information. Reviews that break these rules are removed.';
/* open the review form for a series; signed-out visitors sign in first and come straight back */
function startReview(key, opts = {}) {
  if (!editionsOf(key).length) { toast('We could not find that conference'); return false; }
  if (!NET.online) { toast('Reviews need the Hoggy server. Try again when you are online'); return false; }
  if (!NET.user) { authDialog('Sign in to review this conference', () => startReview(key, opts)); return true; }
  reviewForm(key, opts); return true;
}
function reviewForm(key, opts = {}) {
  const eds = editionsOf(key), latest = eds[eds.length - 1], title = window.HoggySeries ? window.HoggySeries.seriesTitle(latest) : latest.name, Y = new Date().getFullYear(), td = today();
  const ed = opts.edit || null;
  const years = []; for (let y = Y; y >= Y - 10; y--) { const known = eds.find(c => +c.start.slice(0, 4) === y); years.push({ y, city: known ? known.city : '', future: !!known && known.start > td, done: reviewedYear(key, y) }); }
  const rate = (k, l) => `<div class="rate" role="radiogroup" aria-labelledby="rl-${k}"><span class="rate-l" id="rl-${k}">${l}</span><div class="rate-opts">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="${k}" value="${n}" ${ed && ed.ratings && ed.ratings[k] === n ? 'checked' : ''} aria-label="${l}: ${n} out of 5"><span aria-hidden="true">${n}</span></label>`).join('')}</div></div>`;
  openOverlay(`<div class="sheet center rv-sheet" role="dialog" aria-modal="true" aria-label="Review ${esc(title)}"><form id="rvf" novalidate style="padding:22px"><div class="row" style="justify-content:space-between;align-items:flex-start;flex-wrap:nowrap;margin-bottom:6px"><h2 style="font-size:24px;margin:0">${ed ? 'Edit your review' : 'Review this conference'}</h2><button type="button" class="icon-btn" style="flex:none" data-act="close" aria-label="Close">${icon('x')}</button></div>
  <p class="note" style="margin:0 0 14px">${esc(title)} · ${esc(latest.organiser)}</p>
  ${ed ? `<p class="rv-edline"><b>${esc(edLabel(ed))}</b></p>` : `<fieldset class="years"><legend>Which years did you attend?</legend><div class="ychips">${years.map(o => `<label class="ychip"><input type="checkbox" name="year" value="${o.y}" ${o.future || o.done ? 'disabled' : ''} ${opts.year === o.y && !o.done && !o.future ? 'checked' : ''}><span>${o.y}${o.city ? ' · ' + esc(o.city) : ''}${o.done ? ' · reviewed' : o.future ? ' · upcoming' : ''}</span></label>`).join('')}</div><p class="note">Tick more than one to add past years in one go. Each year gets its own review with these scores; you can edit any of them later.</p></fieldset>
  ${field('rvCity', 'City (optional, for years without a city shown)', '<input id="rvCity" type="text" name="city" maxlength="60" autocomplete="off">')}`}
  <div class="rates">${DIM_LABELS.map(([k, l]) => rate(k, l)).join('')}</div>
  <div class="field"><label for="rvText">Comment</label><textarea id="rvText" name="text" minlength="10" maxlength="600" required placeholder="What was worth it, what wasn't, tips for next year">${esc(ed ? ed.text : '')}</textarea><div class="note rv-count" id="rvCount" aria-live="polite">${ed ? ed.text.length : 0} / 600</div></div>
  <p class="note rv-guide">${esc(GUIDE)}</p>
  <p class="note" id="rverr" role="alert" style="color:var(--bad);min-height:18px"></p>
  <div class="row" style="justify-content:flex-end;margin:4px 0 20px"><button class="btn primary" type="submit">${ed ? 'Save changes' : 'Post review'}</button></div></form></div>`, true);
  const f = $('#rvf'), txt = $('#rvText');
  txt.addEventListener('input', () => { $('#rvCount').textContent = txt.value.length + ' / 600'; });
  f.addEventListener('submit', async e => {
    e.preventDefault(); const fd = new FormData(f), errEl = $('#rverr');
    const ratings = Object.fromEntries(DIM_LABELS.map(([k]) => [k, +fd.get(k) || 0])), text = String(fd.get('text') || '').trim();
    const yrs = ed ? [] : fd.getAll('year').map(Number);
    if (!ed && !yrs.length) return errEl.textContent = 'Tick the year (or years) you attended.';
    const miss = DIM_LABELS.filter(([k]) => !ratings[k]).map(([, l]) => l); if (miss.length) return errEl.textContent = 'Rate every area: ' + miss.join(', ') + '.';
    if (text.length < 10) return errEl.textContent = 'Write at least 10 characters.';
    errEl.textContent = ''; const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    const r = ed ? await api('/api/reviews/' + encodeURIComponent(ed.id), { method: 'PUT', body: { ratings, text } })
      : await api('/api/reviews', { method: 'POST', body: { series: key, editions: yrs.map(y => ({ year: y, city: String(fd.get('city') || '').trim() })), ratings, text } });
    btn.disabled = false;
    if (r.error) return errEl.textContent = r.error === 'offline' ? 'Server not reachable. Try again.' : r.error.charAt(0).toUpperCase() + r.error.slice(1) + '.';
    await refreshReviews(latest.id);
    if (ed) { toast('Review updated'); return backToConf(opts.conf || latest.id); }
    const made = (r.reviews || []).map(x => ({ ...x, seriesKey: key }));
    if (made.every(x => x.verify === 'verified')) { toast('Review posted · verified from your emailed registration receipt'); return backToConf(latest.id); }
    proofDialog(made.filter(x => x.verify !== 'verified'), { conf: latest.id, title, posted: true });
  });
}
function proofDialog(list, opts = {}) {
  openOverlay(`<div class="sheet center rv-sheet" role="dialog" aria-modal="true" aria-label="Add proof of attendance"><div style="padding:22px"><div class="row" style="justify-content:space-between;align-items:flex-start;flex-wrap:nowrap;margin-bottom:10px"><h2 style="font-size:24px;margin:0">${opts.posted ? 'Thanks, your review is up' : 'Add proof of attendance'}</h2><button type="button" class="icon-btn" style="flex:none" data-act="close" aria-label="Close">${icon('x')}</button></div>
  <p style="color:var(--muted);font-size:14px">${opts.posted ? 'It shows as “Attended (not verified)” for now. ' : ''}Upload a certificate of attendance, CPD certificate or registration receipt and a Hoggy admin will check it. Once approved, your review shows “✓ Verified attendee”.</p>
  <p class="note">PDF, JPG or PNG, up to 5 MB. Only Hoggy admins can open it, and it is deleted once checked. Cover anything you do not want seen, such as your registration number. Emailing your registration receipt to your Hoggy address also verifies it.</p>
  <div class="list" style="margin-top:12px">${list.map(r => `<form class="li pf-row" data-rv="${esc(r.id)}"><div class="grow"><div class="t">${esc(edLabel(r))}</div><div class="two pf-in"><select name="kind" aria-label="Type of proof for ${esc(r.editionYear)}"><option value="certificate">Certificate of attendance</option><option value="cpd">CPD certificate</option><option value="receipt">Registration receipt</option></select><input type="file" name="file" accept="application/pdf,image/jpeg,image/png" aria-label="Proof file for ${esc(r.editionYear)}"></div><div class="note pf-msg" aria-live="polite"></div></div><button class="btn sm primary" type="submit">Upload</button></form>`).join('')}</div>
  <div class="row" style="justify-content:flex-end;margin:16px 0 0"><button class="btn" data-act="rvdone" data-id="${esc(opts.conf || '')}">${opts.posted ? 'Skip for now' : 'Done'}</button></div></div></div>`, true);
  document.querySelectorAll('.pf-row').forEach(f => f.addEventListener('submit', async e => {
    e.preventDefault(); const file = f.elements.file.files[0], msg = f.querySelector('.pf-msg');
    if (!file) return msg.textContent = 'Choose a file first.';
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) return msg.textContent = 'PDF, JPG or PNG only.';
    if (file.size > 5e6) return msg.textContent = 'That file is over 5 MB.';
    msg.textContent = 'Uploading…'; f.querySelector('[type=submit]').disabled = true;
    let r; try { const x = await fetch(`/api/reviews/${encodeURIComponent(f.dataset.rv)}/proof?kind=${encodeURIComponent(f.elements.kind.value)}&name=${encodeURIComponent(file.name.slice(0, 100))}`, { method: 'POST', headers: { 'X-Requested-With': 'hoggy', 'Content-Type': file.type }, body: file, credentials: 'same-origin' }); r = await x.json().catch(() => ({ error: 'upload failed' })); } catch (er) { r = { error: 'Server not reachable' }; }
    if (r.error) { f.querySelector('[type=submit]').disabled = false; return msg.textContent = r.error.charAt(0).toUpperCase() + r.error.slice(1) + '.'; }
    msg.textContent = 'Sent. An admin will check it.'; f.querySelector('[type=submit]').textContent = 'Sent';
    const b = document.querySelector('[data-act=rvdone]'); if (b) b.textContent = 'Done';
    refreshReviews(opts.conf);
  }));
}
async function refreshReviews(confId) { await Promise.all([confId ? loadReviews(confId) : null, loadRatings(), loadMine()]); }
function backToConf(confId) { if (confId && byId(confId)) detail(confId, false); else closeOverlay(); if (route() === 'trips') render(); }
function field(id, label, html) { return `<div class="field"><label for="${id}">${label}</label>${html}</div>`; }
function receiptDialog(opts = {}) {
  const ed = opts.edit ? S.receipts.find(r => r.id === opts.edit) : null, v = ed || {}, files = opts.files || [];
  const tripOpts = `<option value="">— choose trip —</option>` + S.trips.map(t => `<option value="${esc(t.id)}" ${(v.tripId || opts.tripId) === t.id ? 'selected' : ''}>${esc(ofTrip(t).name)}</option>`).join('');
  openOverlay(`<div class="sheet center" role="dialog" aria-modal="true" aria-label="Receipt"><form id="rf" style="padding:22px"><div class="row" style="justify-content:space-between;margin-bottom:14px"><h2 style="font-size:24px;margin:0">${ed ? 'Edit receipt' : 'Add receipt'}</h2><button type="button" class="icon-btn close" style="position:static;background:var(--card-2);color:inherit" data-act="close" aria-label="Close">${icon('x')}</button></div>
  ${ed ? '' : `<div class="field"><label for="rfile">Receipt file (PDF, JPG, PNG)</label><input id="rfile" type="file" accept="image/*,application/pdf" multiple></div><div class="field"><label for="rtext">…or paste a forwarded email</label><textarea id="rtext" placeholder="Paste the receipt email here and Hoggy will read vendor, amount and date"></textarea><p style="margin-top:8px"><button type="button" class="btn sm" id="parse">Read email</button> <span class="note" id="pmsg"></span></p></div>`}
  <div class="two">${field('rv1', 'Vendor', `<input id="rv1" type="text" name="vendor" required maxlength="80" value="${esc(v.vendor || '')}">`)}${field('rv2', 'Category', `<select id="rv2" name="category">${CATS.map(k => `<option ${k === (v.category || 'Other') ? 'selected' : ''}>${k}</option>`).join('')}</select>`)}</div>
  <div class="two">${field('rv3', 'Amount', `<input id="rv3" type="number" step="0.01" min="0" name="amount" required value="${esc(v.amount ?? '')}">`)}${field('rv4', 'Currency', `<input id="rv4" type="text" name="currency" maxlength="3" value="${esc(v.currency || S.profile.currency)}">`)}</div>
  <div class="two">${field('rv5', 'Date', `<input id="rv5" type="date" name="date" required value="${esc(v.date || '')}">`)}${field('rv6', 'Trip', `<select id="rv6" name="tripId">${tripOpts}</select>`)}</div>
  ${field('rv8', 'Exchange rate to ' + S.profile.currency + ' (only for foreign currency)', `<input id="rv8" type="number" step="0.0001" min="0" name="fxRate" value="${esc(v.fxRate || '')}">`)}
  <div class="two">${field('rv9', 'Nights (accommodation)', `<input id="rv9" type="number" min="0" step="1" name="nights" value="${esc(v.nights || '')}">`)}${field('rv10', 'Personal portion to exclude', `<input id="rv10" type="number" min="0" step="0.01" name="personal" value="${esc(v.personal || '')}">`)}</div>
  ${field('rv11', 'Justification for exceeding policy (only if over a limit)', `<input id="rv11" type="text" name="excuse" maxlength="200" value="${esc(v.excuse || '')}">`)}
  ${field('rv7', 'Note (optional)', `<input id="rv7" type="text" name="note" maxlength="200" value="${esc(v.note || '')}">`)}
  ${files.length ? `<p class="note">${files.length} file${files.length > 1 ? 's' : ''} ready: ${esc(files.map(f => f.name).join(', '))}</p>` : ''}
  <div class="row" style="justify-content:space-between;margin:6px 0 20px"><span>${ed ? `<button type="button" class="btn danger" data-act="rmreceipt" data-id="${esc(ed.id)}">Delete</button>` : ''}</span><button class="btn primary" type="submit" autofocus>Save receipt</button></div></form></div>`, true);
  const form = $('#rf'); let pending = files.slice();
  if (!ed) {
    const fi = $('#rfile'); fi.addEventListener('change', () => { pending = [...fi.files]; });
    $('#parse').addEventListener('click', () => { const p = parseReceipt($('#rtext').value); if (!p.amount && !p.vendor) return $('#pmsg').textContent = 'Nothing recognised — fill in manually.'; if (p.vendor) form.vendor.value = p.vendor; if (p.amount) form.amount.value = p.amount; if (p.currency) form.currency.value = p.currency; if (p.date) form.date.value = p.date; form.category.value = p.category; $('#pmsg').textContent = 'Filled in — check it looks right.'; });
    if (files.length) { const n = files[0].name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '); form.vendor.value = n.slice(0, 60); form.date.value = today(); }
  }
  form.addEventListener('submit', async e => { e.preventDefault(); const f = new FormData(form), base = { vendor: String(f.get('vendor')).trim().slice(0, 80), category: f.get('category'), amount: Math.round((+f.get('amount') || 0) * 100) / 100, currency: String(f.get('currency') || S.profile.currency).toUpperCase().slice(0, 3), fxRate: +f.get('fxRate') || 0, excuse: String(f.get('excuse') || '').trim().slice(0, 200), nights: Math.max(0, Math.round(+f.get('nights') || 0)), personal: Math.max(0, +f.get('personal') || 0), date: f.get('date'), tripId: f.get('tripId'), note: String(f.get('note') || '').slice(0, 200) };
    if (ed) { Object.assign(ed, base); }
    else { const list = pending.length ? pending : [null]; for (const file of list) { const r = { id: uid(), ...base, status: 'captured', created: Date.now() }; if (file && !['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { toast(file.name + ': only PDF, JPG, PNG or WebP are supported. For iPhone HEIC photos, share as JPG or take a screenshot'); continue; }
      if (file) { if (file.size > 15e6) { toast(file.name + ' is over 15 MB, skipped'); continue; } r.fileKey = 'f-' + r.id; r.fileName = file.name; try { await putFile(r.fileKey, file, file.name); } catch (er) { delete r.fileKey; toast('Could not store file'); } } else if (!$('#rtext').value.trim()) { /* manual entry, no file */ } else { r.fileKey = 't-' + r.id; r.fileName = 'forwarded-email.txt'; try { await putFile(r.fileKey, new Blob([$('#rtext').value.slice(0, 20000)], { type: 'text/plain' }), r.fileName); } catch (er) { delete r.fileKey; } } S.receipts.push(r); } }
    save(); closeOverlay(); toast('Receipt saved'); render(); });
}
function simpleDialog(title, body, onSubmit, cta = 'Save') {
  openOverlay(`<div class="sheet center" role="dialog" aria-modal="true" aria-label="${esc(title)}"><form id="sf" style="padding:22px"><div class="row" style="justify-content:space-between;margin-bottom:14px"><h2 style="font-size:24px;margin:0">${esc(title)}</h2><button type="button" class="icon-btn" data-act="close" aria-label="Close">${icon('x')}</button></div>${body}<div class="row" style="justify-content:flex-end;margin:6px 0 20px"><button class="btn primary" type="submit" autofocus>${esc(cta)}</button></div></form></div>`, true);
  $('#sf').addEventListener('submit', e => { e.preventDefault(); onSubmit(new FormData(e.target)); });
}


/* ---------- send: an editable email draft (.eml) with the schedule and every receipt attached; the user sends it ---------- */
const EMP = () => S.profile.employer || {};
const policyFor = (t, rs) => window.HoggyPack.evaluate(rs, ofTrip(t), { ...EMP(), perReceipt: S.profile.caps }, homeAmt);
function claimBody(t, rs) {
  const c = ofTrip(t), e = EMP(), tot = rs.reduce((a, r) => a + claimAmt(r), 0), fx = rs.filter(r => r.currency && r.currency !== S.profile.currency), notes = rs.filter(r => r.note);
  return ['Hello,', '', `Please find attached my expense claim for ${c.name} (${c.city}, ${range(c)}).`, '',
    `Name: ${S.profile.name || ''}`, e.employeeId ? `Employee ID: ${e.employeeId}` : '', e.costCentre ? `Cost centre: ${e.costCentre}` : '',
    `Total claimed: ${money(tot)} across ${rs.length} receipt${rs.length > 1 ? 's' : ''}`, '',
    'The attached claim-schedule.csv lists every line. Each receipt file is attached and numbered R1, R2 and so on in the same order.',
    fx.length ? `Foreign-currency items use the exchange rates I entered in the schedule (${[...new Set(fx.map(r => r.currency))].join(', ')} to ${S.profile.currency}).` : '',
    notes.length ? '\nNotes on individual items:\n' + notes.map(r => `- ${r.vendor || r.category}: ${r.note}`).join('\n') : '',
    (() => { const ex = policyFor(t, rs); return ex.length ? '\nItems over a policy limit, with my justification:\n' + ex.map(i => `- ${i.t}${(rs.find(r => r.id === i.id) || {}).excuse ? ' Justification: ' + rs.find(r => r.id === i.id).excuse : ''}`).join('\n') : ''; })(),
    rs.some(r => +r.personal) ? '\nPersonal portions have been excluded from the amounts above and are shown in the schedule.' : '',
    '', 'Regards,', S.profile.name || ''].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
}
const claimSubject = (t) => { const c = ofTrip(t), e = EMP(); return `Expense claim - ${S.profile.name || 'Clinician'}${e.employeeId ? ' - ' + e.employeeId : ''} - ${c.name} - ${range(c)}`; };
async function emailPack(t) {
  const e = EMP(); if (!e.adminEmail) { toast('Add your claims admin email under Settings > Your employer first'); location.hash = '#/settings'; return; }
  const c = ofTrip(t), rs = S.receipts.filter(r => r.tripId === t.id).sort((a, b) => (a.date || '').localeCompare(b.date || '')), atts = [], missing = []; let size = 0;
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i], b = r.fileKey && await getFile(r.fileKey); if (!b) { missing.push(r.vendor || 'receipt'); continue; }
    const u8 = new Uint8Array(await b.arrayBuffer()); size += u8.length;
    const ext = ((r.fileName || '').match(/\.[a-z0-9]{2,5}$/i) || [''])[0] || ({ 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[b.type] || '.txt');
    atts.push({ name: `R${i + 1}-${r.vendor || 'receipt'}-${r.date || ''}${ext}`, type: b.type || 'application/octet-stream', data: u8 });
  }
  if (missing.length) return toast('Cannot build the pack: file missing for ' + missing.join(', '));
  atts.unshift({ name: 'claim-schedule.csv', type: 'text/csv', data: new TextEncoder().encode(csv([['Ref', ...CLAIM_HEAD()], ...claimRows(t).map((row, i) => ['R' + (i + 1), ...row])])) });
  const eml = window.HoggyPack.buildEml({ to: e.adminEmail, subject: claimSubject(t), body: claimBody(t, rs), attachments: atts });
  download(`claim-${c.id}.eml`, eml, 'message/rfc822');
  toast(size > 20e6 ? `Pack is ${(size / 1e6).toFixed(0)} MB. Many mail systems reject over 20 MB, so check before sending.` : 'Open the downloaded .eml in Outlook or Apple Mail. It opens as a draft to ' + e.adminEmail + '. Send it, then press Mark submitted.');
}
function mailtoPack(t) {
  const e = EMP(), rs = S.receipts.filter(r => r.tripId === t.id).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  download(`claim-${ofTrip(t).id}.csv`, csv([['Ref', ...CLAIM_HEAD()], ...claimRows(t).map((row, i) => ['R' + (i + 1), ...row])]));
  location.href = 'mailto:' + encodeURIComponent(e.adminEmail || '') + '?subject=' + encodeURIComponent(claimSubject(t)) + '&body=' + encodeURIComponent(claimBody(t, rs).slice(0, 1500) + '\n\n[Attach the downloaded schedule and your receipt files before sending.]');
  toast('Attach the downloaded schedule and your receipt files, then send.');
}
/* study-leave / pre-approval request: a draft email with dates, leave days and a cost estimate. Hoggy never invents CPD hours. */
function leaveDialog(confId) {
  const c = byId(confId); if (!c) return; const e = EMP(), est = c.datesConfirmed === false;
  const cpd = c.cpdVerified && c.cpdHours ? `${c.cpdHours} CPD hours (${c.cpdBody || 'accredited'})` : 'CPD credits to be confirmed with the organiser';
  simpleDialog('Request study leave', `<p class="note" style="margin:0 0 12px">${esc(c.name)}, ${esc(c.city)}, ${esc(range(c))}${est ? '. <b>Dates are estimated; confirm with the organiser before you submit.</b>' : ''}</p>
    <div class="two">${field('l1', 'Travel days before', '<input id="l1" type="number" min="0" max="7" name="before" value="1">')}${field('l2', 'Travel days after', '<input id="l2" type="number" min="0" max="7" name="after" value="1">')}</div>
    <div class="two">${field('l3', 'Flights (estimate)', '<input id="l3" type="number" min="0" name="fl" value="">')}${field('l4', 'Accommodation (estimate)', '<input id="l4" type="number" min="0" name="ac" value="">')}</div>
    <div class="two">${field('l5', 'Registration (estimate)', '<input id="l5" type="number" min="0" name="rg" value="">')}${field('l6', 'Other (estimate)', '<input id="l6" type="number" min="0" name="ot" value="">')}</div>
    ${field('l7', 'Why this conference (edit freely)', `<textarea id="l7" name="why" rows="4" maxlength="800">I would like to attend ${esc(c.name)} to keep my knowledge current in ${esc(c.specialty)} and bring it back to the team. ${esc(cpd)}.</textarea>`)}
    <p class="note">${e.approverEmail ? 'Draft addressed to ' + esc(e.approverEmail) + '.' : 'Add your approver under Settings > Your employer to address it automatically.'} Hoggy only prepares the email; you send it.</p>`,
    f => {
      const n = k => Math.max(0, +f.get(k) || 0), total = n('fl') + n('ac') + n('rg') + n('ot'), days = window.HoggyPack.leaveDays(c.start, c.end, n('before'), n('after'));
      const body = ['Hello' + (e.approverName ? ' ' + e.approverName : '') + ',', '', 'I would like to request study leave and approval for the following conference.', '',
        `Conference: ${c.name}`, `Organiser: ${c.organiser || ''}`, `Location: ${c.city}, ${c.country}`, `Dates: ${range(c)}${est ? ' (ESTIMATED, to be confirmed with the organiser)' : ''}`,
        `Leave requested: about ${days} working day${days === 1 ? '' : 's'} including ${n('before')} travel day(s) before and ${n('after')} after (weekends excluded; public holidays not removed)`,
        `Website: ${c.sourceUrl || c.url || ''}`, '', `Estimated costs${S.profile.currency ? ' (' + S.profile.currency + ')' : ''}:`,
        n('fl') ? `- Flights: ${n('fl')}` : '', n('ac') ? `- Accommodation: ${n('ac')}` : '', n('rg') ? `- Registration: ${n('rg')}` : '', n('ot') ? `- Other: ${n('ot')}` : '', `Total estimate: ${total}`, '',
        'Reason:', String(f.get('why') || ''), '', `CPD: ${cpd}`, '', 'Please let me know if you need anything further, and the approval reference to quote on my claim.', '', 'Regards,', S.profile.name || ''].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
      download(`study-leave-${c.id}.eml`, window.HoggyPack.buildEml({ to: e.approverEmail || '', subject: `Study leave request - ${S.profile.name || 'Clinician'} - ${c.name} - ${range(c)}`, body, attachments: [] }), 'message/rfc822');
      S.leave = S.leave || {}; S.leave[c.id] = { drafted: today(), total }; save(); closeOverlay(); toast('Draft downloaded. Open it in your mail app, check it and send.');
    }, 'Create email draft');
}

/* ---------- claim pack ---------- */
const CLAIM_HEAD = () => ['Date', 'Vendor', 'Category', 'Amount', 'Currency', 'FX rate', 'Claimed (' + S.profile.currency + ')', 'Personal portion excluded', 'Nights', 'Note', 'Policy check', 'Policy clause', 'File', 'Conference'];
function claimRows(t) {
  const c = ofTrip(t), rs = S.receipts.filter(r => r.tripId === t.id).sort((a, b) => (a.date || '').localeCompare(b.date || '')), pol = policyFor(t, rs), e = EMP(), lim = !!(e.hotelPerNight || e.mealsPerDay || Object.values(S.profile.caps || {}).some(Boolean));
  return rs.map(r => { const p = pol.filter(i => i.id === r.id); return [r.date, r.vendor, r.category, r.amount, r.currency, r.fxRate || '', Math.round(claimAmt(r) * 100) / 100, r.personal || '', r.nights || '', r.note || '', p.length ? 'OVER LIMIT, justified: ' + (r.excuse || '') : (lim ? 'Within limits entered' : 'No limits entered'), p.length ? (e.clause || '') : '', r.fileName || '', c.name]; });
}
function printPack(t) {
  const c = ofTrip(t), rs = S.receipts.filter(r => r.tripId === t.id).sort((a, b) => (a.date || '').localeCompare(b.date || '')), tot = rs.reduce((a, r) => a + claimAmt(r), 0);
  let html = '';
  const w = { document: { write: s => { html += s; }, close() { } } };
  const rows = rs.map((r, i) => `<tr><td>R${i + 1}</td><td>${esc(r.date)}</td><td>${esc(r.vendor)}</td><td>${esc(r.category)}</td><td>${esc([r.note, r.personal ? 'Personal portion ' + money(r.personal) + ' excluded' : '', r.excuse ? 'Over limit, justified: ' + r.excuse : ''].filter(Boolean).join('. '))}</td><td style="text-align:right">${esc(money(claimAmt(r)))}${r.currency !== S.profile.currency ? ' (' + esc(money(r.amount, r.currency)) + ' @ ' + esc(r.fxRate) + ')' : ''}</td></tr>`).join('');
  w.document.write(`<!doctype html><meta charset="utf-8"><title>Expense claim — ${esc(c.name)}</title><style>body{font:14px/1.5 -apple-system,Segoe UI,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#111}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}h1{margin:0}.t{font-size:22px;font-weight:700;text-align:right;margin-top:16px}</style><h1>Expense claim</h1><p>${esc(S.profile.name || 'Clinician')} · ${esc(c.name)}, ${esc(c.city)} · ${esc(range(c))}<br>Prepared with Hoggy on ${esc(fmtD(today()))}. ${rs.length} receipt${rs.length > 1 ? 's' : ''}. The receipt files are sent separately, numbered R1 to R${rs.length} in date order.</p><table><tr><th>Ref</th><th>Date</th><th>Vendor</th><th>Category</th><th>Note</th><th style="text-align:right">Amount</th></tr>${rows}</table><div class="t">Total ${esc(money(tot))}</div>`);
  const f = document.createElement('iframe'); f.setAttribute('sandbox', 'allow-same-origin allow-modals'); f.style.cssText = 'position:fixed;width:0;height:0;border:0'; f.srcdoc = html;
  f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast('Print failed — use Export CSV'); } setTimeout(() => f.remove(), 3000); };
  document.body.appendChild(f);
}


/* ---------- backend: auth, sync, shared reviews, inbox ---------- */
async function api(path, o = {}) {
  try {
    const r = await fetch(path, { method: o.method || 'GET', headers: { 'X-Requested-With': 'hoggy', ...(o.body ? { 'Content-Type': 'application/json' } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined, credentials: 'same-origin' });
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('json')) return { error: 'offline', status: r.status };
    const j = await r.json(); return r.ok ? j : { ...j, status: r.status };
  } catch (e) { return { error: 'offline', status: 0 }; }
}
async function loadRatings() { const r = await api('/api/ratings'); if (!r.error) { NET.ratings = r; if (route() === 'discover' && $('#results')) results(); } }
/* reviews of the whole series, plus fresh scores so the score line matches the badges (an admin may have verified one since) */
async function loadReviews(id) { const c = byId(id); if (!c) return false; const key = skey(c), [r, rt] = await Promise.all([api('/api/reviews?series=' + encodeURIComponent(key)), api('/api/ratings')]); if (!rt.error) NET.ratings = rt; if (r.error || !Array.isArray(r)) return false; NET.reviews[key] = r; return true; }
async function loadMine() { if (!NET.user) { NET.mine = []; return; } const r = await api('/api/my-reviews'); if (Array.isArray(r)) NET.mine = r; }
let syncT = null;
function scheduleSync() { if (!NET.user) return; clearTimeout(syncT); syncT = setTimeout(pushState, 1200); }
function syncPayload() { const o = JSON.parse(JSON.stringify(S)); delete o.reviews; if (o.profile && o.profile.employer) for (const k of ['employeeId', 'costCentre', 'approverName', 'approverEmail', 'adminEmail']) delete o.profile.employer[k]; return o; }
/* merge two states by record id so neither side's receipts are lost (local wins on the same id) */
function mergeState(srv, loc) {
  const by = (a, b) => { const m = new Map(); (a || []).forEach(x => m.set(x.id, x)); (b || []).forEach(x => m.set(x.id, x)); return [...m.values()]; };
  const d = defaults();
  return { ...d, ...srv, ...loc, trips: by(srv.trips, loc.trips), receipts: by(srv.receipts, loc.receipts), cpd: by(srv.cpd, loc.cpd), saved: [...new Set([...(srv.saved || []), ...(loc.saved || [])])], claims: { ...(srv.claims || {}), ...(loc.claims || {}) }, leave: { ...(srv.leave || {}), ...(loc.leave || {}) }, profile: { ...d.profile, ...(srv.profile || {}), ...(loc.profile || {}), caps: { ...(srv.profile || {}).caps, ...(loc.profile || {}).caps }, employer: { ...((srv.profile || {}).employer || {}), ...((loc.profile || {}).employer || {}) } } };
}
async function pushState() {
  if (!NET.user || NET.busy) return; NET.busy = true;
  const r = await api('/api/state', { method: 'PUT', body: { state: syncPayload(), baseRev: NET.rev } });
  NET.busy = false;
  if (r.status === 409) { const sv = await api('/api/state'); if (!sv.error && sv.state) { S = mergeState(sv.state, { ...S, reviews: undefined }); S.reviews = S.reviews || []; NET.rev = sv.rev; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } NET.busy = false; await pushState(); render(); return toast('Merged with your other device'); } return; }
  if (!r.error) NET.rev = r.rev;
}
async function pullState(force) {
  const r = await api('/api/state'); if (r.error) return;
  const hasLocal = !!(S.trips.length || S.receipts.length || S.cpd.length), me = String(NET.user.id), owner = getOwner();
  const adopt = st => { const d = defaults(), keep = (S.profile || {}).employer || {}; S = { ...d, ...st, reviews: S.reviews, profile: { ...d.profile, ...(st.profile || {}), caps: { ...((st.profile || {}).caps || {}) }, employer: { ...((st.profile || {}).employer || {}), ...(owner === me ? keep : {}) } } }; S.trips = S.trips.filter(t => byId(t.confId)); if (hasLegacyCaps(S.profile.caps)) S.profile.caps = {}; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };
  if (owner && owner !== me && hasLocal) { /* another person's data is on this browser: never push it into this account */
    await DB.wipe(); FILES.clear(); UNSAVED.clear(); const th = (S.profile || {}).theme; S = defaults(); if (th) S.profile.theme = th;
    if (r.state) adopt(r.state); else try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { }
    setOwner(me); NET.rev = r.rev; render(); return;
  }
  if (!owner && hasLocal && r.state && !force) { /* guest data made before signing in: ask, do not assume */
    if (confirm('This device has trips or receipts you added before signing in.\n\nOK = add them to your account.\nCancel = remove them from this device and use your account data.')) { S = mergeState(r.state, S); S.trips = S.trips.filter(t => byId(t.confId)); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } NET.rev = r.rev; setOwner(me); await pushState(); render(); return; }
    await DB.wipe(); FILES.clear(); adopt(r.state); setOwner(me); NET.rev = r.rev; render(); return;
  }
  if (r.state && (force || !hasLocal)) { adopt(r.state); setOwner(me); NET.rev = r.rev; render(); return; }
  setOwner(me); NET.rev = r.rev; await pushState();
}
async function pullInbox(manual) {
  if (!NET.user) return; const items = await api('/api/inbox'); if (items.error) return; let n = 0;
  for (const it of items) {
    const done = S.receipts.find(r => r.inboxId === it.id);
    if (done) { const c = await api('/api/inbox/' + it.id + '/claim', { method: 'POST', body: { key: done.fileKey || 'none-' + done.id } }); if (!c.error) UNSAVED.delete(done.fileKey); continue; }
    const rcp = { id: uid(), inboxId: it.id, vendor: it.vendor || it.subject || 'Forwarded email', category: it.category || 'Other', amount: it.amount || 0, currency: it.currency || S.profile.currency, date: it.date || '', tripId: '', note: '', status: 'captured', created: Date.now(), via: 'email' };
    if (it.fileId) { let ok = false; try { const f = await fetch('/api/files/' + it.fileId, { headers: { 'X-Requested-With': 'hoggy' }, credentials: 'same-origin' }); if (f.ok) { const b = await f.blob(); rcp.fileKey = 'f-' + rcp.id; rcp.fileName = it.fileName; await DB.put(rcp.fileKey, b); FILES.add(rcp.fileKey); ok = true; } } catch (e) { } if (!ok) continue; /* leave it in the inbox and retry next poll */ }
    const trip = S.trips.filter(t => rcp.date && ofTrip(t)).find(t => { const c = ofTrip(t), d = new Date(rcp.date + 'T00:00:00'); return d >= new Date(c.start + 'T00:00:00') - 864e5 * 60 && d <= new Date(c.end + 'T00:00:00').getTime() + 864e5 * 14; }); if (trip) rcp.tripId = trip.id;
    S.receipts.push(rcp); save(); n++;
    const c = rcp.fileKey ? await api('/api/inbox/' + it.id + '/claim', { method: 'POST', body: { key: rcp.fileKey } }) : await api('/api/inbox/' + it.id, { method: 'DELETE' }); if (c.error && rcp.fileKey) UNSAVED.add(rcp.fileKey);
  }
  if (n) { save(); toast(`${n} receipt${n > 1 ? 's' : ''} arrived by email`); bgRender(); } else if (manual) toast('Inbox is empty');
}
async function loadConferences() {
  const r = await api('/api/conferences'); if (r.error || !Array.isArray(r.conferences) || r.conferences.length < 10) return;
  CONFS.length = 0; r.conferences.forEach(c => CONFS.push(c)); NET.confUpdated = r.updated;
}
async function boot() {
  await loadConferences();
  const me = await api('/api/me');
  if (me.error) { NET.online = false; renderAcct(); syncFiles(); return; }
  NET.online = true; NET.user = me.user; await loadRatings();
  if (NET.user) { await pullState(); await pullInbox(); await loadMine(); setInterval(() => pullInbox(), 60000); }
  syncFiles();
  NET.booted = true; openReviewLink();
  if (window.__capsCleared) { window.__capsCleared = false; toast('Old default spending caps were removed. Enter your own policy limits in Settings if your employer sets them.'); }
  bgRender();
}
function authDialog(title, then) {
  let mode = 'login';
  const draw = () => { openOverlay(`<div class="sheet center" role="dialog" aria-modal="true" aria-label="Account"><form id="af" style="padding:22px"><div class="row" style="justify-content:space-between;margin-bottom:14px"><h2 style="font-size:24px;margin:0">${esc(title || (mode === 'login' ? 'Welcome back' : 'Create your account'))}</h2><button type="button" class="icon-btn" data-act="close" aria-label="Close">${icon('x')}</button></div>
    ${mode === 'register' ? field('au1', 'Name', '<input id="au1" type="text" name="name" maxlength="80" autocomplete="name">') : ''}${field('au2', 'Email', '<input id="au2" type="text" name="email" required autocomplete="email" autofocus>')}${field('au3', 'Password' + (mode === 'register' ? ' (10+ characters)' : ''), `<input id="au3" type="password" name="password" required autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}">`)}
    <p class="note" id="aerr" style="color:var(--bad);min-height:18px"></p><div class="row" style="justify-content:space-between;margin:6px 0 20px"><button type="button" class="btn ghost sm" id="amode">${mode === 'login' ? 'Create account' : 'I have an account'}</button><button class="btn primary" type="submit">${mode === 'login' ? 'Sign in' : 'Create account'}</button></div></form></div>`, true);
    $('#amode').addEventListener('click', () => { mode = mode === 'login' ? 'register' : 'login'; title = ''; draw(); });
    $('#af').addEventListener('submit', async e => { e.preventDefault(); const f = new FormData(e.target), r = await api('/api/' + mode, { method: 'POST', body: { email: f.get('email'), password: f.get('password'), name: f.get('name') || '' } });
      if (r.error) return $('#aerr').textContent = r.error === 'offline' ? 'Server not reachable. Start it with: node server.js' : r.error;
      NET.user = r.user; if (!S.profile.name && r.user.name) S.profile.name = r.user.name; closeOverlay(true); toast('Signed in'); await pullState(); await pullInbox(); await loadMine(); syncFiles(); render(); if (then) then(); }); };
  draw();
}
function renderAcct() { const a = $('#acct'); if (!a) return; a.innerHTML = !NET.online ? '<div class="saved-title" style="text-transform:none;letter-spacing:0;font-weight:400">Offline mode — data stays on this device.</div>' : NET.user ? `<div class="li" style="padding:6px 12px"><div class="grow"><div class="t" style="font-size:13px;overflow:hidden;text-overflow:ellipsis">${esc(NET.user.name || NET.user.email)}</div><div class="s">Synced</div></div><button class="btn sm" data-act="signout">Sign out</button></div>` : '<div style="padding:0 12px"><button class="btn sm primary" data-act="signin" style="width:100%">Sign in to sync</button></div>'; }

/* ---------- global events ---------- */
let md = null; document.addEventListener('mousedown', e => { md = e.target; });
document.addEventListener('input', e => { const f = e.target.closest && e.target.closest('[data-from]'); if (!f) return; const t = S.trips.find(x => x.id === f.dataset.from); if (!t) return; t.from = String(f.value).slice(0, 40).trim(); const a = document.querySelector(`[data-flights="${CSS.escape(t.id)}"]`); if (a) a.href = links(ofTrip(t), t.from || undefined).flights; save(); });
document.addEventListener('change', e => { if (e.target && e.target.id === 'nzBody') { S.profile.nzBody = String(e.target.value).slice(0, 20); save(); render(); } });
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); const ov = $('#overlay');
  if (e.target === ov && md === ov) return closeOverlay();
  if (!el) return;
  const a = el.dataset.act, id = el.dataset.id;
  if (a !== 'open' || !el.matches('a')) { /* allow links to proceed */ }
  if (a === 'skip') { e.preventDefault(); $('#main').focus(); return; } /* don't put #main in the hash: the router would read it as a route */
  if (a === 'howto') { const h = $('#how'); if (h) { h.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); h.focus({ preventScroll: true }); } return; }
  if (a === 'close') return closeOverlay();
  if (a === 'review') { const c = byId(id); if (c) startReview(skey(c), { year: el.dataset.year ? +el.dataset.year : undefined }); return; }
  if (a === 'rvdone') return backToConf(id);
  if (a === 'rvedit' || a === 'rvproof' || a === 'rvdel') {
    const c = byId(el.dataset.conf), v = c && reviewsFor(c).find(x => String(x.id) === String(id)); if (!v) return;
    if (a === 'rvedit') return reviewForm(skey(c), { edit: v, conf: c.id });
    if (a === 'rvproof') return proofDialog([v], { conf: c.id });
    if (confirm(`Delete your review for ${v.editionYear}?`)) { const r = await api('/api/reviews/' + encodeURIComponent(id), { method: 'DELETE' }); if (r.error) return toast(r.error); await refreshReviews(c.id); toast('Review deleted'); detail(c.id, false); }
    return;
  }
  if (a === 'rvreport') { if (!confirm('Report this review to the Hoggy moderators? Use this for abuse, named individuals, patient information or reviews that are not about the event.')) return; const r = await api('/api/reviews/' + encodeURIComponent(id) + '/report', { method: 'POST' }); toast(r.error ? r.error : 'Thanks, reported for moderation'); return; }
  if (a === 'more') { UI.limit += 48; return results(); }
  if (a === 'ics') { const c = byId(id); if (c) download(c.id + '.ics', ics(c), 'text/calendar'); return; }
  if (a === 'signin') return authDialog();
  if (a === 'signout') { await pushState(); await api('/api/logout', { method: 'POST' }); NET.user = null; NET.rev = 0; if (confirm('Signed out. Remove your trips, receipts and files from this device too?\n\nOK = remove them (recommended on a shared computer). Your account copy is kept.\nCancel = keep them on this device.')) { await DB.wipe(); FILES.clear(); UNSAVED.clear(); const th = S.profile.theme; S = defaults(); if (th) S.profile.theme = th; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } setOwner(''); } toast('Signed out'); render(); return; }
  if (a === 'checkinbox') return pullInbox(true);
  if (a === 'delaccount') { if (confirm('Delete your account, synced data and reviews from the server? Data on this device stays until you erase it.')) { const pw = prompt('Enter your password to confirm'); if (!pw) return; const r = await api('/api/account', { method: 'DELETE', body: { password: pw } }); if (r.error) return toast(r.error); NET.user = null; toast('Account deleted'); render(); } return; }
  if (a === 'open') { if (e.target.closest('[data-act=save]')) return; return detail(id); }
  if (a === 'save') { e.stopPropagation(); const i = S.saved.indexOf(id); i < 0 ? S.saved.push(id) : S.saved.splice(i, 1); save(); toast(i < 0 ? 'Saved' : 'Removed from saved'); renderNav(); if (!$('#overlay').hidden) detail(id); else { if (route() === 'discover') results(); else render(); } return; }
  if (a === 'plan') { if (!S.trips.some(t => t.confId === id)) { S.trips.push({ id: uid(), confId: id, status: 'planned', bookings: [] }); if (!S.saved.includes(id)) S.saved.push(id); save(); } closeOverlay(); toast('Trip planned'); location.hash = '#/trips'; render(); return; }
  if (a === 'rmtrip') { if (confirm('Remove this trip? Its receipts stay but become unlinked.')) { S.trips = S.trips.filter(t => t.id !== id); S.receipts.forEach(r => { if (r.tripId === id) r.tripId = ''; }); save(); render(); } return; }
  if (a === 'attend') { const t = S.trips.find(x => x.id === id), c = ofTrip(t); simpleDialog('Mark attended', `${field('h', 'CPD hours earned', `<input id="h" type="number" name="hours" min="0" step="0.5" value="${c.cpdVerified && c.cpdHours ? esc(c.cpdHours) : ''}" placeholder="Hours on your certificate" autofocus>`)}<p class="note">Enter the hours on your certificate or the organiser's confirmation.</p>${themeBoxes()}`, f => { t.status = 'attended'; S.cpd.push({ id: uid(), title: c.name, date: c.end, hours: Math.max(0, +f.get('hours') || 0), source: 'conference', tripId: t.id, themes: themeKeys(f) }); save(); closeOverlay(); toast('CPD hours logged'); render(); }, 'Log hours'); return; }
  if (a === 'addbook') { simpleDialog('Log a booking', `<div class="two">${field('b1', 'Type', '<select id="b1" name="type"><option>Flight</option><option>Hotel</option><option>Registration</option><option>Transport</option></select>')}${field('b2', 'Provider', '<input id="b2" type="text" name="vendor" required maxlength="60">')}</div><div class="two">${field('b3', 'Confirmation ref', '<input id="b3" type="text" name="ref" maxlength="30">')}${field('b4', 'Cost', '<input id="b4" type="number" step="0.01" min="0" name="amount" required>')}</div>`, f => { const t = S.trips.find(x => x.id === id); t.bookings.push({ id: uid(), type: f.get('type'), vendor: String(f.get('vendor')).slice(0, 60), ref: String(f.get('ref')).slice(0, 30), amount: +f.get('amount') || 0, date: today() }); save(); closeOverlay(); render(); }); return; }
  if (a === 'rmbook') { const t = S.trips.find(x => x.id === id); t.bookings = t.bookings.filter(b => b.id !== el.dataset.b); save(); render(); return; }
  if (a === 'addreceipt') { if (location.hash.includes('receipts') || true) { const inp = document.createElement('input'); } return receiptDialog({ tripId: id && S.trips.some(t => t.id === id) ? id : '' }); }
  if (a === 'openfile') { const r = S.receipts.find(x => x.id === id); return r && openFile(r); }
  if (a === 'editreceipt') { e.preventDefault(); return receiptDialog({ edit: id }); }
  if (a === 'rmreceipt') { if (confirm('Delete this receipt?')) { const r = S.receipts.find(x => x.id === id); if (r?.fileKey) delFile(r.fileKey); S.receipts = S.receipts.filter(x => x.id !== id); save(); closeOverlay(); render(); } return; }
  if (a === 'copy') { try { await navigator.clipboard.writeText(el.dataset.v); toast('Copied'); } catch (er) { toast('Copy failed — select and copy manually'); } return; }
  if (a === 'exportcsv') { const t = S.trips.find(x => x.id === id); download(`claim-${ofTrip(t).id}.csv`, csv([CLAIM_HEAD(), ...claimRows(t)])); return; }
  if (a === 'printpack') return printPack(S.trips.find(x => x.id === id));
  if (a === 'emailpack') return emailPack(S.trips.find(x => x.id === id));
  if (a === 'mailtopack') return mailtoPack(S.trips.find(x => x.id === id));
  if (a === 'leave') return leaveDialog(id);
  if (a === 'submitclaim') { const t = S.trips.find(x => x.id === id); S.receipts.forEach(r => { if (r.tripId === id && r.status === 'captured') r.status = 'claimed'; }); S.claims[id] = { ...(S.claims[id] || {}), submitted: today() }; save(); toast('Marked submitted'); render(); return; }
  if (a === 'paidclaim') { S.receipts.forEach(r => { if (r.tripId === id && r.status === 'claimed') r.status = 'paid'; }); S.claims[id] = { ...(S.claims[id] || {}), paid: today() }; save(); toast('Reimbursement recorded'); render(); return; }
  if (a === 'addcpd') { simpleDialog('Add CPD entry', `${field('c1', 'Activity', '<input id="c1" type="text" name="title" required maxlength="100" autofocus>')}<div class="two">${field('c2', 'Date', `<input id="c2" type="date" name="date" required value="${today()}">`)}${field('c3', 'Hours', '<input id="c3" type="number" name="hours" min="0.25" step="0.25" required>')}</div>${themeBoxes()}`, f => { S.cpd.push({ id: uid(), title: String(f.get('title')).slice(0, 100), date: f.get('date'), hours: +f.get('hours') || 0, source: 'manual', themes: themeKeys(f) }); save(); closeOverlay(); render(); }); return; }
  if (a === 'rmcpd') { S.cpd = S.cpd.filter(x => x.id !== id); save(); render(); return; }
  if (a === 'exportcpd') return download('cpd-log.csv', csv([['Date', 'Activity', 'Source', 'Hours'], ...S.cpd.map(e => [e.date, e.title, e.source, e.hours])]));
  if (a === 'backup') return download('hoggy-backup.json', JSON.stringify(S, null, 2), 'application/json');
  if (a === 'wipe') { if (confirm('Erase Hoggy data on this device?' + (NET.user ? '\n\nYour account copy is NOT deleted and will reload from the server.' : '\n\nThis cannot be undone.'))) { await DB.wipe(); FILES.clear(); UNSAVED.clear(); S = defaults(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } setOwner(''); if (NET.user) { await pullState(true); await syncFiles(); } render(); toast('Erased on this device'); } return; }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#overlay').hidden) closeOverlay();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.card')) { e.preventDefault(); detail(e.target.dataset.id); }
});
window.addEventListener('hashchange', () => { if (reviewHash()) { closeOverlay(true); render(); return openReviewLink(); } if (!Object.prototype.hasOwnProperty.call(ROUTES, (location.hash.replace(/^#\/?/, '') || 'home').split('?')[0])) return; closeOverlay(); render(); $('#main').focus({ preventScroll: true }); window.scrollTo(0, 0); });
if (!CONFS.length) console.warn('Hoggy: no conference data loaded (data/conferences.js)');
S.trips = S.trips.filter(t => byId(t.confId)); S.saved = S.saved.filter(byId);
render();
boot();
})();
