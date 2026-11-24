# x10-intl-conf: international and regional society meetings outside AU/NZ

Run date: 18 Nov 2026. Agent tag: `intl-conf`. Scope: specialty gaps outside Australia and New Zealand (another agent covers AU/NZ), editions starting Nov 2026 to Dec 2028.

## What was done

1. Counted upcoming rows per canonical specialty and region in `data/conferences.js` (start of run: 2,040 upcoming rows, none with B30 evidence; outside AU/NZ the thinnest specialties had 0 to 3 rows with any confirmation).
2. Built candidate lists of the main international, regional (Europe, North America, Asia-Pacific) and UK college meetings for every specialty, starting with the thinnest ones (addiction, clinical pharmacology, forensic, hand, nuclear, obesity, occupational, paediatric surgery, reproductive, transplantation, vascular, wound care, then the rest).
3. Read each organiser or society page in this run with the polite client in `tools/courses/http.js` (robots.txt honoured, at least 3.5 s between requests to a host, generic User-Agent, https only; Cloudflare challenges, CAPTCHAs, 401/403 and robots refusals were recorded and skipped, never worked around). Dates were taken with `tools/dates/extract.js`; each quote is copied from the page text, at most 200 characters, and contains the start day. Where a page gave dates in a table with the year in a separate column (ASHG, AAN, ASA, ACS, ISAM) the quote is the exact table text and was checked as a substring of the page.
4. Aggregators (showsbee, clocate, oncodaily, luminik, healthmanagement.org, pubrica, emedevents, conferenceinc and similar) and web search were used only to find the organiser's page. No date in either shard comes from them.
5. Before adding a row the builder checked the series key and year, the merge's own name/year key and host+start key against `data/conferences.js`. When the meeting was already there (legacy or estimated) an evidence entry was written to the provenance shard instead (format as `tools/verify-dates.js` writes it, with `datesSourceUrl`, `datesQuote`, `verifiedOn: 2026-11-18`, and city/country/pin when the page shows the meeting has moved).
6. Ran `tools/verify-dates.js` (on temp copies, eight host-disjoint groups) over the soonest legacy/estimated rows outside AU/NZ in specialties with 30 or fewer upcoming rows; its evidence entries for rows not already covered are included in the provenance shard with the note "x10-intl-conf via tools/verify-dates.js".
7. Validated on a temp copy of the repo: `node tools/merge-shards.js --dry`, then the merge and `node tools/validate-data.js` with both shards in place.

No CPD hours were added (all new rows have `cpdHours: 0`). Blurbs are plain ("<organiser> meeting for <specialty> clinicians and researchers, held in <city>, <country>.") and pass the copy lint.

## Counts per specialty (upcoming rows, all regions)

Before = merge of every shard in the repo without the two x10 shards; after = the same with them. Evidence = confirmed with datesSourceUrl/datesQuote/verifiedOn. Legacy = confirmed before 17 Nov 2026, source not re-checked.

| Specialty | Before: all (evidence / legacy / est) | After: all (evidence / legacy / est) | Outside AU/NZ with evidence, after |
|---|---|---|---|
| Medical Ethics | 1 (0 / 1 / 0) | 2 (1 / 1 / 0) | 1 |
| Vascular Medicine | 1 (1 / 0 / 0) | 1 (1 / 0 / 0) | 0 |
| Forensic Medicine | 2 (0 / 0 / 2) | 3 (2 / 0 / 1) | 2 |
| Nuclear Medicine | 2 (0 / 0 / 2) | 2 (0 / 0 / 2) | 0 |
| Indigenous Health | 3 (1 / 0 / 2) | 4 (2 / 0 / 2) | 1 |
| Medical Physics | 3 (2 / 1 / 0) | 3 (3 / 0 / 0) | 1 |
| Medical Research | 3 (0 / 1 / 2) | 4 (1 / 1 / 2) | 1 |
| Paediatric Surgery | 3 (0 / 0 / 3) | 3 (0 / 0 / 3) | 0 |
| Wound Care | 3 (0 / 0 / 3) | 4 (3 / 0 / 1) | 3 |
| Addiction Medicine | 4 (0 / 0 / 4) | 5 (2 / 0 / 3) | 2 |
| Clinical Pharmacology & Toxicology | 4 (0 / 0 / 4) | 5 (1 / 0 / 4) | 1 |
| General Medicine | 4 (1 / 1 / 2) | 4 (1 / 1 / 2) | 0 |
| Hand Surgery | 4 (0 / 0 / 4) | 6 (2 / 0 / 4) | 2 |
| Occupational Medicine | 4 (0 / 0 / 4) | 5 (3 / 0 / 2) | 3 |
| Sleep Medicine | 4 (0 / 1 / 3) | 5 (1 / 1 / 3) | 1 |
| Health Management | 5 (1 / 0 / 4) | 6 (2 / 0 / 4) | 1 |
| Optometry | 5 (0 / 1 / 4) | 6 (2 / 0 / 4) | 2 |
| Oral & Maxillofacial Surgery | 5 (0 / 1 / 4) | 5 (0 / 1 / 4) | 0 |
| Transplantation | 5 (0 / 0 / 5) | 7 (2 / 0 / 5) | 2 |
| Obesity Medicine | 6 (0 / 0 / 6) | 6 (0 / 0 / 6) | 0 |
| Spine Surgery | 6 (0 / 1 / 5) | 8 (3 / 1 / 4) | 3 |
| Sexual Health | 7 (1 / 2 / 4) | 8 (3 / 2 / 3) | 2 |
| Health Services Research | 8 (0 / 3 / 5) | 9 (7 / 0 / 2) | 7 |
| Radiation Oncology | 8 (0 / 1 / 7) | 8 (0 / 1 / 7) | 0 |
| Reproductive Medicine | 8 (0 / 0 / 8) | 8 (0 / 0 / 8) | 0 |
| Immunology | 9 (1 / 5 / 3) | 9 (2 / 4 / 3) | 1 |
| Pain Medicine | 9 (1 / 2 / 6) | 10 (2 / 2 / 6) | 1 |
| Vascular Surgery | 9 (0 / 0 / 9) | 10 (2 / 0 / 8) | 2 |
| Cardiothoracic Surgery | 10 (1 / 1 / 8) | 11 (3 / 0 / 8) | 2 |
| Health Informatics | 10 (0 / 2 / 8) | 11 (1 / 2 / 8) | 1 |
| Neurosurgery | 10 (0 / 2 / 8) | 12 (3 / 1 / 8) | 3 |
| Nutrition | 11 (1 / 2 / 8) | 11 (2 / 1 / 8) | 1 |
| Medical Education | 12 (1 / 8 / 3) | 14 (8 / 3 / 3) | 7 |
| Allergy & Immunology | 14 (0 / 9 / 5) | 14 (3 / 6 / 5) | 3 |
| Palliative Care | 14 (1 / 4 / 9) | 14 (5 / 1 / 8) | 4 |
| Plastic Surgery | 15 (1 / 2 / 12) | 16 (3 / 1 / 12) | 2 |
| Sports Medicine | 15 (0 / 5 / 10) | 15 (2 / 3 / 10) | 2 |
| Rehabilitation Medicine | 16 (2 / 9 / 5) | 19 (8 / 6 / 5) | 6 |
| Genetics | 18 (1 / 9 / 8) | 18 (4 / 6 / 8) | 3 |
| Otolaryngology (ENT) | 20 (0 / 5 / 15) | 20 (2 / 3 / 15) | 2 |
| Allied Health | 21 (4 / 2 / 15) | 22 (6 / 1 / 15) | 2 |
| Geriatrics | 23 (1 / 3 / 19) | 25 (6 / 2 / 17) | 5 |
| Critical Care | 26 (1 / 7 / 18) | 28 (8 / 2 / 18) | 7 |
| Dentistry | 30 (1 / 11 / 18) | 31 (9 / 5 / 17) | 8 |
| Emergency Medicine | 31 (4 / 11 / 16) | 31 (8 / 8 / 15) | 4 |
| Pharmacy | 35 (2 / 10 / 23) | 36 (3 / 10 / 23) | 1 |
| Public Health | 35 (2 / 20 / 13) | 35 (10 / 12 / 13) | 8 |
| Rheumatology | 35 (2 / 12 / 21) | 35 (4 / 11 / 20) | 2 |
| Pathology | 37 (2 / 15 / 20) | 37 (3 / 14 / 20) | 1 |
| Urology | 38 (0 / 8 / 30) | 39 (2 / 7 / 30) | 2 |
| Respiratory | 40 (1 / 19 / 20) | 40 (4 / 16 / 20) | 3 |
| Infectious Disease | 42 (3 / 15 / 24) | 43 (8 / 12 / 23) | 5 |
| Nephrology | 44 (1 / 17 / 26) | 46 (10 / 10 / 26) | 9 |
| Dermatology | 45 (1 / 15 / 29) | 47 (8 / 12 / 27) | 7 |
| Gastroenterology | 46 (0 / 16 / 30) | 50 (5 / 15 / 30) | 5 |
| Haematology | 51 (0 / 18 / 33) | 56 (8 / 15 / 33) | 8 |
| Internal Medicine | 52 (1 / 14 / 37) | 52 (3 / 12 / 37) | 2 |
| Psychiatry | 54 (9 / 10 / 35) | 56 (17 / 6 / 33) | 8 |
| Nursing | 57 (11 / 18 / 28) | 60 (17 / 15 / 28) | 6 |
| Ophthalmology | 60 (0 / 21 / 39) | 61 (4 / 18 / 39) | 4 |
| Endocrinology | 67 (1 / 20 / 46) | 69 (6 / 17 / 46) | 5 |
| Paediatrics | 67 (2 / 25 / 40) | 70 (7 / 23 / 40) | 5 |
| Orthopaedics | 68 (9 / 17 / 42) | 68 (13 / 14 / 41) | 4 |
| General Practice | 70 (3 / 13 / 54) | 72 (11 / 9 / 52) | 8 |
| Anaesthesia | 74 (6 / 15 / 53) | 74 (9 / 12 / 53) | 3 |
| Neurology | 85 (1 / 30 / 54) | 87 (9 / 26 / 52) | 8 |
| Obstetrics & Gynaecology | 93 (5 / 22 / 66) | 96 (11 / 19 / 66) | 6 |
| Oncology | 96 (5 / 30 / 61) | 100 (16 / 27 / 57) | 11 |
| Radiology | 101 (3 / 44 / 54) | 104 (17 / 34 / 53) | 14 |
| Surgery | 108 (3 / 36 / 69) | 108 (17 / 24 / 67) | 14 |
| Cardiology | 155 (4 / 56 / 95) | 156 (13 / 48 / 95) | 9 |

