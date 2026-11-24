'use strict';
/* European Resuscitation Council course calendar, CoSy (https://cosy.erc.edu/en/sessions/calendar).
   The public calendar is a search form (no login): GET the list view for a session cookie + CSRF token, POST the form,
   follow the 302 back to the list view. One response holds every matching upcoming session worldwide as
   <div id="session-N" class="calendar-item">: title, course type, places, every course day with times, venue + country
   flag, languages, price(s). Searched once per "course kind" so each row gets a variant.
   Kept: ALS, ILS, EPALS, EPILS, NLS, ETC, GIC (clinician provider courses). Not kept: BLS/PBLS/BLS intro (basic/lay),
   BIC/EID/EMC/refresher seminars/YERC (instructor or educator days), instructor recertification, courses that say they
   are internal. Free-text organiser notes (names, phones, e-mails) are not copied.
   This is not a GET-only source, so it has its own tiny polite fetch (same UA, robots.txt, 3 s per host). */
const { decode, text, slug } = require('../util');
const { UA, robotsRules, robotsAllows, BlockedError } = require('../http');

const HOST = 'https://cosy.erc.edu';
const LIST = HOST + '/en/sessions/calendar/view-mode/list';
const KINDS = [['new course', 'full'], ['recertification-module', 'recertification']];
const TYPES = { ALS: 'erc-als', ILS: 'erc-ils', EPALS: 'erc-epals', EPILS: 'erc-epils', NLS: 'erc-nls', ETC: 'erc-etc', GIC: 'erc-gic' };
const INTERNAL = /\b(interne?n?|internal)\s+(cursus|course|kurs|schulung|training|fortbildung|formation|opleiding)\b|\binterne cursus\b|nur für (mitarbeiter|angestellte)|only for (staff|employees)|réservée? (au|aux) personnels?|alleen voor (medewerkers|personeel)/i;
const ISO2 = c => (c === 'gb' ? 'GB' : c.toUpperCase());

function courseTypeOf(h4, bold) {
  for (const src of [bold, h4]) {
    const m = String(src || '').match(/^\s*(ALS|ILS|EPALS|EPILS|NLS|ETC|GIC|BLS|PBLS|BIC|EID|EMC)\b/);
    if (m) return m[1];
  }
  return null;
}

