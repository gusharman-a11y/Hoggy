# Data wave 4 (25 Nov 2026), AU/NZ

Branch `data-wave4` (from `data-combined`). Only `data/**` and `docs/research/**` were touched; no tool code changed. Non-AU/NZ conference rows were not edited (one new row, the NZ Shoulder & Elbow Society meeting, is held in Fiji). `tools/official-domains.json` was not changed.

Every page was read this run with curl, one request at a time, at least 3 s apart, robots.txt checked first (a script refused any URL robots.txt disallows), https only, generic User-Agent `conference-dates-check/1.0`. Search results were used as leads only. Every new date carries a source URL on the organiser's or provider's own page (not a site root), a quote checked by script against the saved page text, and `verifiedOn`/`lastVerified` 2026-11-25.

## Numbers (upcoming: ends on or after 25 Nov 2026)

| | before | after |
|---|---|---|
| Upcoming conferences | 2173 | 2183 |
| AU/NZ upcoming | 246 | 255 |
| Upcoming with evidence (`datesSourceUrl`) | 660 | 675 |
| AU/NZ with evidence | 133 | 147 |
| Legacy confirmed (all upcoming) | 255 | 251 |
| AU/NZ legacy | 27 | 23 |
| Estimated (all upcoming) | 1258 | 1257 |
| AU/NZ estimated | 86 | 85 |
| AU/NZ course sessions (start on or after 25 Nov) | 1246 | 1274 |

"Before" is `data-combined` at 161caae. The AU/NZ course count is net. 42 upcoming sessions were added: 13 core, 11 from the resus and womens-gp runners, and 18 from the new source. 14 upcoming sessions are no longer listed by their providers.

`merge-shards` ran, then `validate-data` (0 errors), `check-courses` (0 errors), `check-experiences` (0 errors) and `npm test` (122 tests, 0 failures).

## Courses

### Refresh of the existing sources
I ran `tools/refresh-courses.js --x10 resus,womens-gp`, which covers the APLS Arlo feed, the ARC course-dates page, ACRRM, NZDA, the resus runners and the womens-gp runners. Core added 13 sessions and updated 119. The x10 runners added 11 new upcoming sessions, for example contraceptive implant training (+4), ACRRM Advanced Airway and ACCCN paediatric ALS. Report: `docs/research/course-refresh-2026-11-25.md`.

**Parser regressions in this run.** The runners read 0 rows for FSEP (RANZCOG) and for RescueMED (AWLS and Wilderness Rescue Medicine), but both pages still list sessions: the FSEP events feed returned 151 events, and RescueMED's page reads "Dates: 7-10 December 2026". Their 24 upcoming sessions were carried back from the 18 Nov run with their old `lastVerified` and a `note` saying why. The parsers need fixing: FSEP probably has new hospital titles that aren't in `FSEP_PLACE`, and RescueMED probably has `&nbsp;` after "Dates:". Two SAPMEA course types dropped out of the womens-gp catalogue.

### New source `aunz-wave4` (2 course types, 18 sessions)

| Course | Sessions | Provider page |
|---|---|---|
| BASIC (Basic Assessment and Support in Intensive Care) | 5: Bunbury, Mater Brisbane, St Vincent's Melbourne ×2, Calvary Mater Newcastle | BASIC collaboration registration page, aic.cuhk.edu.hk/basic/registration.php (the course owner's list of course runners) |
| BASIC | 5: SCGH, Nedlands WA (Feb, Mar–Apr, Jun, Aug, Nov 2027) | scgh.health.wa.gov.au …/Sim/Courses/Basic ("2027 dates") |
| BASIC | 7: Hawke's Bay, Hastings NZ (Mar to Nov 2027) | Health NZ Hawke's Bay training page ("2027 BASIC course dates are:") |
| TEN-360: Critically Ill Child | 1: Hindmarsh SA, 21–22 Oct 2027 | provider's Humanitix booking page |

The BASIC "Dates & Venues" list (`country.php?…`) is disallowed by robots.txt for query URLs, so only the registration list was used.

### Looked for, not added (no 2027 dates on a readable provider page)
- **EMAC:** ANZCA lists the centres. The University of Auckland's page shows 2026 runs only. Adelaide Health Simulation shows none. acecc.org.au fails TLS.
- **DSTC/DATC:** 15–17 Mar 2027 Sydney and 14–16 Jun 2027 Brisbane, but only on dstc.com.au's root page. The SWSLHD flyer marks Sydney "(TBC)". Perth and Auckland are "TBA 2027". These are leads.
- **ETM:** etmcourse.com is behind a Cloudflare challenge.
- **MOET, PROMPT, ALSO, ASUM CCPU, APLS NZ, FCU, EMSB, AO Trauma, POCUS (EMUGs):** no 2027 sessions found on a provider page. EMUGs' site is a JS calendar. ASUM's external events page lists sonographer meetings only.
- **SCGH sim centre:** DSTC, FELS, CORE, TTST and EMO show 2026 dates only.

## Conferences

### New AU/NZ rows (11, `data/shards/wave4-aunz.json`)

