# Courses dataset: Australia and New Zealand (first pass and first refresh, 17 Nov 2026)

Files: `data/courses/catalogue.json` (11 course types), `data/courses/sessions.json` (579 upcoming sessions), `data/courses/removed-log.json` (sessions the refresh dropped), checker `node tools/check-courses.js` (0 errors, exits 1 on any problem), refresh `node tools/refresh-courses.js` (B48, see "Refresh tool" below). Latest refresh report: `docs/research/course-refresh-2026-11-17.md`.

## Counts (sessions starting 17 Nov 2026 or later)

| Course | AU | NZ | Source |
|---|---|---|---|
| APLS (3-day + 2-day refresher) | 77 (all 8 states/territories) | 0 | APLS Australia Arlo feed |
| ALS1 | 258 (all except NT) | 0 | ARC course-dates page |
| ALS2 (incl. 1-day recert + ACRRM one-day) | 201 (all 8; NT only via ACRRM) | 0 | ARC page + ACRRM page |
| NZRC CORE Advanced (NZ equivalent of ALS2) | n/a | 2 (Auckland, Lower Hutt) | provider events on NZDA |
| NZRC CORE Immediate (NZ equivalent of ALS1) | n/a | 2 (Auckland, Richmond/Nelson) | provider events on NZDA |
| ACRRM Rural Emergency Skills Training (REST) (new) | 19 (all 8) | 0 | acrrm.org.au/courses/face-to-face/rest |
| ACRRM Paediatric Emergencies for Rural Generalists (new) | 9 (NSW, NT, QLD, VIC, WA) | 0 | acrrm.org.au/…/paediatric-emergencies-for-rural-generalists |
| ACRRM Advanced Neonatal Resuscitation (ANR) (new) | 4 (NSW, QLD, TAS) | 0 | acrrm.org.au/…/advanced-neonatal-resuscitation |
| ACRRM Rural Emergency Obstetrics Training (REOT) (new) | 7 (NSW, QLD, SA, TAS, WA) | 0 | acrrm.org.au/…/reot |
| EMST | 0 | 0 | RACS blocked (Cloudflare) |
| PALS (AHA) | 0 | 0 | AHA blocked (Cloudflare); Medcast robots.txt disallows Anthropic agents |

## Per provider

### APLS Australia (www.apls.org.au)
- Sessions: the calendar page `https://www.apls.org.au/courses/calendar` renders client-side with Arlo JS controls. The data comes from the provider's own Arlo platform, through its **public JSON API**:
  `https://apls.arlo.co/api/2012-02-01/pub/resources/eventsearch/?fields=EventID,EventTemplateID,Name,Code,StartDateTime,EndDateTime,Location,IsFull,PlacesRemaining,AdvertisedOffers,RegistrationInfo,ViewUri,Summary&top=200`
  It returns exact start/end datetimes, venue with state/postcode, `IsFull`, `PlacesRemaining`, prices (`AdvertisedOffers`) and register links (`apls.arlo.co/register…` or `/waiting-list…`). Templates are listed at `/pub/resources/eventtemplates/`. No ICS was needed. apls.arlo.co has no robots.txt (404); the robots.txt on apls.org.au disallows only previews.
- Facts read: certificate valid five years (FAQ), entry needs two years of clinical experience, three days face-to-face plus 10+ hours pre-course work, fees "Doctors $3300 Nurse/Paramedic $1920" (course text), and refresher eligibility (full APLS within 5 years and clinically current).
- **Discrepancy:** every 2027 event advertises a $2,120 discounted offer, not $1,920. Session `priceFrom` uses the event's own lowest offer, with a note.
- **City caveat:** session city comes from the event name. The Arlo venue city sometimes differs (e.g. "APLS - Launceston" has venue city Hobart; "Albany" has Perth). The venue string is kept as given.
- No NZ events in the feed. I did not identify an APLS NZ host, so NZ APLS is a gap.
- Not added yet: PLS (one-day Paediatric Life Support) and GIC. Their templates are in the same Arlo account (PLS templates 34/37/40), but on 17 Nov 2026 the event feed had no PLS or GIC events.