| Region | Before: all (with evidence) | After: all (with evidence) |
|---|---|---|
| Africa | 67 (0) | 67 (3) |
| Asia-Pacific | 591 (105) | 609 (127) |
| Europe | 576 (0) | 615 (114) |
| Latin America | 221 (0) | 221 (5) |
| Middle East | 81 (0) | 81 (6) |
| North America | 550 (0) | 572 (109) |

## New rows (79, all confirmed with evidence)

| Specialty | Meeting | Dates | City | Source page |
|---|---|---|---|---|
| Addiction Medicine | ISAM 2027 Annual Congress | 2027-08-26 to 2027-08-28 | Seattle, United States | <https://isamweb.org/annual/> |
| Allied Health | ASHT 50th Annual Meeting 2027 | 2027-10-14 to 2027-10-16 | Portland, United States | <https://meetings.asht.org/future-annual-meeting-dates> |
| Cardiology | CSI Frankfurt 2027 | 2027-07-07 to 2027-07-10 | Frankfurt, Germany | <https://www.csi-congress.org/conferences/csi-frankfurt> |
| Cardiothoracic Surgery | SCTS Annual Meeting 2028 | 2028-03-12 to 2028-03-14 | Liverpool, United Kingdom | <https://scts.org/upcoming_meeting_and_scts_university/default.aspx> |
| Clinical Pharmacology & Toxicology | EACPT 2027 Congress | 2027-06-26 to 2027-06-29 | Lille, France | <https://eacpt.org/category/meetings/upcoming-meetings/> |
| Critical Care | ESICM Intensive Care Innovation 2027 | 2027-02-04 to 2027-02-05 | Milan, Italy | <https://www.esicm.org/events/intensive-care-innovation2027/> |
| Critical Care | ESICM LIVES Physiology - Transbiology 2027 | 2027-06-03 to 2027-06-05 | Athens, Greece | <https://www.esicm.org/events/lives-physiology-transbiology/> |
| Dentistry | FDI World Dental Congress 2027 | 2027-10-21 to 2027-10-24 | Mumbai, India | <https://2027.world-dental-congress.org/FDI/congress-info> |
| Dermatology | ESDR Annual Meeting 2027 | 2027-09-01 to 2027-09-04 | Toulouse, France | <https://esdr.org/events-esdr/esdr-annual-meetings/> |
| Dermatology | ISID Meeting 2028 (International Societies for Investigative Dermatology) | 2028-05-17 to 2028-05-20 | Vienna, Austria | <https://esdr.org/events-esdr/esdr-annual-meetings/> |
| Endocrinology | ATTD-ASIA 2026 | 2026-12-09 to 2026-12-11 | Kyoto, Japan | <https://attd.kenes.com/conferences/> |
| Endocrinology | ATTD 2027 | 2027-03-03 to 2027-03-06 | Paris, France | <https://attd.kenes.com/conferences/> |
| Forensic Medicine | IALM 2027 Congress | 2027-05-18 to 2027-05-21 | The Hague, Netherlands | <https://ialm.info/ialm-meetings/> |
| Gastroenterology | APASL Single Topic Conference 2026 Dhaka | 2026-12-05 to 2026-12-06 | Dhaka, Bangladesh | <https://www.apasl.info/conferences.php> |
| Gastroenterology | APASL Single Topic Conference 2027 Kaohsiung | 2027-06-25 to 2027-06-27 | Kaohsiung, Taiwan | <https://www.apasl.info/conferences.php> |
| Gastroenterology | APASL Single Topic Conference 2027 Danang | 2027-07-23 to 2027-07-24 | Da Nang, Vietnam | <https://www.apasl.info/conferences.php> |
| Gastroenterology | APASL Single Topic Conference 2027 Chongqing | 2027-10-08 to 2027-10-10 | Chongqing, China | <https://www.apasl.info/conferences.php> |
| General Practice | STFM Conference on Practice and Quality Improvement 2027 | 2027-09-13 to 2027-09-15 | Denver, United States | <https://www.stfm.org/conferences/stfm-conferences/> |
| General Practice | STFM Conference on Practice and Quality Improvement 2028 | 2028-08-28 to 2028-08-30 | Kansas City, United States | <https://www.stfm.org/conferences/stfm-conferences/> |
| Geriatrics | EuGMS 2027 Congress | 2027-09-22 to 2027-09-24 | Florence, Italy | <https://www.eugms.org/events/eugms-congress> |
| Geriatrics | EuGMS 2028 Congress | 2028-09-27 to 2028-09-29 | Krakow, Poland | <https://www.eugms.org/events/eugms-congress> |
| Haematology | WFH 2027 Comprehensive Care Summit | 2027-04-14 to 2027-04-16 | Prague, Czechia | <https://wfh.org/ccs/> |
| Haematology | ISBT Rotterdam 2027 | 2027-06-19 to 2027-06-23 | Rotterdam, Netherlands | <https://www.isbtweb.org/events/future.html> |
| Haematology | ISBT Delhi 2027 Regional Congress | 2027-11-27 to 2027-11-30 | Delhi, India | <https://www.isbtweb.org/events/future.html> |
| Haematology | WFH 2028 World Congress | 2028-04-30 to 2028-05-03 | Chicago, United States | <https://wfh.org/wfh-events/> |
| Haematology | ISBT Yokohama 2028 | 2028-06-04 to 2028-06-08 | Yokohama, Japan | <https://www.isbtweb.org/events/future.html> |
| Hand Surgery | XXXII FESSH Congress 2027 | 2027-06-02 to 2027-06-05 | Prague, Czechia | <https://fessh.com/future-fessh-congresses/> |
| Hand Surgery | XXXIII FESSH Congress 2028 | 2028-06-28 to 2028-07-01 | Strasbourg, France | <https://fessh.com/future-fessh-congresses/> |
| Health Informatics | Medical Informatics Europe (MIE) 2027 | 2027-04-26 to 2027-04-30 | Tallinn, Estonia | <https://efmi.org/conferences-journals/mie-confererence/> |
| Health Management | ISQua 43rd International Conference 2027 | 2027-09-19 to 2027-09-22 | Vancouver, Canada | <https://isqua.org/conference/vancouver-2027/> |
| Health Services Research | HTAi 2027 Annual Meeting | 2027-06-12 to 2027-06-16 | Brussels, Belgium | <https://htai.org/event/htai-2027-annual-meeting-2/> |
| Indigenous Health | PRIDoC 2026 (Pacific Region Indigenous Doctors Congress) | 2026-11-30 to 2026-12-04 | Taoyuan, Taiwan | <https://www.aaip.org/events/pridoc-2026-november-30-december-4> |
| Infectious Disease | 7th ESCMID Conference on Vaccines 2027 | 2027-09-22 to 2027-09-24 | Lisbon, Portugal | <https://www.escmid.org/congress-events/escmid-conference-on-vaccines/> |
| Medical Education | STFM Conference on Medical Student Education 2027 | 2027-02-05 to 2027-02-07 | Anaheim, United States | <https://www.stfm.org/conferences/stfm-conferences/> |
| Medical Education | STFM Conference on Medical Student Education 2028 | 2028-01-27 to 2028-01-29 | New Orleans, United States | <https://www.stfm.org/conferences/stfm-conferences/> |
| Medical Ethics | ASBH 2027 Annual Conference | 2027-10-27 to 2027-10-30 | Columbus, United States | <https://asbh.org/annual-meeting/> |
| Medical Research | FENS Forum 2028 | 2028-07-08 to 2028-07-12 | Glasgow, United Kingdom | <https://www.fens.org/meetings/fens-forum/past-forums> |
| Nephrology | World Congress of Nephrology 2027 | 2027-04-01 to 2027-04-04 | Kuala Lumpur, Malaysia | <https://www.theisn.org/wcn/about/legacy-future/> |
| Nephrology | World Congress of Nephrology 2028 | 2028-04-27 to 2028-04-30 | Montreal, Canada | <https://www.theisn.org/wcn/about/legacy-future/> |
| Neurology | 23rd International Headache Congress (IHC) 2027 | 2027-09-09 to 2027-09-11 | Athens, Greece | <https://ihs-headache.org/en/resources/international-headache-congress-ihc/> |
| Neurology | AAN Fall Conference 2027 | 2027-10-29 to 2027-10-31 | Las Vegas, United States | <https://www.aan.com/conferences-community/upcoming-conference-dates/> |
| Neurosurgery | SBNS Leeds 2027 Meeting | 2027-10-12 to 2027-10-15 | Leeds, United Kingdom | <https://www.sbns.org.uk/event-calendar/leeds-2027.html> |
| Neurosurgery | WFNS 2027 - 20th World Congress of Neurosurgery | 2027-11-16 to 2027-11-20 | Bali, Indonesia | <https://wfns.org/events/14/wfns-official-events/370/wfns-2027-the-20th-world-congress-of-neurosurgery> |
| Nursing | AACN NTI 2027 | 2027-05-04 to 2027-05-05 | Indianapolis, United States | <https://www.aacn.org/conferences-and-events/nti/exhibitors> |
| Nursing | ICN Congress 2027 | 2027-07-08 to 2027-07-11 | Taipei, Taiwan | <https://www.icn.ch/events/icn-congress-2027-worlds-largest-international-gathering-nurses> |
| Nursing | Sigma European Regional Conference 2027 | 2027-07-16 to 2027-07-18 | Dublin, Ireland | <https://www.sigmanursing.org/events> |
| Obstetrics & Gynaecology | RCOG World Congress 2027 | 2027-04-22 to 2027-04-24 | Kuala Lumpur, Malaysia | <https://www.rcog.org.uk/careers-and-training/training/courses-and-events/rcog-world-congress/rcog-world-congress-2027/visit-kuala-lumpur-malaysia/> |
| Obstetrics & Gynaecology | ISUOG World Congress 2027 | 2027-09-13 to 2027-09-16 | Lisbon, Portugal | <https://www.isuog.org/events/isuog-world-congress-2027.html> |
| Obstetrics & Gynaecology | XXVI FIGO World Congress 2027 | 2027-10-31 to 2027-11-05 | Montreal, Canada | <https://congress.figo.org/venue/> |
| Occupational Medicine | ICOH 2027 - 35th International Congress on Occupational Health | 2027-02-14 to 2027-02-19 | Mumbai, India | <https://www.icohweb.org/site/events.asp> |
| Oncology | MASCC/ISOO Annual Meeting 2027 | 2027-06-24 to 2027-06-26 | Rotterdam, Netherlands | <https://mascc.org/meetings/annual-meeting/> |
| Oncology | ASCO Breakthrough 2027 | 2027-06-24 to 2027-06-26 | Singapore, Singapore | <https://www.asco.org/breakthrough> |
| Oncology | SIOG 2027 Annual Conference | 2027-10-28 to 2027-10-30 | Luxembourg, Luxembourg | <https://siog.org/events/siog-events/siog-2027-annual-conference/> |
| Oncology | SIOP 2028 Annual Congress | 2028-09-13 to 2028-09-16 | Istanbul, Turkey | <https://siop-online.org/event/siop-2028/> |
| Ophthalmology | RCOphth Winter Meeting 2026 | 2026-12-07 to 2026-12-08 | Edinburgh, United Kingdom | <https://www.rcophth.ac.uk/courses-and-events/rcophth-winter-meeting-7-8-december-2026/> |
| Optometry | BCLA Clinical Conference & Exhibition 2027 | 2027-06-19 to 2027-06-20 | Birmingham, United Kingdom | <https://www.bcla.org.uk/iCore/Events/Event_display.aspx?EventKey=BCLA2027&WebsiteKey=e545a33e-7198-42c2-b71d-98c5511ba8e5> |
| Paediatrics | EAP Winter Meeting 2026 | 2026-12-04 to 2026-12-05 | Budapest, Hungary | <https://eapaediatrics.eu/eap-winter-meeting-2026-budapest-4-5-dec-2026/> |
| Paediatrics | SAHM 2027 Annual Meeting | 2027-03-02 to 2027-03-05 | Chicago, United States | <https://adolescenthealth.org/2027-annual-meeting/> |
| Paediatrics | SAHM 2028 Annual Meeting | 2028-03-07 to 2028-03-10 | Minneapolis, United States | <https://adolescenthealth.org/meetings/future-sahm-meetings/> |
| Pain Medicine | INS 18th World Congress 2028 | 2028-05-21 to 2028-05-25 | Dublin, Ireland | <https://www.neuromodulation.com/congress> |
| Pharmacy | FIP World Congress of Pharmacy and Pharmaceutical Sciences 2027 | 2027-09-12 to 2027-09-15 | Kuala Lumpur, Malaysia | <https://www.fip.org/fip-congresses> |
| Plastic Surgery | ISAPS World Congress 2027 | 2027-09-01 to 2027-09-04 | London, United Kingdom | <https://www.isaps.org/articles/isaps-blog/2026/isaps-world-congress-post-report-cancun/> |
| Psychiatry | ECNP New Frontiers Meeting 2027 | 2027-03-21 to 2027-03-22 | Nice, France | <https://www.ecnp.eu/meetings/> |
| Psychiatry | 19th World Congress of Biological Psychiatry 2027 | 2027-08-18 to 2027-08-20 | Prague, Czechia | <https://wfsbp-congress.org/congress-2026/2026-jaipur> |
| Radiology | AOCR 2027 (25th Asian Oceanian Congress of Radiology) | 2027-04-29 to 2027-05-02 | Tashkent, Uzbekistan | <https://www.theaosr.org/events> |
| Radiology | ECR 2028 | 2028-03-01 to 2028-03-05 | Vienna, Austria | <https://www.myesr.org/congress/about-ecr/> |
| Radiology | ISMRM 2028 Annual Meeting | 2028-05-13 to 2028-05-18 | Copenhagen, Denmark | <https://www.ismrm.org/meetings-workshops/future-ismrm-meetings/> |
| Rehabilitation Medicine | Physiatry '27 (AAP Annual Meeting) | 2027-02-16 to 2027-02-20 | Long Beach, United States | <https://www.physiatry.org/meetings-events/annual-meeting/> |
| Rehabilitation Medicine | ISPO 21st World Congress 2027 | 2027-03-22 to 2027-03-25 | Bangkok, Thailand | <https://www.ispoint.org/events/ispo-world-congress/> |
| Rehabilitation Medicine | ISPRM 2028 World Congress | 2028-05-14 to 2028-05-18 | Milan, Italy | <https://isprm.org/events/isprm2028-milan-italy/> |
| Sexual Health | Joint ISSM/SMSNA Scientific Meeting 2028 | 2028-10-26 to 2028-10-29 | Miami, United States | <https://www.issm.info/meetings/wmsm> |
| Sleep Medicine | World Sleep 2027 | 2027-09-10 to 2027-09-15 | Montreal, Canada | <https://worldsleepsociety.org/world-sleep-2027-in-montreal/> |
| Spine Surgery | BritSpine 2027 | 2027-04-21 to 2027-04-23 | Newport, United Kingdom | <https://www.britspine.com/abstracts> |
| Spine Surgery | 62nd SRS Annual Meeting 2027 | 2027-09-14 to 2027-09-18 | New Orleans, United States | <https://www.srs.org/SRS-Events/62nd-Annual-Meeting> |
| Transplantation | American Transplant Congress (ATC) 2027 | 2027-06-05 to 2027-06-09 | Seattle, United States | <https://www.atcmeeting.org/Attend/ATC-Dates> |
| Transplantation | American Transplant Congress (ATC) 2028 | 2028-06-03 to 2028-06-07 | Philadelphia, United States | <https://www.atcmeeting.org/Attend/ATC-Dates> |
| Urology | ICS 2027 Annual Meeting | 2027-09-15 to 2027-09-18 | Florence, Italy | <https://www.ics.org/2027> |
| Vascular Surgery | Vascular Society ASM 2026 | 2026-11-25 to 2026-11-27 | Liverpool, United Kingdom | <https://vascularsociety.org.uk/events> |
| Wound Care | Wound Healing Society 2027 Annual Meeting | 2027-04-28 to 2027-05-02 | Philadelphia, United States | <https://woundheal.org/meeting/> |

