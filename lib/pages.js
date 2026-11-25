'use strict';
/* Server-rendered public pages: /about, /privacy, /terms, /conferences/<id>, /courses/<id>, the friendly 404 and
   "trouble connecting" pages, sitemap.xml, robots.txt and the web manifest.
   None of these needs the database: conference and course pages read the bundled files (data/conferences.js,
   data/courses/*.json), so they render even while the database is down. The one exception is an organiser listing approved
   at the admin desk, which lives only in the database: server.js looks it up there and shows the "trouble connecting" page
   when the database cannot answer. Plain HTML, no scripts (same CSP as the app), the app's stylesheet. */
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const HS = require('../stats.js'), HC = require('../courses.js'), ART = require('./art.js'), HX = require('./experiences.js'), HT = require('./trip.js');
const ROOT = path.join(__dirname, '..');

/* TODO(owner): set HOGGY_CONTACT_EMAIL to the public contact address once the domain is decided (D5). Never the owner's
   personal email. Until then the pages show this placeholder. */
const CONTACT = process.env.HOGGY_CONTACT_EMAIL || 'hello@[your domain]';
const contactHtml = () => /^[^\s@\[\]]+@[^\s@\[\]]+\.[a-z]{2,}$/i.test(CONTACT) ? `<a class="u" href="mailto:${esc(CONTACT)}">${esc(CONTACT)}</a>` : `<span class="placeholder">${esc(CONTACT)}</span>`;

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => { try { const x = new URL(u); return x.protocol === 'https:' ? x.href : ''; } catch (e) { return ''; } };
const todayIso = () => new Date().toISOString().slice(0, 10);
const D = (iso, o) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-AU', { timeZone: 'UTC', ...(o || { day: 'numeric', month: 'short', year: 'numeric' }) });
/* the same wording as the app's range(): estimates say "Usually <Month YYYY>" */
function range(c) {
  if (c.datesConfirmed === false) return 'Usually ' + D(c.start, { month: 'long', year: 'numeric' });
  if (c.end === c.start) return D(c.start);
  const a = new Date(c.start + 'T00:00:00Z'), b = new Date(c.end + 'T00:00:00Z');
  return a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear() ? `${a.getUTCDate()}–${b.getUTCDate()} ${D(c.start, { month: 'short', year: 'numeric' })}` : `${D(c.start, { day: 'numeric', month: 'short' })} – ${D(c.end)}`;
}

/* ---------- bundled data (read once per process) ---------- */
let BUNDLE = null;
function bundle() {
  if (BUNDLE) return BUNDLE;
  const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data', 'conferences.js'), 'utf8'), ctx, { timeout: 5000 });
  const confs = ctx.window.HOGGY_CONFERENCES || [];
  const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'courses', f), 'utf8'));
  const cat = rd('catalogue.json'), ses = rd('sessions.json').sessions || [];
  const byCourse = new Map(); for (const s of ses) (byCourse.get(s.courseId) || byCourse.set(s.courseId, []).get(s.courseId)).push(s);
  return (BUNDLE = { confs, byId: new Map(confs.map(c => [c.id, c])), cat, courseById: new Map(cat.courses.map(c => [c.id, c])), byCourse });
}
const bundledConfs = () => bundle().confs;

/* ---------- layout ---------- */
const NAV = [['/', 'Home'], ['/#/discover', 'Conferences'], ['/#/courses', 'Courses'], ['/#/list-event', 'List your event']];
const FOOT = [['/about', 'About Hoggy'], ['/privacy', 'Privacy'], ['/terms', 'Terms'], ['/#/list-event', 'List your event']];
function originOf(req) {
  if (process.env.HOGGY_SITE_URL) return process.env.HOGGY_SITE_URL.replace(/\/+$/, '');
  const h = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim().replace(/[^\w.:-]/g, '');
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https' || process.env.VERCEL ? 'https' : 'http';
  return `${proto}://${h}`;
}
const footHtml = () => `<footer class="site-foot" aria-label="Site"><nav aria-label="Footer"><ul>${FOOT.map(([h, t]) => `<li><a href="${h}">${esc(t)}</a></li>`).join('')}</ul></nav>
  <p>Check dates, fees and CPD with the organiser before booking.</p></footer>`;