| id | dates | city | source |
|---|---|---|---|
| gpce-sydney-2027 | 21–23 May 2027 | Sydney (ICC) | gpce.com.au/sydney |
| gpce-melbourne-2027 | 23–25 Jul 2027 | Melbourne (MCEC) | gpce.com.au/melbourne |
| gpce-perth-2027 | 28–29 Aug 2027 | Perth (PCEC) | gpce.com.au/perth |
| gpce-brisbane-2027 | 11–12 Sep 2027 | Brisbane (Showgrounds) | gpce.com.au/brisbane |
| melbourne-winter-anaesthetic-meeting-2027 | 7–8 Aug 2027 | Melbourne | ANZCA event page (ANZCA/ASA Vic) |
| arganz-annual-meeting-2027 | 20–21 Mar 2027 | Sydney | arganz.org/annual-meeting |
| acah-conference-2027 | 6–8 May 2027 | Sydney (UTS) | acah.org.au/sydney-conference-2027 |
| alfred-nutrition-critically-ill-symposium-2027 | 26–27 Feb 2027 | Melbourne | Alfred Health event page |
| nzoa-coe-foot-ankle-society-2027 | 19–20 Mar 2027 | Christchurch | nzoa.org.nz/nzoa-meetings-2026 |
| lionz-2027 | 12 Jun 2027 | Christchurch | same NZOA page |
| nz-shoulder-elbow-society-meeting-2027 | 14–18 Jul 2027 | Denarau Island, **Fiji** | same NZOA page |

### Evidence for held rows (`data/shards/provenance-wave4-2026-11-25.json`)
- `anzgs-congress-2027`, from the registration page. This row was legacy before.
- `adips-asm-2027`, from adips.org/asm.asp. This row was legacy before.
- `cnsa-congress`, from the annual congress page. This row was legacy before.
- `nzda-conference`, from nzda.org.nz/conference. This row was legacy before.

### Removed (`data/shards/fix-wave4.json`)
- `cssanz-asm-2027`, an unsourced estimate for August in Melbourne. CSSANZ's event list shows no separate 2027 ASM. Its 2027 meeting is APFCP 2027 (16–19 Nov, ICC Sydney), which is already a row (`apfcp-assr-sydney-2027`). The 2028 estimate stays.

### Wave 3 leads, decided
| Lead | Decision |
|---|---|
| CSSANZ / APFCP | Estimate removed, see above. APFCP row kept as it is: its quote gives the congress days 17–19 Nov. CSSANZ's page also gives 16–19 Nov, which includes the pre-congress day. |
| ANZMOSS x NACOS Masterclass | Not added. It appears only on anzos.com, which failed to connect this run. |
| ACTM Southern Cross conference (10–12 Sep 2027, Sydney) | Not added. The dates are on tropmed.org's root page only, and the calendar is a JS `#!event` link. |
| NZOA Registrar Paper Day | Not added: it is not on the NZOA meetings page. That same page gave three NZ meetings that were missing (see the table above). |
| NZPS 2027 | Kept at 12–13 Mar. The organiser's page gives the conference sessions as 12–13 Mar, and 11 Mar is the workshop day. |
| AAAH Youth Health 2027 | Kept as it is (legacy). aaah.org.au's robots.txt disallows everything, and ashm.eventsair.com/yhc2027 is 404. |

### Wave 3 review items, re-checked
- **Still dates on a site root only:** Lorne Proteins 2027, Australasian Diabetes Congress 2027, ANZSOM ASM 2027, ASM microbiology 2027, HIV&AIDS and ASRH 2027 (Hobart), APSTH/Blood 2027 (apsth.bloodconference.com: 24–27 Oct 2027, Adelaide), RANZCR NZ ASM 2027 and NZRA ASM 2027. Their subpages (venue, registration, program) give no date range.
- **Australian Pain Society 47th ASM:** the event page still gives only "April 13, 2027", Gold Coast. The row's estimate starts 11 Apr. It needs fixing once an end date is published.
- **AGITG ASM 2027:** asm.gicancer.org.au says "See you in Nipaluna/Hobart!", but the estimate says Melbourne. The new site is behind a JS redirect, so the row was not changed. It needs a person to look.
- **PHAA:** the Screening (2–3 Mar 2027, Adelaide) and Preventive Health (12–14 May 2027, Perth) registration pages give dates matching the rows. They were not added as evidence because `merge-shards.js` treats every `phaa*` provenance entry as weak (B56 g, still undecided).
- **ANZOS, BreastSurgANZ:** anzos.com failed to connect. BreastSurgANZ's events page lists only a 29 Jan 2027 workshop.
- **Not announced yet:** GP27 (RNZCGP; generalpractice.org.nz still shows GP26), RDAA, Stroke Society, AIDA, NSA, ANZAPS, IRSA.

## Blocked or failing hosts (skipped, not bypassed)
- **Cloudflare challenge / 403:** etmcourse.com, canberrahealthservices.act.gov.au, westernhealth.org.au, and surgeons.org (still).
- **robots.txt refuses:** aaah.org.au (`Disallow: /*` for all agents), and aic.cuhk.edu.hk/basic/country.php with a query string.
- **TLS failure:** acecc.org.au and www.acecc.org.au. The certificate does not match the host name.
- **Connection failure (wave 3 hosts re-tried):** usanz.org.au, adpha.au, aeromedicalsociety.com.au and handsurgery.org.au still fail. anzos.com and strokesociety.com.au also failed this run. agitg.org.au now loads.

## Leads for wave 5
- DSTC 2027 (Sydney 15–17 Mar, Brisbane 14–16 Jun) once dstc.com.au has course pages.
- EMAC 2027 at the ANZCA centres, especially University of Auckland Learn, which usually lists the next year by December.
- BASIC: more course runners will appear on the CUHK registration page through 2027.
- TEN-360 (Humanitix host "TEN-360 : Training Education Network") runs other workshops in Hindmarsh SA.
- ACTM conference (10–12 Sep 2027, Sydney) once tropmed.org has an event page.
- AGITG 2027 (Hobart?), APSTH/Blood 2027, and the Australian Pain Society end date.
- Fix the FSEP and RescueMED parsers before the next `--x10` refresh.
