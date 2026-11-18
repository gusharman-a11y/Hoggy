'use strict';
/* Royal College of Surgeons of England (www.rcseng.ac.uk).
   1. Course list: the site's own JSON endpoint behind /education-and-exams/courses/search/
      /api/coursesapi/getcourses/?Surgical=True&Dental=False&Page=N  (10 a page, moreResultsAvailable/nextPage).
   2. Each course page with availableDates lists every session as a "bookingRow": durationFrom/durationTo (weekday, day,
      month, year), price, location, address, Limited / Fully booked. Rows sit under two tabs: "Approved regional courses"
      (#regionalTab, run by approved centres) and "Royal College Of Surgeons courses" (#rcsTab).
   Coordinator names/e-mails are not copied. */
const { text, slug } = require('../util');

const HOST = 'https://www.rcseng.ac.uk';
const API = HOST + '/api/coursesapi/getcourses/?Surgical=True&Dental=False';

/* course title -> catalogue id/variant. Unlisted titles get id "rcseng-<slug>" (reported as new course types). */
const MAP = [
  [/ATLS\)? Provider/i, 'atls', 'full'],
  [/ATLS\)? Virtual Reverification/i, 'atls', 'virtual-reverification'],
  [/ATLS\)? Reverification/i, 'atls', 'reverification'],
  [/ATLS\)? Instructor/i, 'atls', 'instructor'],
  [/CCrISP.*Provider/i, 'ccrisp', 'full'],
  [/CCrISP.*Instructor/i, 'ccrisp', 'instructor'],
  [/Basic Surgical Skills/i, 'bss', 'full'],
  [/ATNC\)? Provider/i, 'atnc', 'full'],
  [/ATNC\)? Instructor/i, 'atnc', 'instructor'],
  [/Core Skills in Laparoscopic Surgery/i, 'rcseng-cslap', 'full'],
  [/Intermediate Skills in Laparoscopic Surgery/i, 'rcseng-islap', 'full'],
  [/Definitive Surgical Trauma Skills/i, 'dsts', 'full'],
  [/Resuscitative Thoracotomy \(PERT\)/i, 'rcseng-pert', 'full'],
  [/Specialty Skills in Emergency Surgery and Trauma/i, 'rcseng-sset', 'full'],
  [/Surgical Skills for Students and Health Professionals/i, 'rcseng-ssshp', 'full'],
  [/Step up your surgical responsibility/i, 'rcseng-step-up', 'full'],
  /* not clinical-skills courses (faculty development, exam revision, professionalism webinars): not kept */
  [/supervisor toolkit|Surgical Supervision|revision toolkit|Professional Behaviours in Aesthetic Surgery/i, null, null]
];
function classify(title) {
  for (const [re, id, variant] of MAP) if (re.test(title)) return { courseId: id, variant };
  const base = String(title).replace(/\(([A-Z][A-Za-z]{1,8})\)/g, '').replace(/\b(course|0\d[A-Z]|1\d[A-Z]|\d\dE)\b/gi, '').trim();
  return { courseId: 'rcseng-' + slug(base).slice(0, 50).replace(/-+$/, ''), variant: 'full', unmapped: true };
}

const COUNTRY = { 'united kingdom': 'GB', ireland: 'IE', india: 'IN', bahrain: 'BH', malaysia: 'MY', 'sri lanka': 'LK', egypt: 'EG', 'saudi arabia': 'SA', 'united arab emirates': 'AE', qatar: 'QA', oman: 'OM', kuwait: 'KW', pakistan: 'PK', nigeria: 'NG', ghana: 'GH', kenya: 'KE', 'hong kong': 'HK', singapore: 'SG', malta: 'MT', greece: 'GR', cyprus: 'CY', jordan: 'JO', iraq: 'IQ', bangladesh: 'BD', nepal: 'NP' };
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function blockDate(html) {
  const g = k => { const m = String(html).match(new RegExp(`class="${k}">\\s*([^<]*?)\\s*<`)); return m ? m[1].trim() : ''; };
  const d = g('day'), mo = g('month'), y = g('year'), wd = g('weekday');
  const n = MON[mo.slice(0, 3).toLowerCase()]; if (!n || !/^\d{1,2}$/.test(d) || !/^\d{4}$/.test(y)) return null;
  const iso = `${y}-${String(n).padStart(2, '0')}-${d.padStart(2, '0')}`;
  return { iso, label: `${wd} ${d} ${mo} ${y}`.trim() };
}

