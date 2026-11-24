'use strict';
/* Courses: data checker, certificate expiry and status, session filters, plan trip, sync of certificates, no made-up dates,
   external links. Run: node --test tests/ */
const test = require('node:test'), assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process'), path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const HC = require('../courses.js');
const { travelLinks, addDays } = require('../stats.js');
const { evaluate } = require('../pack.js');
const TDB = require('./_db.js');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const CAT = JSON.parse(read('data/courses/catalogue.json')), SES = JSON.parse(read('data/courses/sessions.json')).sessions;
const course = id => { const c = HC.courseById(CAT, id); assert.ok(c, 'catalogue missing ' + id); return c; };
const DAY = '2026-11-17'; /* the dataset's own date: fixed so the tests do not change as sessions finish */

test('tools/check-courses.js passes on the shipped data', () => {
  const today = [new Date().toISOString().slice(0, 10), CAT.generated].sort().pop(); /* never earlier than the data (lastVerified must not be in the future) */
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'check-courses.js'), '--today', today], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /errors: 0/);
});

test('certificate expiry: only from a sourced validity (APLS 5 years, ALS 4 years)', () => {
  assert.deepEqual(HC.validityOf(course('apls')), { years: 5, source: course('apls').validitySource, quote: course('apls').validityQuote });
  assert.equal(HC.validityOf(course('als1')).years, 4); assert.equal(HC.validityOf(course('als2')).years, 4);
  for (const id of ['emst', 'pals', 'nzrc-core-advanced', 'nzrc-core-immediate']) assert.equal(HC.validityOf(course(id)), null, id + ' has no sourced validity');
  assert.equal(HC.validityOf({ ...course('als2'), validitySource: null }), null, 'no source, no validity');
  assert.equal(HC.validityOf({ ...course('als2'), validityQuote: '' }), null, 'no quote, no validity');
  assert.equal(HC.validityOf({ ...course('als2'), verified: false }), null, 'unverified entry, no validity');
  assert.deepEqual(HC.expiryFor({ completed: '2023-01-17' }, course('als2')), { expires: '2027-01-17', from: 'catalogue', years: 4, source: course('als2').validitySource });
  assert.equal(HC.expiryFor({ completed: '2024-03-01' }, course('apls')).expires, '2029-03-01');
  assert.equal(HC.expiryFor({ completed: '2024-02-29' }, course('als1')).expires, '2028-02-29', 'leap day to leap day');
  assert.equal(HC.expiryFor({ completed: '2024-02-29' }, course('apls')).expires, '2029-02-28', 'leap day to a common year');
  assert.deepEqual(HC.expiryFor({ completed: '2025-06-01' }, course('emst')), { expires: null, from: null }, 'unsourced: the user must enter it');
  assert.deepEqual(HC.expiryFor({ completed: '2025-06-01', expiresEntered: '2029-06-01' }, course('nzrc-core-advanced')), { expires: '2029-06-01', from: 'user' });
  assert.equal(HC.expiryFor({ completed: '2025-06-01', expiresEntered: '2099-01-01' }, course('als2')).expires, '2029-06-01', 'a sourced validity wins over a typed date');
});

