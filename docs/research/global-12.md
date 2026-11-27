# Data global-12 (27 Nov 2026): US and Canada rows

Branch `data-global-12` (from `data-combined`). US and Canadian clinical meetings and courses only. Files changed:

- `data/shards/global-12.json`: 104 new rows, all with evidence (90 US, 13 Canada, 1 Italy: the SCMR move below).
- `data/shards/provenance-global-12.json`: evidence for 19 existing US/Canada estimates.
- `data/shards/fix-global-12.json`: names and blurbs for those 19 rows, plus 1 removal (SCMR 2027).
- The rebuilt `data/conferences.js` and this file.

Not touched: every non-US/Canada row (checked by script: 0 changed), AU/NZ shards, `data/courses`, `tools/merge-shards.js`, `lib/`, `tools/official-domains.json` (no new entry was needed).

The target was 250 new rows. The pass stopped at 104 because free disk on the shared volume fell below 500 MB (434 MB at 22:57 UTC), as the brief requires.

## How pages were read

The same client as global-8/global-10 (`tools/courses/http.js` robots rules, plus a Crawl-delay reader): robots.txt read first (a group naming ClaudeBot/Anthropic or `*` obeyed; the union of both was applied), Crawl-delay obeyed, at least 3.3 s between requests to one host, a generic User-Agent, https only (redirects too), `NODE_USE_ENV_PROXY=1`. Hosts asking for more than 60 s were not read. Challenges, 401/403/429, robots refusals and dropped connections were logged and skipped.

Every `datesQuote` was checked by script against the whitespace-collapsed visible text of the cited page, which had to return HTTP 200. `verifiedOn` is the UTC date the page was fetched (2026-11-27 for every row). Rows were left out when the page named no city (venue or region only), the event was outside the US/Canada, virtual-only, a board/advocacy/leadership meeting, nurse-/NP-/PA-/pharmacist-only (new rows only; existing estimates of such meetings were confirmed), a biomedical research-lab conference, or the organiser's own pages disagreed on the dates. Web search (WebSearch) and listing sites (the AMA/AAMSE meeting-dates PDF, osteopathic.org CME search, emedevents) were used only as leads; every row cites the organiser's own page.

## Numbers

Conference rows ending on or after 27 Nov 2026:

| | before | after |
|---|---|---|
| Upcoming conferences | 4599 | 4702 |
| With evidence (`datesSourceUrl`) | 3263 | 3386 |
| US/Canada estimates | 241 | 221 |

+104 rows (3 in Dec 2026, 87 in 2027, 6 in 2028, 8 in 2029); 19 estimates confirmed; 1 estimate removed (SCMR, below). Upcoming rose by 103.

Checks before each commit: merge-shards (0 invalid, 0 downgrades), validate-data 0 errors (warnings 1546, unchanged), check-courses 0 errors, check-experiences 0 errors, `npm test` 124 tests, 122 pass, 2 skipped, 0 fail.

## New rows by source

| Source | Rows |
|---|---|
| Mayo Clinic Cardiovascular Education (cveducation.mayo.edu "Upcoming Live Courses"; a separate host from ce.mayo.edu, none of it was in the data) | 23 |
| UNMC Center for Continuing Education (upcoming activities pages) | 7 |
| HMP Global (LL&M Congress, LL&M and OLN Great Debates, Masterclasses in Dermatology, Western AFib) | 7 |
| AANA lab courses (Rosemont OLC, Harvard, Naples) | 5 |
| Society for Education in Anesthesia meetings 2027–2029 | 5 |
| Osteopathic: OMED 2027, AOCOPM 2027/28, FOMA, TOMA, OOA, NJAOPS, POMA District VIII, Maine OA, ACOEP | 10 |
| State and chapter societies: AAP California, ICEP, Mississippi AFP, Maryland AFP, AAFP Whole Health Summit, Missouri SA, SC dermatology/allergy/ENT societies (scmedical.org, which runs their meetings), SoCal Chapter ACS | 11 |
| National society future-meetings pages: ATS 2028/29, AOFAS 2028/29, ARRS 2029, HFSA 2029, AES 2029, CUA 2029, CARO 2029, APSARD, ASE SOTA, ASRA POCUS, NANS, SVS Women's Vascular Summit, AOA CORD, SCMR stress course | 17 |
| Canada: CUA forums (2), CMDS, ACFP Family Medicine Summit, CCMG, UBC CPD (3), UBC Orthopaedics (2) | 10 |
| Other: FORE (3), MER (2), Pri-Med Nashville, AHN Nuts and Bolts, UVM Eastern Winter Derm, DF Clinical Symposium, Winter Clinical Hawaii | 9 |

## Estimates confirmed (provenance-global-12.json)

hfsa-annual-scientific-meeting-2027 (Charlotte), american-glaucoma-society-annual-meeting-2027 (Tucson), acr-annual-meeting-2027/-2028 (Washington), carso-caro-annual-scientific-meeting-2027 (Ottawa, Oct), menopause-society-annual-meeting-2027 (Denver), naemsp-annual-meeting-2028 (San Diego), arrs-annual-meeting-2028 (Austin, not Honolulu), nata-clinical-symposia-2028 (Las Vegas), aacp-annual-meeting-2028 (Baltimore), cua-annual-meeting-2028 (Toronto), naspag-annual-meeting-2027 (Atlanta), anna-national-symposium-2027 (Orlando, hybrid), wocn-annual-conference-2027/-2028 (WOCNext, Savannah / Phoenix), aapm-pain-medicine-annual-meeting-2027 (PainConnect, Orlando), aaacn-annual-conference-2028 (Honolulu), aes-annual-meeting (Baltimore, 3–7 Dec 2027), aes-annual-meeting-2028 (Seattle).

