# Data wave 2 (25 Nov 2026)

Branch `data-wave2` (from `redesign`). Only `data/**`, `tools/**` and this file were touched. Every page was read this run with the repo's polite client (robots.txt, at least 3 s per host, generic User-Agent, https only). Challenges, 403s and robots refusals were skipped and logged, never worked around. Search results were used as leads only, never as a date source.

## Numbers (upcoming rows, end on or after 25 Nov 2026)

| | before | after |
|---|---|---|
| Upcoming conferences | 2167 | 2178 |
| AU/NZ upcoming | 230 | 241 |
| Confirmed with evidence | 387 | 544 |
| AU/NZ with evidence | 100 | 112 |
| Legacy (not yet re-checked) | 489 | 343 |
| Estimated | 1291 | 1291 |
| Course sessions, AU/NZ upcoming | 1195 | 1246 |
| Course types | 140 | 146 |

All rows: with evidence 391 → 548, legacy 507 → 361. `validate-data` 0 errors, `check-courses` 0 errors, `check-experiences` 0 errors, `npm test` passes (121 tests, 0 failures).

## What was added

### New AU/NZ conference rows (12, `data/shards/wave2-aunz.json`)
Each row has `datesSourceUrl` (an event page, not a site root), `datesQuote` and `verifiedOn: 2026-11-25`.

| id | dates | city | source |
|---|---|---|---|
| anzaoms-asm-2027 | 13–15 May 2027 | Perth | anzaomsasm.com.au/keydates |
| imsanz-nz-conference-2027 | 3–6 Mar 2027 | Auckland | imsanz.org.au upcoming events |
| anzsn-congress-2027 | 11–15 Sep 2027 | Hobart | nephrology.edu.au events |
| anzsn-trainee-weekend-2027 | 14–16 May 2027 | Melbourne | nephrology.edu.au events |
| nzps-asm-2027 | 12–13 Mar 2027 | Hamilton | nzps27.nz/registration |
| jafa-auckland-city-symposium-2027 | 6 Mar 2027 | Auckland | events.jafa.co.nz |
| pannz-educational-update-2027 | 10–11 Apr 2027 | Blenheim | spanza.org.au |
| spanza-update-meeting-2027 | 13 Mar 2027 | Launceston | spanza.org.au |
| nzdsi-annual-conference-2027 | 25–28 Aug 2027 | Christchurch | nzdsi.org |
| bct-asm-2027 | 21–23 Jul 2027 | Perth | breastcancertrials.org.au |
| rdaq-conference-2027 | 24–26 Jun 2027 | Sunshine Coast | conference.rdaq.com.au/2027-program |
| csanz-aae-echo-asia-2027 | 24–25 Sep 2027 | Sydney | csanz.edu.au EventDetail ECHOASIA27 |

### Courses (`data/courses/sources/aunz-wave2.*`, merged with `tools/merge-courses.js`)
6 CRANAplus course types: REC, MEC, MIDUS, PEC+PALS, AREC+ALS and ANLS, with 51 sessions in 2026–2027 across NT, QLD, SA, NSW, VIC, WA and TAS. The pages give the start day only, so the end is worked out from the stated workshop length (`endInferred: true`, `endNote`).

### Legacy rows re-verified (146 entries)
- `provenance-dates-2026-11-25.json`: `tools/verify-dates.js --only legacy --limit 600` over all 489 upcoming legacy rows. 95 confirmed, 183 for review, 168 with no dates for the edition, 21 blocked, 22 errors.
- `provenance-wave2-review-2026-11-25.json`: 51 review items where the saved organiser page lists several ranges and the row's own dates are exactly one of them. The quote is the text beside that range, cut by `readPage`. Five PHAA rows matched too but were left out, because the merge's weak-provenance rule would downgrade them.
- No row dates were changed this run. Disagreements stay in review (see leads).

### Map pins (`data/shards/fix-wave2-coords.json`)
All 32 rows with another city's coordinates now use their stated city's point (Wikidata P625; items and values in `tools/city-coords.json`). Examples: tsanz-asm and anzsnm-asm go to Gold Coast, acem-rural-remote-em-conference to Hobart, racs-asc to Melbourne, and jgs-annual-meeting to Kagoshima. Note that nzoa-asm (Auckland) had Queenstown's pin, and aoa-asm (Sydney) had Perth's. The stated city may be the thing that is wrong there: check before the next edition. `merge-shards.js` fix entries may now set `lat`/`lng`. `validate-data.js` warns when a pin is more than 100 km from a city listed in `tools/city-coords.json`. Add more cities there (with their Wikidata item) to widen the check.