function layout(req, { title, description, path: p, body, noindex, jsonLd, current }) {
  const origin = originOf(req), url = origin + (p || '/'), full = title ? `${title} · Hoggy` : 'Hoggy · Medical conferences and courses';
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(url)}">`}
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#F4EFE6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#12110E" media="(prefers-color-scheme: dark)">
<meta property="og:site_name" content="Hoggy">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title || 'Hoggy')}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(origin)}/icons/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Hoggy: medical conferences and courses">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title || 'Hoggy')}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(origin)}/icons/og.png">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
<link rel="icon" href="/icons/icon-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preload" href="/fonts/plex-sans-condensed-700.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/styles.css">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body class="site">
<a class="skip" href="#main">Skip to content</a>
<header class="site-head"><a class="brand" href="/" aria-label="Hoggy home">${ART.mark()}<span class="brand-name">hoggy</span></a>
<nav aria-label="Primary"><ul>${NAV.map(([h, t]) => `<li><a href="${h}"${current === h ? ' aria-current="page"' : ''}>${esc(t)}</a></li>`).join('')}</ul></nav></header>
<main id="main" class="site-main" tabindex="-1">
${body}
</main>
${footHtml()}
</body>
</html>`;
}
const draftNote = '<aside class="draft-note" aria-label="Draft"><b>Draft</b> · review by a lawyer before launch.</aside>';

/* ---------- legal and trust pages ---------- */
function privacy(req) {
  const body = `<article class="doc"><h1>Privacy</h1>${draftNote}
<p class="lede">Run from Australia, under the Australian Privacy Principles. Updated 24 November 2026.</p>
<h2>What we collect</h2>
<ul>
<li><b>Account:</b> name, email, password (salted scrypt hash only). A session cookie keeps you signed in; no tracking. A private address for forwarding receipts.</li>
<li><b>Synced data</b> (signed in): trips, receipt details, CPD log, certificates, saved conferences, profile settings. Employer details (employee ID, cost centre, approver, claims admin) stay on your device.</li>
<li><b>Files:</b> receipts and certificates, kept with your account. Proof of attendance is seen only by an admin and deleted once checked. Emailed receipts wait up to 30 days.</li>
<li><b>Reviews:</b> ratings, comment and your account name are public. Reports are kept for moderation.</li>
<li><b>Hospital features:</b> role, approval requests, budgets and claims, visible to that hospital’s managers, finance and admins.</li>
<li><b>Event listings:</b> the contact email is private and never shown. Listing reports go to the admin desk.</li>
<li><b>Abuse limits:</b> a one-way hash of your network address or email, kept up to an hour.</li>
</ul>
<p>Without an account, nothing about you reaches our server.</p>
<h2>Where it’s stored</h2>
<ul>
<li>Database and files: Supabase Postgres, Sydney (ap-southeast-2), with the provider’s daily backups.</li>
<li>Website: Vercel, Sydney.</li>
<li>Your device: browser local storage and IndexedDB.</li>
</ul>
<h2>Who else sees it</h2>
<ul>
<li><b>Receipt reading:</b> when turned on, a photo you choose to read (or a PDF without text) goes to Anthropic (Claude). When off, files go nowhere.</li>
<li><b>Fonts and artwork:</b> served by Hoggy or drawn in your browser. No third-party font or image service.</li>
<li><b>Links you open:</b> flight, hotel and organiser sites get only what’s in the link, such as city and dates.</li>
</ul>
<p>Hoggy does not sell your data, show ads or use analytics trackers.</p>
<h2>Deleting your data</h2>
<ul>
<li><a class="u" href="/#/settings">Settings</a> › <b>Delete account</b>: removes your account, synced data, reviews and files from our server.</li>
<li><b>Erase this device</b>: clears this browser.</li>
<li>Backup copies expire with the provider’s backups.</li>
</ul>
<h2>Access, corrections, complaints</h2>
<p>Email ${contactHtml()}. Not satisfied? Contact the OAIC (oaic.gov.au).</p>
<h2>Changes</h2>
<p>Changes update this page and its date.</p>
</article>`;
  return layout(req, { title: 'Privacy', description: 'What Hoggy collects, where it is stored (Sydney), who sees it and how to delete it.', path: '/privacy', body, current: '/privacy' });
}
function terms(req) {
  const body = `<article class="doc"><h1>Terms of use</h1>${draftNote}
