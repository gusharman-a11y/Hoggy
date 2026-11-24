'use strict';
/* Server-rendered public pages: /about, /privacy, /terms, /conferences/<id>, /courses/<id>, the friendly 404 and
   "trouble connecting" pages, sitemap.xml, robots.txt and the web manifest.
   None of these needs the database: conference and course pages read the bundled files (data/conferences.js,
   data/courses/*.json), so they render even while the database is down. The one exception is an organiser listing approved
   at the admin desk, which lives only in the database: server.js looks it up there and shows the "trouble connecting" page
   when the database cannot answer. Plain HTML, no scripts (same CSP as the app), the app's stylesheet. */
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const HS = require('../stats.js'), HC = require('../courses.js'), ART = require('./art.js');
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
const FOOT = [['/about', 'About Hoggy'], ['/privacy', 'Privacy'], ['/terms', 'Terms'], ['/#/list-event', 'Organisers: list your event']];
function originOf(req) {
  if (process.env.HOGGY_SITE_URL) return process.env.HOGGY_SITE_URL.replace(/\/+$/, '');
  const h = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim().replace(/[^\w.:-]/g, '');
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https' || process.env.VERCEL ? 'https' : 'http';
  return `${proto}://${h}`;
}
const footHtml = () => `<footer class="site-foot" aria-label="Site"><nav aria-label="Footer"><ul>${FOOT.map(([h, t]) => `<li><a href="${h}">${esc(t)}</a></li>`).join('')}</ul></nav>
  <p>Hoggy lists medical conferences and courses for planning. Check dates, fees and CPD with the organiser before you book.</p></footer>`;
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
<link rel="preload" href="/fonts/bricolage-grotesque-display.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/instrument-sans.woff2" as="font" type="font/woff2" crossorigin>
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
const draftNote = '<aside class="draft-note" aria-label="Draft"><b>Draft</b> — review by a lawyer before launch. This page describes how Hoggy works today and is not yet final.</aside>';

