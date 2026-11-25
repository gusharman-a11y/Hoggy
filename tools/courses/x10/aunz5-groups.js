'use strict';
/* Provider groups for tools/courses/x10/aunz5-build.js (data wave 5). Each group reads cached pages only and returns
   { courses, sessions, note }. See aunz5-build.js for the rules. */
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const TZ = '(?:AC[SD]T|AE[SD]T|AW[SD]T|NZ[SD]T)';

module.exports = ({ idx, page, pageText, lines, ev, onPage, warnings, today, slug, addDays, decode, iso }) => {
  const groups = {};
  const mon = s => MON[String(s).slice(0, 3).toLowerCase()];

  /* Humanitix event page (the provider's own booking page): the event's dates are the calendar links at the top of the page
     ("Sat, 22 May 2027, 8:30am - 5pm ACST , opens in new tab"; two-day: "Thu, 25 Feb, 8:30am - Fri, 26 Feb, 5pm 2027 ACDT").
     Lines further down belong to the host's other events and are not used. A line with no year takes the year in the event
     title (yearInferred, with a yearNote). Venue = the lines under "Location". */
  function humanitix(u, def) {
    const L = lines(u), title = (L[0] || '').replace(/\s*\|.*$/, '').trim(), out = [];
    const li = L.indexOf('Location');
    if (li < 0) { warnings.push('humanitix: no Location on ' + u); return out; }
    const loc = L.slice(li + 1, li + 4).filter(l => !/^Get directions$/.test(l));
    const addr = loc.find(l => /, (Australia|New Zealand)$/.test(l));
    const venueName = loc[0] && loc[0] !== addr ? loc[0] : null;
    const venue = [venueName, addr && addr.replace(/, (Australia|New Zealand)$/, '')].filter(Boolean).join(', ').split(', ').filter((x, i, a) => i === 0 || x !== a[i - 1]).join(', ');
    if (def.townRe && !def.townRe.test(loc.join(' '))) { warnings.push(`humanitix: venue not in ${def.city} on ${u}: ${loc.join(' / ')}`); return out; }
    const titleYear = (title.match(/\b(20\d\d)\b/) || [])[1];
    const dl = L.slice(0, li).filter(l => /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), .*, opens in new tab$/.test(l));
    for (const l of [...new Set(dl)]) {
      const d = l.replace(/ , opens in new tab$/, '');
      let m, start, end, yi = false;
      if ((m = d.match(new RegExp(`^\\w{3}, (\\d{1,2}) (\\w{3}) (\\d{4}), [^,]+ ${TZ}$`)))) start = end = iso(m[3], mon(m[2]), m[1]);
      else if ((m = d.match(new RegExp(`^\\w{3}, (\\d{1,2}) (\\w{3}), [^-]+ - \\w{3}, (\\d{1,2}) (\\w{3}), \\S+ (\\d{4}) ${TZ}$`)))) { start = iso(m[5], mon(m[2]), m[1]); end = iso(m[5], mon(m[4]), m[3]); }
      else if (titleYear && (m = d.match(new RegExp(`^\\w{3}, (\\d{1,2}) (\\w{3}), [^-]+ - \\w{3}, (\\d{1,2}) (\\w{3}), \\S+ ${TZ}$`)))) { start = iso(titleYear, mon(m[2]), m[1]); end = iso(titleYear, mon(m[4]), m[3]); yi = true; }
      else if (titleYear && (m = d.match(new RegExp(`^\\w{3}, (\\d{1,2}) (\\w{3}), [^,]+ ${TZ}$`)))) { start = end = iso(titleYear, mon(m[2]), m[1]); yi = true; }
      if (!start || !mon(m[2])) { warnings.push('humanitix: unparsed date ' + d + ' on ' + u); continue; }
      if (end < start) { warnings.push('humanitix: end before start ' + d); continue; }
      if (end < today) continue;
      const quote = `${title} | ${d}`;
      if (!onPage(u, quote)) { warnings.push('humanitix quote not on page ' + quote); continue; }
      out.push({
        id: slug(def.courseId, def.country === 'NZ' ? 'nz' : def.region, def.city, start), courseId: def.courseId, variant: 'full', provider: def.provider,
        city: def.city, region: def.region, country: def.country, venue: venue || null,
        start, end, endInferred: false, ...(yi ? { yearInferred: true, yearNote: `the date line on the page has no year; the event title says ${titleYear}` } : {}),
        priceFrom: null, currency: null, seatsStatus: null,
        bookingUrl: u, sourceUrl: u, datesQuote: quote.slice(0, 200), lastVerified: today, datesConfirmed: true,
        sourceKind: `${def.provider}'s own event page on its booking platform (Humanitix host page ${def.host})`, sourceRef: 'humanitix:' + u.split('/').pop() + ':' + start
      });
    }
    return out;
  }
  function humanitixGroup(defs, note) {
    const courses = [], sessions = [];
    for (const def of defs) {
      const urls = [...idx.keys()].filter(u => (def.re ? def.re.test(u) : u === def.url)).sort();
      const mine = [];
      for (const u of urls) {
        const L = lines(u), title = (L[0] || '').replace(/\s*\|.*$/, '').trim();
        const d = typeof def.from === 'function' ? def.from(u, title) : def;
        if (!d) continue;
        mine.push(...humanitix(u, d).map(s => ({ ...s, _name: d.name, _u: u, _d: d })));
      }
      for (const s of mine) {
        if (!courses.some(c => c.id === s.courseId)) courses.push({
          id: s.courseId, name: s._name, cpdHours: 0, verified: true, lastVerified: today,
          providers: [{ name: s.provider, url: s._u, verified: true, calendar: s._d.host }],
          countries: [s.country], typicalLength: mine.filter(x => x.courseId === s.courseId).some(x => x.end > x.start) ? '2 days' : '1 day',
          cpdNote: 'check provider', notes: s._d.notes
        });
        delete s._name; delete s._u; delete s._d; sessions.push(s);
      }
    }
    return { courses, sessions, note };
  }

  /* ================= TEN-360 Training Education Network and LearnEM (Hindmarsh / Kilkenny SA) ================= */
  groups['ten360'] = () => {
    const P = 'https://events.humanitix.com/ten-360-';
    const HOST = 'https://events.humanitix.com/host/ten-360-training-education-network';
    const NOTES = 'Workshop by TEN-360 (Training Education Network), an interdisciplinary group of clinical educators in Adelaide (LearnEM), for doctors, nurses, nurse practitioners and paramedics. Booked on Humanitix; fees on the booking page.';
    return humanitixGroup([
      { re: new RegExp('^' + P), from: (u, title) => {
        /* ALS2 is left out: it runs on the same days at the same centre as Advanced Resuscitation Training's ARC-listed ALS2,
           already held from the ARC page. Critically Ill Child is held by the aunz-wave4 source. */
        if (/als2-2027|critically-ill-child/.test(u) || !/^TEN-360: /.test(title)) return null;
        const name = title.replace(/^TEN-360: /, '').replace(/ 2027$/, ''), kil = /plastering/.test(u);
        return { courseId: 'ten360-' + slug(name.replace(/\+/g, 'and')), name: 'TEN-360: ' + name, provider: 'TEN-360 Training Education Network',
          city: kil ? 'Kilkenny' : 'Hindmarsh', region: 'SA', country: 'AU', townRe: kil ? /Kilkenny SA/ : /Hindmarsh SA/, host: HOST, notes: NOTES };
      } },
      { re: /^https:\/\/events\.humanitix\.com\/pocus-(core-)?emergency-ultrasound-20\d\d$/, courseId: 'learnem-pocus-core-emergency', name: 'LearnEM POCUS: Core Emergency Ultrasound (two-day workshop)',
        provider: 'LearnEM (TEN-360 Training Education Network)', city: 'Hindmarsh', region: 'SA', country: 'AU', townRe: /Hindmarsh SA/, host: 'https://events.humanitix.com/host/learnem',
        notes: 'Two-day point-of-care ultrasound workshop for emergency clinicians run by LearnEM, the education arm behind TEN-360, at the Education Development Centre, Hindmarsh. Booked on Humanitix.' }
    ], "TEN-360 Training Education Network and LearnEM: workshop dates from each event's own Humanitix page (the event's date list), read 25 Nov 2026.");
  };

  /* ================= EMUGS (Emergency Medicine Ultrasound Group), NZ: POCUS Fundamentals / EGLS ================= */
  groups['emugs-nz'] = () => humanitixGroup([
    { re: /^https:\/\/events\.humanitix\.com\/20\d\d-(auckland|wellington)-pocus-fundamentals-course-egls-course$/, from: u => {
      const c = /auckland/.test(u) ? 'Auckland' : 'Wellington';
      return { courseId: 'emugs-pocus-fundamentals-egls', name: 'EMUGS POCUS Fundamentals Course / EGLS Course (two days)', provider: 'Emergency Medicine Ultrasound Group (EMUGS)',
        city: c, region: c, country: 'NZ', townRe: new RegExp(c + '.*New Zealand'), host: 'https://events.humanitix.com/host/emugs',
        notes: 'Two-day point-of-care ultrasound fundamentals course (with the Echo-Guided Life Support module) run by EMUGS. Booked on Humanitix.' };
    } }
  ], "EMUGS: NZ course dates from each event's own Humanitix page (the event's date list), read 25 Nov 2026.");

  /* ================= HealthCert 2027 Masterclasses (Brisbane), HealthCert's own page ================= */
  groups['healthcert-masterclass'] = () => {
    const u = 'https://www.healthcert.com/conference-masterclasses-2027';
    if (!page(u)) return { courses: [], sessions: [] };
    const courses = [], sessions = [];
    for (const [key, price, priceLine] of [['Dermoscopy', 1772.04, 'From $1,772.04 excl. GST'], ['Surgery', 2044.77, 'From $2,044.77 excl. GST']]) {
      const id = 'healthcert-' + key.toLowerCase() + '-masterclass';
      const quote = `21 - 22 August 2027 | Brisbane | ${key} Masterclass | Saturday 21 - Sunday 22 August 2027`;
      const fmt = ev(u, `✔ ${key} Masterclass (2 days, in person)`);
      if (!onPage(u, quote) || !fmt) { warnings.push('healthcert masterclass quote not on page ' + key); continue; }
      const priceOk = onPage(u, priceLine);
      sessions.push({
        id: slug(id, 'qld', 'brisbane', '2027-08-21'), courseId: id, variant: 'full', provider: 'HealthCert Education', city: 'Brisbane', region: 'QLD', country: 'AU',
        venue: null, venueNote: 'the page names Brisbane but not the venue', start: '2027-08-21', end: '2027-08-22', endInferred: false,
        priceFrom: priceOk ? price : null, currency: priceOk ? 'AUD' : null, ...(priceOk ? { priceNote: `page: "${priceLine}"` } : {}), seatsStatus: null,
        bookingUrl: u, sourceUrl: u, datesQuote: quote, lastVerified: today, datesConfirmed: true,
        sourceKind: 'HealthCert own masterclass page', sourceRef: 'healthcert:masterclass-2027:' + key.toLowerCase(), providerType: 'commercial'
      });
      courses.push({ id, name: `HealthCert ${key} Masterclass (skin cancer, two days)`, cpdHours: 0, verified: true, lastVerified: today,
        providers: [{ name: 'HealthCert Education', url: u, verified: true, calendar: 'https://www.healthcert.com/workshops/calendar' }],
        countries: ['AU'], providerType: 'commercial', format: `${key} masterclass in skin cancer medicine, 2 days in person.`, formatEvidence: fmt, typicalLength: '2 days',
        cpdNote: 'check provider', notes: 'Advanced skin cancer masterclass for doctors already practising skin cancer medicine.' });
    }
    return { courses, sessions, note: 'HealthCert 2027 Masterclasses in Dermoscopy & Surgery (Brisbane), read on HealthCert\'s own page 25 Nov 2026.' };
  };

  /* ================= South Western Sydney LHD (Liverpool Hospital) event pages: DSTC Sydney, SEXI ================= */
  groups['swslhd-liverpool'] = () => {
    const EV = 'https://www.swslhd.health.nsw.gov.au/liverpool/events.html', SX = 'https://www.swslhd.health.nsw.gov.au/liverpool/events/sexi/default.html';
    const DREG = 'https://www.swslhd.health.nsw.gov.au/liverpool/events/trauma/dstc/default.html';
    const courses = [], sessions = [];
    const P = 'South Western Sydney Local Health District (Liverpool Hospital)';
    const dq = 'Liverpool Hospital DSTC Courses | Surgeon: 15 March - 17 March 2027 | Anaesthetist: 15 March - 17 March 2027 | Location : | Liverpool Hospital';
    if (page(EV) && onPage(EV, dq)) {
      const fee = onPage(EV, 'Surgeon: $4850 incl. GST');
      sessions.push({ id: 'dstc-nsw-liverpool-2027-03-15', courseId: 'dstc-datc', variant: 'full', provider: P, city: 'Liverpool (Sydney)', region: 'NSW', country: 'AU',
        venue: 'Liverpool Hospital', start: '2027-03-15', end: '2027-03-17', endInferred: false,
        priceFrom: fee ? 4850 : null, currency: fee ? 'AUD' : null, ...(fee ? { priceNote: 'surgeon and anaesthetist fee incl. GST (page); nurses $1100' } : {}), seatsStatus: null,
        bookingUrl: DREG, sourceUrl: EV, datesQuote: dq, lastVerified: today, datesConfirmed: true,
        sourceKind: "Liverpool Hospital's own events page (SWSLHD)", sourceRef: 'swslhd:dstc:2027-03-15' });
      courses.push({ id: 'dstc-datc', name: 'Definitive Surgical Trauma Care (DSTC) and Definitive Anaesthetic Trauma Care (DATC) course', cpdHours: 0, verified: true, lastVerified: today,
        providers: [{ name: 'DSTC Australia and New Zealand (course sites)', url: 'https://dstc.com.au/', verified: true }, { name: P, url: EV, verified: true, calendar: EV }],
        countries: ['AU', 'NZ'], format: 'Three-day course for surgeons, anaesthetists and peri-operative nurses on surgical decision-making and operative technique in critically injured trauma patients.',
        formatEvidence: ev(EV, 'Operative technique in critically ill trauma patients'), typicalLength: '3 days', cpdNote: 'check provider',
        notes: 'DSTC (surgeons) runs alongside DATC (anaesthetists) and the peri-operative nursing course. dstc.com.au gives the 2027 Brisbane course (14-16 June) on its home page only, so only the Sydney run, which Liverpool Hospital lists on its own event page, is dated here.' });
    }
    const sq = 'Sydney Emergency Xray Interpretation 2027 | 9 th March 2027 | Conference Rooms 1 & 2, Education and Research Centre, Liverpool Hospital, Eastern Campus';
    if (page(SX) && onPage(SX, sq)) {
      const fee = onPage(SX, 'Register - Course Cost $200.00 (incl GST, non-refundable)');
      sessions.push({ id: 'sexi-nsw-liverpool-2027-03-09', courseId: 'swslhd-sexi', variant: 'full', provider: P, city: 'Liverpool (Sydney)', region: 'NSW', country: 'AU',
        venue: 'Conference Rooms 1 & 2, Education and Research Centre, Liverpool Hospital, Eastern Campus', start: '2027-03-09', end: '2027-03-09', endInferred: false,
        priceFrom: fee ? 200 : null, currency: fee ? 'AUD' : null, ...(fee ? { priceNote: 'page: "Course Cost $200.00 (incl GST, non-refundable)"' } : {}), seatsStatus: null,
        bookingUrl: SX, sourceUrl: SX, datesQuote: sq, lastVerified: today, datesConfirmed: true, sourceKind: "Liverpool Hospital's own course registration page (SWSLHD)", sourceRef: 'swslhd:sexi:2027-03-09' });
      courses.push({ id: 'swslhd-sexi', name: 'SEXI Day: Sydney Emergency X-ray Interpretation (one-day course)', cpdHours: 0, verified: true, lastVerified: today,
        providers: [{ name: P, url: SX, verified: true, calendar: EV }], countries: ['AU'], typicalLength: '1 day', cpdNote: 'check provider',
        formatEvidence: ev(EV, 'Time : | 7:45am Finish 16:00pm.'), notes: 'One-day emergency X-ray interpretation course at Liverpool Hospital; the registration form asks for an ACEM number if applicable.' });
    }
    return { courses, sessions, note: "Liverpool Hospital (SWSLHD) course dates from the hospital's own events and registration pages, read 25 Nov 2026." };
  };

  return groups;
};