test('certificate status thresholds: valid, due in 6 months, due in 3 months, expired', () => {
  const t = '2026-11-17';
  assert.equal(HC.addMonths('2026-08-31', 6), '2027-02-28'); assert.equal(HC.addMonths('2026-11-30', 3), '2027-02-28'); assert.equal(HC.addMonths('2027-11-30', 3), '2028-02-29');
  const cases = [['2026-11-16', 'expired'], ['2026-11-17', 'due3'], ['2027-02-17', 'due3'], ['2027-02-18', 'due6'], ['2027-05-17', 'due6'], ['2027-05-18', 'valid'], ['2030-01-01', 'valid'], [null, 'unknown'], ['nonsense', 'unknown']];
  for (const [e, st] of cases) assert.equal(HC.certStatus(e, t), st, `${e} on ${t}`);
  assert.equal(HC.STATUS_LABEL.due3, 'Due in ≤3 months'); assert.equal(HC.STATUS_LABEL.due6, 'Due in ≤6 months');
  assert.ok(HC.needsAttention('due6') && HC.needsAttention('due3') && HC.needsAttention('expired') && !HC.needsAttention('valid'));
  /* the Playwright case: ALS2 completed 3 years 10 months ago is due within 3 months */
  const done = HC.addMonths(t, -46), x = HC.expiryFor({ completed: done }, course('als2'));
  assert.equal(HC.certStatus(x.expires, t), 'due3');
  assert.equal(HC.certStatus(HC.expiryFor({ completed: HC.addMonths(t, -43) }, course('als2')).expires, t), 'due6');
  assert.equal(HC.certStatus(HC.expiryFor({ completed: HC.addMonths(t, -12) }, course('apls')).expires, t), 'valid');
});

test('course page filters: state, city, month; soonest first; finished sessions dropped', () => {
  const nsw = HC.filterSessions(SES, { courseId: 'als2', state: 'NSW' }, DAY);
  assert.ok(nsw.length > 5);
  assert.ok(nsw.every(s => s.courseId === 'als2' && s.region === 'NSW' && s.end >= DAY));
  for (let i = 1; i < nsw.length; i++) assert.ok(nsw[i - 1].start <= nsw[i].start, 'sorted soonest');
  const city = nsw[0].city, byCity = HC.filterSessions(SES, { courseId: 'als2', state: 'NSW', city }, DAY);
  assert.ok(byCity.length && byCity.every(s => s.city === city));
  const month = nsw[nsw.length - 1].start.slice(0, 7), byMonth = HC.filterSessions(SES, { courseId: 'als2', month }, DAY);
  assert.ok(byMonth.length && byMonth.every(s => s.start.startsWith(month)));
  assert.equal(HC.filterSessions(SES, { courseId: 'als2' }, '2099-01-01').length, 0, 'finished sessions are not shown');
  const o = HC.filterOptions(SES, { courseId: 'als2', state: 'NSW' }, DAY);
  assert.deepEqual(o.states.slice(0, 8), [...HC.STATES_AU].filter(s => o.states.includes(s)), 'Australian states first');
  assert.ok(o.cities.includes(city) && o.cities.every(c => nsw.some(s => s.city === c)), 'cities follow the chosen state');
  assert.ok(o.months.every(m => /^\d{4}-\d{2}$/.test(m)));
  assert.deepEqual(HC.filterSessions(SES, { courseId: 'apls', state: 'NT' }, DAY).map(s => s.region).filter(r => r !== 'NT'), []);
});

test('sessions: inferred end dates and the ARC list are labelled honestly', () => {
  const inf = SES.find(s => s.endInferred && s.start !== s.end) || SES.find(s => s.endInferred);
  assert.match(HC.lengthLabel(inf), /\(inferred\)$/);
  assert.equal(HC.lengthLabel({ start: '2027-03-01', end: '2027-03-02', endInferred: false }), '2 days');
  assert.equal(HC.lengthLabel({ start: '2027-03-01', end: '2027-03-01', endInferred: true }), '1 day (inferred)');
  const arc = SES.filter(s => HC.isArcList(s));
  assert.ok(arc.length > 10, 'some ARC rows only link back to the ARC list');
  assert.ok(!HC.isArcList(SES.find(s => s.courseId === 'apls')), 'APLS rows book with the provider');
  const src = read('app.js');
  assert.match(src, /'Booking via course centre \(ARC list\)'/);
  assert.match(src, /HC\.isArcList\(s\) \? 'Booking via course centre \(ARC list\)' : 'Book with provider'/);
});