New rows by specialty: Addiction Medicine 1, Allied Health 1, Cardiology 1, Cardiothoracic Surgery 1, Clinical Pharmacology & Toxicology 1, Critical Care 2, Dentistry 1, Dermatology 2, Endocrinology 2, Forensic Medicine 1, Gastroenterology 4, General Practice 2, Geriatrics 2, Haematology 5, Hand Surgery 2, Health Informatics 1, Health Management 1, Health Services Research 1, Indigenous Health 1, Infectious Disease 1, Medical Education 2, Medical Ethics 1, Medical Research 1, Nephrology 2, Neurology 2, Neurosurgery 2, Nursing 3, Obstetrics & Gynaecology 3, Occupational Medicine 1, Oncology 4, Ophthalmology 1, Optometry 1, Paediatrics 3, Pain Medicine 1, Pharmacy 1, Plastic Surgery 1, Psychiatry 2, Radiology 3, Rehabilitation Medicine 3, Sexual Health 1, Sleep Medicine 1, Spine Surgery 2, Transplantation 2, Urology 1, Vascular Surgery 1, Wound Care 1.

## Existing rows newly evidenced (180)

144 entries written from pages read for this task, 36 from `tools/verify-dates.js` runs on rows outside AU/NZ in thin specialties. Before this run each was legacy (confirmed, source not re-checked) or estimated; after the merge each is confirmed with evidence.

