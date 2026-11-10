(function (root) {
const CAT_RX = [[/\b(airline|flights?|qantas|virgin|jetstar|emirates|lufthansa|boarding|airways)\b/i, 'Flights'], [/hotel|booking\.com|airbnb|accommodation|nights?|check-?in|resort|hostel|marriott|hilton|ibis|novotel/i, 'Accommodation'], [/registration|congress|conference|delegate|ticket|symposium/i, 'Registration'], [/\b(uber|taxi|cab|train|metro|rail|lyft|bolt|transfer|parking|car hire|rental)\b/i, 'Ground transport'], [/restaurant|cafe|coffee|dinner|lunch|breakfast|meal|bar |eats/i, 'Meals']];
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function parseReceipt(text, cur) {
  cur = cur || 'AUD';
  const t = String(text || '').slice(0, 20000), out = {};
  const fwd = t.search(/forwarded message|original message/i);
  const fromRx = /^from:\s*(.+)$/im, subj = t.match(/^subject:\s*(.+)$/im);
  const from = (fwd >= 0 && t.slice(fwd).match(fromRx)) || t.match(fromRx);
  let v = from ? from[1].replace(/<[^>]*>/g, '').replace(/["']/g, '').trim() : '';
  if (!v && subj) v = subj[1].trim().slice(0, 60);
  out.vendor = v.slice(0, 60);
  const rx = /(?<![a-z])(?:grand\s+total|total\s+paid|amount\s+(?:paid|charged|due)|you\s+paid|total)\b[^\d\n$€£]{0,25}?(A\$|AU\$|US\$|NZ\$|\$|€|£|AUD|USD|EUR|GBP|NZD)?\s?(\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+\.\d{2}|\d+)/gi;
  let m = null;
  for (const x of t.matchAll(rx)) if (x[1] || /[.,]/.test(x[2])) m = x;
  if (!m) { const all = [...t.matchAll(/(A\$|AU\$|US\$|NZ\$|\$|€|£)\s?(\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+(?:\.\d{2})?)/g)]; if (all.length) m = [null, all[0][1], all.map(x => x[2]).sort((a, b) => parseFloat(b.replace(/,/g, '')) - parseFloat(a.replace(/,/g, '')))[0]]; }
  if (m) { out.amount = parseFloat(String(m[2]).replace(/[,\s]/g, '')); const s = (m[1] || '').toUpperCase(); out.currency = { '€': 'EUR', 'EUR': 'EUR', '£': 'GBP', 'GBP': 'GBP', 'US$': 'USD', 'USD': 'USD', 'NZ$': 'NZD', 'NZD': 'NZD', 'A$': 'AUD', 'AU$': 'AUD', 'AUD': 'AUD', '$': cur }[s] || cur; }
  let d = t.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (d) out.date = `${d[1]}-${d[2]}-${d[3]}`;
  else if ((d = t.match(/\b(\d{1,2})[\/.](\d{1,2})[\/.](20\d{2})\b/))) out.date = `${d[3]}-${String(d[2]).padStart(2, '0')}-${String(d[1]).padStart(2, '0')}`;
  else if ((d = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(20\d{2})\b/i))) out.date = `${d[3]}-${String(MONTHS[d[2].toLowerCase().slice(0, 3)] + 1).padStart(2, '0')}-${String(d[1]).padStart(2, '0')}`;
  const hay = (subj ? subj[1] : '') + ' ' + v;
  out.category = (CAT_RX.find(([r]) => r.test(hay)) || [0, 'Other'])[1];
  return out;
}

const api = { parseReceipt };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HoggyParse = api;
})(typeof window !== 'undefined' ? window : globalThis);