/* ---------- legal and trust pages ---------- */
function privacy(req) {
  const body = `<article class="doc"><h1>Privacy</h1>${draftNote}
<p class="lede">This page says what Hoggy collects, where it is kept, who else sees it and how to delete it. Hoggy is run from Australia and this policy is written with the Australian Privacy Principles in mind. Last updated 24 November 2026.</p>
<h2>What Hoggy collects</h2>
<ul>
<li><b>Your account</b>, if you create one: your name, email address and password. The password is stored only as a salted scrypt hash. A session cookie keeps you signed in; it is not used for tracking. You also get a private address for forwarding receipts.</li>
<li><b>What you sync</b> when signed in: your trips, receipt details (supplier, amount, date, category, notes), CPD log, certificates, saved conferences and your profile settings (such as specialty, country and home city). Employer details you type in Settings (employee ID, cost centre, approver and claims admin details) stay on your device and are not sent to Hoggy's server.</li>
<li><b>Files you upload</b>: receipt files and certificates (a copy is kept with your account so they open on your other devices), and any proof of attendance you send to verify a review. Proof files are seen only by a Hoggy admin and are deleted once the admin decides. Receipts you email to your forwarding address wait in your inbox for up to 30 days until the app picks them up.</li>
<li><b>Reviews</b> you post: your ratings, comment and the name on your account are shown publicly with the review. Reports you make about reviews are kept for moderation.</li>
<li><b>Hospital features</b>, if you join a hospital in Hoggy: your role, trip approval requests, budgets and claims. Managers, finance staff and admins of that hospital can see these.</li>
<li><b>Event listings and problem reports</b>: if you list an event, the contact email you give is kept privately so Hoggy can check the listing with you. It is never shown on the listing. Reports about a listing are kept for the admin desk.</li>
<li><b>Limits against abuse</b>: to slow down password guessing and spam, Hoggy keeps a one-way hash of your network address or email with the time of each attempt, for up to an hour.</li>
</ul>
<p>Without an account, nothing about you is sent to Hoggy's server: your trips, receipts and CPD stay in your browser on this device.</p>
<h2>Where it is stored</h2>
<p>Account data and uploaded files are kept in a Postgres database run by Supabase in its Sydney region (ap-southeast-2). The website runs on Vercel, in its Sydney region. On your own device, Hoggy uses your browser's local storage and IndexedDB. Our database provider makes daily backups, which are kept for that provider's backup period.</p>
<h2>Who else sees it</h2>
<ul>
<li><b>Receipt photo reading.</b> If photo reading is turned on for Hoggy, a receipt photo you choose to read (or a PDF with no text layer) is sent to Anthropic, the company that makes the Claude model, so it can read the supplier, amount and date. If photo reading is off, receipt files are not sent anywhere.</li>
<li><b>Fonts and artwork.</b> The typefaces are served by Hoggy itself and the artwork on each listing is drawn in your browser, so loading a page sends nothing to a font or image service.</li>
<li><b>Links you open.</b> Flight, hotel and organiser links take you to those sites, which have their own privacy policies. Hoggy sends them only what is in the link (for example, the city and dates of a search).</li>
</ul>
<p>Hoggy does not sell your data, does not show advertising and does not use advertising or analytics trackers.</p>
<h2>Deleting your data</h2>
<p>In the app, open <a class="u" href="/#/settings">Settings</a>. <b>Delete account</b> removes your account, your synced data, your reviews and your files from Hoggy's server. <b>Erase this device</b> removes what is stored in this browser. Copies in the database provider's backups expire with those backups.</p>
<h2>Seeing or correcting your information</h2>
<p>You can see and change most of your information in the app. To ask for a copy of what Hoggy holds about you, to correct it, or to make a privacy complaint, email ${contactHtml()}. If you are not satisfied with the answer, you can contact the Office of the Australian Information Commissioner (oaic.gov.au).</p>
<h2>Changes</h2>
<p>If this policy changes, this page and the date at the top change too.</p>
</article>`;
  return layout(req, { title: 'Privacy', description: 'What Hoggy collects, where it is stored (Sydney), who else sees it, and how to delete your account and data.', path: '/privacy', body, current: '/privacy' });
}
function terms(req) {
  const body = `<article class="doc"><h1>Terms of use</h1>${draftNote}
<p class="lede">These terms cover using Hoggy, with or without an account. Last updated 24 November 2026.</p>
<h2>Listings are for information</h2>
<p>Hoggy lists conferences and courses to help you plan. Dates, venues, fees and CPD credits come from organisers' and providers' pages, and some dates are estimates, which are labelled. Things change: always check the details with the organiser or provider before you register, book travel or pay.</p>
<h2>Not medical, financial or tax advice</h2>
<p>Nothing on Hoggy is medical advice. Claim packs, budgets and receipt checks help you prepare an expense claim; they are not financial or tax advice, and a claim-ready pack does not mean your employer or the tax office will accept it. Your employer's policy and the law decide that.</p>
<h2>Organiser content</h2>
<p>Organisers who list an event confirm they are authorised to do so and that the details match their official page. A Hoggy admin checks each listing against that page before it goes live, and may edit or remove a listing at any time. Organisers remain responsible for their events.</p>
<h2>Reviews and acceptable use</h2>
<ul>
<li>Keep reviews honest and about the event: the programme, speakers, venue, value and CPD.</li>
<li>Never include patient information. Do not name or criticise individuals.</li>
<li>Do not post spam or advertising, or anything unlawful, abusive or misleading.</li>
<li>Do not try to break into accounts, get around limits or security checks, or copy the listings in bulk.</li>
</ul>
<p>Hoggy may remove content or close accounts that break these rules.</p>
<h2>Your account</h2>
<p>Keep your password to yourself and tell us if you think someone else has used your account. You can delete your account at any time in Settings.</p>
<h2>The service</h2>
<p>Hoggy is provided as it is and may change, pause or stop. We work to keep it accurate and available but cannot promise it will always be either. To the extent the law allows, Hoggy is not liable for losses that come from relying on a listing without checking it with the organiser. Nothing in these terms limits rights you have under the Australian Consumer Law.</p>
<h2>Contact</h2>
<p>Questions about these terms: ${contactHtml()}.</p>
</article>`;
  return layout(req, { title: 'Terms of use', description: 'Terms for using Hoggy: listings are for information, check with the organiser, organiser content, reviews and acceptable use.', path: '/terms', body, current: '/terms' });
}
function about(req) {
  const s = HS.homeStats(bundledConfs(), todayIso()), n = v => Number(v).toLocaleString('en-AU');
  const body = `<article class="doc"><h1>About Hoggy</h1>
<p class="lede">Hoggy helps doctors and clinicians find medical conferences and courses, plan the trip, keep receipts ready for an expense claim and log CPD.</p>
<h2>Where the listings come from</h2>
<p>Each conference is read from the organiser's or society's own website. Course sessions are read from each provider's own course-dates page. Hoggy does not copy dates from aggregator sites or social media; those are only leads to the official page. Organisers can also <a class="u" href="/#/list-event">list their own event</a>, which a Hoggy admin checks against the official page before it goes live.</p>
<h2>Confirmed or estimated</h2>
<p>Every conference date has one of three labels:</p>
<ul>
<li><b>Dates confirmed</b>: read on the organiser's page, with the page link, the words on that page and the date Hoggy read it stored with the listing. You can see all three on the conference page.</li>
<li><b>Confirmed, not re-checked</b>: confirmed before Hoggy started storing the page's wording (17 November 2026). The dates stay, and these listings are being re-checked, soonest first.</li>
<li><b>Estimated</b>: the organiser has not published dates yet. Hoggy shows the usual month (for example "Usually May 2027") and the city is marked as an estimate.</li>
</ul>
<p>Today that is ${n(s.confirmed)} confirmed with the source stored, ${n(s.unchecked)} confirmed earlier and being re-checked, and ${n(s.estimated)} estimated, across ${n(s.conferences)} upcoming conferences in ${n(s.countries)} countries.</p>
<h2>The evidence rule</h2>
<p>A listing can only say "Dates confirmed" if it stores the event page it was read from (on the organiser's own site, not a home page or an aggregator), a short quote from that page with the dates, and the date it was read. A listing without all three is shown as an estimate. CPD hours, prices and attendance are shown only when the organiser publishes them; otherwise Hoggy says "check organiser".</p>
<h2>Reviews</h2>
<p>Reviews come from Hoggy users. A review shows "Verified attendee" only when a Hoggy admin has checked a registration receipt or certificate for that meeting. Scores appear once a conference has at least three reviews, and unverified reviews count half.</p>
<h2>Found a mistake?</h2>
<p>Every conference and course page has <b>Report a problem with this listing</b>: choose wrong date, wrong city, duplicate, not relevant or something else, and add a note. Reports go to the admin desk. You can also email ${contactHtml()}.</p>
</article>`;
  return layout(req, { title: 'About Hoggy', description: 'What Hoggy is, where conference and course dates come from, how confirmed and estimated dates differ, and how to report a mistake.', path: '/about', body, current: '/about' });
}

