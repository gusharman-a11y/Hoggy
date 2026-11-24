# x10 desk "resus": AU/NZ resuscitation, emergency, critical care, anaesthesia, airway, retrieval, wilderness (18 Nov 2026)

Output files (nothing else in the repo was changed):
- `data/courses/incoming/resus.sessions.json`: **294 new upcoming sessions** (19 Nov 2026 to 12 Jun 2028) plus **77 `updates`** for sessions already in `data/courses/sessions.json`.
- `data/courses/incoming/resus.catalogue.json`: **23 new course types**. Existing ids (`als1`, `als2`, `nzrc-core-advanced`, `nzrc-core-immediate`) only get sessions.
- Parsers: `tools/courses/x10/resus-*.js`. Runner: `node tools/courses/x10/resus-run.js [--today D] [--from DIR] [--dry]`. Tests: `node --test tools/courses/x10/resus.test.js` (7 pass, fixtures in `tools/courses/x10/fixtures/resus/`).
- Validation: a temp copy (main catalogue + sessions with my incoming files appended) passed `node tools/check-courses.js --dir <copy> --today 2026-11-18`: 34 courses, 873 sessions, **0 errors**. The 3 warnings are rows already in the main file that finished on 17 Nov.

Rules followed: https only. robots.txt was read for every host. There were at least 3 s between requests to the same host, with the generic UA from `tools/courses/http.js`. No Cloudflare, CAPTCHA, 403 or robots.txt block was bypassed. Dates come only from the provider's own page or its own booking platform (Arlo, or an Eventbrite link published on the provider's page), read today. Every session has `sourceUrl`, `datesQuote`, `lastVerified: 2026-11-18`, `datesConfirmed: true` and `sourceKind`. A stable `sourceRef` is set where the source has one (Arlo EventID, ACCCN event, PRIME booking id, ACRRM event id). Every catalogue quote was checked by a script against the page text, with whitespace collapsed, and the build fails if a quote is not found.

## Sessions by source

| Source (own page / platform) | New sessions | Courses |
|---|---|---|
| Emcare Services (NZ), Arlo API `emcareservicesltd.arlo.co` | 91 | NZRC CORE Advanced 23, ACLS6 (`nz-acls`) 34, PACLS 34 |
| St John NZ PRIME calendar `prime.stjohn.org.nz/calendar/` | 68 | PRIME 5-day initial 23, 1-day refresher 45 |
| Resuscitation Matters (Christchurch), Arlo API | 38 | CORE Advanced 5, Immediate 21, ACLS 12 |
| ACCCN `acccn.com.au/events/courses/` | 30 | Adult ALS 14, Paediatric ALS 4, ALS Instructor 12 |
| ACRRM course pages (advanced-airway, racm, phec, POCUS-RG) | 19 | 5 / 4 / 3 / 7 |
| Medical Training Solutions WA, Arlo API | 14 new (+51 updates) | PALS 9, 12-lead ECG 4, ALS2 recert 1 |
| UWA CTEC workshop pages | 13 | 6 emergency/airway/critical-care workshops |
| Advanced Resuscitation Training (SA/QLD), Arlo API | 12 new (+26 updates) | Paediatric ALS 1 5, BLS Instructor 5, ALS1 (ARC) 2 |
| RescueMED course pages | 6 | Wilderness Rescue Medicine 4, AWLS 2 (AU + NZ) |
| SPUMS approved-courses page | 3 | ANZHMG Intro Diving & Hyperbaric Medicine 1, RAN MOUM 2 |

By country: NZ 198, AU 96.

