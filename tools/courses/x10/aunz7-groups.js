'use strict';
/* Data wave 7 (25 Nov 2026): the hand-read AU/NZ rows for tools/courses/x10/aunz7-build.js.
   ({ lines, pageText, has, today, warn }) => { conferences, courses, sessions }
   Every date below was read on the organiser's or provider's own event page (never a site root); the build checks each quote
   against the cached page text and drops any row whose quote is not there. Fees only where the page states them; CPD is always
   "check provider". A session already held from another source (womens-gp, resus, ...) is not repeated. */
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const slug = (...p) => p.join('-').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const C = { /* city points as in tools/city-coords.json (Wikidata P625); Wellington, Woodville etc. use the city's own item */
  Adelaide: ['AU', -34.9275, 138.6], Auckland: ['NZ', -36.8492, 174.7653], Brisbane: ['AU', -27.4678, 153.0278], Cairns: ['AU', -16.9256, 145.7753],
  Canberra: ['AU', -35.2931, 149.1269], Christchurch: ['NZ', -43.5311, 172.6361], Darwin: ['AU', -12.4381, 130.8411], 'Gold Coast': ['AU', -28.0167, 153.4],
  Hobart: ['AU', -42.8833, 147.3167], Melbourne: ['AU', -37.8142, 144.9631], Perth: ['AU', -31.9558, 115.8597], Sydney: ['AU', -33.8678, 151.21],
  Wellington: ['NZ', -41.2889, 174.7772], Queenstown: ['NZ', -45.0311, 168.6625]
};
const STATE = { Adelaide: 'SA', Brisbane: 'QLD', Canberra: 'ACT', Darwin: 'NT', Hobart: 'TAS', Melbourne: 'VIC', Perth: 'WA', Sydney: 'NSW', Cairns: 'QLD', 'Gold Coast': 'QLD' };