<p class="lede">For using Hoggy, with or without an account. Updated 24 November 2026.</p>
<h2>Listings are information</h2>
<p>Details come from organisers’ and providers’ pages. Estimates are labelled. Check with the organiser before you register, book or pay.</p>
<h2>Not medical, financial or tax advice</h2>
<p>A claim-ready pack doesn’t mean your employer or the tax office will accept it. Their policy and the law decide.</p>
<h2>Organiser content</h2>
<ul>
<li>Organisers confirm they’re authorised and the details match their official page.</li>
<li>We check each listing before it goes live and may edit or remove it.</li>
<li>Organisers remain responsible for their events.</li>
</ul>
<h2>Reviews and acceptable use</h2>
<ul>
<li>About the event only: programme, speakers, venue, value, CPD.</li>
<li>No patient information. Don’t name or criticise individuals.</li>
<li>No spam, ads, or unlawful, abusive or misleading content.</li>
<li>No breaking into accounts, getting around limits or bulk copying.</li>
</ul>
<p>We may remove content or close accounts that break these rules.</p>
<h2>Your account</h2>
<p>Keep your password private. Tell us if someone else used your account. Delete it any time in Settings.</p>
<h2>The service</h2>
<p>Provided as is; it may change, pause or stop. To the extent the law allows, we’re not liable for losses from relying on a listing without checking it. Your rights under the Australian Consumer Law are unaffected.</p>
<h2>Contact</h2>
<p>${contactHtml()}</p>
</article>`;
  return layout(req, { title: 'Terms of use', description: 'Terms for using Hoggy: listings, advice, organiser content, reviews and acceptable use.', path: '/terms', body, current: '/terms' });
}
function about(req) {
  const s = HS.homeStats(bundledConfs(), todayIso()), n = v => Number(v).toLocaleString('en-AU');
  const body = `<article class="doc"><h1>About Hoggy</h1>
