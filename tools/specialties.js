'use strict';
/* Canonical specialty lookup, shared by tools/merge-shards.js and tools/normalise-specialties.js.
   canon(s) returns the canonical name, or null when the value is unknown (add it to tools/specialties.json). */
const { canonical, map } = require('./specialties.json');
const CANON = new Set(canonical);
// Loose key: case, spacing, punctuation, "and" vs "&", US vs AU spelling and simple plurals don't matter.
const loose = s => String(s).toLowerCase()
  .replace(/\bpediatr/g, 'paediatr').replace(/\banesth/g, 'anaesth').replace(/gynec/g, 'gynaec').replace(/\bhematol/g, 'haematol')
  .replace(/\borthoped/g, 'orthopaed').replace(/\btumor/g, 'tumour').replace(/\besophag/g, 'oesophag')
  .replace(/\band\b/g, '&').replace(/[^a-z0-9&]+/g, '').replace(/(ies|s)$/, '');
const LOOSE = new Map();
for (const c of canonical) LOOSE.set(loose(c), c);
for (const [v, c] of Object.entries(map)) {
  if (!CANON.has(c)) throw new Error(`specialties.json: "${v}" maps to "${c}", which is not canonical`);
  const k = loose(v); if (LOOSE.has(k) && LOOSE.get(k) !== c) throw new Error(`specialties.json: "${v}" clashes with another entry`);
  LOOSE.set(k, c);
}
const canon = s => {
  if (s == null) return null;
  const t = String(s).trim().replace(/\s+/g, ' ');
  if (CANON.has(t)) return t;
  if (Object.prototype.hasOwnProperty.call(map, t)) return map[t];
  return LOOSE.get(loose(t)) || null;
};
module.exports = { CANON, canon };