function parseList(html, variant, { today, verifiedOn = today }) {
  const sessions = [], skipped = [];
  const parts = String(html).split(/<div id="session-(\d+)" class="calendar-item[^"]*">/);
  for (let k = 1; k < parts.length; k += 2) {
    const sid = parts[k], b = parts[k + 1].split(/<div id="session-\d+"/)[0];
    const h4 = text((b.match(/<h4>([\s\S]*?)<\/h4>/) || [])[1] || '').trim();
    const bold = text((b.match(/<p><b>([\s\S]*?)<\/b><\/p>/) || [])[1] || '').trim();
    const type = courseTypeOf(h4, bold);
    if (!type || !TYPES[type]) { skipped.push({ id: sid, reason: 'course type not kept: ' + (type || h4) }); continue; }
    const note = text((b.match(/class="readmore">([\s\S]*?)<\/p>/) || [])[1] || '');
    if (INTERNAL.test(note) || INTERNAL.test(h4)) { skipped.push({ id: sid, reason: 'course says it is internal' }); continue; }
    const dl = (b.match(/<label>Dates:<\/label>\s*<div class="calendar-item-list-items">([\s\S]*?)<\/div>/) || [])[1] || '';
    const days = [...dl.matchAll(/(\d{2})\/(\d{2})\/(\d{4})\s*-\s*\(([^)]*)\)/g)].map(m => ({ iso: `${m[3]}-${m[2]}-${m[1]}`, raw: m[0] }));
    if (!days.length) { skipped.push({ id: sid, reason: 'no dates' }); continue; }
    days.sort((a, b2) => a.iso.localeCompare(b2.iso));
    const start = days[0].iso, end = days[days.length - 1].iso;
    if (end < today) { skipped.push({ id: sid, reason: 'finished' }); continue; }
    if ((Date.parse(end) - Date.parse(start)) / 864e5 > 14) { skipped.push({ id: sid, reason: `course days spread over ${start}..${end} (>14 days, modular)` }); continue; }
    const vraw = (b.match(/<label>Venue:<\/label>\s*<div class="calendar-item-list-items">([\s\S]*?)<\/div>/) || [])[1] || '';
    const flag = (vraw.match(/flag-icon-([a-z]{2})/) || [])[1];
    const vlines = text(vraw).split('\n').map(x => x.trim()).filter(Boolean);
    if (!flag) { skipped.push({ id: sid, reason: 'no country on venue' }); continue; }
    const country = ISO2(flag);
    /* city: the line "street - ZIP City" (or "ZIP City"), else the line before the country */
    let city = '';
    for (let i = vlines.length - 2; i >= 0 && !city; i--) {
      const seg = vlines[i].split(/\s-\s/).pop().replace(/^[-\s]+/, '').trim();
      if (/^\S*\d\S*\s+\D/.test(seg)) city = seg.replace(/^(\S*\d\S*\s+)+/, '').replace(/\s*\(.*?\)\s*$/, '').trim();
    }
    if (!city && vlines.length >= 2) city = vlines[vlines.length - 2].split(/\s-\s/).pop().split(',').pop().trim();
    if (city && /^\p{Ll}/u.test(city)) city = city.charAt(0).toUpperCase() + city.slice(1);
    if (city && city === city.toUpperCase()) city = city.toLowerCase().replace(/(^|[\s/(\-])(\p{L})/gu, (m0, a1, c1) => a1 + c1.toUpperCase());
    const langs = text((b.match(/<label>Languages:<\/label>\s*<div class="calendar-item-list-items">([\s\S]*?)<\/div>/) || [])[1] || '').trim();
    const praw = text((b.match(/<label>price:<\/label>\s*<div class="calendar-item-list-items">([\s\S]*?)<\/div>/) || [])[1] || '');
    const prices = [...praw.matchAll(/(\d[\d.,]*)\s*([A-Z]{3})\b/g)].map(m => ({ n: +m[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'), c: m[2] })).filter(p => p.n > 0);
    const pl = b.match(/Places still available:\s*<strong>(\d+)<\/strong>\s*out of\s*(\d+)/);
    const online = /Enroll online/.test(b);
    const low = prices.length ? prices.reduce((a, p) => (p.n < a.n ? p : a)) : null;
    sessions.push({
      id: slug(TYPES[type], variant, country, city, start, sid), courseId: TYPES[type], variant,
      provider: 'ERC course organiser (CoSy)', city: city || vlines[0] || country, region: country === 'GB' ? 'UK' : country, country,
      venue: vlines.slice(0, -1).join(', ') || null, start, end, endInferred: false,
      priceFrom: low ? low.n : null, currency: low ? low.c : null,
      ...(prices.length > 1 ? { priceNote: 'lowest of the prices listed on the session (others: ' + prices.filter(p => p !== low).map(p => p.n + ' ' + p.c).join(', ') + ')' } : /free of charge/i.test(praw) ? { priceNote: 'listed as free of charge (often staff-only)' } : {}),
      seatsStatus: pl ? (+pl[1] === 0 ? 'full' : 'open') : null, placesRemaining: pl ? +pl[1] : null, placesTotal: pl ? +pl[2] : null,
      languages: langs ? langs.split(/,\s*/) : [],
      ...(h4 && !/^(ALS|ILS|EPALS|EPILS|NLS|ETC|GIC)\s*\(/.test(h4) ? { sessionTitle: h4.slice(0, 120) } : {}),
      bookingUrl: online ? `${HOST}/en/login?origin=session-enroll&session-id=${sid}` : `${HOST}/en/sessions/mail/id/${sid}`,
      bookingUrlNote: online ? 'CoSy "Enroll online" (needs a free CoSy account)' : 'CoSy "Contact organiser" form; the course says to contact the organiser to enrol',
      sourceUrl: LIST,
      datesQuote: `${h4.slice(0, 60)} | Dates: ${days.map(d => d.raw).join(' ')}`.replace(/\s+/g, ' ').slice(0, 200),
      lastVerified: verifiedOn, datesConfirmed: true,
      sourceKind: 'ERC CoSy public course calendar (search form, list view; sessions entered by ERC course organisers)',
      sourceRef: 'erc-cosy:' + sid
    });
  }
  return { sessions, skipped, items: (parts.length - 1) / 2 };
}

/* minimal polite client with a cookie jar (CoSy keeps the search in the session) */
function makeFormClient({ gapMs = 3000, log = () => {}, fetchImpl = globalThis.fetch } = {}) {
  let last = 0, rules = null; const jar = new Map();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function req(url, opts = {}) {
    const d = last + gapMs - Date.now(); if (d > 0) await sleep(d); last = Date.now();
    const headers = { 'User-Agent': UA, Accept: 'text/html', ...(opts.headers || {}) };
    if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const r = await fetchImpl(url, { ...opts, headers, redirect: 'manual' });
    for (const c of (r.headers.getSetCookie ? r.headers.getSetCookie() : [])) { const m = c.match(/^([^=;]+)=([^;]*)/); if (m) jar.set(m[1], m[2]); }
    const body = await r.text();
    if (r.headers.get('cf-mitigated') || /<title>\s*Just a moment|challenge-platform|captcha/i.test(body.slice(0, 5000)) && r.status >= 400) throw new BlockedError('bot challenge at ' + url, 'challenge');
    if (r.status === 401 || r.status === 403) throw new BlockedError(`HTTP ${r.status} at ${url}`, 'forbidden');
    log(`${opts.method || 'GET'} ${url} -> ${r.status} (${body.length} bytes)`);
    return { status: r.status, body, location: r.headers.get('location') };
  }
  async function allowed(url) {
    if (!rules) { try { const r = await req(HOST + '/robots.txt'); rules = r.status === 200 ? robotsRules(r.body) : []; } catch { rules = []; } }
    const u = new URL(url); return robotsAllows(rules, u.pathname + u.search);
  }
  return { req, allowed };
}

async function fetchAll({ today, verifiedOn = today, log = () => {}, fetchImpl } = {}) {
  const c = makeFormClient({ log, fetchImpl });
  if (!(await c.allowed(LIST))) throw new BlockedError('robots.txt disallows ' + LIST, 'robots');
  const [y, m, d] = today.split('-');
  const out = [], skipped = [], perKind = {};
  for (const [kind, variant] of KINDS) {
    const g = await c.req(LIST);
    const csrf = (g.body.match(/name="__csrf__" id="sessionSearchForm-__csrf__" value="([^"]+)"/) || [])[1];
    const check = (g.body.match(/name="__check__" id="sessionSearchForm-__check__" value="([^"]+)"/) || [])[1];
    if (!csrf || !check) throw new Error('CoSy search form not found (layout change?)');
    const form = new URLSearchParams();
    form.append('__check__', decode(check)); form.append('__csrf__', decode(csrf));
    form.append('courseKind[]', kind); form.append('dateFrom', `${d}/${m}/${y}`); form.append('location[range]', '10');
    const p = await c.req(LIST, { method: 'POST', body: form.toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    /* the 302 goes to the default (tiles) view, which pages; the list view holds every match */
    const page = p.status === 302 ? await c.req(LIST) : p;
    const r = parseList(page.body, variant, { today, verifiedOn });
    perKind[kind] = { items: r.items, kept: r.sessions.length };
    out.push(...r.sessions); skipped.push(...r.skipped);
    log(`erc kind=${kind}: ${r.items} items, kept ${r.sessions.length}`);
  }
  /* a session can match more than one kind search; keep the first (full course before recertification) */
  const seen = new Set(), sessions = out.filter(s => !seen.has(s.sourceRef) && seen.add(s.sourceRef));
  return { sessions, skipped, perKind };
}

module.exports = { fetchAll, parseList, courseTypeOf, TYPES, LIST };