test('plan trip from a session: a trip in the existing model, with the session dates and city', () => {
  const s = HC.filterSessions(SES, { courseId: 'als2', state: 'NSW' }, DAY).find(x => x.start !== x.end) || SES.find(x => x.courseId === 'als2');
  const r = HC.planTrip([], s, course('als2'), 't1'), t = r.trip, e = t.event;
  assert.equal(r.created, true);
  assert.deepEqual({ id: t.id, confId: t.confId, status: t.status, bookings: t.bookings }, { id: 't1', confId: 'crs-' + s.id, status: 'planned', bookings: [] });
  assert.equal(e.id, t.confId); assert.equal(e.kind, 'course');
  assert.equal(e.start, s.start); assert.equal(e.end, s.end); assert.equal(e.city, s.city); assert.equal(e.country, 'Australia'); assert.equal(e.countryCode, 'AU');
  assert.equal(e.name, course('als2').name); assert.equal(e.organiser, s.provider); assert.equal(e.short, 'ALS2');
  assert.equal(e.datesConfirmed, true); assert.match(e.url, /^https:\/\//);
  assert.equal(HC.planTrip([t], s, course('als2'), 't2').created, false, 'one trip per session');
  /* the same travel links and claim checks the conference trips use */
  const L = travelLinks(e, 'MEL');
  assert.equal(new URL(L.flights).searchParams.get('q'), `Flights to ${s.city}, Australia from MEL on ${s.start} through ${s.end > s.start ? s.end : addDays(s.start, 1)}`);
  assert.equal(new URL(L.hotels).searchParams.get('checkin'), s.start);
  assert.deepEqual(evaluate([{ id: 'r1', category: 'Registration', amount: 750, date: s.start }], e, {}, r => r.amount), []);
  /* CPD hours only when the provider lists them with a source (ACRRM rows) */
  const acrrm = SES.find(x => x.cpdHours > 0);
  assert.equal(HC.sessionEvent(acrrm, course('als2')).cpdHours, acrrm.cpdHours);
  assert.equal(HC.sessionEvent({ ...acrrm, cpdSource: null }, course('als2')).cpdHours, 0);
  /* the app reuses the trip, receipt and claim code: course trips are found through byId, kept with their own copy */
  const src = read('app.js');
  assert.match(src, /const byId = id => CONFS\.find\(c => c\.id === id\) \|\| CEV\.get\(id\);/);
  assert.match(src, /const r = HC\.planTrip\(S\.trips, s, courseOf\(s\.courseId\), uid\(\)\);/);
  assert.doesNotMatch(src, /S\.trips = S\.trips\.filter\(t => byId\(t\.confId\)\)/, 'every trip filter keeps course trips (keepTrip)');
});

test('near you: profile region, else home city or airport; soonest elsewhere when none nearby', () => {
  assert.equal(HC.regionOf({ region: 'QLD', city: 'Sydney' }), 'QLD');
  assert.equal(HC.regionOf({ city: 'Sydney', homeAirport: 'MEL' }), 'VIC', 'the home airport is the one people edit');
  assert.equal(HC.regionOf({ city: 'Sydney', homeAirport: '' }), 'NSW');
  assert.equal(HC.regionOf({ city: 'Lyon' }), '');
  const nsw = HC.nearSessions(SES, 'als2', 'NSW', DAY, 3);
  assert.equal(nsw.local, true); assert.equal(nsw.list.length, 3); assert.ok(nsw.list.every(s => s.region === 'NSW'));
  const nz = HC.nearSessions(SES, 'nzrc-core-advanced', 'NSW', DAY, 3);
  assert.equal(nz.local, false); assert.ok(nz.list.length >= 1 && nz.list.every(s => s.country === 'NZ'));
  assert.deepEqual(HC.nearSessions(SES, 'emst', 'NSW', DAY, 3).list, []);
});

test('no made-up dates for EMST and PALS', () => {
  for (const id of ['emst', 'pals']) {
    assert.equal(SES.filter(s => s.courseId === id).length, 0, id + ' has no sessions');
    const c = course(id); assert.notEqual(c.verified, true); assert.equal(c.certificateValidityYears, null); assert.equal(c.feeRange, null);
  }
  const src = read('app.js');
  assert.match(src, /Dates not available yet — check provider/);
  /* x10: sessions carry their own evidence (provider page, quote, date read), so they list even before the course facts are
     reviewed; a course with no read session shows the "check provider" panel */
  assert.match(src, /if \(!ss\.length\) \{/, 'no session list without read sessions');
  assert.match(src, /Hoggy has not reviewed this course\\'s facts yet/);
  assert.equal(HC.equivalentLabel(CAT, course('nzrc-core-immediate')), 'NZ equivalent of ALS1');
  assert.equal(HC.equivalentLabel(CAT, course('nzrc-core-advanced')), 'NZ equivalent of ALS2');
  assert.deepEqual(HC.searchCourses(CAT, 'als2').map(c => c.id).sort(), ['als2', 'nzrc-core-advanced']);
});

test('course links: external links open in a new tab with rel="noopener noreferrer"', () => {
  const src = read('app.js'), i = src.indexOf('/* ---------- courses: catalogue'), block = src.slice(i, src.indexOf('/* ---------- post-render wiring', i));
  assert.ok(block.length > 2000);
  const tags = block.match(/<a\s[^>]*>/g) || [];
  assert.ok(tags.length > 5);
  for (const tag of tags) {
    if (/href="#|href="\$\{esc\(findHref|href="\$\{esc\(near\.local/.test(tag)) continue; /* in-app links */
    assert.match(tag, /target="_blank"/, tag); assert.match(tag, /rel="noopener noreferrer"/, tag);
  }
  assert.match(block, /const extA = \(url, label, cls = 'btn sm'\) => `<a class="\$\{cls\}" data-act="ext" target="_blank" rel="noopener noreferrer" href="\$\{esc\(safeUrl\(url\)\)\}">/);
});

test('every published course file ships and the copy stays honest', () => {
  const pub = read('server.js').match(/const PUBLIC = new Set\(\[([^\]]+)\]\)/)[1];
  for (const f of ['courses.js', 'data/courses/catalogue.json', 'data/courses/sessions.json']) assert.ok(pub.includes(`'${f}'`), f + ' is public');
  const inc = JSON.parse(read('vercel.json')).functions['api/index.js'].includeFiles;
  assert.ok(inc.includes('courses.js') && inc.includes('data/**'));
  assert.match(read('index.html'), /<script src="courses.js"><\/script>/);
  const src = read('app.js'), i = src.indexOf('/* ---------- courses: catalogue'), block = src.slice(i, src.indexOf('/* ---------- post-render wiring', i));
  assert.doesNotMatch(block + read('courses.js'), /\b(largest|leading|best|guarantee\w*|world's|number one)\b/i);
  assert.match(read('docs/pm/backlog.md'), /D3/);
  assert.match(src, /Email reminders are not available yet/);
});

/* ---------- server: /api/courses and certificates in synced state ---------- */
test('server: /api/courses and certificates persist through state sync', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoggy-c-')), port = 20000 + Math.floor(Math.random() * 20000);
  const srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, PORT: String(port), HOGGY_DATA: dir, HOST: '127.0.0.1', ...TDB.isolate(t) }, stdio: 'ignore' });
  t.after(() => srv.kill());
  const B = `http://127.0.0.1:${port}`, H = { 'X-Requested-With': 'hoggy', 'Content-Type': 'application/json' };
  for (let i = 0; i < 80; i++) { try { await fetch(B + '/healthz'); break; } catch (e) { await new Promise(r => setTimeout(r, 100)); } }
  /* x10: the list carries the catalogue and per-course counts, no sessions; ?course= gives one course; ?all=1 everything */
  const r = await fetch(B + '/api/courses'), j = await r.json(), today = new Date().toISOString().slice(0, 10);
  assert.equal(r.status, 200); assert.equal(j.courses.length, CAT.courses.length);
  assert.equal(j.sessions, undefined, 'the list does not carry every session');
  assert.ok(j.summary && j.summary.als2 && j.summary.als2.n > 0 && j.sessionsTotal > 0);
  assert.ok(r.headers.get('content-length') == null || +r.headers.get('content-length') < 400e3);
  const one = await (await fetch(B + '/api/courses?course=als2')).json();
  assert.equal(one.course, 'als2'); assert.equal(one.sessions.length, j.summary.als2.n); assert.ok(one.sessions.every(s => s.courseId === 'als2' && s.end >= today), 'finished sessions dropped');
  assert.equal((await fetch(B + '/api/courses?course=bad%20id')).status, 400);
  const all = await (await fetch(B + '/api/courses?all=1')).json();
  assert.equal(all.sessions.length, j.sessionsTotal); assert.ok(all.sessions.every(s => s.end >= today));
  assert.equal(all.sessions.filter(s => s.courseId === 'emst' || s.courseId === 'pals').length, 0);
  assert.equal((await fetch(B + '/api/courses', { headers: { 'If-None-Match': r.headers.get('etag') } })).status, 304);
  for (const f of ['courses.js', 'data/courses/catalogue.json', 'data/courses/sessions.json']) assert.equal((await fetch(B + '/' + f)).status, 200, f);
  /* certificates live in the synced state, like trips and receipts */
  const reg = await fetch(B + '/api/register', { method: 'POST', headers: H, body: JSON.stringify({ email: `c${Date.now()}@example.com`, password: 'correct-horse-battery', name: 'C' }) });
  assert.equal(reg.status, 201); const cookie = reg.headers.get('set-cookie').split(';')[0], email = (await reg.json()).user.email;
  const cert = { id: 'k1', courseId: 'als2', short: 'ALS2', completed: '2023-01-17', number: 'ALS2-12345', expires: '2027-01-17', expiryFrom: 'catalogue', fileKey: 'c-k1', fileName: 'als2.pdf' };
  const s = HC.planTrip([], SES.find(x => x.courseId === 'als2'), course('als2'), 'tr1');
  const put = await fetch(B + '/api/state', { method: 'PUT', headers: { ...H, cookie }, body: JSON.stringify({ baseRev: 0, state: { profile: {}, trips: [s.trip], receipts: [], cpd: [], certs: [cert] } }) });
  assert.equal(put.status, 200);
  /* sign in again (another device) and read it back */
  const login = await fetch(B + '/api/login', { method: 'POST', headers: H, body: JSON.stringify({ email, password: 'correct-horse-battery' }) });
  const cookie2 = login.headers.get('set-cookie').split(';')[0];
  const got = await (await fetch(B + '/api/state', { headers: { ...H, cookie: cookie2 } })).json();
  assert.deepEqual(got.state.certs, [cert]);
  assert.deepEqual(got.state.trips[0].event, s.trip.event, 'a course trip carries its session');
  /* the certificate file uses the receipt file store (c- keys) */
  const pdf = Buffer.from('%PDF-1.4\n%%EOF');
  assert.equal((await fetch(B + '/api/rfile/c-k1?name=als2.pdf', { method: 'PUT', headers: { 'X-Requested-With': 'hoggy', 'Content-Type': 'application/pdf', cookie: cookie2 }, body: pdf })).status, 200);
  assert.deepEqual(await (await fetch(B + '/api/rfiles', { headers: { ...H, cookie } })).json(), ['c-k1']);
  /* the client merges certificates by id like trips and receipts */
  assert.match(read('app.js'), /certs: by\(srv\.certs, loc\.certs\)/);
  assert.match(read('app.js'), /for \(const r of \[\.\.\.S\.receipts, \.\.\.\(S\.certs \|\| \[\]\)\]\) if \(r\.fileKey\)/);
});
