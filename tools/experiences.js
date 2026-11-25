'use strict';
/* "Make a trip of it": match a conference (city + dates) to experiences keyed by place and time
   (data/experiences/experiences.json, docs/research/experiences.md).

   experiencesFor(conference, { extraDays, experiences, categories, limit })
     -> experiences whose place is within reach of the conference city and whose season or event dates overlap
        [start - extraDays, end + extraDays], best first: fixed events first, then seasonal items, each scored.
   bestTrips(conferences, interests, { extraDays, from, experiences, limit })
     -> conferences ranked by how well their place and time match the given categories.

   Works in Node (require) and in the browser (window.HoggyExperiences; pass `experiences` yourself there). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HoggyExperiences = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const CATEGORIES = ['ski-snow', 'beach-surf', 'dive-reef', 'food-wine', 'nature-wildlife', 'hiking-outdoors',
    'culture-history', 'festival-event', 'sport-event', 'family', 'wellness', 'city-break'];
  const DAY = 86400000;
  const MAX_EXTRA_DAYS = 7;

  let cache = null;
  function loadExperiences() {
    if (cache) return cache;
    const fs = require('fs'), path = require('path');
    const doc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'experiences', 'experiences.json'), 'utf8'));
    cache = doc.experiences;
    return cache;
  }

  /* ---- dates ---- */
  const toDay = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY; // whole days since epoch
  const fromDay = d => new Date(d * DAY).toISOString().slice(0, 10);
  const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  function mdToDay(year, md) {
    let m = +md.slice(0, 2), d = +md.slice(3, 5);
    if (m === 2 && d === 29 && !isLeap(year)) d = 28;
    return toDay(`${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  /* Concrete [start, end] day intervals for an experience that could touch [lo, hi]. A seasonal range whose `from` is
     after its `to` wraps the year end (e.g. 11-01..03-31 is a southern-summer or northern-winter season). */
  function intervals(exp, lo, hi) {
    const s = exp.season || {};
    const out = [];
    if (Array.isArray(s.dates)) for (const r of s.dates) out.push([toDay(r.start), toDay(r.end || r.start)]);
    if (Array.isArray(s.ranges)) {
      const y0 = new Date(lo * DAY).getUTCFullYear() - 1, y1 = new Date(hi * DAY).getUTCFullYear();
      for (const r of s.ranges) for (let y = y0; y <= y1; y++) {
        const a = mdToDay(y, r.from);
        let b = mdToDay(y, r.to);
        if (r.to < r.from) b = mdToDay(y + 1, r.to);
        out.push([a, b]);
      }
    }
    return out.filter(([a, b]) => b >= lo && a <= hi);
  }
  function seasonLength(exp) {
    const s = exp.season || {};
    let n = 0;
    for (const r of s.dates || []) n += toDay(r.end || r.start) - toDay(r.start) + 1;
    for (const r of s.ranges || []) { const a = mdToDay(2027, r.from), b = r.to < r.from ? mdToDay(2028, r.to) : mdToDay(2027, r.to); n += b - a + 1; }
    return n;
  }

  /* ---- place ---- */
  function distanceKm(a, b) {
    if (![a.lat, a.lng, b.lat, b.lng].every(Number.isFinite)) return null;
    const R = 6371, t = x => x * Math.PI / 180;
    const dLat = t(b.lat - a.lat), dLng = t(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  const normCity = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/^tamaki makaurau /, '').replace(/,?\s*(d\.?c\.?)$/, '').replace(/[^a-z0-9]+/g, ' ').trim();

  /* -> { ok, distanceKm, by: 'distance' | 'name' }. Name match (city or a listed nearby town, same country) covers rows
     whose coordinates are missing or wrong. place.sameCountry limits a national item (a host-country event, a nationwide
     season) to conferences in that country, whatever the radius. */
  function placeMatch(conf, place) {
    const radius = place.radiusKm || 40;
    if (place.sameCountry && place.countryCode && conf.countryCode && place.countryCode !== conf.countryCode) return { ok: false, distanceKm: null };
    const d = distanceKm(conf, place);
    if (d != null && d <= radius) return { ok: true, distanceKm: Math.round(d), by: 'distance' };
    const c = normCity(conf.city);
    if (c && (!place.countryCode || !conf.countryCode || place.countryCode === conf.countryCode)) {
      const names = [place.city, ...(place.nearby || [])].map(normCity);
      if (names.includes(c)) return { ok: true, distanceKm: d != null && d <= radius * 3 ? Math.round(d) : null, by: 'name' };
    }
    return { ok: false, distanceKm: d == null ? null : Math.round(d) };
  }

  /* ---- conference location ----
     A few conference rows carry another city's coordinates (a copied row whose city was changed). When the dataset knows
     the conference's city (a place with the same city name and country) and the row's point is more than 100 km from it,
     the dataset's point is used instead, so a Gold Coast meeting is not matched to Melbourne events. */
  const gazCache = typeof WeakMap === 'function' ? new WeakMap() : null;
  function gazetteer(list) {
    if (gazCache && gazCache.has(list)) return gazCache.get(list);
    const g = new Map();
    for (const e of list) { const p = e.place || {}; const k = normCity(p.city) + '|' + p.countryCode; if (p.city && !g.has(k) && Number.isFinite(p.lat)) g.set(k, { lat: p.lat, lng: p.lng }); }
    if (gazCache) gazCache.set(list, g);
    return g;
  }
  function conferencePoint(conf, list) {
    const known = gazetteer(list).get(normCity(conf.city) + '|' + conf.countryCode);
    if (!known) return { lat: conf.lat, lng: conf.lng, corrected: false };
    const d = distanceKm(conf, known);
    if (d == null || d > 100) return { lat: known.lat, lng: known.lng, corrected: d != null };
    return { lat: conf.lat, lng: conf.lng, corrected: false };
  }

  /* ---- matching ---- */
  function clampExtra(n) { n = Math.round(Number(n) || 0); return Math.max(0, Math.min(MAX_EXTRA_DAYS, n)); }

  function experiencesFor(conference, opts) {
    opts = opts || {};
    const extraDays = clampExtra(opts.extraDays);
    const list = opts.experiences || loadExperiences();
    const cats = opts.categories && opts.categories.length ? new Set(opts.categories) : null;
    if (!conference || !conference.start) return [];
    const cs = toDay(conference.start), ce = toDay(conference.end || conference.start);
    const lo = cs - extraDays, hi = ce + extraDays;
    const pt = conferencePoint(conference, list);
    const where = { city: conference.city, countryCode: conference.countryCode, lat: pt.lat, lng: pt.lng };
    const out = [];
    for (const exp of list) {
      if (cats && !cats.has(exp.category)) continue;
      const pm = placeMatch(where, exp.place || {});
      if (!pm.ok) continue;
      const iv = intervals(exp, lo, hi);
      if (!iv.length) continue;
      // the interval that needs the fewest extra days wins
      let best = null;
      for (const [a, b] of iv) {
        const oa = Math.max(a, lo), ob = Math.min(b, hi);
        const during = a <= ce && b >= cs;
        const daysBefore = during ? 0 : (b < cs ? cs - b : 0), daysAfter = during ? 0 : (a > ce ? a - ce : 0);
        const need = daysBefore + daysAfter;
        if (!best || need < best.need) best = { a, b, oa, ob, during, daysBefore, daysAfter, need };
      }
      const fixed = exp.dateType === 'fixed-event';
      const len = seasonLength(exp);
      const radius = (exp.place && exp.place.radiusKm) || 40;
      let score = fixed ? 100 : 40 + Math.round(30 * Math.max(0, 1 - len / 365));
      if (best.during) score += 15; else score -= 3 * best.need;
      if (pm.distanceKm != null) score -= Math.round(10 * Math.min(1, pm.distanceKm / Math.max(radius, 1)));
      if (len >= 360) score -= 25; // year-round: nice to know, never the headline
      out.push(Object.assign({}, exp, {
        match: {
          kind: fixed ? 'event' : 'season',
          during: best.during,
          extraDaysNeeded: best.need,
          extraDaysBefore: best.daysBefore,
          extraDaysAfter: best.daysAfter,
          overlapStart: fromDay(best.oa),
          overlapEnd: fromDay(best.ob),
          dates: { start: fromDay(best.a), end: fromDay(best.b) },
          distanceKm: pm.distanceKm,
          placeMatchedBy: pm.by,
          locationCorrected: pt.corrected,
          score
        }
      }));
    }
    out.sort((x, y) => (y.match.kind === 'event') - (x.match.kind === 'event') || y.match.score - x.match.score ||
      x.match.dates.start.localeCompare(y.match.dates.start) || x.id.localeCompare(y.id));
    return opts.limit ? out.slice(0, opts.limit) : out;
  }

  /* Rank conferences by how well place and time fit the interests (categories). Score = best match + 0.5 x second +
     0.25 x third, +10 per distinct interest matched, so one strong fixed event or several good fits both rank well. */
  function bestTrips(conferences, interests, opts) {
    opts = opts || {};
    const extraDays = opts.extraDays == null ? 3 : clampExtra(opts.extraDays);
    const from = opts.from || new Date().toISOString().slice(0, 10);
    const cats = (interests || []).filter(c => CATEGORIES.includes(c));
    const list = opts.experiences || loadExperiences();
    const ranked = [];
    for (const conf of conferences || []) {
      if (!conf || !conf.start || (conf.end || conf.start) < from) continue;
      const m = experiencesFor(conf, { extraDays, experiences: list, categories: cats.length ? cats : null });
      if (!m.length) continue;
      const scores = m.map(e => e.match.score).sort((a, b) => b - a);
      const distinct = new Set(m.map(e => e.category)).size;
      const score = Math.round(scores[0] + 0.5 * (scores[1] || 0) + 0.25 * (scores[2] || 0) + 10 * (cats.length ? new Set(m.map(e => e.category).filter(c => cats.includes(c))).size : Math.min(distinct, 3)));
      ranked.push({ conference: conf, score, matches: m.slice(0, opts.perConference || 5) });
    }
    ranked.sort((a, b) => b.score - a.score || a.conference.start.localeCompare(b.conference.start));
    return opts.limit ? ranked.slice(0, opts.limit) : ranked;
  }

  return { CATEGORIES, MAX_EXTRA_DAYS, experiencesFor, bestTrips, loadExperiences, intervals, placeMatch, conferencePoint, distanceKm, normCity, toDay, fromDay };
});
