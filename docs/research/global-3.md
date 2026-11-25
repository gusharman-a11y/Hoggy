# Data global-3 (25 Nov 2026)

Branch `data-global-3` (from `data-global-2`). This pass added new non-AU/NZ meetings. Files changed: `data/shards/global-3.json` (new rows), `data/shards/provenance-global-3.json` (evidence for existing rows), `data/shards/fix-global-3.json` (names and blurbs for the rows that evidence corrected), `tools/official-domains.json` (4 entries at the top of the `official` list), the rebuilt `data/conferences.js` and this file. No AU/NZ row, AU/NZ shard or `data/courses` file was touched. The 250 AU/NZ rows are byte-identical after the merge. `ishlt-annual-meeting-2028` was left alone, because the AU/NZ wave 6 agent is fixing it.

How pages were read: every page was fetched in this session with a polite client: robots.txt read first (including Crawl-delay: ce.mayo.edu asks for 10 s), at least 3.2 s between requests to one host, a generic User-Agent, https only, and redirects only to https. A 401/403, a Cloudflare or captcha page, or a robots.txt refusal was logged and skipped, never worked around. Search results were used only as leads. Every `datesQuote` was checked by script against the whitespace-collapsed text of the page it cites. No quote was typed by hand. Each row's `datesSourceUrl` is an event or listing page on the organiser's own domain, never a site root. Cities come from the same organiser site. Where a page gave no city (a venue "TBA" in an unnamed city, a national park, or "Maui" with no town), the row was left out.

## Numbers (upcoming rows, end on or after 25 Nov 2026)

| | before | after |
|---|---|---|
| Upcoming conferences | 2184 | 2525 |
| Confirmed with evidence | 717 | 1093 |
| Legacy (not yet re-checked) | 241 | 233 |
| Estimated | 1226 | 1199 |

Non-AU/NZ only:

| | before | after |
|---|---|---|
| Upcoming | 1938 | 2279 |
| Confirmed with evidence | 584 | 960 |
| Legacy | 214 | 206 |
| Estimated | 1140 | 1113 |

**+360 new rows, all with evidence** (27 start in Dec 2026, 306 in 2027, 27 in 2028), plus 36 evidence entries for existing rows. Of those 36, 27 confirmed estimates (most with a corrected city) and 9 re-checked legacy or confirmed rows. The checks gave these results:
- `merge-shards`: ok. Every new row and evidence entry was applied, with 0 downgrades.
- `validate-data`: 0 errors. Warnings fell from 1375 to 1371.
- `check-courses`: 0 errors.
- `check-experiences`: 0 errors.
- `npm test`: 120 pass, 2 skipped, 0 fail. It needs `npm ci` and `NO_PROXY=localhost,127.0.0.1`.

## New rows by source

