# Data global-6 (26 Nov 2026)

Branch `data-global-6` (from `data-combined`). This pass added new meetings outside AU/NZ and the US/Canada. Files changed:

- `data/shards/global-6.json`: 177 new rows.
- `data/shards/provenance-global-6.json`: evidence for 6 existing estimates.
- `data/shards/fix-global-6.json`: names and blurbs for those 6 rows.
- `tools/official-domains.json`: 1 entry added at the end of the `official` list (`apicon2027.com`).
- The rebuilt `data/conferences.js` and this file.

Left alone: AU/NZ rows and shards (the 275 AU/NZ rows are byte-identical after the merge), `data/courses`, `tools/merge-shards.js`, and US/Canada rows (none added).

## How pages were read

- Every page was fetched in this session (26 Nov 2026 UTC) with the repo's polite client (`tools/courses/http.js`): robots.txt first, at least 3.3 s between requests to one host, a generic User-Agent, https only. A 401/403, a bot challenge or a robots refusal was logged and skipped.
- Every `datesQuote` was checked by script against the whitespace-collapsed visible text of the page it cites, and `verifiedOn` is the UTC date that page was fetched (2026-11-26 for all rows). Quotes were copied from the page text by script, not typed.
- `datesSourceUrl` is always an event or listing page, never a site root.
- The city is the one the organiser page names, either directly or in a venue name that contains it (for example "Pacifico Yokohama" or "Kobe International Conference Center"). Rows were left out where only a venue with no city was given (Awagin Hall, Sabo Kaikan, Aiina, Wink Aichi, Hokkaido University) or only a prefecture ("Okinawa").
- Search results and listing sites (JAMS's meeting list, BAUS's external events, EAU's calendar entries for other organisers) were used only as leads.
- **Course end dates.** Some RCSEd course pages give only the start date of each session plus the course length ("two-day course", "five-day course"). For those rows the end date was worked out from that stated length. No length was assumed where the page did not give one (NOTSS, Training the Trainers and Basic Skills in Paediatric Surgery were left out).
- **Map pins.** Cities new to the data were pinned from Wikidata P625 (query.wikidata.org, read 26 Nov 2026): Limerick Q133315, Exeter Q134672, Belfast Q10686, Boston (Lincolnshire) Q311975, Hull Q128147, Ashington Q202348, Gurugram Q238508, Okayama Q200078, Kawasaki Q164234, Saitama Q134635, Oita Q199609, Awara Q538623, Shizuoka Q174691, Fukushima Q161176, Hamamatsu Q185125, Bordeaux Q1479, Bristol Q23154, Canterbury Q29303, Bolton Q184579, Ajman Q530171, Newcastle upon Tyne Q1425428, Salford Q47952, Como Q1308, Baghdad Q1530. They were not added to `tools/city-coords.json`.

## Numbers

| | before | after |
|---|---|---|
| Upcoming conferences (end on or after 26 Nov 2026) | 2987 | 3164 |
| Confirmed with evidence (upcoming) | 1565 | 1748 |
| Legacy (upcoming) | 229 | 229 |
| Estimated (upcoming) | 1193 | 1187 |
| Course sessions (`data/courses`, not touched) | 3601 | 3601 |
| **Conferences plus course sessions** | **6588** | **6765** |

The target is 11,000, so about 4,235 more are needed.

- **+177 new rows, all with evidence.** By start year: 20 in 2026, 124 in 2027, 22 in 2028 and 11 in 2029.
- By country: GB 79, JP 67 (66 society rows and PCR Tokyo Valves), NL 5, FR 4, IT 3, AT 3, AE 2, ES 2, DE 2, and one each in IE, IN, ZA, BR, CZ, GR, CH, EE, EG, IQ.
- **6 estimates confirmed** (provenance entries, with fixes to name and blurb):

| Row | Now | Was |
|---|---|---|
| bts-winter-meeting-2027 | 24–26 Nov 2027, London | same dates, estimated |
| bts-winter-meeting-2028 | 22–24 Nov 2028, London | same dates, estimated |
| jsh-annual-meeting (89th JSH) | 8–10 Oct 2027, Fukuoka | same dates, estimated |
| jas-tokyo-2027-expected (59th JAS) | 3–4 Jul 2027, Tokyo | 8–9 Jul |
| jsgs-yokohama-2027-expected (82nd JSGS) | 14–16 Jul 2027, Nagasaki | 15 Jul, Yokohama |
| apicon-jaipur-2027-expected (APICON 2027) | 18–21 Feb 2027, Gurugram | 4 Feb, Jaipur |

## Checks

| Check | Result |
|---|---|
| `merge-shards` | ok: 0 invalid, 0 downgrades |
| `validate-data` | 0 errors. Warnings 1371 → 1375: four "possible duplicate edition" warnings for meetings held twice a year (JGES Tohoku, Chugoku and Shikoku branch meetings; the two RCOG London BPS days). |
| `check-courses` | 0 errors |
| `check-experiences` | 0 errors |
| `npm test` | 121 pass, 2 skipped, 0 fail (needs `npm ci` and `NO_PROXY=localhost,127.0.0.1`) |

## New rows by source

| Source (organiser's own pages) | Rows | Notes |
|---|---|---|
| Japanese societies (JAMS member societies' own meeting pages) | 66 | See below |
| RCSEd course pages (services.rcsed.ac.uk/events-courses/…) | 37 | ATLS, Basic Surgical Skills (Edinburgh ×12, Bolton, Cardiff ×5), HEST-UK, hand, head and neck, ortho core skills, MRCS OSCE, COSMOS, DEVISER, TBQR, True Cut, oncoplastic breast (Ajman), BAETS thyroid and parathyroid masterclass (Birmingham) |
| EAU / ESU (uroweb.org/education-events/…) | 17 | ESU masterclasses (Paris, Amsterdam, Vienna, Como, Hamburg, Barcelona, Geneva, Berlin), EUREP Prague, ESU-Weill Cornell Salzburg, Talent Incubator ×4, Baltic meeting Tallinn, ESU courses in Cairo and Baghdad. Calendar entries run by other organisers were left out. |
| Association of Anaesthetists (Event-Details pages) | 14 | Core Topics Belfast, Midlands, Edinburgh; SAFE Paediatrics Limerick, Boston, Hull, Ashington; London seminars; Scottish joint winter meeting, Glasgow |
| RCPsych conference pages | 14 | Only pages whose title gives the year; the quote is the title plus the date lines under it. Includes the Faculty of Forensic Psychiatry conference in Amsterdam. |
| PCR (pcronline.com/Courses/…) | 8 | GulfPCR-GIM Dubai, SASCI-AfricaPCR Cape Town, PCR London Valves 2027, PCR Tokyo Valves, PCR Rio Valves 2027, AVAM Bordeaux, Alfieri's Bootcamp Milan, PCR Fellows Course Paris |
| BTS | 5 | Summer Meetings 2027, 2028 (Newcastle) and 2029 (Manchester), Winter Meeting 2029, Respiratory Clinical Research Training Day (Birmingham). The short courses are all online and were left out. |
| RCPCH | 3 | NPDA conference (London), St David's Day (Cardiff), Technology conference (Sheffield) |
| ECNP | 3 | GALENOS and Roadmap meetings (Amsterdam), Early Career Workshop (Nice) |
| RCEM | 2 | Wales study day (Cardiff), EMTA 2027 (Liverpool) |
| RCOG | 2 | Basic Practical Skills, London, 27 and 28 Jan 2027 |
| BSR | 2 | Nailfold capillaroscopy (Salford), paediatric trainees meeting (Newcastle) |
| Others | 4 | ICS UK Shock 26 (London), SAM/FPM joint meeting (London), ESGO cervical cancer course (Milan), IAPSMCON 2027 (Bhubaneswar) |

### Japanese societies (66 rows)

Method: the 145 JAMS member pages (jams.med.or.jp/members-s/) give each society's English name and homepage. Meeting pages were found from homepage links (two hops), read on the society's own domain, and parsed for 会期 lines (Western and Reiwa years). Only the society's own national meeting, or a named branch meeting with a venue that names its city, was added. Rows already in the data were skipped.

Rows include: JST 63rd (Hakodate), JRS 68th (Hakodate), JACS 44th/45th, JSRE 50th/51st plus the bronchoscopy meetings and seminar, JSRM 26th, JSMRM 55th, JSPNM 64th/65th, Japanese Cancer Association 86th–88th, JSICM 55th/56th (the 56th is held with the 20th World Congress of Intensive and Critical Care, Kyoto 2029), JSPHO 69th, JSPN 124th/125th, JSPM 34th, JSTH 50th, JSPH 86th/87th, PSJ 104th, JES 60th, JSOM 77th, JSES 42nd, JSP 117th, 74th autumn and 23rd conference, JSSMR 69th, JGES 115th and 10 JGES branch meetings, JSIR 58th, JAES 39th/40th, JSPE 60th (with IMPE 2027) and 61st, Japanese Society for Hygiene 97th, three Clinical Endocrinology and Metabolism Updates, JSA 78th, JAMI ×6, JSN 72nd, JSHBPS 39th/40th, and 4 JSPEN branch meetings.

## For a person to check

- **Same host and day, dropped by the merge rule.** Association of Anaesthetists "Core Topics Exeter 2027" (25 Feb 2027) shares its host, path (`/Events/Event-Details.aspx`) and start day with the Neurological Disease seminar, and the JGES 117th Kinki branch meeting (12 Dec 2026) shares its listing page and day with the Kanto branch meeting. Both were left out.
- **Pages marked tentative** (予定) were left out: JSPCCS 64th (2028, Nagoya), the JSPM/JPOS joint meeting 2028 (Kobe), JSMRM 57th (2029).
- **JSICM regional meetings** for 2027 are listed with the label 開催終了 ("finished") on jsicm.org/meeting/local.html, so they were not added.
- **IAPACON 2027** (Patna, 12–14 Feb 2027) gives its dates only on `index.php`, which the evidence rule treats as a site root, and the other pages failed to load.
- **BAPEN** lists the Edgbaston Clinical Nutrition Course (Birmingham, 10–11 May 2027), but the page does not say BAPEN runs it.

## Blocked hosts (skipped, not bypassed)

- **Bot challenge:** acadmed.org.my, bgs.org.uk, ehra.org, esgar.org, ficm.ac.uk, ilae.org, isoukai-expo.jp.
- **403:** bhrs.com, eacr.org, gressco.jp, jsmez.org.
- **robots.txt:** awmf.org (member list), ess.jjkkpro.jp, services.rcsed.ac.uk/events-courses/event-entry (the course pages themselves are allowed).
- **Rendered by script, no dates in the HTML:** ESMO meeting pages, the uroweb events list (the event pages work), ESNR courses, EANM events.
- **Failing at the session proxy:** bcs.com, bsac.org.uk, cardiol.br, eaes.eu, efim.org, emiratesmedicalassociation.org, esns.eu, esrafrica.org, esur.org, sbem.org.br, wfns.org, wpanet.org, and Japanese society sites japanthyroid.jp, nichigan.or.jp, jeaweb.jp, jssr.jp, jsts.gr.jp, jsco.or.jp.

## Leads for global-7

1. **Japan, beyond JAMS.** The JAMS member method gave 66 rows from about 30 societies. Next: subspecialty societies outside JAMS, and the many societies whose 2027 meeting is only on a PCO site (congre.co.jp, c-linkage.co.jp, site2.convention.co.jp). Those pages are not site roots and need one `official-domains.json` entry per meeting path, checked against the society's own link.
2. **UK course catalogues with session lists:** RCSEd gave 37 rows. Similar catalogues to read: RCS England (rendered by script), RCPSG, RCSI and RCPI (their usual paths gave 404s), the Association of Anaesthetists' later 2027 dates, and RCOG eventsair as it adds 2027 sessions.
3. **PCR and EAU/ESU** add courses all year. They are worth re-reading every month.
4. **India:** conference sites (APICON, IAPSMCON) give dates on subpages. Look for USICON 2027 (Lucknow), IAPACON 2027 and others, one by one.
5. **Most society congresses for 2027 and 2028 are already in the data.** Most new rows now come from courses, branch meetings and section meetings, and those need one source at a time.
