# Courses dataset: Australia and New Zealand (first pass, 17 Nov 2026)

Files: `data/courses/catalogue.json` (7 course types), `data/courses/sessions.json` (540 upcoming sessions), checker `node tools/check-courses.js` (0 errors, exits 1 on any problem).

## Counts (sessions starting 17 Nov 2026 or later)

| Course | AU | NZ | Source |
|---|---|---|---|
| APLS (3-day + 2-day refresher) | 77 (all 8 states/territories) | 0 | APLS Australia Arlo feed |
| ALS1 | 258 (all except NT) | 0 | ARC course-dates page |
| ALS2 (incl. 1-day recert + ACRRM one-day) | 201 (all 8; NT only via ACRRM) | 0 | ARC page + ACRRM page |
| NZRC CORE Advanced (NZ equivalent of ALS2) | n/a | 2 (Auckland, Lower Hutt) | provider events on NZDA |
| NZRC CORE Immediate (NZ equivalent of ALS1) | n/a | 2 (Auckland, Richmond/Nelson) | provider events on NZDA |
| EMST | 0 | 0 | RACS blocked (Cloudflare) |
| PALS | 0 | 0 | AHA blocked (Cloudflare); Medcast robots.txt disallows Anthropic agents |

## Per provider

### APLS Australia (www.apls.org.au)
- Sessions: the calendar page `https://www.apls.org.au/courses/calendar` renders client-side with Arlo JS controls. The data comes from the provider's own Arlo platform, through its **public JSON API**:
  `https://apls.arlo.co/api/2012-02-01/pub/resources/eventsearch/?fields=EventID,EventTemplateID,Name,Code,StartDateTime,EndDateTime,Location,IsFull,PlacesRemaining,AdvertisedOffers,RegistrationInfo,ViewUri,Summary&top=200`
  It returns exact start/end datetimes, venue with state/postcode, `IsFull`, `PlacesRemaining`, prices (`AdvertisedOffers`) and register links (`apls.arlo.co/register…` or `/waiting-list…`). Templates are listed at `/pub/resources/eventtemplates/`. No ICS was needed. apls.arlo.co has no robots.txt (404); the robots.txt on apls.org.au disallows only previews.
- Facts read: certificate valid five years (FAQ), entry needs two years of clinical experience, three days face-to-face plus 10+ hours pre-course work, fees "Doctors $3300 Nurse/Paramedic $1920" (course text), and refresher eligibility (full APLS within 5 years and clinically current).
- **Discrepancy:** every 2027 event advertises a $2,120 discounted offer, not $1,920. Session `priceFrom` uses the event's own lowest offer, with a note.
- **City caveat:** session city comes from the event name. The Arlo venue city sometimes differs (e.g. "APLS - Launceston" has venue city Hobart; "Albany" has Perth). The venue string is kept as given.
- No NZ events in the feed. I did not identify an APLS NZ host, so NZ APLS is a gap.
- Not added yet: PLS (one-day Paediatric Life Support, template 37) and GIC, which are in the same feed.

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

## Still blocked or needed

| Host | Status |
|---|---|
| www.surgeons.org | Cloudflare challenge (site), skip |
| international.heart.org | Cloudflare 403 (site), skip |
| medcast.com.au | robots.txt disallows Anthropic agents, skip |
| www.resus.org.nz | refused by session proxy (needs allowlisting) |
| provider booking sites (advancedlifesupport.com.au, medicaltrainingsolutions.com.au, alstraining.com.au, tripleonecare.nz, emcare, etc.) | not on allowlist; not needed for dates, but needed for per-session prices and seats on ARC rows |
| AU/NZ AHA PALS training centres | hosts not yet identified |

## Refresh approach for the daily job
1. **APLS:** call the Arlo eventsearch API (one request; add `&skip=` paging if >200). Diff on EventID, and update `seatsStatus` and `placesRemaining` daily. The cheapest and most reliable source.
2. **ARC:** fetch the course-dates page once a day. Parse `<tr>` rows under each state `<h2 class="e-accordion__title">`. Key rows on (level, centre, start, venue). Drop rows that vanish. Keep `endInferred` logic, and alert when the parse count drops sharply (layout change).
3. **ACRRM:** parse the ALS table daily (seats change).
4. **NZ:** NZDA title searches for "CORE". Once resus.org.nz is allowed, check whether NZRC publishes a course finder and use that instead.
5. Gate every merge with `node tools/check-courses.js`. Remove finished sessions. Never upgrade a blocked source (Cloudflare, 403, robots) to a date source: record it here and keep it as a lead.

## Next courses worth adding (official sources; not opened this run)

| Course | Official source |
|---|---|
| PLS (Paediatric Life Support, 1 day) | APLS Australia: already in the same Arlo feed (template 37) |
| ALSO (Advanced Life Support in Obstetrics) | AAFP ALSO programme (aafp.org); ANZ delivery through ACRRM/RACGP-linked providers |
| CCrISP, ASSET, TIPS, Foundation/Basic Surgical Skills | RACS (surgeons.org), currently Cloudflare-blocked |
| ATACC | ATACC Group (atacc.co.uk) and its ANZ partners |
| NLS / Newborn Life Support | ARC (resus.org.au); NZRC (resus.org.nz) |
| ACLS, BLS, BLS Instructor | AHA International via Training Centres; ARC instructor courses (resus.org.au "Instructor Training") |
| MOET | ALSG / MOET ANZ |
| PROMPT | PROMPT Maternity Foundation; ANZ delivery via RANZCOG and state programmes |
| EMAC; TNCC / ENPC | ACEM (acem.org.au); College of Emergency Nursing Australasia (cena.org.au) |
| Ultrasound (FAST/eFAST/POCUS) | ASUM (asum.com.au); ACEM; ANZCA-endorsed providers |
| ACRRM REAL and other ACRRM emergency courses | acrrm.org.au/courses (same page format as ALS2) |