<p class="lede">Medical conferences and courses. Plan the trip, keep receipts claim-ready, log CPD.</p>
<h2>Sources</h2>
<ul>
<li>Conferences: the organiser’s own website.</li>
<li>Courses: each provider’s dates page.</li>
<li>Never aggregators or social media.</li>
<li>Organisers can <a class="u" href="/#/list-event">list an event</a>; we check it first.</li>
</ul>
<h2>Date labels</h2>
<ul>
<li><b>Confirmed</b> (${n(s.confirmed)}): page link, quote and date read, all stored.</li>
<li><b>Re-checking</b> (${n(s.unchecked)}): confirmed before 17 November 2026, when quotes started being stored.</li>
<li><b>Estimate</b> (${n(s.estimated)}): not yet published. Shown as “Usually May 2027”; city estimated.</li>
</ul>
<p>${n(s.conferences)} upcoming conferences · ${n(s.countries)} countries. CPD, prices and attendance show only when the organiser publishes them.</p>
<h2>Reviews</h2>
<p>Scores show at 3 reviews. Verified attendees (an admin checked a receipt or certificate) count in full, others half.</p>
<h2>Found a mistake?</h2>
<p>Use <b>Report a problem</b> on any listing, or email ${contactHtml()}.</p>
</article>`;
  return layout(req, { title: 'About Hoggy', description: 'Where Hoggy’s conference and course dates come from and how they are labelled.', path: '/about', body, current: '/about' });
}

/* ---------- conference and course pages ---------- */
const EV_LABEL = { confirmed: 'Confirmed', unchecked: 'Re-checking', estimated: 'Estimate' };
/* "Make a trip of it" on the listing page: the same matches as the app (lib/experiences.js); the day chips are links
   (?days=0..3, default 2) because the page has no scripts. At most 4 items unless ?all=1. */
const ORG = { commercial: 'Commercial', college: 'College', society: 'Society', university: 'University', hospital: 'Hospital' };
const TAGS = { ski: 'Ski resort', beach: 'Beach', 'family-friendly': 'Family-friendly', cruise: 'Cruise' };
function tripHtml(c, q, id) {
  let list = []; try { list = HX.experiencesFor(c, { extraDays: q.days }); } catch (e) { list = []; }
  const sd = s => D(s, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
  const when = e => { const d = e.match.dates; if (e.dateType === 'fixed-event') return HT.shortRange(d.start, d.end) + ' ' + d.end.slice(0, 4); const n = (Date.parse(d.end) - Date.parse(d.start)) / 864e5; if (n >= 359) return 'All year'; const m = x => D(x, { month: 'short' }); return m(d.start) === m(d.end) ? 'In ' + D(d.start, { month: 'long' }) : `${m(d.start)} to ${m(d.end)}`; };
  const fit = m => m.during ? 'During conference' : `+${m.extraDaysNeeded} ${m.extraDaysNeeded === 1 ? 'day' : 'days'} ${m.extraDaysAfter ? 'after' : 'before'}`;
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  const win = HT.span(c, { before: q.days, after: q.days }), shown = q.all ? list : list.slice(0, 4), base = '/conferences/' + id;
  return `<section class="mtrip" id="trip" aria-labelledby="tripH"><div class="mt-head"><h2 id="tripH">Make a trip of it</h2></div>
