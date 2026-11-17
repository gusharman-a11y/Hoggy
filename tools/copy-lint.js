'use strict';
/* Copy lint word list (B35), shared by tests/copy.test.js and tools/validate-data.js so there is one list.
   Banned: largest, biggest, leading, best, premier, foremost, guarantee(d), world's, world-leading, #1, number one,
   top rated / top-rated, never lose, watertight, seamless. "Highest rated" is allowed only as the exact label
   "Highest rated by attendees". "Guaranteed claim" is never allowed: the word is "claim-ready". */
const BANNED = [
  /\b(largest|biggest|leading|best|premier|foremost|world'?s|world-leading|number one|never lose|watertight|seamless)\b/i,
  /\bguarantee\w*/i,
  /\btop[- ]rated\b/i,
  /(?<![\w&])#1(?!\w)/,
  /\bhighest[- ]rated\b(?! by attendees)/i
];
/* Names that are code, not copy: the public API path keeps its URL. */
const ALLOWED = [/\/api\/top-rated/g];

/* -> [{ line, word, text }] for every banned phrase in text */
function lint(text) {
  let t = String(text);
  for (const a of ALLOWED) t = t.replace(a, ' ');
  const hits = [];
  t.split('\n').forEach((line, i) => { for (const re of BANNED) { const m = line.match(re); if (m) hits.push({ line: i + 1, word: m[0], text: line.trim().slice(0, 140) }); } });
  return hits;
}
module.exports = { BANNED, ALLOWED, lint };
