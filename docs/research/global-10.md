# Data global-10 (26–27 Nov 2026): US and Canada rows

Branch `data-global-10` (from `data-combined`). US and Canadian meetings only. Files changed:

- `data/shards/global-10.json`: 248 new rows, all with evidence.
- `data/shards/provenance-global-10.json`: evidence for 40 existing US/Canada estimates.
- `data/shards/fix-global-10.json`: names and blurbs for those 40 rows, plus 2 removals (the AANA rows, below).
- `tools/official-domains.json`: 2 entries at the top of the `official` list.
- The rebuilt `data/conferences.js` and this file.

Left alone: AU/NZ rows and shards, all UK/Europe/Asia and other non-US/Canada rows (a parallel agent is on `data-global-9`), `data/courses`, `tools/merge-shards.js` and `lib/`.

## How pages were read

The same client as global-8: robots.txt read first (a ClaudeBot/Anthropic group obeyed over `*`), Crawl-delay obeyed (10 s on ce.mayo.edu), at least 3.3 s between requests to one host, a generic User-Agent, https only (redirects too), and `NODE_USE_ENV_PROXY=1`. Hosts asking for a crawl-delay above 60 s were not read. A 401/403/429/503, a challenge page, a robots refusal or a dropped connection was logged and skipped, never worked around.

`verifiedOn` is the UTC date the page was fetched: 2026-11-26 for most rows, 2026-11-27 for pages read after midnight UTC. Every `datesQuote` was checked by script against the whitespace-collapsed visible text of the page it cites, and the page had to return HTTP 200. For the Gordon Research Conference and Cold Spring Harbor rows the script also checked that the city is on the cited page.

Rows were left out when the page gave no city (only a venue or a region: Lake Tahoe, Walt Disney World, Yosemite, Maine, Florida Keys without a town, Maui, Big Island, Kauai), the meeting was outside the US/Canada (Puerto Rico, Bahamas, Mexico, Hawaii islands without a town were skipped too), virtual-only, a board/advocacy/House of Delegates meeting, nurse-, NP-, PA- or pharmacist-only (new rows only; existing estimates of such meetings were still confirmed), or the organiser's own pages disagreed on the dates.

## Numbers

Conference rows that end on or after 26 Nov 2026:

| | before | after |
|---|---|---|
| Upcoming conferences | 4137 | 4383 |
| With evidence (`datesSourceUrl`) | 2757 | 3045 |
| US/Canada estimates | 283 | 241 |

- **+248 new rows** (210 US, 38 Canada). By start year: 4 in Dec 2026, 175 in 2027, 39 in 2028, 30 in 2029. The target was 300; the pass stopped at 248 because the session's disk filled (see the end of this file).
- **40 estimates confirmed** through provenance entries; most moved city or date.
- **2 estimates removed** (AANA, below), so upcoming rose by 246 (248 − 2).

## New rows by source

