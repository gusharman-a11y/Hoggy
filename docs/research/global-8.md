# Data global-8 (26 Nov 2026): more US and Canada rows

Branch `data-global-8` (from `data-combined`). This pass added US and Canadian meetings only. Files changed:

- `data/shards/global-8.json`: 300 new rows.
- `data/shards/provenance-global-8.json`: evidence for 30 existing US/Canada estimates.
- `data/shards/fix-global-8.json`: names and blurbs for 29 of those rows.
- `tools/official-domains.json`: 2 entries added at the top of the `official` list.
- The rebuilt `data/conferences.js` and this file.

Left alone: AU/NZ rows and shards (no AU/NZ row changed), `data/courses`, `tools/merge-shards.js`, and UK, Europe, Asia and India rows (none added; a parallel agent is on `data-global-7`). `data/conferences.js` was rebuilt from the `data-combined` base with the merge script, so every existing row is unchanged except the 30 estimates confirmed below.

## How pages were read

The client was the same as global-5's:

- robots.txt was read first, and a ClaudeBot or Anthropic group was obeyed over `*` where one existed.
- Crawl-delay was obeyed (10 s on the EthosCE hosts, caep.ca, ceme.org, gsahq.org and others; 3 s on mceconferences.com). Two hosts ask for 3600 s (centralsurg.org, nesurgical.org), so they were not read at all.
- There were at least 3.3 s between requests to one host. The User-Agent was generic, and only https was used, including for redirects.
- A 401/403/429/503, a challenge page, a robots refusal, or a connection that was dropped for the bot User-Agent was logged and skipped. None was worked around.

Every page was fetched in this session on 26 Nov 2026 (UTC), and `verifiedOn` is that date for all rows.

The evidence rules were the same as global-4 and global-5:

- Every `datesQuote` was checked by script against the whitespace-collapsed visible text of the page it cites. No quote was typed by hand.
- `datesSourceUrl` is the organiser's own event page or event-listing page (for example a "future meetings" page), never a site root.
- The city comes from the same page: a city, or a venue name that contains it ("Big Sky Resort", "Fairmont Banff Springs", "Westin Verasa Napa").

Rows were left out in these cases:

- The page named only a venue with no city (Caesars Palace, Grand Traverse Resort, The Garland, Grouse Mountain Lodge, Hotel Terra, Tenaya Lodge, the FMSS for the Sherbrooke colloques).
- The page named only a region, island or park (Maui, Kauai, Kona, Lake Tahoe, Florida Keys, Walt Disney World, Napa Valley, Zion, Yosemite, Cape Cod, "Maine", "Alaska").
- The event was outside the US and Canada (Bahamas, Puerto Rico, USVI, Cayman, Mexico, cruises).
- The event was virtual or webinar-only, or an internal or staff course (communication workshops), advocacy day, board meeting or House of Delegates, or a nurse-, PA-, NP-, pharmacist- or technologist-only meeting.
- The organiser's own pages gave two different dates for the event.

Leads came from the sites' own sitemaps, the WordPress "The Events Calendar" JSON feed (`/wp-json/tribe/events/v1/events`), EthosCE `calendar.ics` feeds, a crawl of about 700 society home pages and their meeting links, and web searches for "future meetings" pages. Search results and listing sites (emedevents, showsbee, convention-centre calendars) were used only as leads.

## Numbers

Conference rows that end on or after 26 Nov 2026:

| | before | after |
|---|---|---|
| Upcoming conferences (all) | 3438 | 3738 |
| Confirmed with evidence | 2022 | 2352 |
| Legacy (not yet re-checked) | 229 | 229 |
| Estimated | 1187 | 1157 |
| Course sessions (`data/courses`, not touched) | 3601 | 3601 |
| **Conferences plus course sessions** | **7039** | **7339** |

The target is 11,000, so about 3,660 more are needed.

- **+300 new rows, all with evidence**: 267 in the US and 33 in Canada.
- By start year: 18 in Nov–Dec 2026, 195 in 2027, 37 in 2028 and 50 in 2029. Many of the 2028 and 2029 rows are national meetings whose 2027 edition was already in the data; their societies' "future meetings" pages now give the later dates.
- **30 estimates confirmed** through provenance entries. Most moved city or date. These are listed below.

The checks gave these results:

