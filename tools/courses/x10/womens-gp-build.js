'use strict';
/* x10 womens-gp desk: build data/courses/sources/womens-gp.{sessions,catalogue}.json from pages fetched this run.
   Usage: node tools/courses/x10/womens-gp-build.js --cache DIR [--today YYYY-MM-DD]
   DIR/index.tsv lines: <url>\t<file>\t<final url>  (written by the polite fetcher; one request at a time, >= 3 s per host,
   robots.txt honoured, Cloudflare/403 skipped). Every catalogue quote is looked up in the cached page text and dropped
   (with a warning) if it is not there verbatim, so nothing is typed from memory. */
const fs = require('node:fs'), path = require('node:path');
const P = require('./womens-gp-parsers');
const acrrm = require('../acrrm');
const { text, slug } = require('../util');

const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const cacheDir = arg('--cache');
const today = arg('--today') || new Date().toISOString().slice(0, 10);
const outDir = arg('--out') || path.join(__dirname, '..', '..', '..', 'data', 'courses', 'sources');
if (!cacheDir) { console.error('need --cache DIR'); process.exit(2); }
const idx = new Map();
for (const l of fs.readFileSync(path.join(cacheDir, 'index.tsv'), 'utf8').trim().split('\n')) { const [u, f] = l.split('\t'); idx.set(u, f); }
const page = u => { const f = idx.get(u); return f && fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null; };
const warnings = [], counts = {};
const norm = s => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
const flat = new Map();
const pageText = u => { if (!flat.has(u)) { const h = page(u); flat.set(u, h ? norm(text(h).split('\n').join(' ')) : ''); } return flat.get(u); };
/* evidence: the quote must occur in the page text (whitespace/quote-mark normalised) */
function ev(u, quote) {
  if (!page(u)) { warnings.push(`no cached page for evidence ${u}`); return null; }
  if (!pageText(u).includes(norm(quote))) { warnings.push(`quote not found on ${u}: "${quote.slice(0, 80)}"`); return null; }
  return { sourceUrl: u, quote: quote.slice(0, 200), lastVerified: today };
}
/* grab: first match of a regex in the page text, as a verbatim quote */
function grab(u, re) { const m = pageText(u).match(re); if (!m) { warnings.push(`no match ${re} on ${u}`); return null; } return m[0].slice(0, 200).trim(); }

const sessions = [], courses = [], onlineIntakes = [];
const add = (src, arr) => { counts[src] = (counts[src] || 0) + arr.length; sessions.push(...arr); };

/* ================= FSEP (RANZCOG) — The Events Calendar REST feed ================= */
const FSEP_FEED = 'https://fsep.ranzcog.edu.au/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-11-18&end_date=2028-12-31';
const FSEP_PLACE = { /* title -> [city, region for NZ] (titles name the hospital only) */
  'St George Private Hospital': ['Kogarah'], 'Bendigo Health Care Group': ['Bendigo'], 'Barwon Health Geelong': ['Geelong'],
  'Tauranga Hospital': ['Tauranga', 'Bay of Plenty'], 'Waitakere Hospital': ['Auckland (Waitakere)', 'Auckland'], 'North Shore Private Hospital [NSW]': ['St Leonards'],
  'Ballarat Health Services': ['Ballarat'], 'Goondiwindi Hospital': ['Goondiwindi'], 'Fiona Stanley Hospital': ['Murdoch'], 'Mater Hospital Sydney': ['North Sydney'],
  'Waikato Hospital': ['Hamilton', 'Waikato'], 'Rockhampton Hospital': ['Rockhampton'], 'Southland Hospital – Invercargill': ['Invercargill', 'Southland'],
  'Flinders Medical Centre': ['Bedford Park'], 'Logan Hospital': ['Meadowbrook'], 'The Northern Hospital': ['Epping'], 'Sunshine Hospital [Western Health]': ['St Albans'],
  'Frankston Hospital [Peninsula Health]': ['Frankston'], 'King Edward Memorial Hospital': ['Subiaco'], 'Epworth Freemasons (Richmond)': ['Richmond'],
  'Royal Women’s Hospital': ['Parkville'], 'Joondalup Private Hospital': ['Joondalup'], 'Royal Brisbane & Women’s Hospital': ['Herston']
};
{
  const body = page(FSEP_FEED);
  if (body) {
    const r = P.parseTribe(JSON.parse(body), {
      url: FSEP_FEED, today, sourceKind: 'FSEP (RANZCOG) own events feed (The Events Calendar REST API behind fsep.ranzcog.edu.au/events-workshops)',
      classify: (e, { title, desc, cf }) => {
        if (cf['Event Type'] && !/Full Day/i.test(cf['Event Type'])) return { skip: 'event type ' + cf['Event Type'] };
        const restricted = desc.match(/^(For [^.]*?only\.)/);
        if (restricted && !/external/i.test(restricted[1])) return { skip: 'closed session: ' + restricted[1] };
        const place = FSEP_PLACE[title];
        if (!place) return { skip: 'hospital not mapped to a town: ' + title };
        const nz = cf.Location === 'NZ';
        const lead = desc.match(/^(For [^.]*\.)/);
        return {
          courseId: 'fsep-full-day', variant: 'full', provider: 'RANZCOG Fetal Surveillance Education Program (FSEP)', city: place[0],
          region: nz ? place[1] : cf.Location, country: nz ? 'NZ' : 'AU', venue: title,
          accessNote: (lead ? lead[1] + ' ' : '') + 'Hosted by the hospital: register through the hospital educator named on the event page.'
        };
      }
    });
    r.sessions.forEach(s => { s.id = slug('fsep-full-day', s.country === 'NZ' ? 'nz' : s.region, s.city, s.start); });
    add('FSEP', r.sessions); r.skipped.forEach(x => warnings.push('FSEP skipped: ' + JSON.stringify(x)));
  } else warnings.push('FSEP feed not cached');
}

/* ================= Skin Cancer College Australasia ================= */
for (const k of ['ASSW_APR27', 'ASSW_AUG27', 'ASSW_JUL27', 'ASSW_MAY27', 'CSCM_APR27', 'CSCM_AUG27', 'CSCM_FEB27', 'CSCM_JUL27', 'CSCM_JUN27', 'CSCM_MAR27', 'CSCM_MAY27', 'CSCM_OCT27', 'CSCM_SEP27', 'DERM_AUG27', 'DERM_FEB27', 'DERM_JUL27', 'DERM_MAR27', 'DERM_MAY27']) {
  const u = 'https://www.skincancercollege.org/EventDetail?EventKey=' + k, h = page(u);
  if (!h) { warnings.push('SCCA not cached ' + k); continue; }
  const r = P.parseScca(h, { url: u, today });
  add('SCCA', r.sessions); onlineIntakes.push(...r.onlineIntakes);
  r.skipped.filter(x => !/online intake/.test(x.reason)).forEach(x => warnings.push('SCCA skipped: ' + JSON.stringify(x)));
}