### Corrections to existing rows (34)

| Row | Was | Now (organiser page) |
|---|---|---|
| `cpdd-annual-meeting-2027` (estimated) | 2027-06-12 to 2027-06-15, Denver | 2027-06-26 to 2027-06-30, Toronto |
| `acoem-aohc-2027` (estimated) | 2027-04-25 to 2027-04-28, Denver | 2027-05-02 to 2027-05-05, Austin |
| `acoem-aohc-2028` (estimated) | 2028-04-23 to 2028-04-26, Denver | 2028-05-21 to 2028-05-24, Phoenix |
| `esvs-annual-meeting-2028` (estimated) | 2028-09-26 to 2028-09-29, Athens | 2028-09-19 to 2028-09-22, Luxembourg |
| `ewma-conference-2027` (estimated) | 2027-05-12 to 2027-05-14, Rotterdam | 2027-05-26 to 2027-05-28, Helsinki |
| `ewma-conference-2028` (estimated) | 2028-05-10 to 2028-05-12, Lisbon | 2028-05-10 to 2028-05-12, Amsterdam |
| `nass-annual-meeting-2027` (estimated) | 2027-10-06 to 2027-10-09, Chicago | 2027-09-23 to 2027-09-25, Boston |
| `academyhealth-arm-2027` (estimated) | 2027-06-13 to 2027-06-15, Seattle | 2027-06-12 to 2027-06-15, Boston |
| `academyhealth-arm-2028` (estimated) | 2028-06-11 to 2028-06-13, Seattle | 2028-06-01 to 2028-06-06, St. Louis |
| `asco-gu-symposium-2027` (estimated) | 2027-02-18 to 2027-02-20, San Francisco | 2027-02-11 to 2027-02-13, San Francisco |
| `asco-gi-symposium-2027` (estimated) | 2027-01-14 to 2027-01-16, San Francisco | 2027-01-21 to 2027-01-23, San Francisco |
| `escap-congress-2027` (estimated) | 2027-06-16 to 2027-06-19, Strasbourg | 2027-06-24 to 2027-06-27, Athens |
| `asds-annual-meeting-2028` (estimated) | 2028-10-12 to 2028-10-15, Chicago | 2028-10-26 to 2028-10-29, National Harbor |
| `asnr-annual-meeting-2027` (estimated) | 2027-05-08 to 2027-05-12, Boston | 2027-05-14 to 2027-05-19, San Diego |
| `bashh-spring-conference-2027` (estimated) | 2027-06-02 to 2027-06-04, Manchester | 2027-06-07 to 2027-06-09, Blackpool |
| `bhiva-annual-conference-2027` (estimated) | 2027-04-28 to 2027-04-30, Manchester | 2027-04-26 to 2027-04-28, Leeds |
| `ases-annual-meeting-2027` (estimated) | 2027-10-09 to 2027-10-12, Sun Valley | 2027-10-13 to 2027-10-16, National Harbor |
| `asmbs-annual-meeting-2027` (estimated) | 2027-06-12 to 2027-06-15, Las Vegas | 2027-06-27 to 2027-07-01, Orlando |
| `asmbs-annual-meeting-2028` (estimated) | 2028-06-10 to 2028-06-13, Las Vegas | 2028-06-04 to 2028-06-08, Las Vegas |
| `sno-annual-meeting-2027` (estimated) | 2027-11-19 to 2027-11-22, Vancouver | 2027-11-18 to 2027-11-21, Phoenix |
| `sno-annual-meeting-2028` (estimated) | 2028-11-17 to 2028-11-20, Vancouver | 2028-11-16 to 2028-11-19, Washington, DC |
| `gsa-annual-scientific-meeting-2027` (estimated) | 2027-11-17 to 2027-11-21, Boston | 2027-11-03 to 2027-11-06, Charlotte |
| `gsa-annual-scientific-meeting-2028` (estimated) | 2028-11-15 to 2028-11-19, Boston | 2028-11-01 to 2028-11-04, Minneapolis |
| `ispor-annual-international-meeting-2027` (estimated) | 2027-05-07 to 2027-05-10, Atlanta | 2027-05-23 to 2027-05-26, Denver |
| `aapd-annual-session-2027` (estimated) | 2027-05-27 to 2027-05-30, Denver | 2027-05-27 to 2027-05-30, Washington, DC |
| `stfm-annual-spring-conference-2027` (estimated) | 2027-04-30 to 2027-05-03, Nashville | 2027-05-01 to 2027-05-05, Chicago |
| `stfm-annual-spring-conference-2028` (estimated) | 2028-04-28 to 2028-05-01, Nashville | 2028-04-29 to 2028-05-03, Philadelphia |
| `acr-convergence-2027` (estimated) | 2027-10-28 to 2027-11-01, Chicago | 2027-10-29 to 2027-11-03, San Francisco |
| `ecnp-congress-2028` (estimated) | 2028-10-14 to 2028-10-17, Vienna | 2028-10-07 to 2028-10-10, Copenhagen |
| `aao-orthodontists-annual-session` (legacy) | 2027-06-04 to 2027-06-06, Vancouver | 2027-06-04 to 2027-06-07, Vancouver |
| `aaem-scientific-assembly-2028` (estimated) | 2028-04-23 to 2028-04-27, Las Vegas | 2028-04-02 to 2028-04-06, Denver |
| `ana-annual-meeting-2027` (estimated) | 2027-09-12 to 2027-09-14, Chicago | 2027-09-18 to 2027-09-21, Chicago |
| `ana-annual-meeting-2028` (estimated) | 2028-09-10 to 2028-09-12, Chicago | 2028-09-16 to 2028-09-19, Boston |
| `aafs-annual-scientific-meeting-2027` (estimated) | 2027-02-22 to 2027-02-26, Orlando | 2027-02-15 to 2027-02-20, Orlando |

