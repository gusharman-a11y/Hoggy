'use strict';
/* Resuscitation Council UK (www.resus.org.uk): each course page embeds a Drupal view "course_availability"
   (Course centre town | Course centre | Start date | Organiser | Availability), 5 rows a page, paged with ?page=N.
   Only a start date is printed; the end is derived from the course length the same page states and flagged endInferred.
   Organiser names/phones/e-mails are NOT copied (personal data); the course centre is the provider.
   parse(html, course, { today, verifiedOn, pageUrl }) -> { sessions, lastPage, skipped } */
const { text, slug, addDays } = require('../util');

const BASE = 'https://www.resus.org.uk/training-courses/';
/* path, catalogue id, variant, length in days (from the course page), the page's own words for that length */
const COURSES = [
  { path: 'adult-life-support/als-2-day-course-advanced-life-support', courseId: 'rcuk-als', variant: 'full', days: 2, lengthQuote: 'This is a two day face-to-face course' },
  { path: 'adult-life-support/als-recertification-advanced-life-support', courseId: 'rcuk-als', variant: 'recertification', days: 1, lengthQuote: 'one day course that will take place in a Resuscitation Council UK Course Centre' },
  { path: 'adult-life-support/als-recertification-short-course-advanced-life-support', courseId: 'rcuk-als', variant: 'short-recertification', days: 1, lengthQuote: 'half-day course' },
  { path: 'adult-life-support/e-als-advanced-life-support', courseId: 'rcuk-als', variant: 'e-als', days: 1, lengthQuote: 'one day of e-learning, which is done in your own time, before attending a one-day face-' },
  { path: 'adult-life-support/oh-als-2-day-course-out-hospital-advanced-life-support-course', courseId: 'rcuk-oh-als', variant: 'full', days: 2, lengthQuote: 'OH-ALS: 2 Day Course (Out-of-Hospital Advanced Life Support)' },
  { path: 'adult-life-support/feel-focused-echocardiography-emergency-life-support', courseId: 'rcuk-feel', variant: 'full', days: 1, lengthQuote: 'one-day course' },
  { path: 'newborn-life-support/nls-newborn-life-support', courseId: 'rcuk-nls', variant: 'full', days: 1, lengthQuote: 'one-day course and will take place in a Course Centre' },
  { path: 'newborn-life-support/nls-recertification-newborn-life-support-course', courseId: 'rcuk-nls', variant: 'recertification', days: 1, lengthQuote: null },
  { path: 'newborn-life-support/arni-advanced-resuscitation-newborn-infant', courseId: 'rcuk-arni', variant: 'full', days: 2, lengthQuote: 'two-day course and will take place in a Course Centre' },
  { path: 'newborn-life-support/oh-nls-out-hospital-newborn-life-support', courseId: 'rcuk-oh-nls', variant: 'full', days: 1, lengthQuote: 'one-day course' },
  { path: 'paediatric-life-support/epals-european-paediatric-advanced-life-support', courseId: 'rcuk-epals', variant: 'full', days: 2, lengthQuote: 'Over two days' },
  { path: 'instructor-courses/ilsi-immediate-life-support-instructor-course', courseId: 'rcuk-ilsi', variant: 'full', days: 1, lengthQuote: 'one-day course' }
];