function parseCoursePage(html, course, { today, verifiedOn = today, pageUrl }) {
  const sessions = [], skipped = [];
  const H = String(html), rcsAt = H.indexOf('id="rcsTab"');
  const parts = H.split(/<div class="bookingRow/).slice(1);
  let pos = H.indexOf('<div class="bookingRow');
  const kind = classify(course.title);
  if (!kind.courseId) return { sessions, skipped: [{ reason: 'course not kept (not a clinical-skills course)', course: course.title }] };
  for (const p of parts) {
    const at = pos; pos = H.indexOf('<div class="bookingRow', pos + 10);
    const from = p.match(/durationDate durationFrom">([\s\S]*?)<\/div>\s*<\/div>/), to = p.match(/durationDate durationTo">([\s\S]*?)<\/div>\s*<\/div>/);
    const s1 = from && blockDate(from[1] + '</div>'), s2 = to && blockDate(to[1] + '</div>');
    if (!s1) { skipped.push({ reason: 'no date', course: course.title }); continue; }
    const start = s1.iso, end = s2 ? s2.iso : s1.iso;
    if (end < today) { skipped.push({ reason: 'finished', course: course.title, start }); continue; }
    const price = (p.match(/class="optionPrice">\s*([\s\S]*?)<button/) || [])[1];
    const priceTxt = price ? text(price).trim() : '';
    const pm = priceTxt.match(/£\s?([\d,]+(?:\.\d\d)?)/);
    const loc = text((p.match(/class="optionLocation">\s*([\s\S]*?)<button/) || [])[1] || '').trim();
    const addr = text((p.match(/<address>([\s\S]*?)<\/address>/) || [])[1] || '').split('\n').map(x => x.trim()).filter(x => x && !/@|^(tel|phone)\b/i.test(x));
    let [city] = loc.split(/,\s*/);
    if (/@/.test(city || '')) city = city.split('@').pop().trim();
    const full = /class="(btn )?soldOut">\s*Fully booked/.test(p), limited = /class="limited">\s*Limited/.test(p);
    const regional = rcsAt < 0 || at < rcsAt;
    const cityN = city ? city.toLowerCase().replace(/(^|[\s(\-])([a-z])/g, (m, a, c) => a + c.toUpperCase()) : '';
    const parts = loc.split(/,\s*/), last = parts[parts.length - 1] || '';
    const cn = (COUNTRY[last.toLowerCase()] ? last : '') || addr.find(x => COUNTRY[x.toLowerCase()]) || '';
    let country = COUNTRY[cn.toLowerCase()] || null;
    if (!country && addr.some(x => /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(x))) country = 'GB'; /* UK postcode on the address */
    if (!country) { skipped.push({ reason: 'no location/country on the row: ' + (loc || '(blank)'), course: course.title, start }); continue; }
    sessions.push({
      id: slug(kind.courseId, kind.variant, cityN, start, regional ? 'regional' : 'rcs'), courseId: kind.courseId, variant: kind.variant,
      provider: regional ? 'RCS England approved regional centre' : 'Royal College of Surgeons of England',
      city: cityN, region: country === 'GB' ? 'UK' : (parts.length > 2 ? parts[parts.length - 2].replace(/\b\w+/g, w => w[0] + w.slice(1).toLowerCase()) : country), country, venue: addr.length ? addr.join(', ') : null,
      start, end, endInferred: false,
      priceFrom: pm ? +pm[1].replace(/,/g, '') : null, currency: pm ? 'GBP' : null,
      ...(pm ? { priceNote: 'full price shown for this session on the RCS England course page' + (regional ? ' (regional centre fee)' : '; member discounts listed') } : {}),
      seatsStatus: full ? 'full' : 'open', ...(limited ? { availabilityText: 'Limited' } : {}),
      bookingUrl: pageUrl, ...(regional ? { bookingUrlNote: 'regional course: RCS England says regional places cannot be booked on its site; the page gives the centre coordinator (not copied)' } : {}),
      sourceUrl: pageUrl, courseTitle: course.title,
      datesQuote: `${course.title} | ${s1.label}${s2 ? ' - ' + s2.label : ''} | ${loc}`.slice(0, 200),
      lastVerified: verifiedOn, datesConfirmed: true,
      sourceKind: 'RCS England course page booking options (' + (regional ? 'Approved regional courses' : 'Royal College Of Surgeons courses') + ')',
      sourceRef: 'rcseng:' + (course.sku || course.url) + ':' + start + ':' + slug(addr[0] || cityN)
    });
  }
  /* course-level facts as printed on the page (for the catalogue), quoted verbatim */
  const plain = text(H).replace(/\s+/g, ' ');
  const fm = plain.match(/(£[\d,]+\.\d\d) (\d+(?:\.\d)?) Days? ([\d.]+) CPD points/);
  const suit = (plain.match(/Suitability (This course is [^.]{10,300}\.)/) || [])[1];
  const facts = { title: course.title, url: pageUrl, ...(fm ? { lengthQuote: fm[0], priceFrom: fm[1], days: +fm[2], cpdPoints: +fm[3] } : {}), ...(suit ? { suitabilityQuote: suit } : {}) };
  return { sessions, skipped, facts };
}

async function fetchAll(client, { today, verifiedOn = today, log = () => {} } = {}) {
  const courses = [], sessions = [], skipped = [], blocked = [], perCourse = {};
  let page = 1, more = true;
  while (more && page < 20) {
    const url = API + (page > 1 ? `&Page=${page}` : '');
    let j; try { j = JSON.parse(await client.get(url)); } catch (e) { blocked.push({ url, error: e.message }); break; }
    courses.push(...((j.result && j.result.courses) || []));
    more = !!j.moreResultsAvailable && j.nextPage > page; page = j.nextPage || page + 1;
  }
  log(`rcseng: ${courses.length} courses in the list`);
  const seen = new Set();
  for (const c of courses) {
    if (!c.url || seen.has(c.url) || !(c.availableDates || []).length || c.isOnlineCourse) continue; seen.add(c.url);
    const url = HOST + c.url;
    let html; try { html = await client.get(url); } catch (e) { blocked.push({ url, error: e.message }); continue; }
    const r = parseCoursePage(html, c, { today, verifiedOn, pageUrl: url });
    sessions.push(...r.sessions); skipped.push(...r.skipped);
    perCourse[c.title] = { sessions: r.sessions.length, listedDates: c.availableDates.length, courseId: classify(c.title).courseId, facts: r.facts };
    log(`rcseng ${c.title}: ${r.sessions.length} (list shows ${c.availableDates.length} dates)`);
  }
  return { courses, sessions, skipped, blocked, perCourse };
}

module.exports = { fetchAll, parseCoursePage, classify, API };
