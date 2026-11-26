# Data global-7 (26 Nov 2026)

Branch `data-global-7` (from `data-combined`). This pass added new meetings and course sessions outside AU/NZ and the US/Canada. Files changed:

- `data/shards/global-7.json`: 399 new rows, all with evidence.
- `data/shards/provenance-global-7.json`: evidence for 6 existing estimates.
- `data/shards/fix-global-7.json`: names and blurbs for those 6 rows.
- `tools/official-domains.json`: 4 entries added at the end of the `official` list.
- The rebuilt `data/conferences.js` and this file.

Left alone: AU/NZ rows and shards, `data/courses`, `tools/merge-shards.js`, and US/Canada rows (none added).

## How pages were read

- Every page was fetched in this session (26 Nov 2026 UTC) with the repo's polite client (`tools/courses/http.js`): robots.txt first (including the Claude and Anthropic agent names), at least 3.3 s between requests to one host and one request at a time per host, a generic User-Agent, https only. A 401/403, a bot challenge or a robots refusal was logged and skipped.
- Every `datesQuote` was checked by script against the whitespace-collapsed visible text of the page it cites. Quotes were sliced from the page text by script, never typed. `verifiedOn` is the UTC date the page was fetched (2026-11-26 for every row).
- `datesSourceUrl` is always an event, course or listing page, never a site root.
- The city is one the organiser page names: directly, in an address (for Japan, a `…市` name or a Tokyo ward), or in a venue name that contains it. Rows were left out where the venue gave no city (for example Wink Aichi, Toshi Center Hotel, Kaiun Club, Chungnam National University Hospital).
- Only meetings run by the society whose page was read were added. Society calendars also list other organisers' events; those were left out, as were pages marked tentative (予定, "voraussichtlich", "to be confirmed").
- Search results, UMIN's meeting lists and society link pages were used only as leads.
- **Course end dates.** RCGP Minor Surgery "Entry Level" listings give only the start date; their descriptions say "two day", so the end date is the next day. No length was assumed elsewhere.
- **Map pins.** Cities new to the data were pinned from Wikidata P625 (query.wikidata.org, read 26 Nov 2026): Nishinomiya Q243853, Tsukuba Q273863, Tokushima Q207309, Miyazaki Q204308, Aomori Q146790, Toyonaka Q467479, Akita Q17139, Fukui Q201618, Saga Q209766, Fujisawa Q386661, Kochi Q200251, Yamaguchi Q207876, Suita Q653510, Urayasu Q319729, Cheonan Q42146, Daegu Q20927, Jeju Q42142, Gangneung Q42056, Leicester Q83065, Swindon Q894093, Norwich Q130191, Oxford Q20986484, York Q42462, Belfast Q10686, Sligo Q190002, Drogheda Q207223, Kilkenny Q109092, Letterkenny Q952497, Malahide Q987748, Noordwijkerhout Q848988, Arnhem Q1310, 's-Hertogenbosch Q9807, Linz Q41329, Interlaken Q68103, Montreux Q69354, St. Gallen Q25607, Kolding Q27119, Aarhus Q25319, Aalborg Q25410, Odense Q25331, Fredericia Q21181, Malmö Q2211, Coimbra Q45412, Aveiro Q485581, Palermo Q2656, Turin Q495, Riccione Q111888, Siena Q2751, Tours Q288, Montpellier Q6441, Caen Q41185, Oviedo Q1422536, Málaga Q8851, Valladolid Q8356, Las Palmas de Gran Canaria Q11974, Vitoria-Gasteiz Q14318, Zaragoza Q10305, Lübeck Q1008372, Bremen Q1209, Bonn Q586, Erfurt Q1729, Kiel Q1008312, Augsburg Q2749, Würzburg Q10458, Düsseldorf Q1718, Hannover Q1715, Freiburg Q1008181, Essen Q2066, Hamburg Q1055, Kurnool Q3635276. They were not added to `tools/city-coords.json`.

## Numbers

| | before | after |
|---|---|---|
| Upcoming conferences (end on or after 26 Nov 2026) | 3164 | 3563 |
| Confirmed with evidence (upcoming) | 1748 | 2153 |
| Legacy (upcoming) | 229 | 229 |
| Estimated (upcoming) | 1187 | 1181 |
| Course sessions (`data/courses`, not touched) | 3601 | 3601 |
| **Conferences plus course sessions** | **6765** | **7164** |

