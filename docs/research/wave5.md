# Data wave 5 (25 Nov 2026), AU/NZ conferences and courses

Branch `data-wave5`, from `data-combined` at cc6e021. This wave added course sessions, fixed the two course parsers that read nothing in wave 4, and closed some of the wave 4 conference leads. I did not edit any non-AU/NZ conference rows. The one exception is ISHLT 2027, which was filed under Toronto but is held in Sydney, and the brief asked for it to be fixed. `tools/official-domains.json` is unchanged.

How pages were read: one request at a time, at least 3 s apart per host, generic User-Agent, https only, robots.txt checked first, and nothing behind a bot wall, login or captcha. Every new date has three things: a source URL on the provider's or organiser's own page (never a site root), a quote checked by script against the saved page text, and `verifiedOn`/`lastVerified` 2026-11-25. I used search results as leads only.

## Numbers

"Upcoming" means the row ends on or after 25 Nov 2026. A course session counts if it starts on or after 25 Nov 2026.

| | before | after |
|---|---|---|
| Upcoming conferences | 2194 | 2195 |
| AU/NZ upcoming | 255 | 257 |
| Upcoming with evidence (`datesSourceUrl`) | 732 | 734 |
| AU/NZ with evidence | 147 | 149 |
| Legacy confirmed (all upcoming) | 237 | 237 |
| AU/NZ legacy | 23 | 23 |
| Estimated (all upcoming) | 1225 | 1224 |
| AU/NZ estimated | 85 | 85 |
| AU/NZ course sessions (upcoming) | 1274 | 1516 |
| Course sessions, all (file total) | 3215 | 3457 |

The AU/NZ session count rose by 242 net. 249 sessions were added and 7 were removed (Hawke's Bay, see below).

I ran `merge-shards`, `merge-courses`, `validate-data` (0 errors), `check-courses` (0 errors), `check-experiences` (0 errors) and `npm test` (122 tests, 0 failures).

## Courses

### Parser fixes (priority 1)

- **FSEP (RANZCOG), 18 → 131 sessions.** The fetch step asked for the feed with `start_date=<today>`, but the build step looked for a URL pinned to `start_date=2026-11-18`. So any later run found nothing and read 0 rows. The feed also has 3 pages of 50 events, and only the first was ever read. The fetcher now reads every page, and the build parses every cached page. I also mapped 22 hospitals that are new in the feed to their towns. Sessions are still left out when the page says they are closed ("For internal staff only", "Metro North employees only", and so on): 15 this run. 131 sessions remain: 126 AU, 5 NZ.
- **RescueMED, 6 sessions read again** (AWLS Mount Buller, Kinloch NZ; Wilderness Rescue Medicine Bay of Fires ×2; Canyon ×2). The label reader now copes with `Dates:&nbsp;`, `Dates :` and a value on the label's own line. I added a test.
- Both runners (`resus`, `womens-gp`) were re-run in full, and their source files were replaced with this run's output.

### New providers (`tools/courses/x10/aunz5-build.js` and `aunz5-groups.js`, one source file pair per group)

| Source | Provider | Course types | Sessions | Read from |
|---|---|---|---|---|
| `zedu-ultrasound` | Zedu Ultrasound Training Solutions, Bundoora VIC | 26 | 103 | Each course page's booking date list (WooCommerce). The store API was used only to find pages with future dates. |
| `ten360` | TEN-360 Training Education Network and LearnEM, Hindmarsh/Kilkenny SA | 12 | 27 | Each event's own Humanitix page (the event's date list at the top) |
| `emugs-nz` | Emergency Medicine Ultrasound Group: POCUS Fundamentals / EGLS, Auckland and Wellington | 1 | 2 | Each event's own Humanitix page |
| `healthcert-masterclass` | HealthCert 2027 Dermoscopy and Surgery Masterclasses, Brisbane | 2 | 2 | healthcert.com/conference-masterclasses-2027 |
| `swslhd-liverpool` | Liverpool Hospital (SWSLHD): DSTC/DATC Sydney 15–17 Mar 2027; SEXI X-ray day 9 Mar 2027 | 2 | 2 | Liverpool Hospital's events page and SEXI registration page |
| `aunz-wave4` (BASIC) | Campbelltown Hospital ICU: BASIC 22–23 Feb 2027 | — | +1 | The hospital's own events page |

Notes on the new rows:
- **Zedu.** A course page gives only start dates. The end date is worked out from the course length the page states (for example "Two day course commencing on the:"), so these rows carry `endInferred: true`. The price is the one on the course page. The venue is Zedu HQ, as given on Zedu's location page, because the course pages name no venue. Podiatry and veterinary courses are left out.
- **TEN-360 ALS2 is not added.** It runs on the same days, at the same centre, as Advanced Resuscitation Training's ARC-listed ALS2, which we already hold.
- **Left out of the Humanitix sources:** LearnEM's ALSi instructor intakes, and POCUS for Nurse Practitioners (not for doctors).
- **CPD.** Fees are taken only where the page shows them. CPD hours are always "check provider".