<nav class="chips mt-chips" aria-label="Extra days">${[0, 1, 2, 3].map(d => `<a class="chip" href="${base}?days=${d}#trip"${d === q.days ? ' aria-current="true"' : ''}>${d ? '+' + d + (d === 1 ? ' day' : ' days') : 'Conference only'}</a>`).join('')}</nav>
<p class="mt-win">${esc(sd(win.from))} – ${esc(sd(win.to))}</p>
${list.length ? `<ul class="xps">${shown.map(e => `<li class="xp"><div class="xp-b"><p class="xp-when"><span>${esc(when(e))}</span><span class="xp-fit${e.match.during ? ' on' : ''}">${esc(fit(e.match))}</span></p><h3>${esc(e.title)}</h3><p class="xp-s">${esc(e.summary)}</p><p class="xp-src"><span>${esc(HT.catLabel(e.category))}${e.match.distanceKm > 40 ? ` · ${Math.round(e.match.distanceKm / 10) * 10} km` : ''}</span> · <a class="u" href="${esc(safeUrl(e.sourceUrl))}" rel="noopener noreferrer">${esc(host(e.sourceUrl))} ↗</a></p></div></li>`).join('')}</ul>${list.length > 4 && !q.all ? `<p><a class="btn sm ghost" href="${base}?days=${q.days}&amp;all=1#trip">See all ${list.length}</a></p>` : ''}` : '<p class="mt-empty">Nothing on these dates.</p>'}
<p class="note">Check dates with each source before booking.</p></section>`;
}
function tripQuery(req) { let u; try { u = new URL(req.url, 'http://x'); } catch (e) { return { days: 2, all: false }; } const d = +u.searchParams.get('days'); return { days: u.searchParams.has('days') && d >= 0 && d <= 3 ? Math.round(d) : 2, all: u.searchParams.get('all') === '1' }; }
function conferencePage(req, c) {
  const ev = HS.dateEvidence(c), past = c.end < todayIso(), src = safeUrl(c.datesSourceUrl), off = safeUrl(c.url);
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  const evNote = ev === 'confirmed' ? `Checked ${esc(D(c.verifiedOn))}${src ? ` · <a class="u" href="${esc(src)}" rel="noopener noreferrer">${esc(host(src))} ↗</a>` : ''} · “${esc(c.datesQuote)}”`
    : ev === 'unchecked' ? 'Confirmed earlier · source not yet re-checked'
      : 'Estimate from earlier editions · check organiser';
  const cpd = c.cpdVerified && c.cpdHours ? `${esc(c.cpdHours)} hours${c.cpdBody ? ' · ' + esc(c.cpdBody) : ''}` : 'Check organiser';
  const kind = c.listingType === 'course' ? 'Course session' : 'Conference';
  const desc = `${c.name}: ${range(c)}, ${c.city}, ${c.country}. ${kind} in ${c.specialty}${c.organiser ? ', run by ' + c.organiser : ''}. ${EV_LABEL[ev]}.`;
  const ld = ev === 'estimated' ? null : { '@context': 'https://schema.org', '@type': 'Event', name: c.name, startDate: c.start, endDate: c.end, eventAttendanceMode: c.format === 'Hybrid' ? 'https://schema.org/MixedEventAttendanceMode' : 'https://schema.org/OfflineEventAttendanceMode', location: { '@type': 'Place', name: c.city, address: { '@type': 'PostalAddress', addressLocality: c.city, addressCountry: c.countryCode } }, organizer: { '@type': 'Organization', name: c.organiser, url: off || undefined }, url: off || undefined };
  const id = encodeURIComponent(c.id);
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/#/discover">Conferences</a> <span aria-hidden="true">›</span> <span>${esc(c.specialty)}</span></nav>
<article class="doc listing">
<div class="listing-hero">${ART.plate(c, { size: 'wide', ev })}</div>
<p class="eyebrow">${esc(kind)} · ${esc(c.specialty)}</p>
<h1>${esc(c.name)}</h1>
${c.blurb ? `<p class="lede">${esc(c.blurb)}</p>` : ''}
<div class="pills">${c.organiserType ? `<span class="pill${c.organiserType === 'commercial' ? ' w' : ''}">${esc(ORG[c.organiserType])}</span>` : ''}${(c.tags || []).filter(t => TAGS[t]).map(t => `<span class="tag">${esc(TAGS[t])}</span>`).join('')}<span class="pill ${ev === 'confirmed' ? 'g' : ev === 'estimated' ? 'w' : ''}">${EV_LABEL[ev]}</span><span class="pill">${esc(c.format)}</span>${c.source === 'organiser-submitted' ? '<span class="pill">Organiser-listed</span>' : ''}${past ? '<span class="pill">Finished</span>' : ''}</div>
<dl class="facts">
<div class="fact wide"><dt class="k">When</dt><dd class="v">${esc(range(c))}</dd><dd class="note">${evNote}</dd></div>
<div class="fact"><dt class="k">Where</dt><dd class="v">${esc(c.city)}, ${esc(c.country)}</dd>${c.datesConfirmed === false ? '<dd class="note">City estimated</dd>' : ''}</div>
<div class="fact"><dt class="k">Organiser</dt><dd class="v">${esc(c.organiser)}</dd></div>
<div class="fact"><dt class="k">CPD</dt><dd class="v">${cpd}</dd>${c.accreditation && safeUrl(c.accreditation.sourceUrl) ? `<dd class="note">“${esc(c.accreditation.text)}” · <a class="u" href="${esc(safeUrl(c.accreditation.sourceUrl))}" rel="noopener noreferrer">${esc(host(c.accreditation.sourceUrl))} ↗</a> · check your college</dd>` : ''}</div>
${c.schedule && safeUrl(c.schedule.sourceUrl) ? `<div class="fact wide"><dt class="k">Sessions</dt><dd class="v">${esc(c.schedule.pattern)}</dd><dd class="note">“${esc(c.schedule.quote)}” · <a class="u" href="${esc(safeUrl(c.schedule.sourceUrl))}" rel="noopener noreferrer">${esc(host(c.schedule.sourceUrl))} ↗</a></dd></div>` : ''}${c.audience ? `<div class="fact wide"><dt class="k">For</dt><dd class="v sm">${esc(c.audience)}</dd></div>` : ''}
</dl>
${past ? '' : tripHtml(c, tripQuery(req), id)}
<div class="row">${off ? `<a class="btn primary" href="${esc(off)}" rel="noopener noreferrer">Official site</a>` : ''}<a class="btn" href="/#/conference/${id}">Plan trip</a></div>
<p class="note report-line"><a class="u" href="/#/report/conference/${id}">Report a problem</a></p>
</article>`;
  return layout(req, { title: `${c.name} (${c.start.slice(0, 4)})`, description: desc.slice(0, 300), path: '/conferences/' + id, body, jsonLd: ld, current: '/#/discover' });
}
const dialLabel = s => { s = String(s || ''); if (s.length <= 9) return s; const a = s.split(/[\s/-]+/).filter(w => /^[A-Z0-9]/.test(w)).map(w => w[0]).join('').slice(0, 5); return a.length > 1 ? a : s.split(/\s+/)[0].slice(0, 9); };
function coursePage(req, id) {
  const B = bundle(), c = B.courseById.get(id); if (!c) return null;
  const day = todayIso(), ss = (B.byCourse.get(id) || []).filter(s => s.end >= day).sort((a, b) => a.start.localeCompare(b.start));
  const v = HC.validityOf(c), body0 = HC.bodyLabel(c.id), owner = (c.providers || [])[0] || {};
  const place = s => ['AU', 'NZ'].includes(s.country) ? `${s.city}${s.region ? ', ' + s.region : ''}` : `${s.city}, ${HC.countryName(s.country)}`;
  const when = s => s.end && s.end !== s.start ? `${D(s.start, { day: 'numeric', month: 'short' })} – ${D(s.end)}` : D(s.start);
  const countries = [...new Set(ss.map(s => s.country))].map(HC.countryName);
  const desc = `${c.name}${owner.name ? ', ' + owner.name.split(/[;(]/)[0].trim() : ''}. ${ss.length ? `${ss.length} upcoming session${ss.length === 1 ? '' : 's'}${countries.length ? ' in ' + countries.slice(0, 4).join(', ') : ''}.` : 'No dates yet.'}${v ? ` Certificate valid ${v.years} years.` : ''}`;
  const fact = (k, val, note) => `<div class="fact"><dt class="k">${k}</dt><dd class="v">${val}</dd>${note ? `<dd class="note">${note}</dd>` : ''}</div>`;
  const srcA = (u, t) => safeUrl(u) ? `<a class="u" href="${esc(safeUrl(u))}" rel="noopener noreferrer">${esc(t)}</a>` : '';
  const qid = encodeURIComponent(id);
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/#/courses">Courses</a></nav>
<article class="doc listing course">
<div class="listing-hero">${ART.dial(c.id, dialLabel(HC.shortName(c)), { size: 'square', sub: (c.countries || []).slice(0, 5).join(' · ') })}</div>
${body0 ? `<p class="eyebrow">${esc(body0)}</p>` : ''}
<h1>${esc(c.name)}</h1>
${owner.name ? `<p class="lede">${esc(owner.name)}</p>` : ''}
<dl class="facts">
${fact('Length', c.typicalLength ? esc(c.typicalLength) : 'Check provider')}
${fact('Certificate validity', v ? esc(v.years) + ' years' : 'Check provider', v ? srcA(v.source, (() => { try { return new URL(v.source).hostname.replace(/^www\./, '') + ' ↗'; } catch (e) { return 'Source'; } })()) : '')}
${fact("Who it's for", c.audience ? esc(c.audience) : 'Check provider')}
${fact('Format', c.format ? esc(c.format) : 'Check provider')}
</dl>
<h2>Upcoming sessions</h2>
${ss.length ? `<p class="note">${ss.length > 10 ? `Next 10 of ${ss.length}` : `${ss.length} upcoming`}</p><ul class="sess-plain">${ss.slice(0, 10).map(s => `<li><b>${esc(when(s))}</b> · ${esc(place(s))} · ${esc(s.provider || '')}${safeUrl(s.bookingUrl) ? ` · <a class="u" href="${esc(safeUrl(s.bookingUrl))}" rel="noopener noreferrer">Book ↗</a>` : ''}</li>`).join('')}</ul>` : `<p>No dates yet. Check provider.</p>`}
<div class="row"><a class="btn primary" href="/#/courses/${qid}">Plan trip</a>${(c.providers || []).filter(p => safeUrl(p.url)).slice(0, 2).map(p => `<a class="btn" href="${esc(safeUrl(p.url))}" rel="noopener noreferrer">${esc(p.name.split(/[(:;]/)[0].trim())}</a>`).join('')}</div>
<p class="note report-line"><a class="u" href="/#/report/course/${qid}">Report a problem</a></p>
</article>`;
  return layout(req, { title: c.name, description: desc.slice(0, 300), path: '/courses/' + qid, body, current: '/#/courses' });
}

/* ---------- 404 and "trouble connecting" ---------- */
function notFound(req, what) {
  const body = `<section class="doc state-page"><h1>${what ? esc(what) : 'Page not found'}</h1>
<div class="row"><a class="btn primary" href="/#/discover">Find conferences</a><a class="btn" href="/#/courses">Courses</a><a class="btn ghost" href="/">Home</a></div></section>`;
  return layout(req, { title: 'Page not found', description: 'This page is not on Hoggy.', path: '/404', body, noindex: true });
}
function trouble(req) {
  const back = String(req.url || '/').replace(/[^\w\/?&=.%#-]/g, '');
  const body = `<section class="doc state-page"><h1>Can’t connect</h1>
<p class="lede">Listings still work. Try again shortly.</p>
<div class="row"><a class="btn primary" href="${esc(back)}">Try again</a><a class="btn" href="/#/discover">Conferences</a><a class="btn ghost" href="/">Home</a></div></section>`;
  return layout(req, { title: 'Trouble connecting', description: 'Hoggy can’t connect right now. Listings still work; try again shortly.', path: '/', body, noindex: true });
}

/* ---------- crawl and install files ---------- */
function sitemap(req, extra = []) {
  const o = originOf(req), day = todayIso(), B = bundle();
  const u = (p, mod) => `<url><loc>${esc(o + p)}</loc>${mod ? `<lastmod>${esc(mod)}</lastmod>` : ''}</url>`;
  const confs = B.confs.concat(extra.filter(c => !B.byId.has(c.id))).filter(c => c.end >= day);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[u('/'), u('/about'), u('/privacy'), u('/terms'),
    ...confs.map(c => u('/conferences/' + encodeURIComponent(c.id), /^\d{4}-\d{2}-\d{2}$/.test(c.verifiedOn || c.lastVerified || '') ? (c.verifiedOn || c.lastVerified) : '')),
    ...B.cat.courses.map(c => u('/courses/' + encodeURIComponent(c.id)))].join('\n')}\n</urlset>\n`;
}
const robots = req => `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin.html\nDisallow: /admin\nSitemap: ${originOf(req)}/sitemap.xml\n`;
const manifest = () => JSON.stringify({
  name: 'Hoggy · Medical conferences and courses', short_name: 'Hoggy', description: 'Medical conferences and courses. Plan the trip, track CPD, claim expenses.',
  start_url: '/', scope: '/', display: 'standalone', background_color: '#F4EFE6', theme_color: '#F4EFE6', lang: 'en-AU',
  icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }, { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' }]
}, null, 1);

module.exports = { bundle, bundledConfs, privacy, terms, about, conferencePage, coursePage, notFound, trouble, sitemap, robots, manifest, range, CONTACT, originOf };
