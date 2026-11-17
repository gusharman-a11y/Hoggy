(function (root) {
const CAT_RX = [[/\b(airline|flights?|qantas|virgin|jetstar|emirates|lufthansa|boarding|airways)\b/i, 'Flights'], [/hotel|booking\.com|airbnb|accommodation|nights?|check-?in|resort|hostel|marriott|hilton|ibis|novotel/i, 'Accommodation'], [/registration|congress|conference|delegate|ticket|symposium/i, 'Registration'], [/\b(uber|taxi|cab|train|metro|rail|lyft|bolt|transfer|parking|car hire|rental)\b/i, 'Ground transport'], [/restaurant|cafe|coffee|dinner|lunch|breakfast|meal|bar |eats/i, 'Meals']];
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/* Currency markers, longest first so "US$" is not read as "S$" or "$". A bare "$" is ambiguous and decided later. */
const CUR_TOKEN = 'AU\\$|NZ\\$|US\\$|HK\\$|CA\\$|SG\\$|A\\$|S\\$|C\\$|\\$|€|£|¥|￥|円|₹|₩|฿|AUD|NZD|USD|SGD|HKD|CAD|EUR|GBP|JPY|CNY|RMB|CHF|THB|INR|KRW|MYR|IDR|PHP|AED|ZAR|SEK|NOK|DKK';
const CUR_OF = { 'AU$': 'AUD', 'A$': 'AUD', 'NZ$': 'NZD', 'US$': 'USD', 'HK$': 'HKD', 'CA$': 'CAD', 'C$': 'CAD', 'SG$': 'SGD', 'S$': 'SGD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '￥': 'JPY', '円': 'JPY', '₹': 'INR', '₩': 'KRW', '฿': 'THB', 'RMB': 'CNY' };
const DOLLAR = new Set(['AUD', 'NZD', 'USD', 'SGD', 'HKD', 'CAD']);
const codeOf = tok => { const t = String(tok || '').toUpperCase(); return t === '$' || !t ? '' : (CUR_OF[t] || CUR_OF[tok] || t); };
const NUM = '(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{2})?|\\d+\\.\\d{2}|\\d+)';
const TOTAL_RX = new RegExp(`(?<![a-z])(?:grand\\s+total|total\\s+paid|amount\\s+(?:paid|charged|due)|you\\s+paid|total)\\b[^\\d\\n$€£¥￥]{0,25}?(${CUR_TOKEN})?\\s?${NUM}(?:\\s?(${CUR_TOKEN}))?`, 'gi');
const ANY_AMOUNT_RX = new RegExp(`(${CUR_TOKEN})\\s?(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{2})?|\\d+(?:\\.\\d{2})?)`, 'g');
/* ISO codes and unambiguous symbols anywhere in the text (not the bare "$") */
const DOC_CUR_RX = new RegExp(`(?<![A-Za-z])(AU\\$|NZ\\$|US\\$|HK\\$|CA\\$|SG\\$|A\\$|S\\$|C\\$|€|£|¥|￥|円|₹|₩|฿|AUD|NZD|USD|SGD|HKD|CAD|EUR|GBP|JPY|CNY|RMB|CHF|THB|INR|KRW|MYR|IDR|PHP|AED|ZAR|SEK|NOK|DKK)(?![A-Za-z])`, 'g');

/* Which currency the receipt is in. tok: the marker next to the total ('' if none). Order: an explicit marker at the total,
   else the one currency the document names, else (bare "$" or nothing) AUD when the receipt shows an ABN or GST, else
   the user's home currency. A "$" total never becomes a non-dollar currency. */
function detectCurrency(text, tok, home) {
  const at = codeOf(tok);
  if (at) return at;
  const named = [...new Set([...String(text || '').matchAll(DOC_CUR_RX)].map(m => codeOf(m[1])))];
  const fit = tok === '$' ? named.filter(c => DOLLAR.has(c)) : named;
  if (fit.length === 1) return fit[0];
  if (/\bA\.?B\.?N\b|\bGST\b/i.test(text || '') && (tok === '$' || !named.length)) return 'AUD';
  return home;
}

const normAbn = s => { const d = String(s || '').replace(/[\s-]/g, ''); return /^\d{11}$/.test(d) ? d : ''; };
function findAbn(t) { const m = t.match(/\bA\.?B\.?N\.?[\s:#]*((?:\d[\s-]?){10}\d)(?!\d)/i); return m ? normAbn(m[1]) : ''; }
/* GST amount: "GST $10.00", "Includes GST of $10.00", "GST 10.00". "Total (incl. GST) $110.00" is the total, not the GST. */
function findGst(t) {
  for (const l of t.split(/\r?\n/)) {
    const at = l.search(/\bGST\b/i); if (at < 0) continue;
    if (/total/i.test(l) && /\b(inc|incl|including)\.?\s+gst\b(?!\s+of)/i.test(l)) continue;
    if (/\b(no|nil)\s+gst\b|gst[\s-]*free/i.test(l)) return 0;
    const m = l.slice(at).match(/(\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2})/);
    if (m) return parseFloat(m[1].replace(/,/g, ''));
  }
  return undefined;
}

function parseReceipt(text, cur) {
  cur = cur || 'AUD';
  const t = String(text || '').slice(0, 20000), out = {};
  const fwd = t.search(/forwarded message|original message/i);
  const fromRx = /^from:\s*(.+)$/im, subj = t.match(/^subject:\s*(.+)$/im);
  const from = (fwd >= 0 && t.slice(fwd).match(fromRx)) || t.match(fromRx);
  let v = from ? from[1].replace(/<[^>]*>/g, '').replace(/["']/g, '').trim() : '';
  if (!v && subj) v = subj[1].trim().slice(0, 60);
  out.vendor = v.slice(0, 60);
  let m = null, tok = '';
  for (const x of t.matchAll(TOTAL_RX)) if (x[1] || x[3] || /[.,]/.test(x[2])) m = x;
  if (m) tok = m[1] || m[3] || '';
  else { const all = [...t.matchAll(ANY_AMOUNT_RX)]; if (all.length) { const best = all.slice().sort((a, b) => parseFloat(b[2].replace(/,/g, '')) - parseFloat(a[2].replace(/,/g, '')))[0]; m = [null, best[1], best[2]]; tok = best[1]; } }
  if (m) { out.amount = parseFloat(String(m[2]).replace(/[,\s]/g, '')); out.currency = detectCurrency(t, tok, cur); }
  let d = t.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (d) out.date = `${d[1]}-${d[2]}-${d[3]}`;
  else if ((d = t.match(/\b(\d{1,2})[\/.](\d{1,2})[\/.](20\d{2})\b/))) out.date = `${d[3]}-${String(d[2]).padStart(2, '0')}-${String(d[1]).padStart(2, '0')}`;
  else if ((d = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(20\d{2})\b/i))) out.date = `${d[3]}-${String(MONTHS[d[2].toLowerCase().slice(0, 3)] + 1).padStart(2, '0')}-${String(d[1]).padStart(2, '0')}`;
  const hay = (subj ? subj[1] : '') + ' ' + v;
  out.category = (CAT_RX.find(([r]) => r.test(hay)) || [0, 'Other'])[1];
  const abn = findAbn(t); if (abn) out.abn = abn;
  const gst = findGst(t); if (gst !== undefined) out.gst = gst;
  if (t.trim()) out.taxInvoice = /\btax\s+invoice\b/i.test(t);
  return out;
}

const api = { parseReceipt, detectCurrency, normAbn };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HoggyParse = api;
})(typeof window !== 'undefined' ? window : globalThis);