| Check | Result |
|---|---|
| `merge-shards` | ok: 300 new rows applied, 0 invalid, 0 downgrades; provenance corrected 30 rows |
| `validate-data` | 0 errors. Warnings went from 1390 to 1396: 6 "possible duplicate edition" notes for CAEP AIME courses run twice in a row in one town, and Waikiki has no map pin. |
| `check-courses` | 0 errors (244 courses, 3601 sessions) |
| `check-experiences` | 0 errors, 0 warnings |
| `npm test` | 122 pass, 2 skipped, 0 fail (124 tests; needs `npm ci` and `NO_PROXY=localhost,127.0.0.1`) |

## New rows by source

| Source (organiser's own pages) | Rows | Notes |
|---|---|---|
| National society "future meetings" pages | 64 | 2028–2029 editions of AANS, SIR, CNS (neurosurgery), ASE, AUGS, ASMBS, AOHC, ACP, STS, SCCM, ASBMR, NCCN, AACR, STFM, CSIM, ACGME, SBI, NASPGHAN, CSRS, APPD, AACPDM, ACC.29, AAR, SNS, SOCCA, AAP/ASCI/APSA, AACAP (Toronto 2029), PAS, CNS (child neurology), ASTMH, ORS, ASDS, AAFPRS, Aesthetic MEET, ACOG (Toronto 2029), ASHG, ASGCT, American Surgical Association (Vancouver 2029), ABA, AANA, NESVS, NANOS, AAPOS, SPD, SCAI, SPA/CCAS and VESS (Lake Louise 2028). |
| Other US national and subspecialty societies | 77 | 2026–2027 meetings and courses not yet in the data, from about 50 societies. Examples: CRF (Complex Coronary Summit, THT, New York Valves), PDA, EOA, ASCCP colposcopy courses, NCVH regionals, AAOS courses, SVIN, Psych Congress, SSO, WIO, SVM, AOSSM, ACG schools, ASPO, Child Neurology Society, SCA, SNO, AAGL, AAOMS, ASTCT, AST, ASTS, NASS, NKF, NLA, SVS, AASLD, SITC, SAR, ASRM, ASSR, SSR, SBSM, SPAQI, ACDS, ASPNR, ASMS, SABI, AAIM, SRU, SIO (Toronto), Pituitary Society (Toronto), SOHO, ASCPT, ACOI, ASIP and AACS. |
| State and chapter societies | 46 | AAFP chapters (TX, FL, NY, PA, SC, MO, OR, CO, OK, MT, GA, WI, ND, LA, UT), ACEP chapters (FCEP, OCEP, VACEP, Ohio, WACEP, AzCEP, the EMerald Coast Conference), AAP chapters (CA1, KY, TN, GA "Pediatrics by the Sea"), ACC Ohio, anaesthesia societies (FSA, GSA, ISA, PSA), FAD, TSGE, OAO and NPSA. |
| CAEP courses and NCER (caep.ca) | 22 | AIME, AIME Awake and AIME Clinical Cadaver airway courses (Halifax, Toronto, Athabasca, Diamond Valley, Ayer's Cliff) and TRIK trauma courses (Halifax, Toronto, Calgary). |
| Symposia Medicus (symposiamedicus.org) | 20 | Listing page plus each conference's own brochure page. New York, Big Sky, Las Vegas, Napa, Nashville, Sedona, Denver and Hilton Head Island. Maui, Kauai, Lake Tahoe, USVI, Bahamas, Costa Rica, Cayman and cruise conferences were left out. |
| CME companies | 16 | MER (5: Big Sky ×3, Springdale, Estes Park; their pages name the town in the venue), MCE Conferences (5, found in its sitemap), CME Seminars (3) and CME Vacations (3). |
| EthosCE catalogues | 9 | Baylor Scott & White (`ce.bswhealth.com`, a host new to the data, found through its `calendar.ics`), UT Southwestern (2) and Baptist Health South Florida (3). |
| Canadian societies | 6 | SRPC (Rural and Remote 2027 in Halifax, Rural Surgical Skills in Banff), AACR Aneuploidy (Vancouver) and other Canadian rows not counted above. |
| Other | 40 | The Difficult Airway Course (Boston ×2), ASRA UGRA course, AABB 2029, the Retina Society 2027 and others. |

Some rows could sit in more than one group, so the counts are approximate. The shard's `organiser` field is the exact record.

## Estimates confirmed (provenance-global-8.json)

Each entry quotes the organiser's page.

| Row | Now | Was |
|---|---|---|
| aapos-annual-meeting-2027 / -2028 | Washington DC, 17–21 Mar 2027 / San Diego, 22–26 Mar 2028 | Denver |
| asbmr-annual-meeting-2027 | Toronto, 15–18 Oct 2027 | Montreal, Sep |
| ncs-annual-meeting-2027 | New Orleans, 27–30 Sep 2027 | Denver, Oct |
| sca-annual-meeting-2027 / -2028 | Las Vegas, 8–11 Apr 2027 / Miami Beach, 18–21 May 2028 | Nashville |
| aafp-fmx-2028 | Indianapolis, 10–14 Oct 2028 | Seattle, Sep |
| spa-annual-meeting-2028 | SPA-AAP Pediatric Anesthesiology, Oxon Hill MD, 16–20 Mar 2028 | Nashville |
| napcrg-annual-meeting-2027 / -2028 | Vancouver, 13–17 Nov 2027 / Portland OR, 16–20 Nov 2028 | Nashville |
| sbi-symposium-2028 | Minneapolis, 20–23 Apr 2028 | Chicago |
| aagl-global-congress-2027 | San Diego, 3–6 Nov 2027 | Las Vegas |
| aaoms-annual-meeting-2027 / -2028 | San Antonio, 20–25 Sep 2027 / Tampa, 11–16 Sep 2028 | Chicago |
| coa-annual-meeting-2028 | Ottawa, 14–17 Jun 2028 | Calgary |
| nla-scientific-sessions-2027 | Nashville, 17–20 Jun 2027 | Orlando |
| svs-vascular-annual-meeting-2027 | San Diego, 2–5 Jun 2027 | Chicago |
| asra-pain-medicine-meeting | Atlanta, 18–20 Nov 2027 | same, estimated |
| spr-annual-meeting-2027 | Dallas, 18–22 May 2027 | Nashville, Apr |
| cts-canadian-respiratory-conference-2027 / -2028 | Montreal, 7–10 Apr 2027 / Toronto, 27–29 Apr 2028 | Ottawa |
| aur-annual-meeting-2027 / -2028 | AAR, Salt Lake City 13–16 Apr 2027 / New Orleans 2–5 May 2028 | Orlando |
| aacap-annual-meeting-2028 | Philadelphia, 23–28 Oct 2028 | Seattle |
| pas-meeting-2028 | Vancouver, 21–24 Apr 2028 | Toronto |
| asnr-annual-meeting-2028 | Toronto, 20–24 May 2028 | Boston |
| ors-annual-meeting-2027 / -2028 | San Francisco, 19–23 Feb 2027 / New Orleans, 11–15 Feb 2028 | Phoenix |
| asaps-aesthetic-meeting-2027 / -2028 | Aesthetic MEET, Miami Beach 15–18 Apr 2027 / New York 30 Mar–2 Apr 2028 | New York, May |

## tools/official-domains.json (2 entries at the top)

- `spr.org`, for `spr-annual-meeting-2027`. The row's url, pedrad.org, now redirects to www.spr.org, the Society for Pediatric Radiology's own site.
- `theaestheticsociety.org`, for `asaps-aesthetic-meeting-2027` and `-2028`. The rows' url, www.surgery.org, redirects with a 301 to the Aesthetic Society's own site.

## For a person to check

- **Wrong society behind an estimate.** `aana-annual-congress-2027` and `-2028` point to aana.com, the nurse anaesthetists' association. The Arthroscopy Association's own page gives these meetings:
  - Hollywood FL, 13–15 May 2027.
  - Nashville, 18–20 May 2028.
  - Austin, 3–5 May 2029. This edition was added as a new row.

  The two estimates were not changed, because the evidence domain would not match their url.
- **Estimates that now point outside the US/Canada.** These were left as they are:
  - `spa-annual-meeting-2027`: the SPA-AAP meeting is at Atlantis, Nassau, Bahamas, 5–7 Mar 2027.
  - `soap-annual-meeting-2028`: SOAP 2028 is at El Conquistador, Fajardo, Puerto Rico, 27–30 Apr 2028.
- **CAS 2028.** CAS says 2028 is WCA 2028 (World Congress of Anaesthesiologists), Vancouver, 7–10 May 2028. The estimate `CAS Annual Meeting 2028` (Vancouver, June) should be renamed and re-dated. It was not changed, to avoid two rows for one meeting.
- **Dates that disagree on the organiser's own pages** (left out):
  - NESVS 2027: 21–23 Oct on one page, 22–24 Oct on another.
  - VESS 2027 Winter Meeting: 21–23 or 21–24 Jan.
  - ASMS 2027 Annual Meeting: 17–20 or 18–20 Jun.
  - CSACI 2027 (St. John's): 13–17 or 14–17 Oct.
  - NCAFP Winter Weekend 2026: 9–13 or 10–13 Dec.
  - Ohio Orthopaedic Society 2027: the page says "2027 Annual Meeting May 6-7, 2026".
  - CUA Bladder Cancer Forum: listed "in Vancouver in 2027" with 2026 dates.
- **Same day on one page.** When two events start on the same day and are on the same page, the merge keeps one. Symposia Medicus 19th Emergencies & Challenges in Pediatrics (17 Dec 2027) was kept. Challenges in Gynecology and Clinical Issues in Primary Care (same days, New York) were not added. The SPPM 15th meeting (15 Mar 2028) was not added; CCAS 2028, on the same day, was.
- **No map pin:** Waikiki (one new CME Vacations row, as in global-5).

## Blocked hosts (skipped, not bypassed)

- **Connection dropped for a bot User-Agent:** swscongress.org (Southwestern Surgical Congress), sesc.org (Southeastern Surgical Congress), westernsurgical.org and amseminars.com. These sites load with a plain client but close the connection for this crawler's User-Agent.
- **Challenge or 403:**
  - acep.org/education/meetings, east.org, aofas.org, familydocs.org, asipp.org, ajnr.org
  - professional.heart.org (AHA meetings), cytopathology.org, asma.org, arvo.org future meetings, pedsendo.org future meetings, cmscscholar.org
  - ocfp.on.ca, ce.urmc.rochester.edu, ce.ochsner.org, ccme.pitt.edu, education.aanp.org
- **robots.txt:**
  - mafp.org, entnet.org, cardiometabolichealth.org, ota.org meetings and courses
  - asrs.org calendar, asma-uhms-asm.org
  - ce.mayo.edu `calendar.ics` (now disallowed)
  - aan.com and asahq.org (as before)
- **Crawl-delay 3600 s:** centralsurg.org and nesurgical.org.
- **Down or unreachable:**
  - worldclasscme.com (502 again), pcics.org (502), nmafp.org (502)
  - cpd.usask.ca, cpd.dal.ca, mcmastercpd.ca, cnsfederation.org, primarycaretoday.ca, encoresymposiums.com, americasherniasociety.org, orthopaedicsummit.com, westerntrauma.org, odac.org, fallclinicalderm.com, wcdconference.com, calacep.org
- **Dates load by script (no dates in the HTML):**
  - aafp.org event list (its calendar page worked), asco.org meetings, AO Foundation courses, pri-med.com listing, eeds.com portals
  - AAO and AES future-meetings pages, ADLM, NAEMSP 2028

## Leads for global-9

1. **Society "future meetings" pages are the richest seam left.** They give 2028 and 2029 editions of meetings whose 2027 rows already exist, and they confirm estimates. Searches like `"future meetings" 2029 <specialty>` found most of this pass's. Specialties not yet covered well: nephrology, rheumatology, urology (AUA's own page; academic AUA at auahq.org), allergy (AAAAI, ACAAI), sleep, hand surgery, foot and ankle, and radiation oncology.
2. **Re-run the sitemap check for the CME companies.** MCE, CME Seminars and CME Vacations had events missing from the data: 5, 3 and 3 were added here. A script that compares their sitemaps with the data's URLs (as `smiss.js` did) finds new events in a minute. NWAS was checked: every missing NWAS page is a webinar, a cruise, an island or an overseas meeting.
3. **WordPress event feeds** (`/wp-json/tribe/events/v1/events`) work on many society sites: fcep.org, oafp.org, aagl.org, aaoms.org, naemsp.org, scahq.org and rheum.ca. Probing more chapter sites is cheap.
4. **There are still 313 US/Canada estimates.** Many of them name a national society whose own meeting page now gives the real city and date. 30 were confirmed this pass.
5. **Canada:**
   - The Sherbrooke CFC colloques (usherbrooke.ca/cfc) are hybrid one-day courses "à la FMSS". They need a page that names Sherbrooke as the city.
   - FMOQ congress dates appear only on the Québec convention centre's calendar so far.
   - The CUA "upcoming events" page lists Canadian uro-oncology forums. Check who organises each forum before adding it.
6. **EthosCE:** probing society subdomains (education., learn., cme., ce.) for `calendar.ics` found only a few events (AAAAI, AATS, ACAAI, NCCN), so this is a weak lead. Baylor Scott & White (ce.bswhealth.com) is the only new health-system host found.
