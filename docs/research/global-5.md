# Data global-5 (26 Nov 2026): US and Canada CME

Branch `data-global-5` (from `data-combined`). This pass added US and Canadian meetings only. Files changed:

- `tools/merge-shards.js`: the same-host, same-start-day rule now compares the event id in the query string on known event platforms (see below).
- `tests/validate.test.js`: a test for that rule.
- `data/shards/global-5.json`: the new rows.
- `tools/official-domains.json`: 4 entries added at the top of the `official` list.
- The rebuilt `data/conferences.js` and this file.

What was left alone:

- No AU/NZ row, AU/NZ shard or `data/courses` file was touched. The 275 AU/NZ rows are byte-identical after the merge, and no existing row changed.
- No UK, Europe or Asia rows were added (a parallel agent is doing those on `data-global-6`).
- Rebuilding from the `data-combined` base with the new shard and merge rule gives a `data/conferences.js` identical to the committed one.

## Merge rule change

Before, two rows on one host with the same start day collided unless their url paths differed. On CloudCME every event is `/default.aspx?P=0&EID=…` (or `/course/courseoverview?P=0&EID=…`), so distinct events on one day were dropped. The rule now adds the event-id parameters to the compared path on:

- `*.cloud-cme.com`: `EID`.
- The EthosCE hosts in use (cme.uchicago.edu, cme.utsouthwestern.edu, cme.baptisthealth.net, cme.wisc.edu, cme.bu.edu, ccehs.upmc.com, cme.healthpartners.com): `nid`, `node`, `eventid`, `event_id`, `course_id`.

Other query strings are still ignored everywhere. The test checks three things: two EIDs on one host and day are both kept; the same EID with other parameters changed is still a duplicate; and on any other host the query string is still ignored. The existing data merges to the same result with or without the change.

The 6 CloudCME rows that global-4 dropped are now in:

- Johns Hopkins: Beacham Geriatrics and Tumulty Topics in Clinical Medicine.
- Cedars-Sinai AI in Medicine Symposium.
- MD Anderson Updates on Cell Therapy Symposium.
- UC Irvine: HoLEP Masterclass and TNT Child & Adolescent Psychiatry.
- UCSF Infectious Diseases in Clinical Practice (Koloa, Kauai).

All 6 pages were read again in this session.

## How pages were read

Every page was fetched in this session (26 Nov 2026 UTC) with a polite client:

- robots.txt was read first. That includes wildcard rules and Crawl-delay (10 s on cmeseminars.com, ce.mayo.edu, cme.ahn.org and cpd.utoronto.ca; 3 s on mceconferences.com).
- Where robots.txt has a group for ClaudeBot or another Anthropic agent, that group was obeyed instead of `*`. medscapelive.com and asahq.org disallow it, so neither was used.
- At least 3.2 s between requests to one host, a generic User-Agent, and https only (redirects too).
- A 401/403/429/503, a challenge page or a robots refusal was logged and skipped, never worked around.

CloudCME catalogues were read with the site's own public listing form ("50 results per page" and the page links), with no login. EthosCE catalogue pages (`/course-catalog-list`) returned 403 on every host, so the sites' own `calendar.ics` feed was used as a lead, and each event page was then read.

The evidence follows the same rules as global-4:

- Every `datesQuote` was checked by script against the whitespace-collapsed text of the page it cites. No quote was typed by hand.
- `verifiedOn` is the UTC date the page was read: 2026-11-26 for all 274 rows.
- Each `datesSourceUrl` is an event or event-listing page on the organiser's own site, never a site root. The city comes from the same page.

Rows were left out in these cases:

- The page named only an island, region or park: Maui, Kauai, Kona, Napa Valley, Cape Cod, Walt Disney World, Florida Keys, Lake Tahoe, Jackson Hole, Acadia National Park, and "Grand Wailea, Maui".
- The page gave a venue but no city (for example "Fred Hutchinson Cancer Center", ", UT", or "Morris J. Wosk Centre").
- The event was online, a cruise, or outside the US and Canada (Puerto Rico, USVI, Cayman, Mexico, Costa Rica and others).
- The page said "Venue TBD" or disagreed with itself.
- The event was internal staff training, nursing-only, an NP/PA-only course, grand rounds or a series, or ran under about 4 hours.
- Search results and listing sites (cmelist.com, emedevents.com) were used only as leads.

## Numbers

Conference rows that end on or after 26 Nov 2026:

| | before | after |
|---|---|---|
| Upcoming conferences (all) | 2987 | 3261 |
| Confirmed with evidence | 1565 | 1839 |
| Legacy (not yet re-checked) | 229 | 229 |
| Estimated | 1193 | 1193 |
| Course sessions (`data/courses`, not touched) | 3601 | 3601 |