### Australian Resuscitation Council (www.resus.org.au): ALS1 / ALS2
- `…/advanced-life-support-courses/course-dates` is one static HTML page with an accordion per state. Each row is a `<tr>` with date, course title (linked to booking), Starts/Ends/Location, course centre, contact and booking link. There is no feed, ICS or JSON-LD. Parsed: 482 rows, 440 upcoming.
- Row formats vary. About 340 rows give only a start date. For those, `end` is derived from the length printed in the title ("1-Day Course", "2-Day Course", "1-Day Recertification") or from the ARC course pages (ALS1 one-day, ALS2 two-day), and the row is flagged `endInferred:true`.
- Booking links: Outlook "safelinks" wrappers were unwrapped (flagged `bookingUrlNote`). For 79 rows with no https booking link, `bookingUrl` falls back to the ARC page.
- Course centres are listed by the course owner (ARC). Rows are recorded with `provider` = course centre and `sourceUrl` = ARC page. 34 centres are covered, the largest being Parasol EMT, Code Blue Medical, Medical Training Solutions, Advanced Resuscitation Training and NALHN.
- Facts read: certificates recognised four years; recertification rules; ALS1 one-day, ALS2 two-day; audiences; CPD page (RACP 9 h / 18 h, RACGP pre-approved, ANZCA code to 30 Jun 2027, CICM to 14 Jun 2027). Fees are set by centres (TPCH example: $750 / $1,500 for non-Metro North staff).
- NT: no upcoming ARC rows (only past ones). The one NT ALS2 session is ACRRM's.
- Not parsed: one past Victorian row with an unusual date cell. The parser also accepts the page's "Course Cemtre" typo (Geelong row).

### ACRRM (www.acrrm.org.au/courses/face-to-face/als)
- HTML table: date, course, venue/city, state, **CPD Hours (15)**, Member/Non Member fee (1810.00 / 1995.00), available spaces, Register/Waitlist. Booking goes to `mycollege.acrrm.org.au/search/find-college-event/details?ID=…` (links taken in row order). That gives 19 sessions, stored as `courseId als2` with `variant acrrm-one-day`.
- Uncertain: ACRRM says its course "meet[s] and exceed[s] the standard set by the Australian Resuscitation Council". It is not on the ARC list, so ARC co-badging is unconfirmed.

### NZRC CORE (NZ)
- `www.nzrc.org.nz` returns 302 to `www.resus.org.nz`. **The proxy refuses resus.org.nz**: a retry after more than a minute was still refused. So NZRC's own pages (course finder, validity) were not read.
- Sessions come from **NZDA course-portal events** (`www.nzda.org.nz/education/courses-events/<slug>`), posted by the delivering providers (Triple One Care, Emcare Services, Resus Nelson) through NZDA's course-provider login. Enrolment links go to the provider (e.g. book.tripleonecare.nz). The audience is mainly dental teams. Rows carry `sourceKind` saying so. Treat them as provider-posted, but they are close to a listing site: review whether this counts as "provider's own page".
- NZDA "ALS Immediate" (an NZDA 4-hour course, not NZRC) and "Advanced Resuscitation (ACLS)" events were seen and **not** added.
- Search: `search-events?title=core` (and `title=resuscitation`). No feed was found.

### RACS (www.surgeons.org): EMST
- **Blocked:** HTTP 403 with `cf-mitigated: challenge` (a Cloudflare challenge from the site itself, not the proxy). It was skipped and not bypassed.
- The rename to ATLS is **not confirmed**. The name stays "Early Management of Severe Trauma (EMST)", with a `renameNote`.

### PALS (American Heart Association)
- `international.heart.org` gives a Cloudflare 403, so it was skipped.
- `medcast.com.au`'s robots.txt has `User-agent: ClaudeBot / anthropic-ai … Disallow: /`, so it was skipped as required.
- No AU/NZ AHA training-centre page was reachable, so there are no PALS sessions.

### ACRRM emergency courses (added 17 Nov 2026)
- ACRRM's face-to-face course pages all use the same table as the ALS page (Dates, Course, Location, State, CPD Hours, Member/Non Member fee, Available Spaces, Register/Waitlist). Each Register/Waitlist button links to `mycollege.acrrm.org.au/…details?ID=<n>`. That ID is stored as `sourceRef` (`acrrm:<n>`), so a moved date keeps the session id. The same rows also appear on `/courses/face-to-face/upcoming-face-to-face-courses` (79 rows, all ACRRM courses). The refresh reads the per-course pages so that `sourceUrl` is the course's own page.
- Added: **REST** (`acrrm-rest`), **Paediatric Emergencies for Rural Generalists** (`acrrm-paediatric-emergencies`), **Advanced Neonatal Resuscitation** (`acrrm-anr`) and **REOT** (`acrrm-reot`). Each has audience/format quotes, fee range, ACRRM CPD hours (session rows and `cpdByCollege`) and `verified:true`. None states a certificate validity period, so expiry stays user-entered.
- End dates: REST rows give only the first day, but the page says "two hands-on workshop days" and "present for the entire duration of the REST course over both days". So end = start + 1, flagged `endInferred:true` with an `endNote`. Paediatric Emergencies rows print the range in the title ("Perth 27-28 Jan 2027"), and the end is read from the title (not inferred). ANR and REOT are one-day workshops.
- The Paediatric Emergencies page says it "meets Australian Resuscitation Council standards for Paediatric Advanced Life Support (PALS)… gaining a… PALS qualification in line with ANZCOR guidelines". It is kept as its own course with a `qualificationNote`. It is **not** filed under `pals`, which is the American Heart Association PALS, still blocked.
- Seen on ACRRM but not added (they are not resuscitation/life-support courses of the kind asked for): Advanced Airway, Rural Anaesthetic Crisis Management (RACM), Pre-Hospital Emergency Care (PHEC), Point of Care Ultrasound for Rural Generalists, Emergency Week (a bundle) and HEART (online). Adding one is a line in `COURSES` in `tools/courses/acrrm.js` plus a catalogue entry.
- ACRRM's robots.txt blocks only SEO crawlers (Semrush, Ryte). ACRRM does not list **RESUS4KIDS** or **ALSO**.