Evidenced rows by specialty: Addiction Medicine 1, Allergy & Immunology 3, Allied Health 1, Anaesthesia 3, Cardiology 8, Cardiothoracic Surgery 1, Critical Care 5, Dentistry 7, Dermatology 5, Emergency Medicine 4, Endocrinology 3, Forensic Medicine 1, Gastroenterology 1, General Practice 6, Genetics 3, Geriatrics 3, Haematology 3, Health Services Research 6, Immunology 1, Infectious Disease 4, Internal Medicine 2, Medical Education 5, Medical Physics 1, Nephrology 7, Neurology 6, Neurosurgery 1, Nursing 3, Nutrition 1, Obstetrics & Gynaecology 3, Occupational Medicine 2, Oncology 7, Ophthalmology 3, Optometry 1, Orthopaedics 4, Otolaryngology (ENT) 2, Paediatrics 2, Palliative Care 4, Pathology 1, Plastic Surgery 1, Psychiatry 6, Public Health 8, Radiology 11, Rehabilitation Medicine 3, Respiratory 3, Rheumatology 2, Sexual Health 1, Spine Surgery 1, Sports Medicine 2, Surgery 14, Urology 1, Vascular Surgery 1, Wound Care 2.

All evidenced ids: `cpdd-annual-meeting-2027`, `snmmi-annual-meeting`, `acoem-aohc-2027`, `acoem-aohc-2028`, `eshre-annual-meeting`, `esot-congress`, `esvs-annual-meeting`, `esvs-annual-meeting-2028`, `ewma-conference-2027`, `ewma-conference-2028`, `world-physiotherapy-congress-2027-guadalajara`, `aats-annual-meeting`, `sts-annual-meeting`, `aapm-annual-meeting`, `aapm-annual-meeting-2028`, `efic-pain-in-europe-congress`, `croi-conference`, `nass-annual-meeting-2027`, `eurospine-annual-meeting`, `aans-annual-scientific-meeting-2027`, `aans-annual-scientific-meeting-2028`, `cns-annual-meeting-2027`, `cns-annual-meeting-2028`, `aspen-nutrition-science-practice-2027`, `academyhealth-arm-2027`, `academyhealth-arm-2028`, `european-human-genetics-conference`, `rcpsych-international-congress`, `eaaci-sam-2027`, `eacvi-2026`, `eapci`, `acnap-2027`, `association-of-anaesthetists-winter-scientific-meeting`, `aocr-hong-kong-2028`, `aafp-fmx`, `escmid-global`, `acp-internal-medicine-meeting`, `acp-internal-medicine-meeting-2028`, `eadv-congress`, `aad-annual-meeting`, `ueg-week`, `european-congress-of-pathology`, `aaos-annual-meeting`, `efort-congress`, `european-public-health-conference`, `ash-annual-meeting-2026`, `eha-congress`, `asn-kidney-week`, `era-education-cairo`, `ada-scientific-sessions`, `endo-annual-meeting`, `european-congress-of-endocrinology`, `apao-congress`, `ers-sleep-and-breathing-2027`, `ats-international-conference`, `chest-annual-meeting`, `espn-annual-meeting`, `asco-annual-meeting`, `aacr-annual-meeting`, `ean-congress`, `ectrims-2027`, `rsna-annual-meeting-2026`, `rsna-annual-meeting`, `ecr-congress`, `ismrm-annual-meeting-2027`, `esc-congress`, `esc-acute-cardiovascular-care`, `esc-preventive-cardiology`, `esc-cardio-oncology`, `europcr`, `esc-heart-failure`, `ehra-congress`, `asco-gu-symposium-2027`, `asco-gi-symposium-2027`, `esge-days`, `rcpch-conference`, `escap-congress-2027`, `asds-annual-meeting-2027`, `asds-annual-meeting-2028`, `bad-annual-meeting`, `arrs-annual-meeting`, `esgar-annual-meeting`, `asnr-annual-meeting-2027`, `nkf-spring-clinical-meetings-2028`, `bashh-spring-conference-2027`, `bhiva-annual-conference-2027`, `asm-microbe`, `ebmt-annual-meeting`, `sigma-biennial-convention-2027`, `rcn-congress`, `ases-annual-meeting-2027`, `euretina-congress`, `soe-congress-athens-2027`, `asmbs-annual-meeting-2027`, `asmbs-annual-meeting-2028`, `ehs-annual-international-congress`, `sno-annual-meeting-2027`, `sno-annual-meeting-2028`, `aba-annual-meeting`, `gsa-annual-scientific-meeting-2027`, `gsa-annual-scientific-meeting-2028`, `ispor-annual-international-meeting-2027`, `ispor-europe`, `ispor-annual-international-meeting-2028`, `ispor-europe-2028`, `aamc-learn-serve-lead`, `europerio12-2028`, `aapd-annual-session-2027`, `stfm-annual-spring-conference-2027`, `stfm-annual-spring-conference-2028`, `sgim-annual-meeting`, `shm-converge`, `esgo-congress`, `esicm-lives`, `aan-annual-meeting`, `aan-annual-meeting-2028`, `sccm-critical-care-congress`, `sccm-critical-care-congress-2028`, `acr-convergence-2027`, `apa-annual-meeting`, `apa-annual-meeting-2028`, `ecnp-congress`, `ecnp-congress-2028`, `eanm-congress`, `eaaci-congress`, `era-congress`, `era-congress-2028`, `amee-conference`, `ashg-annual-meeting`, `ashg-annual-meeting-2028`, `pas-meeting`, `asgbi-international-surgical-congress-2027`, `asgbi-international-surgical-congress-2028`, `aao-orthodontists-annual-session`, `bsr-annual-conference`, `rcpe-st-andrews-day-symposium-2026`, `ics-state-of-the-art-2027`, `aaem-scientific-assembly-2028`, `ana-annual-meeting-2027`, `ana-annual-meeting-2028`, `asa-anesthesiology`, `acs-clinical-congress`, `eapc-world-congress-2027`, `eau-annual-congress`, `escaide-2026`, `paltmed-annual-meeting`, `aae-annual-meeting`, `eao-congress`, `german-austrian-swiss-sports-traumatology-congress`, `abo-cioce-2027`, `aaem-scientific-assembly`, `adee-annual-meeting`, `plastic-surgery-the-meeting-2028`, `asha-convention-2026`, `wco6-sso-11th-saudi-optometry-conference-2027`, `saem-annual-meeting`, `world-health-summit`, `asha-convention-2027`, `asha-convention-2028`, `eaaci-faam-eurobat-isma-2026`, `iactscon-2027-kolkata`, `smdm-49th-annual-meeting-2027`, `medinfo-dubai`, `africa-health-excel`, `xli-congreso-panamericano-orl-2027-monterrey`, `acorl-curso-internacional-2027-cartagena`, `european-health-management-conference`, `icme-manama`, `sfap-congres-2027`, `nata-clinical-symposia-2027`, `aafs-annual-scientific-meeting-2027`, `aahpm-annual-assembly`, `rcem-annual-conference`, `alergoped-dermaped-2027-rio`, `neurotrauma-new-delhi-2027`, `global-health-exhibition-riyadh`, `aahpm-annual-assembly-2028`, `kash-conference-2027`, `ahaic-2027-kigali`, `eccc-dubai`