The target is 11,000, so about 3,840 more are needed.

- **+399 new rows, all with evidence.** By start year: 61 in 2026, 298 in 2027, 27 in 2028 and 13 in 2029.
- By country: JP 90, GB 70, IE 59, DE 50, CH 19, DK 17, FR 16, KR 14, IT 13, ES 13, AT 12, NL 11, PT 5, SE 5, BE 3, IN 2.
- **6 estimates confirmed** (provenance entries, with fixes to name and blurb):

| Row | Now | Was |
|---|---|---|
| dggg-kongress-2028 | 11–14 Oct 2028, Leipzig | 4 Oct, Munich |
| jfhod-2027 | 11–14 Mar 2027, Paris | 25 Mar |
| dgg-gefaesschirurgie-kongress-2027 | 22–25 Sep 2027, Dresden | 8 Sep, Berlin |
| dgg-gefaesschirurgie-kongress-2028 | 27–30 Sep 2028, Münster | 13 Sep, Hamburg |
| dgho-jahrestagung-2028 | 6–9 Oct 2028, Basel (joint DGHO/OeGHO/SGMO/SGH) | 5 Oct, Leipzig |
| degam-kongress-2027 | 16–18 Sep 2027, Augsburg | 15 Sep, Hamburg |

## Checks

| Check | Result |
|---|---|
| `merge-shards` | ok: 0 invalid, 0 downgrades |
| `validate-data` | 0 errors. Warnings 1375 → 1381: "possible duplicate edition" warnings for branch meetings held more than once a year (JCS Kanto-Koshinetsu, JGES branches) |
| `check-courses` | 0 errors |
| `check-experiences` | 0 errors |
| `npm test` | 121 pass, 2 skipped, 0 fail (needs `npm ci` and `NO_PROXY=localhost,127.0.0.1`) |

## New rows by source