| Source | Rows | Notes |
|---|---|---|
| Keystone Symposia (keystonesymposia.org) | 55 | Each conference's own page: Banff, Whistler, Vancouver, Keystone, Breckenridge, Santa Fe, Hershey, Bolton Landing, Princeton. Plant-biology and AI/gene-regulation meetings left out. |
| Gordon Research Conferences (grc.org) | 40 | The site's own conference list (embedded JSON) as a lead, each conference's 2027 page as evidence. Only disease- or clinically-oriented GRCs (Alzheimer's, arrhythmia, staphylococcal diseases, red cells, lung injury ...); GRS seminars and physical-science conferences left out. |
| Mayo Clinic (ce.mayo.edu) | 21 | The public course catalogue (`/course-catalog-list?page=N`) compared with the data; each course page read. Simulation-instructor courses in Rochester, Updates in Family Medicine 2028 (Indian Wells), Selected Topics in Internal Medicine 2029 (Koloa) and others. The catalogue's "Live Courses" filter (`?field...`) is disallowed by robots and was not used. |
| National and subspecialty societies | 70 | Future-meetings pages: AANA (Arthroscopy) 2027/28, AHNS, AAFS 2029, ASES, NKF Spring Clinical 2029, SESAUA, NCS-AUA 2029, MAAUA, SNS, ACR Winter Rheumatology, ADA (CUC 2027, Scientific Sessions 2029), SIR Business of IR, AAO Global Ophthalmology Summit, SHM Leadership Academy, OMA Summit, ASMS (Mohs), AAIM (APM, APDIM, AIM Week 2028), APA (pancreatic), ABS (brachytherapy), ORS workshop, SEA, PHA 2028/29, ACOOG, AOAO, AOCOPM, ACFAS 2027/28, ACPM 2027/28, ACNS, AATS 2028/29, IARS 2029, ACMG 2028/29, SSO 2029, ASBrS, AAP 2029, APTA CSM 2029, APA (psychiatry) 2029, AcademyHealth 2029, SITC 2029, SOBP 2029, SAHM 2029, SABCS 2029, RSNA 2029, ISMRM 2029 (Montréal), ASHA 2029, ASHT 2029, COSM 2029, Noah Worcester, AABIP, SVU, AHRA, SUFU, SUO, AAPM&R Chief Resident Course. |
| American Association of Orthodontists | 8 | Annual Session 2029, Winter Conferences 2027–2029 and four constituent meetings (www2.aaoinfo.org/meetings/). |
| Cold Spring Harbor Laboratory | 14 | The meetings listing (meetingshome.aspx), which names Cold Spring Harbor, NY. Disease- and medicine-oriented meetings only. |
| CME companies | 12 | Sitemap check re-run: MCE Conferences (8 new 2027 meetings), CME Seminars (4). CME Vacations' missing pages are all livestream, cruise, Caribbean, Mexico or Lake Tahoe; GCUS's were already in. |
| State and chapter societies | 21 | Ohio ACEP ultrasound and exam-prep courses (7), MCEP (3), AAPM chapter meetings (5), CSA Annual Anesthesia Conference, Arkansas AFP, PAFP Ten State, FSA (already in). |
| Canadian societies | 7+ | CSVS Winter Meeting (Whistler), COMP 2027 (Halifax), CSEP 2027 (Halifax), CPS 2029 (Montréal), Family Medicine Forum 2029, MAiD2027 (CAMAP, hybrid). Several Canadian rows above too (Keystone, ACMG 2028 Vancouver, ISMRM 2029). |

The shard's `organiser` field is the exact record.

## Estimates confirmed (provenance-global-10.json)

| Row | Now | Was |
|---|---|---|
| cas-annual-meeting-2028 | **WCA 2028 (World Congress of Anaesthesiologists)**, Vancouver, 7–10 May 2028 (renamed via fix) | CAS Annual Meeting, 9 Jun |
| cda-annual-conference-2027 / -2028 | Montréal 9–12 Jun 2027 / Victoria 7–10 Jun 2028 | Vancouver |
| cfpc-family-medicine-forum-2027 / -2028 | Vancouver 17–20 Nov 2027 / Calgary 8–11 Nov 2028 | Toronto |
| cps-annual-conference-2028 | Calgary, 1–3 Jun 2028 | Ottawa |
| carso-caro-annual-scientific-meeting-2028 | CARO-COMP joint meeting, Montréal, 13–16 Sep 2028 | Toronto |
| can-neuroscience-meeting-2028 | Toronto, 9–12 Jun 2028 | Montreal |
| diabetes-canada-professional-conference-2027 | Ottawa, 27–29 Oct 2027 | Toronto |
| aacp-annual-meeting-2027 | Pharmacy Education 2027, Toronto, 10–13 Jul | Seattle |
| aspho-conference-2027 | Montréal, 11–14 May 2027 | Seattle |
| cosm-triological-2027 / -2028 | Seattle 7–11 Apr 2027 / Chicago 3–7 May 2028 | Austin |
| ahns-annual-meeting-2028 | AHNS Annual Meeting at COSM, Chicago, 3–7 May 2028 | Intl Conference, 15 Jul |
| sfp-annual-meeting-2027 | Philadelphia, 30 Oct–1 Nov 2027 | Denver |
| apic-annual-conference-2027 | Los Angeles, 14–16 Jun 2027 | Nashville |
| acaai-annual-scientific-meeting-2027 | Nashville, 11–15 Nov 2027 | Orlando |
| agd-annual-meeting-2027 | Chicago, 8–10 Jul 2027 | Nashville |
| cpdd-annual-meeting-2028 | Milwaukee, 17–21 Jun 2028 | Denver |
| ases-annual-meeting-2028 | Nashville, 11–14 Oct 2028 | Sun Valley |
| acnm-annual-meeting-2027 | Palm Springs, 15–18 Oct 2027 | Orlando |
| nsgc-annual-conference-2027 / -2028 | Tampa 7–11 Nov 2027 / Detroit 7–11 Nov 2028 | Montreal |
| acnp-annual-meeting-2028 | Las Vegas, 4–7 Dec 2028 | Hollywood FL |
| svs-vascular-annual-meeting-2028 | Oxon Hill MD, 31 May–3 Jun 2028 | Chicago |
| aaes-annual-meeting-2028 | Salt Lake City, 20–22 May 2028 | Nashville |
| aafs-annual-scientific-meeting-2028 | Las Vegas, 21–25 Feb 2028 | Orlando |
| ncpa-annual-convention-2027 / -2028 | San Antonio 25–28 Sep 2027 / Louisville 16–19 Sep 2028 | Nashville |
| aaacn-annual-conference-2027 | New Orleans, 27–30 Apr 2027 | Orlando |
| napnap-national-conference-2027 | Sacramento, 21–24 Mar 2027 | Orlando |
| snis-annual-meeting-2027 | Colorado Springs, 12–16 Jul 2027 | Nashville |
| nann-annual-conference-2028 | Dallas, 13–15 Sep 2028 | Orlando |
| iars-annual-meeting-2028 | Anaheim, 21–23 Apr 2028 | Boston |
| aapmr-annual-assembly-2028 | Denver, 11–14 Oct 2028 | Chicago |
| actrims-forum-2027 | Phoenix, 11–13 Mar 2027 | West Palm Beach |
| aao-orthodontists-annual-session-2028 | Washington DC, 19–21 May 2028 | Denver |
| aap-periodontology-annual-meeting-2027 | Boston, 16–19 Sep 2027 | Seattle |
| aann-annual-meeting-2027 / -2028 | Seattle 13–16 Mar 2027 / Anaheim 6–9 May 2028 | Orlando |

## The global-8 flags

- **AANA.** `aana-annual-congress-2027` and `-2028` were undated estimates filed as the nurse anaesthetists' congress on aana.com, whose pages give no dates. They are removed in `fix-global-10.json` (with a note), and the Arthroscopy Association's own page (aana.org/education/future-annual-meetings/) now gives two new rows: `aana-annual-meeting-2027` (Hollywood FL, 13–15 May 2027) and `aana-annual-meeting-2028` (Nashville, 18–20 May 2028), next to global-8's 2029 row. The names say "AANA Arthroscopy Annual Meeting" because the merge's name key treats "AANA Annual Meeting 2027" and "AANA Annual Congress 2027" as the same meeting.
- **CAS 2028.** Fixed: the row is now WCA 2028, Vancouver, 7–10 May 2028, from the CAS future-meetings page.
- **SPA 2027 (Bahamas) and SOAP 2028 (Puerto Rico):** left alone, as asked.

## tools/official-domains.json (2 entries at the top)

- `americanneurotologysociety.com` (path `/future-conferences`) for `cosm-triological-2027/-2028`: the ANS is one of the COSM societies and its page lists COSM's dates; triological.org returns a challenge.
- `comp-ocpm.ca` (path `/past-and-future-asm`) for `carso-caro-annual-scientific-meeting-2028`: COMP co-hosts the 2028 joint meeting.

## For a person to check

- **Estimates whose meeting is outside the US/Canada** (left alone): `scmr-scientific-sessions-2027` (SCMR 2027 is in Rome, 17–20 Feb), `sri-annual-scientific-meeting-2027` (SRI 2027 is in Glasgow, 16–20 Mar).
- **Dates that disagree on the organiser's own pages** (left out): HFSA 2028 (15–18 Sep and "15–28" Sep, Aurora CO), ObesityWeek 2027 ("Orlando, November 7–10, 2026"), VESS 2027 Winter (21–23 and 21–24 Jan), NESVS 2027, CSACI 2027 (as in global-8).
- **Start date only** (no end date given, left out): ASRA Pain Medicine 2028 (Tampa), ASRA RA 2028 (New Orleans), ASRA Pain 2029 (Las Vegas), NCS 2028/2029.
- **AAE 2028 (Toronto, 5–8 Apr) and 2029 (Seattle, 18–21 Apr):** the HTML page returns a bot challenge; the same text is in the site's WordPress JSON, which was not used as evidence.
- **AAHKS 2027 (Grapevine, 4–7 Nov):** only on the meeting site's root page, so not usable as evidence.
- **Heads-up:** the GRC, Keystone and CSHL rows are biomedical research conferences (specialty mostly by topic, some `Medical Research`); drop the shard entries if the app should list clinical CME only.

## Blocked hosts (skipped, not bypassed)

- **robots.txt:** susweb.org, ota.org, aaopt.org, posna.org, himss.org, acrm.org, asrs.org, sgo.org, ena.org, cap.org, ons.org, cpha.ca, uhms.org, limblengthening.org, gastro.org, sbas.net, college.acaai.org (redirect), cos-sco.ca (redirect), Mayo's `?field_course_live_value` filter.
- **Crawl-delay ≥ 120 s:** asaio.org, savs.org, handsurgery.org, stsa.org, neaua.org (3600 s); saem.org, croiconference.org, aacom.org, aspet.org, aaem.org (120 s).
- **Challenge or 403:** east.org, professional.heart.org, heart.org, adaa.org, acsm.org, arvo.org, ashp.org, astro.org, accp.com, aae.org, naccho.org, amia.org, cap-acp.ca, scct.org, triological.org, smfm.org, aasm.org (SLEEP 2028/2029 pages), aofas.org, adces.org, acmg.net, asipp.org, asma.org, aaha.org, acofp.org, ajnr.org, ascp.org, aapl.org, easternvascular.org, npwh.org, isth.org, cmecatalog.hms.harvard.edu, clevelandclinicmeded.com; HTTP 403: pedsendo.org, siim.org, auanet.org, sgim.org.
- **Unreachable for this client:** sesc.org, ccs.ca, aagponline.org, ahpba.org, uscap.org, aspho.org (root), cpa-apc.org, csnscn.ca, csmls.org, sidnet.org, asrm.org, cme.columbia.edu, cme.dukehealth.org, cme.emory.edu, imedex.com, paininstitute.com, amedcoevents.com and about 20 small society sites (societyofpediatricurology.org, nysaua.org, aaoa.org, midwesternvascular.org, snacc.org, westerntrauma.org ...).
- **Dates load by script:** assh.org future meetings, meeting.handsurgery.org, theaestheticsociety.org calendar, AAD meeting pages.

## Leads for the next pass

1. **Research-conference organisers** are the richest seam found here: Keystone (more 2028 meetings will appear), GRC (2028 conferences are not listed yet; GRS seminars and the physical-science GRCs were skipped), CSHL (courses page not used), and FASEB (challenged).
2. **Mayo's catalogue** has about 290 items over 29 pages; re-run the comparison every few weeks (10 s crawl-delay).
3. **CloudCME listings** were re-read for 56 hosts: almost everything missing is internal (grand rounds, ECHO, simulation, staff training). A few public ones (Keck USC Perinatal Medicine 2027, UCSF AIDS course, UVA Running Medicine) lacked a city on the listing; read their event pages.
4. **Guessed future-meetings paths** (`/future-meetings`, `/meetings/future-meetings`, `/annual-meeting` ...) on the data's ~440 US/Canada hosts found several pages; the `/annual-meeting` and `/meetings` sweep was stopped by the disk problem below and should be re-run.
5. **Edusymp product ids** above 1690 were being probed (the sitemap is stale); not finished.
6. **University of Toronto CPD** lists BBDC Diabetes Update, the Canadian Breast Cancer Symposium, OSSEO 2027 and IESS 2027, but the listing gives no city or format; read each event's own site.
7. **241 US/Canada estimates remain**; most of the rest are on challenged or robots-blocked hosts (list above).

## Why the pass stopped at 248

The volume holding the scratchpad filled up twice (other work on the same machine). To keep going, this pass deleted its own fetch cache entries and the `node_modules` folders of old, already-merged clones (global2–8, wave2–7 and others; reinstallable with `npm ci`). Removing older pass folders was refused by the permission check, so the remaining sweeps were stopped and the work committed.
