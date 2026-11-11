/* Conference series keys: every edition of the same meeting gets the same key, so reviews from previous years
   stay with the conference. Shared by the server (require) and the browser (window.HoggySeries).
   "46th Annual Meeting of the Japan Society for Clinical Anesthesia" (2026) and "47th Annual Meeting of the Japan Society
   for Clinical Anesthesia" (2027) both give "annual-meeting-japan-society-clinical-anesthesia--jsca". */
(function (root) {
'use strict';
const STOP = new Set(['the', 'of', 'and', 'for', 'on', 'in', 'at', 'to', 'a', 'an', 'with', 'de', 'la', 'le', 'les', 'du', 'des', 'del', 'di', 'da', 'do', 'dos', 'das', 'e', 'y', 'et', 'und', 'der', 'die', 'en', 'och']);
const ORD_WORDS = new Set(['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'edition', 'ed']);
const ROMAN = /^(?=[MDCLXVI]+$)M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const words = s => fold(s).replace(/[’'`]/g, '').split(/[^A-Za-z0-9º°ª]+/).filter(Boolean);

/* name words with years, ordinals, edition numbers and the host city removed (original case kept for acronym checks) */
function coreWords(name, city) {
  let n = fold(name);
  const cf = fold(city).trim();
  if (cf) { /* "..., Ljubljana" or "... - Warsaw 2026": a trailing host city changes each edition; a city inside the name (San Antonio Breast Cancer Symposium) stays */
    const esc = cf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    n = n.replace(new RegExp('\\s*[,–-]\\s*' + esc + '(\\s+(19|20)\\d{2})?\\s*$', 'i'), '');
  }
  const out = [];
  words(n).forEach((w, i) => {
    const l = w.toLowerCase();
    if (/^\d+$/.test(w)) return;                                   /* 2026, 46, 10 */
    if (/^\d+(st|nd|rd|th|e|er|eme|o|a|º|ª|°)$/i.test(w)) return;  /* 46th, 93e, 58º */
    if (/[º°ª]/.test(w)) return;
    if (ROMAN.test(w) && (w.length >= 2 || i === 0)) return;       /* XCVIII Congreso, II Congresso */
    if (ORD_WORDS.has(l) || STOP.has(l)) return;
    const m = w.match(/^([A-Za-z]{2,})(\d{2}|\d{4})$/);            /* ISAH26, GP2026 -> isah, gp */
    out.push(m ? m[1] : w);
  });
  return out;
}
const slug = ws => ws.map(w => w.toLowerCase()).join('-').replace(/-+/g, '-').replace(/^-|-$/g, '');
/* organiser tag: the organiser's own acronym when it is one word (ESPEN, RACGP), otherwise its initials */
function orgTag(organiser) {
  const ws = words(String(organiser || '').replace(/\(.*?\)/g, ' ')).filter(w => !/^\d/.test(w));
  if (!ws.length) return '';
  if (ws.length === 1) return ws[0].toLowerCase().slice(0, 12);
  const caps = ws.find(w => /^[A-Z]{3,10}$/.test(w));
  if (caps && ws.length <= 3) return caps.toLowerCase();
  return ws.filter(w => !STOP.has(w.toLowerCase())).map(w => w[0]).join('').toLowerCase().slice(0, 12);
}
function seriesKey(c) {
  if (!c) return '';
  let name = slug(coreWords(c.name, c.city));
  if (name.length > 64) name = name.slice(0, 65).replace(/-[^-]*$/, '');
  if (!name) name = String(c.id || 'conference').toLowerCase().replace(/-?(19|20)\d{2}$/, '').replace(/[^a-z0-9-]/g, '').slice(0, 64);
  const org = orgTag(c.organiser);
  return (org && org !== name ? name + '--' + org.replace(/[^a-z0-9]/g, '') : name).slice(0, 80);
}
/* a readable series title: the edition name without its year */
function seriesTitle(c) { return String(c && c.name || '').replace(/\s*\(?\b(19|20)\d{2}\b\)?/g, '').replace(/\s{2,}/g, ' ').replace(/[\s,:–-]+$/, '').trim() || String(c && c.name || ''); }
const validKey = k => typeof k === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(k);

const api = { seriesKey, seriesTitle, validKey, coreWords };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HoggySeries = api;
})(typeof window !== 'undefined' ? window : globalThis);