### Status/blurb contradictions (`data/shards/fix-wave2-blurbs.json`)
44 confirmed rows had blurbs saying "Dates expected; not yet announced" or naming an estimated host city that differs from the confirmed one. Examples: ANZGOG, AGES, ACHSM, ASCO GI/GU, ATC, ANA, SNO. The blurbs were rewritten plainly, without date or city guesses. A new validator warning catches this from now on (0 at the end of the run).

## Looked for, not added (no published dates yet, or not readable)
- NZSA ASM 2027: not on anaesthesia.nz. Its event list gave NZPS, JAFA and PANNZ instead. SPAM and AQUA are already in.
- AIDA 2027: only 2026 (Perth, 3–5 Sep 2026) is on aida.org.au.
- ANZAPS, IRSA, NSA 2027, ANZSPM 2028 (ANZSPM is biennial; 2026 was Launceston), Stroke Society 2027 and Australian Hand Surgery Society 2027: no dates on the society pages, or the pages are JavaScript-only (Wix/iMIS).
- NZSOHNS 2027 joins the 6th South Pacific ORL Forum, Denarau, Fiji, 14–18 Aug 2027. Only an ENT & Audiology News listing was found. Fiji is outside AU/NZ.
- 2028 college ASMs (ANZCA, RANZCOG, CICM, ACEM, RANZCP, RACS, ACD, RACGP, ACRRM): not announced on college pages. RANZCR 2028 (ICC Sydney, 19–21 Oct) and ACD 2028 (26–28 May, ICC Sydney) appear only on aggregators.
- ASHM s100 courses are online only, so they were not added as sessions. ASUM CCPU has no public session list. The ASUM Australia 2027 conference is "Melbourne, more information to come", but the `asum-asm` estimate says Brisbane: fix the city when dates appear.
- NeoResus has no public session list (booking by hospital). The AO Trauma course search is JavaScript-only. The KidsResus page is gone (404 at schn.health.nsw.gov.au).
- Destinations and experiences (goal 5) were not reached this run.

## Blocked or failing hosts (skipped, not bypassed): 21
- Bot challenge / 403: surgeons.org, anzhpba.com, aorn.org, acep.org, easd.org, entnet.org, jslm.org, ons.org, auanet.org, aacn.org, pvrinstitute.org, ddw.org / news.ddw.org, aplarcongress.com, aasm.org.
- robots.txt or 5xx: menopause.org.au, anzsnm.org.au.
- Connection failed: strokesociety.com.au, ugsa.com.au, anzhncs.org, simulationaustralasia.com.
- The Wikimedia APIs (en.wikipedia.org, wikidata.org/w/api.php) rate-limited this session. City points came from query.wikidata.org instead.

## Leads for wave 3
1. **verify-dates review list (183)** and "no dates" list (168): re-run `node tools/verify-dates.js --only legacy --limit 400 --dry` to regenerate it. Most are pages with several ranges where the row's dates differ (possible real date changes), or site-root-only dates.
2. **PHAA**: five 2027 PHAA conferences match their organiser pages exactly. The weak rule in `merge-shards.js` (`/phaa|population-health/`) needs a decision (B56 g).
3. **AOA SA/NT** Papers Day (26 Feb 2027, SAHMRI) and ASM (13 Aug 2027, Kooyonga) are on aoa.org.au. They are still blocked by the host+start de-duplication.
4. RACS AoNZ ASM / Founders Centenary, 11–13 Feb 2027 (listed on plasticsurgery.org.nz; surgeons.org blocked). The Australasian PRS Early SET Training Conference, 8–11 Feb 2027.
5. ANZMOSS Multidisciplinary Obesity Care Masterclass 2027 (anzmoss.com.au/integrative-health-roadshow/). The ESA Clinical Weekend and ESA ASM 2027 (pages had no dates yet). The SOMANZ ASM page is JavaScript-heavy.
6. AIDA 2027, ANZSPM 2028, IRSA 2027, Stroke 2027, AHSS 2027: re-check in Feb 2027.
7. Courses: AO Trauma ANZ (needs its JSON feed), ASUM CCPU (members.asum.com.au event list), KidsResus (new HETI URL), NeoResus (hospital-run).
8. Goal 5 (destinations: ANZCA Scan and Ski Thredbo 2027, Hamilton Island/Noosa/Port Douglas, Queenstown winter; experiences for Orlando, Vienna, Lisbon, Singapore, Hong Kong, Seoul) was carried over untouched.