/* ---------- conference and course pages ---------- */
const EV_LABEL = { confirmed: 'Dates confirmed', unchecked: 'Dates confirmed (not re-checked)', estimated: 'Dates estimated' };
function conferencePage(req, c) {
  const ev = HS.dateEvidence(c), past = c.end < todayIso(), src = safeUrl(c.datesSourceUrl), off = safeUrl(c.url);
  const evNote = ev === 'confirmed' ? `Read on the organiser's page on ${esc(D(c.verifiedOn))}${src ? ` (<a class="u" href="${esc(src)}" rel="noopener noreferrer">source page</a>)` : ''}. The page said: “${esc(c.datesQuote)}”`
    : ev === 'unchecked' ? `Confirmed by the organiser before Hoggy stored the page's wording; being re-checked.${c.lastVerified ? ' Last seen ' + esc(D(c.lastVerified)) + '.' : ''}`
      : 'Estimated from earlier editions. Confirm with the organiser before you book.';
  const cpd = c.cpdVerified && c.cpdHours ? `${esc(c.cpdHours)} hours${c.cpdBody ? ' · ' + esc(c.cpdBody) : ''}` : 'Not confirmed — check organiser';
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
<div class="pills"><span class="pill ${ev === 'confirmed' ? 'g' : ev === 'estimated' ? 'w' : ''}">${EV_LABEL[ev]}</span><span class="pill">${esc(c.format)}</span>${c.source === 'organiser-submitted' ? '<span class="pill">Listed by the organiser, checked by Hoggy</span>' : ''}${past ? '<span class="pill">This edition has finished</span>' : ''}</div>
<dl class="facts">
<div class="fact wide"><dt class="k">When</dt><dd class="v">${esc(range(c))}</dd><dd class="note">${evNote}</dd></div>
<div class="fact"><dt class="k">Where</dt><dd class="v">${esc(c.city)}, ${esc(c.country)}</dd>${c.datesConfirmed === false ? '<dd class="note">City is an estimate until the organiser confirms.</dd>' : ''}</div>
<div class="fact"><dt class="k">Organiser</dt><dd class="v">${esc(c.organiser)}</dd></div>
<div class="fact"><dt class="k">CPD</dt><dd class="v">${cpd}</dd></div>
</dl>
<div class="row">${off ? `<a class="btn primary" href="${esc(off)}" rel="noopener noreferrer">Official event page</a>` : ''}<a class="btn" href="/#/conference/${id}">Save or plan a trip in Hoggy</a></div>
<p class="note report-line"><a class="u" href="/#/report/conference/${id}">Report a problem with this listing</a></p>
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
  const desc = `${c.name}${owner.name ? ' — ' + owner.name.split(/[;(]/)[0].trim() : ''}. ${ss.length ? `${ss.length} upcoming session${ss.length === 1 ? '' : 's'}${countries.length ? ' in ' + countries.slice(0, 4).join(', ') : ''}, dates read on the provider's page.` : 'Dates not available yet — check provider.'}${v ? ` Certificate valid ${v.years} years.` : ''}`;
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
${fact('Certificate validity', v ? esc(v.years) + ' years' : 'Check provider', v ? 'As published by the course owner. ' + srcA(v.source, 'Source') : '')}
${fact("Who it's for", c.audience ? esc(c.audience) : 'Check provider')}
${fact('Format', c.format ? esc(c.format) : 'Check provider')}
</dl>
<h2>Upcoming sessions</h2>
${ss.length ? `<p>${ss.length} upcoming session${ss.length === 1 ? '' : 's'}. The next ${Math.min(10, ss.length)}:</p><ul class="sess-plain">${ss.slice(0, 10).map(s => `<li><b>${esc(when(s))}</b> · ${esc(place(s))} · ${esc(s.provider || '')}${safeUrl(s.bookingUrl) ? ` · <a class="u" href="${esc(safeUrl(s.bookingUrl))}" rel="noopener noreferrer">provider page</a>` : ''}</li>`).join('')}</ul>
<p class="note">Dates were read on each provider's own page. Sessions and seats change, so confirm when you book.</p>` : `<p>Dates not available yet — check provider. Hoggy shows only dates it has read on the provider's own page.</p>`}
<div class="row"><a class="btn primary" href="/#/courses/${qid}">Filter sessions and plan a trip in Hoggy</a>${(c.providers || []).filter(p => safeUrl(p.url)).slice(0, 2).map(p => `<a class="btn" href="${esc(safeUrl(p.url))}" rel="noopener noreferrer">${esc(p.name.split(/[(:;]/)[0].trim())}</a>`).join('')}</div>
<p class="note report-line"><a class="u" href="/#/report/course/${qid}">Report a problem with this listing</a></p>
</article>`;
  return layout(req, { title: c.name, description: desc.slice(0, 300), path: '/courses/' + qid, body, current: '/#/courses' });
}

/* ---------- 404 and "trouble connecting" ---------- */
function notFound(req, what) {
  const body = `<section class="doc state-page"><h1>${what ? esc(what) : 'We can’t find that page'}</h1>
<p class="lede">The link may be old, or the page has moved.</p>
<div class="row"><a class="btn primary" href="/#/discover">Find conferences</a><a class="btn" href="/#/courses">Browse courses</a><a class="btn ghost" href="/">Home</a></div></section>`;
  return layout(req, { title: 'Page not found', description: 'This page is not on Hoggy.', path: '/404', body, noindex: true });
}
function trouble(req) {
  const back = String(req.url || '/').replace(/[^\w\/?&=.%#-]/g, '');
  const body = `<section class="doc state-page"><h1>We’re having trouble connecting</h1>
<p class="lede">Try again in a minute. Conference and course listings still work while we sort it out; signing in and saved data will be back shortly.</p>
<div class="row"><a class="btn primary" href="${esc(back)}">Try again</a><a class="btn" href="/#/discover">Browse conferences</a><a class="btn ghost" href="/">Home</a></div></section>`;
  return layout(req, { title: 'Trouble connecting', description: 'Hoggy is having trouble connecting. Try again in a minute.', path: '/', body, noindex: true });
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
  name: 'Hoggy · Medical conferences and courses', short_name: 'Hoggy', description: 'Find medical conferences and courses, plan the trip, keep receipts claim-ready and log CPD.',
  start_url: '/', scope: '/', display: 'standalone', background_color: '#F4EFE6', theme_color: '#F4EFE6', lang: 'en-AU',
  icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }, { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' }]
}, null, 1);

module.exports = { bundle, bundledConfs, privacy, terms, about, conferencePage, coursePage, notFound, trouble, sitemap, robots, manifest, range, CONTACT, originOf };
