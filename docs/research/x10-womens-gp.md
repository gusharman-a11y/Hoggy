# x10 desk "womens-gp": AU/NZ clinical skills courses outside resus (18 Nov 2026)

Scope: obstetrics/neonatal, contraception and sexual health, skin, ultrasound, GP education days, and the other GP and primary care short courses listed in the x10 brief.

## Output

| File | Contents |
|---|---|
| `data/courses/incoming/womens-gp.sessions.json` | **437 upcoming sessions** (AU 430, NZ 7), all `datesConfirmed:true` with `sourceUrl`, verbatim `datesQuote` (≤200 chars), `lastVerified` 2026-11-18 |
| `data/courses/incoming/womens-gp.catalogue.json` | **65 new course types**. Each fact has a source URL and a quote. The build checked every quote against the cached page text and dropped any it could not find. |
| `tools/courses/x10/womens-gp-parsers.js` | Parsers: The Events Calendar REST feed (FSEP), SCCA iMIS event pages, HealthCert calendar, Healthed seminar pages, AIU WooCommerce product pages, SHQ, SHINE SA, SHV (Arlo WP plugin), Rural Health West, ASHM listing cards, SAPMEA |
| `tools/courses/x10/womens-gp-fetch.js` | Polite fetch of every page used, into a cache dir (generic UA, ≥3 s per host, robots.txt honoured; Cloudflare challenges and 403s are skipped, never retried) |
| `tools/courses/x10/womens-gp-build.js` | Builds the two incoming files from the cache (`--cache DIR [--today] [--out] [--with-acrrm]`) |
| `tools/courses/x10/womens-gp-parsers.test.js` + `fixtures/womens-gp-*` | 8 tests, all passing (`node --test tools/courses/x10/womens-gp-parsers.test.js`). Fixtures were cut from the 18 Nov responses, with personal e-mails removed from the FSEP fixture. |

Validation: `node tools/check-courses.js --dir <tmp> --today 2026-11-18` on copies of the main files merged with these incoming files gives **0 errors**. The run also gives 0 errors with `resus.*` merged in as well. No course ids clash with the main catalogue, and no session ids clash. Re-run: `NODE_USE_ENV_PROXY=1 node tools/courses/x10/womens-gp-fetch.js --out DIR && node tools/courses/x10/womens-gp-build.js --cache DIR`.

## Sessions by source (all from the provider's own site)

| Provider (host) | Sessions | Course types | How read |
|---|---|---|---|
| Australian Institute of Ultrasound (www.aiu.edu.au) | 343 | 37 | The WooCommerce Store API (`/wp-json/wc/store/v1/products`) lists the products. Dates and prices come from each product page's booking list ("14 Jan 2027 $ 2,440.00 Book Now"). Venue: AIU, 2 Miami Key, Broadbeach Waters QLD. |
| RANZCOG FSEP (fsep.ranzcog.edu.au) | 23 (19 AU, 4 NZ) | 1 | The Events Calendar REST API behind /events-workshops/. Four sessions marked "internal staff only" or "Metro North Employees only" were left out. The rest carry an `accessNote` (e.g. Ramsay staff + max 5 external midwives). |
| HealthCert Education (www.healthcert.com/workshops/calendar) | 18 | 6 | Calendar page (Brisbane BCEC 13-14 Mar, Sydney Cliftons 10-11 Apr, Melbourne 29-30 May 2027). The aesthetic-medicine workshops were left out (out of scope). |
| Skin Cancer College Australasia (www.skincancercollege.org) | 13 (11 AU, 2 NZ) | 2 (+1 online) | The EventDetail page of each intake. Each session is the face-to-face practical workshop; the online-learning window goes in `sessionNote`. The Certificate of Dermoscopy is online-only, so its 5 intakes are in the catalogue (`onlineIntakes`) and not listed as sessions. |
| Sexual Health Quarters, WA (shq.org.au) | 10 | 4 | Course pages, "Dates Offered" section. Sessions marked "(online)" or with no physical venue were left out. |
| Rural Health West (ruralhealthwest.com.au) | 10 | 6 | Event pages, "Event Details" section (MHST, PEaCHS, TIDE, NeoSTARs, REACT+, EAM). |
| Healthed (www.healthed.com.au) | 9 | 2 | Seminar pages (Women's & Children's Health Update ×5, Medical Update ×4, 2027). |
| SHINE SA (shinesa.org.au) | 6 | 5 | "Course Dates" blocks on the activity pages. |
| SAPMEA, SA (sapmea.asn.au) | 4 | 4 | Event pages. |
| Sexual Health Victoria (www.shvic.org.au) | 1 | 1 | WordPress course page rendered by the Arlo plugin. |

New provider-neutral course ids: `iud-insertion-training`, `iud-insertion-train-the-trainer`, `contraceptive-implant-training`, `srha-national-certificate-doctors`, `sexual-reproductive-health-certificate-nurses`, `cervical-screening-training-nurses`, `pregnancy-options-counselling-training`, `no-scalpel-vasectomy-workshop`, `emet-major-trauma-workshop`, `fsep-full-day`. Providers are separated by `variant` (e.g. `shq-theory-workshop`, `shine-hybrid-doctors`, `healthcert-advanced-workshop`). Provider-specific courses carry a prefix: `aiu-*`, `scca-*`, `healthcert-*`, `healthed-*`, `rhw-*`, `sapmea-*`.

## Things to know before merging