## Blocked hosts (skipped, not worked around)

Bot challenge, HTTP 401/403 or robots.txt refusal on at least one page; nothing was retried through another route. Rows for these stay as they were.

- Challenge / 403: acsm.org, amia.org, aaopt.org, aapmr.org, accp.com, acep.org, ache.org, aorn.org, americanbrachytherapy.org, arvo.org, ascp.org, asdin.org, ashp.org (and midyear.ashp.org), astro.org, auanet.org, acc.org and accscientificsession.acc.org, bda.org, bgs.org.uk, breastsurgeons.org, bts.org.uk, cmscscholar.org, cxsymposium.com, eans.org, efim.org, efort.org (one page; another efort.org page read fine), endocrine.org (one page), endocrinology.org, esrs.eu, esska.org, figo.org, globalfamilydoctor.com, himss.org, hrsonline.org, iaoms.org, iasociety.org, iasp-pain.org, icnvoicetolead.com, ifem.cc, ilae.org, isth.org, iuis.org, lisbonaddictions.eu, paltc.org, professional.heart.org, rcoa.ac.uk, sages.org, sirmeeting.org, siim.org, srs.org (one page), theabn.org, triological.org, wfot.org, world.physio (one page), aafs.org ("Client Challenge" page), isamweb.com (Access Denied; isamweb.org read fine), kbb-bbc.org.tr, aae.org, naccho.org.
- robots.txt disallows: annualmeeting.ascrs.org, apsr2026.org, bad.org.uk, bioethics-international.org, channel.ersnet.org, ddw.org, easl.eu, easd.org, ecfs.eu, entnet.org, events.asgbi.org.uk, ids-cologne.de, online.aapd.org, ottawaconference.org, sfmu.org, summitmd.com, tandem.confex.com, aua2027.org.
- Not used on purpose: admin.globalfamilydoctor.com serves the WONCA pages that www.globalfamilydoctor.com puts behind a challenge. Reading the same pages from the unprotected subdomain would get round the challenge, so WONCA World 2027 (Cape Town), WONCA Europe 2027 (Ljubljana) and WONCA APR 2027 (Hong Kong) were not added or evidenced.
- Unreachable (DNS/connect failures, mostly guessed congress domains that do not exist): about 120 URLs, e.g. ifso2027.com, eugms2027.org, icoms2027.org, wc2027.org, medinfo2027.org, asrmcongress.org, uscap.org, apdwonline.org, aofog.org, worldsleepcongress.org.

## Dates seen but not confirmed (leads for a person)

The organiser's dates were readable but the page cannot carry evidence under B30, so nothing was written. Fix by finding the event page, or by adding the congress domain to `tools/official-domains.json` after checking the society runs it.