/* ================= HealthCert practical workshops ================= */
const HC_CAL = 'https://www.healthcert.com/workshops/calendar';
if (page(HC_CAL)) { const r = P.parseHealthcertCalendar(page(HC_CAL), { url: HC_CAL, today }); add('HealthCert', r.sessions); r.skipped.forEach(x => warnings.push('HealthCert skipped: ' + JSON.stringify(x))); }

/* ================= Healthed seminars ================= */
for (const k of ['swch27', 'mwch27', 'bwch27', 'awch27', 'pwch27', 'bhmu27', 'mhmu27', 'shmu27', 'phmu27']) {
  const u = `https://www.healthed.com.au/events/${k}/`; if (!page(u)) { warnings.push('Healthed not cached ' + k); continue; }
  const r = P.parseHealthed(page(u), { url: u, today }); add('Healthed', r.sessions); r.skipped.forEach(x => warnings.push('Healthed skipped: ' + JSON.stringify(x)));
}

/* ================= Australian Institute of Ultrasound ================= */
const aiuCourses = new Map();
const aiuId = n => 'aiu-' + slug(n.replace(/&#038;|&amp;/g, 'and').replace(/&/g, 'and').replace(/\bCourse\b/g, ''));
for (const u of [...idx.keys()].filter(u => /^https:\/\/www\.aiu\.edu\.au\/ultrasound-courses\/[^/]+\/[^/]+\/$/.test(u))) {
  const r = P.parseAiu(page(u), { url: u, today, courseIdFor: aiuId });
  if (!r.name) continue;
  const id = aiuId(r.name);
  const c = aiuCourses.get(id) || { id, name: r.name, pages: [] }; c.pages.push({ url: u, len: r.lenLine, prices: r.sessions.map(s => s.priceFrom) }); aiuCourses.set(id, c);
  add('AIU', r.sessions);
}

/* ================= ACRRM courses not yet in the catalogue (same table parser as tools/courses/acrrm.js) ================= */
const ACRRM_EXTRA = [
  { re: /^Advanced Airway\b/i, courseId: 'acrrm-advanced-airway', variant: 'full', page: 'advanced-airway', days: 1 },
  { re: /^Rural Anaesthetic Crisis Management\b/i, courseId: 'acrrm-racm', variant: 'full', page: 'racm', days: 1 },
  { re: /^Pre-Hospital Emergency Care\b/i, courseId: 'acrrm-phec', variant: 'full', page: 'pre-hospital-emergency-care-phec', days: 1, lengthNotStated: true },
  { re: /^Point of Care Ultrasound for Rural Generalists\b/i, courseId: 'acrrm-pocus-rg', variant: 'full', page: 'point-of-care-ultrasound-for-rural-generalists', days: 1 }
];
/* The resus desk (data/courses/sources/resus.*) already carries these four ACRRM courses with the same ids, so they are
   left out by default; --with-acrrm adds them (e.g. if that desk's files are not merged). */
const WITH_ACRRM = process.argv.includes('--with-acrrm');
acrrm.COURSES.push(...ACRRM_EXTRA); /* in-process only: the shared module file is not edited */
for (const d of WITH_ACRRM ? ACRRM_EXTRA : []) {
  const u = acrrm.BASE + d.page; if (!page(u)) { warnings.push('ACRRM not cached ' + d.page); continue; }
  const r = acrrm.parse(page(u), { today, sourceUrl: u });
  const mine = r.sessions.filter(s => s.courseId === d.courseId);
  if (d.lengthNotStated) mine.forEach(s => { s.endInferred = true; s.endNote = 'the course page does not state the number of face-to-face days; one day assumed (row gives one date)'; });
  add('ACRRM', mine);
}

/* ================= SHQ (WA) ================= */
const SHQ = [
  { u: 'https://shq.org.au/course/iud-theory/', courseId: 'iud-insertion-training', variant: 'shq-theory-workshop', title: 'IUD Theory Training', sessionNote: 'evening theory workshop with practice insertions on pelvic models; supervised IUD clinics are booked separately' },
  { u: 'https://shq.org.au/course/implant-training/', courseId: 'contraceptive-implant-training', variant: 'shq-theory-workshop', title: 'Contraceptive Implant Theory Workshop' },
  { u: 'https://shq.org.au/course/certificate-nursing/', courseId: 'sexual-reproductive-health-certificate-nurses', variant: 'shq-face-to-face', title: 'Certificate in Sexual and Reproductive Health (Nursing) Face to Face' },
  { u: 'https://shq.org.au/course/certificate-nursing-cervical-screening-only/', courseId: 'cervical-screening-training-nurses', variant: 'shq-module-2', title: 'Module 2 Cervical Screening (Face to Face)' },
  { u: 'https://shq.org.au/course/unintended-pregnancy-counselling-training/', courseId: 'pregnancy-options-counselling-training', variant: 'shq-two-day', title: 'Unintended Pregnancy Counselling Training' }
];
for (const d of SHQ) { if (!page(d.u)) { warnings.push('SHQ not cached ' + d.u); continue; } const r = P.parseShq(page(d.u), { ...d, url: d.u, today }); add('SHQ', r.sessions); r.skipped.forEach(x => warnings.push('SHQ skipped: ' + JSON.stringify(x))); }

/* ================= SHINE SA ================= */
const SHINE = {
  'implanon-nxt-training-doctors': t => /Implanon/i.test(t) && { courseId: 'contraceptive-implant-training', variant: /^Hybrid/i.test(t) ? 'shine-hybrid-doctors' : 'shine-doctors', ...(/^Hybrid/i.test(t) ? { sessionNote: 'online theory module first, then a 1-hour onsite practical simulation session' } : {}) },
  'implanon-nurses': t => /Implanon/i.test(t) && { courseId: 'contraceptive-implant-training', variant: /^Hybrid/i.test(t) ? 'shine-hybrid-nurses-midwives' : 'shine-nurses-midwives', ...(/^Hybrid/i.test(t) ? { sessionNote: 'online theory module first, then a 1-hour onsite practical simulation session' } : {}) },
  'iud-train-trainer-program': t => /IUD/i.test(t) && { courseId: 'iud-insertion-train-the-trainer', variant: 'shine' },
  'certificate-in-sexual-health': t => /Certificate/i.test(t) && { courseId: 'sexual-reproductive-health-certificate-nurses', variant: 'shine-five-day' },
  'srha': t => /National Certificate/i.test(t) && { courseId: 'srha-national-certificate-doctors', variant: 'shine-face-to-face' },
  'pregnancy-choices-training': t => /Pregnancy Choices/i.test(t) && { courseId: 'pregnancy-options-counselling-training', variant: 'shine-one-day' }
};
for (const [k, cls] of Object.entries(SHINE)) {
  const u = `https://shinesa.org.au/activity/${k}/`; if (!page(u)) { warnings.push('SHINE not cached ' + k); continue; }
  const r = P.parseShine(page(u), { url: u, today, classify: cls }); add('SHINE SA', r.sessions); r.skipped.forEach(x => warnings.push('SHINE skipped: ' + JSON.stringify(x)));
}

/* ================= Sexual Health Victoria ================= */
const SHV_NC = 'https://www.shvic.org.au/courses/194-sexual-and-reproductive-health-australia-national-certificate-for-doctors-course-face-to-face/';
if (page(SHV_NC)) {
  const r = P.parseShv(page(SHV_NC), { url: SHV_NC, today, courseId: 'srha-national-certificate-doctors', variant: 'shv-face-to-face', title: 'Sexual and Reproductive Health Australia National Certificate for Doctors Course – Face to face', venue: 'Sexual Health Victoria, Box Hill offices', priceFrom: 1980, priceNote: 'page: "Theory course only - $ 1980 (GST does not apply)"; exam and clinical placements cost more' });
  add('SHV', r.sessions); r.skipped.forEach(x => warnings.push('SHV skipped: ' + JSON.stringify(x)));
}

/* ================= Rural Health West ================= */
const RHW = [
  [/^Mental Health Skills Training/, 'rhw-mental-health-skills-training'], [/^Paediatric Emergencies and Clinical Healthcare Scenarios/, 'rhw-peachs'],
  [/^Trauma Informed De-Escalation/, 'rhw-tide'], [/^Neonatal Stabilisation and Transport Readiness/, 'rhw-neostars'],
  [/^Rural Emergency Advanced Clinical Training/, 'rhw-react-plus'], [/^Emergency Airway Skills Management/, 'rhw-eam']
];
for (const u of [...idx.keys()].filter(u => /^https:\/\/ruralhealthwest\.com\.au\/events\/[a-z0-9-]+\/$/.test(u) && !/\/events\/(page|feed)/.test(u))) {
  const r = P.parseRhw(page(u), { url: u, today, classify: t => { const m = RHW.find(([re]) => re.test(t)); return m && { courseId: m[1] }; } });
  /* two URLs can serve the same event page (TIDE Perth page showed the Busselton event): keep the first */
  r.sessions = r.sessions.filter(s => !sessions.some(x => x.courseId === s.courseId && x.city === s.city && x.start === s.start));
  add('Rural Health West', r.sessions); r.skipped.forEach(x => warnings.push('RHW skipped: ' + JSON.stringify(x)));
}

/* ================= SAPMEA (SA) ================= */
const SAP = [
  [/^COPD Management and Spirometry/, 'sapmea-copd-spirometry-workshop'], [/^Shoulder and Back Injuries/, 'sapmea-msk-return-to-work-workshop'],
  [/^MSK Hip and Knee Injuries/, 'sapmea-msk-return-to-work-workshop'], [/^Mental Health: Strategies for Effective Care/, 'sapmea-mental-health-strategies-workshop'],
  [/^EMET Major Trauma/, 'emet-major-trauma-workshop']
];
for (const u of [...idx.keys()].filter(u => /^https:\/\/sapmea\.asn\.au\/education\/events\/[a-z0-9-]+$/.test(u))) {
  const r = P.parseSapmea(page(u), { url: u, today, classify: t => { const m = SAP.find(([re]) => re.test(t)); return m && { courseId: m[1] }; } });
  add('SAPMEA', r.sessions); r.skipped.forEach(x => warnings.push('SAPMEA skipped: ' + JSON.stringify(x)));
}

/* ---------- de-duplicate (same course/variant/city/start/end/venue) and make ids unique ---------- */
const seenKey = new Set(), seenId = new Map(), out = [];
for (const s of sessions) {
  const k = [s.courseId, s.variant, s.provider, s.city, s.start, s.end, s.venue || ''].join('|').toLowerCase();
  if (seenKey.has(k)) { warnings.push('duplicate dropped ' + s.id); continue; }
  seenKey.add(k);
  let id = s.id, n = 2; while (seenId.has(id)) id = `${s.id}-${n++}`; seenId.set(id, 1); s.id = id;
  out.push(s);
}

/* ================= catalogue ================= */
const P_ = (name, url, extra = {}) => ({ name, url, verified: true, ...extra });
const E = (u, re) => { const qq = typeof re === 'string' ? re : grab(u, re); return qq ? ev(u, qq) : null; };
function course(c) {
  for (const k of ['audienceEvidence', 'formatEvidence']) if (c[k] === null) { delete c[k]; if (k === 'audienceEvidence') c.audience = c.audience ? c.audience : null; }
  if (c.otherEvidence) c.otherEvidence = c.otherEvidence.filter(Boolean);
  if (c.feeRange && !(c.feeSource && c.feeQuote && pageText(c.feeSource).includes(norm(c.feeQuote)))) { warnings.push(`fee quote not verified for ${c.id}; fee dropped`); c.feeRange = null; delete c.feeQuote; delete c.feeSource; }
  courses.push({ certificateValidityYears: null, validitySource: null, recertification: null, feeRange: null, cpdHours: 0, verified: true, lastVerified: today, ...c });
}

const FSEP_FD = 'https://fsep.ranzcog.edu.au/what-we-offer/available-programs/full-day-program/', FSEP_TA = 'https://fsep.ranzcog.edu.au/about-fsep/target-audience/', FSEP_ON = 'https://fsep.ranzcog.edu.au/what-we-offer/online-program/';
course({
  id: 'fsep-full-day', name: 'FSEP Full Day Program (fetal surveillance / CTG education)',
  providers: [P_('RANZCOG Fetal Surveillance Education Program (FSEP)', 'https://fsep.ranzcog.edu.au/', { calendar: 'https://fsep.ranzcog.edu.au/events-workshops/', feed: FSEP_FEED })],
  countries: ['AU', 'NZ'], audience: 'All clinicians involved in antenatal and intrapartum care (multidisciplinary: midwives, obstetricians, GP obstetricians, trainees).',
  audienceEvidence: E(FSEP_FD, /for all clinicians involved in antenatal and intrapartum care/),
  format: 'One-day (7-hour) face-to-face workshop, usually hosted by a hospital for its maternity staff; registration is through the host hospital educator.',
  formatEvidence: E(FSEP_FD, /The FSEP Full Day program runs for 7 hours total[^.]*\./), typicalLength: '7 hours (one day)',
  cpdNote: 'check provider (FSEP has CPD pages per program; not read this run)',
  otherEvidence: [E(FSEP_TA, /We encourage multidisciplinary participation in all FSEP education sessions[^.]*\./), E(FSEP_ON, /The 2026 OFSEP is a free online program[^.]*\./)],
  notes: 'Many sessions are closed to outside staff; sessions marked "internal staff only" or "employees only" on the FSEP page are not listed. The free online OFSEP is self-paced (no sessions).'
});

const sccaU = k => 'https://www.skincancercollege.org/EventDetail?EventKey=' + k;
course({
  id: 'scca-certificate-skin-cancer-medicine', name: 'Certificate of Skin Cancer Medicine (SCCA)',
  providers: [P_('Skin Cancer College Australasia (SCCA)', 'https://www.skincancercollege.org/', { calendar: 'https://www.skincancercollege.org/events' })], countries: ['AU', 'NZ'],
  audience: 'Registered medical practitioners (GPs) starting in primary care skin cancer medicine; nurses must contact SCCA first.',
  audienceEvidence: E(sccaU('CSCM_FEB27'), /This course is the recommended starting point for GPs wanting to expand their knowledge and skills in primary care skin cancer medicine\./),
  format: 'About four weeks of online learning, then a one-day face-to-face practical workshop (8.30am-5pm).',
  formatEvidence: E(sccaU('CSCM_FEB27'), 'Online Learning 19 February - 19 March 2027 Practical Workshop 20 March 2027'),
  typicalLength: 'online learning + 1-day practical workshop',
  feeRange: { currency: 'AUD', min: 2930, max: 2930, text: '$2930 AUD / NZD inc GST (member discount $110)' }, feeSource: sccaU('CSCM_FEB27'), feeQuote: '$2930 AUD / NZD*',
  cpdNote: 'check provider (SCCA "SkinPro CPD"; hours not printed on the event page)',
  otherEvidence: [E(sccaU('CSCM_FEB27'), /Students must be registered medical practitioners\. Nurses interested in this course should contact SCCA prior to enrolling\./)]
});
course({
  id: 'scca-advanced-skin-surgery-workshop', name: 'Advanced Skin Surgery Workshop (SCCA): flaps and grafts',
  providers: [P_('Skin Cancer College Australasia (SCCA)', 'https://www.skincancercollege.org/', { calendar: 'https://www.skincancercollege.org/events' })], countries: ['AU', 'NZ'],
  audience: 'Doctors already doing simple skin excisions; graduates of the SCCA Certificate of Skin Cancer Medicine (or RPL).',
  audienceEvidence: E(sccaU('ASSW_APR27'), /This course is specifically designed for doctors already undertaking simple skin excisions and routine closures in primary practice\./),
  format: 'Two weeks of online learning, then a 3-day practical workshop (two full days and a half day).',
  formatEvidence: E(sccaU('ASSW_APR27'), 'Online Learning 2 April - 15 April 2027 Practical Workshop 16 April - 18 April 2027'), typicalLength: 'online learning + 2.5-day practical workshop',
  feeRange: { currency: 'AUD', min: 4920, max: 4920, text: '$4920 AUD / NZD inc GST (member discount $110)' }, feeSource: sccaU('ASSW_APR27'), feeQuote: '$4920 AUD / NZD*',
  cpdNote: 'check provider'
});
course({
  id: 'scca-certificate-dermoscopy', name: 'Certificate of Dermoscopy (SCCA)',
  providers: [P_('Skin Cancer College Australasia (SCCA)', 'https://www.skincancercollege.org/', { calendar: 'https://www.skincancercollege.org/events' })], countries: ['AU', 'NZ'],
  audience: 'GPs, primary care nurses and dermal clinicians with minimal dermoscopy experience; a dermatoscope is needed.',
  audienceEvidence: E(sccaU('DERM_FEB27'), /This course is designed for general practitioners, primary care nurses, and qualified dermal clinicians with minimal experience in dermoscopy\./),
  format: 'online, dated intakes (about six weeks online with one live webinar and an assessment); no face-to-face session',
  formatEvidence: E(sccaU('DERM_FEB27'), 'Course Start 5 February 2027 Webinar 20 February 2027 Assessment Due Date 19 March 2027'), typicalLength: 'about 6 weeks online',
  feeRange: { currency: 'AUD', min: 2445, max: 2445, text: '$2,445 AUD / NZD inc GST (member discount $110)' }, feeSource: sccaU('DERM_FEB27'), feeQuote: '$2,445 AUD / NZD*',
  onlineIntakes: onlineIntakes.filter(x => x.courseId === 'scca-certificate-dermoscopy' && x.end >= today).map(({ courseId, ...x }) => x),
  cpdNote: 'check provider'
});

const HC_IUS = 'https://www.healthcert.com/courses/certificates/advanced-workshop-intrauterine-systems', HC_VAS = 'https://www.healthcert.com/courses/certificates/advanced-workshop-non-scalpel-vasectomy';
const hcProv = [P_('HealthCert Education', 'https://www.healthcert.com/workshops', { calendar: HC_CAL })];
for (const [id, name, re] of [
  ['healthcert-skin-cancer-medicine-workshop', 'HealthCert Skin Cancer Medicine Practical Workshop (core / advanced)', 'Skin Cancer Medicine Practical Workshop'],
  ['healthcert-skin-cancer-surgery-workshop', 'HealthCert Skin Cancer Surgery Practical Workshop (core / advanced / complex)', 'Complex Skin Cancer Surgery Practical Workshop'],
  ['healthcert-clinical-procedures-workshop', 'HealthCert Professional Certificate of Clinical Procedures (practical workshop day)', 'Professional Certificate of Clinical Procedures'],
  ['healthcert-msk-sports-medicine-workshop', 'HealthCert Musculoskeletal and Sports Medicine Practical Workshop', 'Musculoskeletal and Sports Medicine Practical Workshop']]) {
  course({ id, name, providers: hcProv, countries: ['AU'], audience: null, format: 'One-day face-to-face practical workshop, part of a HealthCert certificate pathway (online learning at own pace).',
    formatEvidence: E(HC_CAL, re), typicalLength: '1 day', cpdNote: 'check provider', notes: 'Session venue/date from the HealthCert workshop calendar; fees are on HealthCert pathway pages (not read this run).' });
}
course({
  id: 'no-scalpel-vasectomy-workshop', name: 'No-scalpel vasectomy workshop',
  providers: [P_('HealthCert Education', HC_VAS, { calendar: HC_CAL })], countries: ['AU'],
  audience: 'Experienced doctors who already do advanced procedures or traditional vasectomies.',
  audienceEvidence: E(HC_VAS, /This practical workshop is ideal for experienced doctors who regularly perform advanced clinical procedures or already provide traditional vasectomies[^.]*\./),
  format: 'One-day practical workshop.', formatEvidence: E(HC_VAS, 'One-day'), typicalLength: '1 day',
  feeRange: { currency: 'AUD', min: 1995, max: null, text: 'From $1995' }, feeSource: HC_VAS, feeQuote: 'From $1995',
  cpdNote: 'HealthCert page shows "CPD … 9.5 hours" without naming a college: check provider'
});

const SHQ_IUD = 'https://shq.org.au/course/iud-theory/', SHQ_IMP = 'https://shq.org.au/course/implant-training/';
const SHINE_D = 'https://shinesa.org.au/activity/implanon-nxt-training-doctors/', SHINE_N = 'https://shinesa.org.au/activity/implanon-nurses/', SHINE_T = 'https://shinesa.org.au/activity/iud-train-trainer-program/';
const FPA_IUD = 'https://intheknow.org.au/training/hub/iud-insertion-training/', FPA_IMP = 'https://intheknow.org.au/training/hub/contraceptive-implant-implanon-nxt-insertion-and-removal-training/';
course({
  id: 'iud-insertion-training', name: 'IUD insertion training (copper and hormonal IUDs)',
  providers: [P_('HealthCert Education (Advanced Workshop of Intrauterine Systems)', HC_IUS, { calendar: HC_CAL }), P_('Sexual Health Quarters (SHQ, WA)', SHQ_IUD), P_('Family Planning Australia (AUSLARC-funded, NSW)', FPA_IUD, { note: 'no public dates on the page this run' })],
  countries: ['AU'], audience: 'Doctors (and, at some providers, nurses) who want to insert IUDs in primary care.',
  audienceEvidence: E(HC_IUS, /This course is ideal for experienced physicians who already perform advanced clinical procedures and would like to offer IUDs for their female patients in primary care\./),
  format: 'Theory workshop with practice insertions on pelvic models, then supervised insertions in clinic (SHQ: 3-4 supervised clinics booked separately); HealthCert runs a one-day advanced workshop.',
  formatEvidence: E(SHQ_IUD, /IUD workshops cover current information about copper and hormonal IUD.s insertion techniques and how to manage problems\. They also include practice insertions \(in pelvic models\)\./) || E(SHQ_IUD, /After approval for training, those new to IUD insertions book and pay for 3-4 supervised 3\.5 hour IUD training clinics[^.]*\./),
  typicalLength: 'evening or one-day workshop + supervised clinics',
  otherEvidence: [E(SHQ_IUD, /After approval for training, those new to IUD insertions book and pay for 3-4 supervised 3\.5 hour IUD training clinics \(\$242 inc GST per session\)/), E(HC_IUS, 'From $1995')],
  cpdNote: 'SHQ: "RACGP approved CPD activity" (hours not stated); HealthCert: 9.5 hours (college not named). Check provider.'
});
course({
  id: 'iud-insertion-train-the-trainer', name: 'IUD insertion train-the-trainer program',
  providers: [P_('SHINE SA', SHINE_T)], countries: ['AU'], audience: 'Experienced IUD inserters (medical practitioners) who want to supervise new inserters.',
  audienceEvidence: E(SHINE_T, /designed for experienced medical practitioners who want to expand their[^.]*/), format: 'Evening session (2 hours) plus supervised teaching.',
  formatEvidence: E(SHINE_T, /Time: 6:00 pm - 8:00 pm/), typicalLength: '2-hour session',
  feeRange: { currency: 'AUD', min: 920, max: 920, text: '$920' }, feeSource: SHINE_T, feeQuote: 'Course Cost $920', cpdNote: 'check provider'
});
course({
  id: 'contraceptive-implant-training', name: 'Contraceptive implant (Implanon NXT) insertion and removal training',
  providers: [P_('SHINE SA', SHINE_D), P_('Sexual Health Quarters (SHQ, WA)', SHQ_IMP), P_('Family Planning Australia (AUSLARC-funded)', FPA_IMP, { note: 'no public dates on the page this run' })],
  countries: ['AU'], audience: 'Doctors, nurse practitioners, registered nurses and midwives.',
  audienceEvidence: E(SHINE_D, /This practical training program is designed for doctors, nurse practitione[^.]*/),
  format: 'Theory (online module or evening workshop) plus hands-on simulation; SHINE SA hybrid sessions are a 1-hour onsite simulation after an online module.',
  formatEvidence: E(SHINE_D, /\(Complete online theory module prior to attending a 1-hour morning onsite practical simulation session\)/), typicalLength: '1-2.5 hours face-to-face',
  feeRange: { currency: 'AUD', min: 200, max: 245, text: 'SHINE SA: hybrid and face-to-face $200; rural and remote online $245 (+$50 deposit)' }, feeSource: SHINE_D, feeQuote: 'Hybrid and Face-to-Face: $200',
  cpdNote: 'SHQ: "This is an RACGP approved CPD activity under the RACGP CPD program." (hours not stated). Check provider.',
  otherEvidence: [E(SHQ_IMP, /Each workshop can last up to 2\.5 hours depending on attendance numbers\./)]
});

const SHQ_CN = 'https://shq.org.au/course/certificate-nursing/', SHINE_C = 'https://shinesa.org.au/activity/certificate-in-sexual-health/';
course({
  id: 'sexual-reproductive-health-certificate-nurses', name: 'Certificate in sexual and reproductive health for nurses and midwives',
  providers: [P_('Sexual Health Quarters (SHQ, WA)', SHQ_CN), P_('SHINE SA', SHINE_C)], countries: ['AU'], audience: 'Registered nurses and midwives.',
  audienceEvidence: E(SHINE_C, /Our interactive 5-day course for registered nurses and midwives supports a comprehensive understanding of sexual and reproductive health\./),
  format: 'Face-to-face theory days plus online modules and a supervised clinical attachment (SHQ: seven modules; SHINE SA: 5-day course).',
  formatEvidence: E(SHQ_CN, /Seven theoretical modules \(\$2042\.70 inc\. GST\)/), typicalLength: '4-5 face-to-face days + online + clinical placement',
  feeRange: { currency: 'AUD', min: 1640, max: 2042.7, text: 'SHINE SA theory $1,640 (placement $2,400); SHQ seven modules $2,042.70 (attachment $1,320)' }, feeSource: SHINE_C, feeQuote: 'Certificate in Sexual Health – Theory: $1,640',
  cpdNote: 'check provider', otherEvidence: [E(SHQ_CN, /Supervised clinical attachment \(\$1,320 inc\. GST[^)]*\)/)]
});
course({
  id: 'cervical-screening-training-nurses', name: 'Cervical screening training for nurses and midwives (face-to-face module)',
  providers: [P_('Sexual Health Quarters (SHQ, WA)', 'https://shq.org.au/course/certificate-nursing-cervical-screening-only/')], countries: ['AU'], audience: 'Nurses and midwives who want to perform cervical screening.',
  audienceEvidence: E('https://shq.org.au/education/courses/', /This module is for nurses and midwives wishing to develop detailed knowledge and specialist clinical skills in performing cervical screening\./),
  format: 'Two face-to-face days at SHQ plus about 14 hours online (Module 2 of the SHQ nursing certificate; can be taken alone).',
  formatEvidence: E(SHQ_CN, /Module 2: Cervical Screening \(two days face to face workshop at SHQ plus online learning of approximately 14 hours\)/), typicalLength: '2 days + ~14 h online', cpdNote: 'check provider'
});
const SHQ_UP = 'https://shq.org.au/course/unintended-pregnancy-counselling-training/', SHINE_P = 'https://shinesa.org.au/activity/pregnancy-choices-training/';
course({
  id: 'pregnancy-options-counselling-training', name: 'Unintended pregnancy / pregnancy choices counselling training',
  providers: [P_('Sexual Health Quarters (SHQ, WA)', SHQ_UP), P_('SHINE SA', SHINE_P)], countries: ['AU'], audience: 'Doctors, nurses, counsellors and others who support people with an unintended pregnancy.',
  audienceEvidence: E('https://shq.org.au/education/courses/', /This two-day course provides participants with knowledge and skills around non-directive pregnancy counselling\./),
  format: 'SHQ: two days (face-to-face or live online); SHINE SA: one day face-to-face.', formatEvidence: E(SHQ_UP, /Courses are offered face to face at our Roe St centre and online throughout the year\./), typicalLength: '1-2 days',
  feeRange: { currency: 'AUD', min: 195, max: 195, text: 'SHINE SA $195 (SHQ fee not read)' }, feeSource: SHINE_P, feeQuote: 'Course Cost $195',
  cpdNote: 'SHQ: "RACGP CPD approved activity, accredited for 13 Hours" (does not qualify for MBS item 4001).', otherEvidence: [E(SHQ_UP, /The course is an RACGP CPD approved activity, accredited for 13 Hours\./)]
});
const SHINE_S = 'https://shinesa.org.au/activity/srha/';
course({
  id: 'srha-national-certificate-doctors', name: 'Sexual and Reproductive Health Australia (SRHA) National Certificate for Doctors',
  providers: [P_('Sexual Health Victoria (SHV)', SHV_NC), P_('SHINE SA', SHINE_S), P_('Family Planning Australia', 'https://intheknow.org.au/training/hub/srha-national-certificate-in-reproductive-and-sexual-health-for-doctors/', { note: 'no public dates on the page this run' })],
  countries: ['AU'], audience: 'Doctors with current AHPRA registration (nurse practitioners may apply).',
  audienceEvidence: E(SHV_NC, /This course is open to doctors with a current AHPRA registration\./),
  format: 'Theory (4-5 face-to-face days plus online modules), exam, and 6 half-day clinical placements within 12 months.',
  formatEvidence: E(SHV_NC, /Clinical placements: Trainees must book a total of 6 half day placements over a maximum of 12 months\./), typicalLength: '4-5 days theory + placements',
  feeRange: { currency: 'AUD', min: 1980, max: 3330, text: 'SHV: theory $1,980; theory+exam $2,330; theory+exam+placements $3,330. SHINE SA theory $2,370, placement $1,320.' }, feeSource: SHV_NC, feeQuote: 'Theory course only - $ 1980 (GST does not apply)',
  cpdNote: 'SHV: theory 37 RACGP CPD hours, clinical 25 hours (see cpdByCollege).',
  cpdByCollege: [{ college: 'RACGP', hours: 37, appliesTo: 'SHV theory component', quote: 'Theory: RACGP CPD Accredited Activity 37 hours', sourceUrl: SHV_NC }],
  otherEvidence: [E(SHINE_S, /Sexual and Reproductive Health National Certificate Theoretical Module \(5-day Face-to-Face Training\): \$2,370/)]
});

const HE_W = 'https://www.healthed.com.au/events/swch27/', HE_M = 'https://www.healthed.com.au/events/bhmu27/', HE_S = 'https://www.healthed.com.au/seminars/';
course({
  id: 'healthed-womens-childrens-health-update', name: "Healthed Women's & Children's Health Update (one-day GP seminar)",
  providers: [P_('Healthed', HE_S, { calendar: HE_S })], countries: ['AU'], audience: 'GPs (nurses, pharmacists and other health professionals also attend).',
  audienceEvidence: E(HE_S, /Healthed seminars are primarily designed for general practitioners \(GPs\)[^.]*\./),
  format: 'One-day face-to-face seminar (lectures and panels), catered.', formatEvidence: E(HE_S, /Healthed face-to-face events are one-day seminars designed with the busy healthcare professional in mind\./), typicalLength: '1 day',
  cpdNote: 'Healthed: eight hours CPD in Educational Activities by attending; further RP and MO hours optional (RACGP and ACRRM accredited). Fees vary by registration date: check provider.',
  otherEvidence: [E(HE_S, /Healthed seminars offer attendees eight hours of CPD in the Educational Activities \(EA\) category\./), E(HE_W, /Please note there will be an additional fee of \$150 for delegates\. This additional cost covers RACGP CPD hours processing and certification\./)]
});
course({
  id: 'healthed-medical-update', name: 'Healthed Medical Update (one-day GP seminar)',
  providers: [P_('Healthed', HE_S, { calendar: HE_S })], countries: ['AU'], audience: 'GPs (nurses, pharmacists and other health professionals also attend).',
  audienceEvidence: E(HE_S, /Healthed seminars are primarily designed for general practitioners \(GPs\)[^.]*\./),
  format: 'One-day face-to-face seminar (lectures and panels), catered.', formatEvidence: E(HE_S, /Our one-day seminar offering for GPs and health professionals\./), typicalLength: '1 day',
  cpdNote: 'Healthed: eight hours CPD in Educational Activities by attending; further RP and MO hours optional. Fees vary by registration date: check provider.',
  otherEvidence: [E(HE_M, /Join over 1,200 of your colleagues at the Brisbane Convention & Exhibition Centre\. Register today and earn up to 24 hours of CPD!/)]
});

/* ACRRM extras */
const A = p => acrrm.BASE + p;
for (const [id, name, p, fmtRe] of [
  ['acrrm-advanced-airway', 'ACRRM Advanced Airway', 'advanced-airway', /the course includes 8 hours of interactive, self-paced online learning followed by one full day of practical, face-to-face skills training/],
  ['acrrm-racm', 'ACRRM Rural Anaesthetic Crisis Management (RACM)', 'racm', /It is recommended that participants register for the course at least 6 weeks prior to the hands-on workshop day\./],
  ['acrrm-phec', 'ACRRM Pre-Hospital Emergency Care (PHEC)', 'pre-hospital-emergency-care-phec', /Through a combination of interactive online learning and an immersive, hands-on face-to-face workshop/],
  ['acrrm-pocus-rg', 'ACRRM Point of Care Ultrasound for Rural Generalists (POCUS-RG)', 'point-of-care-ultrasound-for-rural-generalists', /This blended learning program includes one day of interactive, self-directed online learning , followed by a one-day, face-to-face workshop/]]) {
  const ss = out.filter(s => s.courseId === id), fees = ss.map(s => s.priceFrom).filter(Boolean);
  if (!ss.length) continue;
  ss.forEach(s => { s.datesQuote = s.datesQuote.slice(0, 200); });
  const row = page(A(p)) && acrrm.rows(page(A(p)))[0];
  const feeQuote = row ? [row.fees.member != null && `Member: ${row.fees.member.toFixed(2)}`, row.fees['non member'] != null && `Non Member: ${row.fees['non member'].toFixed(2)}`].filter(Boolean).join(' ') : null;
  course({
    id, name, providers: [P_('ACRRM (Australian College of Rural and Remote Medicine)', A(p), { calendar: A('upcoming-face-to-face-courses') })], countries: ['AU'],
    audience: (grab(A(p), /Appropriate for: [^.]*\./) || '').replace(/^Appropriate for: /, '') || null, audienceEvidence: E(A(p), /Appropriate for: [^.]*\./),
    format: 'Online pre-learning, then a face-to-face workshop day.', formatEvidence: E(A(p), fmtRe), typicalLength: 'online modules + 1 face-to-face day',
    ...(row && row.fees.member ? { feeRange: { currency: 'AUD', min: row.fees.member, max: row.fees['non member'] || row.fees.member, text: `ACRRM member $${row.fees.member}, non-member $${row.fees['non member']}` }, feeSource: A(p), feeQuote, feeNote: 'currency not printed (Australian college)' } : {}),
    cpdNote: `ACRRM CPD ${row ? row.cpd : '?'} hours per session row (other colleges: check provider).`,
    ...(row && /^\d+$/.test(row.cpd) ? { cpdByCollege: [{ college: 'ACRRM', hours: +row.cpd, appliesTo: 'each session (CPD Hours column)', quote: `CPD Hours ${row.cpd}`, sourceUrl: A(p) }] } : {}),
    sessionsThisRun: ss.length
  });
}

/* Rural Health West */
const RHWU = s => `https://ruralhealthwest.com.au/events/${s}/`;
for (const [id, name, s, fmtRe, audRe] of [
  ['rhw-mental-health-skills-training', 'Rural Health West Mental Health Skills Training (MHST) for GPs', 'mental-health-skills-training-mhst-perth', /Length: One day – 8\.00am-4\.00pm\./, /The RHW MHST is a purpose designed, interactive training workshop for General \(GPs\)[^.]*/],
  ['rhw-peachs', 'Rural Health West Paediatric Emergencies and Clinical Healthcare Scenarios (PEaCHS)', 'paediatric-emergencies-and-clinical-healthcare-scenarios-peachs-geraldton', /Length: One Day – 8\.00am-5\.00pm/, null],
  ['rhw-tide', 'Rural Health West Trauma Informed De-Escalation (TIDE)', 'trauma-informed-de-escalation-tide-busselton-2', /TIDE focuses on training health care professionals in using trauma-informed knowledge and practice to increase de-escalation skills[^.]*/, null],
  ['rhw-neostars', 'Rural Health West Neonatal Stabilisation and Transport Readiness (NeoSTARs I)', 'neostars-i-northam-2', /Neonatal Stabilisation and Transport Readiness \(NeoSTARs\)[^|]{0,160}/, null],
  ['rhw-react-plus', 'Rural Health West Rural Emergency Advanced Clinical Training (REACT+)', 'rural-emergency-advanced-clinical-training-react-perth-27', /The Rural Health West CPD REACT\+ workshop is designed to assist Western Australian Visiting Medical Practitioners to maintain their emergency[^.]*/, null],
  ['rhw-eam', 'Rural Health West Emergency Airway Skills Management (EAM)', 'emergency-airway-skills-management-eam-busselton', /This Rural Health West CPD workshop is designed to assist health professionals to develop and practise skills essential in unexpected cri[^.]*/, null]]) {
  if (!out.some(x => x.courseId === id)) continue;
  course({ id, name, providers: [P_('Rural Health West', RHWU(s), { calendar: 'https://ruralhealthwest.com.au/events/' })], countries: ['AU'], audience: null,
    ...(audRe ? { audience: 'GPs (Rural Health West CPD workshop).', audienceEvidence: E(RHWU(s), audRe) } : {}),
    format: 'Face-to-face workshop (Rural Health West CPD program, WA).', formatEvidence: E(RHWU(s), fmtRe), typicalLength: null,
    cpdNote: id === 'rhw-mental-health-skills-training' ? 'RACGP 4 EA + 4 RP hours; GPMHSC-accredited Mental Health Skills Training (page).' : 'check provider',
    ...(id === 'rhw-mental-health-skills-training' ? { otherEvidence: [E(RHWU(s), /4 Educational Activity and 4 Reviewing Performance hours with the Royal Australian College of General Practitioners\./), E(RHWU(s), /This course is accredited by the General Practice Mental Health Standards Collaboration \(GPMHSC\)/)] } : {}) });
}

/* SAPMEA */
const SAPU = s => `https://sapmea.asn.au/education/events/${s}`;
for (const [id, name, s, fmtRe, audRe] of [
  ['sapmea-copd-spirometry-workshop', 'SAPMEA COPD Management and Spirometry workshop', 'copd-management-and-spirometry-mount-gambier', /Enhance your skills in identifying, assessing and managing COPD with this practical workshop designed for GPs, Nurses and Allied Health Professionals\./, null],
  ['sapmea-msk-return-to-work-workshop', 'SAPMEA MSK injuries and return-to-work workshop (ReturnToWorkSA-funded)', 'shoulder-and-back-injuries-from-diagnosis-to-return-to-work-28112026', /This interactive hands-on workshop aims to enhance the skills and confidence of GPs, Nurses and allied health professionals in assessing, managing, and support[^.]*\./, null],
  ['sapmea-mental-health-strategies-workshop', 'SAPMEA Mental Health: Strategies for Effective Care and Support (evening workshop)', 'mental-health-strategies-for-effective-care-and-support-clare', /Mental Health: Strategies for Effective Care[^|]{0,60}/, null],
  ['emet-major-trauma-workshop', 'EMET Major Trauma workshop (ACEM Emergency Medicine Education and Training, delivered by SAPMEA)', 'emet-major-trauma-waikerie-271126', /This workshop will focus on major trauma patient scenarios and examine acute management in regional and rural settings\./, /General Practitioners, Medical Officers, Nurses and Paramedics working in Emergency Care settings are invited to attend this interactive full day workshop[^.]*\./]]) {
  if (!out.some(x => x.courseId === id)) continue;
  course({ id, name, providers: [P_('SAPMEA', SAPU(s), { calendar: 'https://sapmea.asn.au/education/calendar', bookingPlatform: 'Humanitix (tickets linked from the SAPMEA page)' })], countries: ['AU'],
    audience: audRe ? 'GPs, medical officers, nurses and paramedics in emergency care settings.' : 'GPs, nurses and allied health professionals.',
    ...(audRe ? { audienceEvidence: E(SAPU(s), audRe) } : {}), format: 'Face-to-face workshop (SAPMEA education calendar, SA).', formatEvidence: E(SAPU(s), fmtRe), typicalLength: null, cpdNote: 'check provider' });
}

/* AIU: one catalogue entry per course name (length options become session variants) */
for (const c of aiuCourses.values()) {
  const ss = out.filter(s => s.courseId === c.id); if (!ss.length) continue;
  const prices = ss.map(s => s.priceFrom).filter(Boolean), first = c.pages[0].url;
  const fq = ss[0].datesQuote.split(' | ').slice(-1)[0];
  const acc = /Approved for Educational Activities/.test(pageText(first)) ? grab(first, /([A-Z]{3,6} )?Approved for Educational Activities [\d.]+ hours\./) : null;
  course({
    id: c.id, name: `AIU ${decodeAiu(c.name)}`, providers: [P_('Australian Institute of Ultrasound (AIU)', first, { calendar: 'https://www.aiu.edu.au/calendar/', bookingPlatform: 'AIU WooCommerce store (www.aiu.edu.au)' })],
    countries: ['AU'], audience: null, format: `Face-to-face hands-on course at AIU, Broadbeach Waters (Gold Coast); length options: ${[...new Set(c.pages.map(p => p.len))].join(', ')}.`,
    formatEvidence: ev(first, `${c.pages[0].len} ${decodeAiu(c.name)}`) || ev(first, decodeAiu(c.name)), typicalLength: [...new Set(c.pages.map(p => p.len))].join(' / '),
    feeRange: { currency: 'AUD', min: Math.min(...prices), max: Math.max(...prices), text: Math.min(...prices) === Math.max(...prices) ? `$${Math.min(...prices)} (price shown next to each date)` : `$${Math.min(...prices)}-$${Math.max(...prices)} by length option (prices shown next to each date)` }, feeSource: first, feeQuote: fq,
    cpdNote: acc ? `page: "${acc}" (other colleges/points listed on the page): check provider` : 'check provider',
    otherEvidence: c.pages.slice(1).map(p => ev(p.url, decodeAiu(c.name))).filter(Boolean).slice(0, 5)
  });
}
function decodeAiu(n) { return n.replace(/&#038;/g, '&'); }

/* ================= write ================= */
fs.mkdirSync(outDir, { recursive: true });
const ids = new Set(courses.map(c => c.id));
const orphan = out.filter(s => !ids.has(s.courseId)); if (orphan.length) warnings.push(`${orphan.length} sessions without catalogue entry: ${[...new Set(orphan.map(s => s.courseId))]}`);
const final = out.filter(s => ids.has(s.courseId)).sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
fs.writeFileSync(path.join(outDir, 'womens-gp.sessions.json'), JSON.stringify({ generated: today, note: 'x10 womens-gp desk: sessions read this run from each provider\'s own page/feed (see docs/research/x10-womens-gp.md).', sessions: final }, null, 1) + '\n');
fs.writeFileSync(path.join(outDir, 'womens-gp.catalogue.json'), JSON.stringify({ generated: today, note: 'x10 womens-gp desk. Facts only from provider pages read on lastVerified, each quote checked against the cached page text. null = not published or not read.', courses }, null, 1) + '\n');
const bySrc = {}; for (const s of final) bySrc[s.provider] = (bySrc[s.provider] || 0) + 1;
const byCourse = {}; for (const s of final) byCourse[s.courseId] = (byCourse[s.courseId] || 0) + 1;
console.log(JSON.stringify({ sessions: final.length, courses: courses.length, bySource: bySrc, byCourse }, null, 1));
for (const w of warnings) console.error('warn ' + w);
