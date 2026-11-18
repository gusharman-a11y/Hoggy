# x10 desk "intl": UK and international courses (18 Nov 2026)

Files:
- `data/courses/incoming/intl.sessions.json`: 2,072 upcoming sessions. Every source was read on 18 Nov 2026.
- `data/courses/incoming/intl.catalogue.json`: 39 new course types. No existing id was changed or reused for a different body.
- Parsers in `tools/courses/x10/`:
  - `intl-rcuk.js`
  - `intl-erc.js`
  - `intl-rcseng.js`
  - `intl-rcsed.js`
  - runner `intl-run.js`

Rerun:

```
node tools/courses/x10/intl-run.js --today YYYY-MM-DD [--save DIR] [--from DIR] [--only rcuk,erc,rcseng,rcsed]
```

A full live run is about 150 requests and takes about 9 minutes, mostly the RCUK pager at 3 s a request. Behind the cloud proxy it needs `NODE_USE_ENV_PROXY=1`.

All fetching uses the rules in `tools/courses/http.js`: generic UA, robots.txt honoured for `*` and Claude/Anthropic names, at least 3 s per host, https only, and challenges/403s never worked around. CoSy needs a form POST, so `intl-erc.js` has a small client with the same rules and a cookie jar.

## Counts

| Source (owner's own site) | Sessions | Course ids | Countries |
|---|---|---|---|
| Resuscitation Council UK, www.resus.org.uk course pages | 530 | rcuk-als (full 40, e-ALS 215, recertification 46, short recertification 3), rcuk-epals 94, rcuk-nls 70, rcuk-ilsi 36, rcuk-oh-als 18, rcuk-oh-nls 5, rcuk-arni 2, rcuk-feel 1 | GB (99 course centres) |
| European Resuscitation Council, cosy.erc.edu calendar | 1,293 | erc-als 515 (172 recert), erc-epals 295 (64 recert), erc-nls 159, erc-ils 161 (23 recert), erc-etc 59, erc-gic 55, erc-epils 49 | 41 countries: DE 316, NL 205, BE 145, CH 105, FR 85, PL 55, LU 50, IS 50, AT 40, CZ 36, GB 16, and others incl. AE, IE, EG, LK |
| RCS England, www.rcseng.ac.uk | 213 | atls 100 (62 provider, 22 reverification, 15 instructor, 1 virtual), bss 40, ccrisp 30, rcseng-ssshp 23, rcseng-pert 5, rcseng-cslap 4, rcseng-islap 3, atnc 3, dsts 2, rcseng-sset 2, rcseng-step-up 1 | GB 206, IN 6, BH 1 |
| RCSEd, services.rcsed.ac.uk | 36 | bss 13, atls 4, and 15 RCSEd course types with 1–4 sessions each (NOTSS, HEST, Hugo robotic, head & neck, hand, otology, BAETS, DeVISER, etc.) | GB, AE 1 (Ajman), online 5 |

Of the ERC rows, 95 are taught in English. All ERC rows carry `languages`; filter on it if the app should show English-only.

## Sources and method

### RCUK (`intl-rcuk.js`)
- Each course page embeds the Drupal view `course_availability`. It has the columns Course centre town, Course centre, Start date, Organiser and Availability. There are 5 rows a page, paged with `?page=N`, and `sourceUrl` is that exact page.
- **Only a start date is printed.** For the 2-day courses (ALS, OH-ALS, ARNI, EPALS), end = start + 1, with `endInferred:true` and an `endNote` quoting the page's length sentence. This assumes consecutive days.
- `seatsStatus` comes from "Candidates: places available / course full".
- Organiser names, phones and e-mails are **not copied**. `bookingUrl` is the RCUK course page.
- `country` is GB for every row. RCUK lists the town only, so `region` is "UK"; nation-level mapping was not attempted.
- These RCUK courses have only an undated list of centres (`non_dated_course_availability`), so no sessions: ILS, ILS recert, PILS, PILS recert, EPILS, GIC, BLS instructor. NLS recertification and ALS modular had 0 dated rows today.
- Catalogue facts are quoted from the course pages: audience, length, "valid for four years", and "Course fees are decided locally by the Course Centre…". The ALS page also says: "Our ALS qualification is recognised by the European Resuscitation Council and the Australian Resuscitation Council". That is relevant for AU doctors; see `recognition` on `rcuk-als`.

### ERC CoSy (`intl-erc.js`)
- The public calendar at `/en/sessions/calendar` is a search form and needs no login.
- Flow: GET the list view (session cookie plus CSRF), POST the form (`courseKind[]`, `dateFrom` = today), then GET `/view-mode/list`. The 302 goes to the paged tiles view, so the list view is requested explicitly.
- One response lists every match worldwide: 1,800 full courses and 592 recertification modules. Searched once per kind, so `variant` is `full` or `recertification`.
- Each session lists every course day with times, so start and end are exact (`endInferred:false`). Each row also has the venue with a country flag, languages, "Places still available X out of Y", and prices in the local currency.
- Kept: ALS, ILS, EPALS, EPILS, NLS, ETC, GIC.
- Not kept:
  - BLS/PBLS and BLS intro (basic/lay courses)
  - BIC, EID, EMC, refresher seminars and YERC (instructor days)
  - instructor-recertification kind
  - 2 sessions that say they are internal
  - 2 modular courses spread over more than 14 days
- There is no public per-session page, so `sourceUrl` is the list view and `sourceRef` is `erc-cosy:<id>`. `bookingUrl` is CoSy "Enroll online" (free CoSy login) or the CoSy "Contact organiser" form.
- `provider` is generic ("ERC course organiser (CoSy)"). CoSy shows the organiser only inside free-text notes, which hold personal contacts, so they are not copied.
- `city` is taken from the venue's postcode line. It is mostly clean; a few are in the local script (Київ, Θεσσαλονίκη) and there is one "Praha 5".
- ERC course facts (validity, audience) were **not** read from erc.edu. The 7 erc-* catalogue entries are `verified:false` with no facts.

### RCS England (`intl-rcseng.js`)
- The course list comes from the site's own JSON at `/api/coursesapi/getcourses/?Surgical=True&Dental=False&Page=N`, which lists 43 courses. robots.txt disallows only `/sitecore/ /static/ /upload/ /temp/`.
- Each course page has a `bookingRow` per session with exact start–end dates, full price (GBP), location and address, and Limited or Fully booked.
- Rows are split into two tabs, "Approved regional courses" and "Royal College Of Surgeons courses", which map to `provider`. RCS says regional places can't be booked on its site, so `bookingUrl` is the course page with a note.
- Not kept: Educational supervisor toolkit, Excellence in Surgical Supervision, MRCS Part B revision toolkit and PBAS virtual. These are not clinical-skills courses.
- `atls` is a **new id**. RCS England says "The Royal College of Surgeons is proud to be the exclusive provider of ATLS® in the UK", quoted in the catalogue. `emst` (RACS, AU/NZ) is left as is and linked via `relatedCourses`.

### RCSEd (`intl-rcsed.js`)
- The listing `/events-courses/rcsed-courses-and-events?page=N` is 1-based and has 69 items. Course pages list "View locations and dates" with **start dates only**.
- End = start + (length stated in the page's own overview − 1), with `endInferred` and a quote. Examples: "This 2.5 day…", rounded up to 3 days; "This two day course…"; "five-day".
- Pages stating no length are skipped; no end is invented. That happened 0 times among the kept courses.
- `cpdHours` is filled only where the page says "Is CPD awarded for this course? Yes, N Hours", with `cpdSource` set to the page.
- robots.txt disallows `/events-courses/event-entry`, which is not used. Booking links on web.rcsed.ac.uk carry session tokens, so `bookingUrl` is the course page.
- Not kept: QI symposium, safety summit, dental leadership, dental diploma prep, surgical leadership, Future Surgeons, MRCS OSCE prep, Training the Trainers, COSMOS and True Cut.

## Field notes (same shapes as `data/courses/sessions.json`, plus optional fields)
- Optional fields added:
  - `languages` (ERC)
  - `placesTotal` (ERC)
  - `availabilityText`
  - `endNote`
  - `courseTitle` (RCS)
  - `sessionTitle` (ERC custom titles)
  - `online` (RCSEd)
- `currency` is the source currency: GBP, EUR, CHF, PLN, ISK, CZK, etc. **No conversion** is done.
- `region`: "UK" for GB rows. For ERC it is the ISO country code, as no sub-national region is given. For RCS England India rows it is the state where printed.

## Checker changes needed (tools/check-courses.js was not edited)
`node tools/check-courses.js` would fail on these files for three reasons. I validated with a local copy that changes only these lines, and it passed: 0 errors on main catalogue + intl catalogue and the intl sessions.
1. `if (s.country && !['AU', 'NZ'].includes(s.country))` should accept any ISO 3166-1 alpha-2 code, e.g. `!/^[A-Z]{2}$/.test(s.country)`. Intl uses GB, IE, AE, IN, BH, DE, NL, BE, CH, FR, PL, LU, IS, AT, CZ, RS, ES, GR, PT, DK, SE, HU, IT, HR, UA, CY, EG, RO, LK, SI, BA, UG, SY, BG, MT, FI, AW, VN, TN, TR, MK, XK, PE.
2. `if (!['AUD', 'NZD', 'USD'].includes(s.currency))` should accept any ISO 4217 code, e.g. `/^[A-Z]{3}$/`. Intl uses GBP, EUR, CHF, PLN, ISK, CZK, DKK, SEK, HUF, UAH, EGP, LKR, UGX, AED, TRY, RON, RSD.
3. The duplicate-session key should include `variant`: `[s.courseId, s.variant || '', s.provider, s.city, s.start, s.end, s.venue || '']`. RCUK centres often list e-ALS and ALS recertification on the same day (23 such pairs). These are different courses and both are kept.

## Blocked, skipped, or not found

| Host / source | Result |
|---|---|
| www.alsg.org (APLS UK, MOET, POPS, STaR, HMIMMS, PEMLS) | **robots.txt `User-agent: ClaudeBot / Disallow: /`**. Skipped; no ALSG sessions. |
| www.rcoa.ac.uk/events | Cloudflare challenge (403). Skipped. |
| www.facs.org ATLS course calendar | The page loads its data from `/umbraco/surface/coursesearch/search`, but robots.txt has `Disallow: /umbraco/`. One test request went out before I had read the robots result; the response was discarded and nothing from it is used. Not used. |
| RCSI (www.rcsi.com) | No public dated course list found (`/surgery/training/courses` 404; sitemap has no course pages). Lead only. |
| RCOG, RCPCH, PROMPT (promptmaternity.org), Hamad (hamad.qa) | The course URLs I tried returned 404. No course calendar found this run. |
| www.hkcem.com, www.atacc.co.uk | No connection (curl 000). |
| SingHealth Academy | Home page reachable; no public dated course calendar found. |
| RCEM events calendar | Conferences and webinars only (conference desk's scope), so no courses taken. |
| ESICM courses | About 10 courses with dates, mostly online/hybrid. Not added this run. They are easy to add as a lead. |
| AHA | Not attempted (Cloudflare per brief). |

## Caveats for review
- RCUK and RCSEd multi-day end dates are inferred (176 rows `endInferred:true`). Everything else gives exact ranges.
- RCUK rows assume GB. RCUK lists centres by town only, and no non-UK town was seen today.
- Most ERC rows are non-English-language courses in continental Europe. They are genuine, but the app may want to filter by `languages` or country for AU users.
- Validity: RCUK certificates are valid four years, quoted per course. ATLS reverification suitability says "taken the ATLS® course within the last four and a half years". This is kept as audience text, not as `certificateValidityYears`.
