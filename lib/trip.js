/* "Make a trip of it": the conference comes first, then what is on around it, then the package (day plan, work and
   personal split, claim). Pure functions shared by the app (window.HoggyTrip), the server-rendered pages and the tests.

   - INTERESTS: the "what do you want to do" chips, mapped to experience categories and conference tags.
   - matchesFor / suggestTrips: conferences first (specialty, months, CPD), then experiences that fit (lib/experiences.js).
   - days / nights / split: the trip plan. Conference days are Work, added days are Personal (or Travel, if the user marks
     them), and costs are split the way most employers ask: registration and conference nights are work, fares follow the
     majority of days or are apportioned, day-to-day costs follow the day they were spent. General information only:
     tax and employer rules vary, and the user can override the fare rule and any receipt. */
(function (root) {
  'use strict';
  const DAY = 864e5, MAX_EXTRA = 7;
  const iso = d => d.toISOString().slice(0, 10);
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const between = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
  const round2 = n => Math.round(n * 100) / 100;

  /* experience categories: label and the app's icon name */
  const CATS = {
    'ski-snow': ['Ski and snow', 'snow'], 'beach-surf': ['Beach', 'wave'], 'dive-reef': ['Reef and diving', 'wave'], 'food-wine': ['Food and wine', 'glass'],
    'nature-wildlife': ['Nature and wildlife', 'leaf'], 'hiking-outdoors': ['Walks and outdoors', 'peak'], 'culture-history': ['Culture', 'col'],
    'festival-event': ['Festival', 'flag'], 'sport-event': ['Sport', 'ball'], family: ['Family', 'users'], wellness: ['Wellness', 'leaf'], 'city-break': ['City', 'col']
  };
  const catLabel = c => (CATS[c] || ['Something on'])[0];
  /* "what do you want to do": chips on Discover and Home. cats = experience categories; tags = conference tags (a meeting
     held at a ski resort fits "Ski & snow" by itself); family also takes experiences flagged family: true */
  const INTERESTS = [
    { key: 'ski', label: 'Ski & snow', cats: ['ski-snow'], tags: ['ski'] },
    { key: 'food', label: 'Food & wine', cats: ['food-wine'] },
    { key: 'festivals', label: 'Festivals', cats: ['festival-event', 'culture-history'] },
    { key: 'sport', label: 'Sport', cats: ['sport-event'] },
    { key: 'nature', label: 'Nature & wildlife', cats: ['nature-wildlife', 'hiking-outdoors', 'dive-reef'] },
    { key: 'beach', label: 'Beach', cats: ['beach-surf', 'dive-reef'], tags: ['beach'] },
    { key: 'family', label: 'Family', cats: ['family'], tags: ['family-friendly'], family: true }
  ];
  /* an interest by chip key, by label, or a bare experience category ("food-wine") */
  function interestOf(k) {
    const s = String(k || '').toLowerCase();
    return INTERESTS.find(i => i.key === s || i.label.toLowerCase() === s) || (CATS[s] ? { key: s, label: catLabel(s), cats: [s] } : null);
  }
  const expFits = (e, it) => it.cats.includes(e.category) || (!!it.family && e.family === true);
  const confFits = (c, it) => (it.tags || []).some(t => (c.tags || []).includes(t));

  /* ---------- matching: what is on around one conference ---------- */
  function X() { if (root.HoggyExperiences) return root.HoggyExperiences; if (typeof require === 'function') return require('./experiences.js'); return null; }
  /* experiencesFor, filtered to the interests (none = everything). Fixed events first, then seasons (the matcher's order). */
  function matchesFor(conf, opts) {
    opts = opts || {};
    const x = opts.X || X(); if (!x || !conf) return [];
    const its = (opts.interests || []).map(interestOf).filter(Boolean);
    const all = opts.cache ? opts.cache(conf, opts.extraDays) : x.experiencesFor(conf, { extraDays: opts.extraDays, experiences: opts.experiences });
    return its.length ? all.filter(e => its.some(it => expFits(e, it))) : all;
  }
  /* the one line a card carries: "+ Barossa Vintage Festival" */
  const headline = m => m && m.length ? '+ ' + m[0].title.replace(/\s+\d{4}$/, '') : '';

  /* Conference-first suggestions, for a future chat and for the Discover chips.
     q: { specialty, months: ['2027-04', 4, ...], interests: ['food', 'ski-snow', ...], cpdNeeds: { minHours, body }, extraDays = 3, from, limit = 10 }
     ctx: { conferences, experiences, X, cache } (Node defaults to the bundled data).
     1. Filter conferences: upcoming, specialty, months, and CPD (only credits the organiser has stated count: a meeting with
        no published CPD never passes a minHours need).
     2. Rank what is left by the experiences around it (and, for ski/beach/family, the meeting's own resort tags).
     An experience never lifts a conference that failed step 1. Returns [{ conference, score, matches, fits, line }]. */
  function suggestTrips(q, ctx) {
    q = q || {}; ctx = ctx || {};
    const x = ctx.X || X(), from = q.from || iso(new Date()), extraDays = q.extraDays == null ? 3 : clamp(q.extraDays, 0, MAX_EXTRA);
    let confs = ctx.conferences;
    if (!confs && typeof require === 'function') { const fs = require('fs'), path = require('path'), vm = require('vm'), w = {}; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'data', 'conferences.js'), 'utf8'), { window: w }); confs = w.HOGGY_CONFERENCES || []; }
    const months = (q.months || []).map(m => typeof m === 'number' ? m : /^\d{4}-\d{2}$/.test(String(m)) ? String(m) : null).filter(m => m != null);
    const spec = String(q.specialty || '').toLowerCase(), need = q.cpdNeeds || {}, minH = +need.minHours || 0, body = String(need.body || '').toLowerCase();
    const its = (q.interests || []).map(interestOf).filter(Boolean);
    const out = [];
    for (const c of confs || []) {
      if (!c || !c.start || (c.end || c.start) < from) continue;
      if (spec && String(c.specialty || '').toLowerCase() !== spec) continue;
      if (months.length && !months.some(m => typeof m === 'number' ? +c.start.slice(5, 7) === m : c.start.slice(0, 7) === m)) continue;
      if (minH && !(c.cpdVerified && +c.cpdHours >= minH)) continue;
      if (body && !(c.cpdVerified && String(c.cpdBody || '').toLowerCase().includes(body))) continue;
      const m = matchesFor(c, { extraDays, interests: q.interests, experiences: ctx.experiences, X: x, cache: ctx.cache });
      const tagFits = its.filter(it => confFits(c, it));
      if (its.length && !m.length && !tagFits.length) continue;
      if (!its.length && !m.length) continue;
      const s = m.map(e => e.match.score);
      const fits = its.length ? its.filter(it => tagFits.includes(it) || m.some(e => expFits(e, it))).map(it => it.key) : [];
      const score = Math.round((s[0] || 0) + .5 * (s[1] || 0) + .25 * (s[2] || 0) + 60 * tagFits.length + 10 * (its.length ? fits.length : Math.min(3, new Set(m.map(e => e.category)).size)));
      out.push({ conference: c, score, matches: m.slice(0, 3), fits, line: lineFor(c, m[0], tagFits[0]) });
    }
    out.sort((a, b) => b.score - a.score || a.conference.start.localeCompare(b.conference.start));
    return q.limit === 0 ? out : out.slice(0, q.limit || 10);
  }
  const D = (s, o) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-AU', Object.assign({ timeZone: 'UTC' }, o));
  function shortRange(a, b) {
    if (!b || a === b) return D(a, { day: 'numeric', month: 'short' });
    return a.slice(0, 7) === b.slice(0, 7) ? `${+a.slice(8)}–${D(b, { day: 'numeric', month: 'short' })}` : `${D(a, { day: 'numeric', month: 'short' })} – ${D(b, { day: 'numeric', month: 'short' })}`;
  }
  /* "ANZGOG ASM 2027, Adelaide 21–23 Apr: Barossa Vintage Festival 2027 (21–25 Apr, during the conference)" */
  function lineFor(c, e, tag) {
    const head = `${c.name}, ${c.city} ${shortRange(c.start, c.end)}`;
    if (e) { const m = e.match; return `${head}: ${e.title} (${e.dateType === 'fixed-event' ? shortRange(m.dates.start, m.dates.end) + ', ' : ''}${m.during ? 'during the conference' : '+' + m.extraDaysNeeded + (m.extraDaysNeeded === 1 ? ' day' : ' days') + (m.extraDaysAfter ? ' after' : ' before')})`; }
    return tag ? `${head}: held at a ${tag.key === 'ski' ? 'ski resort' : tag.key === 'beach' ? 'beach resort' : 'family-friendly venue'}` : head;
  }

  /* ---------- the trip plan ---------- */
  /* plan: { before, after (0..7 days), travel: [dates marked Travel], pins: [{ id, day, title, url, category }], fares: auto | work | apportion | personal } */
  function normPlan(p) {
    p = p || {};
    return { before: clamp(p.before, 0, MAX_EXTRA), after: clamp(p.after, 0, MAX_EXTRA), travel: Array.isArray(p.travel) ? p.travel.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)) : [],
      pins: Array.isArray(p.pins) ? p.pins.filter(x => x && x.id) : [], fares: ['work', 'apportion', 'personal'].includes(p.fares) ? p.fares : 'auto' };
  }
  const span = (c, p) => { p = normPlan(p); return { from: addDays(c.start, -p.before), to: addDays(c.end || c.start, p.after) }; };
  /* every day of the trip: conference days are Work; added days Personal, or Travel when the user marks them */
  function days(c, plan) {
    const p = normPlan(plan), { from, to } = span(c, p), out = [], end = c.end || c.start;
    for (let d = from, i = 0; d <= to && i < 60; d = addDays(d, 1), i++) {
      const conf = d >= c.start && d <= end;
      out.push({ date: d, kind: conf ? 'work' : p.travel.includes(d) ? 'travel' : 'personal', confDay: conf ? between(c.start, d) + 1 : 0, pins: p.pins.filter(x => x.day === d) });
    }
    return out;
  }
  const counts = ds => ds.reduce((a, d) => (a[d.kind]++, a), { work: 0, personal: 0, travel: 0 });
  const hasPersonal = (c, plan) => days(c, plan).some(d => d.kind === 'personal');
  /* nights of the stay (the night of each day but the last). A night is a work night when the next day is a conference
     day, or when it follows the last conference day and the next day is a travel day. */
  function nights(c, plan) {
    const ds = days(c, plan), out = [];
    for (let i = 0; i < ds.length - 1; i++) out.push({ date: ds[i].date, work: ds[i + 1].kind === 'work' || (ds[i].kind === 'work' && ds[i + 1].kind === 'travel') });
    return out;
  }
  const frac = (a, b) => `${a}/${b}`;
  /* the fare rule: majority of days, else apportioned; the user can choose instead. Travel days are left out of the count. */
  function fareRule(c, plan) {
    const p = normPlan(plan), n = counts(days(c, p)), tot = n.work + n.personal, share = tot ? n.work / tot : 1;
    if (p.fares === 'work') return { mode: 'work', share: 1, auto: false, text: 'Fares counted as work (your choice)' };
    if (p.fares === 'personal') return { mode: 'personal', share: 0, auto: false, text: 'Fares counted as personal (your choice)' };
    if (p.fares === 'apportion') return { mode: 'apportion', share, auto: false, text: `Fares apportioned ${frac(n.work, tot)}: work days ÷ work and personal days (your choice)` };
    if (!n.personal) return { mode: 'work', share: 1, auto: true, text: 'Fares counted as work: every day of the trip is a work day' };
    if (n.work > n.personal) return { mode: 'work', share: 1, auto: true, text: `Fares counted as work because most days are work days (${n.work} of ${tot}${n.travel ? '; travel days left out' : ''})` };
    return { mode: 'apportion', share, auto: true, text: `Fares apportioned ${frac(n.work, tot)} because work days are not the majority (${n.work} work, ${n.personal} personal${n.travel ? '; travel days left out' : ''})` };
  }
  const BOOKING_CAT = { Flight: 'Flights', Hotel: 'Accommodation', Registration: 'Registration', Transport: 'Ground transport' };
  /* one cost line -> { work, personal, rule }. item: { category, amount (home currency), date, personal (a portion the user entered) } */
  function splitItem(c, plan, item) {
    const amt = Math.max(0, +item.amount || 0), manual = Math.max(0, +item.personal || 0), cat = BOOKING_CAT[item.category] || item.category;
    const out = (share, rule) => { const w = round2(amt * share); return { work: w, personal: round2(amt - w), rule }; };
    if (manual > 0) { const per = Math.min(manual, amt); return { work: round2(amt - per), personal: round2(per), rule: 'Personal portion you entered' }; }
    if (!hasPersonal(c, plan)) return { work: amt, personal: 0, rule: '' };
    if (cat === 'Registration') return Object.assign(out(1, 'Registration: the conference itself'), { short: 'The conference itself' });
    if (cat === 'Flights') { const f = fareRule(c, plan), n = counts(days(c, plan)); return Object.assign(out(f.share, f.text), { short: f.mode === 'work' ? (f.auto ? 'Most days are work days' : 'All work (your choice)') : f.mode === 'personal' ? 'All personal (your choice)' : `Apportioned ${n.work}/${n.work + n.personal} by days` }); }
    if (cat === 'Accommodation') { const ns = nights(c, plan), w = ns.filter(x => x.work).length; return Object.assign(out(ns.length ? w / ns.length : 1, `${w} of ${ns.length} nights are conference nights`), { short: `${w} of ${ns.length} nights` }); }
    const d = item.date && days(c, plan).find(x => x.date === item.date);
    if (!d) return out(1, item.date ? 'Dated outside the trip: counted as work, check it' : 'No date: counted as work');
    return d.kind === 'personal' ? out(0, 'Spent on a personal day') : out(1, d.kind === 'travel' ? 'Spent on a travel day' : 'Spent on a conference day');
  }
  /* the whole costs panel: items -> lines with work and personal, and the totals */
  function split(c, plan, items) {
    const lines = (items || []).map(it => Object.assign({ item: it }, splitItem(c, plan, it)));
    const ds = days(c, plan), ns = nights(c, plan);
    return { lines, work: round2(lines.reduce((a, l) => a + l.work, 0)), personal: round2(lines.reduce((a, l) => a + l.personal, 0)), days: ds, counts: counts(ds),
      nights: { work: ns.filter(x => x.work).length, total: ns.length }, fare: fareRule(c, plan), personalDays: ds.filter(d => d.kind === 'personal').map(d => d.date) };
  }

  /* where an experience lands in the plan: the first day it overlaps, preferring a personal day; on a conference day it
     goes in the free time when the organiser states a session pattern, otherwise in the evening */
  function pinDay(c, plan, e) {
    const ds = days(c, plan), m = e.match || {}, a = (m.dates && m.dates.start) || c.start, b = (m.dates && m.dates.end) || a;
    const hit = ds.filter(d => d.date >= a && d.date <= b);
    return ((hit.find(d => d.kind !== 'work') || hit[0] || ds[0]) || {}).date || c.start;
  }
  const slotOf = (c, d) => d && d.kind === 'work' ? (c.schedule ? 'free time' : 'evening') : 'day';
  /* the extra days an experience needs: { before, after } on top of the current plan */
  function widenFor(c, plan, e) {
    const p = normPlan(plan), m = e.match || {};
    return { before: Math.max(p.before, clamp(m.extraDaysBefore, 0, MAX_EXTRA)), after: Math.max(p.after, clamp(m.extraDaysAfter, 0, MAX_EXTRA)) };
  }

  const api = { INTERESTS, CATS, MAX_EXTRA, catLabel, interestOf, expFits, confFits, matchesFor, headline, suggestTrips, lineFor, shortRange,
    normPlan, span, days, counts, nights, hasPersonal, fareRule, splitItem, split, pinDay, slotOf, widenFor, addDays, BOOKING_CAT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HoggyTrip = api;
})(typeof window !== 'undefined' ? window : globalThis);