| Source (organiser's own pages) | Rows | Notes |
|---|---|---|
| Medical Education Resources (mer.org/conference/…) | 148 | Primary-care CME conferences in destinations: Disney, Las Vegas, Key West, Nassau, Aruba, Banff, Basel, Seville, Krakow and others. Each row has its own conference page, and the quote is the page's own "… meeting on <dates> in <venue>." line. The city comes from MER's schedule listing. Rows with only an island, a park or "Napa/Sonoma" as the place (34) were left out. |
| Mayo Clinic School of CPD (ce.mayo.edu/content/…) | 98 | Multi-day courses, many in Hawaii, Arizona and Florida resorts. The list was found through Mayo's week calendar, and each course page was read for "dates – venue – city, state". Grand rounds, webinars, nursing CNE and simulation sessions were left out. Two courses were left out because their official titles contain copy-lint words ("Best Practices…", "Best of Lugano"). |
| Continuing Education Company (cmemeeting.org) | 18 | Primary-care conferences (Maui, Big Island, Kiawah, Florida Keys and others). Two-session meetings are entered as two rows. |
| Japanese societies | 16 | JGES (113th, JGES International), JATS 80th/81st, JSTH 49th, JSCPT 48th/49th, JSDT 73rd, JSMI 103rd, JSES 40th/41st, JSEE 41st/42nd, JSAO 66th, JDS Progress in Diabetology 61st/62nd. |
| ESHRE campus workshops | 9 | Bologna, Athens, Belgrade, Istanbul, Uppsala, Edinburgh, Malaga, Tallinn, Granada. |
| INDEX Conferences (Dubai PCO) | 9 | ARM, DACE, EDDW, IFM, Dubai Otology, SIDC Riyadh, APBCS, APGCS, BPOF. |
| ESCMID courses | 5 | Malta, Athens, Leuven, Rome, Lisbon. |
| ESOT / ELITA | 4 | EPITA (Igls), Machine Perfusion Masterclass (Madrid), HESPERIS (Munich), Split Liver Masterclass (Groningen). |
| US subspecialty societies | 37 | SSO 2028, AATS (Thoracic Surgical Oncology Summit, Mitral Conclave, Aortic Symposium 2028), ASE 2028, ASCRS 2028, SMDM 50th, BMES 2027/2028, ACLPS, Assoc. of University Anesthesiologists 2027/2028, AAPA (2028, Leadership Summit, MSK Galaxy), AAFPRS at COSM, AAAP, ACMT, AHS (Headache Academy, Scottsdale Symposium), ASES (Winter Summit, Mastering the Elbow, Revision Arthroplasty), AIUM (OB/GYN seminar, annual convention), ASOPRS spring 2027/2028, IMARI, AAST Practical Surgery Summit, SRS (Buenos Aires RSM, IMAST Copenhagen, Nijmegen course), AAHKS spring, NASPGHAN (Fellows Conference, Hepatology Bootcamp). |
| European and UK societies and others | 16 | EADO 2028, ADEE 2028, Association of Anaesthetists WSM and GasFest 2028, ESO winter school and Edinburgh workshop, EUSEM Trauma, BSPGHAN, BTS bronchoscopy course, RCPCH summit, RCSEd QI symposium, WONCA Rural 2028, WHX Dubai 2028, University of Toronto (Urology Update, Wright Symposium, AUEM Whistler), Wilderness Medicine (Santa Fe, Big Sky summer). |

New rows are mostly US CME courses (272 of 360), because those providers publish whole dated schedules. The society-level 2027/2028 majors were already well covered: 44 of the 63 "future meetings" pages read were already in the data.

## Existing rows corrected or re-checked (provenance-global-3.json)

Estimates confirmed on the organiser page, most with a different city:
- APAO 2028: Manila (the row said Hong Kong)
- APSR 2028: Nara (Seoul)
- PALTmed 2028: Cincinnati (Nashville)
- ABA 2028: Seattle (Chicago)
- ESTS 2028: Helsinki (Rome)
- ESH 2028: joint ISH-ESH meeting, Glasgow (Berlin)
- ESGAR 2028: Athens (Rome)
- ESSR 2028: Athens (Hamburg)
- AMP 2028: Honolulu (Philadelphia)
- SSO 2027: Washington DC (Seattle); renamed "SSO 2027 Annual Meeting"
- ESPR 2028: Zurich (Lisbon)
- EOS 2028: Genoa (Vienna)
- AABB 2028: Toronto (San Diego)
- AMA HOD 2028: Chicago
- APTA CSM 2028: Chicago (Houston)
- ASBrS 2028: Grapevine (Las Vegas)
- EADV Congress 2028: Paris (Vienna)
- EAO 2028: Amsterdam (Milan)
- CRA 2028: Montreal (Quebec City)
- JDS 70th: Tokyo
- JNS 86th: Osaka; JNS 87th: Kyoto (both said Yokohama)
- JAID 101st: Sapporo, a joint meeting with JSC (Tokyo)
- ASOPRS fall 2027: Las Vegas; fall 2028: Chicago (the 2027 row said Chicago)
- NASPGHAN 2027: Nashville; 2028: Orlando (both said Chicago)

ASGCT 2028 is now in New Orleans. Wave 3 confirmed its dates but left the city as Boston. Legacy rows re-checked: JSMO 2028, ESPR 2027, AABB 2027, AARC 2027/2028, EADV Symposium 2028, CHEST 2028 and AHS 2027.

`fix-global-3.json` has 27 entries. They rewrite the blurbs that still said "dates expected" or named the old city, and they rename 9 rows. `espr-congress-2028` had the paediatric *research* society as its organiser, but its url is espr.org, the paediatric *radiology* society, whose 2028 congress is in Zurich. Its organiser and specialty were set to match its url and evidence.

## tools/official-domains.json (added at the top)

- `apaophth.org`: APAO's current site.
- `paltmed.org`: PALTmed, formerly AMDA (paltc.org).
- `apsr.org`: APSR's current site.
- `chemotherapy.or.jp`, path `/modules/meeting/`: the joint JSC/JAID 2027 meeting page.

## For a person to check

- **SIRS 2028** (Riyadh, 13–15 Jan 2028) is announced on sirs2027congress.com, but only on the site root, so it was not added. The same root still shows SIRS 2027 (14–16 Jan 2027).
- **ESGE Days 2028** is 27–29 Apr 2028 with the venue "to be announced". The `esge-days-2028` row still says Lisbon, 12 Apr.
- **ESGO 2028** is 16–18 Mar 2028 (congress.esgo.org) with no city. The row says Vienna, October.
- **Euretina 2028** is 21–24 Sep 2028 with the venue TBC.
- **ObesityWeek 2027** is 7–10 Nov 2027 in Orlando, and **SCMR 2027** is 17–20 Feb 2027 in Rome. Both are given only on the site root, so the estimates (San Antonio; Washington, Jan) were not changed.
- **ACMT 2028**: acmt.net gives two different date ranges (28 Mar–1 Apr and 30 Mar–1 Apr 2028), so no row was added.
- **Mayo**: about 30 course pages were not reached before the session ended (ce.mayo.edu is slow and asks for 10 s between requests). They include Endocrine Update 2027 in Nassau and STiR 2027 in Carolina, Puerto Rico, whose pages use a different layout.
- **Wilderness Medicine trips** (Fiji, Galapagos, Everest, Bhutan and others) have exact dates on wilderness-medicine.com but no town, so they were not added.

## Blocked hosts (skipped, not bypassed)

- **Challenge or 401/403 (65):** aacn.org, aae.org, aap.org, aapmr.org, aasm.org, accp.com, acep.org, acmg.net, acro.org, acsm.org, adaa.org, amia.org, aofas.org, aorn.org, apacrs.org, aplarcongress.com, arvo.org, asam.org, ascp.org, asdin.org, ashp.org, asipp.org, asma.org, astro.org, auanet.org, bgs.org.uk, cap-acp.org, cmecatalog.hms.harvard.edu and postgraduateeducation.hms.harvard.edu (all Harvard CME), contemporaryforums.com, east.org, esska.org, figo.org, fogsi.org, hkcem.org.hk, iasp-pain.org, idai.or.id, isth.org, jsdi.or.jp, jslm.org, jstmct.or.jp, naccho.org, pedsendo.org, philippinemedicalassociation.org, professional.heart.org, pvrinstitute.org, radiology.ucsf.edu, scct.org, secardiologia.es, semfyc.es, sgim.org, siim.org, socesp.org.br, theabn.org, triological.org. Some pages on eadv.org, efort.org, efp.org, esgar.org, esrs.eu, globalfamilydoctor.com, iesscongress.ca and osseo2027.org were also refused, while other pages on those sites loaded.
- **robots.txt disallowed at least one page (97 hosts).** These include aan.com, acog.org, asahq.org, ddw.org, easd.org, easl.eu, escardio.org, ersnet.org (the channel host), era-online.org, eacts.org, endocrinology.org, entnet.org, hrsonline.org, rcoa.ac.uk, sages.org, sgo.org, uhms.org, vascularsociety.org.uk, woncaeurope.org, and many Taiwanese and Korean society sites (anesth.org.tw, pediatr.org.tw, surgery.org.tw, rsroc.org.tw, radiology.or.kr, pathology.or.kr, kgs.or.kr). The full list is in the session log; it was produced from the cache metadata.

## Leads for global-4

1. **More CME providers with full public schedules.** MER and Mayo gave 246 rows. Next to try: Cleveland Clinic CME (the page is rendered by script), Johns Hopkins, Penn, Duke and Michigan CME (their pages returned no dates, also script), Pri-Med regional meetings, the CME Company's 2028 schedule, and the University of Toronto, UBC, McGill and Calgary CPD offices (UofT links to separate congress sites that give dates only on their roots).
2. **Society multi-event pages** were the best yield among societies: ASES, SRS, AIUM, ESHRE, ESCMID, ESOT and AATS each gave several rows. Read in the same way: AAOS courses, AANS courses, ACS courses, EAU/ESU courses (uroweb returned 404), ESTRO courses (script), EANM courses, ERS courses, ESC association meetings (escardio.org is blocked by robots).
3. **Japanese society pages** (学術集会 / 会期 lines) work well and give 2027 and 2028 editions with cities. About 50 more societies are in the seed list idea, for example JSPS, JSRM, JSGO, JSCO and the regional pediatric meetings. jsct.jp gave JSCT 2027 only on the site root.
4. **INDEX / Gulf PCOs**: index.ae gives dated event pages. Similar PCO sites to check: MCI Middle East, Informa (WHX family), and Saudi society congress sites. IUCC and MEAPEN 2027 were left out because their venues are TBA.
5. The **2028 estimate pool** is still large: 1113 non-AU/NZ estimates. A "future meetings" pass on the remaining society sites, together with the corrections above, is the fastest way to confirm them.
