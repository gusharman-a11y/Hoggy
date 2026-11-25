'use strict';
/* Client-ready: "List your event" (organiser submissions), "Report a problem with this listing", the public pages rendered on
   the server (privacy, terms, about, conference and course pages, 404, sitemap, robots, manifest) and the site with the
   database down. Run: node --test tests/ */
const test = require('node:test'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process'), path = require('node:path'), fs = require('node:fs'), os = require('node:os'), vm = require('node:vm');
const TDB = require('./_db.js');
const LST = require('../lib/listings.js');
const { evidenceProblem } = require('../tools/evidence.js');
const { validate: validateConf } = require('../lib/ingest.js');
const ROOT = path.join(__dirname, '..');
const CONFS = (() => { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data', 'conferences.js'), 'utf8'), ctx); return ctx.window.HOGGY_CONFERENCES; })();
const TODAY = new Date().toISOString().slice(0, 10);
const addDays = (iso, n) => { const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const START = addDays(TODAY, 200), END = addDays(TODAY, 202), DAY = String(+START.slice(8, 10));
const MONTH = new Date(START + 'T00:00:00Z').toLocaleDateString('en-AU', { timeZone: 'UTC', month: 'long', year: 'numeric' });
const QUOTE = `${DAY}–${+END.slice(8, 10)} ${MONTH}, Brisbane Convention and Exhibition Centre`;
const LISTING = { kind: 'conference', name: 'Queensland Rural Medicine Update ' + START.slice(0, 4), organiser: 'Rural Doctors Society of Queensland', url: 'https://rdsq.example.org/events/rural-update-' + START.slice(0, 4),
  start: START, end: END, city: 'Brisbane', countryCode: 'AU', specialty: 'General Practice', format: 'In-person', cpdHours: 12, cpdBody: 'RACGP', blurb: 'Two days of rural procedural skills and case reviews.',
  contactEmail: 'events@rdsq.example.org', authorised: true };

async function startServer(t, extra = {}, dir) {
  dir = dir || fs.mkdtempSync(path.join(os.tmpdir(), 'hoggy-cr-')); const port = 20000 + Math.floor(Math.random() * 30000);
  const env = { ...process.env, PORT: String(port), HOGGY_DATA: dir, HOST: '127.0.0.1', HOGGY_ADMIN_KEY: 'test-admin-key', HOGGY_ADMINS: 'admin@example.com', ...(extra.DATABASE_URL ? {} : TDB.isolate(t, extra.schema)), ...extra };
  delete env.schema;
  const srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; srv.stdout.on('data', d => out += d); srv.stderr.on('data', d => out += d);
  t.after(() => srv.kill());
  const B = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 150; i++) { try { await fetch(B + '/robots.txt'); break; } catch (e) { await new Promise(r => setTimeout(r, 100)); } }
  if (!extra.DATABASE_URL || !/127\.0\.0\.1:1\//.test(extra.DATABASE_URL)) for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/healthz')).ok) break; } catch (e) { } await new Promise(r => setTimeout(r, 100)); }
  return { B, dir, srv, log: () => out };
}
function client(B) {
  let cookie = '';
  const call = async (p, o = {}, h = {}) => { const r = await fetch(B + p, { ...o, headers: { 'X-Requested-With': 'hoggy', 'Content-Type': 'application/json', ...h, cookie } }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; let j = null; try { j = await r.clone().json(); } catch (e) { } return [r.status, j, r]; };
  return { call, register: (email, name) => call('/api/register', { method: 'POST', body: JSON.stringify({ email, password: 'correct-horse-battery', name }) }) };
}
const post = o => ({ method: 'POST', body: JSON.stringify(o) });
const AK = { 'X-Admin-Key': 'test-admin-key' };

test('listing rules: validation, the row an approval makes passes the evidence rule and the conference validator', () => {
  const countries = LST.countryMap(CONFS);
  assert.deepEqual(countries.AU, { name: 'Australia', region: 'Asia-Pacific' }); assert.equal(countries.NZ.name, 'New Zealand');
  const ok = LST.validateSubmission(LISTING, { countries, today: TODAY }); assert.equal(ok.ok, true);
  const bad = (patch, field) => { const r = LST.validateSubmission({ ...LISTING, ...patch }, { countries, today: TODAY }); assert.equal(r.ok, false, JSON.stringify(patch)); assert.equal(r.field, field); };
  bad({ url: 'http://rdsq.example.org/x' }, 'url'); bad({ url: 'javascript:alert(1)' }, 'url'); bad({ url: 'https://user:pw@rdsq.example.org/x' }, 'url');
  bad({ end: addDays(START, -1) }, 'end'); bad({ start: '2020-01-01', end: '2020-01-02' }, 'start'); bad({ countryCode: 'XX' }, 'countryCode');
  bad({ specialty: 'Astrology' }, 'specialty'); bad({ format: 'Online' }, 'format'); bad({ name: '' }, 'name'); bad({ cpdHours: 500 }, 'cpdHours');
  assert.equal(LST.validateSubmission({ ...LISTING, specialty: 'Family Medicine' }, { countries, today: TODAY }).value.specialty, 'General Practice', 'canonical specialty');
  assert.equal(LST.validateContact({ ...LISTING, authorised: false }).field, 'authorised'); assert.equal(LST.validateContact({ ...LISTING, contactEmail: 'nope' }).field, 'contactEmail');
  const row = LST.listingRow(ok.value, { countries, quote: QUOTE, today: TODAY, cpdConfirmed: true, id: LST.idFor(ok.value) });
  assert.match(row.id, /^org-queensland-rural-medicine-update-\d{4}$/);
  assert.equal(evidenceProblem(row, { today: TODAY }), null); assert.equal(validateConf(row), null);
  assert.equal(row.source, 'organiser-submitted'); assert.equal(row.datesSourceUrl, LISTING.url); assert.equal(row.verifiedOn, TODAY); assert.equal(row.cpdVerified, true);
  assert.ok(!('contactEmail' in row) && !JSON.stringify(row).includes('events@'), 'the contact email never reaches the listing');
  assert.equal(LST.listingRow(ok.value, { countries, quote: QUOTE, today: TODAY, id: 'x' }).cpdHours, 0, 'CPD hours only when the admin saw them on the page');
  assert.match(evidenceProblem(LST.listingRow(ok.value, { countries, quote: 'Dates to be announced soon', today: TODAY, id: 'x' }), { today: TODAY }), /no date|start day/, 'a quote without the start day fails');
  assert.match(evidenceProblem(LST.listingRow({ ...ok.value, url: 'https://rdsq.example.org/' }, { countries, quote: QUOTE, today: TODAY, id: 'x' }), { today: TODAY }), /site root/, 'a home page is not evidence');
  assert.equal(LST.validateReport({ kind: 'conference', id: 'abc', reason: 'other', note: '' }).ok, false, '"other" needs a note');
  assert.equal(LST.validateReport({ kind: 'course', id: 'als2', reason: 'wrong-date' }).ok, true);
});

test('List your event: public form, honeypot, rate limit, admin approve needs the pasted date line, approved row is served and survives a reseed', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoggy-cr-')), schema = TDB.PG ? 't_' + require('node:crypto').randomBytes(6).toString('hex') : undefined;
  const S1 = await startServer(t, schema ? { schema } : {}, dir), anon = client(S1.B), admin = client(S1.B);
  assert.equal((await anon.call('/api/submissions', post(LISTING), { 'X-Requested-With': '' }))[0], 403, 'CSRF header required');
  const [s400, e400] = await anon.call('/api/submissions', post({ ...LISTING, url: 'http://x.org' })); assert.equal(s400, 400); assert.equal(e400.field, 'url');
  assert.equal((await anon.call('/api/submissions', post({ ...LISTING, authorised: false })))[1].field, 'authorised', 'the confirmation tickbox is required');
  assert.equal((await anon.call('/api/submissions', post({ ...LISTING, blurb: 'The leading rural meeting in Queensland.' })))[1].field, 'blurb', 'no superlatives');
  /* honeypot: looks accepted, nothing stored */
  const [hs, hj] = await anon.call('/api/submissions', post({ ...LISTING, name: 'Spam bot event', website: 'https://spam.example' }));
  assert.equal(hs, 201); assert.equal(hj.status, 'pending');
  /* five per network per hour */
  for (let i = 0; i < 5; i++) assert.equal((await anon.call('/api/submissions', post({ ...LISTING, name: LISTING.name + (i ? ' ' + i : ''), contactEmail: i ? `e${i}@rdsq.example.org` : LISTING.contactEmail })))[0], 201);
  const [s429, e429] = await anon.call('/api/submissions', post({ ...LISTING, contactEmail: 'other@rdsq.example.org' })); assert.equal(s429, 429); assert.match(e429.error, /Try again later/);
  /* admin queue: the official page link, the private contact email; no spam row */
  assert.equal((await anon.call('/api/admin/submissions'))[0], 401);
  await admin.register('admin@example.com', 'Admin');
  assert.equal((await admin.call('/api/admin/submissions'))[0], 403, 'admin key required');
  const [, q] = await admin.call('/api/admin/submissions', {}, AK);
  assert.equal(q.length, 5); assert.ok(!q.some(x => /Spam bot/.test(x.listing.name)), 'honeypot rows are never stored');
  const sub = q.find(x => x.listing.name === LISTING.name); assert.equal(sub.listing.url, LISTING.url); assert.equal(sub.contactEmail, LISTING.contactEmail); assert.equal(sub.signedIn, false);
  /* approve needs the admin's own copy of the date line, and that line must hold the start day */
  const [n1, j1] = await admin.call('/api/admin/submissions/' + sub.id, post({ action: 'approve' }), AK); assert.equal(n1, 400); assert.equal(j1.field, 'datesQuote'); assert.match(j1.error, /paste the line/i);
  const [n2, j2] = await admin.call('/api/admin/submissions/' + sub.id, post({ action: 'approve', datesQuote: 'Registrations open in March' }), AK); assert.equal(n2, 400); assert.match(j2.error, /start day|no date/);
  const [n3, j3] = await admin.call('/api/admin/submissions/' + sub.id, post({ action: 'approve', datesQuote: QUOTE, listing: { url: 'https://rdsq.example.org/' } }), AK); assert.equal(n3, 400); assert.match(j3.error, /site root/);
  /* edit, then approve */
  assert.equal((await admin.call('/api/admin/submissions/' + sub.id, post({ action: 'edit', listing: { city: 'Brisbane City' } }), AK))[0], 200);
  const [ok, oj] = await admin.call('/api/admin/submissions/' + sub.id, post({ action: 'approve', datesQuote: QUOTE, cpdConfirmed: true }), AK);
  assert.equal(ok, 200, JSON.stringify(oj)); const id = oj.id; assert.match(id, /^org-/);
  assert.equal((await admin.call('/api/admin/submissions/' + sub.id, post({ action: 'approve', datesQuote: QUOTE }), AK))[0], 404, 'decided once');
  const other = q.find(x => x !== sub); assert.equal((await admin.call('/api/admin/submissions/' + other.id, post({ action: 'reject', note: 'duplicate' }), AK))[0], 200);
  const [, list] = await anon.call('/api/conferences'); const row = list.conferences.find(c => c.id === id);
  assert.ok(row, 'approved row appears in /api/conferences');
  assert.equal(row.source, 'organiser-submitted'); assert.equal(row.city, 'Brisbane City'); assert.equal(row.datesConfirmed, true);
  assert.equal(row.datesSourceUrl, LISTING.url); assert.equal(row.datesQuote, QUOTE); assert.equal(row.verifiedOn, TODAY); assert.equal(row.cpdHours, 12);
  assert.ok(!JSON.stringify(list).includes(LISTING.contactEmail), 'the contact email is never public');
  const page = await fetch(S1.B + '/conferences/' + id); assert.equal(page.status, 200); const html = await page.text();
  assert.match(html, /Organiser-listed/); assert.match(html, /class="pill g">Confirmed</); assert.ok(html.includes(LISTING.url)); assert.ok(!html.includes(LISTING.contactEmail));
  assert.ok((await (await fetch(S1.B + '/sitemap.xml')).text()).includes('/conferences/' + id), 'in the sitemap');
  /* the daily data merge changes data/conferences.js; the server reseeds on the next start. Force that reseed: the row stays. */
  if (!TDB.PG) {
    S1.srv.kill(); await new Promise(r => setTimeout(r, 300));
    const { DatabaseSync } = require('node:sqlite'), d = new DatabaseSync(path.join(dir, 'hoggy.db')); d.exec("UPDATE meta SET value='changed' WHERE key='conf_seed_hash'; UPDATE conferences SET seedhash='old' WHERE source='curated'"); d.close();
    const S2 = await startServer(t, {}, dir);
    assert.match(S2.log(), /seed: 0 new, [1-9]\d* updated conferences/, 'the merged file was seeded again');
    const [, l2] = await client(S2.B).call('/api/conferences'); assert.ok(l2.conferences.some(c => c.id === id && c.source === 'organiser-submitted'), 'survives the reseed');
  }
});

test('Report a problem with this listing: validation, honeypot, admin queue, resolve', async (t) => {
  const S = await startServer(t), anon = client(S.B), admin = client(S.B), conf = CONFS.find(c => c.end >= TODAY);
  assert.equal((await anon.call('/api/reports', post({ kind: 'conference', id: conf.id, reason: 'rude' })))[0], 400);
  assert.equal((await anon.call('/api/reports', post({ kind: 'conference', id: conf.id, reason: 'other' })))[0], 400, '"other" needs a note');
  assert.equal((await anon.call('/api/reports', post({ kind: 'conference', id: 'no-such-conference', reason: 'duplicate' })))[0], 404);
  assert.equal((await anon.call('/api/reports', post({ kind: 'conference', id: conf.id, reason: 'duplicate', website: 'x' })))[0], 201, 'honeypot looks accepted');
  assert.equal((await anon.call('/api/reports', post({ kind: 'conference', id: conf.id, reason: 'wrong-date', note: 'The page now says 3-5 June' })))[0], 201);
  assert.equal((await anon.call('/api/reports', post({ kind: 'course', id: 'als2', reason: 'wrong-city' })))[0], 201);
  await admin.register('admin@example.com', 'Admin');
  const [, rs] = await admin.call('/api/admin/reports', {}, AK);
  assert.equal(rs.length, 2, 'the honeypot report is not stored');
  const c = rs.find(r => r.kind === 'conference'); assert.equal(c.name, conf.name); assert.equal(c.reasonLabel, 'Wrong date'); assert.equal(c.note, 'The page now says 3-5 June'); assert.equal(c.signedIn, false);
  assert.ok(rs.find(r => r.kind === 'course').name.includes('ALS2'));
  assert.equal((await admin.call('/api/admin/reports/' + c.id, post({ action: 'resolve' }), AK))[0], 200);
  assert.equal((await admin.call('/api/admin/reports/' + c.id, post({ action: 'resolve' }), AK))[0], 404);
  assert.equal((await admin.call('/api/admin/reports', {}, AK))[1].length, 1);
});

test('public pages: privacy, terms, about, conference and course pages with meta tags; 404 page; robots, sitemap, manifest', async (t) => {
  const S = await startServer(t), get = async p => { const r = await fetch(S.B + p); return [r.status, await r.text(), r]; };
  for (const [p, h1] of [['/privacy', 'Privacy'], ['/terms', 'Terms of use'], ['/about', 'About Hoggy']]) {
    const [s, html, r] = await get(p); assert.equal(s, 200, p); assert.match(r.headers.get('content-type'), /text\/html/);
    assert.ok(html.includes(`<h1>${h1}</h1>`)); assert.match(html, /<html lang="en-AU">/); assert.match(html, /<meta name="description" content="[^"]{40,}">/);
    assert.match(html, /property="og:image" content="http:\/\/127\.0\.0\.1:\d+\/icons\/og\.png"/); assert.match(html, /name="twitter:card" content="summary_large_image"/);
    for (const f of ['/about', '/privacy', '/terms', '/#/list-event']) assert.ok(html.includes(`href="${f}"`), p + ' footer links ' + f);
    assert.doesNotMatch(html, /gusharman|@gmail\.com/, 'no personal email');
  }
  const [, priv] = await get('/privacy'); assert.match(priv, /Draft<\/b> · review by a lawyer before launch/); assert.match(priv, /Sydney/); assert.match(priv, /Anthropic/); assert.match(priv, /does not sell your data/); assert.match(priv, /hello@\[your domain\]/);
  const [, terms] = await get('/terms'); assert.match(terms, /review by a lawyer before launch/); assert.match(terms, /not medical, financial or tax advice/i);
  const conf = CONFS.find(c => c.end >= TODAY && c.datesSourceUrl && c.datesQuote && !c.legacyConfirmed);
  const [cs, chtml] = await get('/conferences/' + conf.id); assert.equal(cs, 200);
  assert.ok(chtml.includes('<h1>' + conf.name.replace(/&/g, '&amp;') + '</h1>')); assert.match(chtml, /application\/ld\+json/); assert.match(chtml, />Report a problem</);
  assert.match(chtml, /<link rel="canonical" href="http:\/\/127\.0\.0\.1:\d+\/conferences\//);
  const est = CONFS.find(c => c.end >= TODAY && c.datesConfirmed === false); const [, ehtml] = await get('/conferences/' + est.id);
  assert.match(ehtml, /Usually /); assert.doesNotMatch(ehtml, /ld\+json/, 'no Event markup for an estimate');
  const [ks, khtml] = await get('/courses/als2'); assert.equal(ks, 200); assert.match(khtml, /Advanced Life Support Level 2/); assert.match(khtml, /Upcoming sessions/);
  for (const p of ['/no-such-page', '/conferences/no-such-conference', '/courses/no-such-course', '/data-store/hoggy.db']) {
    const [s, html] = await get(p); assert.equal(s, 404, p); assert.match(html, /<h1>(Page not found|Listing not found|Course not found)<\/h1>/); assert.match(html, /noindex/);
  }
  const [as, aj, ar] = await client(S.B).call('/api/no-such-thing'); assert.match(ar.headers.get('content-type'), /json/, 'the API keeps JSON'); assert.ok(as >= 400 && aj.error);
  const [, robots] = await get('/robots.txt'); assert.match(robots, /Disallow: \/api\//); assert.match(robots, /Disallow: \/admin/); assert.match(robots, /Sitemap: http:\/\/127\.0\.0\.1:\d+\/sitemap\.xml/);
  const [, sm] = await get('/sitemap.xml'); assert.ok(sm.includes('/conferences/' + conf.id)); assert.ok(sm.includes('/courses/als2')); assert.ok(!sm.includes('/api/'));
  const [ms, mj] = await get('/manifest.webmanifest'); assert.equal(ms, 200); const man = JSON.parse(mj); assert.equal(man.short_name, 'Hoggy'); assert.ok(man.icons.some(i => i.purpose === 'maskable'));
  for (const i of man.icons) assert.equal((await fetch(S.B + i.src)).status, 200, i.src);
  const [, home] = await get('/'); assert.match(home, /rel="manifest"/); assert.match(home, /og:image" content="http:\/\/127\.0\.0\.1:\d+\/icons\/og\.png"/); assert.doesNotMatch(home, /%ORIGIN%/);
});

test('database down: public pages render from the bundled data, the API says so in JSON, sign-in pages get the friendly page', async (t) => {
  const S = await startServer(t, { DATABASE_URL: 'postgres://hoggy:nope@127.0.0.1:1/hoggy' }), conf = CONFS.find(c => c.end >= TODAY);
  for (const p of ['/', '/privacy', '/terms', '/about', '/conferences/' + conf.id, '/courses/als2', '/app.js', '/data/conferences.js']) assert.equal((await fetch(S.B + p)).status, 200, p);
  const r = await fetch(S.B + '/api/conferences'); assert.equal(r.status, 200); assert.equal(r.headers.get('x-hoggy-fallback'), 'bundled');
  const j = await r.json(); assert.equal(j.conferences.length, CONFS.length); assert.equal(j.fallback, 'bundled');
  assert.equal((await fetch(S.B + '/api/courses')).status, 200, 'the course catalogue never needs the database');
  const me = await fetch(S.B + '/api/me'); assert.equal(me.status, 503); assert.match(me.headers.get('content-type'), /json/); assert.match((await me.json()).error, /database unavailable/);
  const org = await fetch(S.B + '/conferences/org-not-bundled-2027'); assert.equal(org.status, 503); assert.match(await org.text(), /<h1>Can’t connect<\/h1>/);
  assert.equal((await fetch(S.B + '/no-such-page')).status, 404);
});
