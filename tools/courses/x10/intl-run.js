'use strict';
/* x10 "intl" desk: UK & international course sessions.
   node tools/courses/x10/intl-run.js [--today YYYY-MM-DD] [--out data/courses/sources/intl.sessions.json] [--from DIR] [--save DIR] [--only rcuk,erc,rcseng,rcsed]
     --from DIR  build from DIR/<source>.out.json saved by an earlier --save run (no network)
     --save DIR  keep each source's raw parser output as DIR/<source>.out.json
   Sources (all the course owner's own pages, read politely: generic UA, robots.txt, >=3 s per host, https only):
     rcuk   www.resus.org.uk course pages, course-availability tables      (tools/courses/x10/intl-rcuk.js)
     erc    cosy.erc.edu public course calendar (search form, list view)   (tools/courses/x10/intl-erc.js)
     rcseng www.rcseng.ac.uk course list JSON + course pages                (tools/courses/x10/intl-rcseng.js)
     rcsed  services.rcsed.ac.uk course listing + course pages              (tools/courses/x10/intl-rcsed.js)
   Post-processing: RCSEd titles -> course ids (unlisted titles dropped), finished / >3 years ahead / >14-day rows dropped,
   ids made unique, sorted by start. Writes { generated, note, sessions } in the same shape as data/courses/sessions.json. */
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.join(__dirname, '..', '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const today = arg('--today', new Date().toISOString().slice(0, 10));
const out = path.resolve(ROOT, arg('--out', 'data/courses/sources/intl.sessions.json'));
const from = arg('--from'), save = arg('--save');
const only = new Set((arg('--only', 'rcuk,erc,rcseng,rcsed')).split(','));
const log = m => process.stderr.write(m + '\n');

/* RCSEd course titles -> catalogue ids. Titles not listed (conferences/symposia, dental, leadership, trainer development,
   exam preparation, wellbeing) are not kept. */
const RCSED = [
  [/^Advanced Trauma Life Support \(ATLS\)$/i, 'atls', 'full'],
  [/Basic Surgical Skills$/i, 'bss', 'full'],
  [/Basic Surgical Skills \(Cardiff\)/i, 'bss', 'full'],
  [/Non-Technical Skills for Surgeons \(NOTSS\)/i, 'rcsed-notss', 'full'],
  [/Advanced Otology Course/i, 'rcsed-advanced-otology', 'full'],
  [/BAETS Thyroid Masterclass/i, 'rcsed-baets-thyroid', 'full'],
  [/BAETS Parathyroid Masterclass/i, 'rcsed-baets-parathyroid', 'full'],
  [/Basic Skills in Paediatric Surgery/i, 'rcsed-paediatric-surgery-basic', 'full'],
  [/Core Skills in Orthopaedic Surgery/i, 'rcsed-core-ortho', 'full'],
  [/DeVISER/i, 'rcsed-deviser', 'full'],
  [/Essentials in Robotic Surgery.*Morning/i, 'rcsed-robotic-hugo', 'morning'],
  [/Essentials in Robotic Surgery.*Afternoon/i, 'rcsed-robotic-hugo', 'afternoon'],
  [/Hostile Environment Surgical Training/i, 'rcsed-hest', 'full'],
  [/Laparoscopic Skills in Emergency Surgery/i, 'rcsed-lap-emergency', 'full'],
  [/Oncoplastic Breast Surgery Course/i, 'rcsed-oncoplastic-breast', 'full'],
  [/The Edinburgh Hand Course/i, 'rcsed-hand', 'full'],
  [/Edinburgh Head and Neck Course - Module I \(/i, 'rcsed-head-neck', 'module-1'],
  [/Edinburgh Head and Neck Course - Module II/i, 'rcsed-head-neck', 'module-2'],
  [/Surgical Approaches to the Spine/i, 'rcsed-spine-approaches', 'full'],
  [/Basic Microsurgical Skills/i, 'rcsed-microsurgery-basic', 'full'],
  [/Core Skills in Urology/i, 'rcsed-core-urology', 'full']
];
const cleanTitle = t => String(t).replace(/^(Course Details|Event Details)\s*[-|]\s*/i, '').trim();

function postRcsed(sessions) {
  const kept = [], dropped = {};
  for (const s of sessions) {
    const title = cleanTitle(s.courseTitle);
    const m = RCSED.find(([re]) => re.test(title));
    if (!m) { dropped[title] = (dropped[title] || 0) + 1; continue; }
    const r = { ...s, courseId: m[1], variant: m[2], courseTitle: title };
    if (/^online$/i.test(r.venue || '')) Object.assign(r, { city: 'Online', region: 'Online', online: true });
    if (/United Arab Emirates/i.test(r.venue || '')) Object.assign(r, { country: 'AE', region: 'AE', city: /Ajman/i.test(title) ? 'Ajman' : r.city });
    r.id = require('../util').slug(r.courseId, r.variant !== 'full' ? r.variant : '', r.city, r.start, 'rcsed');
    kept.push(r);
  }
  return { kept, dropped };
}

async function main() {
  const res = {}, report = {};
  const load = k => JSON.parse(fs.readFileSync(path.join(from, k + '.out.json'), 'utf8'));
  if (!from) {
    const { makeClient } = require('../http');
    if (only.has('rcuk')) res.rcuk = await require('./intl-rcuk').fetchAll(makeClient({ log }), { today, log });
    if (only.has('erc')) res.erc = await require('./intl-erc').fetchAll({ today, log });
    if (only.has('rcseng')) res.rcseng = await require('./intl-rcseng').fetchAll(makeClient({ log }), { today, log });
    if (only.has('rcsed')) res.rcsed = await require('./intl-rcsed').fetchAll(makeClient({ log }), { today, log });
    if (save) { fs.mkdirSync(save, { recursive: true }); for (const k in res) fs.writeFileSync(path.join(save, k + '.out.json'), JSON.stringify(res[k], null, 1)); }
  } else for (const k of only) res[k] = load(k);

  let all = [];
  for (const k of Object.keys(res)) {
    let s = res[k].sessions || [];
    if (k === 'rcsed') { const p = postRcsed(s); s = p.kept; report.rcsedDropped = p.dropped; }
    report[k] = s.length; all.push(...s);
  }
  const max = String(+today.slice(0, 4) + 3) + today.slice(4);
  const drop = { finished: 0, tooFarAhead: 0, tooLong: 0 };
  all = all.filter(s => {
    if (s.end < today) { drop.finished++; return false; }
    if (s.start > max) { drop.tooFarAhead++; return false; }
    if ((Date.parse(s.end) - Date.parse(s.start)) / 864e5 > 14) { drop.tooLong++; return false; }
    return true;
  });
  /* unique ids; rows identical on course+variant+provider+city+dates+venue are dropped (same session listed twice on a page).
     NB variant is part of the key: RCUK centres often run e-ALS and ALS recertification on the same day. */
  const ids = new Map(), keys = new Set(); let dupRows = 0;
  all = all.filter(s => {
    const key = [s.courseId, s.variant || '', s.provider, s.city, s.start, s.end, s.venue || ''].join('|').toLowerCase();
    if (keys.has(key)) {
      if (!s.sourceRef) { dupRows++; return false; }
      s.venue = (s.venue ? s.venue + ' ' : '') + `(${s.sourceRef})`;
    }
    keys.add([s.courseId, s.variant || '', s.provider, s.city, s.start, s.end, s.venue || ''].join('|').toLowerCase());
    const n = ids.get(s.id) || 0; ids.set(s.id, n + 1); if (n) s.id = `${s.id}-${n + 1}`;
    return true;
  });
  all.sort((a, b) => a.start.localeCompare(b.start) || a.courseId.localeCompare(b.courseId) || a.id.localeCompare(b.id));
  const doc = {
    generated: today,
    note: 'x10 intl desk. Only sessions read from the course owner\'s own page/feed on lastVerified (RCUK course pages, ERC CoSy calendar, RCS England, RCSEd). endInferred=true: the source printed only a start date; end = start + (course length stated on the same course page - 1), see endNote. Prices are in the source currency (GBP, EUR, CHF, ...). Organiser personal contact details are not copied.',
    sessions: all
  };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(doc, null, 1) + '\n');
  log(`intl: wrote ${all.length} sessions to ${path.relative(ROOT, out)} ${JSON.stringify({ ...report, drop, dupRows })}`);
}
main().catch(e => { console.error(e); process.exit(2); });