- Congress domain differs from the row's domain (needs an `official-domains.json` entry or a row `url` change): ECO 2027 Munich 18–21 May (eco2027.org vs easo.org; note `eco-european-congress-on-obesity-2027` is an estimated duplicate of legacy `european-congress-on-obesity`, Istanbul 12–15 May, and looks wrong), HIMSS27 Chicago 5–8 Apr 2027 (himssconference.com vs himss.org; row says Las Vegas 7–10 Mar), Optometry's Meeting 2027 Boston 16–19 Jun / 2028 Seattle 14–17 Jun (optometrysmeeting.org vs aoa.org; rows say Orlando), EUSEM 2027 Helsinki (eusemcongress.org vs eusem.org), EPA 2027 Florence (europsy.net vs epa-congress.org), ESPID 2027 Berlin (espidmeeting.org vs espid.org), NACFC 2027 San Antonio 3–6 Nov / 2028 Seattle 11–14 Oct (nacfconference.org vs cff.org), ESSKA 2028 Gothenburg 7–9 Jun (esska-congress.org vs esska.org), Euroanaesthesia 2027 Copenhagen 29–31 May (euroanaesthesia.org vs esaic.org), SAGES 2027 Las Vegas 6–9 Apr (sages2027.org vs sages.org), ILTS 2027 Montreal 5–8 May (ilts.memberclicks.net), ICOMS 2027 Berlin 14–17 Oct (icoms.joynconference.com), DDW 2027 Washington 15–18 May / 2028 San Diego 20–23 May (digestivediseaseweek.freshdesk.com, DDW's help desk).
- Dates only on a site root: EULAR 2027 Berlin 9–12 Jun, ESCRS 2027 15–19 Oct, ECIM 2027 Paris 31 Mar–3 Apr, WCD 2027 Guadalajara 21–26 Jun, ESPGHAN 2027 Lisbon 2–5 Jun, SABCS 2026 8–11 Dec, MDS Congress 2027 Amsterdam 26–30 Sep, Heart Rhythm 2027 San Francisco 13–16 May, ECCO 2027 Copenhagen (the root page says 3–6 Mar, the ECCO'27 page shows both 1–4 and 3–6 Mar: needs a person), AACE 2027 San Diego 14–16 May, EUROGIN 2027 Bologna 10–13 Feb, APOA 2027 Taipei 21–24 Apr, ACTRIMS Forum 2027 Phoenix 11–13 Mar, IEC 2027 Amsterdam 28 Aug–1 Sep, WCN (neurology) 2027 Cape Town 23–25 Oct, WGC 2027 Kyoto 20–23 Apr, ESSO 2027 Vienna 10–12 Nov, SSO 2027 Washington 18–20 Mar, ISMICS 2027 Edinburgh 26–29 May, NANS 2027 Las Vegas 21–24 Jan, IFSSH 2028 Singapore 23–27 Oct, ASPIRE 2027 Yokohama 6–9 May, AGS 2027 Atlanta, VAM27 San Diego 2–5 Jun, SVM 2027 Cleveland 16–19 Sep, STI & HIV World Congress 2027 New Delhi 21–24 Oct, ECI 2027 Florence, EAU (eaucongress root; evidenced instead from uroweb.org), ISPRM 2027 Nusa Dua 12–17 Jun, ISTH 2027 Vancouver 26–30 Jun, AAIC 2027 Chicago 18–21 Jul, ASC 2027 Washington 9–11 Feb, ISBI 2028 Bangkok 14–19 Oct, CAST 2027 Thailand 14–17 Dec, ISGE 2027 6–9 May, WONCA Europe 2027 Ljubljana 9–12 Jun, ESPID (espid.org root).
- City not on the page, so an estimated row could not be confirmed: ESCMID Global 2028 (31 Mar–4 Apr 2028; row says Vienna 21 Apr), CPDD 2028 (17–21 Jun 2028), AAN Fall Conference 2028 (6–8 Oct), ESPE 2027 (29 Apr–1 May), UAA 2027 (8–11 Sep), NKF SCM 2027 (12–15 May, Florida), AD/PD 2027 (16–20 Mar), SCTS 2027 (21–23 Mar), PCRS 2027 (17–21 Mar, Rancho Mirage on the root only), ICCN 2028 (26–30 Sep), APHC 2027 (20–23 Apr), IHI Forum 2026 (6–9 Dec), ISSM 2027 (28–30 Oct).
- `tools/verify-dates.js` review items (51) are listed at the end of this file.

## Predatory or doubtful brands flagged (not added)

- "7th World Congress on Surgery", London, 15–16 Mar 2027, organiser shown as Conference Series LLC LTD (OMICS group brand), seen on an aggregator listing. Not added.
- "7th Global Conference on Orthopedic Surgery", Dubai, 2027, listed by aggregators with no society behind it and the numbered "Global Conference on ..." pattern used by Conference Series style organisers. Not added.
- No rows from conferenceseries.com, OMICS, Allied Academies, Scientific Federation, Magnus Group, Pulsus, EuroSciCon, Coalesce, Longdom, Hilaris or WASET are in `data/conferences.js` (checked by URL).
- Not predatory, but excluded as off-scope: "WOC 2028" search hit is the World Orienteering Championships; "IFOS" 2027 hit is the World Tinnitus Congress (hosted by the Hashir International Institute, only listed on ifosworld.org), not an IFOS congress.

## Notes for the merge

- Shards: `data/shards/x10-intl-conf.json` (79 rows, every one `datesConfirmed: true` with `datesSourceUrl`, `datesQuote`, `verifiedOn: 2026-11-18`, `cpdHours: 0`), `data/shards/provenance-x10-intl-conf.json` (180 evidence entries). Validation on a temp copy: merge adds all 79 rows and applies all 180 entries; `validate-data` 0 errors, no warnings on these rows.
- Moves applied through provenance carry `city`, `country`, `countryCode`, `lat`, `lng`.
- Specialty choices worth a second look: ASHT 2027 (hand therapists) is filed as Allied Health; FENS Forum 2028 (neuroscience) as Medical Research; ISID 2028 as Dermatology; ICS 2027 (continence) as Urology.
- Region: AOCR 2027 in Tashkent (UZ) is filed under Asia-Pacific, the nearest of the six regions.

## tools/verify-dates.js review items (not written)

- `iapcon-chennai-2027-expected` (2027-02-11, estimated): page says 2027-02-19..2027-02-21 but does not name Chennai: check the city before confirming <https://www.palliativecare.in/attend-iapcon-2027-with-iapc-support/>
- `aadocr-iadr-general-session-2027` (2027-03-03, estimated): page says 2027-03-17..2027-03-20 but does not name Denver: check the city before confirming <https://www.aadocr.org/events/2027aaam>
- `cso-hns-annual-meeting-2027` (2027-06-12, estimated): page found but it fails the evidence rule: datesSourceUrl host csohns.org is not the organiser's domain (entcanada.org) or in tools/official-domains.json <https://csohns.org/st/>
- `eroc-global-forum-2027` (2027-01-14, legacy): 3 different date ranges for 2027 on the page; candidates: 2027-01-14..2027-01-16 "14th - 16th January 2027"; 2027-01-09..2027-01-10 "09 - 10 January 2027"; 2027-01-12..2027-01-13 "12 - 13 January 2027" <https://
- `icpem-jeddah` (2027-03-23, estimated): dates 2027-03-23..2027-03-25 found only on the site root; find the event page and add it as sourceUrl <https://icpem.co/en>
- `hospitalar-2027` (2027-05-18, legacy): dates 2027-05-18..2027-05-21 found only on the site root; find the event page and add it as sourceUrl <https://www.hospitalar.com/en/>
- `degro-kongress-2027` (2027-06-09, estimated): dates 2027-06-24..2027-06-26 found only on the site root; find the event page and add it as sourceUrl <https://www.degro.org/>
- `cspc-annual-meeting-2027` (2027-06-15, estimated): dates 2027-06-01..2027-06-05 found only on the site root; find the event page and add it as sourceUrl <https://plasticsurgery.ca/>
- `ahns-annual-meeting-2027` (2027-07-17, estimated): dates 2027-04-07..2027-04-08 found only on the site root; find the event page and add it as sourceUrl <https://www.ahns.info/>
- `ebmt-autoimmune-cellular-therapies-2027` (2027-09-23, legacy): 8 different date ranges for 2027 on the page; candidates: 2027-01-21..2027-01-22 "Jan 21, 2027 - Jan 22, 2027"; 2027-02-04..2027-02-06 "Feb 04, 2027 - Feb 06, 2027"; 2027-04-11..2027-04-14 "Apr 
- `eusem-congress` (2027-10-16, legacy): 2 different date ranges for 2027 on the page; candidates: 2027-04-29..2027-05-01 "29 April–1 May 2027"; 2027-03-10..2027-03-12 "10–12 March 2027" <https://eusem.org/>
- `congresso-brasileiro-de-dor-2027` (2027-10-20, estimated): dates 2027-05-26..2027-05-29 found only on the site root; find the event page and add it as sourceUrl <https://www.sbed.org.br/>
- `emirates-physio-dubai` (2027-10-30, legacy): dates 2027-10-30..2027-10-31 found only on the site root; find the event page and add it as sourceUrl <https://www.physiouae.com/>
- `divi-kongress-2027` (2027-12-01, estimated): 4 different date ranges for 2027 on the page; candidates: 2027-02-18..2027-02-19 "18. - 19. Februar 2027"; 2027-04-15..2027-04-17 "15. - 17. April 2027"; 2027-03-15..2027-03-19 "15. - 19. März 2027"; 2027-04-03.
- `aeedc-dubai` (2027-01-19, legacy): 3 different date ranges for 2027 on the page; candidates: 2027-01-19..2027-01-21 "19 - 21 January 2027"; 2027-01-19..2027-01-20 "19 - 20 January 2027"; 2027-01-16..2027-01-18 "16–18 January 2027" <https://aeedc.com/>
- `eco-european-congress-on-obesity-2027` (2027-05-12, estimated): page says 2027-10-21..2027-10-22 but does not name Istanbul: check the city before confirming <https://easo.org/nordic-obesity-meeting-nom-2027-important-information-about-official-event-commun
- `faobmb-kuala-lumpur-2027` (2027-08-24, legacy): 4 different date ranges for 2027 on the page; candidates: 2027-08-24..2027-08-27 "24-27 August 2027"; 2027-07-03..2027-07-07 "3-7 July 2027"; 2027-09-19..2027-09-23 "19-23 September 2027"; 2027-08-21..2027-08-
- `eaaci-immunology-winter-school-2027` (2027-01-12, legacy): 2 different date ranges for 2027 on the page; candidates: 2027-01-12..2027-01-15 "12-15 January 2027"; 2027-03-11..2027-03-13 "11-13 March 2027" <https://eaaci.org/events/>
- `whx-dubai` (2027-01-25, legacy): 8 different date ranges for 2027 on the page; candidates: 2027-01-25..2027-01-28 "25-28 January 2027"; 2027-01-26..2027-01-28 "26-28 January 2027"; 2027-03-31..2027-04-02 "31 March-2 April 2027"; 2027-06-01..2027-06-03 "1-3 
- `efp-europerio-2027` (2027-05-12, estimated): dates 2027-04-30..2027-05-01 found only on the site root; find the event page and add it as sourceUrl <https://www.efp.org/>
- `ags-annual-scientific-meeting` (2027-05-20, legacy): page says 2027-03-12..2027-03-13, the row (confirmed earlier) says 2027-05-20..2027-05-22 <https://www.americangeriatrics.org/programs/advancing-geriatrics-research-agsnia-conference-series>
- `eular-congress` (2027-06-09, legacy): dates 2027-06-09..2027-06-12 found only on the site root; find the event page and add it as sourceUrl <https://congress.eular.org/>
- `wms-summer-conference-2027` (2027-07-21, estimated): 2 different date ranges for 2027 on the page; candidates: 2027-03-07..2027-03-10 "March 7-10, 2027"; 2027-06-27..2027-06-30 "June 27-30, 2027" <https://wms.org/>
- `was-world-congress-2027-cape-town` (2027-12-10, legacy): dates 2027-12-10..2027-12-12 found only on the site root; find the event page and add it as sourceUrl <https://wascongress.org/>
- `congres-du-sommeil-2026` (2026-11-25, legacy): 5 different date ranges for 2026 on the page; candidates: 2026-11-18..2026-11-20 "18 au 20 novembre 2026"; 2026-11-25..2026-11-27 "25 au 27 novembre 2026"; 2026-11-27..2026-11-28 "27 et 28 novembre 2026"; 2026-
- `eos-congress-2027` (2027-06-20, estimated): dates 2027-06-13..2027-06-17 found only on the site root; find the event page and add it as sourceUrl <https://eoseurope.org/>
- `asn-nutrition-2028` (2028-07-24, estimated): page says 2028-06-10..2028-06-13 but does not name Orlando: check the city before confirming <https://nutrition.org/american-society-for-nutrition-announces-locations-for-nutrition-2027-and-nutrition-2028/>
- `sls-etikdag-2026` (2026-12-02, legacy): 6 different date ranges for 2026 on the page; candidates: 2026-12-01..2026-12-01 "2026-12-01"; 2026-12-02..2026-12-02 "2 december 2026"; 2026-12-03..2026-12-03 "2026-12-03"; 2026-12-07..2026-12-07 "2026-12-07"; 2026-1
- `apta-csm` (2027-02-04, legacy): dates 2027-02-04..2027-02-06 found only on the site root; find the event page and add it as sourceUrl <https://www.apta.org/>
- `sls-preventionsdagen-2027` (2027-03-12, legacy): 9 different date ranges for 2027 on the page; candidates: 2027-01-13..2027-01-13 "2027-01-13"; 2027-01-25..2027-01-25 "2027-01-25"; 2027-02-03..2027-02-03 "2027-02-03"; 2027-02-17..2027-02-17 "2027-02-17"; 20
- `acmg-annual-meeting` (2027-04-13, legacy): dates 2027-04-13..2027-04-17 found only on the site root; find the event page and add it as sourceUrl <https://www.acmgmeeting.net/>
- `ishlt-annual-meeting-2027` (2027-04-21, estimated): page says 2027-04-14..2027-04-17 but does not name Toronto: check the city before confirming <https://www.ishlt.org/annual-meeting/preconference-workshops>
- `euroelso-2027` (2027-04-28, legacy): dates 2027-04-28..2027-05-01 found only on the site root; find the event page and add it as sourceUrl <https://euroelso-congress.com/>
- `apta-next-conference-2027` (2027-06-15, estimated): dates 2027-02-04..2027-02-06 found only on the site root; find the event page and add it as sourceUrl <https://www.apta.org/>
- `european-congress-of-immunology` (2027-09-05, legacy): dates 2027-09-05..2027-09-08 found only on the site root; find the event page and add it as sourceUrl <https://eci2027.org/>
- `csvs-annual-meeting-2027` (2027-09-16, estimated): dates 2027-01-27..2027-01-29 found only on the site root; find the event page and add it as sourceUrl <https://canadianvascular.ca/>
- `africa-healthtech-summit-2027-kigali` (2027-10-06, legacy): dates 2027-10-06..2027-10-08 found only on the site root; find the event page and add it as sourceUrl <https://healthtechsummit.africa/>
- `nacct-annual-meeting-2027` (2027-10-13, estimated): 2 different date ranges for 2027 on the page; candidates: 2027-01-05..2027-01-05 "2027-01-05/2027-01-05"; 2027-01-19..2027-01-19 "2027-01-19/2027-01-19" <https://www.clintox.org/>
- `saudiperio5-riyadh` (2027-11-11, legacy): dates 2027-11-11..2027-11-13 found only on the site root; find the event page and add it as sourceUrl <https://saudiperio.org/>
- `nsicon-ahmedabad-2026` (2026-12-09, legacy): 5 different date ranges for 2026 on the page; candidates: 2026-11-14..2026-11-16 "14 – 16 Nov 2026"; 2026-11-05..2026-11-13 "5th - 13th November 2026"; 2026-12-10..2026-12-13 "10 - 13 Dec 2026"; 2026-12-08..202
- `scandinavian-sports-medicine-congress` (2027-02-04, legacy): dates 2027-02-04..2027-02-06 found only on the site root; find the event page and add it as sourceUrl <https://sportskongres.dk/>
- `asgct-annual-meeting` (2027-05-03, legacy): dates 2027-05-03..2027-05-07 found only on the site root; find the event page and add it as sourceUrl <https://annualmeeting.asgct.org/>
- `segg-congreso-2027` (2027-06-09, estimated): dates 2027-03-03..2027-03-05 found only on the site root; find the event page and add it as sourceUrl <https://www.segg.es/>
- `svs-vascular-annual-meeting-2027` (2027-06-09, estimated): dates 2027-06-02..2027-06-05 found only on the site root; find the event page and add it as sourceUrl <https://vascular.org/>
- `aoa-optometrys-meeting-2027` (2027-06-23, estimated): dates 2027-06-16..2027-06-19 found only on the site root; find the event page and add it as sourceUrl <https://www.aoa.org/>
- `congreso-chileno-de-otorrinolaringologia-2027` (2027-10-06, estimated): 2 different date ranges for 2027 on the page; candidates: 2027-09-05..2027-09-08 "05 y 08 de septiembre 2027"; 2027-03-10..2027-03-13 "10 al 13 de marzo de 2027" <https://sochiorl.cl/we
- `bssh-autumn-scientific-meeting-2027` (2027-11-10, estimated): 2 different date ranges for 2027 on the page; candidates: 2027-05-10..2027-05-12 "10 - 12 May 2027"; 2027-02-05..2027-02-06 "5 - 6 February 2027" <https://www.bssh.ac.uk/>
- `ampicon-goa-2026` (2026-12-10, legacy): dates 2026-12-10..2026-12-12 found only on the site root; find the event page and add it as sourceUrl <https://ampicon2026.com/>
- `caep-conference` (2027-05-16, legacy): dates 2027-05-16..2027-05-18 found only on the site root; find the event page and add it as sourceUrl <https://www.caepconference.ca/>
- `ama-annual-meeting-2027` (2027-06-11, estimated): dates 2027-01-07..2027-01-09 found only on the site root; find the event page and add it as sourceUrl <https://www.ama-assn.org/>
- `critical-care-society-of-southern-africa-congress-2027` (2027-08-11, estimated): dates 2027-08-19..2027-08-22 found only on the site root; find the event page and add it as sourceUrl <https://criticalcare.org.za/>