### Hawke's Bay BASIC sessions removed (7)
`www.healthnz.govt.nz/robots.txt` reads `User-agent: * / Disallow: /`: it allows only named search engines. Wave 4's seven Hawke's Bay BASIC sessions came from that host. The fetch reached it through a redirect from hawkesbay.health.nz, and the client never checked robots.txt for the host it was redirected to. I took the sessions out and removed the Health NZ provider entry from `basic-icu`. `tools/courses/http.js` now refuses a cross-host redirect when the target host's robots.txt disallows it, with a test. This change also covers `verify-dates`, which uses the same client.

### Looked for, not added
- **ALSO:** also.org.au fails the TLS handshake (alert internal error).
- **ACECC:** acecc.org.au still fails to connect, so the ANZCA EMAC/FCU listings there could not be read.
- **EMAC, University of Auckland:** 2026 runs only.
- **DSTC Brisbane (14–16 Jun 2027):** on dstc.com.au's root page only.
- **ETM / PTM:** etmcourse.com is behind a Cloudflare challenge. The aggregator listing was not used.
- **PROMPT, MOET, NRP:** no 2027 dates found on a provider page.
- **PIPER neoResus:** its TryBooking list runs to Dec 2026 only.
- **RACGP rural POCUS and dermatology workshops:** 2026 dates only.
- **Health Workforce Queensland:** "the 2027 Calendar will be released soon".
- **RMH sim courses (CRASH, STAR, NATCAT):** no dates.
- **ASUM:** lists accredited providers only.
- **ACRRM:** all face-to-face course types are already covered. HEART is online.
- **NZ NZRC CORE:** Triple One Care's site returns HTTP 520 (Cloudflare). Health NZ district pages are refused by robots.txt.
- **BASIC:** the CUHK registration list has no new AU/NZ runners. Liverpool shows 2026 only.

## Conferences

### Wave 4 leads

| Lead | Result |
|---|---|
| ISHLT 2027 | **Fixed.** ishlt.org future-dates page: "International Convention Centre Sydney … Annual Meeting 14–17 April, 2027" (preconference day 13 April). The Toronto row `ishlt-annual-meeting-2027` is removed (`fix-wave5.json`). It is replaced by `ishlt-annual-meeting-2027-sydney` (`wave5-aunz.json`), because a fix entry cannot change a row's region. **Lead for the global desk:** the same page gives 2028 as Seattle, 26–29 April 2028, but `ishlt-annual-meeting-2028` still says Toronto, 19–23 Apr. I did not touch it. |
| ISAKOS 2027 Sydney | **Not added.** isakos.com returns 403 to our client. Search shows 30 May – 2 Jun 2027, Sydney, but only in an ISAKOS PDF and aggregators that could not be read. |
| WCLC 2029 Melbourne | **Not added.** wclc.iaslc.org/future-conferences confirms "WCLC 2029 Melbourne, Australia September 8 – 11, 2029". But `merge-shards.js` rejects rows starting after 2028-12-31 as out of range. Add it once the window moves. |
| AGITG 2027 | **Not changed.** asm.gicancer.org.au's JS redirect fails to load. Society and partner listings put the 28th ASM (renamed GI Cancer Trials ASM) in Hobart on 24–27 Nov 2026, so the earlier "See you in Hobart" was most likely the 2026 meeting. The 2027 Melbourne row stays an estimate. |
| Australian Pain Society end date | **Not found.** australianpainsociety.org did not connect this run. The PCO's EventsAir pages for "APS & ISPP 2027 Joint Scientific Meeting" (tcc.eventsair.com) give no dates. APS newsletters (on issuu, not an organiser page) say 13–16 April 2027 at the Gold Coast Convention & Exhibition Centre. The row stays estimated at 11–14 Apr: worth a person checking. |
| DSTC 2027 | Sydney is added as a course (Liverpool Hospital's own page: 15–17 March 2027). Brisbane is still root-only. |
| More BASIC runners | +1: Campbelltown. |

### New AU row
- `swan-trauma-conference-2027`, the 32nd SWAN Trauma, Critical Care & Emergency Surgery Conference: 19–20 Mar 2027, Sheraton Grand Sydney Hyde Park. Source: Liverpool Hospital's own SWAN page.

## Blocked or failing hosts (skipped, not bypassed)
- **robots.txt refuses:** www.healthnz.govt.nz (all agents).
- **403 / Cloudflare:** isakos.com, etmcourse.com, tripleonecare.nz (HTTP 520).
- **TLS failure:** www.also.org.au and also.org.au.
- **Connection failure:** acecc.org.au, scssc.com.au, australianpainsociety.org, asm.gicancer.org.au (JS redirect), gicancer.org.au.

## Code changed
- `tools/courses/x10/womens-gp-fetch.js`, `womens-gp-build.js`: the FSEP feed is read across all pages and found whatever its date; 22 hospital towns added.
- `tools/courses/x10/resus-rescuemed.js`: tolerant label reader (+ test).
- `tools/courses/http.js`: robots.txt is checked on the redirect target (+ test).
- New: `tools/courses/x10/aunz5-build.js` and `aunz5-groups.js`, which rebuild the five wave 5 sources from a cache of fetched pages: `node tools/courses/x10/aunz5-build.js --cache DIR` (DIR/index.tsv: `url<TAB>file<TAB>final url`).
