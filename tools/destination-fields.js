'use strict';
/* Optional "destination CPD" fields on a conference row (docs/research/destinations.md). Shared by tools/merge-shards.js
   and tools/validate-data.js. All are optional; a row without them behaves exactly as before.

     tags           array from TAGS, no repeats. Only what the organiser's page supports (a ski resort venue, "family-friendly",
                    a cruise). "destination" = the meeting is held at a resort or holiday location named on the organiser's page.
     schedule       { pattern, quote, sourceUrl }: the daily session pattern, only when the organiser states session times.
                    pattern is Hoggy's one-line summary ("Sessions 7:15-10:30 and 15:15-18:30"); quote is the organiser's own
                    words or times copied from sourceUrl (" … " marks text left out between two copied pieces).
     organiserType  one of ORGANISER_TYPES. "commercial" must be shown as such in the app.
     accreditation  { text, sourceUrl }: a CPD/CME statement copied from the organiser's page. Never a figure Hoggy worked out.
     audience       who the organiser says it is for (short). */
const TAGS = ['ski', 'beach', 'cruise', 'family-friendly', 'destination', 'school-holidays-au'];
const ORGANISER_TYPES = ['college', 'society', 'commercial', 'university', 'hospital'];
const KEYS = ['tags', 'schedule', 'organiserType', 'accreditation', 'audience'];
const MAX = { pattern: 120, quote: 300, text: 300, audience: 200 };
const isHttps = u => { try { return new URL(u).protocol === 'https:'; } catch (e) { return false; } };
const str = (v, max) => typeof v === 'string' && v.trim() !== '' && v.length <= max;
const plain = o => o && typeof o === 'object' && !Array.isArray(o);

/* problems with one field -> [message]; an absent field (undefined/null) has none */
function fieldProblems(k, v) {
  if (v == null) return [];
  const P = [];
  if (k === 'tags') {
    if (!Array.isArray(v) || !v.length) return ['tags must be a non-empty array'];
    for (const t of v) if (!TAGS.includes(t)) P.push(`tag "${t}" is not in the vocabulary (${TAGS.join(', ')})`);
    if (new Set(v).size !== v.length) P.push('tags has a repeated value');
  } else if (k === 'schedule') {
    if (!plain(v)) return ['schedule must be an object { pattern, quote, sourceUrl }'];
    if (!str(v.pattern, MAX.pattern)) P.push(`schedule.pattern is missing or longer than ${MAX.pattern} characters`);
    if (!str(v.quote, MAX.quote)) P.push(`schedule.quote is missing or longer than ${MAX.quote} characters (the organiser's words are required)`);
    else if (!/\d/.test(v.quote) && !/morning|afternoon|evening|night|daily|midday|noon/i.test(v.quote)) P.push('schedule.quote says nothing about session times');
    if (!isHttps(v.sourceUrl)) P.push('schedule.sourceUrl is missing or not https');
  } else if (k === 'organiserType') {
    if (!ORGANISER_TYPES.includes(v)) P.push(`organiserType "${v}" is not one of ${ORGANISER_TYPES.join(', ')}`);
  } else if (k === 'accreditation') {
    if (!plain(v)) return ['accreditation must be an object { text, sourceUrl }'];
    if (!str(v.text, MAX.text)) P.push(`accreditation.text is missing or longer than ${MAX.text} characters (quote the organiser)`);
    if (!isHttps(v.sourceUrl)) P.push('accreditation.sourceUrl is missing or not https');
  } else if (k === 'audience') {
    if (!str(v, MAX.audience)) P.push(`audience must be a string of at most ${MAX.audience} characters`);
  }
  return P;
}
/* every problem with the optional fields of a row or provenance entry */
const destinationProblems = o => KEYS.flatMap(k => fieldProblems(k, o && o[k]));
const hasDestinationFields = o => !!o && KEYS.some(k => o[k] != null);
/* the valid optional fields of o, copied (tags in vocabulary order); invalid ones are left out and listed in `dropped` */
function pickDestination(o, dropped = []) {
  const out = {};
  for (const k of KEYS) {
    if (!o || o[k] == null) continue;
    const why = fieldProblems(k, o[k]);
    if (why.length) { dropped.push(`${o.id || o.name || '?'}: ${why[0]}`); continue; }
    out[k] = k === 'tags' ? TAGS.filter(t => o.tags.includes(t))
      : k === 'schedule' ? { pattern: o.schedule.pattern, quote: o.schedule.quote, sourceUrl: o.schedule.sourceUrl }
      : k === 'accreditation' ? { text: o.accreditation.text, sourceUrl: o.accreditation.sourceUrl } : o[k];
  }
  return out;
}
module.exports = { TAGS, ORGANISER_TYPES, KEYS, MAX, fieldProblems, destinationProblems, hasDestinationFields, pickDestination };