### `updates` (ARC rows already held)
MTS and ART publish their ARC ALS1/ALS2 sessions on their own Arlo platforms. 77 of those match a row we already hold from the ARC page (same course, start date, state and provider), so they are **not** added again. Each one goes into `updates[]` with: the held `id`, `priceFrom`/`currency` (Arlo's lowest advertised offer, tax inclusive, e.g. ALS1 $695/$730, ALS2 $1,795/$1,900, recert $1,110/$1,195), `seatsStatus`, `placesRemaining`, `providerBookingUrl`, and the evidence (`sourceUrl`, `datesQuote`, `sourceRef`, `lastVerified`). The merge step can apply these fields to the held rows. Three ARC-labelled events were **not** on the ARC page and were added as new rows: ART ALS1 Townsville 28 Aug 2027, ART ALS1 Adelaide 3 Sep 2027, and MTS ALS2 recert 27 Nov 2027.

## New course types (catalogue)
`nz-prime`, `nz-acls`, `pacls`, `acccn-adult-als`, `acccn-paediatric-als`, `acccn-als-instructor`, `paediatric-als` (provider one-day PALS from MTS/ART; not APLS, AHA PALS or ACCCN), `bls-instructor`, `ecg-12-lead`, `acrrm-advanced-airway`, `acrrm-racm`, `acrrm-phec`, `acrrm-pocus-rg`, `ctec-jdocs-emergency-airways`, `ctec-jdocs-emergency-procedures`, `ctec-critical-care-procedures`, `ctec-emergency-department-procedures`, `ctec-cutting-edge-emergency-procedures`, `ctec-cutting-edge-practical-ed-skills`, `wilderness-rescue-medicine`, `awls`, `diving-hyperbaric-intro`, `ran-moum`.
- Fees are recorded only where printed: ACCCN rate card, ACRRM rows, CTEC 2027 fees, RescueMED, SPUMS.
- CPD is never put into `cpdHours`. ACRRM CPD hours go in `cpdByCollege` with the page's quote. CTEC and RescueMED say "2026 approval, reapproval sought for 2027", so that is recorded in `cpdNote` + `cpdEvidence` only.
- No certificate validity is recorded for any new type. ACCCN recommends *annual* recertification, which is recorded as `recertification` with its quote, not as validity.

## Judgement calls (please review)
- **Resuscitation Matters "Immediate Resuscitation Course"** is mapped to `nzrc-core-immediate`. The page says "Immediate Adult and Child" but does not name NZRC, so each row carries a `note` saying so. Their "Advanced Resuscitation Course" summary does say "NZRC CORE Advanced".
- **ART "ALS 1 (RA)" / "ALS 2 (RA)"** (24 events, $550 / $1,495, "mixed modality") were **skipped**. I could not confirm what "RA" means or what certificate it gives, because alstraining.com.au gave an HTTP/2 protocol error to both Node and curl. They become a lead.
- **ACRRM RACM / PHEC**: the rows give one date and the pages print no length. End = start with `endInferred:true` and an `endNote` (RACM page: "the hands-on workshop day").
- **ACCCN city** comes from the venue on the tile (Aeromedical Welshpool → Welshpool; Women's and Children's Hospital → North Adelaide; ANMF → Melbourne; Calvary Bruce → Bruce, **ACT**, even though it is listed under the NSW branch). Rows carry `cityNote`. ACCCN's rate card prints "Non-Member Rate Before 31/12/2027 / After 1/1/2027". This is noted in `feeNote` as probably meaning 31/12/2026.
- **SPUMS page** is the course approver's page, not the providers'. The ANZHMG (Fremantle) and RAN MOUM (HMAS Penguin) dates come from it, and `sourceKind` says so. Booking is by e-mail.
- **PRIME**: rows with 5 consecutive days are the initial course and single-day rows are the refresher, as the page describes. Bookings favour practices that hold a PRIME contract (`sessionNote`).
- **CTEC** "Register interest" rows have `seatsStatus` null and book via the workshop page. "Book now" rows link to the Eventbrite event that CTEC itself publishes.
- Not added as out of scope (procedural or basic): MTS PIV cannulation, wound closure; Emcare BLS, BLS & AED, dental DMCC4, first aid; Resuscitation Matters suturing, IV, sedation, vaccinator, workplace courses; CICM Management Skills Course (non-clinical).

## Blocked / skipped hosts

| Host | Result |
|---|---|
| parasol.arlo.co (Parasol EMT, advancedlifesupport.com.au) | robots.txt `Disallow: /`. Skipped. Their PALS1/PHTLS dates are only in that Arlo widget. Their ARC rows are already on the ARC page. |
| book.tripleonecare.nz | Event search is via `/ajax/`, which robots.txt disallows. Skipped. |
| www.etmcourse.com, etmcourse.com (ETM course dates) | Cloudflare challenge (403). Skipped. |
| aci.health.nsw.gov.au (NSW ITIM trauma courses) | Cloudflare challenge (403). Skipped. |
| www.otago.ac.nz (rural simulation courses, Trauma RiSC) | Cloudflare challenge. Skipped. |
| www.cena.org.au (TNCC/ENPC) | robots.txt disallows. Skipped. |
| www.surgeons.org (EMST/ATLS, CCrISP, DSTC via RACS) | Not retried. Blocked by Cloudflare per the 17 Nov run (`docs/research/courses.md`). |
| alstraining.com.au | HTTP/2 protocol error (network-level, not a bot wall). Arlo feed used instead. |
| members.anzca.edu.au EMAC event list | Client-side (JS) list. No dates in the HTML. |
| events.cicm.org.au | Read fine, but no upcoming BASIC/clinical courses (last BASIC was 5–6 Nov 2026; 2027 not yet posted). |
| shortcourses.auckland.ac.nz (Auckland SCPS EMAC/ACLS) | auckland-scps.arlo.co redirects to the university catalogue. The EMAC course pages now 404. |
| acecc.org.au (ACE: ANZCA/ASA/NZSA events) | Readable, but it is a submitted-events listing, so used as leads only. Its API returned only 5 upcoming events. |

## Leads for later (not added)
- **ETM** (etmcourse.com, Cloudflare). The Monash Health ETM facilitator flyer lists 2026 dates only.
- **EMAC**: Wellington Simulation Centre (lilregie.com pages per course; no 2027 page found), Auckland SCPS, ANZCA's event list (JS). Retry when 2027 dates are posted.
- **BASIC ICU**: CICM event hub (2027 not posted), Humanitix pages for Frankston and Nepean (all past), SCGH (contact only), St Vincent's Melbourne (2026 page). A CUHK BASIC registry lists 2027 AU dates (Albury, St Vincent's, Northern), but it is an aggregator, so not used.
- **POCUS**: EMUGs POCUS Fundamentals (Humanitix, 2026 only), Alfred Health POCUS/Ultrasound Core courses (no 2027 events), ASUM (no course list found), Rural Health West RUSTED 2027 (dates not yet published).
- **Airway**: GASP Gold Coast (Humanitix, last event 2025), Monash TRAC (2026 PDF), Brisbane Airway Management Course (2018 page).
- ART "ALS (RA)" variants (see above). Parasol PALS1/PHTLS (robots). Triple One Care CORE courses (robots on the search; individual `event?id=` pages are allowed and are linked from NZDA rows).
- World Extreme Medicine Blue Mountains course (2026 page gone, 404). The University of Tasmania extreme-medicine unit is a semester unit, not a short course.
- APLS NZ: nothing found. The APLS Arlo feed has no NZ events.

## Daily refresh
`node tools/courses/x10/resus-run.js` reads 21 pages (plus robots.txt per host) politely, about 2 minutes. It rewrites only `data/courses/incoming/resus.sessions.json` (new rows not already held, plus `updates`). `--from DIR` replays saved pages offline (`DIR/index.json` maps URL to file). The catalogue file is hand-built: each new course type needs its quotes added there before its sessions can merge.