The database now holds about 6,860 conferences plus course sessions, against the 11,000 target.

- **+274 new rows, all with evidence**: 256 in the US and 18 in Canada.
- By start year: 24 in Nov–Dec 2026, 227 in 2027, 22 in 2028 and 1 in 2029.
- This is below the 600 the brief aimed for. The organiser catalogues that publish dated, city-named US/Canada pages and can be read are mostly used up now; see the leads.

The checks gave these results:

| Check | Result |
|---|---|
| `merge-shards` | ok: 274 new rows applied, 0 invalid, 0 downgrades |
| `validate-data` | 0 errors. Warnings went from 1371 to 1386: 8 rows have no map pin, and 7 are "possible duplicate edition" notes for repeat sessions of one course in a year. |
| `check-courses` | 0 errors (244 courses, 3601 sessions) |
| `check-experiences` | 0 errors, 0 warnings |
| `npm test` | 122 pass, 2 skipped, 0 fail (124 tests, including the new merge test; needs `npm ci` and `NO_PROXY=localhost,127.0.0.1`) |

## New rows by source

| Source (organiser's own pages) | Rows | Notes |
|---|---|---|
| Northwest Anesthesia Seminars / Northwest Seminars (northwestseminars.com) | 72 | Read through the sites' sitemaps. Anesthesia, critical care and EM destination meetings 2026–2028: Sedona, Gatlinburg, Kapolei, Whitefish, Canmore, Stowe, Keystone, Breckenridge, Park City, Key West, Amelia Island, Toronto and others. The quote is the page's own "<title> <place> <dates>" line. "Banff (Canmore)" is entered as Canmore and "Oceanside (San Diego)" as Oceanside. |
| CloudCME catalogues | 34 | Keck USC (14, a host new to the data), the 6 global-4 rows, UArizona (ENT in the Desert, PCH Pediatric Update), plus UF, UC (GUILD Wailea), MCG/GA-SC Radiological Societies (Hilton Head), Henry Ford, HMH, UVA, VCU, SLU, MUSC, Northwestern and St. Jude. |
| CME Seminars (cmeseminars.com/events/…) | 32 | Sarasota, St. Pete Beach, Asheville, Myrtle Beach, Niagara Falls, Key Largo, Gulf Shores, Delray Beach and San Diego. Hybrid (live and webinar). The weekend "Venue TBD" events were left out. |
| MCE Conferences (mceconferences.com) | 26 | Found through the site's own events API, then each page was read. The city is the town named in the page's header (for example "Sedona / Grand Canyon" gives Sedona). Region-only places were left out. |
| National Procedures Institute (npinstitute.com/courses/…) | 24 | Procedural skills course sessions in Austin, Dec 2026 to Sep 2027. |
| Gulfcoast Ultrasound Institute (gcus.com) | 17 | Live hands-on ultrasound courses in St. Petersburg FL. Cadaver-lab variants that share a course's dates were left out. |
| Pri-Med (pri-med.com/cme-conferences/…) | 12 | 8 regional conferences, plus East (Providence), Midwest (Rosemont), South (Fort Lauderdale), Southwest (Houston) and West (Anaheim). The UCLA CloudCME page for Pri-Med West was not added as well (same meeting). |
| AHN, HealthPartners and UW–Madison ICEP (EthosCE) | 11 | Pittsburgh, Cranberry Township and Madison. |
| CME Vacations (cmevacations.com/products/…) | 10 | Waikiki, Scottsdale, San Diego, Portland, Orlando, Clearwater and Fort Lauderdale. |
| Educational Symposia (edusymp.com/product/details/…) | 9 | Vail, Phoenix, Las Vegas, Alta (UCSD), La Jolla (UCSD). Cruises were left out. |
| UBC CPD (ubccpd.ca) | 8 | Vancouver, Victoria and Whistler (St. Paul's EM Update 2027). |
| US society meetings | 10 | AUA sections (SESAUA 2027, WSAUA 2027, NCS 2027 and 2028), Western Orthopaedic Association 2027, Obesity Medicine Association 2027–2029, Florida Society of Anesthesiologists 2027, ACP North Carolina Chapter 2027. |
| Mayo Clinic School of CPD | 5 | Microvascular Surgery Skills ×2, What's Hot in ID Pharmacology 2027, Updates in Family Medicine 2028 (Indian Wells), Healthy Living Program. Found from Mayo's `calendar.ics`. |
| Canadian universities | 4 | UCalgary (Banff Rural Anesthesia, Banff Fractures & Dislocations), U of T listings (CPEG Halifax, Canadian Breast Cancer Symposium, Niagara-on-the-Lake). |

## tools/official-domains.json (4 entries at the top)

One host entry for each CloudCME catalogue new to the file: keckusc, hfhs, uc and uarizona (`<name>.cloud-cme.com`), each listing its row ids. The rows' `url` and `datesSourceUrl` are on the same subdomain, so the evidence rule passes without the entries. They record that the subdomain was checked as the institution's own CME catalogue.

## For a person to check

- **Specialty** for multi-topic primary care meetings (MCE, CME Seminars, CME Vacations) was set to General Practice or to the topic the title leads with. For multi-specialty meetings the keyword guess may be rough.
- **No map pin** (Wikidata had no match): Waikiki ×4, Hollywood Beach, Québec City, Neptune NJ and Hilton Head. A pin can be added from `tools/city-coords.json` once someone checks the Wikidata item.
- **Same course, several sessions**: NPI and Gulfcoast list the same course more than once a year. Each session is its own row and page, which gives 7 "possible duplicate edition" warnings.
- **Left out on purpose**, and worth a look:
  - UCSF Camp CME (Acadia National Park).
  - Keck USC Perinatal Medicine (the page says only "Maui").
  - Maui Derm Hawaii 2027 ("Grand Wailea, Maui").
  - Maui Derm NP+PA meetings (NP/PA audience).
  - OSSEO 2027 and IESS 2027, Toronto: the dates are only on the site root.
  - Five MCE pages (Seattle, Amelia Island Aug, Stowe, Jasper, Moab Sep) are titled "Primary Care Update – Program Information Coming Soon!". They were kept with the name shortened to "Primary Care Update", because the dates and town are on the page; MCE has not yet published those programmes.

## Blocked hosts (skipped, not bypassed)

- **403, challenge or 503:**
  - EthosCE `/course-catalog-list` on cme.uchicago.edu, cme.utsouthwestern.edu, cme.bu.edu, cme.ahn.org, ce.icep.wisc.edu, cme.healthpartners.com and cmeonline.baptisthealth.net. Their event pages loaded.
  - ccehs.upmc.com (all pages).
  - cmecatalog.hms.harvard.edu, medicine.providencehealthcare.org, hmpglobalevents.com (challenge), scct.org, southernsurgical.org, sesprs.org, sages.org, familydocs.org, aapl.org, painweek.org (503), and one edusymp.com product page (challenge).
- **robots.txt:**
  - medscapelive.com/.org and asahq.org disallow ClaudeBot.
  - healio.com/events, cme.vcu.edu and scripps.org.
  - aan.com, acog.org and pimed.com have AI-agent groups that disallow these paths.
- **Unreachable or rendered by script:**
  - worldclasscme.com (502 all session).
  - courses.ccme.org (dates load by script).
  - mcgill.ca CPD (404 at the usual paths).
  - McMaster, Dalhousie and the UAlberta CPD paths did not resolve.

## Leads for global-6 and later

1. **CloudCME is close to exhausted.** global-4 probed about 950 names and this pass about 640 more. The new hosts that answered were keckusc, uarizona, hfhs, uc, utoledo, rutgers, northernlight, integris, stanfordhealthcare and aaoa; most have few live rows. A host's `p=4000` search adds only grand rounds and RSS series.
2. **EthosCE `calendar.ics`** works where the catalogue list is blocked. It worked on ce.mayo.edu, cme.ahn.org, cme.healthpartners.com and ce.icep.wisc.edu, and gave 0 events on cme.uchicago.edu, cme.utsouthwestern.edu and cme.bu.edu. Try it on the other EthosCE hosts in `g4tools/ethos_probe*.txt`.
3. **Destination CME organisers not yet used:**
   - World Class CME (try again; it was down).
   - Encore Symposiums and destinationCME (anesthesia).
   - Creighton lifelong learning (Primary Care Conference Hawaii 2027, Lahaina).
   - The NWAS Maui/Kauai/Kona meetings, if a town is ever named.
4. **US regional societies.** Their homepages carry 2027 dates, but the dates have to come from the meeting's own page:
   - SCSAUA 106th (Fort Worth, Sep 2027; only on the site root so far).
   - MAOA 2027 (no city on the page).
   - Central, Western and Pacific Coast Surgical (DNS failed).
   - AAFP state chapters, state anesthesia societies, and the Southern/Western Neurosurgical Societies.
5. **Canada:**
   - Toronto's other programmes are mostly online.
   - UBC lists about 155 activities, of which 8 were in-person and city-named.
   - McGill, McMaster, Dalhousie and UAlberta need their current CPD URLs. A search found none.