## Still blocked or needed

| Host | Status |
|---|---|
| www.surgeons.org | Cloudflare challenge (site), skip. Re-checked 17 Nov 2026 on the CCrISP page: HTTP 403, `cf-mitigated: challenge` |
| international.heart.org | Cloudflare 403 (site), skip |
| medcast.com.au | robots.txt disallows Anthropic agents, skip |
| www.resus.org.nz | refused by session proxy (needs allowlisting); www.nzrc.org.nz only 302-redirects there |
| www.acccn.com.au | not on allowlist; owner of the ACCCN Adult and Paediatric ALS programmes (see below) |
| provider booking sites (advancedlifesupport.com.au, medicaltrainingsolutions.com.au, alstraining.com.au, tripleonecare.nz, emcare.co.nz, resusnelson.nz, etc.) | not on allowlist; not needed for dates, but needed for per-session prices and seats on ARC and NZDA rows |
| AU/NZ AHA PALS training centres | hosts not yet identified |

## Refresh tool (B48): `tools/refresh-courses.js`

```
node tools/refresh-courses.js            # read all sources, write sessions.json + removed-log.json + docs/research/course-refresh-<date>.md
node tools/refresh-courses.js --dry      # print the report (diff) only; writes nothing
  --today YYYY-MM-DD   pretend date (tests)     --quiet   no per-request log on stderr
  --save DIR           keep every raw response (DIR/index.json maps URL -> file), for audits and new fixtures
  --from DIR           replay a --save DIR offline (no network)
exit 0 = ok (or dry run ok) · 1 = check-courses failed on the result, nothing written · 2 = every source failed, nothing written
```

