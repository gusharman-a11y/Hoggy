/* Hoggy home page facts (computed from the conference list) and travel search links. Shared by the browser (window.HoggyStats) and tests.
   Honest numbers only: counts are exact, percentages are rounded DOWN, nothing is padded. */
(function (root) {
'use strict';
function homeStats(list, todayIso) {
  const all = Array.isArray(list) ? list : [];
  const up = todayIso ? all.filter(c => c && c.end >= todayIso) : all;
  const confirmed = up.filter(c => c.datesConfirmed !== false && c.sourceUrl).length;
  return {
    conferences: up.length,
    countries: new Set(up.map(c => c.countryCode).filter(Boolean)).size,
    specialties: new Set(up.map(c => c.specialty).filter(Boolean)).size,
    confirmed,
    confirmedPct: up.length ? Math.floor(confirmed / up.length * 100) : 0
  };
}
/* A few upcoming conferences with organiser-confirmed dates, soonest first, one per specialty. */
function exampleConfs(list, todayIso, n) {
  const seen = new Set(), out = [];
  const L = (Array.isArray(list) ? list : []).filter(c => c && c.end >= todayIso && c.datesConfirmed !== false && c.sourceUrl).sort((a, b) => a.start.localeCompare(b.start));
  for (const c of L) { if (seen.has(c.specialty)) continue; seen.add(c.specialty); out.push(c); if (out.length >= (n || 4)) break; }
  return out;
}
/* Prefilled search links (Hoggy does not book). Google Flights reads "Flights to X from Y on DATE through DATE". */
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function travelLinks(c, from) {
  const q = encodeURIComponent, where = c.city + ', ' + c.country, out = c.start, back = c.end > c.start ? c.end : addDays(c.start, 1), f = String(from || '').trim();
  return {
    flights: `https://www.google.com/travel/flights?q=${q(`Flights to ${where} ${f ? 'from ' + f + ' ' : ''}on ${out} through ${back}`)}&hl=en`,
    hotels: `https://www.booking.com/searchresults.html?ss=${q(where)}&checkin=${out}&checkout=${back}&group_adults=1&no_rooms=1`,
    stays: `https://www.google.com/travel/hotels/${q(c.city)}?q=${q('hotels in ' + where)}&dates=${out},${back}`
  };
}
const api = { homeStats, exampleConfs, travelLinks, addDays };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HoggyStats = api;
})(typeof window !== 'undefined' ? window : globalThis);