const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
/* "Saturday <br /> 21 Nov. '26" -> 2026-11-21 */
function rcukDate(cell) {
  const m = String(cell).match(/(\d{1,2})\s+([A-Za-z]{3,4})\.?\s+'(\d{2})/);
  if (!m || !MON[m[2].toLowerCase()]) return null;
  const iso = `20${m[3]}-${String(MON[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(iso + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === iso ? iso : null;
}

/* UK course centres are almost all in the UK; these towns on the RCUK list are not. Anything else is GB. */
const NON_UK = { gibraltar: 'GI', 'st helier': 'JE', jersey: 'JE', guernsey: 'GG', 'st peter port': 'GG', douglas: 'IM', 'isle of man': 'IM', dublin: 'IE', cork: 'IE', galway: 'IE', limerick: 'IE', dubai: 'AE', 'abu dhabi': 'AE', doha: 'QA', riyadh: 'SA', jeddah: 'SA', muscat: 'OM', manama: 'BH', kuwait: 'KW', valletta: 'MT', msida: 'MT', 'hong kong': 'HK', singapore: 'SG', cyprus: 'CY', nicosia: 'CY', limassol: 'CY', akrotiri: 'CY', episkopi: 'CY' };

function parse(html, course, { today, verifiedOn = today, pageUrl } = {}) {
  const sessions = [], skipped = [];
  const lp = String(html).match(/href="\?page=(\d+)" title="Go to last page"/);
  const lastPage = lp ? +lp[1] : 0;
  /* the paged table follows the search form; the "next course near you" block uses views-row divs, not <tr> */
  const tbody = (String(html).match(/<tbody>([\s\S]*?)<\/tbody>/g) || []).filter(b => /views-field-field-start-date-1/.test(b));
  for (const b of tbody) for (const tr of b.match(/<tr[\s\S]*?<\/tr>/g) || []) {
    const cell = name => { const m = tr.match(new RegExp(`views-field-${name}"[^>]*>([\\s\\S]*?)<\\/td>`)); return m ? m[1] : ''; };
    const town = text(cell('field-course-centre-town')).replace(/\s+/g, ' ').trim();
    const centre = text(cell('field-course-centre')).replace(/\s+/g, ' ').trim();
    const dateCell = text(cell('field-start-date-1')).replace(/\s+/g, ' ').trim();
    const avail = text(cell('nothing')).replace(/\s+/g, ' ').trim();
    const start = rcukDate(dateCell);
    if (!start) { skipped.push({ reason: 'no date', town, centre, dateCell }); continue; }
    const end = addDays(start, course.days - 1);
    if (end < today) { skipped.push({ reason: 'finished', town, start }); continue; }
    const cand = (avail.match(/Candidates:\s*([^\n]*?)(?:\s+Faculty:|$)/i) || [])[1] || '';
    const seatsStatus = /full/i.test(cand) ? 'full' : /wait/i.test(cand) ? 'waitlist' : /available/i.test(cand) ? 'open' : null;
    const country = NON_UK[town.toLowerCase()] || 'GB';
    const s = {
      id: slug(course.courseId, course.variant, town, start, centre), courseId: course.courseId, variant: course.variant,
      provider: centre, city: town, region: country === 'GB' ? 'UK' : country, country, venue: null, start, end,
      endInferred: course.days > 1,
      ...(course.days > 1 ? { endNote: `RCUK lists only the start date; the course page says it is a ${course.days}-day course ("${course.lengthQuote}"), so end = start + ${course.days - 1} (assumes consecutive days)` } : {}),
      priceFrom: null, currency: null, seatsStatus,
      ...(cand ? { availabilityText: 'Candidates: ' + cand.trim() } : {}),
      bookingUrl: BASE + course.path, bookingUrlNote: 'RCUK lists the course centre and an organiser contact (not copied); book with the centre',
      sourceUrl: pageUrl || BASE + course.path,
      datesQuote: `${town} | ${centre} | ${dateCell}`.slice(0, 200),
      lastVerified: verifiedOn, datesConfirmed: true,
      sourceKind: 'Resuscitation Council UK course page, course availability table (RCUK-approved course centres)'
    };
    sessions.push(s);
  }
  return { sessions, lastPage, skipped };
}

async function fetchAll(client, { today, verifiedOn = today, log = () => {}, save } = {}) {
  const out = [], skipped = [], blocked = [], perCourse = {};
  for (const c of COURSES) {
    let page = 0, last = 0, n = 0;
    do {
      const url = BASE + c.path + (page ? `?page=${page}` : '');
      let html;
      try { html = await client.get(url); } catch (e) { blocked.push({ url, error: e.message }); break; }
      if (save) save(url, html);
      const r = parse(html, c, { today, verifiedOn, pageUrl: url });
      if (page === 0) last = r.lastPage;
      out.push(...r.sessions); skipped.push(...r.skipped); n += r.sessions.length;
      log(`rcuk ${c.courseId}/${c.variant} page ${page}/${last}: ${r.sessions.length}`);
      page++;
    } while (page <= last);
    perCourse[`${c.courseId}/${c.variant}`] = n;
  }
  return { sessions: out, skipped, blocked, perCourse };
}

module.exports = { parse, fetchAll, COURSES, rcukDate, BASE };