module.exports = ({ lines, has, warn, html, today }) => {
  const conferences = [], courses = [], sessions = [];
  const conf = (o) => {
    const [cc, lat, lng] = C[o.city] || [o.countryCode, 0, 0];
    conferences.push({
      id: o.id, name: o.name, organiser: o.organiser, specialty: o.specialty, city: o.city,
      country: (o.countryCode || cc) === 'NZ' ? 'New Zealand' : 'Australia', countryCode: o.countryCode || cc, region: 'Asia-Pacific',
      lat: o.lat || lat, lng: o.lng || lng, start: o.start, end: o.end || o.start, format: o.format || 'In-person',
      cpdHours: 0, cpdBody: '', priceFrom: 0, attendees: 0, url: o.url || o.src, blurb: o.blurb,
      sourceUrl: o.src, datesSourceUrl: o.src, datesQuote: o.quote, ...(o.organiserUrl ? { organiserUrl: o.organiserUrl } : {})
    });
  };
  const sess = (o) => sessions.push({
    id: o.id, courseId: o.courseId, variant: o.variant || 'full', provider: o.provider, city: o.city, region: o.region, country: o.country || 'AU',
    venue: o.venue || null, ...(o.venueNote ? { venueNote: o.venueNote } : {}), start: o.start, end: o.end || o.start, endInferred: !!o.endInferred,
    priceFrom: o.priceFrom || null, currency: o.priceFrom ? (o.currency || 'AUD') : null, ...(o.priceFrom && o.priceNote ? { priceNote: o.priceNote } : {}),
    seatsStatus: o.seatsStatus || null, bookingUrl: o.bookingUrl || o.src, sourceUrl: o.src, datesQuote: o.quote, sourceKind: o.sourceKind,
    ...(o.sessionNote ? { sessionNote: o.sessionNote } : {})
  });
  const course = (o) => courses.push({ cpdHours: 0, verified: true, cpdNote: 'check provider', ...o });

  /* ================= RANZCR own event pages (ranzcr.com/event/...) ================= */
  const R = 'https://www.ranzcr.com/event/';
  conf({ id: 'anzstr-asm-2027', name: 'ANZSTR 2027 Inaugural Annual Scientific Meeting', organiser: 'Australian and New Zealand Society of Thoracic Radiology (RANZCR)',
    specialty: 'Radiology', city: 'Melbourne', start: '2027-02-20', end: '2027-02-21', src: R + '2027-anzstr-annual-scientific-meeting-save-the-date-20-21-feb-2027/',
    quote: 'Inaugural Annual Scientific Meeting (ASM) of the Australian and New Zealand Society of Thoracic Radiology to be held from 20-21 February 2027 at Rydges, Melbourne, Australia',
    blurb: 'First annual meeting of the thoracic radiology society, 1½ days on cardiothoracic imaging and lung cancer screening, at Rydges Melbourne.', organiserUrl: 'https://www.ranzcr.com/events/' });
  conf({ id: 'ranzcr-wa-branch-msk-imaging-update-2027', name: 'RANZCR WA Branch Meeting: Musculoskeletal Imaging Update 2027', organiser: 'RANZCR Western Australian Branch',
    specialty: 'Radiology', city: 'Perth', start: '2027-02-13', end: '2027-02-14', src: R + 'wa-asm-msk-imaging-update-save-the-date-20-21-feb-2027/',
    quote: 'RANZCR WA Branch Meeting – Musculoskeletal Imaging Update, to be held in Perth on 13–14 February 2027.',
    blurb: 'Weekend branch meeting on musculoskeletal imaging in Perth.', organiserUrl: 'https://www.ranzcr.com/events/' });
  conf({ id: 'general-breast-imaging-meeting-2027-wellington', name: '15th General Breast Imaging Meeting 2027', organiser: 'Breast Imaging Group (listed by RANZCR)',
    specialty: 'Radiology', city: 'Wellington', countryCode: 'NZ', start: '2027-03-04', end: '2027-03-07', src: R + 'breast-imaging-group-meeting-2027-4-7-march-2027/',
    quote: 'join us in Wellington, New Zealand, for the 15th General Breast Imaging Meeting, taking place 4–7 March 2027 at Tākina, Wellington.',
    blurb: 'Biennial breast imaging meeting for radiologists, breast physicians and sonographers at Tākina, Wellington, with industry workshops on the Thursday.', organiserUrl: 'https://www.ranzcr.com/events/' });
  conf({ id: 'ranzcr-nsw-womens-imaging-weekend-2027', name: "2027 Women's Imaging Weekend (RANZCR NSW Branch)", organiser: 'RANZCR NSW Branch',
    specialty: 'Radiology', city: 'Sydney', start: '2027-04-03', end: '2027-04-04', src: R + '2027-womens-imaging-weekend-nsw-branch-3-4-april-2027/',
    quote: '3-4 April 2027 | Amora Hotel, 11 Jamison Street, Sydney',
    blurb: "Two days on breast, obstetric and gynaecological imaging with localisation and biopsy workshops, at the Amora Hotel, Sydney.", organiserUrl: 'https://www.ranzcr.com/events/' });
  conf({ id: 'ranzcr-frogg-trainee-weekend-2027', name: 'FROGG Trainee Weekend 2027', organiser: 'RANZCR Faculty of Radiation Oncology',
    specialty: 'Radiation Oncology', city: 'Melbourne', start: '2027-05-01', end: '2027-05-02', src: R + 'save-the-date-frogg-trainee-weekend-2027-1-2-may-2027/',
    quote: '1-2 May 2027 Melbourne, Victoria', blurb: 'Weekend meeting for radiation oncology trainees in Melbourne.', organiserUrl: 'https://www.ranzcr.com/events/' });

  course({ id: 'ranzcr-smart-workshop', name: 'RANZCR Trainee SMART Workshop (research and evidence appraisal, one day)',
    providers: [{ name: 'RANZCR', url: R + 'smart-workshop-2027/', verified: true }], countries: ['AU'], typicalLength: '1 day',
    notes: 'One-day interactive workshop for radiology trainees on critical appraisal of clinical research and evidence-based medicine.' });
  sess({ id: 'ranzcr-smart-workshop-tas-hobart-2027-03-09', courseId: 'ranzcr-smart-workshop', provider: 'RANZCR', city: 'Hobart', region: 'TAS',
    venue: 'Wellington Room B, Wrest Point, Hobart', start: '2027-03-09', src: R + 'smart-workshop-2027/',
    quote: 'Date: Tuesday, 9 March 2027 | Venue: Wellington Room B, Wrest Point, Hobart, Tasmania', sourceKind: 'RANZCR own event page' });
  course({ id: 'ranzcr-fliro', name: 'Foundations of Leadership in Radiation Oncology (FLiRO)',
    providers: [{ name: 'RANZCR', url: R + 'foundations-of-leadership-in-radiation-oncology-fliro/', verified: true }], countries: ['AU'], typicalLength: 'online session, then 1.5 days in person',
    notes: 'Interdisciplinary leadership course for the radiation oncology professions: an online session and modules, then an in-person program in Melbourne.' });
  sess({ id: 'ranzcr-fliro-vic-melbourne-2027-04-13', courseId: 'ranzcr-fliro', provider: 'RANZCR', city: 'Melbourne', region: 'VIC', start: '2027-04-13', end: '2027-04-14',
    venueNote: 'the page names Melbourne, not the venue', src: R + 'foundations-of-leadership-in-radiation-oncology-fliro/',
    quote: '13 -14 April 2027 | Melbourne – Tuesday (afternoon) & Wednesday (whole day)', sourceKind: 'RANZCR own event page',
    sessionNote: 'online session on 17 March 2027 and online modules come first; expressions of interest by 22 December 2026 (page)' });

  /* ================= SHINE SA IUD insertion workshops 2027 (womens-gp holds SHINE's other courses) ================= */
  const SH = 'https://shinesa.org.au/activity/iud-insertion-training/';
  course({ id: 'shine-iud-insertion-workshop', name: 'SHINE SA IUD Insertion Training: practical workshop (2.5 hours)',
    providers: [{ name: 'SHINE SA', url: SH, verified: true }], countries: ['AU'], typicalLength: '2.5 hours (then supervised clinical sessions)',
    formatEvidence: { sourceUrl: SH, quote: 'Part two: Practical workshop (2. 5 hours)' },
    notes: 'The practical workshop of SHINE SA\'s three-part IUD insertion training for doctors (online module, workshop with pelvic models, then three supervised clinical sessions). The general IUD training type is held by the womens-gp source.' });
  for (const [d, m] of [['28', 'January'], ['23', 'March'], ['11', 'May']]) {
    const start = iso(2027, MON[m.slice(0, 3).toLowerCase()], d);
    sess({ id: `shine-iud-insertion-workshop-sa-woodville-${start}`, courseId: 'shine-iud-insertion-workshop', provider: 'SHINE SA',
      city: 'Adelaide (Woodville)', region: 'SA', venue: 'SHINE SA, 64C Woodville Road, Woodville', start, src: SH,
      quote: `IUD Insertion Training Workshop | Date: ${d} ${m} 2027 | Time: 9:30 am - 12:00 pm | Location: SHINE SA, 64C Woodville Road, Woodville`,
      priceFrom: 1600, priceNote: 'course cost incl. clinical training sessions (page: "$1,600")', sourceKind: 'SHINE SA own course page',
      sessionNote: 'practical workshop (part two of three: online module, workshop, supervised clinical sessions)' });
  }

  /* ================= Cardiac Skills Australia: one Wix service page per workshop ================= */
  const CSA = 'https://www.cardiacskillsaustralia.com.au/service-page/';
  const csaSlugs = ['adelaide-october-2027', 'auckland-august-2027', 'auckland-march-2027', 'brisbane-july-2027', 'brisbane-november-2027', 'brisbane-october-2027',
    'canberra-july-2027', 'darwin-june-2027', 'hobart-april-2027', 'hobart-october-2027', 'melbourne-august-2027', 'melbourne-august-2027-1', 'melbourne-february-2027',
    'melbourne-february-2027-1', 'melbourne-may-2027', 'melbourne-may-2027-1', 'melbourne-november-2027', 'melbourne-november-2027-1', 'perth-february-2027',
    'perth-june-2027', 'perth-october-2027', 'queenstown-destination-workshop-september-2027', 'sydney-february-2027', 'sydney-may-2027', 'sydney-november-2027', 'sydney-september-2027'];
  const csaTypes = new Set();
  for (const s of csaSlugs) {
    const u = CSA + s; if (!has(u)) { warn('csa: not cached ' + u); continue; }
    const L = lines(u), up = L.findIndex(l => /^Upcoming \d{1,2} \w+ 20\d\d/.test(l));
    if (up < 0) { warn('csa: no date line ' + u); continue; }
    const m = L[up].match(/^Upcoming (\d{1,2}) (\w+) (20\d\d)(?: - (\d{1,2}) (\w+) (20\d\d))? ([\d,]+) (Australian|New Zealand) dollars/);
    if (!m) { warn('csa: date line not parsed ' + L[up]); continue; }
    const start = iso(m[3], MON[m[2].slice(0, 3).toLowerCase()], m[1]), end = m[4] ? iso(m[6], MON[m[5].slice(0, 3).toLowerCase()], m[4]) : start;
    const title = L[up - 1], li = L.indexOf('Location'), loc = li > 0 ? L[li + 1] : null;
    const dest = /Destination Workshop/i.test(title), two = /2 Day/i.test(title) || dest, diast = /diastol/i.test(title);
    if (!two && !diast) { warn('csa: unknown workshop ' + title + ' ' + u); continue; }
    const courseId = two ? 'csa-focussed-cardiac-ultrasound' : 'csa-advanced-diastolic-function'; csaTypes.add(courseId);
    const city = (L.find(l => / (January|February|March|April|May|June|July|August|September|October|November|December) 20\d\d$/.test(l) && !/\|/.test(l)) || '').replace(/ (Destination Workshop )?\w+ 20\d\d$/, '');
    const [cc] = C[city] || [];
    if (!cc) { warn('csa: city not known ' + city + ' ' + u); continue; }
    sess({ id: slug('csa', courseId === 'csa-focussed-cardiac-ultrasound' ? 'fcu' : 'diastolic', city, start), courseId, variant: dest ? 'destination' : 'full', provider: 'Cardiac Skills Australia',
      city, region: cc === 'NZ' ? city : STATE[city], country: cc, venue: loc && !/^\d/.test(loc) ? loc : null, ...(loc && !/^\d/.test(loc) ? {} : { venueNote: 'the booking page names the city, not the venue' }), start, end,
      priceFrom: +m[7].replace(/,/g, ''), currency: m[8] === 'Australian' ? 'AUD' : 'NZD', priceNote: (L.find(l => /^AU \$ [\d,]+ \(\+ GST\)$/.test(l)) ? 'page: "' + L.find(l => /^AU \$ [\d,]+ \(\+ GST\)$/.test(l)) + '"' : 'page price') + (m[8] === 'Australian' && cc === 'NZ' ? '; the page prices the Auckland workshop in Australian dollars' : ''),
      src: u, quote: `${title} | ${L[up]}${loc && !/^\d/.test(loc) ? ' | ' + loc : ''}`, sourceKind: "Cardiac Skills Australia's own workshop booking page" });
  }
  course({ id: 'csa-focussed-cardiac-ultrasound', name: 'Focussed Cardiac Ultrasound 2-Day Workshop (Cardiac Skills Australia)',
    providers: [{ name: 'Cardiac Skills Australia', url: 'https://www.cardiacskillsaustralia.com.au/workshops', verified: true, calendar: 'https://www.cardiacskillsaustralia.com.au/workshop-booking' }],
    countries: ['AU', 'NZ'], typicalLength: '2 days', providerType: 'commercial',
    formatEvidence: { sourceUrl: 'https://www.cardiacskillsaustralia.com.au/workshops', quote: 'Our accredited 2‑day Focussed Cardiac Ultrasound workshop is designed for medical professionals seeking practical, clinically relevant cardiac ultrasound skills.' },
    notes: 'Two-day hands-on point-of-care cardiac ultrasound workshop in small groups (junior doctors to consultants, rural GPs); scanning real people.' });
  course({ id: 'csa-advanced-diastolic-function', name: 'Diastolic Dysfunction & Measurements Made Easy! one-day workshop (Cardiac Skills Australia)',
    providers: [{ name: 'Cardiac Skills Australia', url: 'https://www.cardiacskillsaustralia.com.au/workshops', verified: true, calendar: 'https://www.cardiacskillsaustralia.com.au/workshop-booking' }],
    countries: ['AU'], typicalLength: '1 day', providerType: 'commercial',
    formatEvidence: { sourceUrl: 'https://www.cardiacskillsaustralia.com.au/workshops', quote: 'Our one-day workshop provides a focused, clinically relevant deep dive into left ventricular diastolic function, tailored for point-of-care ultrasound users.' },
    notes: 'One-day workshop on left ventricular diastolic function for point-of-care ultrasound users.' });


  /* ================= ACEM own event pages ================= */
  conf({ id: 'acem-emf-research-symposium-2027', name: 'ACEM and EMF Research Symposium 2027', organiser: 'Australasian College for Emergency Medicine with the Emergency Medicine Foundation',
    specialty: 'Emergency Medicine', city: 'Brisbane', start: '2027-02-24', end: '2027-02-25', src: 'https://acem.org.au/Events/Research-Symposium-2027',
    quote: 'Research Symposium 2027, to be held from Wednesday 24 to Thursday 25 February 2027 at Hillstone St Lucia, Brisbane.',
    blurb: 'Two-day emergency medicine research symposium run by ACEM and the Emergency Medicine Foundation at Hillstone St Lucia, Brisbane.', organiserUrl: 'https://acem.org.au/Events' });
  conf({ id: 'acem-queensland-autumn-symposium-2027', name: 'ACEM Queensland Autumn Symposium 2027', organiser: 'Australasian College for Emergency Medicine, Queensland Branch',
    specialty: 'Emergency Medicine', city: 'Brisbane', start: '2027-05-27', end: '2027-05-28', src: 'https://acem.org.au/Events/ACEM-Queensland-Autumn-Symposium-2027',
    quote: 'Join us at the 2027 ACEM Queensland Autumn Symposium to be held at the Brisbane Convention & Exhibition Centre from Thursday 27 May to Friday 28 May 2027.',
    blurb: 'Queensland branch emergency medicine symposium for members, trainees and rural generalists at the Brisbane Convention & Exhibition Centre.', organiserUrl: 'https://acem.org.au/Events' });

  /* ================= RACGP Practice Owners Conference (its own conference site) ================= */
  conf({ id: 'racgp-practice-owners-conference-2027', name: 'RACGP Practice Owners Conference 2027', organiser: 'The Royal Australian College of General Practitioners',
    specialty: 'General Practice', city: 'Gold Coast', start: '2027-05-22', end: '2027-05-23', src: 'https://practiceownersconference.com.au/registration/', url: 'https://practiceownersconference.com.au/registration/',
    quote: 'Practice Owners Conference 2027 is being held at the Gold Coast Convention and Exhibition Centre (GCCEC) on Saturday 22 – Sunday 23 May 2027.',
    blurb: 'Conference for current and aspiring general practice owners, practice managers and business-minded GPs at the Gold Coast Convention and Exhibition Centre.' });

  /* ================= Nepean Blue Mountains PHN events calendar ================= */
  conf({ id: 'nbmphn-healthy-ageing-conference-2027', name: 'NBMPHN Healthy Ageing Conference 2027', organiser: 'Nepean Blue Mountains Primary Health Network',
    specialty: 'Geriatrics', city: 'Sydney', start: '2027-04-03', end: '2027-04-03', src: 'https://events.nbmphn.com.au/all-events/', url: 'https://events.nbmphn.com.au/all-events/',
    quote: 'Healthy Ageing Conference 2027 | 03 April 2027 | Western Sydney Conference Centre',
    blurb: 'Inaugural one-day conference for GPs, practice nurses and allied health providers caring for older adults, at the Western Sydney Conference Centre.' });

  /* ================= South Western Sydney PHN CPD events ================= */
  course({ id: 'swsphn-resuscitation-skills-general-practice', name: 'Resuscitation skills for general practice (SWSPHN evening workshop)',
    providers: [{ name: 'South Western Sydney PHN', url: 'https://swsphn.com.au/events/', verified: true }], countries: ['AU'], typicalLength: '3 hours',
    notes: 'Face-to-face CPR refresher for GPs and practice teams using ARC guidelines, presented by Medics for Life.' });
  sess({ id: 'swsphn-resuscitation-skills-general-practice-nsw-warwick-farm-2027-02-18', courseId: 'swsphn-resuscitation-skills-general-practice', provider: 'South Western Sydney PHN',
    city: 'Sydney (Warwick Farm)', region: 'NSW', venue: 'The William Inglis Hotel, Warwick Farm, 155 Governor Macquarie Drive', start: '2027-02-18',
    src: 'https://swsphn.com.au/event/resuscitation-skills-for-general-practice/', priceFrom: 121, priceNote: 'page: "$121 (GST inclusive)"',
    quote: '18 February 2027 @ 6.30PM - 18 February 2027 @ 9.30PM | $121 (GST inclusive) | The William Inglis Hotel, Warwick Farm', sourceKind: 'SWSPHN own CPD event page' });

  /* ================= Ace the OSCE (Westmead; the course's own Humanitix page) ================= */
  course({ id: 'ace-the-osce-acem', name: 'Ace the OSCE: ACEM OSCE preparation course (Westmead, one day)',
    providers: [{ name: 'Ace the OSCE (FACEM faculty, Westmead Simulation Centre)', url: 'https://events.humanitix.com/osce2027', verified: true }], countries: ['AU'], typicalLength: '1 day',
    notes: 'Whole-day coached OSCE practice for ACEM Fellowship OSCE candidates at the Westmead simulation centre (SiLECT), with free online materials beforehand.' });
  sess({ id: 'ace-the-osce-acem-nsw-westmead-2027-02-12', courseId: 'ace-the-osce-acem', provider: 'Ace the OSCE (FACEM faculty, Westmead Simulation Centre)', city: 'Sydney (Westmead)', region: 'NSW',
    venue: 'Simulation Centre (SiLECT), Level 3 WECC, Westmead Hospital', start: '2027-02-12', src: 'https://events.humanitix.com/osce2027',
    quote: 'Fri, 12 Feb 2027, 8am - 5pm AEDT | Simulation Centre (SiLECT) - Level 3 WECC, Westmead Hospital | Whole-Day - In-person OSCE Course', sourceKind: "the course's own Humanitix event page" });


  /* ================= UWA CTEC (Perth): the surgical, GP and specialist workshops (resus holds the six emergency ones) ================= */
  const ctec = require('./resus-ctec');
  const CT = 'https://www.ctec.uwa.edu.au/workshops/', LIST = lines(CT.replace(/\/$/, ''));
  const ctecPages = ['advanced-gi-endoscopy-workshop', 'core-skills-ent-facial-plastic-surgery-workshop', 'core-skills-ent-sinus-surgery-workshop',
    'core-skills-gynaecological-hysteroscopy-laparoscopy-and-open-surgery', 'core-skills-intermediate-laparoscopic-skills-workshop',
    'core-skills-microsurgical-skills-and-anastomotic-techniques', 'core-skills-plastic-surgery-head-neck-and-flaps', 'core-skills-plastic-surgery-lower-limb-workshop',
    'core-skills-vascular-surgery-workshop', 'core-skills-workshop-neck-dissection-thyroid-carcinoma', 'cutting-edge-advanced-plastering-techniques',
    'cutting-edge-advanced-skin-procedures', 'cutting-edge-advanced-surgical-procedures-rural-generalists', 'cutting-edge-introductory-wound-suturing',
    'cutting-edge-managing-skin-soft-tissue-injuries', 'cutting-edge-proceduralist-obstetrics-and-gynaecological-skills', 'introductory-gastrointestinal-endoscopy',
    'jdocs-foundations-minimal-access-surgery', 'jdocs-introduction-surgical-skills'];
  for (const pg of ctecPages) {
    const u = CT + pg; if (!has(u)) { warn('ctec: not cached ' + u); continue; }
    const courseId = 'ctec-' + pg.replace(/-workshop$/, '');
    const r = ctec.parse(html(u), { today, sourceUrl: u, courseId });
    if (!r.sessions.length) continue;
    const L = lines(u), title = (L[0] || '').replace(/\s*\|.*$/, '').trim();
    const li = LIST.indexOf(title), aud = [];
    if (li >= 0 && LIST[li + 1] === 'Suitable for') for (let k = li + 2; k < LIST.length && !/20\d\d$/.test(LIST[k]) && aud.length < 6; k++) aud.push(LIST[k]);
    course({ id: courseId, name: title + ' (UWA CTEC, Perth)', providers: [{ name: 'UWA CTEC (Clinical Training & Evaluation Centre)', url: u, verified: true, calendar: CT }],
      countries: ['AU'], notes: 'Hands-on workshop at the UWA Clinical Training & Evaluation Centre, Perth.' + (aud.length ? ' Suitable for (workshop list): ' + aud.join('; ') + '.' : '') });
    for (const x of r.sessions) sessions.push({ ...x, priceNote: undefined });
  }


  /* ================= ASPS own event pages (plasticsurgery.org.au/event/...) ================= */
  const AS = 'https://plasticsurgery.org.au/event/';
  conf({ id: 'apfsrm-psc-2028-melbourne', name: '8th Asia Pacific Federation of Societies for Reconstructive Microsurgery (APFSRM) with the Plastic Surgery Congress 2028',
    organiser: 'Australian Society of Plastic Surgeons with the Asia Pacific Federation of Societies for Reconstructive Microsurgery', specialty: 'Plastic Surgery', city: 'Melbourne',
    start: '2028-05-18', end: '2028-05-20', src: AS + '8th-apfsrm/',
    quote: 'combined with the Plastic Surgery Congress, to be held in Melbourne, Australia from 18–20 May 2028.',
    blurb: 'The Asia-Pacific reconstructive microsurgery congress, held in Melbourne together with the ASPS Plastic Surgery Congress.', organiserUrl: 'https://plasticsurgery.org.au/about-asps/events/' });
  conf({ id: 'burns-critical-care-symposium-2027', name: 'Burns Critical Care Symposium 2027', organiser: 'Burns Critical Care Symposium (listed by the Australian Society of Plastic Surgeons)',
    specialty: 'Critical Care', city: 'Melbourne', start: '2027-03-22', end: '2027-03-22', src: AS + 'burns-critical-care-symposium-2027/',
    quote: 'Monday 22nd March - | Monday 22nd March, 2027 | The Alfred, Innovation & Education Hub',
    blurb: 'One-day multidisciplinary symposium on the acute management of major burns, from pre-hospital care to ICU discharge, at The Alfred Innovation & Education Hub.', organiserUrl: 'https://plasticsurgery.org.au/about-asps/events/' });
  conf({ id: 'mentor-apac-breast-symposium-2027', name: '2027 MENTOR APAC Breast Symposium', organiser: 'MENTOR (industry symposium, listed by the Australian Society of Plastic Surgeons)',
    specialty: 'Plastic Surgery', city: 'Sydney', start: '2027-03-05', end: '2027-03-06', src: AS + '2027-mentor-apac-breast-symposium/',
    quote: 'Friday 5th March - | Saturday 6th March, 2027 | W Sydney',
    blurb: 'Industry-run two-day symposium on complex breast surgery cases with APAC and international faculty, at W Sydney.', organiserUrl: 'https://plasticsurgery.org.au/about-asps/events/' });


  /* ================= RACP-hosted events on its own events listing ================= */
  conf({ id: 'racp-sa-research-forum-2026', name: 'RACP SA Research Forum and Trainee Research Awards 2026', organiser: 'Royal Australasian College of Physicians (South Australia)',
    specialty: 'General Medicine', city: 'Adelaide', start: '2026-12-05', end: '2026-12-05',
    src: 'https://www.racp.edu.au/news-and-events/all-events/event-details?id=855dd6af-bbb2-61c2-b08b-ff01001c3177',
    quote: 'RACP SA Research Forum and Trainee Research Awards | Date: | 05 Dec 2026 at 2:00 PM to 6:00 PM | Royal Adelaide Hospital Lecture theatre, Level 8',
    blurb: 'Afternoon research forum for physician trainees, researchers and clinicians at the Royal Adelaide Hospital, ending with the SA Trainee Research Awards.', organiserUrl: 'https://www.racp.edu.au/news-and-events/all-events' });

  /* WCPGHAN 2028 (Brisbane, 30 Aug - 2 Sep 2028) is left out: its dates are only on the congress site's home page (a site root). */

  return { conferences, courses, sessions };
};