- **Parsers** are small modules in `tools/courses/`: `arlo.js` (APLS JSON API, pages with `&skip=` past 200), `arc.js` (ARC course-dates HTML, all row layouts, `endInferred` rules as in the first pass), `acrrm.js` (per-course tables; course list in `COURSES`), `nzda.js` (title search `core` → event pages → date/venue/region/provider/enrol link). `util.js` has the date parser and the booking-link cleaner (unwraps Outlook safelinks, drops `gclid`/`gad_*`/`utm_*`, https only). Each parser returns sessions with full evidence (`sourceUrl`, `datesQuote`, `lastVerified` = run date, `datesConfirmed:true`, `sourceKind`) and a `sourceRef` (Arlo EventID, ACRRM event ID, NZDA slug) when the source has a stable id.
- **HTTP** (`http.js`): built-in `fetch`, generic User-Agent `Mozilla/5.0 (compatible; course-dates-refresh/1.0)` (no names or e-mail), one request at a time, at least 3 s between requests to the same host, robots.txt read once per host and honoured for `*` and for Claude/Anthropic agent names, https only. A Cloudflare challenge, CAPTCHA page, 401/403 or 404 is reported as blocked and never retried or worked around; only network errors and 5xx are retried (twice, with back-off). A full run is about 13 requests and takes about 40 s. Behind an HTTPS proxy (cloud sessions) the script re-runs itself with `NODE_USE_ENV_PROXY=1`; on the laptop nothing changes.
- **Merge** (`merge.js`): an existing row matches a fresh one by `sourceRef`, then id, then course+variant+region+provider+start (venue name breaks ties). A match keeps its `id` and `city` (a display label) and its venue string unless the venue name changed. Everything else (dates, seats, places, prices, booking link, quote, `lastVerified`) is refreshed and the field changes are listed in the report. Unmatched fresh rows are added (ids made unique). Existing rows are **removed** when finished (`end < today`) or when their source was read in full but no longer lists them. Removed rows are appended to `data/courses/removed-log.json` with the reason. Rows from a source that failed this run are **kept** as they were.
- **Safety:** if a source suddenly yields fewer than half the sessions we hold for it (10 or more held), it is treated as a layout change, not mass cancellation, and its old rows are kept ("suspicious" in the report). Fresh sessions for a course id not in the catalogue (e.g. APLS PLS, if Arlo starts listing it) are listed in the report and not added. The result is written to a temp dir and checked with `check-courses.js --dir`; only a clean result is written over `data/courses/sessions.json`.
- **Tests:** `node --test tools/courses/*.test.js` (fixtures in `tools/courses/fixtures/`, trimmed from the real responses of 17 Nov 2026; `fixtures/index.json` lets `refresh.test.js` replay them through the whole script with `--from`, offline and `--dry`).
- First real run, 17 Nov 2026: 0 removed, 21 updated (APLS places 5→4 and 15→14; 15 St John WA booking links stripped of Google-Ads tracking, which on the ARC page had an e-mail address glued to the `gclid`; 2 NZ CORE rows now book on the provider's site (Emcare, Resus Nelson) instead of the NZDA page; 2 Citi Medical rows now note the source link was http), 39 added (the four ACRRM courses), 519 unchanged.

### How the laptop's daily job should call it
The laptop's scheduled task runs the merge/check scripts. Add these lines (once a day is enough; the sources change slowly and a run is about 13 polite requests), after the shard merge and before the checks:

```
node tools/refresh-courses.js --quiet || echo "course refresh exit $? (1 = check failed, 2 = all sources down); data left as it was"
node tools/check-courses.js
git add data/courses/sessions.json data/courses/removed-log.json docs/research/course-refresh-*.md
```

Commit with the job's usual commit step. Read the day's `docs/research/course-refresh-<date>.md` when the summary line shows `removed` > 0, a "suspicious" or "blocked" source, or "Sessions for courses not in the catalogue". Those need a person.

## Next courses: what was checked on 17 Nov 2026

| Course | Result | Why / host needed |
|---|---|---|
| REST, Paediatric Emergencies for RG, ANR, REOT (ACRRM) | **Added** (19 / 9 / 4 / 7 sessions) | acrrm.org.au course pages |
| RESUS4KIDS | Not added | Not on acrrm.org.au (ACRRM's face-to-face list has no such course). Provider host not identified among the allowed hosts. |
| ALSO (Advanced Life Support in Obstetrics) | Not added | Not on acrrm.org.au (ACRRM runs REOT instead, added). The programme owner is AAFP (www.aafp.org, not allowed). The ANZ provider's host was not identified, and I did not guess one. |
| CCrISP (and EMST, ASSET, TIPS) | Not added | RACS www.surgeons.org: Cloudflare challenge (403, `cf-mitigated: challenge`), re-checked today. Skipped, not bypassed. |
| NLS / Newborn Life Support (ARC) | Not added | ARC's course-dates page lists only ALS1/ALS2 (and recertification/refresher rows). The sitemap has no neonatal or paediatric course. ARC does not run NLS. Nearest official AU course with public dates: ACRRM ANR (added). NZ newborn courses would need www.resus.org.nz (proxy-refused). |
| Paediatric ALS (ARC) | Not added as an ARC course | ARC lists no paediatric ALS course. ACRRM Paediatric Emergencies gives an ARC-standard PALS qualification (added, separate id). ACCCN runs a Paediatric ALS programme, which needs www.acccn.com.au (not allowed). ucrh.edu.au shows one ACCCN Adult ALS session (Lismore, 30 Nov–1 Dec 2026, $625–$895). It was not added: one host-site session, and ACCCN's own course facts are unreadable. |
| PLS (APLS, 1 day) | Not added | Arlo has PLS templates (34/37/40, "Course duration One day") but **0 scheduled public events** (all 77 events are APLS or Refresher). Add a `pls` catalogue entry once events appear. The refresh already maps PLS events and reports them as "not in the catalogue". |
| ARC ALS Instructor course | Not added | Invitation only: candidates are nominated for Instructor Potential on an ALS course ("given access to an opt-In form at the end of the course"). No public dates on resus.org.au. |
| BLS Instructor | Not added | Not an ARC course. AHA BLS Instructor needs international.heart.org (Cloudflare 403) or an AU/NZ AHA training centre host (not identified). NZRC instructor courses need www.resus.org.nz (proxy-refused). |

## Other courses worth adding later (official sources; not opened this run)

| Course | Official source |
|---|---|
| ATACC | ATACC Group (atacc.co.uk) and its ANZ partners |
| ACLS, BLS | AHA International via Training Centres |
| MOET | ALSG / MOET ANZ |
| PROMPT | PROMPT Maternity Foundation; ANZ delivery via RANZCOG and state programmes |
| EMAC; TNCC / ENPC | ACEM (acem.org.au); College of Emergency Nursing Australasia (cena.org.au) |
| Ultrasound (FAST/eFAST/POCUS) | ASUM (asum.com.au); ACEM; ANZCA-endorsed providers; ACRRM POCUS for Rural Generalists (parseable now) |
| ACCCN Adult / Paediatric ALS | www.acccn.com.au (needs allowlisting) |
