'use strict';
/* Provider groups for tools/courses/x10/aunz6-build.js (data wave 6). Each group reads cached pages only and returns
   { courses, sessions, note }. Rules as in aunz5-build.js: every date is read from the provider's own page and its quote is
   checked against the cached page text (pieces joined with " | " must each be on the page); no invented venues, fees or CPD.
   Sessions already held from another source (ARC course-dates page, APLS Arlo, ACRRM, ...) are not repeated here. */
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

module.exports = ({ page, lines, ev, onPage, warnings, today, slug, addDays, iso }) => {
  const groups = {};
  const mon = s => MON[String(s || '').slice(0, 3).toLowerCase()];
  const course = (id, name, prov, extra = {}) => ({ id, name, cpdHours: 0, verified: true, lastVerified: today, providers: [prov], cpdNote: 'check provider', ...extra });
  function session(o) {
    const s = {
      id: o.id, courseId: o.courseId, variant: o.variant || 'full', provider: o.provider, city: o.city, region: o.region, country: o.country,
      venue: o.venue || null, ...(o.venueNote ? { venueNote: o.venueNote } : {}),
      start: o.start, end: o.end || o.start, endInferred: !!o.endInferred, ...(o.endNote ? { endNote: o.endNote } : {}),
      priceFrom: o.priceFrom || null, currency: o.priceFrom ? o.currency : null, ...(o.priceFrom && o.priceNote ? { priceNote: o.priceNote } : {}),
      seatsStatus: o.seatsStatus || null, bookingUrl: o.bookingUrl || o.sourceUrl, sourceUrl: o.sourceUrl, datesQuote: o.quote.slice(0, 200),
      lastVerified: today, datesConfirmed: true, sourceKind: o.sourceKind, sourceRef: o.sourceRef,
      ...(o.sessionNote ? { sessionNote: o.sessionNote } : {}), ...(o.providerType ? { providerType: o.providerType } : {})
    };
    if (!onPage(o.sourceUrl, o.quote)) { warnings.push(`quote not on page ${o.sourceUrl}: ${o.quote.slice(0, 100)}`); return null; }
    if (s.end < today) return null;
    return s;
  }
  const push = (arr, s) => { if (s) arr.push(s); };

  /* ================= APLS New Zealand: course availability page (full participants) ================= */
  groups['apls-nz'] = () => {
    const u = 'https://www.apls.org.nz/courses';
    if (!page(u)) return { courses: [], sessions: [] };
    const L = lines(u), sessions = [], P = 'APLS New Zealand (Advanced Paediatric Life Support NZ)';
    const CITIES = new Set(['Auckland', 'Christchurch', 'Dunedin', 'Hamilton', 'Wellington', 'Rotorua']);
    for (let i = 0; i + 6 < L.length; i++) {
      const d = L[i].match(/^(\d{1,2})-(\d{1,2})$/), m1 = L[i + 1].match(/^(\w{3})-$/), m2 = L[i + 2].match(/^(\w{3})$/), y = L[i + 3].match(/^(20\d\d)$/);
      if (!d || !m1 || !m2 || !y || !CITIES.has(L[i + 4])) continue;
      const sm = mon(m1[1]), em = mon(m2[1]); if (!sm || !em) continue;
      const sy = em < sm ? +y[1] - 1 : +y[1]; /* "30-2 Nov- Dec 2027": the year printed is the end's */
      const start = iso(sy, sm, d[1]), end = iso(y[1], em, d[2]);
      const block = L.slice(i, i + 12), fee = block.find(l => /^Course Fee \$[\d,]+ \(including GST\)\.$/.test(l));
      const full = block.some(l => /^Fully booked - waiting list available$/.test(l));
      const quote = [L.slice(i, i + 6).join(' '), ...(full ? ['Fully booked - waiting list available'] : []), ...(fee ? [fee] : [])].join(' | ');
      push(sessions, session({
        id: slug('apls-nz', L[i + 4], start), courseId: 'apls', provider: P, city: L[i + 4], region: L[i + 4], country: 'NZ',
        venueNote: 'the availability page names the city, not the venue', start, end,
        priceFrom: fee ? +fee.match(/\$([\d,]+)/)[1].replace(/,/g, '') : null, currency: 'NZD', priceNote: 'full participant course fee incl. GST (page)',
        seatsStatus: full ? 'waitlist' : null, sourceUrl: u, quote, sourceKind: 'APLS New Zealand own course availability page (full participants)', sourceRef: 'apls-nz:' + start + ':' + L[i + 4].toLowerCase()
      }));
    }
    return { courses: [], sessions, note: 'APLS New Zealand: three-day APLS courses (full participants) from apls.org.nz/courses, read 25 Nov 2026. Core course id apls.' };
  };

  /* ================= The Royal Melbourne Hospital: events page (ALS2, CRASH) and RMH ICU Humanitix host page ================= */
  groups['rmh-courses'] = () => {
    const EV = 'https://www.thermh.org.au/news/events', ICU = 'https://events.humanitix.com/host/the-rmh-intensive-care-unit';
    const courses = [], sessions = [], P = 'The Royal Melbourne Hospital', PI = 'The Royal Melbourne Hospital Intensive Care Unit';
    if (page(EV)) {
      const L = lines(EV);
      for (let i = 0; i + 3 < L.length; i++) {
        const t = L[i];
        if (!/^The (ALS2 Course|ALS2 Recertification One Day Course|CRASH Course)\b.*2027$/.test(t)) continue;
        const a = L[i + 1].match(/^(\d{1,2}) (\w+) (20\d\d), /); if (!a) continue;
        const start = iso(a[3], mon(a[2]), a[1]); let end = start, q = [t, L[i + 1]];
        if (L[i + 2] === '—') { const b = L[i + 3].match(/^(\d{1,2}) (\w+) (20\d\d), /); if (!b) continue; end = iso(b[3], mon(b[2]), b[1]); q.push(L[i + 3]); }
        const crash = /CRASH/.test(t), recert = /Recertification/.test(t);
        push(sessions, session({
          id: slug(crash ? 'rmh-crash' : recert ? 'als2-recert' : 'als2', 'vic-parkville', start, 'rmh'), courseId: crash ? 'rmh-crash' : 'als2', variant: recert ? 'recertification' : 'full',
          provider: P, city: 'Parkville (Melbourne)', region: 'VIC', country: 'AU', venue: null, venueNote: 'the events page lists the course under The Royal Melbourne Hospital (Parkville) without a room',
          start, end, sourceUrl: EV, quote: q.join(' | '), sourceKind: "The Royal Melbourne Hospital's own events page (booked on TryBooking)", sourceRef: 'thermh:events:' + slug(t)
        }));
      }
      if (sessions.some(s => s.courseId === 'rmh-crash')) courses.push(course('rmh-crash', 'CRASH: Critical Care, Resuscitation and Airway Skills in High Fidelity Simulation (RMH, one day)',
        { name: P, url: 'https://www.thermh.org.au/health-professionals/training-courses/anaesthesia-pain-management-courses', verified: true, calendar: EV },
        { countries: ['AU'], typicalLength: '1 day', formatEvidence: ev(EV, 'The Critical Care, Resuscitation and Airway Skills in High Fidelity Simulation (CRASH) course is designed to support anaesthetists returning to work.'),
          notes: 'One-day high-fidelity simulation course for anaesthetists returning to work, run by the RMH Department of Anaesthesia and Pain Management.' }));
    }
    if (page(ICU)) {
      const L = lines(ICU), map = [
        [/^REACT \(Resuscitation and Acute Catheter Lab Emergencies\)/, 'rmh-react', 'REACT: Resuscitation and Acute Catheter Lab Emergencies (RMH, one day)', 'One-day simulation course on resuscitation and emergencies in the cardiac catheter laboratory, run at the RMH Cardiology Department.'],
        [/^RMH Advanced Critical Care Echocardiography Course \(TTE\)$/, 'rmh-advanced-critical-care-echo', 'RMH Advanced Critical Care Echocardiography Course (TTE, two days)', 'Two-day advanced transthoracic echocardiography course for critical care doctors, run by the RMH Intensive Care Unit.'],
        [/^RMH Critical Care Foundation Echocardiography Course \(TTE\)/, 'rmh-foundation-critical-care-echo', 'RMH Critical Care Foundation Echocardiography Course (TTE)', 'Foundation transthoracic echocardiography course for critical care doctors, run by the RMH Intensive Care Unit; the listing gives the two face-to-face days.']];
      for (let i = 0; i + 2 < L.length; i++) {
        const d = L[i]; let m, start, end;
        if ((m = d.match(/^\w{3}, (\d{1,2}) (\w{3}) (20\d\d), [^-]+ - [^,]+ AE[SD]T$/))) start = end = iso(m[3], mon(m[2]), m[1]);
        else if ((m = d.match(/^\w{3}, (\d{1,2}) (\w{3}), [^-]+ - \w{3}, (\d{1,2}) (\w{3}), \S+ (20\d\d) AE[SD]T$/))) { start = iso(m[5], mon(m[2]), m[1]); end = iso(m[5], mon(m[4]), m[3]); }
        else continue; /* lines without a year (this year's December events) are left out */
        const hit = map.find(x => x[0].test(L[i + 1])); if (!hit) continue;
        const venue = L[i + 2].replace(/, Parkville VIC, Australia$/, '').replace(/\s+,/g, ',');
        push(sessions, session({
          id: slug(hit[1], 'vic-parkville', start), courseId: hit[1], provider: PI, city: 'Parkville (Melbourne)', region: 'VIC', country: 'AU', venue: venue + ', Parkville VIC',
          start, end, sourceUrl: ICU, quote: `${d} | ${L[i + 1]} | ${L[i + 2]}`, sourceKind: "RMH Intensive Care Unit's own Humanitix host page (its upcoming events list)", sourceRef: 'humanitix:the-rmh-intensive-care-unit:' + hit[1] + ':' + start
        }));
        if (!courses.some(c => c.id === hit[1])) courses.push(course(hit[1], hit[2], { name: PI, url: ICU, verified: true, calendar: ICU }, { countries: ['AU'], typicalLength: end > start ? '2 days' : '1 day', notes: hit[3] }));
      }
    }
    return { courses, sessions, note: "The Royal Melbourne Hospital: ALS2 and CRASH dates from thermh.org.au/news/events; ICU courses from the RMH ICU's own Humanitix host page; read 25 Nov 2026." };
  };

  /* ================= The Alfred ICU (Intensive Care Academic Centre): courses page ================= */
  groups['alfred-icu'] = () => {
    const u = 'https://www.alfredicu.org.au/courses';
    if (!page(u)) return { courses: [], sessions: [] };
    const L = lines(u), courses = [], sessions = [], P = 'The Alfred ICU (Intensive Care Academic Centre, Alfred Health)';
    const map = [
      [/^PRIME: Practical Introduction to Modern Intensive Care/, 'alfred-icu-prime', 'PRIME: Practical Introduction to Modern Intensive Care (Alfred ICU, two days)', 'Two-day course for trainees early in intensive care training; the page says it is accredited by CICM.'],
      [/^ALS2 Advanced Life Support Recertification/, 'als2', null, null, 'recertification'],
      [/^ALS2: Advanced Life Support/, 'als2', null, null, 'full'],
      [/^ABC2?: Alfred Bootcamp for CICM Second Part Clinical Exam Course/, 'alfred-icu-abc-cicm-second-part', 'ABC: Alfred Bootcamp for the CICM Second Part Clinical Exam (two days)', 'Two-day preparation course for CICM Second Part clinical exam candidates.'],
      [/Adult Foundation ECMO Course/, 'alfred-icu-adult-foundation-ecmo', 'Adult Foundation ECMO Course (Alfred ICU with VECMOS, four days)', 'Four-day foundation ECMO course for doctors, nurses, perfusionists and allied health, run by the Alfred ICU with VECMOS.'],
      [/^FBI: Flexible Bronchoscopy and Intubation in Critical Care/, 'alfred-icu-fbi', 'FBI: Flexible Bronchoscopy and Intubation in Critical Care (Alfred ICU, one day)', 'One-day bronchoscopy and airway course for critical care clinicians.'],
      [/^CIA: Critically Ill Airway/, 'alfred-icu-critically-ill-airway', 'CIA: Critically Ill Airway (Alfred ICU, two days)', 'Two-day simulation-based course on airway crises in the critically ill, at the Alfred Simulation Centre.'],
      [/^ECHO: Critical Care Echocardiography Course \(Basic\)/, 'alfred-icu-basic-echo', 'Alfred ICU Critical Care Echocardiography Course (Basic, two days)', 'Two-day practical TTE course for critical care practitioners, limited to 20 participants.'],
      [/^ECHO: Comprehensive Critical Care Echocardiography Course \(Advanced\)/, 'alfred-icu-advanced-echo', 'Alfred Comprehensive Critical Care Echocardiography (ACCCE) Course (Advanced, two days)', 'Two-day advanced TTE course for critical care doctors beyond a basic level.']];
    for (let i = 0; i + 3 < L.length; i++) {
      const hit = map.find(x => x[0].test(L[i])); if (!hit) continue;
      const k = L[i + 1] === 'Registration is open' ? i + 2 : i + 1;
      const m = L[k].match(/^(\d{1,2}) (\w+) (20\d\d) — (?:(\d{1,2}) (\w+) (20\d\d)|.*)$/); if (!m) continue;
      const start = iso(m[3], mon(m[2]), m[1]), end = m[4] ? iso(m[6], mon(m[5]), m[4]) : start, venue = L[k + 1];
      if (!/^The Alfred/.test(venue)) { warnings.push('alfred-icu: no venue line after ' + L[i]); continue; }
      push(sessions, session({
        id: slug(hit[1] === 'als2' ? (hit[4] === 'recertification' ? 'als2-recert' : 'als2') : hit[1], 'vic-melbourne', start, hit[1] === 'als2' ? 'alfred' : ''), courseId: hit[1], variant: hit[4] || 'full',
        provider: P, city: 'Melbourne', region: 'VIC', country: 'AU', venue: venue + ', 55 Commercial Rd, Melbourne VIC 3004',
        venueNote: "the room is from the course list; the street address is the Alfred ICU's address in the page footer", start, end,
        sourceUrl: u, quote: `${L[i]} | ${L[k]} | ${venue}`, sourceKind: "The Alfred ICU's own courses page (registration on Cvent)", sourceRef: 'alfredicu:' + hit[1] + ':' + start
      }));
      if (hit[2] && !courses.some(c => c.id === hit[1])) courses.push(course(hit[1], hit[2], { name: P, url: u, verified: true, calendar: u }, { countries: ['AU'], notes: hit[3] }));
    }
    return { courses, sessions, note: "The Alfred ICU: 2027 course dates from alfredicu.org.au/courses, read 25 Nov 2026 (the Burns Symposium is a meeting, not a course, and is left out)." };
  };

  /* ================= Sydney Clinical Skills and Simulation Centre (Royal North Shore Hospital) ================= */
  groups['scssc'] = () => {
    const S = 'https://www.sim.scssc.edu.au', EMAC = S + '/Courses/emac', ATT = S + '/Courses/attaac', BK = S + '/bookings';
    const P = 'Sydney Clinical Skills and Simulation Centre (SCSSC), Royal North Shore Hospital';
    const VENUE = 'Sydney Clinical Skills and Simulation Centre, Level 6, Kolling Building, Royal North Shore Hospital, St Leonards NSW 2065';
    const courses = [], sessions = [];
    const base = { provider: P, city: 'St Leonards (Sydney)', region: 'NSW', country: 'AU', venue: VENUE, currency: 'AUD', sourceKind: "SCSSC's own course page / course calendar" };
    const MD = /^(\w+) (\d{1,2})-(\d{1,2}), (20\d\d)$/;
    for (const [u, id, priceRe, price, plabel] of [[EMAC, 'scssc-emac', /^\$3560$/, 3560, 'specialist / trainee course fee (page)'], [ATT, 'scssc-attaac', /^2027 - \$2290 per anaesthetist, \$1125 anaesthetic trainees\.$/, 1125, '2027: $2290 per anaesthetist, $1125 anaesthetic trainees (page)']]) {
      if (!page(u)) continue;
      const L = lines(u), di = L.indexOf('Dates'), pOk = L.some(l => priceRe.test(l));
      for (let i = di + 1; di >= 0 && i < L.length && MD.test(L[i]); i++) {
        const m = L[i].match(MD), start = iso(m[4], mon(m[1]), m[2]), end = iso(m[4], mon(m[1]), m[3]);
        push(sessions, session({ ...base, id: slug(id, 'nsw-st-leonards', start), courseId: id, start, end, priceFrom: pOk ? price : null, priceNote: plabel,
          sourceUrl: u, bookingUrl: BK, quote: `Dates | ${L[i]}`, sourceRef: 'scssc:' + id + ':' + start }));
      }
    }
    if (page(BK)) {
      const L = lines(BK);
      const map = [[/^Safe Procedural Sedation \/$/, 'scssc-safe-procedural-sedation'], [/^Paediatric Emergencies: essential skills for the occasional Paediatric Anaesthetist \/$/, 'scssc-paediatric-emergencies-anaesthetist']];
      for (let i = 0; i + 4 < L.length; i++) {
        const hit = map.find(x => x[0].test(L[i])); if (!hit) continue;
        const m = L[i + 2].match(/^(\d{1,2}) (\w+) (20\d\d), [^–]+–\s*(?:(\d{1,2}) (\w+) (20\d\d), )?/); if (!m) continue;
        const start = iso(m[3], mon(m[2]), m[1]), end = m[4] ? iso(m[6], mon(m[5]), m[4]) : start;
        const pl = L.slice(i + 4, i + 7).find(l => /^\$\d+( anaesthetists)?$/.test(l));
        push(sessions, session({ ...base, id: slug(hit[1], 'nsw-st-leonards', start), courseId: hit[1], start, end, priceFrom: pl ? +pl.match(/\d+/)[0] : null,
          priceNote: pl && /anaesthetists/.test(pl) ? 'specialist anaesthetist fee (calendar); trainees $800' : 'course fee (calendar)', sourceUrl: BK, quote: `${L[i]} | ${L[i + 2]}`, sourceRef: 'scssc:' + hit[1] + ':' + start }));
      }
    }
    const prov = u => ({ name: P, url: u, verified: true, calendar: BK });
    const defs = {
      'scssc-emac': ['EMAC: Effective Management of Anaesthetic Crises (SCSSC, two and a half days)', EMAC, '2 1/2 days', 'ANZCA EMAC course for anaesthetists and anaesthetic registrars at the SCSSC simulation centre, Royal North Shore Hospital.'],
      'scssc-attaac': ['ATTAAC: Advanced Technical and Teamwork Training for Anaesthetic Airway Crises (SCSSC, two days)', ATT, '2 days', 'Two-day course on anticipated difficult and unanticipated emergency airways for anaesthetists and anaesthetic trainees.'],
      'scssc-safe-procedural-sedation': ['Safe Procedural Sedation Course (SCSSC, one day)', S + '/Courses/safe-procedural-sedation', '1 day', 'One-day e-learning, workshop and simulation course on conscious sedation outside the operating theatre.'],
      'scssc-paediatric-emergencies-anaesthetist': ['Paediatric Emergencies: Essential Skills for the Occasional Paediatric Anaesthetist (SCSSC, one day)', S + '/Courses/paediatric-emergencies%3A-essential-skills-for-the--occasional-paediatric-anaesthetist', '1 day', 'One-day simulation course on paediatric anaesthetic emergencies for anaesthetists who see children occasionally.']
    };
    for (const id of new Set(sessions.map(s => s.courseId))) { const d = defs[id]; courses.push(course(id, d[0], prov(d[1]), { countries: ['AU'], typicalLength: d[2], notes: d[3] })); }
    return { courses, sessions, note: "Sydney Clinical Skills and Simulation Centre (Royal North Shore Hospital): dates from SCSSC's own course pages (EMAC, ATTAAC) and course calendar (bookings), read 25 Nov 2026. Instructor and supervisor courses are left out." };
  };

  /* ================= ACCO (Australasian College of Cutaneous Oncology): workshop calendar ================= */
  groups['acco'] = () => {
    const u = 'https://acco.edu.au/calendar';
    if (!page(u)) return { courses: [], sessions: [] };
    const L = lines(u), courses = [], sessions = [], P = 'Australasian College of Cutaneous Oncology (ACCO)';
    const venueQ = 'All workshops are held at Docklands in the Melbourne CBD unless clearly specified.';
    const defs = [
      ['Essentials', 'acco-essentials', 'ACCO Essentials workshop (skin cancer, two days)'],
      ['Dermoscopy', 'acco-dermoscopy', 'ACCO Dermoscopy workshop (two days)'],
      ['4 day Flap and Graft with 3 online zoom modules', 'acco-flap-and-graft', 'ACCO Flap and Graft workshop (four face-to-face days plus three online modules)'],
      ['Face and Ear 2027', 'acco-face-and-ear', 'ACCO Face and Ear workshop (three days)']];
    const R = /^(\d{1,2})(?: (\w+))?\s*[–-]\s*(\d{1,2}) (\w+) (20\d\d)$/;
    for (const [hdr, id, name] of defs) {
      const i = L.findIndex((l, j) => l === hdr && /^\$ \d+$/.test(L[j + 1] || '')); if (i < 0) { warnings.push('acco: no entry for ' + hdr); continue; }
      const price = (L[i + 1] || '').match(/^\$ (\d+)$/);
      let k = i + 2; while (k < i + 12 && !(R.test(L[k]) && (hdr !== defs[2][0] || /Face To Face/.test(L[k + 1] || '')))) k++;
      const m = (L[k] || '').match(R); if (!m || k >= i + 12) { warnings.push('acco: no date for ' + hdr); continue; }
      const start = iso(m[5], mon(m[2] || m[4]), m[1]), end = iso(m[5], mon(m[4]), m[3]);
      const quote = [hdr, ...(price ? [L[i + 1]] : []), L[k], ...(/Face To Face/.test(L[k + 1] || '') ? ['Face To Face'] : [])].join(' | ');
      push(sessions, session({ id: slug(id, 'vic-docklands', start), courseId: id, provider: P, city: 'Docklands (Melbourne)', region: 'VIC', country: 'AU',
        venueNote: `the calendar says: "${venueQ}"`, start, end, priceFrom: price ? +price[1] : null, currency: 'AUD', priceNote: 'full workshop price on the calendar (includes 12 months ACCO membership; an early discount is listed)',
        sourceUrl: u, quote, sourceKind: "ACCO's own workshop calendar", sourceRef: 'acco:' + id + ':' + start }));
      if (sessions.some(s => s.courseId === id)) courses.push(course(id, name, { name: P, url: u, verified: true, calendar: u }, { countries: ['AU'],
        notes: 'Skin cancer workshop for doctors run by the Australasian College of Cutaneous Oncology in Melbourne (Docklands). Workshop prices include 12 months ACCO membership.' }));
    }
    if (!onPage(u, venueQ)) warnings.push('acco: venue line not on page');
    return { courses, sessions, note: "ACCO (Australasian College of Cutaneous Oncology): 2027 workshop dates from acco.edu.au/calendar, read 25 Nov 2026. The 'Combined Essentials and Dermoscopy' booking option is the same two workshops and is not counted again." };
  };

  /* ================= Lightbox Radiology Education: course finder (AU/NZ runs) ================= */
  groups['lightbox-radiology'] = () => {
    const u = 'https://lightboxradiology.com/radiology-courses.aspx';
    if (!page(u)) return { courses: [], sessions: [] };
    const L = lines(u), courses = [], sessions = [], P = 'Lightbox Radiology Education';
    const PLACES = { 'Sydney': ['Sydney', 'NSW', 'AU'], 'Brisbane, QLD': ['Brisbane', 'QLD', 'AU'], 'Brisbane': ['Brisbane', 'QLD', 'AU'], 'Melbourne, VIC': ['Melbourne', 'VIC', 'AU'], 'Noosa': ['Noosa', 'QLD', 'AU'], 'Noosa, QLD': ['Noosa', 'QLD', 'AU'], 'Queenstown, NZ': ['Queenstown', 'Otago', 'NZ'] };
    const KEEP = { 'CT - Acute Medical and Surgical Interpretation Essentials': 'lightbox-ct-acute-interpretation', 'Musculoskeletal Imaging: Spine, Hip + Shoulder Interpretation Esssentials': 'lightbox-msk-spine-hip-shoulder',
      'Ultrasound - Guided Peripheral Intravenous Cannulation': 'lightbox-us-guided-piv-cannulation', 'Ultrasound - Point of Care (PoCUS)': 'lightbox-pocus', 'Ultrasound - Critical Care': 'lightbox-critical-care-ultrasound' };
    const DATE = /^(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day, (\w+) (\d{1,2}), (20\d\d)$/;
    let cur = null;
    for (let i = 0; i + 3 < L.length; i++) {
      if (L[i + 1] === '+ Expand') { cur = L[i]; continue; }
      if (/^Search By|^Brisbane$/.test(L[i]) && i > 200 && L[i + 2] && !DATE.test(L[i + 2])) { if (L[i] === 'Brisbane') break; }
      if (!cur || !KEEP[cur] || !PLACES[L[i]] || !DATE.test(L[i + 2] || '')) continue;
      if (/Course full/.test(L[i + 4] || '')) continue;
      const [city, region, cc] = PLACES[L[i]], m = L[i + 2].match(DATE), start = iso(m[3], mon(m[1]), m[2]);
      const dm = L[i + 1].match(/^(\d+) days?$/), days = dm ? +dm[1] : 1, id = KEEP[cur];
      if (sessions.some(s => s.courseId === id && s.start === start && s.city === city)) continue; /* the 2-hour cannulation slots on one day count once */
      push(sessions, session({ id: slug(id, cc === 'NZ' ? 'nz' : region, city, start), courseId: id, provider: P, city, region, country: cc,
        venueNote: 'the course finder names the town; venue and timetable are on the course page', start, end: addDays(start, days - 1), endInferred: days > 1,
        ...(days > 1 ? { endNote: `"${L[i + 1]}" on the course finder; consecutive days assumed` } : {}),
        sourceUrl: u, quote: `${cur} | ${L[i]} | ${L[i + 1]} | ${L[i + 2]}`, sourceKind: "Lightbox Radiology Education's own course finder", sourceRef: 'lightbox:' + id + ':' + city.toLowerCase() + ':' + start, providerType: 'commercial',
        sessionNote: /Cannulation/.test(cur) ? 'two-hour sessions, several times on the day' : undefined }));
    }
    const NAMES = { 'lightbox-ct-acute-interpretation': ['Lightbox CT: Acute Medical and Surgical Interpretation Essentials', 'Introduction to CT interpretation in the acute clinical setting.'],
      'lightbox-msk-spine-hip-shoulder': ['Lightbox Musculoskeletal Imaging: Spine, Hip and Shoulder Interpretation Essentials (one day)', 'Structured approach to imaging of the axial skeleton and proximal joints.'],
      'lightbox-us-guided-piv-cannulation': ['Lightbox Ultrasound-Guided Peripheral IV Cannulation (two-hour workshop)', 'Hands-on ultrasound-guided vascular access workshop.'],
      'lightbox-pocus': ['Lightbox Ultrasound: Point of Care (PoCUS, one day)', 'Foundational point-of-care ultrasound skills.'],
      'lightbox-critical-care-ultrasound': ['Lightbox Ultrasound: Critical Care (two days)', 'Bedside ultrasound for critical care clinicians, with a focus on RUSH and ultrasound-guided intervention.'] };
    for (const id of new Set(sessions.map(s => s.courseId))) courses.push(course(id, NAMES[id][0], { name: P, url: u, verified: true, calendar: u, bookingPlatform: 'Lightbox Radiology Education (lightboxradiology.com)' },
      { countries: [...new Set(sessions.filter(s => s.courseId === id).map(s => s.country))], providerType: 'commercial', notes: 'Commercial radiology and ultrasound education provider (Noosaville QLD). ' + NAMES[id][1] + ' Fees on the course page.' }));
    return { courses, sessions, note: "Lightbox Radiology Education: AU/NZ course dates from lightboxradiology.com's own course finder, read 25 Nov 2026 (courses abroad and the nurse practitioner course left out)." };
  };

  /* ================= Single-page courses: SA Critical Care Ultrasound Course; SunSmart / ACD dermoscopy day ================= */
  groups['aunz-wave6'] = () => {
    const courses = [], sessions = [];
    const SA = 'https://saica.com.au/course_echo.php';
    const q1 = 'The course will run annually from 2027, with the next course being held: 8-9th Apr 2027 .';
    if (page(SA)) {
      const fee = onPage(SA, 'The cost is AUD$1320 (Inc.GST) for the two days.');
      push(sessions, session({ id: 'sa-critical-care-ultrasound-sa-adelaide-2027-04-08', courseId: 'sa-critical-care-ultrasound', provider: 'South Australian Critical Care Ultrasound Course (SAICA)', city: 'Adelaide', region: 'SA', country: 'AU',
        venueNote: 'the page gives "Ayers House, Nth Terrace Adelaide (TBC)"', start: '2027-04-08', end: '2027-04-09', priceFrom: fee ? 1320 : null, currency: 'AUD', priceNote: 'page: "AUD$1320 (Inc.GST) for the two days"',
        sourceUrl: SA, quote: `Critical Care Ultrasound Course | ${q1}`, sourceKind: 'The course\'s own page (saica.com.au)', sourceRef: 'saica:echo:2027-04-08' }));
      if (sessions.length) courses.push(course('sa-critical-care-ultrasound', 'The South Australian Critical Care Ultrasound Course (two days)', { name: 'SAICA (South Australian intensive care education site)', url: SA, verified: true },
        { countries: ['AU'], typicalLength: '2 days', formatEvidence: ev(SA, 'This two-day course is an introduction to the use of ultrasound in the critical care environment.'),
          notes: 'Two-day introduction to critical care ultrasound for doctors in acute or critical care (PGY2 and above), taught by intensive care and emergency specialists; the page says CICM accredits it for training.' }));
    }
    const SS = 'https://www.sunsmart.com.au/skin-cancer/health-professionals/dermoscopy-victorian-general-practice-program';
    const q2 = 'The face-to-face workshop will be held in metropolitan Melbourne on Saturday 8 May, 2027.';
    if (page(SS)) {
      const n = sessions.length;
      push(sessions, session({ id: 'sunsmart-acd-practical-dermoscopy-vic-melbourne-2027-05-08', courseId: 'sunsmart-acd-practical-dermoscopy', provider: 'SunSmart (Cancer Council Victoria) with the Australasian College of Dermatologists', city: 'Melbourne', region: 'VIC', country: 'AU',
        venueNote: 'the page says "metropolitan Melbourne"', start: '2027-05-08', end: '2027-05-08', sourceUrl: SS, quote: `Dermoscopy for Victorian General Practice Program 2026/2027 | ${q2}`,
        sourceKind: "SunSmart's own program page", sourceRef: 'sunsmart:dermoscopy:2027-05-08',
        sessionNote: 'face-to-face day of a funded program for Victorian GPs (apply first; online modules 8 February to 31 May 2027)' }));
      if (sessions.length > n) courses.push(course('sunsmart-acd-practical-dermoscopy', 'Dermoscopy for Victorian General Practice: ACD Practical Dermoscopy course (face-to-face day)', { name: 'SunSmart (Cancer Council Victoria)', url: SS, verified: true },
        { countries: ['AU'], formatEvidence: ev(SS, 'They will then be enrolled into the Australasian College of Dermatologists Practical Dermoscopy course (outlined below) which runs from 8 February to 31 May 2027.'),
          notes: 'Funded program for Victorian general practice: online modules plus one face-to-face workshop day; participants apply to SunSmart.' }));
    }
    return { courses, sessions, note: 'Single-page AU course runs read 25 Nov 2026: the South Australian Critical Care Ultrasound Course (saica.com.au) and the SunSmart / ACD dermoscopy workshop day.' };
  };

  /* ================= HealthCert practical workshops: aesthetic medicine days (calendar page) =================
     HealthCert's skin cancer, procedures, vasectomy, IUD and MSK workshop days are held by the womens-gp source; only the
     aesthetic medicine workshops, which no source holds, are read here. */
  groups['healthcert-aesthetic'] = () => {
    const u = 'https://www.healthcert.com/workshops/calendar';
    if (!page(u)) return { courses: [], sessions: [] };
    const L = lines(u), courses = [], sessions = [], P = 'HealthCert Education';
    const CITY = { 'Brisbane Practical Workshops': ['Brisbane', 'QLD'], 'Sydney Practical Workshops': ['Sydney', 'NSW'], 'Melbourne Practical Workshops': ['Melbourne', 'VIC'] };
    const NAMES = { 'Aesthetic Medicine Practical Workshop': ['healthcert-aesthetic-medicine-workshop', 'HealthCert Aesthetic Medicine Practical Workshop (one day)'],
      'Complex Aesthetic Medicine Practical Workshop': ['healthcert-complex-aesthetic-medicine-workshop', 'HealthCert Complex Aesthetic Medicine Practical Workshop (one day)'],
      'Advanced Aesthetic Medicine Practical Workshop': ['healthcert-advanced-aesthetic-medicine-workshop', 'HealthCert Advanced Aesthetic Medicine Practical Workshop (one day)'] };
    let city = null, venue = null, day = null, dayLine = null;
    for (let i = 0; i < L.length; i++) {
      if (CITY[L[i]]) { city = L[i]; venue = L[i + 1]; continue; }
      if (/^Upcoming webinars$/.test(L[i])) break;
      const d = L[i].match(/^(\d{1,2}) (\w+) (20\d\d)$/);
      if (city && d && /^(Saturday|Sunday)$/.test(L[i - 1])) { day = iso(d[3], mon(d[2]), d[1]); dayLine = L[i]; continue; }
      if (!city || !day || !NAMES[L[i]]) continue;
      const [id] = NAMES[L[i]], [c, r] = CITY[city];
      const one = !/ \/ /.test(venue);
      push(sessions, session({ id: slug(id, r, c, day), courseId: id, provider: P, city: c, region: r, country: 'AU', venue: one ? venue : null,
        ...(one ? {} : { venueNote: `the calendar gives "${venue}"` }), start: day, end: day, sourceUrl: u, quote: `${city} | ${venue} | ${dayLine} | ${L[i]}`,
        sourceKind: "HealthCert's own workshop calendar", sourceRef: 'healthcert:calendar:' + id + ':' + day, providerType: 'commercial',
        sessionNote: 'booked with a HealthCert aesthetic medicine certificate enrolment (the calendar says to choose the workshop option when you enrol)' }));
    }
    for (const [t, [id, name]] of Object.entries(NAMES)) if (sessions.some(s => s.courseId === id)) courses.push(course(id, name, { name: P, url: u, verified: true, calendar: u },
      { countries: ['AU'], providerType: 'commercial', typicalLength: '1 day', notes: `Hands-on ${t.replace(/ Practical Workshop$/, '').toLowerCase()} workshop day for doctors, booked as part of HealthCert's aesthetic medicine certificate.` }));
    return { courses, sessions, note: "HealthCert Education: aesthetic medicine practical workshop days from HealthCert's own workshop calendar, read 25 Nov 2026." };
  };

  return groups;
};
