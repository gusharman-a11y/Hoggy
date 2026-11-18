'use strict';
/* Repairs the accent corruption in data/shards/exp-europe.json (x10 expert review, 18 Nov 2026): a find-and-replace for French
   accents ran over English, Spanish and Italian names ("ESC Congrèss", "Congrèso", "Congrèsso", "Royal Collège of",
   "Anticancer Thérapies", "Pädiatric ... Hépatology"). French names ("Congrès de la SFAR", "Collège National des
   Gynécologues", "Thérapie Cellulaire") are left alone. Used by tools/merge-shards.js on every row, so it stays fixed. */
const RULES = [
  [/Congrèss\b/g, 'Congress'], [/Congrèsso\b/g, 'Congresso'], [/Congrèso\b/g, 'Congreso'],
  [/\b(Royal|European|Irish|American|British|Board and|International) Collège\b/g, '$1 College'],
  [/\bCollège of\b/g, 'College of'],
  [/\bAnticancer Thérapies\b/g, 'Anticancer Therapies'],
  [/\bPädiatric\b/g, 'Paediatric'], [/\bHépatology\b/g, 'Hepatology']
];
const demangle = s => RULES.reduce((t, [re, to]) => t.replace(re, to), String(s));
module.exports = { demangle, RULES };