- **ACRRM Advanced Airway, RACM, PHEC and POCUS-RG** are in scope, but the resus desk's incoming files already have them under the same ids (19 sessions). The build leaves them out by default. `--with-acrrm` adds them, using the ACRRM table parser from `tools/courses/acrrm.js` without changing that file.
- **AIU length options:** AIU sells some courses as products of several lengths that start on the same date, e.g. Basic Emergency Medicine Ultrasound (PoCUS) as 3, 4, 5 or 5.5 days. Each length is a separate `variant` (`3-days`, `4-days`, …) with its own price. For multi-day courses the end date is start + length − 1, flagged `endInferred:true` with an `endNote` (consecutive days assumed). Half-day courses ("0.5 day") count as one day. Many AIU courses are emergency or critical-care POCUS. The resus desk might want to review these, but it has no AIU rows.
- **Year inferred (`yearInferred:true`, 5 rows):** these pages print no year.
  - SHV prints "Mon 2 Aug / 4 days", so the year is 2027, the next year in which 2 Aug is a Monday.
  - SAPMEA pages print a date like "Monday, November 23". The year is taken from the weekday, and only when exactly one year in the next 13 months fits. One SAPMEA row (Hip and Knee workshop, "Saturday, June 19") was skipped: its URL stamp `190626` disagrees with the weekday-derived 2027.
- **FSEP:** these are hospital-hosted sessions, and registration is through the host hospital's educator. Personal contact details are not copied. `city` is the suburb or town of the hospital, mapped by hand in `FSEP_PLACE`. An unmapped hospital is skipped with a warning.
- **RHW:** some events show "Expression of Interest" rather than open registration; their rows carry `bookingNote`. The TIDE Perth URL served the Busselton event page, so the duplicate was dropped.
- **Prices:** `priceFrom` is set only where the price appears with the session on the page: AIU, SCCA (fee "AUD / NZD", so NZ rows use NZD), RHW, and SHV theory fee. It is null elsewhere. CPD hours are never put into `cpdHours`. College hours that a page quotes are in `cpdNote` or `cpdByCollege` (SHV RACGP 37 h).
- **Politeness:** www.shvic.org.au asks for `Crawl-delay: 10`. The first 8 course-page requests went out 3 s apart before I saw this. The fetch script now uses an 11 s gap for that host.

## Blocked or skipped hosts

| Host | Reason |
|---|---|
| ranzcog.edu.au (RANZCOG events/courses) | robots.txt: `User-agent: ClaudeBot / anthropic-ai Disallow: /`, so skipped. (fsep.ranzcog.edu.au has its own robots.txt that allows all.) |
| www.racma.edu.au | Cloudflare challenge (403) |
| www.goodfellowunit.org (NZ GP education) | Cloudflare challenge (403) |
| www.dermcoll.edu.au | Cloudflare challenge (403). store.dermcoll.edu.au robots.txt disallows ClaudeBot. |
| www.menopause.org.au | robots.txt disallows us |
| register.shvic.org.au (SHV's Arlo) | robots.txt `Disallow: /`, so the public WordPress course pages were used instead |
| www.racgp.org.au digital events calendar | robots.txt disallows `?lang=`. Without it the listing renders in ar-SA (Hijri dates), so it was not used as a date source. The RACGP Faculty Events list (`/education/courses/racgpevents`) was read: nearly all of it is online, plus GP ALS2 (resus desk). |
| www.asccp.org.au | fetch failed (no connection) |
| www.rdaa.com.au/…/Events.aspx, www.miga.com.au/events | 404 |
| mdanational.com.au events, blackdoginstitute.org.au education, pepaeducation.com "find a workshop" | rendered by JavaScript; no dates in the HTML or WordPress API |

## Leads (checked, not added)

- **ACSEP** MOST course and MSK Ultrasound Workshop: the pages say "2027 COURSE DATES COMING SOON".
- **NeoResus**: hospital-delivered, no public dates. Facilitator workshops are by EOI.
- **PROMPT**: WA Country Health sessions on TryBooking are for WA Health staff only. The Rural Health West PROMPT pages are past events.
- **Family Planning Australia** (intheknow.org.au: IUD, implant, SRHA certificate): AUSLARC-funded, no public dates. It is listed as a provider in the catalogue.
- **Sexual Wellbeing Aotearoa** (NZ): 23 course pages, all online or self-paced, or "No upcoming courses".
- **ASHM**: one in-person HIV s100 Prescriber Course (Brisbane 21-22 Nov 2026, registrations closed). Everything else is live-online.
- **The Women's** (thewomens.org.au): NBO workshops (2026, past). Shared maternity care workshops have no dated rows.
- **True Relationships & Reproductive Health QLD**, **SHFPACT**: no dated clinician sessions in the HTML.
- **Melanoma Institute Australia** (Tribe API read): GP dermoscopy workshops are 2026 (past); the 2027 items are conferences.
- **Monash Travel Medicine Masterclass**: 2027 date TBC. No ISTM or Travel Medicine Alliance AU/NZ course pages with dates were found.
- **RACGP online courses with dated cohorts** (FPS Skills Training, CBT and IPT Skills for GPs): candidates for the catalogue as "online, dated intakes".
- **HealthCert aesthetic medicine workshops** (6 sessions): left out of scope.
- **Teaching on the Run**, **RACP**, **RDAA**, **Avant** (online, members only), **MIGA**, **MDA National**: no public dated face-to-face sessions found this run.
- **PHN education calendars** (e.g. SAPMEA is part-PHN-funded; NWMPHN and WNSW PHN list third-party events): only provider-published events should be added. These were not worked through.
