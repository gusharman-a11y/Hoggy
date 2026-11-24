/* Hoggy — medical conference scanner. Vanilla JS, no build. State in localStorage, receipt files in IndexedDB. */
(function () {
'use strict';
const CONFS = (window.HOGGY_CONFERENCES || []).slice();
const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const uid = () => Math.random().toString(36).slice(2, 10);
/* x10 expert review: attendance and price figures show only with a stored source (none have one yet); CPD only when verified */
const figAtt = c => c && c.attendees > 0 && c.attendeesSourceUrl ? c.attendees : 0;
const figPrice = c => c && c.priceFrom > 0 && c.priceSourceUrl ? c.priceFrom : 0;
const cpdLabel = c => c.cpdVerified && c.cpdHours ? c.cpdHours + ' CPD hrs' : c.kind === 'course' ? 'CPD: check provider' : 'CPD: check organiser';
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
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  course: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/><path d="M22 9v6"/>',
  cert: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3.5"/><rect x="4" y="8.5" width="17" height="11" rx="2"/><path d="M16.5 14h1"/>',
  user: '<circle cx="12" cy="8.5" r="3.7"/><path d="M4.5 20c1-4 4-5.5 7.5-5.5s6.5 1.5 7.5 5.5"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  pause: '<path d="M9 6v12M15 6v12"/>',
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  bed: '<path d="M3 18v-9M3 13h18v5M21 13a3 3 0 0 0-3-3h-7v3"/><circle cx="7" cy="10.5" r="1.5"/>',
  cal: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.7 3 2.4 3.5 5.2"/>'
};
const icon = (n, c = 'ico') => `<svg class="${c}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;

/* ---------- storage ---------- */
const KEY = 'hoggy.v1';
const defaults = () => ({
  profile: { name: '', specialty: 'General Practice', country: 'Australia', city: 'Sydney', homeAirport: 'SYD', currency: 'AUD', cpdTarget: 50, cpdBody: 'RACGP', cpdYear: new Date().getFullYear(), inbox: 'dr-' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 20) : uid() + uid()), theme: 'auto',
    caps: {}, employer: {} },
  saved: [], trips: [], receipts: [], cpd: [], reviews: [], claims: {}, certs: []
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
/* date status (B30): 'confirmed' (organiser page, quote and check date stored), 'unchecked' (confirmed before quotes were stored), 'estimated' */
const dateEv = c => window.HoggyStats && HoggyStats.dateEvidence ? HoggyStats.dateEvidence(c) : (c.datesConfirmed === false ? 'estimated' : 'unchecked');
const range = c => { if (c.datesConfirmed === false) return 'Usually ' + new Date(c.start + 'T00:00:00').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }); const a = new Date(c.start + 'T00:00:00'), b = new Date(c.end + 'T00:00:00'); if (c.end === c.start) return a.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${a.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}` : `${fmtD(c.start, { day: 'numeric', month: 'short' })} – ${fmtD(c.end)}`; };
const money = (n, cur) => { try { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: cur || S.profile.currency, maximumFractionDigits: 2 }).format(n || 0); } catch (e) { return (cur || '') + ' ' + (n || 0).toFixed(2); } };
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const HUES = { Cardiology: 350, Oncology: 300, 'General Practice': 160, 'Emergency Medicine': 15, Neurology: 262, Anaesthesia: 200, Surgery: 5, Paediatrics: 45, Psychiatry: 280, Radiology: 220, Dermatology: 25, 'Critical Care': 340, 'Public Health': 140, Endocrinology: 190, Respiratory: 205, 'Infectious Disease': 95, 'Obstetrics & Gynaecology': 320, Orthopaedics: 30, Ophthalmology: 235, 'Medical Education': 120 };
const hue = c => HUES[c.specialty] ?? hash(c.specialty) % 360;
const grad = c => { const h = hue(c); return `linear-gradient(135deg,hsl(${h} 70% 42%),hsl(${(h + 40) % 360} 75% 28%))`; };
const initials = c => { if (c.short) return c.short; const m = c.name.match(/\b[A-Z]{2,6}\b/); return m ? m[0] : c.name.split(/\s+/).filter(w => /^[A-Za-z]/.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase(); };
/* courses (data/courses via /api/courses): catalogue, upcoming sessions, and course sessions in trips (CEV: id -> event) */
const HC = window.HoggyCourses;
const COURSES = { cat: null, summary: {}, sessions: [], have: new Set(), full: false, loaded: false, pending: new Map() };
const CEV = new Map();
const byId = id => CONFS.find(c => c.id === id) || CEV.get(id);
/* a trip stays while its conference is known, or when it is a course trip carrying its own copy of the session */
const keepTrip = t => { if (t && t.event && t.event.kind === 'course' && t.confId === t.event.id && !CEV.has(t.confId)) CEV.set(t.confId, t.event); return !!byId(t.confId); };
const ofTrip = t => byId(t.confId);
const stars = r => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
const csv = rows => rows.map(r => r.map(v => { v = String(v ?? ''); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\r\n');
const download = (name, text, type = 'text/csv') => { const a = document.createElement('a'); const u = URL.createObjectURL(new Blob([text], { type })); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1500); };
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 2800); }
const safeUrl = u => { try { const x = new URL(u); return x.protocol === 'https:' ? x.href : '#'; } catch (e) { return '#'; } };

/* ---------- reviews: per conference series (every edition), from the Hoggy server ---------- */
const DIM_LABELS = [['content', 'Content & speakers'], ['networking', 'Networking'], ['venue', 'Venue & organisation'], ['value', 'Value for money'], ['cpd', 'CPD worth']];
const NET = { online: false, user: null, rev: 0, ratings: {}, reviews: {}, mine: [], busy: false, top: {}, cov: {} };
const SKEYS = new WeakMap(); /* computed once per conference object */
const skey = c => { let k = SKEYS.get(c); if (!k) { k = window.HoggySeries ? window.HoggySeries.seriesKey(c) : c.id; SKEYS.set(c, k); } return k; };
const editionsOf = key => CONFS.filter(c => skey(c) === key).sort((a, b) => a.start.localeCompare(b.start));
const reviewsFor = c => NET.online ? (NET.reviews[skey(c)] || []) : S.reviews.filter(r => r.confId === c.id);
const scoreOf = c => NET.online ? NET.ratings[skey(c)] || null : null;
const scoreShown = c => { const s = scoreOf(c); return s && s.avg != null ? s.avg : null; };
const reviewCount = c => { const s = scoreOf(c); return s ? s.n : 0; };
const rating = c => scoreShown(c);
const reviewedYear = (key, year) => NET.mine.some(r => r.seriesKey === key && r.editionYear === year);
/* "Dr Ana Tanaka" -> "Ana": skip titles */
const firstName = n => { const w = String(n).trim().split(/\s+/); return w.find(x => !/^(dr|prof|professor|a\/prof|assoc|associate|mr|mrs|ms|miss|mx|sir|dame)\.?$/i.test(x)) || w[0]; };
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
/* one-time move of a saved specialty to the canonical list (e.g. "Anaesthesiology" -> "Anaesthesia"). An unknown name is
   left as the user typed it. profile.specV marks the profile as done, so a later choice is never rewritten. */
const SPEC_V = 1;
function migrateSpecialty(p) {
  if (!p || p.specV >= SPEC_V) return false;
  const HS = window.HoggySpecialties, c = HS && p.specialty ? HS.canon(p.specialty) : null;
  if (!HS) return false;
  if (c) p.specialty = c; p.specV = SPEC_V; return true;
}
if (migrateSpecialty(S.profile)) { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
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
    if (Array.isArray(srv)) for (const r of [...S.receipts, ...(S.certs || [])]) if (r.fileKey) {
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
/* tax-invoice check (AUD receipts): flags with help text, never a block */
const HP = () => window.HoggyPack;
const taxHtml = (r, n) => HP().taxFlags(r).slice(0, n || 3).map(f => `<div class="check ${f.code === 'no-abn-small' ? 'info' : 'warn'} taxflag" data-testid="tax-flag" data-code="${esc(f.code)}"><span aria-hidden="true">!</span><span>${esc(f.t)}<span class="help">${esc(f.help)}</span></span></div>`).join('');
/* receipt checklist per trip: from the approval request, the trip's saved estimate or the study-leave draft */
function tripEstimate(t) {
  const a = inHosp() ? approvalOf(t) : null, c = ofTrip(t);
  if (a && a.costs) return Object.fromEntries(Object.entries(a.costs).map(([k, v]) => [k, (+v || 0) / 100]));
  return t.estimate || ((S.leave || {})[c && c.id] || {}).est || null;
}
const tripChecklist = t => { const c = ofTrip(t); return HP().checklist({ estimate: tripEstimate(t), kind: c && c.kind === 'course' ? 'course' : 'conference' }, S.receipts.filter(r => r.tripId === t.id), (S.claims[t.id] || {}).waived); };
function checklistHtml(t) {
  const list = tripChecklist(t);
  return `<div class="checklist" data-testid="checklist" data-trip="${esc(t.id)}"><h3>Receipt checklist</h3><ul>${list.map(i => `<li class="ci ${i.status}" data-key="${esc(i.key)}" data-status="${esc(i.status)}"><span class="ci-mark" aria-hidden="true">${i.status === 'ok' ? '✓' : i.status === 'waived' ? '–' : '○'}</span><span class="ci-t"><b>${esc(i.label)}</b> ${i.status === 'ok' ? `<span class="note">${plural(i.receipts, 'receipt')}</span>` : i.status === 'waived' ? `<span class="note">No receipt. Reason: ${esc(i.reason)}</span>` : '<span class="note">No receipt yet</span>'}</span>${i.status === 'missing' ? `<button class="btn sm ghost" data-act="noreceipt" data-id="${esc(t.id)}" data-v="${esc(i.key)}">I don't have this receipt</button>` : i.status === 'waived' ? `<button class="btn sm ghost" data-act="undonoreceipt" data-id="${esc(t.id)}" data-v="${esc(i.key)}">Undo</button>` : ''}<span class="sr-only">${i.status === 'ok' ? 'done' : i.status === 'waived' ? 'no receipt, reason given' : 'missing'}</span></li>`).join('')}</ul></div>`;
}
/* amounts by currency on a claim, so foreign receipts are never added to the home total unconverted */
function currencyHtml(rs) {
  const home = S.profile.currency, by = HP().currencyTotals(rs, homeAmt, home);
  if (!by.some(x => x.currency !== home)) return '';
  return `<div class="pills cur-split" data-testid="currency-split" aria-label="Amounts by currency">${by.map(x => x.currency === home ? `<span class="pill">${esc(money(x.amount, home))}</span>` : `<span class="pill ${x.noRate ? 'b' : ''}">${esc(money(x.amount, x.currency))} ${x.noRate ? '· no exchange rate, not in the total' : '→ ' + esc(money(x.converted, home))}</span>`).join('')}</div>`;
}
const currencyLine = rs => { const home = S.profile.currency, by = HP().currencyTotals(rs, homeAmt, home).filter(x => x.currency !== home); return by.length ? 'Foreign-currency receipts: ' + by.map(x => `${money(x.amount, x.currency)} = ${x.noRate ? 'no exchange rate entered, not in the total' : money(x.converted, home) + ' at the rates in the schedule'}`).join('; ') + '.' : ''; };

/* ---------- router / shell ---------- */
/* [label, icon, hidden from the nav]. Five tabs: Home, Discover, Trips, Wallet, You. Courses sit under Discover (Conferences / Courses);
   receipts, claims, CPD and certificates under Wallet; settings and the hospital pages under You */
const ROUTES = { home: ['Home', 'home'], discover: ['Discover', 'search'], trips: ['Trips', 'plane'], wallet: ['Wallet', 'wallet'], settings: ['You', 'user'], courses: ['Courses', 'course', true], receipts: ['Receipts', 'receipt', true], claims: ['Claims', 'claim', true], cpd: ['CPD', 'cpd', true], certs: ['My certificates', 'cert', true], 'list-event': ['List your event', 'plus', true] };
/* five tabs: each one also lights up for the pages that live under it */
const TAB_OF = { courses: 'discover', receipts: 'wallet', claims: 'wallet', cpd: 'wallet', certs: 'wallet', approvals: 'settings', team: 'settings', finance: 'settings' };
const reviewHash = () => { const m = location.hash.match(/^#\/review\/([a-z0-9-]{1,80})$/); return m ? m[1] : null; };
/* #/courses/<courseId>?state=NSW&month=2027-03 */
const hashParts = () => { const [path, qs] = location.hash.replace(/^#\/?/, '').split('?'); return { parts: path.split('/'), q: new URLSearchParams(qs || '') }; };
const knownRoute = () => { const { parts } = hashParts(), r = parts[0] || 'home'; return Object.prototype.hasOwnProperty.call(ROUTES, r) && (parts.length === 1 || (r === 'courses' && parts.length === 2 && /^[a-z0-9-]{1,40}$/.test(parts[1]))); };
const route = () => { if (reviewHash()) return 'discover'; return knownRoute() ? hashParts().parts[0] || 'home' : 'home'; };
/* share links (#/review/<seriesKey>) open the review form straight away, after sign-in if needed */
function openReviewLink() { const k = reviewHash(); if (!k || !NET.booted) return; if (!startReview(k)) history.replaceState(null, '', '#/discover'); }
function renderNav() {
  renderAcct();
  const cur = route(), tab = TAB_OF[cur] || cur, open = S.receipts.filter(r => r.status === 'captured').length, due = certRows().filter(x => HC.needsAttention(x.st)).length;
  /* hospital pages: in the desktop bar for the roles that use them; on phones they open from You, Your hospital,
     so the tab bar keeps its 5 tabs (You carries the badge and is highlighted while one of them is open) */
  const hb = hospBadge(), hn = HOSP.counts || {};
  const roleLinks = HOSP_ROUTES.filter(([, w]) => hcan(w)).map(([k]) => { const n = k === 'approvals' ? hn.approvals : k === 'finance' ? hn.claims : 0; return `<a href="#/${k}" class="desk" ${k === cur ? 'aria-current="page"' : ''}>${icon(ROUTES[k][1])}<span>${ROUTES[k][0]}</span>${n ? `<span class="badge">${n}</span>` : ''}</a>`; }).join('');
  $('#nav').innerHTML = Object.entries(ROUTES).filter(([, v]) => !v[2]).map(([k, [l, ic]]) => `<a href="#/${k}" ${k === cur ? 'aria-current="page"' : k === tab ? 'class="alt-cur"' : ''}>${icon(ic)}<span>${l}</span>${k === 'wallet' && open + due ? `<span class="badge" title="${open ? plural(open, 'receipt') + ' not yet claimed' : ''}${open && due ? ', ' : ''}${due ? plural(due, 'certificate') + ' due or expired' : ''}">${open + due}</span>` : k === 'settings' && hb ? `<span class="badge mob-only" title="Hospital: ${hb} to look at">${hb}</span>${hn.unread ? `<span class="badge desk-only" title="${hn.unread} unread from your hospital">${hn.unread}</span>` : ''}` : ''}</a>`).join('') + roleLinks;
}
function applyTheme() { const t = S.profile.theme; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }
/* background refresh (data arrived from the server): keep the scroll position and never wipe a field the user is typing in */
function bgRender() {
  if (route() === 'discover' && $('#results')) { renderNav(); results(); return; }
  const a = document.activeElement; if (a && $('#main').contains(a) && a.matches('input,textarea,select')) { a.addEventListener('blur', () => setTimeout(bgRender, 0), { once: true }); return; }
  const y = window.scrollY; render(); if (window.scrollY !== y) window.scrollTo(0, y);
}
const MOTION = window.HoggyMotion || null;
function render() { applyTheme(); renderNav(); const r = route(); document.body.dataset.route = r; { const k = hashParts().parts.join('/'); if (FS.route !== k) { FS.open = false; FS.route = k; } } document.body.classList.toggle('filters-open', FS.open); $('#main').innerHTML = netBanner() + VIEWS[r]() + appFooter(); (AFTER[r] || (() => { }))(); document.title = r === 'home' ? 'Hoggy · Medical conferences and courses' : `${r === 'settings' ? 'Settings' : ROUTES[r][0]} · Hoggy`; if (MOTION) MOTION.scan($('#main')); }
/* the filter sheet (phones): open state survives the re-render a changed filter causes, and resets on a new page */
const FS = { open: false, route: '' };
function filterSheet(on, focus) {
  FS.open = !!on; document.body.classList.toggle('filters-open', FS.open);
  const b = $('[data-act=filters]'); if (b) b.setAttribute('aria-expanded', String(FS.open));
  if (focus) { const t = FS.open ? $('#fsheet select, #fsheet input') : b; if (t) t.focus({ preventScroll: true }); }
}
/* ---------- connection banner, footer ---------- */
const TROUBLE = 'We\u2019re having trouble connecting \u2014 try again in a minute.';
function netBanner() {
  if (NET.offline) return `<div class="net-banner" role="status"><span>You\u2019re offline. Hoggy keeps working with what\u2019s on this device, and syncs when you\u2019re back online.</span></div>`;
  if (NET.trouble) return `<div class="net-banner" role="status"><span>${TROUBLE} You can still browse conferences and courses.</span><button type="button" class="btn sm" data-act="retry">Try again</button></div>`;
  return '';
}
const appFooter = () => `<footer class="app-foot" aria-label="Site"><nav aria-label="Footer"><ul><li><a href="/about">About Hoggy</a></li><li><a href="/privacy">Privacy</a></li><li><a href="/terms">Terms</a></li><li><a href="#/list-event">Organisers: list your event</a></li></ul></nav><p>Hoggy lists medical conferences and courses for planning. Check dates, fees and CPD with the organiser before you book.</p></footer>`;

/* ---------- plates: the generated artwork (lib/art.js) ---------- */
const ART = window.HoggyArt;
const plate = (c, size) => !ART || !c ? '' : c.kind === 'course' ? ART.dial(c.courseId || c.id, dialLabel(c.short || c.name), { size, sub: fmtD(c.start) }) : ART.plate(c, { size, ev: dateEv(c) });
/* a dial's lettering: the short name, else the capitals of a long one ("Advanced Paediatric Life Support" -> "APLS") */
const dialLabel = s => { s = String(s || ''); if (s.length <= 9) return s; const a = s.split(/[\s/-]+/).filter(w => /^[A-Z0-9]/.test(w)).map(w => w[0]).join('').slice(0, 5); return a.length > 1 ? a : s.split(/\s+/)[0].slice(0, 9); };
const coursePlate = (c, size) => ART ? ART.dial(c.id, dialLabel(HC.shortName(c)), { size, sub: (c.countries || []).slice(0, 5).join(' · ') + ((c.countries || []).length > 5 ? ' +' + ((c.countries || []).length - 5) : '') }) : '';
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
/* the one status line a card carries: what Hoggy knows about the dates, and from where */
const evLine = c => { const st = dateEv(c), h = st === 'confirmed' ? hostOf(c.datesSourceUrl) : ''; return st === 'confirmed' ? `<span class="pill g" title="Read on the organiser's own page, with the wording stored">Dates confirmed${h ? ' · ' + esc(h) : ''}</span>` : st === 'estimated' ? '<span class="pill w" title="The organiser has not published dates yet">Estimate · confirm with organiser</span>' : '<span class="pill" title="Confirmed before Hoggy stored the organiser\'s wording; being re-checked">Confirmed earlier · being re-checked</span>'; };
const CHEV = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
/* a ring that fills to pct (0 to 100); the number sits beside it in text */
const dialSvg = (pct, cls = '') => `<svg class="dial ${cls}" viewBox="0 0 120 120" aria-hidden="true"><circle class="dial-k" cx="60" cy="60" r="56"/><circle class="dial-t" cx="60" cy="60" r="46"/><circle class="dial-v" cx="60" cy="60" r="46" pathLength="100" style="--p:${Math.max(0, Math.min(100, pct))}"/></svg>`;
const count = (n, text) => `<span data-count="${Number(n) || 0}">${text == null ? Number(n).toLocaleString('en-AU') : text}</span>`;
/* a swipeable shelf of cards with a ruled heading; nothing at all when it would be empty */
const shelf = (title, items, more = '', id = '') => items ? `<section class="shelf-sec"${id ? ` aria-labelledby="${id}"` : ''}><div class="section"><h2${id ? ` id="${id}"` : ''}>${title}</h2>${more}</div><div class="grid ex shelf">${items}</div></section>` : '';

/* ---------- cards ---------- */
const holPill = c => { if (typeof holHits !== 'function') return ''; const h = holHits(c, 'ANZ'); return h.length ? `<span class="tag" title="${esc('School holidays overlap this conference in: ' + h.map(r => r.name).join(', '))}">School hols: ${esc(h.map(r => r.code).join(' '))}</span>` : ''; };
function card(c) {
  const on = S.saved.includes(c.id), sc = scoreShown(c), n = reviewCount(c);
  return `<article class="card" data-act="open" data-id="${esc(c.id)}">
    <div class="art">${plate(c, 'tall')}<button class="save ${on ? 'on' : ''}" data-act="save" data-id="${esc(c.id)}" aria-label="Save ${esc(c.name)}" aria-pressed="${on}">${icon('heart')}</button></div>
    <div class="card-body"><p class="card-when">${esc(range(c))}</p><h3><a class="card-link" href="/conferences/${esc(encodeURIComponent(c.id))}" data-act="open" data-id="${esc(c.id)}">${esc(c.name)}</a></h3>
    <p class="card-where">${esc(c.city)}, ${esc(c.country)} · ${esc(c.specialty)}</p>
    <div class="card-meta">${evLine(c)}${c.cpdVerified && c.cpdHours ? `<span class="tag" title="Credits stated by the organiser">${esc(cpdLabel(c))}</span>` : ''}${holPill(c)}${sc != null ? `<span class="tag"><span class="stars" aria-hidden="true">★</span> ${sc.toFixed(1)}<span class="sr-only"> out of 5</span></span>` : n ? `<span class="tag">${n} early review${n > 1 ? 's' : ''}</span>` : ''}</div></div></article>`;
}

/* ---------- views ---------- */
const upcoming = () => CONFS.filter(c => new Date(c.end + 'T23:59:59') >= new Date()).sort((a, b) => a.start.localeCompare(b.start));
const matchScore = c => (c.specialty === S.profile.specialty ? 50 : 0) + (c.country === S.profile.country ? 25 : 0) + (c.region === 'Asia-Pacific' ? 5 : 0) + c.cpdHours;
const VIEWS = {
  home() {
    const p = S.profile, trips = S.trips.filter(t => t.status === 'planned').sort((a, b) => ofTrip(a).start.localeCompare(ofTrip(b).start)), next = trips.find(t => ofTrip(t).end >= today()) || trips[0];
    const cap = S.receipts.filter(r => r.status === 'captured'), unclaimed = cap.reduce((a, r) => a + homeAmt(r), 0), pending = S.receipts.filter(r => r.status === 'claimed').reduce((a, r) => a + homeAmt(r), 0);
    const tot = cpdTotal(), pct = Math.min(100, Math.round(tot / (p.cpdTarget || 1) * 100));
    const active = S.trips.length || S.receipts.length || S.cpd.length || S.certs.length || inHosp() || NET.user;
    const fresh = S.onboard && !S.onboard.dismissed;
    const crs = certRows(), nextCert = crs.find(x => x.expires && x.st !== 'expired') || crs[0];
    const HS = window.HoggyStats, st = HS ? HS.homeStats(CONFS, today()) : null, examples = HS ? HS.exampleConfs(CONFS, today(), 12) : upcoming().slice(0, 12), n = v => Number(v).toLocaleString('en-AU');
    const ct = COURSES.loaded ? HC.courseTotals(COURSES.summary, COURSES.cat) : null;
    /* ----- signed in, or already using it: the dashboard ----- */
    const nc = next ? ofTrip(next) : null, days = nc ? HC.daysBetween(today(), nc.start) : 0, left = Math.max(0, p.cpdTarget - tot);
    const nextBox = nc ? `<a class="dash-next" href="#/trips"><div class="dash-plate">${plate(nc, 'tall')}</div><div class="dash-next-b"><span class="lbl">Next trip</span>
        ${days > 0 ? `<b class="fig">${count(days)}<small>${days === 1 ? 'day' : 'days'} to go</small></b>` : `<b class="fig"><small>${nc.end >= today() ? 'On now' : 'Finished ' + esc(whenText(nc.end))}</small></b>`}
        <span class="dash-name">${esc(nc.name)}</span><span class="dash-s">${esc(nc.city)} · ${esc(range(nc))}</span>
        <span class="dash-s">${plural((next.bookings || []).length, 'booking')} logged · ${plural(S.receipts.filter(r => r.tripId === next.id).length, 'receipt')}</span></div></a>`
      : `<a class="dash-next none" href="#/discover"><div class="dash-next-b"><span class="lbl">Next trip</span><b class="fig"><small>None planned</small></b><span class="dash-s">Find a conference or course, then choose Plan trip. Hoggy opens flight and hotel searches for the exact dates.</span><span class="btn sm primary">Find one</span></div></a>`;
    const spec = p.specialty && CONFS.some(c => c.specialty === p.specialty) ? upcoming().filter(c => c.specialty === p.specialty).sort((a, b) => (b.country === p.country) - (a.country === p.country) || (dateEv(a) === 'estimated') - (dateEv(b) === 'estimated') || a.start.localeCompare(b.start)).slice(0, 10) : [];
    const hp = homePlace(), near = COURSES.loaded ? COURSES.cat.courses.filter(c => HC.countFor(COURSES.summary[c.id], hp, 'en').n > 0).sort((a, b) => HC.relevanceOf(b) - HC.relevanceOf(a) || HC.countFor(COURSES.summary[a.id], hp, 'en').next.localeCompare(HC.countFor(COURSES.summary[b.id], hp, 'en').next)).slice(0, 8) : [];
    const savedL = S.saved.map(byId).filter(Boolean).slice(0, 12);
    const dash = `<section class="hero hero-dash"><p class="kicker">${esc(new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }))}</p><h1>${fresh ? 'Welcome' : 'Welcome back'}${p.name ? ', ' + esc(firstName(p.name)) : ''}.</h1>
      <p>Your conferences, trips, receipts and CPD in one place.</p>
      <div class="row"><a class="btn primary" href="#/discover">Find conferences</a><a class="btn ghost" href="#/receipts">Add a receipt</a></div></section>
    ${getStarted()}${remindCard()}${hospHome()}<div class="dash">${nextBox}
      <a class="dash-tile dash-cpd" href="#/cpd">${dialSvg(pct)}<div><span class="lbl">CPD ${esc(p.cpdYear)}${p.cpdBody ? ' · ' + esc(p.cpdBody) : ''}</span><b class="fig">${count(tot, String(tot))}<small>of ${esc(p.cpdTarget)} h</small></b><span class="dash-s">${left ? esc(left) + ' hours to go' : 'Target reached'}</span></div></a>
      <a class="dash-tile" href="#/certs"><span class="lbl">Certificates</span><b class="fig">${count(crs.length)}</b><span class="dash-s">${nextCert && nextCert.expires ? esc(nextCert.short) + (nextCert.st === 'expired' ? ' expired ' : ' due ') + esc(fmtD(nextCert.expires)) : 'Add your APLS or ALS certificate'}</span></a>
      <a class="dash-tile" href="#/claims"><span class="lbl">Not yet claimed</span><b class="fig sm">${money(unclaimed)}</b><span class="dash-s">${plural(cap.length, 'receipt')} waiting</span></a>
      <a class="dash-tile" href="#/claims"><span class="lbl">Awaiting reimbursement</span><b class="fig sm">${money(pending)}</b><span class="dash-s">Submitted, not yet paid</span></a></div>
    ${shelf('For ' + esc(p.specialty), spec.map(card).join(''), '<a href="#/discover">Browse all</a>', 'forH')}
    ${shelf('Courses in ' + esc(HC.placeLabel(hp)), near.map(c => courseCard(c, hp, 'en')).join(''), '<a href="#/courses">All courses</a>', 'nearH')}
    ${shelf('Saved', savedL.map(card).join(''), '', 'savedH')}`;
    /* ----- first visit, signed out: one scroll that explains the product ----- */
    const fan = examples.slice(0, 3);
    const hero = `<section class="hero hero-intro"><div class="hero-copy"><p class="kicker">For doctors who travel for CPD</p>
      <h1>Find the conference. <em>Hoggy helps with the admin.</em></h1>
      <p class="hero-lede">Find a meeting, plan the trip, keep every receipt and hand your hospital or employer a claim-ready pack.</p>
      <form class="hero-search" id="heroSearch" role="search"><label class="search">${icon('search')}<span class="sr-only">Search conferences and courses</span><input id="hq" type="search" name="q" placeholder="Specialty, city or name" autocomplete="off"></label><button class="btn primary lg" type="submit">Search</button></form>
      <p class="hero-sub">No account needed to search. <a class="u" href="#/discover">Browse all conferences</a> · <a class="u" href="#/courses">Browse courses</a></p>
      <div class="row hero-acts">${NET.online ? '<button type="button" class="btn ghost" data-act="register">Create an account</button>' : ''}<button type="button" class="btn ghost" data-act="howto">See how it works</button></div></div>
      <div class="hero-fan" aria-hidden="true">${fan.map((c, i) => `<div class="fan-card f${i}">${plate(c, 'tall')}<span class="fan-cap">${esc(c.city)}</span></div>`).join('')}</div></section>`;
    const tick = (c, dup) => `<button type="button" class="tick-item" data-act="open" data-id="${esc(c.id)}"${dup ? ' tabindex="-1"' : ''}><b>${esc(fmtD(c.start, { day: 'numeric', month: 'short' }))}</b><span>${esc(c.name)}</span><i>${esc(c.city)}</i></button>`;
    const ticker = examples.length > 3 ? `<section class="ticker" aria-label="${examples.every(c => dateEv(c) === 'confirmed') ? 'Coming up, dates confirmed' : 'Coming up'}: moving list"><button type="button" class="tick-pause" data-act="tickpause" aria-pressed="false" aria-label="Pause the moving list">${icon('pause')}</button><div class="tick-view"><div class="tick-track"><div class="tick-set">${examples.map(c => tick(c)).join('')}</div><div class="tick-set" aria-hidden="true">${examples.map(c => tick(c, true)).join('')}</div></div></div></section>` : '';
    const ex0 = examples[0];
    const vis = [
      ex0 ? `<div class="vis vis-find">${plate(ex0, 'square')}<span class="pill g">Dates confirmed</span></div>` : '',
      ex0 ? `<div class="vis vis-plan"><div class="stub"><b>${esc(ex0.city)}</b><span>${esc(range(ex0))}</span></div><div class="stub-b"><span>Flights</span><span>Hotels</span></div></div>` : '',
      `<div class="vis vis-rc"><div class="rc-slip"><span>Amount</span><span>Date</span><span>Trip</span><span>File</span></div></div>`,
      `<div class="vis vis-claim">${dialSvg(100, 'done')}<span>Claim-ready</span></div>`];
    const steps = [
      ['search', 'Find a conference', 'Search by specialty, country, month and CPD. Each listing says whether its dates are confirmed by the organiser or still an estimate.'],
      ['plane', 'Plan the trip', 'Save it as a trip. Hoggy opens flight and hotel searches prefilled with your dates, and you book with the provider.'],
      ['receipt', 'Forward or snap receipts', 'Forward booking emails to your private Hoggy address, or add a PDF or photo. Hoggy reads the amount and date where it can and suggests the trip.'],
      ['claim', 'Claim-ready pack, CPD logged', 'Missing details are flagged before you export. Print or email the pack, then mark the trip attended to log your CPD hours.']];
    const how = `<section class="how" id="how" tabindex="-1" aria-labelledby="howH"><div class="section"><h2 id="howH">How it works</h2></div>
      <ol class="steps">${steps.map(([ic, t, d], i) => `<li class="step"><span class="step-n" aria-hidden="true">0${i + 1}</span>${vis[i]}<h3>${t}</h3><p>${d}</p></li>`).join('')}</ol></section>`;
    const benefits = [
      ['One place for the whole trip', 'The conference, your bookings, receipts and CPD sit together, so nothing lives in a stray inbox folder.'],
      ['A claim pack your employer can check', 'Every receipt needs a file, amount, date and trip before export. Print it, email it or download a CSV.'],
      ['CPD and certificates tracked as you go', 'Log hours from conferences and courses against your yearly target and export the log as a CSV (college-specific formats are not built yet). Find APLS and ALS course dates, and add your certificate so Hoggy shows when it is due for renewal.'],
      ['Dates you can check', 'Confirmed dates come from the organiser\'s own page, with the link, the wording Hoggy read and the date it checked. Dates confirmed before Hoggy stored the wording say so until they are re-checked, and estimates are labelled.']];
    const ben = `<section class="ben" aria-labelledby="benH"><div class="section"><h2 id="benH">What you get</h2></div>
      <div class="benefits">${benefits.map(([t, d]) => `<div class="benefit"><h3>${t}</h3><p>${d}</p></div>`).join('')}</div></section>`;
    const live = st && st.conferences ? `<section class="live" aria-labelledby="liveH"><div class="live-head"><h2 id="liveH">Live data</h2><span>Counted from Hoggy's conference and course lists just now</span></div>
      <dl class="live-grid"><div><dt>Upcoming conferences</dt><dd>${count(st.conferences)}</dd></div><div><dt>Countries</dt><dd>${count(st.countries)}</dd></div><div><dt>Specialties</dt><dd>${count(st.specialties)}</dd></div>${ct && ct.sessions ? `<div><dt>Course sessions</dt><dd>${count(ct.sessions)}<span class="live-sub">${n(ct.types)} course types in ${n(ct.countries)} countries, dates read on each provider's page.</span></dd></div>` : ''}
      <div class="live-dates"><dt>Conference dates</dt><dd class="split-bar" aria-hidden="true"><i class="ok" style="flex:${st.confirmed}"></i><i class="mid" style="flex:${st.unchecked}"></i><i class="est" style="flex:${st.estimated}"></i></dd><dd class="split"><span class="ok"><b>${n(st.confirmed)}</b> confirmed with source stored</span><span class="mid"><b>${n(st.unchecked)}</b> confirmed earlier, being re-checked</span><span class="est"><b>${n(st.estimated)}</b> estimated (labelled)</span></dd></div></dl></section>` : '';
    const ex = shelf(examples.every(c => dateEv(c) === 'confirmed') ? 'Coming up, dates confirmed' : 'Coming up', examples.slice(0, 8).map(card).join(''), '<a href="#/discover">Browse all</a>', 'exH');
    const close = `<section class="hero hero-close"><h2>Ready for your next conference?</h2><p>Start with a search. No account needed to browse; create one when you want your trips, receipts and CPD saved across devices.</p>
      <div class="row"><a class="btn primary lg" href="#/discover">Find conferences</a>${NET.online && !NET.user ? '<button type="button" class="btn ghost lg" data-act="register">Create an account</button><button type="button" class="btn ghost lg" data-act="signin">Sign in</button>' : ''}</div></section>`;
    const top = topSection(); /* nothing at all until a series has 3 reviews */
    return active ? dash + top + live : hero + ticker + how + top + ex + ben + live + close;
  },
  discover() {
    const specs = [...new Set(CONFS.map(c => c.specialty))].sort(), regs = [...new Set(CONFS.map(c => c.region))].sort(), ctry = [...new Set(CONFS.map(c => c.country))].sort();
    const HS = window.HoggyStats, ds = HS && HS.discoverSummary ? HS.discoverSummary(CONFS, today()) : null, n = v => Number(v).toLocaleString('en-AU'), mon = iso => fmtD(iso, { month: 'short', year: 'numeric' });
    const ct = COURSES.loaded ? HC.courseTotals(COURSES.summary, COURSES.cat) : null;
    const sub = ds && ds.conferences ? `${n(ds.conferences)} upcoming conferences in ${n(ds.countries)} countries, ${esc(mon(ds.from))} to ${esc(mon(ds.to))}: ${n(ds.confirmed)} confirmed with source stored · ${n(ds.unchecked)} confirmed earlier, being re-checked · ${n(ds.estimated)} estimated (labelled).${ct && ct.sessions ? ` Courses: ${n(ct.sessions)} sessions of ${n(ct.types)} course types.` : ''}` : `${n(upcoming().length)} upcoming conferences.`;
    const sel = (id, label, opts) => `<label class="sel"><span class="sel-l">${label}</span><select id="${id}" aria-label="${label}">${opts}</select></label>`;
    return `<div class="page-head"><div><h1>Discover</h1><p>${sub} Filter by specialty, region, country, month and published CPD.</p></div><a class="btn sm ghost" href="#/list-event">Organisers: list your event</a></div>${segToggle('discover')}
    <div class="filters"><div class="filter-top"><label class="search">${icon('search')}<input id="q" type="search" placeholder="Search conferences, courses, cities…" aria-label="Search conferences and courses" autocomplete="off"></label>
      <button type="button" class="btn filt-btn" data-act="filters" aria-expanded="${FS.open}" aria-controls="fsheet">${icon('sliders')} Filters<span class="badge" id="fN" hidden></span></button></div>
      <div class="chips" id="specChips" role="group" aria-label="Specialty"><button class="chip" aria-pressed="true" data-spec="All">All</button>${specs.map(s => `<button class="chip" aria-pressed="false" data-spec="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <div class="fsheet" id="fsheet" role="group" aria-label="Filters"><div class="fsheet-head"><span class="grab" aria-hidden="true"></span><h2>Filters</h2><button type="button" class="icon-btn" data-act="filtersclose" aria-label="Close filters">${icon('x')}</button></div>
      <div class="selects">${sel('fRegion', 'Region', `<option value="">All regions</option>${regs.map(r => `<option>${esc(r)}</option>`).join('')}`)}
        ${sel('fCountry', 'Country', `<option value="">All countries</option>${ctry.map(r => `<option>${esc(r)}</option>`).join('')}`)}
        ${sel('fMonth', 'Month', `<option value="">Any month</option>${Array.from({ length: 12 }, (_, i) => `<option value="${i}">${new Date(2027, i, 1).toLocaleDateString('en-AU', { month: 'long' })}</option>`).join('')}`)}
        ${HOL.length ? sel('fHol', 'School holidays', `<option value="">Any time of year</option><option value="ANZ">In any AU or NZ school holidays</option><option value="AU">In any Australian school holidays</option>${HOL.map(r => `<option value="${esc(r.code)}">In ${esc(r.name)} school holidays</option>`).join('')}`) : ''}
        ${sel('fCpd', 'CPD credits', '<option value="0">Any CPD</option><option value="1">CPD credits published</option>')}
        ${sel('fConf', 'Date status', '<option value="">Any dates</option><option value="1">Confirmed dates only</option><option value="2">Confirmed, source re-checked</option>')}
        ${sel('fSort', 'Sort', `<option value="date">Soonest</option><option value="rating">Highest rated by attendees</option><option value="cpd">Most CPD (published)</option>${CONFS.some(figPrice) ? '<option value="price">Lowest price</option>' : ''}<option value="match">Closest match</option>`)}</div>
      <div class="fsheet-foot"><button type="button" class="btn ghost" data-act="clearfilters">Clear all</button><button type="button" class="btn primary" data-act="filtersclose" id="fShow">Show results</button></div></div>
      <span class="count" id="count" role="status"></span></div>
    <div class="scrim" data-act="filtersclose"></div>
    <section id="topList" class="toplist" aria-labelledby="topH" hidden></section>
    <h2 class="sr-only" id="resH">Results</h2><div class="grid" id="results" aria-labelledby="resH"></div>`;
  },
  wallet() {
    const p = S.profile, cap = S.receipts.filter(r => r.status === 'captured'), unclaimed = cap.reduce((a, r) => a + homeAmt(r), 0), pending = S.receipts.filter(r => r.status === 'claimed').reduce((a, r) => a + homeAmt(r), 0);
    const need = cap.filter(r => !ready(r)).length, claimsN = S.trips.filter(t => S.receipts.some(r => r.tripId === t.id)).length;
    const tot = cpdTotal(), pct = Math.min(100, Math.round(tot / (p.cpdTarget || 1) * 100)), left = Math.max(0, p.cpdTarget - tot), crs = certRows(), nextCert = crs.find(x => x.expires && x.st !== 'expired') || crs[0], due = crs.filter(x => HC.needsAttention(x.st)).length;
    const row = (href, k, fig, s, extra = '') => `<a class="wrow" href="${href}"><span class="wrow-k">${k}</span><b class="fig">${fig}</b><span class="wrow-s">${s}</span>${extra}${CHEV}</a>`;
    return `<div class="page-head"><div><h1>Wallet</h1><p>The paperwork for every trip: receipts, claims, CPD hours and certificates, kept claim-ready.</p></div><div class="row head-acts">${snapBtn('', true)}<button class="btn" data-act="addreceipt">${icon('plus')} Add receipt</button></div></div>${walletNav('wallet')}
    <div class="wallet">
      ${row('#/receipts', 'Receipts', count(S.receipts.length), cap.length ? `${plural(cap.length, 'receipt')} not yet claimed · ${money(unclaimed)}${need ? ` · <span class="pill w">${need} need${need === 1 ? 's' : ''} info</span>` : ''}` : S.receipts.length ? 'All claimed' : 'Snap a photo, add a file or forward a booking email')}
      ${row('#/claims', 'Claims', count(claimsN), claimsN ? `One claim per trip · ${money(pending)} awaiting reimbursement` : 'Add receipts to a trip and its claim appears here')}
      ${row('#/cpd', 'CPD ' + esc(p.cpdYear), `${count(tot, String(tot))}<small>of ${esc(p.cpdTarget)} h</small>`, left ? `${esc(left)} hours to go${p.cpdBody ? ' · ' + esc(p.cpdBody) : ''}` : 'Target reached', dialSvg(pct, 'sm'))}
      ${row('#/certs', 'Certificates', count(crs.length), nextCert && nextCert.expires ? `${esc(nextCert.short)} ${nextCert.st === 'expired' ? 'expired' : 'due'} ${esc(fmtD(nextCert.expires))}${due ? ` · <span class="pill w">${due} to renew</span>` : ''}` : 'Add your APLS, ALS or other course certificate')}
    </div>
    <p class="note">Receipts and certificates stay on this device, and sync with your account when you sign in.</p>`;
  },
  trips() {
    const ts = S.trips.slice().sort((a, b) => ofTrip(a).start.localeCompare(ofTrip(b).start));
    return `<div class="page-head"><div><h1>Trips</h1><p>Plan travel, log bookings and mark conferences attended to log your CPD hours.</p></div><a class="btn primary" href="#/discover">${icon('plus')} Add a conference</a></div>` +
      (ts.length ? ts.map(t => { const c = ofTrip(t), L = links(c, t.from || undefined), spent = S.receipts.filter(r => r.tripId === t.id).reduce((a, r) => a + homeAmt(r), 0), booked = (t.bookings || []).reduce((a, b) => a + Number(b.amount || 0), 0);
        const d = HC.daysBetween(today(), c.start), when = t.status === 'attended' ? '' : d > 0 ? `in ${plural(d, 'day')}` : c.end >= today() ? 'on now' : '';
        return `<article class="panel ticket"><div class="ticket-top"><div class="ticket-plate">${plate(c, 'tall')}</div><div class="ticket-main"><p class="card-when">${esc(range(c))}${when ? ' · ' + when : ''}</p><h2>${esc(c.name)}</h2><p class="card-where">${esc(c.city)}, ${esc(c.country)}</p>
          <div class="card-meta"><span class="pill ${t.status === 'attended' ? 'g' : 'w'}">${t.status === 'attended' ? 'Attended' : 'Planned'}</span><span class="tag">${esc(cpdLabel(c))}</span></div>
          <dl class="ledger"><div><dt>Booked</dt><dd>${money(booked)}</dd></div><div><dt>Receipts</dt><dd>${money(spent)}</dd></div></dl>
          <div class="row ticket-acts"><button class="btn sm" data-act="open" data-id="${esc(c.id)}">Details</button>${t.status === 'planned' ? `<button class="btn sm primary" data-act="attend" data-id="${esc(t.id)}">Mark attended</button>` : ''}<button class="btn sm danger" data-act="rmtrip" data-id="${esc(t.id)}">Remove</button></div></div></div>
          ${tripHospBox(t)}
          ${NET.online && c.kind !== 'course' && c.end < today() && !reviewedYear(skey(c), +c.start.slice(0, 4)) ? `<div class="rv-prompt"><span><b>How was it?</b> Review it in a minute. It helps colleagues choose.</span><button class="btn sm primary" data-act="review" data-id="${esc(c.id)}" data-year="${esc(c.start.slice(0, 4))}">Review ${esc(c.start.slice(0, 4))}</button></div>` : ''}
          <div class="row travel"><label class="from-field">Flying from <input type="text" data-from="${esc(t.id)}" value="${esc(t.from || S.profile.homeAirport || S.profile.city || '')}" maxlength="40" placeholder="City or airport" aria-label="Flying from (city or airport code) for ${esc(c.name)}"></label><a class="btn sm" target="_blank" rel="noopener noreferrer" data-flights="${esc(t.id)}" href="${esc(L.flights)}">${icon('plane')} Search flights ${icon('ext')}</a><a class="btn sm" target="_blank" rel="noopener noreferrer" href="${esc(L.hotels)}">${icon('bed')} Search hotels ${icon('ext')}</a><button class="btn sm ghost" data-act="addbook" data-id="${esc(t.id)}">${icon('plus')} Log a booking</button>${snapBtn(t.id)}<button class="btn sm ghost" data-act="addreceipt" data-id="${esc(t.id)}">${icon('receipt')} Add receipt</button></div>
          ${(t.bookings || []).length ? `<div class="list" style="margin-top:12px">${t.bookings.map(b => `<div class="li"><div class="grow"><div class="t">${esc(b.type)} · ${esc(b.vendor)}</div><div class="s">Ref ${esc(b.ref || '—')} · ${esc(b.date ? fmtD(b.date) : '')}</div></div><div class="amt">${money(b.amount)}</div><button class="icon-btn" data-act="rmbook" data-id="${esc(t.id)}" data-b="${esc(b.id)}" aria-label="Remove booking">${icon('x')}</button></div>`).join('')}</div>` : ''}${checklistHtml(t)}</article>`; }).join('')
        : `<div class="empty"><h2>No trips yet</h2><p>Save a conference and choose “Plan trip” to start. Hoggy prefills flight and hotel searches for the exact dates.</p><p style="margin-top:16px"><a class="btn primary" href="#/discover">Browse conferences</a></p></div>`) +
      `<p class="note">Hoggy opens prefilled search pages with Google Flights and Booking.com. You complete the purchase with the provider, then log the booking and forward the receipt here.</p>`;
  },
  receipts() {
    const rs = S.receipts.slice().sort((a, b) => (b.created || 0) - (a.created || 0)), addr = NET.user ? NET.user.inbox : '';
    return `<div class="page-head"><div><h1>Receipts</h1><p>Your receipts in one place, checked for a file, amount, date and trip, and against the caps you enter in Settings.</p></div><div class="row head-acts">${snapBtn('', true)}<button class="btn" data-act="addreceipt">${icon('plus')} Add receipt</button></div></div>${walletNav('receipts')}
    <div class="cols"><div>
      <div class="drop" id="drop"><p style="color:var(--text);font-weight:700;font-size:17px">Drop receipts here</p><p style="margin-top:4px">PDF, JPG or PNG — or paste a forwarded email in the add dialog.</p><p style="margin-top:14px"><button class="btn" data-act="addreceipt">Choose files</button></p></div>
      <div class="panel"><h2>${rs.length} receipt${rs.length === 1 ? '' : 's'}</h2>${rs.length ? `<div class="list">${rs.map(r => { const iss = receiptIssues(r), bad = iss.filter(i => i.lvl === 'bad').length, trip = S.trips.find(t => t.id === r.tripId);
        const tf = taxHtml(r, 2);
        return `<div class="li rc"><div class="thumb" data-file="${esc(r.fileKey || '')}">${icon('file')}</div><div class="grow"><div class="t">${esc(r.vendor || 'Unnamed')}</div><div class="s">${esc(r.category)} · ${esc(r.date ? fmtD(r.date) : 'no date')}${trip ? ' · ' + esc(ofTrip(trip).name) : ''}</div>${iss.slice(0, 2).map(i => `<div class="check ${i.lvl}">${i.lvl === 'bad' ? '✕' : '!'} ${esc(i.t)}</div>`).join('')}</div><div class="rc-amt" style="text-align:right"><div class="amt">${money(r.amount, r.currency)}</div><span class="status ${esc(r.status)}">${esc(r.status === 'captured' ? (bad ? 'Needs info' : 'Ready') : r.status)}</span></div>${r.fileKey ? `<button class="icon-btn" data-act="openfile" data-id="${esc(r.id)}" aria-label="Download receipt file" title="Download receipt file">${icon('file')}</button>` : ''}<button class="icon-btn" data-act="editreceipt" data-id="${esc(r.id)}" aria-label="Edit receipt">${icon('gear')}</button>${tf ? `<div class="li-flags">${tf}</div>` : ''}</div>`; }).join('')}</div>` : `<div class="empty"><h2>No receipts yet</h2><p>Snap a photo, choose a file or forward a booking email to get started.</p><p style="margin-top:16px"><button class="btn primary" data-act="addreceipt">Add a receipt</button></p></div>`}</div></div>
    <div><div class="panel"><h2>Your forwarding address</h2>${addr ? `<div class="copybox"><span style="flex:1">${esc(addr)}</span><button class="icon-btn" data-act="copy" data-v="${esc(addr)}" aria-label="Copy address">${icon('copy')}</button></div><p class="note">Auto-forward travel and booking emails here. While Hoggy is open it checks for new ones every minute (or tap Check inbox now). It reads the vendor, amount and date where it can and suggests a trip when only one fits; you check each one.</p><p style="margin-top:10px"><button class="btn sm" data-act="checkinbox">Check inbox now</button></p>` : `<p style="color:var(--muted)">${NET.online ? 'Sign in to get your personal forwarding address.' : (NET.trouble ? 'Hoggy can\u2019t connect right now, so your forwarding address isn\u2019t available. Try again in a minute; you can still add receipts as files.' : 'Your forwarding address needs an account. You can still add receipts as files.')}</p>${NET.online ? '<p style="margin-top:10px"><button class="btn sm primary" data-act="signin">Sign in</button></p>' : ''}`}</div>
      <div class="panel"><h2>What Hoggy checks before you claim</h2>${['Every receipt must have a file, amount, date and trip','Amounts are checked against the caps you enter in Settings, and dates against the conference window','Duplicates and foreign currency are flagged','Export and email unlock once every receipt has its file, amount, date and trip, and nothing is over a limit without a justification'].map(t => `<div class="check">• ${esc(t)}</div>`).join('')}</div></div></div>`;
  },
  claims() {
    const ts = S.trips.filter(t => S.receipts.some(r => r.tripId === t.id));
    const orphan = S.receipts.filter(r => !r.tripId);
    return `<div class="page-head"><div><h1>Claims</h1><p>One claim per trip. Fix what's flagged, export the pack, then track it to reimbursement.</p></div></div>${walletNav('claims')}` +
      (orphan.length ? `<div class="panel"><div class="check warn">! ${orphan.length} receipt${orphan.length > 1 ? 's are' : ' is'} not linked to a trip and can't be claimed. <a href="#/receipts" style="text-decoration:underline">Fix in Receipts</a></div></div>` : '') +
      (ts.length ? ts.map(t => { const c = ofTrip(t), rs = S.receipts.filter(r => r.tripId === t.id), tot = rs.reduce((a, r) => a + claimAmt(r), 0), rd = rs.filter(ready).length, pct = Math.round(rd / rs.length * 100), allReady0 = rd === rs.length, pol = policyFor(t, rs), allReady = allReady0 && !pol.some(i => i.lvl === 'bad'), claim = S.claims[t.id] || {}, hc = inHosp() ? hClaimOf(t) : null, st = hc ? (hc.status === 'paid' ? 'paid' : 'claimed') : rs.every(r => r.status === 'paid') ? 'paid' : rs.some(r => r.status === 'claimed' || r.status === 'paid') ? 'claimed' : 'draft';
        const cats = CATS.map(k => [k, rs.filter(r => r.category === k).reduce((a, r) => a + claimAmt(r), 0)]).filter(x => x[1]);
        return `<article class="panel claim"><div class="claim-top"><div class="thumb plate-thumb">${plate(c, 'mini')}</div><div class="grow"><h2>${esc(c.name)}</h2><p class="card-where">${esc(c.city)} · ${esc(range(c))}</p></div><div class="claim-tot"><b class="fig sm">${money(tot)}</b><span class="status ${st === 'draft' ? 'captured' : st}">${st === 'draft' ? 'Draft' : st === 'claimed' ? 'Submitted' : 'Reimbursed'}</span></div></div>
          <div class="row ready-row"><span>Claim readiness</span><span class="pill ${allReady ? 'g' : 'w'}">${rd}/${rs.length} receipts ready</span></div><div class="bar"><i class="${allReady ? '' : 'warn'}" style="width:${pct}%"></i></div>
          ${rs.filter(r => !ready(r)).map(r => `<div class="check bad">✕ ${esc(r.vendor || 'Receipt')}: ${esc(receiptIssues(r).filter(i => i.lvl === 'bad').map(i => i.t).join(', '))} <a href="#/receipts" data-act="editreceipt" data-id="${esc(r.id)}" style="text-decoration:underline;margin-left:6px">Fix</a></div>`).join('')}
          ${pol.map(i => `<div class="check ${i.lvl}">${i.lvl === 'bad' ? '✕' : '!'} ${esc(i.t)}</div>`).join('')}
          <dl class="ledger cats">${cats.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${money(v)}</dd></div>`).join('')}</dl>${currencyHtml(rs)}
          ${checklistHtml(t)}${claimWarn(t, rs)}
          <div class="row claim-acts"><button class="btn sm" data-act="exportcsv" data-id="${esc(t.id)}" ${allReady ? '' : 'disabled'}>Export CSV</button><button class="btn sm" data-act="printpack" data-id="${esc(t.id)}" ${allReady ? '' : 'disabled'}>Print claim pack</button><button class="btn sm primary" data-act="emailpack" data-id="${esc(t.id)}" ${allReady ? '' : 'disabled'}${claimsTo() ? ` title="Draft to ${esc(claimsTo())}"` : ''}>${inHosp() && !EMP().adminEmail && HOSP.org.claimsEmail ? 'Email to ' + esc(HOSP.org.name) + ' claims' : 'Email to claims admin'}</button><button class="btn sm" data-act="mailtopack" data-id="${esc(t.id)}" ${allReady ? '' : 'disabled'} title="For webmail: downloads the schedule and opens a prefilled email; you attach the files">Webmail instead</button>
            ${hc && hc.status === 'paid' ? '' : st === 'draft' || rs.some(r => r.status === 'captured') ? `<button class="btn sm primary" data-act="submitclaim" data-id="${esc(t.id)}" ${allReady ? '' : 'disabled'}>${hc ? 'Update submitted claim' : 'Mark submitted'}</button>` : ''}${st === 'claimed' && !hc ? `<button class="btn sm primary" data-act="paidclaim" data-id="${esc(t.id)}">Mark reimbursed</button>` : ''}</div>
          ${hc ? `<p class="note" data-testid="claim-hosp">${hc.status === 'paid' ? `<b>Paid</b> by ${esc(HOSP.org.name)} on ${esc(fmtD(dayOf(hc.paid)))} (${hmoney(hc.totalCents)}).` : `With ${esc(HOSP.org.name)} finance since ${esc(fmtD(dayOf(hc.submitted)))} (${hmoney(hc.totalCents)}). Finance marks it paid; you see it here.`}</p>` : claim.submitted ? `<p class="note">Submitted ${esc(fmtD(claim.submitted))}${claim.paid ? ' · reimbursed ' + esc(fmtD(claim.paid)) : ''}</p>` : ''}</article>`; }).join('')
        : `<div class="empty"><h2>No claims yet</h2><p>Add receipts to a trip and they'll appear here with a readiness check.</p><p style="margin-top:16px"><a class="btn primary" href="#/receipts">Add a receipt</a> <a class="btn ghost" href="#/trips">See your trips</a></p></div>`);
  },
  cpd() {
    const p = S.profile, tot = cpdTotal(), pct = Math.min(100, Math.round(tot / (p.cpdTarget || 1) * 100)), es = S.cpd.slice().sort((a, b) => b.date.localeCompare(a.date)), left = Math.max(0, p.cpdTarget - tot);
    const fut = upcoming().filter(c => c.specialty === p.specialty || true).sort((a, b) => b.cpdHours - a.cpdHours).slice(0, 4);
    return `<div class="page-head"><div><h1>CPD tracker</h1><p>When you mark a trip attended, enter the hours on your certificate and they are logged here. Add anything else by hand.</p></div><div class="row"><button class="btn" data-act="exportcpd">Export log</button><button class="btn primary" data-act="addcpd">${icon('plus')} Add entry</button></div></div>${walletNav('cpd')}
    <div class="cols"><div class="panel"><div class="cpd-top">${dialSvg(pct, 'lg')}<div><b class="fig xl">${count(tot, String(tot))}<small>of ${esc(p.cpdTarget)} hrs</small></b><h2>${esc(p.cpdYear)} target · ${esc(p.cpdBody || 'your college')}</h2><p class="muted">${left ? `${left} hours to go.` : 'Target reached.'}</p><p class="note">Change the target and body in Settings. Check your college's rules for how conference hours are weighted.</p></div></div>
      <h2 class="sub-h">Log</h2>${es.length ? `<table class="log"><thead><tr><th>Date</th><th>Activity</th><th>Source</th><th style="text-align:right">Hours</th><th></th></tr></thead><tbody>${es.map(e => `<tr><td>${esc(fmtD(e.date))}</td><td>${esc(e.title)}</td><td><span class="tag">${esc(e.source)}</span></td><td style="text-align:right;font-weight:700">${esc(e.hours)}</td><td><button class="icon-btn" data-act="rmcpd" data-id="${esc(e.id)}" aria-label="Delete entry">${icon('x')}</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty"><h2>No hours logged</h2><p>Mark a trip attended or add an entry.</p><p style="margin-top:16px"><button class="btn primary" data-act="addcpd">Add an entry</button></p></div>'}</div>
    <div><div class="panel"><h2>Close the gap</h2><p style="color:var(--muted);margin-bottom:10px">Upcoming conferences with published credits (otherwise soonest in your field):</p><div class="list">${fut.map(c => `<div class="li" style="cursor:pointer" tabindex="0" role="button" data-act="open" data-id="${esc(c.id)}"><div class="thumb plate-thumb">${plate(c, 'mini')}</div><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${esc(c.city)} · ${esc(range(c))}</div></div><span class="tag">${c.cpdVerified && c.cpdHours ? esc(c.cpdHours) + 'h' : 'CPD?'}</span></div>`).join('')}</div></div></div></div>${nzPanel()}`;
  },
  courses() {
    const { parts, q } = hashParts();
    if (parts[1]) {
      if (CUI.course !== parts[1] || q.toString()) {
        const c0 = q.get('country') != null ? q.get('country') : listPlace();
        Object.assign(CUI, { course: parts[1], country: c0 && !c0.startsWith('w:') ? c0 : '', state: q.get('state') || '', city: q.get('city') || '', month: q.get('month') || '', lang: q.get('lang') || CUI.listLang || 'en', limit: 25 });
        /* a country with no session of this course: show all countries rather than an empty list */
        if (CUI.country && COURSES.loaded && !HC.countFor(COURSES.summary[parts[1]], CUI.country, 'any').n) CUI.country = '';
        /* the same for a language carried over from the list (e.g. "Taught in German" on an RCUK course): English, then any */
        if (COURSES.loaded && !HC.countFor(COURSES.summary[parts[1]], CUI.country, CUI.lang).n) CUI.lang = HC.countFor(COURSES.summary[parts[1]], CUI.country, 'en').n ? 'en' : 'any';
      }
      return courseView(parts[1]);
    }
    if (q.get('country') != null) CUI.place = q.get('country');
    if (q.get('lang')) CUI.listLang = q.get('lang');
    const head = `<div class="page-head"><div><h1>Courses</h1><p>Life support, emergency, procedural and GP skills courses, with dates read from each provider's own page. Plan the trip like a conference, and add your certificate to see when it is due.</p></div><a class="btn" href="#/certs">${icon('cert')} My certificates${S.certs.length ? ' (' + S.certs.length + ')' : ''}</a></div>${segToggle('courses')}`;
    if (!COURSES.cat) return head + '<div class="loading" aria-busy="true">Loading courses…</div>';
    return head + remindCard() + courseListView();
  },
  certs() {
    const rows = certRows();
    return `<div class="page-head"><div><h1>My certificates</h1><p>Add your APLS, ALS or other course certificates. Hoggy works out the expiry from the validity the course owner publishes (APLS five years, ALS four years) and shows a reminder on your Home page from six months before.</p></div><div class="row head-acts"><a class="btn" href="#/courses">${icon('course')} Find a course</a><button class="btn primary" data-act="addcert">${icon('plus')} Add certificate</button></div></div>${walletNav('certs')}`
      + (rows.length ? rows.map(certItem).join('') : `<div class="empty"><h2>No certificates yet</h2><p>Add one and Hoggy shows when it is due for renewal, with the next sessions near you.</p><p style="margin-top:16px"><button class="btn primary" data-act="addcert">Add certificate</button></p></div>`)
      + `<p class="note">Reminders show inside Hoggy only, on Home and here. Email reminders are not available yet. "Near you" uses your state or region in Settings (or your home city).</p>`;
  },
  settings() {
    const p = S.profile, specs = [...new Set(CONFS.map(c => c.specialty))].sort();
    return `<div class="page-head"><div><h1>You</h1><p>Your profile drives recommendations, CPD targets and claim checks. Employer details such as your employee ID and approver stay on this device only. Trips, receipts and CPD sync with your account when you sign in.</p></div></div>
    <div class="cols"><div class="panel"><h2>Profile</h2><form id="pf"><div class="two"><div class="field"><label for="pn">Name</label><input id="pn" type="text" name="name" value="${esc(p.name)}"></div><div class="field"><label for="ps">Specialty</label><select id="ps" name="specialty">${specs.map(s => `<option ${s === p.specialty ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div></div>
      <div class="two"><div class="field"><label for="pc">Home country</label><input id="pc" type="text" name="country" value="${esc(p.country)}"></div><div class="field"><label for="pci">Home city / airport code</label><input id="pci" type="text" name="homeAirport" value="${esc(p.homeAirport)}"></div></div>
      <div class="two"><div class="field"><label for="pcu">Currency</label><select id="pcu" name="currency">${['AUD', 'NZD', 'USD', 'GBP', 'EUR', 'CAD', 'SGD'].map(s => `<option ${s === p.currency ? 'selected' : ''}>${s}</option>`).join('')}</select></div><div class="field"><label for="pth">Theme</label><select id="pth" name="theme">${['auto', 'dark', 'light'].map(s => `<option ${s === p.theme ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
      <div class="two"><div class="field"><label for="pct">Annual CPD target (hours)</label><input id="pct" type="number" min="1" max="500" name="cpdTarget" value="${esc(p.cpdTarget)}"></div><div class="field"><label for="pcb">CPD body</label><input id="pcb" type="text" name="cpdBody" value="${esc(p.cpdBody)}"></div></div>
      <div class="two"><div class="field"><label for="prg">State or region (for courses near you)</label><select id="prg" name="region"><option value="">Work it out from my home city${HC.regionOf({ ...p, region: '' }) ? ' (' + esc(HC.regionOf({ ...p, region: '' })) + ')' : ''}</option>${[...HC.STATES_AU, 'Auckland', 'Wellington', 'Nelson', 'Canterbury', 'Otago', 'Waikato'].map(r => `<option ${r === p.region ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></div>
      <div class="field"><label for="pcy">CPD year</label><input id="pcy" type="number" name="cpdYear" value="${esc(p.cpdYear)}"></div></div>
      <h2 class="sub-h">Your employer</h2><p class="note sub-note">${inHosp() && HOSP.org.claimsEmail ? `Leave the claims admin's email blank to use ${esc(HOSP.org.name)}'s (${esc(HOSP.org.claimsEmail)}). ` : ''}Used to address claim emails and check receipts. Type figures from your own policy; Hoggy assumes none. Stored on this device only; not sent to Hoggy's server.</p><div class="two">${[['name','Employer / health service','text'],['adminEmail',"Claims admin's email",'email'],['approverName',"Approver's name (head of department)",'text'],['approverEmail',"Approver's email",'email'],['employeeId','Employee ID','text'],['costCentre','Cost centre','text'],['claimDays','Claim within (days after the trip)','number'],['hotelPerNight','Hotel limit per night (' + S.profile.currency + ')','number'],['mealsPerDay','Meals limit per day (' + S.profile.currency + ')','number'],['clause','Policy name and clause (printed beside any limit)','text']].map(([k, l, ty]) => `<div class="field"><label for="emp-${k}">${l}</label><input id="emp-${k}" type="${ty}" data-emp="${k}" ${ty === 'number' ? 'min="0" step="any"' : 'maxlength="120"'} value="${esc((p.employer || {})[k] || '')}"${k === 'adminEmail' && inHosp() && HOSP.org.claimsEmail ? ` placeholder="${esc(HOSP.org.claimsEmail)} (your hospital)"` : ''}></div>`).join('')}</div><h2 class="sub-h">Expense caps per receipt (optional)</h2><p class="note sub-note">Leave blank unless your employer sets a limit. Enter your own policy figures; Hoggy does not assume any.</p><div class="two">${CATS.map(k => `<div class="field"><label for="cap-${esc(k)}">${esc(k)}</label><input id="cap-${esc(k)}" type="number" min="0" data-cap="${esc(k)}" value="${esc(p.caps[k] || '')}"></div>`).join('')}</div>
      <button class="btn primary" type="submit">Save</button></form></div>
    <div>${hospPanel()}${NET.trouble ? `<div class="panel acct-panel"><h2>Account</h2><p style="color:var(--muted)">${TROUBLE} Your trips and receipts on this device are safe.</p><p style="margin-top:12px"><button class="btn" data-act="retry">Try again</button></p></div>` : ''}${NET.online ? `<div class="panel acct-panel"><h2>Account</h2>${NET.user ? `<p style="color:var(--muted);margin-bottom:12px">Signed in as ${esc(NET.user.email || NET.user.name)}. Trips, receipts and CPD sync to your account.</p><button class="btn" data-act="signout">Sign out</button>` : '<p style="color:var(--muted);margin-bottom:12px">Sign in to sync your trips, receipts and CPD across devices and get your receipt forwarding address.</p><button class="btn primary" data-act="signin">Sign in or create an account</button>'}</div>` : ''}<div class="panel"><h2>Your data</h2><p style="color:var(--muted);margin-bottom:12px">Stored on this device, and synced with your account if you sign in. Export a backup of your trips, receipts metadata and CPD log.</p><div class="row"><button class="btn" data-act="backup">Download backup</button><button class="btn danger" data-act="wipe">Erase this device</button>${NET.user ? '<button class="btn danger" data-act="delaccount">Delete account</button>' : ''}</div></div></div></div>`;
  }
};

/* ---------- courses: catalogue, course pages, sessions, certificates ---------- */
/* x10 (18 Nov 2026): ~3,300 sessions in 45 countries. /api/courses gives the catalogue and per-course counts; a course's sessions
   load when its page (or a certificate's "near you") needs them. Offline or on a static host the bundled files load whole. */
const courseOf = id => COURSES.cat ? HC.courseById(COURSES.cat, id) : null;
const sessionById = id => COURSES.sessions.find(s => s.id === id) || null;
const haveSessions = id => COURSES.full || COURSES.have.has(id);
const cgrad = c => { const h = { apls: 32, als1: 196, als2: 218, emst: 8, pals: 290 }[c.id] ?? (c.countries && c.countries.includes('NZ') ? 168 : hash(c.id) % 360); return `linear-gradient(135deg,hsl(${h} 62% 40%),hsl(${(h + 36) % 360} 70% 26%))`; };
/* list filters (place: '' all, 'AU', or 'w:Europe'; lang: 'en' English or not stated, 'any', or a language) and the course page filters */
const CUI = { course: '', state: '', city: '', month: '', country: '', lang: 'en', limit: 25, place: null, listLang: 'en', q: '', lim: 24 };
const homePlace = () => HC.countryCodeOf(S.profile.country);
const listPlace = () => CUI.place == null ? homePlace() : CUI.place;
const monthLabel = ym => new Date(ym + '-01T00:00:00').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
const extA = (url, label, cls = 'btn sm') => `<a class="${cls}" data-act="ext" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(url))}">${label} ${icon('ext')}</a>`;
const srcLink = (url, label = 'source') => url && safeUrl(url) !== '#' ? `<a class="u" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(url))}">${esc(label)}</a>` : '';
/* certificates with their computed expiry and status (expiry is stored when the certificate is saved) */
const certRows = () => (S.certs || []).map(c => ({ ...c, st: HC.certStatus(c.expires, today()) })).sort((a, b) => String(a.expires || '9').localeCompare(String(b.expires || '9')));
const STATUS_PILL = { valid: 'g', due6: 'w', due3: 'w', expired: 'b', unknown: '' };
const statusPill = st => `<span class="pill ${STATUS_PILL[st]}">${esc(HC.STATUS_LABEL[st])}</span>`;
function whenText(iso) { const d = HC.daysBetween(today(), iso); if (d === 0) return 'today'; const a = Math.abs(d), t = a < 45 ? plural(a, 'day') : plural(Math.round(a / 30.44), 'month'); return d > 0 ? 'in ' + t : t + ' ago'; }
const myRegion = () => HC.regionOf(S.profile);
const findHref = id => '#/courses/' + encodeURIComponent(id) + (myRegion() ? '?state=' + encodeURIComponent(myRegion()) : '');
const segToggle = cur => `<nav class="seg" aria-label="Show"><a href="#/discover" ${cur === 'discover' ? 'aria-current="page"' : ''}>Conferences</a><a href="#/courses" ${cur === 'courses' ? 'aria-current="page"' : ''}>Courses</a></nav>`;
const walletNav = cur => `<nav class="seg subnav" aria-label="Wallet">${[['wallet', 'Overview'], ['receipts', 'Receipts'], ['claims', 'Claims'], ['cpd', 'CPD'], ['certs', 'Certificates']].map(([k, l]) => `<a href="#/${k}" ${k === cur ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
const commercialPill = x => x && x.providerType === 'commercial' ? '<span class="tag" title="A commercial education company, not a college or society">Commercial provider</span>' : '';
/* "Box Hill, VIC" in Australia and New Zealand; "Leiden, Netherlands" elsewhere */
const placeOf = s => ['AU', 'NZ'].includes(s.country) ? `${s.city}, ${s.region}` : `${s.city}, ${HC.countryName(s.country)}`;
/* place = where the list is looking; '' and 'any' mean everywhere / any language */
function courseCard(c, place = listPlace(), lang = CUI.listLang) {
  const sum = COURSES.summary[c.id], k = HC.countFor(sum, place, lang), all = HC.countFor(sum, '', 'any'), v = HC.validityOf(c), eq = HC.equivalentLabel(COURSES.cat, c), body = HC.bodyLabel(c.id);
  const where = place ? HC.placeLabel(place) : '';
  const line = k.n ? `${plural(k.n, 'upcoming session')}${where ? ' in ' + esc(where) : ''}` : all.n ? `${plural(all.n, 'upcoming session')} elsewhere` : 'Dates not available yet — check provider';
  return `<article class="card course-card" data-act="opencourse" data-id="${esc(c.id)}">
    <div class="art">${coursePlate(c, 'tall')}</div>
    <div class="card-body"><p class="card-when">${k.n ? 'Next ' + esc(fmtD(k.next)) + (k.city ? ' · ' + esc(k.city) : '') : all.n ? 'Next ' + esc(fmtD(all.next)) + (all.city ? ' · ' + esc(all.city) : '') : 'Check provider'}</p><h3><a class="card-link" href="#/courses/${esc(c.id)}">${esc(c.name)}</a></h3>
    <p class="card-where">${body ? esc(body) + ' · ' : eq ? esc(eq) + ' · ' : ''}${line}</p>
    <div class="card-meta"><span class="tag">Course</span>${v ? `<span class="tag">Certificate ${esc(v.years)} years</span>` : ''}${commercialPill(c)}</div></div></article>`;
}
/* reminder card for Home (and the Courses page): certificates due within 6 months or expired.
   TODO(D3): outbound email reminders (6 and 3 months before expiry, and on expiry) need an email provider and sender domain
   (decision D3 in docs/pm/backlog.md, item B47). Nothing is sent today; the reminder is in-app only and the copy says so. */
function remindCard() {
  const due = certRows().filter(x => HC.needsAttention(x.st)); if (!due.length) return '';
  return `<section class="panel remind" aria-labelledby="remH"><div class="row panel-head"><h2 id="remH">${icon('cert')} Certificate ${due.length > 1 ? 'renewals' : 'renewal'} coming up</h2><a class="btn sm ghost" href="#/certs">My certificates</a></div>
    <div class="list">${due.map(x => `<div class="li"><div class="grow"><div class="t">${esc(x.short || x.courseId)} certificate</div><div class="s">${x.st === 'expired' ? 'Expired' : 'Expires'} ${esc(fmtD(x.expires))} · ${esc(whenText(x.expires))}</div></div>${statusPill(x.st)}<a class="btn sm primary" href="${esc(findHref(x.courseId))}">Find a session</a></div>`).join('')}</div></section>`;
}
/* prices stay in the currency the provider lists (no conversion) */
function sessionMeta(s) {
  const price = s.priceFrom ? `From ${money(s.priceFrom, s.currency)}` : 'Price: check provider';
  const seats = s.seatsStatus === 'full' ? 'Full' : s.seatsStatus === 'closed' ? 'Booking closed' : s.seatsStatus === 'waitlist' ? 'Waitlist' : s.seatsStatus === 'open' ? (s.placesRemaining != null ? plural(s.placesRemaining, 'place') + ' left' : 'Places open') : '';
  return { price, seats };
}
const bookLabel = s => HC.isArcList(s) ? 'Booking via course centre (ARC list)' : 'Book with provider';
function sessionRow(s) {
  const d = new Date(s.start + 'T00:00:00'), m = sessionMeta(s), c = courseOf(s.courseId), planned = S.trips.some(t => t.confId === 'crs-' + s.id), lang = HC.languageLabel(s);
  const pills = [HC.VARIANT_LABEL[s.variant] ? `<span class="tag">${esc(HC.VARIANT_LABEL[s.variant])}</span>` : '', lang ? `<span class="pill w">${esc(lang)}</span>` : '', commercialPill(s)].join('');
  return `<div class="li sess" data-act="session" data-id="${esc(s.id)}">
    <div class="sdate" aria-hidden="true"><b>${d.getDate()}</b><span>${esc(d.toLocaleDateString('en-AU', { month: 'short' }))} ${String(d.getFullYear()).slice(2)}</span></div>
    <div class="grow"><div class="t"><button type="button" class="linkbtn sess-open" data-act="session" data-id="${esc(s.id)}" aria-label="${esc(HC.shortName(c))} ${esc(range(s))}, ${esc(s.city)}: details">${esc(range(s))}</button> · ${esc(HC.lengthLabel(s))}</div><div class="s">${esc(placeOf(s))}${s.venue ? ' · ' + esc(s.venue) : ''}</div><div class="s">${esc(s.provider)} · ${esc(m.price)}${m.seats ? ' · ' + esc(m.seats) : ''}</div>${pills ? `<div class="card-meta">${pills}</div>` : ''}</div>
    <div class="sess-acts">${extA(s.bookingUrl, esc(bookLabel(s)))}<button class="btn sm primary" data-act="plancourse" data-id="${esc(s.id)}" ${planned ? 'disabled' : ''}>${planned ? 'In your trips' : 'Plan trip'}</button></div></div>`;
}
const sessFilter = () => ({ courseId: CUI.course, country: CUI.country, lang: CUI.lang, state: CUI.state, city: CUI.city, month: CUI.month });
function sessionList() {
  const L = HC.filterSessions(COURSES.sessions, sessFilter(), today());
  const cnt = $('#sessCount'), box = $('#sessList'); if (!box) return;
  cnt.textContent = plural(L.length, 'session');
  box.innerHTML = L.length ? L.slice(0, CUI.limit).map(sessionRow).join('') + (L.length > CUI.limit ? `<div class="more-row"><button class="btn" data-act="moresess">Show more (${L.length - CUI.limit} left)</button></div>` : '') : `<div class="empty"><h2>No sessions match</h2><p>${CUI.country || CUI.lang !== 'any' ? 'Try all countries or any language, or ' : 'Try '}another state, city or month.</p></div>`;
}
function courseFilters() {
  const o = HC.filterOptions(COURSES.sessions, sessFilter(), today());
  const langs = o.langs.filter(l => l !== 'English');
  const sel = (id, label, opts) => `<label class="sel"><span class="sel-l">${label}</span><select id="${id}" aria-label="${label}">${opts}</select></label>`;
  return `<div class="sess-filters"><div class="filter-top"><span class="count" id="sessCount" role="status"></span><button type="button" class="btn filt-btn" data-act="filters" aria-expanded="${FS.open}" aria-controls="fsheet">${icon('sliders')} Filters</button></div>
    <div class="fsheet" id="fsheet" role="group" aria-label="Filter sessions"><div class="fsheet-head"><span class="grab" aria-hidden="true"></span><h2>Filter sessions</h2><button type="button" class="icon-btn" data-act="filtersclose" aria-label="Close filters">${icon('x')}</button></div><div class="selects">
    ${sel('cCountry', 'Country', `<option value="">All countries</option>${o.countries.map(x => `<option value="${esc(x)}" ${x === CUI.country ? 'selected' : ''}>${esc(HC.countryName(x))}</option>`).join('')}`)}
    ${sel('cLang', 'Language', `<option value="en" ${CUI.lang === 'en' ? 'selected' : ''}>English (or not stated)</option><option value="any" ${CUI.lang === 'any' ? 'selected' : ''}>Any language</option>${langs.map(x => `<option value="${esc(x)}" ${x === CUI.lang ? 'selected' : ''}>Taught in ${esc(x)}</option>`).join('')}`)}
    ${o.states.length > 1 ? sel('cState', 'State or region', `<option value="">All states and regions</option>${o.states.map(x => `<option ${x === CUI.state ? 'selected' : ''}>${esc(x)}</option>`).join('')}`) : ''}
    ${sel('cCity', 'City', `<option value="">All cities</option>${o.cities.map(x => `<option ${x === CUI.city ? 'selected' : ''}>${esc(x)}</option>`).join('')}`)}
    ${sel('cMonth', 'Month', `<option value="">Any month</option>${o.months.map(x => `<option value="${esc(x)}" ${x === CUI.month ? 'selected' : ''}>${esc(monthLabel(x))}</option>`).join('')}`)}</div>
    <div class="fsheet-foot"><button type="button" class="btn primary" data-act="filtersclose">Show sessions</button></div></div><div class="scrim" data-act="filtersclose"></div></div>`;
}
function fact(k, v, note) { return `<div class="fact"><div class="k">${k}</div><div class="v">${v}</div>${note ? `<div class="note">${note}</div>` : ''}</div>`; }
const CHECK = 'Check provider';
function cpdFact(c) {
  if (c.cpdHours > 0 && c.cpdSource) return fact('CPD', esc(c.cpdHours) + ' hours', srcLink(c.cpdSource));
  const rows = (c.cpdByCollege || []).filter(x => x.sourceUrl && x.quote && (!x.appliesTo || String(x.appliesTo).includes(c.id)));
  if (rows.length) return fact('CPD (published by the course owner)', rows.map(x => `${esc(x.college)}${x.hours ? ' ' + esc(x.hours) + ' h' : x.college === 'RACGP' ? ': pre-approved' : ': recognised'}`).join(' · '), `Recognition differs by college; check yours. ${srcLink(rows[0].sourceUrl)}`);
  return fact('CPD', CHECK);
}
function feeFact(c) {
  if (c.feeRange && c.feeSource) return fact('Fees', esc(c.feeRange.text), `${c.feeNote ? esc(c.feeNote) + ' ' : ''}${srcLink(c.feeSource)}`);
  const ex = (c.feeExamples || []).filter(x => x.sourceUrl);
  return fact('Fees', CHECK, [c.feeNote ? esc(c.feeNote) : '', ...ex.map(x => `Example: ${esc(x.provider)} (${srcLink(x.sourceUrl)})`)].filter(Boolean).join(' '));
}
/* the same kind of certificate from other bodies, and only the recognition statements the catalogue quotes */
function familyPanel(fam, place, lang, cur) {
  const rows = fam.members.map(([id, label]) => ({ c: courseOf(id), label })).filter(x => x.c);
  if (rows.length < 2) return '';
  const rec = HC.recognitionOf(COURSES.cat, fam), where = place ? HC.placeLabel(place) : '';
  const row = ({ c, label }) => { const k = HC.countFor(COURSES.summary[c.id], place, lang), a = HC.countFor(COURSES.summary[c.id], '', 'any'), d = k.n ? new Date(k.next + 'T00:00:00') : null;
    return `<a class="li fam-row${c.id === cur ? ' cur' : ''}${k.n ? '' : ' none'}" href="#/courses/${esc(c.id)}${place ? '?country=' + encodeURIComponent(place) : ''}" ${c.id === cur ? 'aria-current="page"' : ''}>${d ? `<div class="sdate" aria-hidden="true"><b>${d.getDate()}</b><span>${esc(d.toLocaleDateString('en-AU', { month: 'short' }))} ${String(d.getFullYear()).slice(2)}</span></div>` : '<div class="sdate none" aria-hidden="true"><b>–</b></div>'}<div class="grow"><div class="t">${esc(fam.short)} — ${esc(label)}</div><div class="s">${k.n ? `${plural(k.n, 'session')}${place ? ' in ' + esc(where) : ''} · next ${esc(fmtD(k.next))}${k.city ? ', ' + esc(k.city) : ''}` : a.n ? `None${place ? ' in ' + esc(where) : ''} · ${plural(a.n, 'session')} elsewhere` : 'Dates not available yet'}</div></div>${CHEV}</a>`; };
  const here = rows.filter(x => HC.countFor(COURSES.summary[x.c.id], place, lang).n > 0 || x.c.id === cur), away = rows.filter(x => !here.includes(x));
  const main = place && here.length ? here : rows, more = place && here.length ? away : [];
  return `<section class="panel family" aria-label="${esc(fam.label)}"><h3>${esc(fam.label)}</h3><p class="note">Different bodies certify this course. Check which certificate your employer, college or registration body accepts.</p>
    <div class="list">${main.map(row).join('')}</div>
    ${more.length ? `<details class="overseas"><summary>Also overseas <span class="tag">${more.length}</span></summary><div class="list">${more.map(row).join('')}</div></details>` : ''}
    ${rec.map(r => `<p class="note quote">${esc(HC.bodyLabel(r.courseId).replace(/^[^—]*— /, ''))} says: “${esc(r.text)}” ${srcLink(r.sourceUrl, 'source')}</p>`).join('')}</section>`;
}
function courseView(id) {
  const c = courseOf(id);
  if (!COURSES.cat) return `<a class="back" href="#/courses">← All courses</a><div class="loading" aria-busy="true">Loading course dates…</div>`;
  if (!c) return `<a class="back" href="#/courses">← All courses</a><div class="empty"><h2>Course not found</h2><p><a class="u" href="#/courses">See all courses</a></p></div>`;
  const v = HC.validityOf(c), eq = HC.equivalentLabel(COURSES.cat, c), nz = (COURSES.cat.courses || []).find(x => x.nzEquivalentOf === c.id), ev = (c.audienceEvidence || {}), fv = (c.formatEvidence || {});
  const owner = (c.providers || [])[0] || {}, fam = HC.familyOf(c.id), body = HC.bodyLabel(c.id);
  const head = `<a class="back" href="#/courses">← All courses</a><div class="page-head course-head"><div class="course-plate">${coursePlate(c, 'square')}</div><div>${body ? `<span class="eyebrow">${esc(body)}</span>` : eq ? `<span class="eyebrow">${esc(eq)}</span>` : ''}<h1 class="ch1">${esc(c.name)}</h1><p>${esc(owner.name || '')}${nz ? ` · In New Zealand: <a class="u" href="#/courses/${esc(nz.id)}">${esc(nz.name)}</a>` : ''}</p>${c.providerType === 'commercial' ? '<div class="card-meta"><span class="tag">Commercial provider</span></div>' : ''}<p class="row"><a class="btn sm" href="#/certs">${icon('cert')} My certificates</a></p></div></div>`
    + (c.userNote ? `<p class="check warn">${esc(c.userNote)}</p>` : '');
  /* key facts first (they decide whether to book), then the sessions, then the longer description */
  const facts = `<div class="facts kfacts">${fact('Length', c.typicalLength ? esc(c.typicalLength) : CHECK)}${fact('Certificate validity', v ? esc(v.years) + ' years' : CHECK, v ? `As published by the course owner. ${srcLink(v.source)}` : 'Not confirmed in Hoggy yet.')}${feeFact(c)}${cpdFact(c)}</div>`;
  const about = `<section aria-labelledby="aboutH"><div class="section"><h2 id="aboutH">About this course</h2></div><div class="facts cfacts">${fact("Who it's for", c.audience ? esc(c.audience) : CHECK, srcLink(ev.sourceUrl))}${fact('Format', c.format ? esc(c.format) : CHECK, srcLink(fv.sourceUrl))}${fact('Renewal', c.recertification ? esc(c.recertification) : CHECK, srcLink((c.recertificationEvidence || {}).sourceUrl))}</div>
    <p class="note">${c.verified === true ? '' : 'Hoggy has not reviewed this course\'s facts yet (dates are read per session). '}Course pages: ${(c.providers || []).filter(p => p.url).map(p => srcLink(p.url, p.name)).join(' · ')}</p></section>` + (fam ? familyPanel(fam, CUI.country, CUI.lang, c.id) : '');
  const rep = `<p class="note report-line"><button type="button" class="linkbtn" data-act="report" data-kind="course" data-id="${esc(c.id)}">Report a problem with this listing</button> · <a class="u" href="/courses/${esc(c.id)}">Page link</a></p>`;
  if (!haveSessions(c.id)) return head + facts + '<div class="loading" aria-busy="true">Loading sessions…</div>' + about + rep;
  const ss = HC.filterSessions(COURSES.sessions, { courseId: c.id }, today());
  /* sessions carry their own evidence (provider page, quote, date read), so they show even before the course facts are reviewed */
  if (!ss.length) {
    return head + facts + `<div class="panel nodates"><h2>Dates not available yet — check provider</h2><p class="muted">Hoggy shows only dates it has read on the provider's own page, and it has none for this course yet.${c.renameNote ? ' The course owner may have changed its name; this is not confirmed.' : ''}</p><div class="row">${(c.providers || []).filter(p => p.url).map(p => extA(p.schedulePage || p.url, 'Check ' + esc(p.name.split(/[(:;]/)[0].trim()))).join('')}</div></div>` + about + rep;
  }
  const kinds = [...new Set(ss.map(s => s.sourceKind).filter(Boolean))].slice(0, 3);
  return head + facts + `<div class="section"><h2>Upcoming sessions</h2></div>${courseFilters()}<div class="list sess-list" id="sessList"></div>
    <p class="note">Dates come from ${c.id.startsWith('als') ? 'the Australian Resuscitation Council course list, ACRRM and course centres' : 'the provider\'s own page'}${kinds.length ? ' (' + esc(kinds.join('; ')) + ')' : ''}, last checked ${esc(fmtD(ss[0].lastVerified))}. “(inferred)” means the page gave only a start date and Hoggy took the length from the course page; check with the provider. Prices are in the currency the provider lists; Hoggy does not convert them. Sessions and seats change, so confirm when you book.</p>` + about + rep;
}
function sessionSheet(sid, fallback) {
  const s = sessionById(sid), c = courseOf(s ? s.courseId : fallback && fallback.courseId), e = s ? HC.sessionEvent(s, c) : fallback; if (!e) return;
  if (!CEV.has(e.id) || s) CEV.set(e.id, e);
  const trip = S.trips.find(t => t.confId === e.id), L = links(e), m = s ? sessionMeta(s) : null, name = c ? c.name : e.name, lang = s ? HC.languageLabel(s) : '';
  const opts = s && Array.isArray(s.durationOptions) ? `<div class="section"><h3>Lengths on offer</h3></div><div class="list">${s.durationOptions.map(o => `<div class="li"><div class="grow"><div class="t">${esc(o.days)} day${o.days === 1 ? '' : 's'} · ends ${esc(fmtD(o.end))}</div><div class="s">${o.priceFrom ? esc(money(o.priceFrom, o.currency)) : 'Price: check provider'}${o.seatsStatus === 'closed' ? ' · Booking closed' : ''}</div></div>${extA(o.bookingUrl || o.sourceUrl, 'Book')}</div>`).join('')}</div>` : '';
  const pe = s && s.providerEvidence ? `<p class="note">Price and places read on the provider's own booking page${s.providerEvidence.lastVerified ? ', checked ' + esc(fmtD(s.providerEvidence.lastVerified)) : ''} · ${srcLink(s.providerEvidence.sourceUrl, 'booking page')}</p>` : '';
  const where = s ? placeOf(s) : e.city + ', ' + (e.region || e.country);
  openOverlay(`<div class="sheet detail" role="dialog" aria-modal="true" aria-label="${esc(name)} session"><div class="sheet-wrap"><span class="grab" aria-hidden="true"></span><button class="icon-btn close" data-act="close" aria-label="Close">${icon('x')}</button><div class="art">${ART ? ART.dial(c ? c.id : e.id, dialLabel(e.short || name), { size: 'wide', sub: range(e) + ' · ' + where }) : ''}</div></div>
  <div class="body"><span class="eyebrow">Course session${c && HC.bodyLabel(c.id) ? ' · ' + esc(HC.bodyLabel(c.id)) : ''}</span><h2>${esc(name)}</h2><p class="lede">${esc(e.organiser)} · ${esc(where)}</p>
  ${s ? '' : '<p class="check warn">! This session is no longer on the provider list (it may have finished). The details below are what you planned.</p>'}${lang ? `<p class="check warn">${esc(lang)}, as listed by the provider.</p>` : ''}
  <div class="facts">${fact('When', esc(range(e)), esc(s ? HC.lengthLabel(s) : HC.lengthLabel(e)) + (e.endInferred ? ' · end date inferred from the course length' : ''))}${fact('Where', esc(where), e.venue ? esc(e.venue) : 'Venue: check provider')}
    ${fact('Price', m ? esc(m.price) : CHECK, s && s.priceFrom && s.currency && s.currency !== S.profile.currency ? `In ${esc(s.currency)}, as the provider lists it (not converted).${s.priceNote ? ' ' + esc(s.priceNote) : ''}` : s && s.priceNote ? esc(s.priceNote) : '')}${fact('Places', m && m.seats ? esc(m.seats) : 'Check provider')}${fact('Provider', esc(e.organiser) + (s && s.providerType === 'commercial' ? ' <span class="tag">Commercial provider</span>' : ''))}${fact('Type', esc(HC.VARIANT_LABEL[e.variant] || 'Full course'), e.cpdVerified ? esc(e.cpdHours) + ' CPD hours listed by the provider' : '')}</div>
  ${opts}${s && (s.accessNote || s.bookingNote || s.sessionNote) ? `<p class="note">${esc([s.accessNote, s.bookingNote, s.sessionNote].filter(Boolean).join(' · '))}</p>` : ''}
  <p class="note source"><span class="pill g">Dates confirmed</span> on ${s && HC.isArcList(s) ? 'the ARC course list' : 'the provider page'}${e.lastVerified ? ', checked ' + esc(fmtD(e.lastVerified)) : ''}${srcLink(e.sourceUrl) ? ' · ' + srcLink(e.sourceUrl, 'source page') : ''}</p>${pe}
  <div class="row travel"><a class="btn sm" target="_blank" rel="noopener noreferrer" href="${esc(L.flights)}">${icon('plane')} Flights ${icon('ext')}</a><a class="btn sm" target="_blank" rel="noopener noreferrer" href="${esc(L.hotels)}">${icon('bed')} Hotels ${icon('ext')}</a><button class="btn sm" data-act="ics" data-id="${esc(e.id)}">${icon('cal')} Calendar</button>${c ? `<a class="btn sm ghost" href="#/courses/${esc(c.id)}">About this course</a>` : ''}</div></div>
  ${s ? `<div class="actbar"><button class="btn primary lg" data-act="plancourse" data-id="${esc(s.id)}" ${trip ? 'disabled' : ''}>${trip ? 'In your trips' : 'Plan trip'}</button>${extA(s.bookingUrl, esc(bookLabel(s)), 'btn lg')}</div>` : ''}</div>`);
}
/* the Courses list: country or region (default: the profile's country), language (default English or not stated), search;
   certificate families grouped with the certifying body named; the rest as cards, most relevant first, paged */
function courseListView() {
  const place = listPlace(), lang = CUI.listLang, q = CUI.q.trim().toLowerCase(), cs = HC.countriesIn(COURSES.summary);
  const tot = HC.courseTotals(COURSES.summary, COURSES.cat), hp = homePlace();
  const placeOpts = [[hp, HC.countryName(hp) + ' (your country)'], ...(hp !== 'AU' ? [['AU', 'Australia']] : []), ...(hp !== 'NZ' ? [['NZ', 'New Zealand']] : []), ['w:Australia and New Zealand', 'Australia and New Zealand'], ...(hp !== 'GB' ? [['GB', 'United Kingdom']] : []), ['w:Europe', 'Europe (all countries)'], ['', 'All countries']]
    .concat(cs.filter(([cc]) => ![hp, 'AU', 'NZ', 'GB'].includes(cc)).map(([cc, n]) => [cc, `${HC.countryName(cc)} (${n})`]).sort((a, b) => a[1].localeCompare(b[1])));
  const langs = HC.languagesIn(COURSES.summary, place).filter(l => l !== 'English');
  const sel = (id, label, opts) => `<label class="sel"><span class="sel-l">${label}</span><select id="${id}" aria-label="${label}">${opts}</select></label>`;
  const nF = (place !== hp ? 1 : 0) + (lang !== 'en' ? 1 : 0);
  const filters = `<div class="filters course-filters"><div class="filter-top"><label class="search">${icon('search')}<input id="cq" type="search" placeholder="Search courses (ALS, ultrasound, IUD…)" aria-label="Search courses" value="${esc(CUI.q)}" autocomplete="off"></label>
    <button type="button" class="btn filt-btn" data-act="filters" aria-expanded="${FS.open}" aria-controls="fsheet">${icon('sliders')} ${esc(place ? HC.placeLabel(place) : 'All countries')}${nF ? `<span class="badge">${nF}</span>` : ''}</button></div>
    <div class="fsheet" id="fsheet" role="group" aria-label="Where and language"><div class="fsheet-head"><span class="grab" aria-hidden="true"></span><h2>Where and language</h2><button type="button" class="icon-btn" data-act="filtersclose" aria-label="Close filters">${icon('x')}</button></div><div class="selects">
    ${sel('cPlace', 'Country or region', placeOpts.map(([v, l]) => `<option value="${esc(v)}" ${v === place ? 'selected' : ''}>${esc(l)}</option>`).join(''))}
    ${sel('cListLang', 'Language', `<option value="en" ${lang === 'en' ? 'selected' : ''}>English (or not stated)</option><option value="any" ${lang === 'any' ? 'selected' : ''}>Any language</option>${langs.map(l => `<option value="${esc(l)}" ${l === lang ? 'selected' : ''}>Taught in ${esc(l)}</option>`).join('')}`)}</div>
    <div class="fsheet-foot"><button type="button" class="btn primary" data-act="filtersclose">Show courses</button></div></div></div><div class="scrim" data-act="filtersclose"></div>`;
  const match = c => !q || [c.name, HC.shortName(c), HC.bodyLabel(c.id), c.certifyingBody || '', ...(c.providers || []).map(p => p.name)].join(' ').toLowerCase().includes(q);
  const inFam = new Set([].concat(...HC.FAMILIES.map(f => f.members.map(m => m[0]))));
  const here = c => HC.countFor(COURSES.summary[c.id], place, lang).n;
  const fams = HC.FAMILIES.filter(f => f.members.some(([id]) => { const c = courseOf(id); return c && match(c); })).map(f => familyPanel(f, place, lang, '')).join('');
  /* a course shows when it has sessions here, or has none anywhere but names this country (dates not out yet); relevance 0 (ERC) only on request */
  const show = c => match(c) && (here(c) > 0 ? (HC.relevanceOf(c) > 0 || place || lang !== 'en') : !HC.countFor(COURSES.summary[c.id], '', 'any').n && (!place || (c.countries || []).some(cc => HC.inPlace(cc, place))));
  const rest = COURSES.cat.courses.filter(c => !inFam.has(c.id) && show(c))
    .sort((a, b) => HC.relevanceOf(b) - HC.relevanceOf(a) || (here(b) > 0) - (here(a) > 0) || (a.verified === true ? 0 : 1) - (b.verified === true ? 0 : 1) || a.name.localeCompare(b.name));
  const cards = rest.slice(0, CUI.lim).map(c => courseCard(c, place, lang)).join('') + (rest.length > CUI.lim ? `<div class="more-row"><button class="btn" data-act="morecourses">Show more (${rest.length - CUI.lim} left)</button></div>` : '');
  return filters + (fams ? `<div class="section"><h2>Life support and trauma certificates</h2></div><div class="fam-grid">${fams}</div>` : '')
    + `<div class="section"><h2>${q ? 'Courses matching “' + esc(CUI.q) + '”' : 'Other courses'}${place ? ' · ' + esc(HC.placeLabel(place)) : ''}</h2><span class="count">${plural(rest.length, 'course')}</span></div>`
    + (cards ? `<div class="grid">${cards}</div>` : '<div class="empty"><h2>No other courses here yet</h2><p>Try all countries, or any language.</p><p style="margin-top:16px"><a class="btn ghost" href="#/list-event">List a course session</a></p></div>')
    + `<p class="note">Hoggy lists ${n0(tot.types)} course types with ${n0(tot.sessions)} upcoming sessions in ${n0(tot.countries)} countries, each read from the provider's or course owner's own page. Prices stay in the currency the provider lists. EMST, CCrISP and ASSET dates from RACS are not available yet. Course dates were last checked on ${esc(fmtD(COURSES.cat.generated))}.</p>`;
}
const n0 = v => Number(v || 0).toLocaleString('en-AU');
function planCourse(sid) {
  const s = sessionById(sid); if (!s) return toast('That session is no longer listed');
  const r = HC.planTrip(S.trips, s, courseOf(s.courseId), uid());
  if (r.created) { CEV.set(r.trip.confId, r.trip.event); S.trips.push(r.trip); save(); }
  closeOverlay(); toast(r.created ? 'Trip planned' : 'Already in your trips'); location.hash = '#/trips'; render();
}
const CERT_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
function certDialog(opts = {}) {
  if (!COURSES.cat) return toast('The course list is still loading. Try again in a moment');
  const ed = opts.edit ? S.certs.find(x => x.id === opts.edit) : null, v = ed || opts.prefill || {}, cs = COURSES.cat.courses;
  simpleDialog(ed ? 'Edit certificate' : 'Add certificate', `${field('ce1', 'Course', `<select id="ce1" name="courseId" required>${cs.map(c => `<option value="${esc(c.id)}" ${c.id === v.courseId ? 'selected' : ''}>${esc(HC.shortName(c))} · ${esc(c.name)}</option>`).join('')}</select>`)}
    <div class="two">${field('ce2', 'Completed on', `<input id="ce2" type="date" name="completed" required max="${today()}" value="${esc(v.completed || '')}">`)}${field('ce3', 'Certificate number (optional)', `<input id="ce3" type="text" name="number" maxlength="40" value="${esc(v.number || '')}">`)}</div>
    <div class="field" id="ceExpWrap"><label for="ce4">Expiry date (from your certificate)</label><input id="ce4" type="date" name="expiresEntered" value="${esc(v.expiresEntered || '')}"></div>
    <p class="note" id="ceNote" style="margin:-4px 0 12px"></p>
    ${field('ce5', ed && ed.fileKey ? 'Replace the file (optional)' : 'Certificate file (optional: PDF, JPG, PNG)', '<input id="ce5" type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp">')}
    <p class="note" style="margin-top:0">Kept on this device and, when you are signed in, in your account, like your receipts.</p>`, async f => {
    const c = courseOf(String(f.get('courseId'))), completed = String(f.get('completed') || ''), entered = String(f.get('expiresEntered') || ''), file = f.get('file');
    if (!c) return toast('Pick a course');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(completed) || completed > today()) return toast('Enter the completion date (not in the future)');
    const x = HC.expiryFor({ completed, expiresEntered: entered }, c);
    if (!x.expires) return toast('Enter the expiry date printed on your certificate');
    if (x.expires < completed) return toast('The expiry date is before the completion date');
    const cert = ed || { id: uid(), created: Date.now() };
    Object.assign(cert, { courseId: c.id, short: HC.shortName(c), courseName: c.name, completed, number: String(f.get('number') || '').trim().slice(0, 40), expiresEntered: x.from === 'user' ? entered : '', expires: x.expires, expiryFrom: x.from, validityYears: x.years || null, validitySource: x.source || '' });
    if (file && file.size) {
      if (!CERT_TYPES.includes(file.type)) return toast('PDF, JPG, PNG or WebP only');
      if (file.size > 15e6) return toast('That file is over 15 MB');
      const k = 'c-' + cert.id; try { await putFile(k, file, file.name); cert.fileKey = k; cert.fileName = file.name.slice(0, 100); } catch (er) { toast('Could not store the file'); }
    }
    if (!ed) S.certs.push(cert);
    save(); closeOverlay(); toast(ed ? 'Certificate updated' : 'Certificate added'); if (route() !== 'certs') location.hash = '#/certs'; render();
  }, 'Save certificate');
  const sel = $('#ce1'), wrap = $('#ceExpWrap'), inp = $('#ce4'), upd = () => {
    const val = HC.validityOf(courseOf(sel.value)); wrap.hidden = !!val; inp.required = !val;
    $('#ceNote').innerHTML = val ? `Hoggy works out the expiry: ${esc(val.years)} years from the completion date, as published by the course owner (${srcLink(val.source)}). Your employer or college may ask for renewal sooner.` : 'Hoggy has not confirmed how long this certificate lasts, so enter the expiry date printed on it.';
  };
  sel.addEventListener('change', upd); upd();
}
function certItem(x) {
  const ok = COURSES.loaded && haveSessions(x.courseId), near = ok ? HC.nearSessions(COURSES.sessions, x.courseId, myRegion(), today(), 3, homePlace()) : null, reg = myRegion();
  const nearHtml = !ok ? '<p class="note">Loading sessions…</p>' : near.list.length ? `<div class="note">${near.local ? 'Next sessions near you (' + esc(reg) + ')' : (reg ? 'None listed in ' + esc(reg) + ' yet. Soonest elsewhere' : 'Next sessions') }</div>${near.list.map(s => `<button class="near" data-act="session" data-id="${esc(s.id)}"><b>${esc(fmtD(s.start, { day: 'numeric', month: 'short' }))}</b> ${esc(placeOf(s))} · ${esc(s.provider)}</button>`).join('')}<a class="u note" href="${esc(near.local ? findHref(x.courseId) : '#/courses/' + encodeURIComponent(x.courseId))}">All ${esc(x.short || '')} sessions</a>` : '<p class="note">Dates not available yet — check provider.</p>';
  const days = x.expires ? HC.daysBetween(today(), x.expires) : null;
  return `<article class="panel cert"><div class="cert-top"><div class="thumb plate-thumb">${ART ? ART.dial(x.courseId, dialLabel(x.short || x.courseId), { size: 'mini' }) : icon('cert')}</div><div class="grow"><h3>${esc(x.short || x.courseId)} <span class="cert-name">${esc(x.courseName || '')}</span></h3>
    <div class="s">Completed ${esc(fmtD(x.completed))}${x.number ? ' · No. ' + esc(x.number) : ''}</div>
    <div class="card-meta">${x.expires ? `<span class="exp">${x.st === 'expired' ? 'Expired' : 'Expires'} ${esc(fmtD(x.expires))} (${esc(whenText(x.expires))})</span>` : ''}${statusPill(x.st)}</div>
    <div class="note">${x.expiryFrom === 'catalogue' ? `${esc(x.validityYears)} years from completion, as published by the course owner ${x.validitySource ? '(' + srcLink(x.validitySource) + ')' : ''}` : 'Expiry date entered by you from the certificate'}</div></div>
    ${days != null && days > 0 ? `<b class="fig sm cert-days">${days < 60 ? days : Math.round(days / 30.44)}<small>${days < 60 ? 'days' : 'months'} left</small></b>` : ''}</div>
    <div class="row cert-acts">${x.fileKey ? `<button class="icon-btn" data-act="opencert" data-id="${esc(x.id)}" aria-label="Download certificate file" title="Download certificate file">${icon('file')}</button>` : ''}<button class="btn sm" data-act="editcert" data-id="${esc(x.id)}">Edit</button><button class="btn sm danger" data-act="rmcert" data-id="${esc(x.id)}">Delete</button></div>
    <div class="cert-near">${nearHtml}</div></article>`;
}

/* ---------- post-render wiring ---------- */
const HOL = (window.HOGGY_HOLIDAYS && window.HOGGY_HOLIDAYS.regions) || [];
const holRegions = code => code === 'AU' ? HOL.filter(r => r.country === 'AU') : code === 'ANZ' ? HOL : HOL.filter(r => r.code === code);
/* the school-holiday regions whose break overlaps this conference (any day of it) */
const holHits = (c, code) => holRegions(code).filter(r => r.holidays.some(h => h.start <= c.end && h.end >= c.start));
/* ---------- "Highest rated by attendees": series with 3+ reviews, by the weighted score (GET /api/top-rated) ---------- */
const TOP_N = { home: 6, discover: 12 };
async function loadTop(spec = '') {
  const r = await api('/api/top-rated?limit=12' + (spec ? '&specialty=' + encodeURIComponent(spec) : ''));
  if (r.error || !Array.isArray(r.series)) return false;
  NET.top[spec] = r.series; return true;
}
function topCard(x) {
  const c = byId(x.confId); if (!c) return '';
  return `<article class="card topcard" data-act="open" data-id="${esc(c.id)}">
    <div class="art">${plate(c, 'tall')}</div>
    <div class="card-body"><p class="card-when top-score"><span class="stars" aria-hidden="true">${stars(x.avg)}</span> <b>${x.avg.toFixed(1)}</b></p><h3><a class="card-link" href="/conferences/${esc(encodeURIComponent(c.id))}" data-act="open" data-id="${esc(c.id)}" aria-label="${esc(x.title)}: ${esc(x.avg.toFixed(1))} out of 5 from ${esc(plural(x.n, 'review'))}, ${esc(x.verified)} verified">${esc(x.title)}</a></h3>
    <p class="card-where">${esc(c.specialty)} · ${x.upcoming ? 'Next: ' + esc(c.city) + ' · ' + esc(range(c)) : 'Last held ' + esc(c.start.slice(0, 4))}</p>
    <div class="card-meta"><span class="tag top-n">${plural(x.n, 'review')} · ${x.verified} verified</span></div></div></article>`;
}
function topSection() {
  const L = (NET.online && NET.top[''] || []).filter(x => byId(x.confId)).slice(0, TOP_N.home);
  if (!L.length) return '';
  return `<section class="toprated" aria-labelledby="topHomeH"><div class="section"><h2 id="topHomeH">Highest rated by attendees</h2><a href="#/discover" data-act="toplist">See the list</a></div>
    <p class="note sec-note">Conferences with at least 3 reviews, scored across every year. Verified reviews count in full, unverified ones half.</p>
    <div class="grid ex shelf">${L.map(topCard).join('')}</div></section>`;
}
function drawTopList() {
  const el = $('#topList'); if (!el) return;
  if (UI.sort !== 'rating') { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  const spec = UI.spec === 'All' ? '' : UI.spec, head = `<div class="section"><h2 id="topH">Highest rated by attendees${spec ? ' · ' + esc(spec) : ''}</h2></div>`;
  if (!NET.online) { el.innerHTML = head + '<p class="note">Attendee scores aren\u2019t available right now. Try again in a minute.</p>'; return; }
  const L = NET.top[spec];
  if (!L) { el.innerHTML = head + '<p class="note">Loading scores…</p>'; loadTop(spec).then(ok => { if (ok && route() === 'discover' && UI.sort === 'rating') drawTopList(); }); return; }
  const shown = L.filter(x => byId(x.confId)).slice(0, TOP_N.discover);
  el.innerHTML = head + (shown.length ? `<ol class="toprank">${shown.map((x, i) => `<li><span class="rank" aria-hidden="true">${i + 1}</span>${topCard(x)}</li>`).join('')}</ol>`
    : `<p class="note top-empty">No conference has 3 reviews yet — <button type="button" class="linkbtn" data-act="topfind">review one you've attended</button></p>`);
}
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
  if (UI.confirmed) L = L.filter(c => UI.confirmed === '2' ? dateEv(c) === 'confirmed' : c.datesConfirmed !== false);
  const srt = { date: (a, b) => a.start.localeCompare(b.start), rating: (a, b) => (rating(b) || 0) - (rating(a) || 0), cpd: (a, b) => (b.cpdVerified ? b.cpdHours : 0) - (a.cpdVerified ? a.cpdHours : 0), price: (a, b) => (figPrice(a) || Infinity) - (figPrice(b) || Infinity) || a.start.localeCompare(b.start), match: (a, b) => matchScore(b) - matchScore(a) };
  L.sort(srt[UI.sort]);
  drawTopList();
  const cm = q && COURSES.cat ? HC.searchCourses(COURSES.cat, q) : [];
  $('#count').textContent = `${L.length.toLocaleString('en-AU')} result${L.length === 1 ? '' : 's'}${cm.length ? ' · ' + plural(cm.length, 'course') : ''}`;
  const nf = [UI.region, UI.country, UI.month, UI.hol, UI.cpd, UI.confirmed, UI.sort !== 'date'].filter(Boolean).length, fn = $('#fN'), fs = $('#fShow'); if (fn) { fn.hidden = !nf; fn.textContent = nf; } if (fs) fs.textContent = `Show ${L.length.toLocaleString('en-AU')} result${L.length === 1 ? '' : 's'}`;
  if (MOTION) MOTION.scan($('#results'));
  $('#results').innerHTML = cm.map(courseCard).join('') + L.slice(0, UI.limit).map(card).join('') + (L.length > UI.limit ? `<div class="more-row"><button class="btn" data-act="more">Show more (${L.length - UI.limit} left)</button></div>` : '') || (cm.length ? '' : `<div class="empty wide"><h2>No conferences match</h2><p>Try a shorter search or fewer filters.</p><p style="margin-top:16px"><button class="btn primary" data-act="clearfilters">Clear search and filters</button> <a class="btn ghost" href="#/list-event">Know one we're missing?</a></p></div>`);
}
const AFTER = {
  courses() {
    const hp = hashParts().parts; if (hp[1]) needSessions([hp[1]]);
    if (!$('#sessList')) { /* the list page */
      const q = $('#cq'); if (!q) return;
      const keep = () => { const u = new URLSearchParams(); if (CUI.place != null) u.set('country', CUI.place); if (CUI.listLang !== 'en') u.set('lang', CUI.listLang); history.replaceState(null, '', '#/courses' + (u.toString() ? '?' + u : '')); };
      let t = null; q.addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { CUI.q = e.target.value; CUI.lim = 24; render(); const n = $('#cq'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 200); });
      $('#cPlace').addEventListener('change', e => { CUI.place = e.target.value; CUI.listLang = 'en'; CUI.lim = 24; keep(); render(); });
      $('#cListLang').addEventListener('change', e => { CUI.listLang = e.target.value; CUI.lim = 24; keep(); render(); });
      return;
    }
    const keep = () => { const q = new URLSearchParams(); for (const k of ['country', 'state', 'city', 'month']) if (CUI[k]) q.set(k, CUI[k]); if (CUI.lang !== 'en') q.set('lang', CUI.lang); history.replaceState(null, '', '#/courses/' + CUI.course + (q.toString() ? '?' + q : '')); };
    const redraw = () => { keep(); const f = $('.sess-filters'); f.outerHTML = courseFilters(); wire(); sessionList(); };
    const wire = () => {
      $('#cCountry').addEventListener('change', e => { CUI.country = e.target.value; CUI.state = ''; CUI.city = ''; CUI.limit = 25; redraw(); });
      $('#cLang').addEventListener('change', e => { CUI.lang = e.target.value; CUI.limit = 25; redraw(); });
      if ($('#cState')) $('#cState').addEventListener('change', e => { CUI.state = e.target.value; CUI.city = ''; CUI.limit = 25; redraw(); });
      $('#cCity').addEventListener('change', e => { CUI.city = e.target.value; CUI.limit = 25; keep(); sessionList(); });
      $('#cMonth').addEventListener('change', e => { CUI.month = e.target.value; CUI.limit = 25; keep(); sessionList(); });
    };
    wire(); sessionList();
  },
  certs() { needSessions((S.certs || []).map(c => c.courseId)); },
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
      ['name', 'specialty', 'country', 'homeAirport', 'currency', 'theme', 'cpdBody', 'region'].forEach(k => p[k] = String(f.get(k) || '').slice(0, 80)); p.cpdTarget = Math.max(1, +f.get('cpdTarget') || 50); p.cpdYear = +f.get('cpdYear') || p.cpdYear;
      document.querySelectorAll('[data-cap]').forEach(i => p.caps[i.dataset.cap] = Math.max(0, +i.value || 0));
      p.employer = p.employer || {}; document.querySelectorAll('[data-emp]').forEach(i => { const v = i.type === 'number' ? Math.max(0, +i.value || 0) : String(i.value || '').trim().slice(0, 120); p.employer[i.dataset.emp] = v; }); save(); applyTheme(); toast('Settings saved'); renderNav(); });
    wireHospSettings();
  }
};

/* ---------- hospital: organisation, trip approval, study budget, claims to finance ----------
   Optional. Everything here is a server record (lib/hospital-api.js); the synced state blob only keeps the doctor's own
   cost estimate on the trip. Roles are checked again on the server; these checks only decide what to show. */
const HOSP = { org: null, counts: {}, mine: [], claims: [], budget: {}, notes: { unread: 0, items: [] }, pend: null, decided: [], team: null, teamYear: new Date().getFullYear(), finance: null, loaded: false, busy: new Set() };
const HCAN = { approve: ['manager', 'admin'], team: ['manager', 'admin'], finance: ['finance', 'admin'], admin: ['admin'] };
const hcan = what => !!(HOSP.org && HCAN[what].includes(HOSP.org.role));
const inHosp = () => !!(NET.user && HOSP.org);
const hmoney = c => money((c || 0) / 100, HOSP.org ? HOSP.org.currency : S.profile.currency);
const toCents = v => Math.round((+v || 0) * 100);
const COSTS = [['registration', 'Registration'], ['flights', 'Flights'], ['accommodation', 'Accommodation'], ['other', 'Other']];
const ROLE_NAMES = { doctor: 'Doctor', manager: 'Manager', finance: 'Finance', admin: 'Admin' };
const HOSP_ROUTES = [['approvals', 'approve'], ['team', 'team'], ['finance', 'finance']];
const approvalOf = t => HOSP.mine.find(a => a.tripRef === t.id) || null;
const hClaimOf = t => HOSP.claims.find(c => c.tripRef === t.id) || null;
const tripYear = t => { const c = ofTrip(t); return c ? +c.start.slice(0, 4) : new Date().getFullYear(); };
const eventOf = c => ({ name: c.name, city: c.city || '', country: c.country || '', start: c.start, end: c.end || c.start, kind: c.kind === 'course' ? 'course' : 'conference' });
const dayOf = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const claimsTo = () => EMP().adminEmail || (inHosp() && HOSP.org.claimsEmail) || '';
/* what needs a look: unread notices, plus requests to decide and claims to pay for those roles (Settings badge on phones) */
const hospBadge = () => HOSP.org ? (HOSP.counts.unread || 0) + (hcan('approve') ? HOSP.counts.approvals || 0 : 0) + (hcan('finance') ? HOSP.counts.claims || 0 : 0) : 0;
function resetHosp() { Object.assign(HOSP, { org: null, counts: {}, mine: [], claims: [], budget: {}, notes: { unread: 0, items: [] }, pend: null, decided: [], team: null, finance: null, loaded: false }); HOSP.busy.clear(); }
async function loadHosp() {
  if (!NET.user) return resetHosp();
  const r = await api('/api/org'); if (r.error) return;
  HOSP.org = r.org; HOSP.counts = r.counts || {}; HOSP.loaded = true; HOSP.budget = {};
  if (!r.org) { HOSP.mine = []; HOSP.claims = []; HOSP.notes = { unread: 0, items: [] }; return; }
  const [mine, cl, nt] = await Promise.all([api('/api/approvals/mine'), api('/api/claims/mine'), api('/api/notifications')]);
  if (Array.isArray(mine)) HOSP.mine = mine;
  if (Array.isArray(cl)) { HOSP.claims = cl; syncPaid(); }
  if (!nt.error) HOSP.notes = nt;
}
/* background refresh (every minute with the inbox poll): re-render only when something changed */
async function refreshHosp() { if (!NET.user) return; const sig = () => JSON.stringify([HOSP.org, HOSP.counts, HOSP.mine, HOSP.claims, HOSP.notes.unread]); const a = sig(); await loadHosp(); if (sig() !== a) { if (HOSP_ROUTES.some(([k]) => k === route())) { HOSP.pend = HOSP.team = HOSP.finance = null; } bgRender(); } }
/* finance marked a claim paid: show it on the doctor's receipts too (the server record is the source) */
function syncPaid() {
  let ch = false;
  for (const c of HOSP.claims) {
    if (c.status !== 'paid') continue; const t = S.trips.find(x => x.id === c.tripRef); if (!t) continue;
    S.receipts.forEach(r => { if (r.tripId === t.id && r.status === 'claimed') { r.status = 'paid'; ch = true; } });
    const d = dayOf(c.paid); if (!S.claims[t.id] || S.claims[t.id].paid !== d) { S.claims[t.id] = { ...(S.claims[t.id] || {}), paid: d }; ch = true; }
  }
  if (ch) save();
}
async function loadOnce(key, fn) { if (HOSP.busy.has(key)) return; HOSP.busy.add(key); try { await fn(); } finally { HOSP.busy.delete(key); } }
const loadBudget = year => loadOnce('b' + year, async () => { const r = await api('/api/budget?year=' + year); HOSP.budget[year] = r.error ? false : r; bgRender(); });
const loadApprovals = () => loadOnce('ap', async () => { const [p, d] = await Promise.all([api('/api/approvals'), api('/api/approvals?status=decided')]); HOSP.pend = Array.isArray(p) ? p : []; HOSP.decided = Array.isArray(d) ? d : []; if (route() === 'approvals') bgRender(); });
const loadTeam = y => loadOnce('t' + y, async () => { const r = await api('/api/org/team?year=' + y); HOSP.team = r.error ? { year: y, members: [], error: r.error } : r; if (route() === 'team') bgRender(); });
const loadFinance = () => loadOnce('fin', async () => { const r = await api('/api/claims'); HOSP.finance = Array.isArray(r) ? r : []; if (route() === 'finance') bgRender(); });
const hErr = r => r.error === 'offline' ? 'Can’t reach Hoggy. Check your connection and try again.' : r.error;

function budgetCard(year, opts = {}) {
  if (!inHosp()) return '';
  const b = HOSP.budget[year]; if (b === undefined) loadBudget(year);
  const cls = opts.compact ? 'budget compact' : 'panel budget';
  if (!b) return `<section class="${cls}" aria-label="Study budget ${year}"><h3>Study budget ${year}</h3><p class="note">${b === false ? 'Could not load the budget.' : 'Loading…'}</p></section>`;
  const used = b.committed + b.spent, pct = b.allowance ? Math.min(100, Math.round(used / b.allowance * 100)) : used ? 100 : 0, over = b.remaining < 0;
  return `<section class="${cls}" aria-label="Study budget ${year}" data-testid="budget-${year}"><div class="budget-head"><h3>Study budget ${year}</h3><span class="note">${esc(HOSP.org.name)}${b.ownAllowance ? ' · your own allowance' : ''}</span></div>
    <dl class="budget-grid">${[['Allowance', b.allowance], ['Committed', b.committed], ['Spent', b.spent], ['Remaining', b.remaining]].map(([k, v]) => `<div class="${k === 'Remaining' ? 'rem' + (over ? ' over' : '') : ''}"><dt>${k}</dt><dd data-k="${k.toLowerCase()}">${hmoney(v)}</dd></div>`).join('')}</dl>
    <div class="bar" aria-hidden="true"><i class="${over ? 'warn' : ''}" style="width:${pct}%"></i></div>
    <p class="note">${b.pending ? `<b>${hmoney(b.pending)}</b> waiting for approval (not taken off yet). ` : ''}${opts.compact ? '' : 'Committed: approved trips not yet claimed, at their estimates. Spent: claims submitted or paid, at the claim-pack totals. Counted by the year each event starts.'}</p></section>`;
}
function tripHospBox(t) {
  if (!inHosp()) return '';
  const a = approvalOf(t), cl = hClaimOf(t);
  const st = !a ? '<span class="pill">Approval not requested</span>' : a.status === 'pending' ? '<span class="pill w">Awaiting approval</span>' : a.status === 'approved' ? '<span class="pill g">Approved</span>' : '<span class="pill b">Not approved</span>';
  const cst = cl ? `<span class="pill ${cl.status === 'paid' ? 'g' : 'w'}">${cl.status === 'paid' ? 'Claim paid ' + esc(fmtD(dayOf(cl.paid))) : 'Claim with finance'}</span>` : '';
  const who = a && a.decidedBy ? ' by ' + esc(a.decidedBy) : '';
  const msg = !a ? `Ask ${esc(HOSP.org.name)} to approve this trip before you book.` : a.status === 'pending' ? `Sent ${esc(fmtD(dayOf(a.updated)))}. A manager or admin decides; the answer shows here.` : a.status === 'approved' ? `Approved${who}${a.comment ? ': “' + esc(a.comment) + '”' : '.'}` : `Not approved${who}: “${esc(a.comment)}” Change the plan and send it again.`;
  const btn = !a ? `<button class="btn sm primary" data-act="reqapproval" data-id="${esc(t.id)}">Request approval</button>` : a.status === 'rejected' ? `<button class="btn sm primary" data-act="reqapproval" data-id="${esc(t.id)}">Edit and resubmit</button>` : '';
  return `<div class="hosp-box" data-testid="trip-approval"><div class="row" style="justify-content:space-between"><div class="pills">${st}${a ? `<span class="pill">Estimate ${hmoney(a.estimateCents)}</span>` : ''}${cst}</div>${btn}</div><p class="note" style="margin:8px 0 0" data-testid="approval-msg">${msg}</p>${budgetCard(tripYear(t), { compact: true })}</div>`;
}
function approvalDialog(tripId) {
  const t = S.trips.find(x => x.id === tripId), c = t && ofTrip(t); if (!c || !inHosp()) return;
  const a = approvalOf(t), cur = HOSP.org.currency, lv = (S.leave || {})[c.id] || {}, sum = ty => (t.bookings || []).filter(b => b.type === ty).reduce((x, b) => x + (+b.amount || 0), 0);
  /* reuse what Hoggy already has: the last request, the trip's own estimate, the study-leave draft, then logged bookings */
  const pre = a ? Object.fromEntries(COSTS.map(([k]) => [k, (a.costs[k] || 0) / 100])) : t.estimate || lv.est || { registration: sum('Registration'), flights: sum('Flight'), accommodation: sum('Hotel'), other: sum('Transport') };
  const b = HOSP.budget[tripYear(t)];
  simpleDialog(a ? 'Edit and resubmit' : 'Request approval', `<p class="note" style="margin:0 0 12px">${esc(c.name)}, ${esc(c.city)}, ${esc(range(c))}. Goes to the managers and admins at ${esc(HOSP.org.name)}.${cur !== S.profile.currency ? ` Amounts in ${esc(cur)}, your hospital's currency.` : ''}</p>
    ${a && a.status === 'rejected' ? `<p class="check bad" style="margin:0 0 12px">✕ ${esc(a.comment)}</p>` : ''}
    <div class="two">${COSTS.map(([k, l]) => field('ap-' + k, `${l} (${esc(cur)})`, `<input id="ap-${k}" type="number" min="0" step="0.01" inputmode="decimal" name="${k}" value="${+pre[k] ? esc(pre[k]) : ''}">`)).join('')}</div>
    ${field('ap-note', 'Note for your manager (optional)', `<textarea id="ap-note" name="note" rows="3" maxlength="500">${esc(a ? a.note : '')}</textarea>`)}
    <p class="note">${b ? `Your ${esc(tripYear(t))} budget has ${hmoney(b.remaining)} left before this request.` : ''} Estimates only: the claim uses your receipts.</p>`, async f => {
    const costs = Object.fromEntries(COSTS.map(([k]) => [k, toCents(f.get(k))])), btn = $('#sf button[type=submit]');
    if (!Object.values(costs).some(v => v > 0)) return toast('Add at least one estimated cost');
    if (btn) btn.disabled = true;
    const r = await api('/api/approvals', { method: 'POST', body: { tripRef: t.id, confId: c.id, event: eventOf(c), costs, note: String(f.get('note') || '') } });
    if (r.error) { if (btn) btn.disabled = false; return toast(hErr(r)); }
    t.estimate = Object.fromEntries(COSTS.map(([k]) => [k, costs[k] / 100])); save();
    await loadHosp(); closeOverlay(); render();
    toast(r.approvers ? (a ? 'Resubmitted for approval' : 'Sent for approval') : 'Saved. Nobody at your hospital can approve yet: ask your admin to make someone a manager');
  }, a ? 'Resubmit' : 'Send request');
}
function notesList(max = 5) {
  const items = (HOSP.notes.items || []).slice(0, max); if (!items.length) return '';
  return `<div class="list notes">${items.map(n => `<div class="li${n.seen ? '' : ' unread'}"><div class="grow"><div class="t" style="font-weight:${n.seen ? 500 : 650}">${esc(n.text)}</div><div class="s">${esc(fmtD(dayOf(n.created)))}</div></div>${n.link && /^#\/[a-z]+$/.test(n.link) ? `<a class="btn sm ghost" href="${esc(n.link)}">Open</a>` : ''}</div>`).join('')}</div>${HOSP.notes.unread ? '<p style="margin-top:8px"><button class="btn sm ghost" data-act="hnotesread">Mark all read</button></p>' : ''}`;
}
function hospLinks() {
  const n = HOSP.counts || {};
  return [hcan('approve') ? `<a class="btn sm" href="#/approvals">${icon('check')} Approvals${n.approvals ? ` <span class="pill w">${n.approvals}</span>` : ''}</a>` : '', hcan('team') ? `<a class="btn sm" href="#/team">${icon('users')} Team</a>` : '', hcan('finance') ? `<a class="btn sm" href="#/finance">${icon('claim')} Finance claims${n.claims ? ` <span class="pill w">${n.claims}</span>` : ''}</a>` : ''].filter(Boolean).join('');
}
/* Home: the study budget for the next trip's year (or this year) and what the hospital needs from you */
function hospHome() {
  if (!inHosp()) return '';
  const nextT = S.trips.filter(t => ofTrip(t) && ofTrip(t).end >= today()).sort((a, b) => ofTrip(a).start.localeCompare(ofTrip(b).start))[0], y = nextT ? tripYear(nextT) : new Date().getFullYear(), links = hospLinks();
  return `<div class="hosp-home">${budgetCard(y)}<section class="panel" aria-labelledby="hhH"><h3 id="hhH">${esc(HOSP.org.name)} <span class="pill">${esc(ROLE_NAMES[HOSP.org.role])}</span></h3>${links ? `<div class="row" style="margin-bottom:10px">${links}</div>` : ''}${notesList(3) || '<p class="note" style="margin:0">Nothing new. Request approval from a trip; decisions and payments show here.</p>'}</section></div>`;
}
/* Settings, "Your hospital": join with a code, create one, or (members) see it, open the role pages, and (admins) manage it */
function hospPanel() {
  if (!NET.online) return '';
  const head = '<h3>Your hospital</h3>';
  if (!NET.user) return `<div class="panel" id="hosp">${head}<p style="color:var(--muted);margin-bottom:12px">Optional. Sign in to join your hospital with its code, or set one up, for trip approval, a study budget and claims to finance.</p><button class="btn" data-act="signin">Sign in</button></div>`;
  if (!HOSP.loaded) return `<div class="panel" id="hosp">${head}<p class="note">Loading…</p></div>`;
  if (!HOSP.org) return `<div class="panel" id="hosp">${head}<p style="color:var(--muted);margin-bottom:12px">Optional. In a hospital you can ask for trip approval, see your study budget and send claims to finance. Without one, Hoggy works as it does now.</p>
    <form id="hjoin" class="hform"><div class="field"><label for="hj">Join with a code</label><input id="hj" name="code" type="text" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EFGH" required></div><button class="btn primary" type="submit">Join hospital</button></form>
    <details class="hnew"><summary>Set up a hospital instead</summary><form id="hnew" style="margin-top:10px"><p class="note" style="margin:0 0 10px">You become its admin and get a code to share with colleagues.</p>
      ${field('hn1', 'Hospital or health service', '<input id="hn1" name="name" type="text" maxlength="120" required>')}
      ${field('hn2', 'Claims email (finance)', '<input id="hn2" name="claimsEmail" type="email" maxlength="254" placeholder="claims@hospital.example">')}
      <div class="two">${field('hn3', 'Yearly study allowance per doctor', '<input id="hn3" name="allowance" type="number" min="0" step="1" inputmode="numeric" placeholder="0">')}${field('hn4', 'Currency', `<select id="hn4" name="currency">${['AUD', 'NZD', 'USD', 'GBP', 'EUR', 'CAD', 'SGD'].map(s => `<option ${s === S.profile.currency ? 'selected' : ''}>${s}</option>`).join('')}</select>`)}</div>
      <button class="btn primary" type="submit">Create hospital</button></form></details></div>`;
  const o = HOSP.org, links = hospLinks();
  return `<div class="panel" id="hosp">${head}<div class="li" style="padding:0 0 12px"><div class="grow"><div class="t" data-testid="hosp-name">${esc(o.name)}</div><div class="s">You are: ${esc(ROLE_NAMES[o.role])} · claims to ${o.claimsEmail ? esc(o.claimsEmail) : 'no email set'} · ${hmoney(o.defaultAllowanceCents)} a year each</div></div></div>
    ${links ? `<div class="row" style="margin-bottom:12px">${links}</div><p class="note" style="margin:-4px 0 12px">On a phone these pages open from here.</p>` : ''}
    ${notesList(5)}
    ${hcan('admin') ? `<h3 style="margin:16px 0 6px;font-size:15px">Join code</h3><div class="copybox"><span style="flex:1" data-testid="join-code">${esc(o.joinCode)}</span><button class="icon-btn" data-act="copy" data-v="${esc(o.joinCode)}" aria-label="Copy join code">${icon('copy')}</button></div><p class="note">Colleagues enter it under Settings, Your hospital. They join as doctors; change roles on the Team page. <button class="btn sm ghost" data-act="hcode">New code</button></p>
      <details class="hnew"><summary>Hospital settings</summary><form id="hset" style="margin-top:10px">${field('hs1', 'Name', `<input id="hs1" name="name" type="text" maxlength="120" required value="${esc(o.name)}">`)}${field('hs2', 'Claims email (finance)', `<input id="hs2" name="claimsEmail" type="email" maxlength="254" value="${esc(o.claimsEmail)}">`)}${field('hs3', `Yearly study allowance per doctor (${esc(o.currency)})`, `<input id="hs3" name="allowance" type="number" min="0" step="1" value="${esc(o.defaultAllowanceCents / 100)}">`)}<button class="btn primary" type="submit">Save hospital</button></form></details>` : ''}
    <p style="margin-top:14px"><button class="btn sm danger" data-act="hleave">Leave hospital</button></p></div>`;
}
const gate = (title, who) => `<div class="page-head"><div><h1>${esc(title)}</h1></div></div><div class="empty"><h2>${!NET.user ? 'Sign in first' : !HOSP.loaded ? 'Loading…' : HOSP.org ? `Only ${who} can open this page` : 'Join a hospital first'}</h2><p>${HOSP.org ? `You are ${esc(ROLE_NAMES[HOSP.org.role])} at ${esc(HOSP.org.name)}.` : 'Hospitals are optional. Join or set one up under Settings, Your hospital.'}</p><p style="margin-top:16px"><a class="btn" href="#/settings">Settings</a></p></div>`;
function miniBudget(b, extra) { return b ? `<dl class="budget-grid sm">${[['Allowance', b.allowance], ['Committed', b.committed], ['Spent', b.spent], ['Remaining', b.remaining]].map(([k, v]) => `<div class="${k === 'Remaining' && v < 0 ? 'over' : ''}"><dt>${k} ${esc(b.year)}</dt><dd>${hmoney(v)}</dd></div>`).join('')}${extra || ''}</dl>` : ''; }
function approvalCard(a) {
  const ev = a.event || {}, after = a.budget ? a.budget.remaining - a.estimateCents : null;
  return `<article class="panel ap-card" data-testid="approval-req" data-doctor="${esc(a.doctor)}"><div class="row" style="justify-content:space-between;align-items:flex-start;flex-wrap:nowrap"><div style="min-width:0"><h3 style="margin:0">${esc(a.doctor)}</h3><div class="s" style="color:var(--muted)">${esc(ev.name)}${ev.city ? ' · ' + esc(ev.city) : ''} · ${esc(range(ev))}</div></div><div class="ap-total">${hmoney(a.estimateCents)}</div></div>
    <div class="pills" style="margin-top:10px">${COSTS.filter(([k]) => (a.costs || {})[k]).map(([k, l]) => `<span class="pill">${l} ${hmoney(a.costs[k])}</span>`).join('')}<span class="pill">Asked ${esc(fmtD(dayOf(a.updated)))}</span></div>
    ${a.note ? `<p class="note">“${esc(a.note)}”</p>` : ''}
    ${miniBudget(a.budget, after === null ? '' : `<div class="${after < 0 ? 'over' : ''}"><dt>Left if approved</dt><dd>${hmoney(after)}</dd></div>`)}
    ${a.mine ? '<p class="note">Your own request. Another manager or admin decides it.</p>' : `<div class="field" style="margin-top:12px"><label for="apc-${a.id}">Comment (needed to reject)</label><textarea id="apc-${a.id}" rows="2" maxlength="1000"></textarea></div><div class="row"><button class="btn primary" data-act="apdecide" data-id="${a.id}" data-v="approve">Approve</button><button class="btn danger" data-act="apdecide" data-id="${a.id}" data-v="reject">Reject</button></div>`}</article>`;
}
Object.assign(VIEWS, {
  approvals() {
    if (!hcan('approve')) return gate('Approvals', 'managers and admins');
    if (HOSP.pend === null) loadApprovals();
    const head = `<div class="page-head"><div><h1>Approvals</h1><p>Trip requests from ${esc(HOSP.org.name)}, with each doctor's study budget for the year of the event. Pending requests are not taken off a budget until approved.</p></div></div>`;
    if (HOSP.pend === null) return head + '<div class="loading" aria-busy="true">Loading…</div>';
    return head + (HOSP.pend.length ? HOSP.pend.map(approvalCard).join('') : '<div class="empty"><h2>Nothing waiting</h2><p>New requests show here, and on your Home page.</p></div>')
      + (HOSP.decided.length ? `<div class="section"><h2>Decided recently</h2></div><div class="panel"><div class="list">${HOSP.decided.map(a => `<div class="li"><div class="grow"><div class="t">${esc(a.doctor)} · ${esc((a.event || {}).name)}</div><div class="s">${a.status === 'approved' ? 'Approved' : 'Not approved'}${a.decidedBy ? ' by ' + esc(a.decidedBy) : ''} · ${esc(fmtD(dayOf(a.decided)))}${a.comment ? ' · “' + esc(a.comment) + '”' : ''}</div></div><div class="amt">${hmoney(a.estimateCents)}</div></div>`).join('')}</div></div>` : '');
  },
  team() {
    if (!hcan('team')) return gate('Team', 'managers and admins');
    const y = HOSP.teamYear, T = HOSP.team && HOSP.team.year === y ? HOSP.team : null; if (!T) loadTeam(y);
    const head = `<div class="page-head"><div><h1>Team</h1><p>Study budgets at ${esc(HOSP.org.name)} for events starting in ${esc(y)}. The hospital default is ${hmoney(HOSP.org.defaultAllowanceCents)} a year; set a different figure for one person below.</p></div><nav class="seg" aria-label="Budget year"><button class="linkbtn" data-act="teamyear" data-v="-1" aria-label="Previous year">← ${y - 1}</button><a aria-current="page">${esc(y)}</a><button class="linkbtn" data-act="teamyear" data-v="1" aria-label="Next year">${y + 1} →</button></nav></div>`;
    if (!T) return head + '<div class="loading" aria-busy="true">Loading…</div>';
    if (T.error) return head + `<div class="empty"><p>${esc(T.error)}</p></div>`;
    return head + T.members.map(m => { const b = m.budget;
      return `<article class="panel team-row" data-testid="team-member" data-email="${esc(m.email)}"><div class="row" style="justify-content:space-between;align-items:flex-start"><div style="min-width:0"><h3 style="margin:0;overflow-wrap:anywhere">${esc(m.name || m.email)}${m.me ? ' <span class="pill">You</span>' : ''}</h3><div class="s" style="color:var(--muted);overflow-wrap:anywhere">${esc(m.email)}</div></div>
        ${T.canAdmin ? `<label class="role-pick">Role <select data-role-user="${m.userId}" aria-label="Role for ${esc(m.name || m.email)}">${Object.entries(ROLE_NAMES).map(([k, l]) => `<option value="${k}" ${k === m.role ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : `<span class="pill">${esc(ROLE_NAMES[m.role])}</span>`}</div>
        ${miniBudget(b, b.pending ? `<div><dt>Waiting</dt><dd>${hmoney(b.pending)}</dd></div>` : '')}
        <div class="row allow-row"><label class="from-field" for="al-${m.userId}">Allowance ${esc(y)} (${esc(T.currency)}) <input id="al-${m.userId}" type="number" min="0" step="1" inputmode="numeric" value="${b.ownAllowance ? esc(b.allowance / 100) : ''}" placeholder="${esc(T.defaultAllowanceCents / 100)} (default)"></label><button class="btn sm" data-act="setallow" data-id="${m.userId}">Save</button>${b.ownAllowance ? `<button class="btn sm ghost" data-act="resetallow" data-id="${m.userId}">Use default</button>` : ''}${T.canAdmin && !m.me ? `<button class="btn sm danger" data-act="rmmember" data-id="${m.userId}" data-v="${esc(m.name || m.email)}">Remove</button>` : ''}</div></article>`; }).join('');
  },
  finance() {
    if (!hcan('finance')) return gate('Finance claims', 'finance and admins');
    if (HOSP.finance === null) loadFinance();
    const head = `<div class="page-head"><div><h1>Finance claims</h1><p>Claims doctors at ${esc(HOSP.org.name)} marked as submitted. Check the pack they emailed to ${HOSP.org.claimsEmail ? esc(HOSP.org.claimsEmail) : 'your claims address'}, pay it, then mark it paid here. Hoggy does not move money.</p></div></div>`;
    if (HOSP.finance === null) return head + '<div class="loading" aria-busy="true">Loading…</div>';
    const row = c => `<div class="li fin-row" data-testid="fin-claim" data-doctor="${esc(c.doctor)}"><div class="grow"><div class="t">${esc(c.doctor)} · ${esc((c.event || {}).name)}</div><div class="s">${esc(range(c.event || {}))} · submitted ${esc(fmtD(dayOf(c.submitted)))} · ${plural(c.receipts, 'receipt')}${c.approval === 'approved' ? ' · approved trip' : ' · no approval on file'}</div></div><div style="text-align:right"><div class="amt">${hmoney(c.totalCents)}</div>${c.status === 'paid' ? `<span class="status paid">Paid ${esc(fmtD(dayOf(c.paid)))}</span>` : c.mine ? '<span class="note">Your own claim: someone else marks it paid</span>' : `<button class="btn sm primary" data-act="markpaid" data-id="${c.id}" data-v="${esc(c.doctor)}">Mark paid</button>`}</div></div>`;
    const todo = HOSP.finance.filter(c => c.status === 'submitted'), done = HOSP.finance.filter(c => c.status === 'paid');
    return head + `<div class="panel"><h3>To pay (${todo.length})</h3>${todo.length ? `<div class="list">${todo.map(row).join('')}</div>` : '<p class="note" style="margin:0">Nothing waiting.</p>'}</div>` + (done.length ? `<div class="panel"><h3>Paid</h3><div class="list">${done.map(row).join('')}</div></div>` : '');
  }
});
Object.assign(ROUTES, { approvals: ['Approvals', 'check', true], team: ['Team', 'users', true], finance: ['Finance claims', 'claim', true] });
async function hospAct(a, el, id) {
  if (a === 'reqapproval') return approvalDialog(id);
  if (a === 'hnotesread') { await api('/api/notifications/read', { method: 'POST' }); await loadHosp(); render(); return; }
  if (a === 'hcode') { if (!confirm('Make a new join code? The current one stops working straight away.')) return; const r = await api('/api/org/code', { method: 'POST' }); if (r.error) return toast(hErr(r)); HOSP.org = r.org; render(); toast('New join code ready'); return; }
  if (a === 'hleave') { if (!confirm(`Leave ${HOSP.org.name}? Your requests and claims stay with the hospital; you can join again with a code.`)) return; const r = await api('/api/org/leave', { method: 'POST' }); if (r.error) return toast(hErr(r)); resetHosp(); await loadHosp(); render(); toast(r.deleted ? 'You were the last member, so the hospital was removed' : 'You left the hospital'); return; }
  if (a === 'apdecide') {
    const v = el.dataset.v, ta = $('#apc-' + id), comment = ta ? ta.value.trim() : '';
    if (v === 'reject' && !comment) { toast('Add a comment so the doctor knows what to change'); if (ta) ta.focus(); return; }
    el.disabled = true; const r = await api('/api/approvals/' + id, { method: 'POST', body: { action: v, comment } });
    if (r.error) { el.disabled = false; return toast(hErr(r)); }
    const x = (HOSP.pend || []).find(p => String(p.id) === String(id)); HOSP.pend = null; await loadHosp(); render();
    toast((v === 'approve' ? 'Approved: ' : 'Not approved: ') + (x ? x.doctor : '')); return;
  }
  if (a === 'teamyear') { HOSP.teamYear += +el.dataset.v; HOSP.team = null; render(); return; }
  if (a === 'setallow' || a === 'resetallow') {
    const inp = $('#al-' + id), v = a === 'resetallow' || !inp || inp.value === '' ? null : Math.round(+inp.value * 100);
    if (v !== null && !(v >= 0)) return toast('Enter an amount of 0 or more');
    const r = await api('/api/org/allowance', { method: 'POST', body: { userId: +id, year: HOSP.teamYear, allowanceCents: v } }); if (r.error) return toast(hErr(r));
    HOSP.team = null; HOSP.budget = {}; render(); toast(v === null ? 'Back to the hospital default' : 'Allowance saved'); return;
  }
  if (a === 'rmmember') { if (!confirm(`Remove ${el.dataset.v} from ${HOSP.org.name}?`)) return; const r = await api('/api/org/members/' + id, { method: 'POST', body: { action: 'remove' } }); if (r.error) return toast(hErr(r)); HOSP.team = null; render(); toast('Removed'); return; }
  if (a === 'markpaid') { if (!confirm(`Mark ${el.dataset.v}'s claim as paid? They see "Paid" in Hoggy.`)) return; el.disabled = true; const r = await api('/api/claims/' + id + '/paid', { method: 'POST' }); if (r.error) { el.disabled = false; return toast(hErr(r)); } HOSP.finance = null; await loadHosp(); render(); toast('Marked paid'); return; }
}
function wireHospSettings() {
  const on = (sel, fn) => { const f = $(sel); if (f) f.addEventListener('submit', async e => { e.preventDefault(); const b = f.querySelector('button[type=submit]'); b.disabled = true; try { await fn(new FormData(f)); } finally { if (b.isConnected) b.disabled = false; } }); };
  const done = async (r, msg) => { if (r.error) return toast(hErr(r)); await loadHosp(); render(); toast(msg); const p = $('#hosp'); if (p) p.scrollIntoView({ block: 'start' }); };
  on('#hjoin', async f => { const r = await api('/api/org/join', { method: 'POST', body: { code: String(f.get('code') || '') } }); await done(r, r.org ? 'You joined ' + r.org.name : ''); });
  on('#hnew', async f => { const r = await api('/api/org', { method: 'POST', body: { name: String(f.get('name') || ''), claimsEmail: String(f.get('claimsEmail') || ''), defaultAllowanceCents: toCents(f.get('allowance')), currency: String(f.get('currency') || S.profile.currency) } }); await done(r, 'Hospital created. Share the join code with colleagues'); });
  on('#hset', async f => { const r = await api('/api/org/settings', { method: 'POST', body: { name: String(f.get('name') || ''), claimsEmail: String(f.get('claimsEmail') || ''), defaultAllowanceCents: toCents(f.get('allowance')) } }); await done(r, 'Hospital saved'); });
}
document.addEventListener('change', async e => {
  const s = e.target.closest && e.target.closest('[data-role-user]'); if (!s) return;
  const r = await api('/api/org/members/' + s.dataset.roleUser, { method: 'POST', body: { role: s.value } });
  if (r.error) toast(hErr(r)); else toast('Role changed');
  HOSP.team = null; await loadHosp(); render();
});

/* ---------- overlays ---------- */
function openOverlay(html, center) {
  const o = $('#overlay'), wasOpen = !o.hidden, sh = o.querySelector('.sheet'), top = sh ? sh.scrollTop : 0, act = document.activeElement, actKey = act && o.contains(act) ? act.getAttribute('data-act') || act.id : '';
  o.className = 'overlay' + (center ? ' c' : '') + (wasOpen ? ' still' : ''); o.innerHTML = html;
  if (!wasOpen) { o.hidden = false; o._prev = document.activeElement; document.body.style.overflow = 'hidden'; $('.app').inert = true; const f = o.querySelector('[autofocus],button.close') || o.querySelector('.sheet [data-act=close],.sheet button,.sheet a[href],.sheet input'); f && f.focus({ preventScroll: true }); return; }
  const af = o.querySelector('[autofocus]'); if (af && !o.contains(document.activeElement)) af.focus({ preventScroll: true });
  /* re-render of an open dialog: keep scroll position and focus, no re-animation */
  const ns = o.querySelector('.sheet'); if (ns) ns.scrollTop = top;
  const back = actKey && (o.querySelector(`[data-act="${CSS.escape(actKey)}"]`) || document.getElementById(actKey)); if (back) back.focus({ preventScroll: true });
}
function closeOverlay(keepHash) { if (!keepHash && reviewHash()) history.replaceState(null, '', '#/discover'); const o = $('#overlay'); const pv = o._prev && o._prev.isConnected ? o._prev : null; o._prev = null; o.hidden = true; o.className = 'overlay'; o.innerHTML = ''; document.body.style.overflow = ''; $('.app').inert = false; if (pv) pv.focus({ preventScroll: true }); }
/* the line under "When": what Hoggy read, where, and when (B30) */
function dateNote(c) {
  const link = (u, t) => u && safeUrl(u) !== '#' ? ` · <a class="u" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(u))}">${t}</a>` : '';
  const st = dateEv(c);
  if (st === 'estimated') return 'Estimated — confirm with organiser';
  if (st === 'confirmed') return `Dates confirmed on the organiser's page · checked ${esc(fmtD(c.verifiedOn))}${link(c.datesSourceUrl, 'source page')}<span class="quote">The page said: “${esc(c.datesQuote)}”</span>`;
  return `Confirmed by organiser (source not yet re-checked)${c.lastVerified ? ' · last seen ' + esc(fmtD(c.lastVerified)) : ''}${link(c.sourceUrl, 'organiser site')}`;
}
function detail(id, fetchReviews = true) {
  const c = byId(id); if (!c) return;
  if (c.kind === 'course') return sessionSheet(c.sessionId, c);
  const on = S.saved.includes(id), trip = S.trips.find(t => t.confId === id), L = links(c), R = reviewsFor(c), sc = scoreOf(c);
  openOverlay(`<div class="sheet detail" role="dialog" aria-modal="true" aria-label="${esc(c.name)}"><div class="sheet-wrap"><span class="grab" aria-hidden="true"></span><button class="icon-btn close" data-act="close" aria-label="Close">${icon('x')}</button><div class="art">${plate(c, 'wide')}</div></div>
  <div class="body"><p class="card-when">${esc(range(c))} · ${esc(c.city)}, ${esc(c.country)}</p><h2>${esc(c.name)}</h2><p class="lede">${esc(c.blurb)}</p>
  <div class="card-meta quality" aria-label="Quality signals">${{ confirmed: '<span class="pill g">Dates confirmed</span>', unchecked: '<span class="pill" title="Confirmed before Hoggy stored the organiser\'s wording; being re-checked">Dates confirmed (not re-checked)</span>', estimated: '<span class="pill w">Dates estimated</span>' }[dateEv(c)]}${c.cpdBody && c.cpdVerified ? `<span class="pill g">Accreditation: ${esc(c.cpdBody)}</span>` : '<span class="pill w">Accreditation: confirm with organiser</span>'}${sc && sc.avg != null ? `<button type="button" class="tag" data-act="toreviews"><span class="stars" aria-hidden="true">★</span> ${sc.avg.toFixed(1)} · ${plural(sc.n, 'review')}</button>` : ''}</div>
  ${c.flagged ? '<p class="check warn">! Hoggy\'s updater noticed a change or problem on the organiser site (dead link or cancellation wording). Check the official site before booking.</p>' : ''}
  <div class="facts"><div class="fact wide"><div class="k">When</div><div class="v">${esc(range(c))}</div><div class="note">${dateNote(c)}</div></div><div class="fact"><div class="k">Where</div><div class="v">${esc(c.city)}, ${esc(c.country)}</div>${c.datesConfirmed === false ? '<div class="note">City is an estimate until the organiser confirms</div>' : ''}</div><div class="fact"><div class="k">CPD</div><div class="v">${c.cpdVerified && c.cpdHours ? esc(c.cpdHours) + ' hrs' + (c.cpdBody ? ' · ' + esc(c.cpdBody) : '') : 'Not confirmed'}</div>${c.cpdVerified && c.cpdHours ? '' : '<div class="note">Hoggy has not confirmed credits for this event. Ask the organiser before relying on it.</div>'}</div><div class="fact"><div class="k">Registration (indicative)</div><div class="v">${figPrice(c) ? 'about US$' + esc(Number(figPrice(c)).toLocaleString()) : 'Check organiser'}</div></div><div class="fact"><div class="k">Specialty</div><div class="v">${esc(c.specialty)}</div></div><div class="fact"><div class="k">${figAtt(c) ? 'Size · format' : 'Format'}</div><div class="v">${figAtt(c) ? '~' + esc(Number(figAtt(c)).toLocaleString()) + ' · ' : ''}${esc(c.format)}</div>${figAtt(c) >= 3000 ? '<div class="note">Large (3,000+)</div>' : ''}</div><div class="fact wide"><div class="k">Run by</div><div class="v">${esc(c.organiser)}</div></div></div>
  <div class="row travel"><a class="btn sm ghost" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(c.url))}">Official site ${icon('ext')}</a><a class="btn sm" target="_blank" rel="noopener noreferrer" href="${esc(L.flights)}">${icon('plane')} Flights ${icon('ext')}</a><a class="btn sm" target="_blank" rel="noopener noreferrer" href="${esc(L.hotels)}">${icon('bed')} Hotels ${icon('ext')}</a><button class="btn sm" data-act="ics" data-id="${esc(id)}">${icon('cal')} Calendar</button><button class="btn sm" data-act="leave" data-id="${esc(id)}">Request leave</button></div>
  <p class="note">Elsewhere on the web: <a class="u" target="_blank" rel="noopener noreferrer" href="https://www.google.com/search?q=${encodeURIComponent(c.name + ' ' + c.start.slice(0, 4) + ' review')}">search reviews</a> (external, not part of Hoggy's score)</p>
  ${c.listingType === 'course' ? '<p class="note">Course session listed by its organiser.</p>' : ''}<p class="note report-line"><button type="button" class="linkbtn" data-act="report" data-kind="conference" data-id="${esc(id)}">Report a problem with this listing</button> · <a class="u" href="/conferences/${esc(encodeURIComponent(id))}">Page link</a></p>
  ${reviewsSection(c, R)}${coverageSection(c)}</div>
  <div class="actbar"><button class="btn primary lg" data-act="plan" data-id="${esc(id)}" ${trip ? 'disabled' : ''}>${trip ? 'In your trips' : 'Plan trip'}</button><button class="btn lg save-btn ${on ? 'on' : ''}" data-act="save" data-id="${esc(id)}" aria-pressed="${on}">${icon('heart')} ${on ? 'Saved' : 'Save'}</button></div></div>`);
  if (NET.online && fetchReviews) loadCoverage(skey(c)).then(ok => { if (ok && !$('#overlay').hidden && $('#covsec') && $('#covsec').dataset.id === id) $('#covsec').outerHTML = coverageSection(c); });
  if (NET.online && fetchReviews) loadReviews(id).then(ok => { if (ok && !$('#overlay').hidden && $('#rvsec') && $('#rvsec').dataset.id === id) detail(id, false); }); /* fetch once per open; re-rendering with fetch again looped forever */
}
/* ---------- reviews section, review form, proof upload ---------- */
const HOW_SCORES = 'Scores cover every year of this conference. A verified review counts in full and an unverified one counts half. A score shows once there are at least 3 reviews. "Verified attendee" means a Hoggy admin has checked a registration receipt you emailed to your Hoggy address, or a certificate or receipt you uploaded.';
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
  const own = v.mine ? (v.verify === 'pending_proof' ? '<span class="pill w">Proof sent · being checked</span>' : v.verify === 'pending_receipt' ? '<span class="pill w">Emailed receipt · being checked</span>' : v.proof === 'rejected' && !v.verified ? '<span class="pill b">Proof not accepted</span>' : '') : '';
  const acts = !NET.user ? '' : v.mine ? `<div class="row rv-acts"><button class="btn sm ghost" data-act="rvedit" data-id="${esc(v.id)}" data-conf="${esc(c.id)}">Edit</button>${v.verified || v.verify === 'pending_proof' || v.verify === 'pending_receipt' ? '' : `<button class="btn sm ghost" data-act="rvproof" data-id="${esc(v.id)}" data-conf="${esc(c.id)}">Add proof</button>`}<button class="btn sm ghost danger" data-act="rvdel" data-id="${esc(v.id)}" data-conf="${esc(c.id)}">Delete</button></div>` : `<div class="row rv-acts"><button class="btn sm ghost" data-act="rvreport" data-id="${esc(v.id)}" data-conf="${esc(c.id)}">Report</button></div>`;
  return `<div class="review"><div class="who rv-who"><span>${esc(v.author)}</span> ${state}${own}<span class="stars rv-stars" aria-label="${esc(Number(v.rating).toFixed(1))} out of 5">${stars(v.rating)}</span></div><div class="note rv-ed">${esc(edLabel(v))}</div>${dims ? `<div class="note rv-dims">${esc(dims)}</div>` : ''}<p>${esc(v.text)}</p>${acts}</div>`;
}
function reviewsSection(c, R) {
  const key = skey(c), sc = scoreOf(c);
  if (!NET.online) return `<div class="section"><h3>Reviews</h3></div><p class="note">Reviews aren\u2019t available right now. Try again in a minute.</p>${R.map(v => `<div class="review"><div class="who">${esc(v.author)} <span class="pill">On this device only</span></div><p>${esc(v.text)}</p></div>`).join('')}`;
  const dimsHtml = sc && sc.avg != null ? `<div class="dimgrid wide">${DIM_LABELS.filter(([k]) => sc.dims && sc.dims[k]).map(([k, l]) => `<div class="dim"><span>${l}</span><b>${sc.dims[k].avg.toFixed(1)} <small>(${sc.dims[k].n})</small></b></div>`).join('')}</div>` : '';
  return `<section id="rvsec" data-id="${esc(c.id)}" aria-labelledby="rvh"><div class="section"><h3 id="rvh" tabindex="-1">Reviews</h3><span class="rv-score">${scoreLine(sc)}</span></div>
  ${dimsHtml}<details class="how"><summary>How scores work</summary><p class="note">${esc(HOW_SCORES)}</p></details>
  <div class="row"><button class="btn sm" data-act="review" data-id="${esc(c.id)}">Review this conference</button><button class="btn sm ghost" data-act="copy" data-v="${esc(shareLink(key))}">${icon('copy')} Copy review link</button></div>
  <p class="note">Went in an earlier year? That counts. Share the link with colleagues who attended.</p>
  ${R.length ? R.map(v => reviewItem(v, c)).join('') : '<p class="note">No reviews yet. If you have been to this conference in any year, yours can be the first.</p>'}</section>`;
}
/* ---------- "Covered in": approved journal and press links for the series (links only, never article text) ---------- */
async function loadCoverage(key) { const r = await api('/api/coverage?series=' + encodeURIComponent(key)); if (r.error || !Array.isArray(r)) return false; NET.cov[key] = r; return true; }
function coverageSection(c) {
  if (!NET.online) return '';
  const key = skey(c), L = NET.cov[key] || [];
  const items = window.HoggyCoverage ? L.map(l => window.HoggyCoverage.itemHtml(l, esc)).join('') : '';
  const suggest = `<button class="btn sm ghost" data-act="covsuggest" data-id="${esc(c.id)}">Suggest a link</button>`;
  return `<section id="covsec" class="cov" data-id="${esc(c.id)}" aria-labelledby="covh"><div class="section" style="margin-top:28px"><h2 id="covh" style="font-size:20px">Covered in</h2></div>
  ${items ? `<ul class="cov-list">${items}</ul>` : '<p class="note">No journal or press coverage listed yet.</p>'}
  <div class="row" style="margin:8px 0 0">${suggest}<span class="note" style="margin:0">Links open the publisher's site. An admin checks every suggestion first.</span></div></section>`;
}
function coverageDialog(c) {
  const T = window.HoggyCoverage.TYPES, Y = new Date().getFullYear();
  simpleDialog('Suggest a link', `<p class="note" style="margin-top:-6px">A meeting report, abstract supplement, society journal issue or news story about ${esc(seriesTitleOf(c))}. Link to the publisher's page; please don't paste article text.</p>
    ${field('cv1', 'Type', `<select id="cv1" name="type">${Object.entries(T).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select>`)}
    ${field('cv2', 'Link (https)', '<input id="cv2" type="url" name="url" required maxlength="500" placeholder="https://" inputmode="url">')}
    <div class="two">${field('cv3', 'Publication', '<input id="cv3" type="text" name="publication" required maxlength="120" placeholder="Journal, society or news outlet">')}${field('cv4', 'Year', `<input id="cv4" type="number" name="year" min="1950" max="${Y + 1}" step="1" placeholder="${Y}">`)}</div>
    ${field('cv5', 'Title (optional)', '<input id="cv5" type="text" name="title" maxlength="200">')}<p class="note" id="cverr" role="alert" style="color:var(--bad);min-height:18px"></p>`, async fd => {
    const body = { series: skey(c), type: fd.get('type'), url: String(fd.get('url') || '').trim(), publication: String(fd.get('publication') || '').trim(), year: fd.get('year') ? +fd.get('year') : null, title: String(fd.get('title') || '').trim() };
    const v = window.HoggyCoverage.validate(body); if (!v.ok) return $('#cverr').textContent = v.error;
    const r = await api('/api/coverage', { method: 'POST', body });
    if (r.error) return $('#cverr').textContent = r.error === 'offline' ? 'Can\u2019t reach Hoggy right now. Try again in a minute.' : r.error;
    toast('Thanks · an admin will check the link before it shows'); detail(c.id, false);
  }, 'Send for checking');
}
const seriesTitleOf = c => window.HoggySeries ? window.HoggySeries.seriesTitle(c) : c.name;
const GUIDE = 'Keep it honest and about the event: the programme, speakers, venue, value and CPD. Do not name or criticise individuals, and never include patient information. Reviews that break these rules are removed.';
/* open the review form for a series; signed-out visitors sign in first and come straight back */
function startReview(key, opts = {}) {
  if (!editionsOf(key).length) { toast('We could not find that conference'); return false; }
  if (!NET.online) { toast('Reviews aren\u2019t available right now. Try again in a minute.'); return false; }
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
    if (r.error) return errEl.textContent = r.error === 'offline' ? 'Can\u2019t reach Hoggy right now. Try again in a minute.' : r.error.charAt(0).toUpperCase() + r.error.slice(1) + '.';
    await refreshReviews(latest.id);
    if (ed) { toast('Review updated'); return backToConf(opts.conf || latest.id); }
    const made = (r.reviews || []).map(x => ({ ...x, seriesKey: key }));
    const need = made.filter(x => x.verify === 'none');
    if (!need.length) { toast(made.some(x => x.verify === 'pending_receipt') ? 'Review posted · an admin is checking your emailed registration receipt' : 'Review posted · verified from your emailed registration receipt'); return backToConf(latest.id); }
    proofDialog(need, { conf: latest.id, title, posted: true });
  });
}
function proofDialog(list, opts = {}) {
  openOverlay(`<div class="sheet center rv-sheet" role="dialog" aria-modal="true" aria-label="Add proof of attendance"><div style="padding:22px"><div class="row" style="justify-content:space-between;align-items:flex-start;flex-wrap:nowrap;margin-bottom:10px"><h2 style="font-size:24px;margin:0">${opts.posted ? 'Thanks, your review is up' : 'Add proof of attendance'}</h2><button type="button" class="icon-btn" style="flex:none" data-act="close" aria-label="Close">${icon('x')}</button></div>
  <p style="color:var(--muted);font-size:14px">${opts.posted ? 'It shows as “Attended (not verified)” for now. ' : ''}Upload a certificate of attendance, CPD certificate or registration receipt and a Hoggy admin will check it. Once approved, your review shows “✓ Verified attendee”.</p>
  <p class="note">PDF, JPG or PNG, up to 5 MB. Only Hoggy admins can open it, and it is deleted once checked. Cover anything you do not want seen, such as your registration number. You can also email your registration receipt to your Hoggy address and an admin will check that instead.</p>
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
async function refreshReviews(confId) { NET.top = {}; await Promise.all([confId ? loadReviews(confId) : null, loadRatings(), loadMine(), loadTop('')]); }
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
  <div class="two">${field('rv12', 'Supplier ABN (Australian receipts)', `<input id="rv12" type="text" name="abn" inputmode="numeric" maxlength="20" autocomplete="off" value="${esc(v.abn ? HP().fmtAbn(v.abn) : '')}">`)}${field('rv13', 'GST included', `<input id="rv13" type="number" step="0.01" min="0" name="gst" value="${esc(v.gst ?? '')}">`)}</div>
  <label class="tick"><input type="checkbox" name="taxInvoice" ${v.taxInvoice ? 'checked' : ''}> The document says “Tax invoice”</label>
  ${field('rv8', 'Exchange rate to ' + S.profile.currency + ' (only for foreign currency)', `<input id="rv8" type="number" step="0.0001" min="0" name="fxRate" value="${esc(v.fxRate || '')}">`)}
  <div class="two">${field('rv9', 'Nights (accommodation)', `<input id="rv9" type="number" min="0" step="1" name="nights" value="${esc(v.nights || '')}">`)}${field('rv10', 'Personal portion to exclude', `<input id="rv10" type="number" min="0" step="0.01" name="personal" value="${esc(v.personal || '')}">`)}</div>
  ${field('rv11', 'Justification for exceeding policy (only if over a limit)', `<input id="rv11" type="text" name="excuse" maxlength="200" value="${esc(v.excuse || '')}">`)}
  ${field('rv7', 'Note (optional)', `<input id="rv7" type="text" name="note" maxlength="200" value="${esc(v.note || '')}">`)}
  ${files.length ? `<p class="note">${files.length} file${files.length > 1 ? 's' : ''} ready: ${esc(files.map(f => f.name).join(', '))}</p>` : ''}
  <div class="row" style="justify-content:space-between;margin:6px 0 20px"><span>${ed ? `<button type="button" class="btn danger" data-act="rmreceipt" data-id="${esc(ed.id)}">Delete</button>` : ''}</span><button class="btn primary" type="submit" autofocus>Save receipt</button></div></form></div>`, true);
  const form = $('#rf'); let pending = files.slice();
  if (!ed) {
    const fi = $('#rfile'); fi.addEventListener('change', () => { pending = [...fi.files]; });
    $('#parse').addEventListener('click', () => { const p = parseReceipt($('#rtext').value); if (!p.amount && !p.vendor) return $('#pmsg').textContent = 'Nothing recognised — fill in manually.'; if (p.vendor) form.vendor.value = p.vendor; if (p.amount) form.amount.value = p.amount; if (p.currency) form.currency.value = p.currency; if (p.date) form.date.value = p.date; form.category.value = p.category; if (p.abn) form.abn.value = HP().fmtAbn(p.abn); if (p.gst != null) form.gst.value = p.gst; form.taxInvoice.checked = !!p.taxInvoice; $('#pmsg').textContent = 'Filled in — check it looks right.'; });
    if (files.length) { const n = files[0].name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '); form.vendor.value = n.slice(0, 60); form.date.value = today(); }
  }
  form.addEventListener('submit', async e => { e.preventDefault(); const f = new FormData(form), base = { vendor: String(f.get('vendor')).trim().slice(0, 80), category: f.get('category'), amount: Math.round((+f.get('amount') || 0) * 100) / 100, currency: String(f.get('currency') || S.profile.currency).toUpperCase().slice(0, 3), fxRate: +f.get('fxRate') || 0, excuse: String(f.get('excuse') || '').trim().slice(0, 200), nights: Math.max(0, Math.round(+f.get('nights') || 0)), personal: Math.max(0, +f.get('personal') || 0), date: f.get('date'), tripId: f.get('tripId'), note: String(f.get('note') || '').slice(0, 200), ...taxFields(f) };
    if (ed) { Object.assign(ed, base); }
    else { const list = pending.length ? pending : [null]; for (const file of list) { const r = { id: uid(), ...base, status: 'captured', created: Date.now() }; if (file && !['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { toast(file.name + ': only PDF, JPG, PNG or WebP are supported. For iPhone HEIC photos, share as JPG or take a screenshot'); continue; }
      if (file) { if (file.size > 15e6) { toast(file.name + ' is over 15 MB, skipped'); continue; } r.fileKey = 'f-' + r.id; r.fileName = file.name; try { await putFile(r.fileKey, file, file.name); } catch (er) { delete r.fileKey; toast('Could not store file'); } } else if (!$('#rtext').value.trim()) { /* manual entry, no file */ } else { r.fileKey = 't-' + r.id; r.fileName = 'forwarded-email.txt'; try { await putFile(r.fileKey, new Blob([$('#rtext').value.slice(0, 20000)], { type: 'text/plain' }), r.fileName); } catch (er) { delete r.fileKey; } } S.receipts.push(r); } }
    save(); closeOverlay(); toast('Receipt saved'); render(); });
}
/* ABN, GST and "tax invoice" from a receipt form (blank ABN or GST = not on the receipt) */
const taxFields = f => { const abn = String(f.get('abn') || '').replace(/[^\d]/g, '').slice(0, 11), g = String(f.get('gst') || '').trim(); return { abn, gst: g === '' ? null : Math.max(0, Math.round(+g * 100) / 100 || 0), taxInvoice: f.get('taxInvoice') === 'on' }; };
function claimWarn(t, rs) {
  const miss = HP().missingOf(tripChecklist(t)), fl = rs.filter(r => HP().taxFlags(r).some(x => x.code !== 'no-abn-small'));
  if (!miss.length && !fl.length) return '';
  return `<div class="claim-warn" role="note" data-testid="claim-warn">${miss.length ? `<p><b>Missing receipts:</b> ${esc(miss.map(i => i.label).join(', '))}. You can still send the claim. Add the receipt, or tap “I don't have this receipt” and say why: the reason goes on the schedule.</p>` : ''}${fl.length ? `<p><b>May not count as a tax invoice:</b> ${esc(fl.map(r => r.vendor || r.category).join(', '))}. This is listed on the schedule; see the note on each receipt.</p>` : ''}</div>`;
}

/* ---------- Snap receipt: photo or PDF -> "Check this receipt" card -> "Looks right" saves it ----------
   Signed in and online, the file goes to /api/receipts/read (Claude when the server has a key, else the PDF text parser).
   Offline or signed out the photo is still saved with the receipt; there is just no automatic reading. */
const SNAP_STORE = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const snapBtn = (tripId, big) => `<label class="btn ${big ? 'primary' : 'sm'} snap-btn">${icon('receipt')} Snap receipt<input type="file" class="snap-in" data-snap="${esc(tripId || '')}" accept="image/*,application/pdf" capture="environment" aria-label="Snap receipt${tripId ? ' for this trip' : ''}"></label>`;
const isHeic = f => /^image\/hei[cf]$/i.test(f.type || '') || /\.hei[cf]$/i.test(f.name || '');
/* re-encode a photo as JPEG, at most `max` px on the long side (smaller upload; also turns HEIC into JPEG where the browser can decode it) */
async function toJpeg(file, max) {
  const bmp = await createImageBitmap(file), k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k)); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); if (bmp.close) bmp.close();
  const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85)); if (!b) throw new Error('encode failed'); return b;
}
/* a trip whose dates fit the receipt date (bookings are often made months before) */
const suggestTrip = d => { if (!d) return ''; const fit = S.trips.filter(t => { const c = ofTrip(t); return c && d >= addDays(c.start, -270) && d <= addDays(c.end, 7); }); return fit.length === 1 ? fit[0].id : ''; };
const addDays = (iso, n) => { const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
async function snapDialog(file, tripId) {
  let store = file, name = file.name || 'receipt';
  if (isHeic(file)) { try { store = await toJpeg(file, 3000); name = name.replace(/\.[^.]+$/, '') + '.jpg'; } catch (e) { return toast('This HEIC photo cannot be opened here. Share it as JPG, or take a screenshot of it.'); } }
  else if (!SNAP_STORE.includes(file.type)) return toast((file.name || 'That file') + ': use a JPG, PNG or WebP photo, or a PDF.');
  if (store.size > 15e6) return toast((file.name || 'That file') + ' is over 15 MB.');
  const preview = /^image\//.test(store.type) ? URL.createObjectURL(store) : '', tripOpts = `<option value="">— choose trip —</option>` + S.trips.map(t => `<option value="${esc(t.id)}" ${tripId === t.id ? 'selected' : ''}>${esc(ofTrip(t).name)}</option>`).join('');
  openOverlay(`<div class="sheet center" role="dialog" aria-modal="true" aria-labelledby="scH"><form id="scf" class="snap-card" style="padding:22px" data-testid="snap-card"><div class="row" style="justify-content:space-between;margin-bottom:10px"><h2 id="scH" style="font-size:24px;margin:0">Check this receipt</h2><button type="button" class="icon-btn" data-act="close" aria-label="Close">${icon('x')}</button></div>
    <div class="snap-top">${preview ? `<img class="snap-prev" alt="Your receipt photo" src="${preview}">` : `<div class="snap-prev pdf">${icon('file')}<span>${esc(name)}</span></div>`}<div class="grow"><p class="snap-msg" id="scmsg" role="status" aria-live="polite">${!NET.online ? 'You are offline, so Hoggy cannot read it now. Fill in the details; the file is saved with the receipt.' : !NET.user ? 'Sign in to have Hoggy read receipts for you. For now, fill in the details; the file is saved with the receipt.' : 'Reading the receipt…'}</p><p class="note" id="scsrc"></p></div></div>
    <div class="two">${field('sc1', 'Supplier', '<input id="sc1" type="text" name="vendor" required maxlength="80" autocomplete="off">')}${field('sc2', 'Category', `<select id="sc2" name="category">${CATS.map(k => `<option>${k}</option>`).join('')}</select>`)}</div>
    <div class="two">${field('sc3', 'Total', '<input id="sc3" type="number" step="0.01" min="0" name="amount" required inputmode="decimal">')}${field('sc4', 'Currency', `<input id="sc4" type="text" name="currency" maxlength="3" value="${esc(S.profile.currency)}" autocapitalize="characters">`)}</div>
    <div class="two">${field('sc5', 'Date', '<input id="sc5" type="date" name="date" required>')}${field('sc6', 'Trip', `<select id="sc6" name="tripId">${tripOpts}</select>`)}</div>
    <div class="two">${field('sc7', 'Supplier ABN', '<input id="sc7" type="text" name="abn" inputmode="numeric" maxlength="20" autocomplete="off">')}${field('sc8', 'GST included', '<input id="sc8" type="number" step="0.01" min="0" name="gst" inputmode="decimal">')}</div>
    <label class="tick"><input type="checkbox" name="taxInvoice" id="sc9"> The document says “Tax invoice”</label>
    <div class="field" id="scfx" hidden><label for="sc10">Exchange rate to ${esc(S.profile.currency)}</label><input id="sc10" type="number" step="0.0001" min="0" name="fxRate"></div>
    <div id="scflags" aria-live="polite"></div>
    <div class="row" style="justify-content:flex-end;margin:10px 0 6px"><button class="btn primary" type="submit" id="scok">Looks right</button></div></form></div>`, true);
  const form = $('#scf'), touched = new Set();
  const flags = () => { const f = new FormData(form), r = { category: f.get('category'), amount: +f.get('amount') || 0, currency: String(f.get('currency') || '').toUpperCase(), ...taxFields(f) }; $('#scfx').hidden = !r.currency || r.currency === S.profile.currency; $('#scflags').innerHTML = taxHtml(r); };
  form.addEventListener('input', e => { if (e.target.name) touched.add(e.target.name); flags(); });
  form.addEventListener('change', flags); flags();
  const put = (k, v) => { if (v == null || v === '' || touched.has(k)) return; const el = form.elements[k]; if (el.type === 'checkbox') el.checked = !!v; else el.value = v; };
  if (NET.online && NET.user) (async () => {
    let body = store; if (/^image\//.test(store.type)) { try { body = await toJpeg(store, 2000); } catch (e) { body = store; } }
    let r = { error: 'skip' };
    if (body.size <= (body.type === 'application/pdf' ? 10e6 : 5e6)) { try { const res = await fetch('/api/receipts/read?cur=' + encodeURIComponent(S.profile.currency), { method: 'POST', headers: { ...RH, 'Content-Type': body.type }, credentials: 'same-origin', body }); r = await res.json().catch(() => ({ error: 'bad' })); if (!res.ok) r.error = r.error || 'failed'; } catch (e) { r = { error: 'offline' }; } }
    if (!form.isConnected) return;
    if (r.error) { $('#scmsg').textContent = r.error === 'offline' ? 'Could not reach Hoggy, so the receipt was not read. Fill in the details.' : r.error === 'skip' ? 'This file is too large to read. Fill in the details.' : r.error; return; }
    put('vendor', r.supplierName); if (r.category && r.category !== 'Other') put('category', r.category); put('amount', r.totalCents != null ? (r.totalCents / 100).toFixed(2) : ''); put('currency', r.currency);
    put('date', r.date); put('abn', r.supplierAbn ? HP().fmtAbn(r.supplierAbn) : ''); put('gst', r.gstCents != null ? (r.gstCents / 100).toFixed(2) : ''); put('taxInvoice', r.isTaxInvoice === true);
    if (!tripId && !touched.has('tripId')) put('tripId', suggestTrip(r.date));
    form.dataset.source = r.source; form.dataset.confidence = r.confidence;
    $('#scmsg').textContent = r.note || 'Check every field.';
    $('#scsrc').innerHTML = r.source === 'none' ? '' : `<span class="pill ${r.confidence === 'high' ? 'g' : r.confidence === 'medium' ? '' : 'w'}" data-testid="snap-confidence">${r.confidence === 'high' ? 'High' : r.confidence === 'medium' ? 'Medium' : 'Low'} confidence</span>`;
    flags();
  })();
  form.addEventListener('submit', async e => {
    e.preventDefault(); const f = new FormData(form), cur = String(f.get('currency') || S.profile.currency).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || S.profile.currency;
    const r = { id: uid(), vendor: String(f.get('vendor')).trim().slice(0, 80), category: f.get('category'), amount: Math.round((+f.get('amount') || 0) * 100) / 100, currency: cur, fxRate: cur === S.profile.currency ? 0 : +f.get('fxRate') || 0, date: f.get('date'), tripId: f.get('tripId'), note: '', excuse: '', nights: 0, personal: 0, ...taxFields(f), status: 'captured', created: Date.now(), read: { source: form.dataset.source || 'none', confidence: form.dataset.confidence || 'low' } };
    $('#scok').disabled = true;
    r.fileKey = 'f-' + r.id; r.fileName = name;
    try { await putFile(r.fileKey, store, name); } catch (er) { delete r.fileKey; delete r.fileName; toast('Could not store the file on this device'); }
    S.receipts.push(r); save(); if (preview) URL.revokeObjectURL(preview); closeOverlay(); toast('Receipt saved'); render();
  });
}
document.addEventListener('change', e => { const i = e.target; if (!i || !i.matches || !i.matches('input[data-snap]')) return; const f = i.files && i.files[0], tid = i.dataset.snap; i.value = ''; if (f) snapDialog(f, tid && S.trips.some(t => t.id === tid) ? tid : ''); });
function noReceiptDialog(tripId, key) {
  const t = S.trips.find(x => x.id === tripId), it = t && tripChecklist(t).find(i => i.key === key); if (!it) return;
  simpleDialog(`No ${it.label.toLowerCase()} receipt`, `<p class="note" style="margin:0 0 12px">Say why you don't have it. The reason is printed on the claim pack schedule so your claims admin sees it.</p>${field('nr1', 'Reason', '<textarea id="nr1" name="reason" rows="3" required minlength="3" maxlength="300" placeholder="For example: registration was paid by the department"></textarea>')}`, f => {
    const reason = String(f.get('reason') || '').trim().slice(0, 300); if (reason.length < 3) return toast('Add a reason');
    const c = S.claims[tripId] = { ...(S.claims[tripId] || {}) }; c.waived = { ...(c.waived || {}), [key]: { reason, date: today() } }; save(); closeOverlay(); render();
  }, 'Save reason');
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
    fx.length ? `Foreign-currency items use the exchange rates I entered in the schedule (${[...new Set(fx.map(r => r.currency))].join(', ')} to ${S.profile.currency}). ${currencyLine(rs)}` : '',
    (() => { const n = HP().packNotes(tripChecklist(t), rs); return n.lines.length ? '\n' + n.lines.join('\n') : ''; })(),
    notes.length ? '\nNotes on individual items:\n' + notes.map(r => `- ${r.vendor || r.category}: ${r.note}`).join('\n') : '',
    (() => { const ex = policyFor(t, rs); return ex.length ? '\nItems over a policy limit, with my justification:\n' + ex.map(i => `- ${i.t}${(rs.find(r => r.id === i.id) || {}).excuse ? ' Justification: ' + rs.find(r => r.id === i.id).excuse : ''}`).join('\n') : ''; })(),
    rs.some(r => +r.personal) ? '\nPersonal portions have been excluded from the amounts above and are shown in the schedule.' : '',
    '', 'Regards,', S.profile.name || ''].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
}
const claimSubject = (t) => { const c = ofTrip(t), e = EMP(); return `Expense claim - ${S.profile.name || 'Clinician'}${e.employeeId ? ' - ' + e.employeeId : ''} - ${c.name} - ${range(c)}`; };
async function emailPack(t) {
  const e = EMP(), to = claimsTo(); if (!to) { toast('Add your claims admin email under Settings > Your employer first'); location.hash = '#/settings'; return; }
  const c = ofTrip(t), rs = S.receipts.filter(r => r.tripId === t.id).sort((a, b) => (a.date || '').localeCompare(b.date || '')), atts = [], missing = []; let size = 0;
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i], b = r.fileKey && await getFile(r.fileKey); if (!b) { missing.push(r.vendor || 'receipt'); continue; }
    const u8 = new Uint8Array(await b.arrayBuffer()); size += u8.length;
    const ext = ((r.fileName || '').match(/\.[a-z0-9]{2,5}$/i) || [''])[0] || ({ 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[b.type] || '.txt');
    atts.push({ name: `R${i + 1}-${r.vendor || 'receipt'}-${r.date || ''}${ext}`, type: b.type || 'application/octet-stream', data: u8 });
  }
  if (missing.length) return toast('Cannot build the pack: file missing for ' + missing.join(', '));
  atts.unshift({ name: 'claim-schedule.csv', type: 'text/csv', data: new TextEncoder().encode(scheduleCsv(t, true)) });
  const eml = window.HoggyPack.buildEml({ to, subject: claimSubject(t), body: claimBody(t, rs), attachments: atts });
  download(`claim-${c.id}.eml`, eml, 'message/rfc822');
  toast(size > 20e6 ? `Pack is ${(size / 1e6).toFixed(0)} MB. Many mail systems reject over 20 MB, so check before sending.` : 'Open the downloaded .eml in Outlook or Apple Mail. It opens as a draft to ' + to + '. Send it, then press Mark submitted.');
}
function mailtoPack(t) {
  const e = EMP(), rs = S.receipts.filter(r => r.tripId === t.id).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  download(`claim-${ofTrip(t).id}.csv`, scheduleCsv(t, true));
  location.href = 'mailto:' + encodeURIComponent(claimsTo()) + '?subject=' + encodeURIComponent(claimSubject(t)) + '&body=' + encodeURIComponent(claimBody(t, rs).slice(0, 1500) + '\n\n[Attach the downloaded schedule and your receipt files before sending.]');
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
      S.leave = S.leave || {}; S.leave[c.id] = { drafted: today(), total, est: { flights: n('fl'), accommodation: n('ac'), registration: n('rg'), other: n('ot') } }; save(); closeOverlay(); toast('Draft downloaded. Open it in your mail app, check it and send.');
    }, 'Create email draft');
}

/* ---------- claim pack ---------- */
const CLAIM_HEAD = () => ['Date', 'Vendor', 'Category', 'Amount', 'Currency', 'FX rate', 'Claimed (' + S.profile.currency + ')', 'Personal portion excluded', 'Nights', 'Note', 'Policy check', 'Policy clause', 'File', 'Conference', 'Supplier ABN', 'GST', 'Tax invoice check'];
const tripReceipts = t => S.receipts.filter(r => r.tripId === t.id).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
/* what the schedule adds under the receipt lines: receipts the doctor does not have (with the reason) and tax-invoice flags */
const notesOf = t => HP().packNotes(tripChecklist(t), tripReceipts(t));
const scheduleCsv = (t, refs) => { const n = notesOf(t), head = refs ? ['Ref', ...CLAIM_HEAD()] : CLAIM_HEAD(), rows = claimRows(t).map((row, i) => refs ? ['R' + (i + 1), ...row] : row); return csv([head, ...rows, ...(n.csvRows.length ? [[], ['Schedule notes'], ...n.csvRows] : [])]); };
function claimRows(t) {
  const c = ofTrip(t), rs = S.receipts.filter(r => r.tripId === t.id).sort((a, b) => (a.date || '').localeCompare(b.date || '')), pol = policyFor(t, rs), e = EMP(), lim = !!(e.hotelPerNight || e.mealsPerDay || Object.values(S.profile.caps || {}).some(Boolean));
  return rs.map(r => { const p = pol.filter(i => i.id === r.id); return [r.date, r.vendor, r.category, r.amount, r.currency, r.fxRate || '', Math.round(claimAmt(r) * 100) / 100, r.personal || '', r.nights || '', r.note || '', p.length ? 'OVER LIMIT, justified: ' + (r.excuse || '') : (lim ? 'Within limits entered' : 'No limits entered'), p.length ? (e.clause || '') : '', r.fileName || '', c.name, r.abn ? HP().fmtAbn(r.abn) : '', r.gst ?? '', HP().taxFlags(r).map(x => x.t).join('; ') || ((r.currency || 'AUD') === 'AUD' ? 'OK' : 'Not checked (not AUD)')]; });
}
function printPack(t) {
  const c = ofTrip(t), rs = S.receipts.filter(r => r.tripId === t.id).sort((a, b) => (a.date || '').localeCompare(b.date || '')), tot = rs.reduce((a, r) => a + claimAmt(r), 0);
  let html = '';
  const w = { document: { write: s => { html += s; }, close() { } } };
  const rows = rs.map((r, i) => `<tr><td>R${i + 1}</td><td>${esc(r.date)}</td><td>${esc(r.vendor)}</td><td>${esc(r.category)}</td><td>${esc([r.note, r.personal ? 'Personal portion ' + money(r.personal) + ' excluded' : '', r.excuse ? 'Over limit, justified: ' + r.excuse : ''].filter(Boolean).join('. '))}</td><td style="text-align:right">${esc(money(claimAmt(r)))}${r.currency !== S.profile.currency ? ' (' + esc(money(r.amount, r.currency)) + ' @ ' + esc(r.fxRate) + ')' : ''}</td></tr>`).join('');
  w.document.write(`<!doctype html><meta charset="utf-8"><title>Expense claim — ${esc(c.name)}</title><style>body{font:14px/1.5 -apple-system,Segoe UI,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#111}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}h1{margin:0}.t{font-size:22px;font-weight:700;text-align:right;margin-top:16px}</style><h1>Expense claim</h1><p>${esc(S.profile.name || 'Clinician')} · ${esc(c.name)}, ${esc(c.city)} · ${esc(range(c))}<br>Prepared with Hoggy on ${esc(fmtD(today()))}. ${rs.length} receipt${rs.length > 1 ? 's' : ''}. The receipt files are sent separately, numbered R1 to R${rs.length} in date order.</p><table><tr><th>Ref</th><th>Date</th><th>Vendor</th><th>Category</th><th>Note</th><th style="text-align:right">Amount</th></tr>${rows}</table><div class="t">Total ${esc(money(tot))}</div>${currencyLine(rs) ? `<p>${esc(currencyLine(rs))}</p>` : ''}${(() => { const n = HP().packNotes(tripChecklist(t), rs); return (n.missing.length ? `<h2>Receipts not attached</h2><table><tr><th>Receipt</th><th>Reason</th></tr>${n.missing.map(i => `<tr><td>${esc(i.label)}</td><td>${esc(i.status === 'waived' ? i.reason : 'Not added yet (no reason given)')}</td></tr>`).join('')}</table>` : '') + (n.flagged.length ? `<h2>Tax invoice check</h2><table><tr><th>Ref</th><th>Vendor</th><th>Note</th></tr>${n.flagged.map(x => `<tr><td>${esc(x.ref)}</td><td>${esc(x.vendor)}</td><td>${esc(x.flags.map(f => f.t).join('; '))}</td></tr>`).join('')}</table>` : ''); })()}`);
  const f = document.createElement('iframe'); f.setAttribute('sandbox', 'allow-same-origin allow-modals'); f.style.cssText = 'position:fixed;width:0;height:0;border:0'; f.srcdoc = html;
  f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast('Print failed — use Export CSV'); } setTimeout(() => f.remove(), 3000); };
  document.body.appendChild(f);
}


/* ---------- backend: auth, sync, shared reviews, inbox ---------- */
async function api(path, o = {}) {
  try {
    const r = await fetch(path, { method: o.method || 'GET', headers: { 'X-Requested-With': 'hoggy', ...(o.body ? { 'Content-Type': 'application/json' } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined, credentials: 'same-origin' });
    const ct = r.headers.get('content-type') || '';
    if (r.status >= 500) noteTrouble(true); else if (r.ok && NET.trouble && NET.online) noteTrouble(false);
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
  return { ...d, ...srv, ...loc, trips: by(srv.trips, loc.trips), receipts: by(srv.receipts, loc.receipts), cpd: by(srv.cpd, loc.cpd), certs: by(srv.certs, loc.certs), saved: [...new Set([...(srv.saved || []), ...(loc.saved || [])])], claims: { ...(srv.claims || {}), ...(loc.claims || {}) }, leave: { ...(srv.leave || {}), ...(loc.leave || {}) }, profile: { ...d.profile, ...(srv.profile || {}), ...(loc.profile || {}), caps: { ...(srv.profile || {}).caps, ...(loc.profile || {}).caps }, employer: { ...((srv.profile || {}).employer || {}), ...((loc.profile || {}).employer || {}) } } };
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
  const hasLocal = !!(S.trips.length || S.receipts.length || S.cpd.length || (S.certs || []).length), me = String(NET.user.id), owner = getOwner();
  const adopt = st => { const d = defaults(), keep = (S.profile || {}).employer || {}; S = { ...d, ...st, reviews: S.reviews, profile: { ...d.profile, ...(st.profile || {}), caps: { ...((st.profile || {}).caps || {}) }, employer: { ...((st.profile || {}).employer || {}), ...(owner === me ? keep : {}) } } }; S.trips = S.trips.filter(keepTrip); if (hasLegacyCaps(S.profile.caps)) S.profile.caps = {}; if (migrateSpecialty(S.profile)) scheduleSync(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };
  if (owner && owner !== me && hasLocal) { /* another person's data is on this browser: never push it into this account */
    await DB.wipe(); FILES.clear(); UNSAVED.clear(); const th = (S.profile || {}).theme; S = defaults(); if (th) S.profile.theme = th;
    if (r.state) adopt(r.state); else try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { }
    setOwner(me); NET.rev = r.rev; render(); return;
  }
  if (!owner && hasLocal && r.state && !force) { /* guest data made before signing in: ask, do not assume */
    if (confirm('This device has trips or receipts you added before signing in.\n\nOK = add them to your account.\nCancel = remove them from this device and use your account data.')) { S = mergeState(r.state, S); S.trips = S.trips.filter(keepTrip); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } NET.rev = r.rev; setOwner(me); await pushState(); render(); return; }
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
  const r = await api('/api/conferences');
  if (!r.error && Array.isArray(r.conferences) && r.conferences.length >= 10) { CONFS.length = 0; r.conferences.forEach(c => CONFS.push(c)); NET.confUpdated = r.updated; if (r.fallback) noteTrouble(true); }
  if (DEEP.wait) { const f = DEEP.wait; DEEP.wait = null; f(); }
}
/* courses: the catalogue with per-course counts first; a course's sessions when a page needs them. A static host (no API) gets the
   bundled files whole, and the counts are worked out here. */
async function loadStaticCourses() {
  try {
    const [a, b] = await Promise.all(['data/courses/catalogue.json', 'data/courses/sessions.json'].map(u => fetch(u, { credentials: 'same-origin' }).then(x => x.ok ? x.json() : null)));
    if (!a || !b) return false;
    Object.assign(COURSES, { cat: { generated: a.generated, courses: a.courses }, sessions: HC.upcomingSessions(b.sessions, today()), full: true, loaded: true });
    COURSES.summary = HC.courseSummary(COURSES.sessions, today()); return true;
  } catch (e) { return false; }
}
function ensureSessions(id) {
  if (!id || haveSessions(id)) return Promise.resolve(true);
  if (COURSES.pending.has(id)) return COURSES.pending.get(id);
  const p = api('/api/courses?course=' + encodeURIComponent(id)).then(async r => {
    if (r.error || !Array.isArray(r.sessions)) return (await loadStaticCourses()) && COURSES.full;
    COURSES.sessions = HC.upcomingSessions(COURSES.sessions.filter(s => s.courseId !== id).concat(r.sessions), today()); COURSES.have.add(id); return true;
  }).finally(() => COURSES.pending.delete(id));
  COURSES.pending.set(id, p); return p;
}
/* load what the current page shows, then redraw once */
function needSessions(ids) {
  const want = [...new Set(ids.filter(id => id && !haveSessions(id)))]; if (!want.length || !COURSES.loaded) return;
  Promise.all(want.map(ensureSessions)).then(() => { if (['courses', 'certs'].includes(route())) bgRender(); });
}
async function loadCourses() {
  const r = await api('/api/courses');
  if (r.error || !Array.isArray(r.courses) || !r.summary) { if (!(await loadStaticCourses())) return; }
  else Object.assign(COURSES, { cat: { generated: r.generated, courses: r.courses }, summary: r.summary, loaded: true });
  if (['courses', 'certs', 'discover'].includes(route())) bgRender(); else renderNav();
}
async function boot() {
  if (NET.booting) return; NET.booting = true;
  try { await boot0(); } finally { NET.booting = false; }
}
async function boot0() {
  if (!COURSES.loaded) loadCourses();
  await loadConferences();
  const me = await api('/api/me');
  if (me.error) { NET.online = false; if (me.status >= 500) noteTrouble(true); renderAcct(); syncFiles(); bgRender(); return; }
  NET.online = true; NET.user = me.user; noteTrouble(false); await Promise.all([loadRatings(), loadTop('')]);
  if (NET.user) { await pullState(); await pullInbox(); await loadMine(); await loadHosp(); }
  if (!NET.timer) NET.timer = setInterval(() => { if (NET.user) { pullInbox(); refreshHosp(); } }, 60000);
  syncFiles();
  NET.booted = true; openReviewLink();
  if (window.__capsCleared) { window.__capsCleared = false; toast('Old default spending caps were removed. Enter your own policy limits in Settings if your employer sets them.'); }
  bgRender();
}
/* Sign in / create account. Password rule shown next to the field; errors say what to do next. */
const PW_MIN = 10;
/* the places a profile can say it is in: the conference list's own country spellings, Australia and New Zealand first */
const COUNTRY_LIST = () => { const m = window.HoggyListings ? HoggyListings.countryMap(CONFS) : {}; const L = Object.entries(m).map(([code, v]) => ({ code, name: v.name })).sort((a, b) => a.name.localeCompare(b.name)); return [...L.filter(x => x.code === 'AU' || x.code === 'NZ'), ...L.filter(x => x.code !== 'AU' && x.code !== 'NZ')]; };
const NZ_REGIONS = ['Auckland', 'Wellington', 'Nelson', 'Canterbury', 'Otago', 'Waikato'];
const regionField = (country, cur, id) => { const L = country === 'Australia' ? HC.STATES_AU : country === 'New Zealand' ? NZ_REGIONS : null; return L ? field(id, country === 'Australia' ? 'State or territory' : 'Region', `<select id="${id}" name="region"><option value="">Choose…</option>${L.map(r => `<option ${r === cur ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>`) : ''; };
function authDialog(title, then, opts = {}) {
  if (NET.trouble && !NET.online) return openOverlay(`<div class="sheet center" role="dialog" aria-modal="true" aria-labelledby="atH"><div style="padding:22px"><div class="row" style="justify-content:space-between;margin-bottom:12px"><h2 id="atH" style="font-size:22px;margin:0">Sign-in is unavailable right now</h2><button type="button" class="icon-btn" data-act="close" aria-label="Close" autofocus>${icon('x')}</button></div><p style="color:var(--muted)">${TROUBLE} Your trips and receipts on this device are safe, and you can still browse conferences and courses.</p><div class="row" style="margin:18px 0 4px;justify-content:flex-end"><button class="btn" data-act="close">Close</button><button class="btn primary" data-act="retry">Try again</button></div></div></div>`, true);
  let mode = opts.mode || 'login', email = '', msg = '', offerSignin = false;
  const prof = { name: S.profile.name || '', specialty: S.profile.specialty, country: S.profile.country, region: S.profile.region || '' };
  const specs = window.HoggySpecialties ? HoggySpecialties.DATA.canonical : [...new Set(CONFS.map(c => c.specialty))].sort();
  const draw = () => { const reg = mode === 'register'; openOverlay(`<div class="sheet center" role="dialog" aria-modal="true" aria-labelledby="afH"><form id="af" novalidate style="padding:22px"><div class="row" style="justify-content:space-between;margin-bottom:14px"><h2 id="afH" style="font-size:24px;margin:0">${esc(title || (reg ? 'Create your account' : 'Welcome back'))}</h2><button type="button" class="icon-btn" data-act="close" aria-label="Close">${icon('x')}</button></div>
    ${reg ? `<p class="note" style="margin:-6px 0 14px">Your specialty and location set what Hoggy shows first: conferences in your field and courses near you.</p>` : ''}
    ${reg ? field('au1', 'Name', `<input id="au1" type="text" name="name" maxlength="80" autocomplete="name" value="${esc(prof.name)}">`) : ''}${field('au2', 'Email', `<input id="au2" type="email" name="email" required maxlength="254" autocomplete="email" inputmode="email" value="${esc(email)}"${reg ? '' : ' autofocus'}>`)}
    <div class="field"><label for="au3">Password</label><input id="au3" type="password" name="password" required maxlength="200" autocomplete="${reg ? 'new-password' : 'current-password'}"${reg ? ` minlength="${PW_MIN}" aria-describedby="au3h"` : ''}>${reg ? `<p class="note field-hint" id="au3h">At least ${PW_MIN} characters</p>` : ''}</div>
    ${reg ? `${field('au4', 'Specialty', `<select id="au4" name="specialty">${specs.map(x => `<option ${x === prof.specialty ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`)}<div class="two">${field('au5', 'Country', `<select id="au5" name="country">${COUNTRY_LIST().map(x => `<option ${x.name === prof.country ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`)}<div id="au6w">${regionField(prof.country, prof.region, 'au6')}</div></div>` : ''}
    <p class="note" id="aerr" role="alert" style="color:var(--bad);min-height:18px">${esc(msg)}${offerSignin ? ' <button type="button" class="btn ghost sm" id="ato">Sign in instead</button>' : ''}</p><div class="row" style="justify-content:space-between;margin:6px 0 20px"><button type="button" class="btn ghost sm" id="amode">${reg ? 'I have an account' : 'Create account'}</button><button class="btn primary" type="submit" id="asub">${reg ? 'Create account' : 'Sign in'}</button></div></form></div>`, true);
    const pwIn = $('#au3'), hint = $('#au3h');
    const keepProf = () => { if (!$('#au4')) return; prof.name = $('#au1').value; prof.specialty = $('#au4').value; prof.country = $('#au5').value; prof.region = $('#au6') ? $('#au6').value : ''; };
    if ($('#au5')) $('#au5').addEventListener('change', () => { keepProf(); prof.region = ''; $('#au6w').innerHTML = regionField(prof.country, '', 'au6'); });
    if (reg && !opts.focused) { opts.focused = true; $('#au1').focus(); }
    const swap = (m, keepMsg) => { keepProf(); email = $('#au2').value.trim(); mode = m; title = ''; if (!keepMsg) { msg = ''; offerSignin = false; } draw(); };
    $('#amode').addEventListener('click', () => swap(reg ? 'login' : 'register'));
    if ($('#ato')) $('#ato').addEventListener('click', () => { msg = ''; offerSignin = false; swap('login', true); });
    if (hint) pwIn.addEventListener('input', () => { hint.classList.toggle('ok', pwIn.value.length >= PW_MIN); hint.classList.remove('bad'); });
    const say = (text, offer) => { msg = text; offerSignin = !!offer; $('#aerr').innerHTML = esc(text) + (offer ? ' <button type="button" class="btn ghost sm" id="ato">Sign in instead</button>' : ''); if (offer) $('#ato').addEventListener('click', () => { msg = ''; offerSignin = false; swap('login', true); }); };
    $('#af').addEventListener('submit', async e => {
      e.preventDefault(); const f = new FormData(e.target), em = String(f.get('email') || '').trim(), pw = String(f.get('password') || '');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { say('Enter a valid email address.'); return $('#au2').focus(); }
      if (reg && pw.length < PW_MIN) { if (hint) hint.classList.add('bad'); say(`Use at least ${PW_MIN} characters for your password.`); return pwIn.focus(); }
      if (!pw) { say('Enter your password.'); return pwIn.focus(); }
      const btn = $('#asub'); btn.disabled = true; btn.textContent = reg ? 'Creating account…' : 'Signing in…'; say('');
      const r = await api('/api/' + mode, { method: 'POST', body: { email: em, password: pw, name: f.get('name') || '' } });
      if (r.error) {
        btn.disabled = false; btn.textContent = reg ? 'Create account' : 'Sign in';
        if (r.error === 'offline') return say(r.status === 0 ? 'Can\u2019t reach Hoggy. Check your connection and try again.' : 'Hoggy is not responding right now. Try again in a minute.');
        if (r.status >= 500) return say('Something went wrong on our side. Try again in a minute.');
        if (reg && r.status === 409) { email = em; return say(r.error, true); }
        if (r.status === 401) { pwIn.value = ''; pwIn.focus(); }
        return say(r.error);
      }
      if (reg) keepProf();
      NET.user = r.user; if (!S.profile.name && r.user.name) S.profile.name = r.user.name; closeOverlay(true); toast(reg ? 'Account created. You are signed in' : 'Signed in'); await pullState(); await pullInbox(); await loadMine(); await loadHosp(); syncFiles();
      if (reg) { /* after pullState, which may have reset this device for the new account */
        Object.assign(S.profile, { name: prof.name.trim().slice(0, 80) || S.profile.name, specialty: prof.specialty, country: prof.country, region: prof.region }); S.onboard = { at: Date.now() }; save();
        if (!then) { if (route() !== 'home') location.hash = '#/home'; }
      }
      render(); if (then) then(); }); };
  draw();
}
function renderAcct() { const a = $('#acct'); if (!a) return; a.innerHTML = !NET.online ? `<span class="acct-note">${NET.trouble ? 'Sign-in is unavailable right now. Your data stays on this device.' : 'Not connected. Your data stays on this device.'}</span>` : NET.user ? `<a class="acct-chip" href="#/settings" title="Signed in as ${esc(NET.user.email || NET.user.name)}. Synced."><span class="avatar" aria-hidden="true">${esc((firstName(NET.user.name || NET.user.email || '?') || '?').slice(0, 1).toUpperCase())}</span><span class="acct-name">${esc(firstName(NET.user.name || '') || NET.user.email)}</span></a><button class="btn sm ghost" data-act="signout">Sign out</button>` : '<button class="btn sm" data-act="signin">Sign in</button>'; }

/* ---------- client-ready: connection state, deep links, get started, report a problem, list your event ---------- */
function noteTrouble(on) { if (!!NET.trouble === !!on) return; NET.trouble = !!on; if (NET.started) bgRender(); }
/* links from the server-rendered pages: #/conference/<id>, #/report/conference/<id>, #/report/course/<id> */
const DEEP = { wait: null };
function deepLink() {
  const m = location.hash.match(/^#\/(conference|report\/conference|report\/course)\/([a-z0-9-]{1,80})$/); if (!m) return false;
  const id = m[2];
  if (m[1] === 'report/course') { history.replaceState(null, '', '#/courses/' + id); render(); reportDialog('course', id); return true; }
  history.replaceState(null, '', '#/discover'); render();
  const open = () => { if (!byId(id)) return toast('That listing is not on Hoggy any more'); detail(id); if (m[1] === 'report/conference') reportDialog('conference', id); };
  if (byId(id)) open(); else DEEP.wait = open;
  return true;
}
/* after sign-up: a short checklist on Home until dismissed */
function getStarted() {
  if (!NET.user || !S.onboard || S.onboard.dismissed) return '';
  const items = [
    [!!S.profile.specialty, 'Pick your specialty', S.profile.specialty ? esc(S.profile.specialty) + ' · change it in Settings' : 'In Settings', '#/settings'],
    [S.saved.length > 0, 'Save a conference', 'Tap the heart on any conference', '#/discover'],
    [S.trips.length > 0, 'Plan a trip', 'Open a conference and choose Plan trip', '#/discover'],
    [(S.certs || []).length > 0, 'Add a certificate', 'APLS, ALS or another course, to see when it is due', '#/certs']];
  const done = items.filter(x => x[0]).length;
  return `<section class="panel getstarted" aria-labelledby="gsH"><div class="row panel-head"><h2 id="gsH">Get started <span class="tag">${done} of ${items.length} done</span></h2><button type="button" class="btn sm ghost" data-act="dismissonboard">Hide this checklist</button></div>
    <ul class="gs-list">${items.map(([ok, t, d, href], i) => `<li class="${ok ? 'ok' : ''}"><span class="gs-mark" aria-hidden="true">${ok ? '✓' : i + 1}</span><a href="${href}"><b>${t}</b><span class="sr-only">${ok ? ' (done)' : ' (to do)'}</span><span class="s">${d}</span></a></li>`).join('')}</ul></section>`;
}
/* "Report a problem with this listing" */
function reportDialog(kind, id) {
  const name = kind === 'course' ? (courseOf(id) || {}).name || id : (byId(id) || {}).name || id;
  const R = window.HoggyListings ? HoggyListings.REASONS : { other: 'Something else' };
  openOverlay(`<div class="sheet center" role="dialog" aria-modal="true" aria-labelledby="rpH"><form id="rpf" novalidate style="padding:22px"><div class="row" style="justify-content:space-between;margin-bottom:6px"><h2 id="rpH" style="font-size:22px;margin:0">Report a problem</h2><button type="button" class="icon-btn" data-act="${kind === 'conference' ? 'rpback' : 'close'}" data-id="${esc(id)}" aria-label="Close">${icon('x')}</button></div>
    <p class="note" style="margin:0 0 14px">${esc(name)}</p>
    <fieldset class="rp-reasons"><legend>What is wrong?</legend>${Object.entries(R).map(([k, l], i) => `<label class="tick"><input type="radio" name="reason" value="${k}"${i === 0 ? ' autofocus' : ''}> ${esc(l)}</label>`).join('')}</fieldset>
    ${field('rpn', 'Note (optional)', '<textarea id="rpn" name="note" maxlength="500" aria-describedby="rph" placeholder="For example, the right dates and where you saw them"></textarea>')}<p class="note field-hint" id="rph" style="margin-top:-6px">Please don’t include patient information.</p>
    <div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
    <p class="note" id="rperr" role="alert" style="color:var(--bad);min-height:18px"></p>
    <div class="row" style="justify-content:flex-end;margin:4px 0 20px"><button type="button" class="btn" data-act="${kind === 'conference' ? 'rpback' : 'close'}" data-id="${esc(id)}">Cancel</button><button class="btn primary" type="submit">Send report</button></div></form></div>`, true);
  $('#rpf').addEventListener('submit', async e => {
    e.preventDefault(); const f = new FormData(e.target), body = { kind, id, reason: f.get('reason') || '', note: String(f.get('note') || ''), website: String(f.get('website') || '') };
    const v = window.HoggyListings ? HoggyListings.validateReport(body) : { ok: true };
    if (!v.ok) { $('#rperr').textContent = v.error; return (body.reason ? $('#rpn') : e.target.querySelector('input[name=reason]')).focus(); }
    const btn = e.target.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Sending…';
    const r = await api('/api/reports', { method: 'POST', body });
    if (r.error) { btn.disabled = false; btn.textContent = 'Send report'; $('#rperr').textContent = r.status === 0 ? 'You’re offline. Try again when you’re back online.' : r.status >= 500 || r.error === 'offline' ? TROUBLE : r.error; return; }
    toast('Thanks. The Hoggy team will check this listing.'); if (kind === 'conference' && byId(id)) detail(id, false); else closeOverlay();
  });
}
/* "List your event": organisers, no account needed */
const LE = { sent: false, err: '', field: '', vals: {} };
VIEWS['list-event'] = function () {
  const head = `<div class="page-head"><div><span class="eyebrow">For organisers</span><h1>List your event</h1><p>Run a medical conference or course session? Send it here. No account needed. A Hoggy admin checks every listing against your official event page before it appears, and your contact email is never shown.</p></div></div>`;
  if (LE.sent) return head + `<section class="panel le-done" aria-labelledby="leDoneH" tabindex="-1" id="leDone"><h2 id="leDoneH">Thanks — your listing is with the Hoggy team</h2><p style="color:var(--muted);margin-top:8px">We’ll check it against your official event page. If something doesn’t match, we’ll email the contact address you gave. Approved listings show “Dates confirmed” with your page as the source.</p><div class="row" style="margin-top:16px"><button class="btn primary" data-act="leagain">List another event</button><a class="btn" href="#/discover">Browse conferences</a></div></section>`;
  const v = LE.vals, specs = window.HoggySpecialties ? HoggySpecialties.DATA.canonical : [], ctry = COUNTRY_LIST();
  const inv = k => LE.field === k ? ` aria-invalid="true" aria-describedby="le-err"` : '';
  const val = k => esc(v[k] == null ? '' : v[k]);
  const sel = (k, opts, ph) => `<select id="le-${k}" name="${k}"${inv(k)} required><option value="">${ph}</option>${opts.map(([o, l]) => `<option value="${esc(o)}" ${String(v[k] || '') === String(o) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  return head + `<div class="cols le-cols"><form id="lef" class="panel le-form" novalidate aria-describedby="le-intro">
    <p class="note" id="le-intro" style="margin:0 0 14px">All fields are required unless marked optional.</p>
    <div id="le-err" class="form-err" role="alert">${LE.err ? esc(LE.err) : ''}</div>
    ${field('le-kind', 'Type of event', sel('kind', [['conference', 'Conference or scientific meeting'], ['course', 'Course session']], 'Choose…'))}
    ${field('le-name', 'Event name', `<input id="le-name" name="name" type="text" maxlength="160" required value="${val('name')}"${inv('name')} placeholder="e.g. Annual Scientific Meeting 2027">`)}
    ${field('le-organiser', 'Organiser or society', `<input id="le-organiser" name="organiser" type="text" maxlength="120" required value="${val('organiser')}"${inv('organiser')}>`)}
    <div class="field"><label for="le-url">Official event page</label><input id="le-url" name="url" type="url" inputmode="url" maxlength="500" required value="${val('url')}" placeholder="https://"${LE.field === 'url' ? ' aria-invalid="true"' : ''} aria-describedby="le-urlh${LE.field === 'url' ? ' le-err' : ''}"><p class="note field-hint" id="le-urlh">The page on your own website that gives the dates (https). Not a home page or a listing site.</p></div>
    <div class="two">${field('le-start', 'Start date', `<input id="le-start" name="start" type="date" required value="${val('start')}"${inv('start')}>`)}${field('le-end', 'End date', `<input id="le-end" name="end" type="date" required value="${val('end')}"${inv('end')}>`)}</div>
    <div class="two">${field('le-city', 'City', `<input id="le-city" name="city" type="text" maxlength="80" required value="${val('city')}"${inv('city')}>`)}${field('le-countryCode', 'Country', sel('countryCode', ctry.map(x => [x.code, x.name]), 'Choose…'))}</div>
    <div class="two">${field('le-specialty', 'Specialty', sel('specialty', specs.map(x => [x, x]), 'Choose…'))}${field('le-format', 'Format', sel('format', [['In-person', 'In person'], ['Hybrid', 'Hybrid (in person and online)']], 'Choose…'))}</div>
    <fieldset class="le-cpd"><legend>CPD (optional, only if stated on your event page)</legend><div class="two">${field('le-cpdHours', 'CPD hours (optional)', `<input id="le-cpdHours" name="cpdHours" type="number" min="0" max="100" step="0.25" value="${val('cpdHours')}"${inv('cpdHours')}>`)}${field('le-cpdBody', 'Accredited by (optional)', `<input id="le-cpdBody" name="cpdBody" type="text" maxlength="60" value="${val('cpdBody')}" placeholder="e.g. RACP, ACEM">`)}</div></fieldset>
    ${field('le-blurb', 'One-line description (optional)', `<input id="le-blurb" name="blurb" type="text" maxlength="240" value="${val('blurb')}"${inv('blurb')}>`)}
    <div class="field"><label for="le-contactEmail">Contact email</label><input id="le-contactEmail" name="contactEmail" type="email" inputmode="email" autocomplete="email" maxlength="254" required value="${esc(v.contactEmail != null ? v.contactEmail : NET.user ? NET.user.email : '')}"${LE.field === 'contactEmail' ? ' aria-invalid="true"' : ''} aria-describedby="le-emh${LE.field === 'contactEmail' ? ' le-err' : ''}"><p class="note field-hint" id="le-emh">Kept private. Used only to check this listing with you; never shown on Hoggy.</p></div>
    <label class="tick le-auth"><input type="checkbox" name="authorised" id="le-authorised" ${v.authorised ? 'checked' : ''}${inv('authorised')}> I’m authorised to list this event</label>
    <div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
    <div class="row" style="justify-content:space-between;margin-top:8px"><span class="note" style="margin:0">${NET.user ? `Signed in as ${esc(NET.user.email)}: the listing is linked to your account.` : NET.online ? 'Have a Hoggy account? <button type="button" class="linkbtn" data-act="signin">Sign in</button> (optional).' : ''}</span><button class="btn primary" type="submit" id="le-send">Send for checking</button></div>
  </form>
  <aside class="panel le-how" aria-labelledby="leHowH"><h2 id="leHowH">What happens next</h2><ol class="le-steps"><li>A Hoggy admin opens your official event page and checks the name, dates and city.</li><li>If they match, the listing goes live with “Dates confirmed” and your page as the source.</li><li>If something is unclear, we email you before listing it.</li></ol><p class="note">Listings never carry rankings or superlatives. CPD hours are shown only when your page states them. See the <a class="u" href="/terms">terms</a> and <a class="u" href="/privacy">privacy</a> pages.</p></aside></div>`;
};
AFTER['list-event'] = () => {
  if (LE.sent) { const d = $('#leDone'); if (d) d.focus(); return; }
  const f = $('#lef'); if (!f) return;
  if (LE.field) { const el = $('#le-' + LE.field); if (el) el.focus(); }
  f.addEventListener('submit', async e => {
    e.preventDefault(); const fd = new FormData(f), b = Object.fromEntries(fd); b.authorised = !!fd.get('authorised'); LE.vals = { ...b };
    const L = window.HoggyListings, today0 = today();
    const v = L ? L.validateSubmission(b, { countries: L.countryMap(CONFS), today: today0 }) : { ok: true };
    const c = v.ok && L ? L.validateContact(b) : v;
    if (!v.ok || !c.ok) { const x = !v.ok ? v : c; LE.err = x.error; LE.field = x.field; return render(); }
    const btn = $('#le-send'); btn.disabled = true; btn.textContent = 'Sending…';
    const r = await api('/api/submissions', { method: 'POST', body: { ...b, cpdHours: b.cpdHours === '' ? null : +b.cpdHours } });
    if (r.error) { LE.err = r.status === 0 ? 'You’re offline. Your details are still here; send again when you’re back online.' : r.status >= 500 || r.error === 'offline' ? TROUBLE + ' Your details are still here.' : r.error; LE.field = r.field || ''; return render(); }
    Object.assign(LE, { sent: true, err: '', field: '', vals: {} }); render(); window.scrollTo(0, 0);
  });
};
/* keep keyboard focus inside an open dialog; the page behind it is inert */
document.addEventListener('keydown', e => {
  const o = $('#overlay'); if (e.key !== 'Tab' || o.hidden) return;
  const f = [...o.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([tabindex="-1"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null || x === document.activeElement);
  if (!f.length) { e.preventDefault(); return; }
  const first = f[0], last = f[f.length - 1];
  if (!o.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
window.addEventListener('offline', () => { NET.offline = true; bgRender(); });
window.addEventListener('online', () => { NET.offline = false; bgRender(); if (!NET.online) boot(); });

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
  if (a === 'open' && el.matches('a') && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0)) return; /* new tab: the page link */
  if (a === 'open' && el.matches('a')) e.preventDefault();
  if (a === 'skip') { e.preventDefault(); $('#main').focus(); return; }
  if (a === 'register') return authDialog('', null, { mode: 'register' });
  if (a === 'retry') { noteTrouble(false); toast('Trying again…'); closeOverlay(); NET.online = false; await boot(); if (NET.trouble) toast('Still having trouble. Try again in a minute.'); return; }
  if (a === 'report') return reportDialog(el.dataset.kind, id);
  if (a === 'rpback') { if (byId(id)) return detail(id, false); return closeOverlay(); }
  if (a === 'dismissonboard') { S.onboard = { ...(S.onboard || {}), dismissed: true }; save(); render(); toast('Checklist hidden'); return; }
  if (a === 'leagain') { LE.sent = false; render(); const n = $('#le-kind'); if (n) n.focus(); return; }
  if (a === 'clearfilters') { Object.assign(UI, { q: '', spec: 'All', region: '', country: '', month: '', cpd: 0, confirmed: '', hol: '', limit: 48 }); render(); const q = $('#q'); if (q) q.focus(); return; } /* don't put #main in the hash: the router would read it as a route */
  if (a === 'howto') { const h = $('#how'); if (h) { h.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); h.focus({ preventScroll: true }); } return; }
  if (a === 'close') return closeOverlay();
  if (a === 'filters') return filterSheet(!FS.open, true);
  if (a === 'filtersclose') return filterSheet(false, el.matches('button'));
  if (a === 'toreviews') { const h = $('#rvh'); if (h) { h.scrollIntoView({ block: 'start' }); h.focus({ preventScroll: true }); } return; }
  if (a === 'tickpause') { const t = el.closest('.ticker'), on = !t.classList.contains('paused'); t.classList.toggle('paused', on); el.setAttribute('aria-pressed', String(on)); el.setAttribute('aria-label', on ? 'Resume the moving list' : 'Pause the moving list'); el.innerHTML = icon(on ? 'play' : 'pause'); return; }
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
  if (a === 'toplist') { e.preventDefault(); UI.sort = 'rating'; UI.limit = 48; location.hash = '#/discover'; if (route() === 'discover') render(); return; }
  if (a === 'topfind') { UI.sort = 'date'; render(); const q = $('#q'); if (q) q.focus(); toast('Search for a conference you have attended, open it and choose Review'); return; }
  if (a === 'covsuggest') { const c = byId(id); if (!c) return; if (!NET.user) return authDialog('Sign in to suggest a link', () => coverageDialog(c)); return coverageDialog(c); }
  if (a === 'ext') return; /* external link inside a clickable row: let it open, do nothing else */
  if (a === 'opencourse') { location.hash = '#/courses/' + id; return; }
  if (a === 'session') return sessionSheet(id);
  if (a === 'plancourse') return planCourse(id);
  if (a === 'moresess') { CUI.limit += 25; return sessionList(); }
  if (a === 'morecourses') { CUI.lim += 24; return bgRender(); }
  if (a === 'addcert') return certDialog();
  if (a === 'editcert') return certDialog({ edit: id });
  if (a === 'opencert') { const c = S.certs.find(x => x.id === id); return c && openFile(c); }
  if (a === 'rmcert') { const c = S.certs.find(x => x.id === id); if (c && confirm(`Delete your ${c.short || ''} certificate?`)) { if (c.fileKey) delFile(c.fileKey); S.certs = S.certs.filter(x => x.id !== id); save(); render(); toast('Certificate deleted'); } return; }
  if (a === 'ics') { const c = byId(id); if (c) download(c.id + '.ics', ics(c), 'text/calendar'); return; }
  if (a === 'signin') return authDialog();
  if (a === 'signout') { await pushState(); await api('/api/logout', { method: 'POST' }); NET.user = null; NET.rev = 0; resetHosp(); if (confirm('Signed out. Remove your trips, receipts and files from this device too?\n\nOK = remove them (recommended on a shared computer). Your account copy is kept.\nCancel = keep them on this device.')) { await DB.wipe(); FILES.clear(); UNSAVED.clear(); const th = S.profile.theme; S = defaults(); if (th) S.profile.theme = th; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } setOwner(''); } toast('Signed out'); render(); return; }
  if (a === 'checkinbox') return pullInbox(true);
  if (a === 'delaccount') { if (confirm('Delete your account, synced data and reviews from Hoggy? Data on this device stays until you erase it.')) { const pw = prompt('Enter your password to confirm'); if (!pw) return; const r = await api('/api/account', { method: 'DELETE', body: { password: pw } }); if (r.error) return toast(r.error === 'offline' ? 'Can\u2019t reach Hoggy. Try again in a minute.' : r.error); NET.user = null; resetHosp(); toast('Account deleted'); render(); } return; }
  if (a === 'open') { if (e.target.closest('[data-act=save]')) return; return detail(id); }
  if (a === 'save') { e.stopPropagation(); const i = S.saved.indexOf(id); i < 0 ? S.saved.push(id) : S.saved.splice(i, 1); save(); toast(i < 0 ? 'Saved' : 'Removed from saved'); renderNav(); if (!$('#overlay').hidden) detail(id); else { if (route() === 'discover') results(); else render(); } return; }
  if (a === 'plan') { if (!S.trips.some(t => t.confId === id)) { S.trips.push({ id: uid(), confId: id, status: 'planned', bookings: [] }); if (!S.saved.includes(id)) S.saved.push(id); save(); } closeOverlay(); toast('Trip planned'); location.hash = '#/trips'; render(); return; }
  if (a === 'rmtrip') { if (confirm('Remove this trip? Its receipts stay but become unlinked.')) { S.trips = S.trips.filter(t => t.id !== id); S.receipts.forEach(r => { if (r.tripId === id) r.tripId = ''; }); save(); render(); } return; }
  if (a === 'attend') { const t = S.trips.find(x => x.id === id), c = ofTrip(t); simpleDialog('Mark attended', `${field('h', 'CPD hours earned', `<input id="h" type="number" name="hours" min="0" step="0.5" value="${c.cpdVerified && c.cpdHours ? esc(c.cpdHours) : ''}" placeholder="Hours on your certificate" autofocus>`)}<p class="note">Enter the hours on your certificate or the organiser's confirmation.</p>${themeBoxes()}`, f => { t.status = 'attended'; S.cpd.push({ id: uid(), title: c.name, date: c.end, hours: Math.max(0, +f.get('hours') || 0), source: 'conference', tripId: t.id, themes: themeKeys(f) }); save(); closeOverlay(); toast('CPD hours logged'); render(); if (c.kind === 'course' && COURSES.cat && !S.certs.some(x => x.courseId === c.courseId && x.completed === c.end)) certDialog({ prefill: { courseId: c.courseId, completed: c.end <= today() ? c.end : '' } }); }, 'Log hours'); return; }
  if (a === 'addbook') { simpleDialog('Log a booking', `<div class="two">${field('b1', 'Type', '<select id="b1" name="type"><option>Flight</option><option>Hotel</option><option>Registration</option><option>Transport</option></select>')}${field('b2', 'Provider', '<input id="b2" type="text" name="vendor" required maxlength="60">')}</div><div class="two">${field('b3', 'Confirmation ref', '<input id="b3" type="text" name="ref" maxlength="30">')}${field('b4', 'Cost', '<input id="b4" type="number" step="0.01" min="0" name="amount" required>')}</div>`, f => { const t = S.trips.find(x => x.id === id); t.bookings.push({ id: uid(), type: f.get('type'), vendor: String(f.get('vendor')).slice(0, 60), ref: String(f.get('ref')).slice(0, 30), amount: +f.get('amount') || 0, date: today() }); save(); closeOverlay(); render(); }); return; }
  if (a === 'rmbook') { const t = S.trips.find(x => x.id === id); t.bookings = t.bookings.filter(b => b.id !== el.dataset.b); save(); render(); return; }
  if (a === 'addreceipt') { if (location.hash.includes('receipts') || true) { const inp = document.createElement('input'); } return receiptDialog({ tripId: id && S.trips.some(t => t.id === id) ? id : '' }); }
  if (a === 'openfile') { const r = S.receipts.find(x => x.id === id); return r && openFile(r); }
  if (a === 'editreceipt') { e.preventDefault(); return receiptDialog({ edit: id }); }
  if (a === 'rmreceipt') { if (confirm('Delete this receipt?')) { const r = S.receipts.find(x => x.id === id); if (r?.fileKey) delFile(r.fileKey); S.receipts = S.receipts.filter(x => x.id !== id); save(); closeOverlay(); render(); } return; }
  if (a === 'copy') { try { await navigator.clipboard.writeText(el.dataset.v); toast('Copied'); } catch (er) { toast('Copy failed — select and copy manually'); } return; }
  if (a === 'exportcsv') { const t = S.trips.find(x => x.id === id); download(`claim-${ofTrip(t).id}.csv`, scheduleCsv(t, false)); return; }
  if (a === 'printpack') return printPack(S.trips.find(x => x.id === id));
  if (a === 'emailpack') return emailPack(S.trips.find(x => x.id === id));
  if (a === 'mailtopack') return mailtoPack(S.trips.find(x => x.id === id));
  if (a === 'leave') return leaveDialog(id);
  if (a === 'noreceipt') return noReceiptDialog(id, el.dataset.v);
  if (a === 'undonoreceipt') { const c = S.claims[id]; if (c && c.waived) { const w = { ...c.waived }; delete w[el.dataset.v]; S.claims[id] = { ...c, waived: w }; save(); render(); } return; }
  if (['reqapproval', 'hnotesread', 'hcode', 'hleave', 'apdecide', 'teamyear', 'setallow', 'resetallow', 'rmmember', 'markpaid'].includes(a)) return hospAct(a, el, id);
  if (a === 'submitclaim') { const t = S.trips.find(x => x.id === id);
    if (inHosp()) { /* a server record finance can see; the local status follows only once the server has it */
      const c = ofTrip(t), rs = S.receipts.filter(r => r.tripId === id), tot = rs.reduce((x, r) => x + claimAmt(r), 0); el.disabled = true;
      const r = await api('/api/claims', { method: 'POST', body: { tripRef: id, confId: c.id, event: eventOf(c), totalCents: Math.round(tot * 100), currency: S.profile.currency, receipts: rs.length } });
      if (r.error) { el.disabled = false; return toast(hErr(r)); }
      await loadHosp();
    }
    S.receipts.forEach(r => { if (r.tripId === id && r.status === 'captured') r.status = 'claimed'; }); S.claims[id] = { ...(S.claims[id] || {}), submitted: today() }; save(); toast(inHosp() ? 'Marked submitted. ' + HOSP.org.name + ' finance can see it now' : 'Marked submitted'); render(); return; }
  if (a === 'paidclaim') { S.receipts.forEach(r => { if (r.tripId === id && r.status === 'claimed') r.status = 'paid'; }); S.claims[id] = { ...(S.claims[id] || {}), paid: today() }; save(); toast('Reimbursement recorded'); render(); return; }
  if (a === 'addcpd') { simpleDialog('Add CPD entry', `${field('c1', 'Activity', '<input id="c1" type="text" name="title" required maxlength="100" autofocus>')}<div class="two">${field('c2', 'Date', `<input id="c2" type="date" name="date" required value="${today()}">`)}${field('c3', 'Hours', '<input id="c3" type="number" name="hours" min="0.25" step="0.25" required>')}</div>${themeBoxes()}`, f => { S.cpd.push({ id: uid(), title: String(f.get('title')).slice(0, 100), date: f.get('date'), hours: +f.get('hours') || 0, source: 'manual', themes: themeKeys(f) }); save(); closeOverlay(); render(); }); return; }
  if (a === 'rmcpd') { S.cpd = S.cpd.filter(x => x.id !== id); save(); render(); return; }
  if (a === 'exportcpd') return download('cpd-log.csv', csv([['Date', 'Activity', 'Source', 'Hours'], ...S.cpd.map(e => [e.date, e.title, e.source, e.hours])]));
  if (a === 'backup') return download('hoggy-backup.json', JSON.stringify(S, null, 2), 'application/json');
  if (a === 'wipe') { if (confirm('Erase Hoggy data on this device?' + (NET.user ? '\n\nYour account copy is NOT deleted and will reload from your account.' : '\n\nThis cannot be undone.'))) { await DB.wipe(); FILES.clear(); UNSAVED.clear(); S = defaults(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } setOwner(''); if (NET.user) { await pullState(true); await syncFiles(); } render(); toast('Erased on this device'); } return; }
});
document.addEventListener('submit', e => { if (e.target && e.target.id === 'heroSearch') { e.preventDefault(); UI.q = String(new FormData(e.target).get('q') || '').trim(); UI.limit = 48; location.hash = '#/discover'; } });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#overlay').hidden) closeOverlay(); else if (e.key === 'Escape' && FS.open) filterSheet(false, true);
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.card, .sess')) { e.preventDefault(); const d = e.target.dataset; if (d.act === 'opencourse') location.hash = '#/courses/' + d.id; else if (d.act === 'session') sessionSheet(d.id); else detail(d.id); }
});
window.addEventListener('hashchange', () => { if (deepLink()) return; if (reviewHash()) { closeOverlay(true); render(); return openReviewLink(); } if (!knownRoute()) return; if (HOSP_ROUTES.some(([k]) => k === route())) { HOSP.pend = HOSP.team = HOSP.finance = null; } closeOverlay(); const go = () => { render(); $('#main').focus({ preventScroll: true }); window.scrollTo(0, 0); }; if (MOTION && FS.route !== hashParts().parts.join('/')) MOTION.swap(go); else go(); });
if (!CONFS.length) console.warn('Hoggy: no conference data loaded (data/conferences.js)');
S.certs = Array.isArray(S.certs) ? S.certs : []; S.trips = S.trips.filter(keepTrip); S.saved = S.saved.filter(id => CONFS.some(c => c.id === id));
NET.offline = navigator.onLine === false;
if (!deepLink()) render();
NET.started = true;
boot();
})();
