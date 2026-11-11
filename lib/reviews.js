'use strict';
/* Review rules shared by the server and its tests: score weighting, the display threshold, rating validation and
   the registration-receipt match used for automatic "Verified attendee". Pure functions, no I/O. */
const { coreWords } = require('./series.js');

const DIMS = ['content', 'networking', 'venue', 'value', 'cpd'];
const MIN_REVIEWS = 3;                 /* no score until a series has this many visible reviews */
const WEIGHT = { verified: 1, other: 0.5 };
const weight = verify => verify === 'verified' ? WEIGHT.verified : WEIGHT.other;
const PROOF_KINDS = { certificate: 'Certificate of attendance', cpd: 'CPD certificate', receipt: 'Registration receipt' };

/* all five areas, whole numbers 1 to 5; anything else is refused */
function parseRatings(r) {
  if (!r || typeof r !== 'object') return null;
  const out = {};
  for (const k of DIMS) { const v = Number(r[k]); if (!Number.isInteger(v) || v < 1 || v > 5) return null; out[k] = v; }
  return out;
}
const overall = d => Math.round(DIMS.reduce((a, k) => a + d[k], 0) / DIMS.length * 100) / 100;

/* rows: [{ user_id, verify, rating, content, networking, venue, value, cpd }] (legacy rows may have null areas) */
function scoreOf(rows) {
  const out = { n: rows.length, verified: rows.filter(r => r.verify === 'verified').length, people: new Set(rows.map(r => r.user_id)).size, avg: null, dims: null, min: MIN_REVIEWS };
  if (out.n < MIN_REVIEWS) return out;
  const wavg = get => { let s = 0, w = 0, n = 0; for (const r of rows) { const v = get(r); if (v == null) continue; const x = weight(r.verify); s += v * x; w += x; n++; } return n ? { avg: Math.round(s / w * 100) / 100, n } : null; };
  out.avg = wavg(r => r.rating).avg;
  out.dims = {};
  for (const k of DIMS) { const d = wavg(r => r[k]); if (d) out.dims[k] = d; }
  return out;
}

/* Does an emailed receipt name this conference? Either the conference's name (years, ordinals and stop words removed)
   appears in the text, or one of its acronyms (3+ capitals, e.g. RACGP, ESC) appears together with the edition year. */
const toks = s => coreWords(String(s || ''), '').map(w => w.toLowerCase());
function mentions(text, conf) {
  const T = ' ' + toks(text).join(' ') + ' ', core = toks(conf.name);
  if (core.length >= 2 && T.includes(' ' + core.join(' ') + ' ')) return true;
  const year = String(conf.start || '').slice(0, 4), yy = year.slice(2);
  const acr = (String(conf.name).match(/\b[A-Z][A-Z0-9-]{2,11}\b/g) || []).map(a => a.replace(/(\d{2}|\d{4})$/, '')).filter(a => /^[A-Z][A-Z-]{2,}$/.test(a));
  if (!year || !acr.length) return false;
  const raw = String(text || ''), hasYear = new RegExp('\\b' + year + '\\b').test(raw);
  return acr.some(a => { const e = a.replace(/-/g, '\\-'); return (hasYear && new RegExp('\\b' + e + '\\b').test(raw)) || new RegExp('\\b' + e + '\\s?' + yy + '\\b').test(raw); });
}
/* registration receipts are often paid months ahead: accept 400 days before the start to 7 days after the end */
function inWindow(dateIso, conf) {
  const d = Date.parse(dateIso + 'T00:00:00Z'), a = Date.parse(conf.start + 'T00:00:00Z'), b = Date.parse(conf.end + 'T00:00:00Z');
  return !isNaN(d) && d >= a - 400 * 864e5 && d <= b + 7 * 864e5;
}

module.exports = { DIMS, MIN_REVIEWS, WEIGHT, weight, PROOF_KINDS, parseRatings, overall, scoreOf, mentions, inWindow };