| Source (organiser's own pages) | Rows | Notes |
|---|---|---|
| RCSI course pages (rcsi.com/online/find-a-course/cpd/…, rcsi.com/dublin/professional-cpd/cpdss/…/course-details) | 57 | ATLS provider (Dublin, Cork, Galway, Sligo, Kilkenny, Drogheda), Basic Surgical Skills, CCrISP, and CPD-SS one-day courses (endoscopy, ultrasound, robotic surgery module 1, fracture fixation, train the trainer and others). Pages found from RCSI's own sitemaps. |
| Japanese societies (JAMS members and societies linked from their pages) | 90 | Annual meetings for 2027–2029 and branch meetings: JCS regional meetings, JSGE and JGES branch meetings, JATS regional meetings, JSICM, JSPM, JSPC, Japan Geriatrics Society, Japan Lung Cancer Society branches, JSIM regional meetings, JHRS 73rd/74th, CVIT 36th/37th, Japanese Gastroenterological Association 23rd, JSHNS 37th and others |
| RCPSG course and conference pages (rcpsg.ac.uk/education/…?selected_date=) | 30 | Glasgow courses and one-day conferences |
| German societies (DGAV, DGOOC, DGIIN, DGP, DGN, DGA Audiologie, DGA Angiologie, DGI, DTG, GTH, DGKN, DSG, DGPK, DGS, DGPM, DGHM, DGAUM, GMDS, Kniegesellschaft and others) | 50 | Annual meetings and society courses |
| Swiss, Austrian, Dutch, Belgian, Nordic, French, Italian, Spanish and Portuguese societies | 114 | Society congress pages and the society's own course and event calendars (SGAIM, SGG, SOG, SGORL, Swiss Orthopaedics, ÖKG, OEGARI, OEGGG, ÖGN, NVVC, NOV, NOG, NVMO, DSKO, DSAM, SFP, SNFMI, SFR, SFO, SFH, SFORL, SOI, SICM, SIP, SER, SECPRE, SPO and others) |
| UK and Irish societies (BAETS, AUGIS, ABS, BSI, BSCN, British Burn Association EMSB courses, BSSH, BHS, UKKA, Irish Thoracic Society, ISR, RCSEd events and others) | 22 | |
| RCGP (rcgp.org.uk/events listings) | 14 | Minor Surgery Skills courses only |
| Korean societies (KAMS member societies' own pages) | 14 | Spring and autumn meetings and courses with a named city |
| RSTMH, BAPRAS, IAP | 8 | |

## For a person to check

- **Copy lint and duplicates.** Two RCOphth course rows from the society calendar duplicated rows already in the data and were removed.
- **Society calendars with other organisers' events.** Many DACH, Nordic and French society calendars list events run by others (for example ESC, EHRA, pharma symposia, university courses). Those were left out. Their own organiser pages are leads.
- **Dates only given as a start day.** Several meetings show only a start day on the society page (Congrès SEF 2028 Granada, JFHOD 2028, SFSPM 48es Journées 2027, Hokkaido JSIM regional meeting). They were left out.
- **JSIM 2027 schedule** for the Kanto region is a PDF on cdn-naikaprod.pressidium.com; it was not parsed.
- **DOG Kongress 2027** is 30 Sep – 3 Oct 2027 on dog.org, but the page does not name the city, so the existing estimate (22 Sep, Berlin) was not changed.
- **Japanese PCO meeting sites**: only four needed new `official-domains.json` entries (jsprs-kiso2027.umin.jp/outline.html, jsnp68.org, jpn-ga.or.jp, in-tex.com/jaci2027); each was reached from the society's own homepage link.

## Blocked hosts (skipped, not bypassed)

- **Bot challenge:** aga-online.ch, baskonline.com, bgs.org.uk, bts.org.uk, endocrinology.org, era-online.org, esska.org, fogsi.org, fpm.ac.uk, hkcpsych.org.hk, ilae.org, isoukai-expo.jp, msa.net.my, njurmed.se, oaa-anaes.ac.uk, picsociety.uk, rcoa.ac.uk, semfyc.es, separ.es, societe-francaise-neonatalogie.com, theabn.org.
- **403:** barnlakarforeningen.se (some pages), bspghan.org.uk, danskreumatologi.dk, gressco.jp, jpn-geriat-soc.or.jp (some pages), js-phlebology.jp (some pages), kno.nl, procomu.jp, seap.es, sec.es, secardiologia.es, setrasplante.org, sfai.se, sgedssed.ch, sgi-ssmi.ch, sin-neonatologia.it.
- **robots.txt:** center6.umin.ac.jp (disallows Claude agents: UMIN's meeting database), bad.org.uk, baaps.org.uk, easd.org, endocrinologie.nl, internisten.nl, nvog.nl, neuro.se, sfmu.org, simeu.it, sinitaly.org, vascularsociety.org.uk, and several Korean society sites (kscvs.org, kshno.or.kr, radiology.or.kr, rheum.or.kr, surgery.or.kr and others).
- **Failing at the session proxy or HTTP only:** rcp.ac.uk/events, c-linkage.co.jp, eps-cc.co.jp, icsinc.co.jp, jcs-conv.jp and many Korean and Japanese society sites that do not serve https.
- **Rendered by script, no dates in the HTML:** RCGP event detail pages (engage.rcgp.org.uk), ESCMID's "load more" list, RCPI course catalogue (cvent), my.rcr.ac.uk.

## Leads for global-8

1. **Society course calendars work best.** RCSI (sitemaps), RCPSG, DSKO, DGAV, DGIIN and SICM gave many dated sessions per site. Similar calendars to read next: DGOU/AE courses, DGU Akademie, DEGUM (only courses the society runs), the Danish specialty societies' H-kurser pages, SFOG and SFKF (only the society's own courses), and RCSEd events.
2. **Europe: more national societies.** About 840 society homepages were read this pass (lists in this pass's working notes, not committed). Each batch of about 200 gave 40–60 rows. Untouched: Greek, Polish, Czech, Hungarian and Turkish societies (dates in those languages need a parser), most Norwegian and Finnish societies (legeforeningen.no pages list courses without clear order), and regional sections of Italian and Spanish societies.
3. **Japan.** Branch-meeting pages of big societies (JSGE, JCS, JSIM, JDS, JRS, JSN) are the richest source, but many venues give no city. The JSIM 2027 regional schedules are PDFs.
4. **Korea.** KAMS member pages (kams.or.kr/eng/member) list about 200 society homepages; many serve http only or block by robots.txt. Korean pages that do load give spring and autumn meetings with named Seoul, Busan or Daegu venues.
5. **India and South-East Asia.** IAP event-detail pages (iapindia.org/event-details.php?event=N) list state and chapter conferences, but most detail pages returned 404 or had no venue this pass. ISG's events page and MSGH's events page list meetings; most are run by other organisers.