## Items for a person to check (from global-10)

- **SCMR 2027:** fixed from the organiser's page. scmr.org/event-calendar/ gives the 30th Annual Scientific Sessions in Rome, Italy, 17–20 Feb 2027. The Washington estimate `scmr-scientific-sessions-2027` is removed in the fix shard, and the new row `scmr-30th-annual-scientific-sessions-2027` (Italy, Europe) carries the evidence. The Europe/Asia agent should not add it again. `scmr-scientific-sessions-2028` is still an estimate (no 2028 dates on the page).
- **SRI 2027 (Glasgow):** left alone; sri-online.org returns HTTP 403.
- **HFSA 2028:** still left alone. hfsa.org/hfsa-annual-scientific-meeting-2028 gives "September 15, 2028 - September 18, 2028 | Aurora | CO" in its header and "September 15-28" in its body. (HFSA 2027 was confirmed and HFSA 2029 added from the same site.)
- Other disagreements found and left out: NESVS 2027 (21–23 vs 22–24 Oct), CSACI 2027 (13–17 vs 14–17 Oct), FORE Southernmost Spine Symposium 2027 (May 12–15 header vs "April 12–15" text).
- Start dates only (left out): ASRA RA 2028 (Tampa) and 2029 (Las Vegas), AAST 2027 (Chicago, "September 15, 2027, times tbc").

## Sweeps finished

- **Guessed paths:** the `/future-meetings`, `/meetings/future-meetings`, `/annual-meeting`, `/meetings`, `/future-annual-meetings` sweep was run on the 40 US/Canada data hosts not in earlier guess lists, on 147 society domains not in the data, on 139 state/chapter society domains and on 86 Canadian domains (with root-page link following). Most guessed domains do not exist or 404; the hits are in the table above.
- **Edusymp ids 1690–1800:** done (robots allows /product/details/). Everything new is on-demand video or a cruise; nothing added.
- **MER:** the month pages (`/conference-schedule//<base64 M-YYYY>`) list 173 conferences for 2027–2029; 16 are new, but only 2 name a US town (Sonoma, Napa). The rest are Cayman, Costa Rica, Sicily or venue-only (Grouse Mountain Lodge, Hotel Terra, Tenaya Lodge, Wequassett, Edgewood Tahoe, Hotel Alpenrock, Grand Hyatt Kauai).
- **Mayo ce.mayo.edu catalogue:** re-compared (293 items); nothing new in person. A second pass over `/courses?page=N` was stopped at page 20 by the disk limit.
- **CloudCME leftovers from global-10:** Keck Perinatal Medicine is on Maui with no town; the University of Utah items list ", UT" with no city. Not added.

## Blocked hosts (skipped, not bypassed)

- robots.txt: medscapelive.com (and globalacademycme.com, which redirects there), entnet.org/annual-meeting, aan.com/events, asahq.org (incl. the ASA meetings calendar), acog.org, hrsonline.org, cardiometabolichealth.org, aacap.confex.com redirects.
- Crawl-delay: aaps1921.org (3600 s), acmt.net (120 s).
- Challenge or 403: gotoper.com, answersincme.com, medicine.umich.edu, uth.edu, sages.org, uclahealth.org, acep.org, annenberg.net, asam.org annual conference, opsc.org, hmpglobalevents.com/east-coast-symposium (client challenge), sri-online.org, ocfp.on.ca, aamse.org, facs.org (future congresses), caep.ca 2028 page, lipid.org.
- Unreachable: cpd.dal.ca, mcmastercpd.ca, hopkinscme.org, vivaphysicians.org, cnsfederation.org, cme.uw.edu, odacconference.com, nacfc.org, snm.org.

## Leads for the next pass

1. **Mayo cveducation course pages** may add 2028 dates later; the listing is the evidence page.
2. **AMA/AAMSE "medical specialty meeting dates" PDF** (ama-assn.org/system/files/medical-specialty-meeting-dates.pdf): a list of state and specialty society 2026–2027 meetings. Use as leads only.
3. **osteopathic.org CME search**: about 30 osteopathic CME events (MSUCOM manual-medicine courses in Lansing, CAOM Winter Conference in Cleveland, ATSU-KCOM Las Vegas, OPSC Newport Beach, VOMA, Grandview Dayton). The AOA pages load the details by script; read each organiser's own page.
4. **State medical associations that run specialty societies' meetings** (scmedical.org is one). Try the others (MAG, TMA, NCMS, FMA, KMA, MASA).
5. **U of T CPD** root page lists OSSEO 2027 (13–16 Oct, Toronto), IESS 2027 (21–23 Oct, Toronto) and BBDC Advances in Diabetes Care (5 Mar 2027), but their own sites give the dates only on site roots or without a year.
6. **ACS chapter calendar** on trumba.com (ACS's calendar) lists chapter meetings; read each chapter's site.
7. The `/courses?page=N` Mayo pass (stopped at page 20 of ~30).
8. 221 US/Canada estimates remain; most are 2028 editions with no dates published yet, or on the blocked hosts above.
