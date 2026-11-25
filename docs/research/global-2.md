# Data global-2 (25 Nov 2026)

Branch `data-global-2` (from `data-combined`). Non-AU/NZ conference rows only. Changed: `data/shards/global-2.json`, `data/shards/provenance-global-2.json`, `data/shards/fix-global-2.json`, 3 lines removed from `data/shards/provenance-global-1.json`, `tools/official-domains.json`, the rebuilt `data/conferences.js` and this file. No AU/NZ row, AU/NZ shard or `data/courses` file was touched: the 250 AU/NZ rows are byte-identical after the merge.

Pages were read with the repo's polite client (`tools/courses/http.js`: robots.txt, at least 3 s per host, generic User-Agent, https only). For hosts where Node's fetch kept failing through the session proxy, the same rules were applied with curl as the transport (robots.txt read first, same User-Agent and gap, challenges and 401/403 treated as blocked). Search results were leads only. Every quote was checked by script against the text of the page it cites (whitespace collapsed). None was typed by hand.

## Numbers (upcoming rows, end on or after 25 Nov 2026)

| | before | after |
|---|---|---|
| Upcoming conferences | 2173 | 2184 |
| Confirmed with evidence | 660 | 717 |
| Legacy (not yet re-checked) | 255 | 241 |
| Estimated | 1258 | 1226 |

Non-AU/NZ only:

| | before | after |
|---|---|---|
| Upcoming | 1927 | 1938 |
| Confirmed with evidence | 527 | 584 |
| Legacy | 228 | 214 |
| Estimated | 1172 | 1140 |

+17 new rows, −6 duplicates. `merge-shards` ok, `validate-data` 0 errors, `check-courses` 0 errors, `check-experiences` 0 errors, `npm test` passes (120 pass, 2 skipped, 0 fail; needs `npm ci` and `NO_PROXY=localhost,127.0.0.1` in the cloud session).

## Files

- `provenance-global-2.json`: 41 evidence entries. 13 legacy rows re-verified, 28 estimates confirmed. 27 of them changed dates, 26 changed city.
- `global-2.json`: 17 new rows, all with evidence.
- `fix-global-2.json`: 6 duplicate removals, 2 renames, 28 blurb rewrites (27 blurbs that still said "dates expected" or named the estimated city, plus the renamed HKCC row).
- `provenance-global-1.json`: removed the 3 entries sourced from santetropicale.com (an African congress listing site, not the organisers). `santetropicale.com` is now in the `aggregators` list. Those 3 rows (SOMMAD Bamako, SAEMN Abidjan, Morocco Medical Expo) are estimates again.
- `tools/official-domains.json`: 5 entries at the top of the list:
  - `sites.grenadine.co/sites/cos-sco/` (COS 2027 meeting site)
  - `csohns.org` (CSO-HNS's current site)
  - `dgu.de` (DGU, the organiser of the DGU-Kongress)
  - `acc.org` (path limited to the ACC Asia 2027 + HKCC page)
  - `site2.convention.co.jp/ascvts2027` (ASCVTS 2027 site)

## How rows were checked

1. `checkRow` over all 1400 upcoming non-AU/NZ estimated and legacy rows: 3 confirmed, 3 corrected, 145 review, 1019 none, 127 blocked, 103 errors.
   - The 3 "corrected" rows were the same false matches global-1 rejected (SCA Echo, an AEDV course, a DGRh student note). Rejected again.
   - The 3 "confirmed" rows were on santetropicale.com (see above). Rejected.
2. **Review list (145 rows).** Each was read by hand: the 46 "several ranges" pages, 25 "city not named" cases, 6 legacy rows with other dates and 4 failing the evidence rule. Then a deeper subpage pass on the 105 site-root cases (up to 8 same-domain subpages per row). A page was kept only if it was about this meeting and gave its dates (and, for an estimate, its city).
3. **"No dates" rows on a site root (454).** A 4-subpage pass turned up 1 more (ASBrS).
4. **Retried the connection failures.** 103 rows on about 57 hosts were retried twice at lower concurrency, then with curl. Some hosts answered: aapos, asrm, idai, acaai and canadianvascular (CSVS 2027 confirmed). 45 hosts still fail at the proxy (list below).
5. **Missing majors.** Searched by hand and added only where the organiser's page gave dates.

Rejected after reading the page (different meeting): ORS Tendon, SGO course, SNFGE DDW page, EPNS Eurasia workshop, AGS research series, MSO (it was APAO), SNIS summit, SAR Jornada, DOG courses, HFSA/CRT, APNA awards, ACG Western, AMP calendar, AAHKS spring meeting, ASRA Santiago, APSC (it was APPCS), PERKI (AFCC), OeKG (hotel block dates), EFP Perio Master Clinic, OTA course, IFOS calendar listing for the Asia Oceania ORL-HNS Congress (a federation calendar, not the organiser).

## New rows (all with evidence)

| Row | Dates | City |
|---|---|---|
| IASLC WCLC 2027 | 11–14 Sep 2027 | Denver |
| ISTH 2027 Congress | 26–30 Jun 2027 | Vancouver |
| MDS Congress 2027 / 2028 | 26–30 Sep 2027 / 10–14 Sep 2028 | Amsterdam / Montreal |
| ENDO 2028 | 3–6 Jun 2028 | Boston |
| APDW 2026 / 2027 / 2028 | 24–28 Nov 2026 / 2–5 Sep 2027 / 7–11 Nov 2028 | Manila / Hong Kong / Hanoi |
| WPA World Congress of Psychiatry 2027 | 4–7 Nov 2027 | Cartagena |
| IPA Congress of Pediatrics 2027 | 11–13 Sep 2027 | Kigali |
| RCOphth Annual Congress 2027 | 24–27 May 2027 | Birmingham |
| RCP Update in Medicine London 2027 | 18 Mar 2027 | London |
| RCPE Medical Trainees Conference 2027 | 26 Feb 2027 | Leeds |
| RCSEd Surgical Safety Summit 2027 | 29 Apr 2027 | Edinburgh |
| CSIM Annual Meeting 2027 / 2028 | 13–15 Oct 2027 / 11–13 Oct 2028 | Winnipeg / Calgary |
| SingHealth Duke-NUS Sport & Exercise Medicine Conference 2027 | 6 Mar 2027 | Singapore |

## Estimates corrected on the organiser's page

| Row | Now | Was |
|---|---|---|
| ascvts-singapore-2027-expected | 19–22 May 2027, Yokohama | 5 Mar, Singapore |
| hkcc-hong-kong-2027-expected (now "ACC Asia 2027 with HKCC") | 11–13 Jun 2027, Hong Kong | 4 Jun |
| iapcon-chennai-2027-expected | 19–21 Feb 2027, Bhubaneswar | 11 Feb, Chennai |
| cos-annual-meeting-2027 | 24–27 Jun 2027, Ottawa | 9 Jun, Quebec City |
| cso-hns-annual-meeting-2027 | 27–30 May 2027, St. John's | 12 Jun, Halifax |
| cspc-annual-meeting-2027 / 2028 | 1–5 Jun 2027, Montreal / 14–21 May 2028, Banff | Calgary both |
| csvs-annual-meeting-2027 | 16–18 Sep 2027, Halifax | Toronto |
| dgu-kongress-2027 | 15–18 Sep 2027, Frankfurt | Hamburg |
| dge-jahrestagung-2027 | 10–12 Mar 2027, Bielefeld | Erlangen |
| dgho-jahrestagung-2027 | 8–11 Oct 2027, Leipzig | 7 Oct, Berlin |
| dgvs-kongress-2027 (Viszeralmedizin) | 13–18 Sep 2027, Hamburg | 15 Sep, Leipzig |
| sidemast-congresso-2027 | 19–22 May 2027, Venice | 12 May, Rome |
| eos-congress-2027 | 13–17 Jun 2027, Innsbruck | 20 Jun, Lisbon |
| sbns-spring-meeting-2027 | 27–30 Apr 2027, Glasgow | 14 Apr, Edinburgh |
| baoms-annual-scientific-meeting-2027 | 23–25 Jun 2027, Edinburgh | 9 Jun, Manchester |
| bgcs-annual-scientific-meeting-2027 | 30 Jun–2 Jul 2027, Newcastle | 9 Jun, Manchester |
| aace-annual-meeting-2027 | 14–16 May 2027, San Diego | Nashville |
| aaes-annual-meeting-2027 | 22–24 May 2027, Sacramento | 25 Apr, Nashville |
| ahns-annual-meeting-2027 | 7–11 Apr 2027, Seattle (at COSM) | 17 Jul, Chicago |
| asbrs-annual-meeting-2027 | 7–11 Apr 2027, Orlando | 28 Apr, Las Vegas |
| ama-annual-meeting-2027 | 11–16 Jun 2027, Chicago | ended 15 Jun |
| asn-nutrition-2028 | 10–13 Jun 2028, Boston | 24 Jul, Orlando |
| ppag-annual-meeting-2027 | 7–10 Apr 2027, Indianapolis | 27 Apr, Orlando |
| sbi-symposium-2027 | 20–23 May 2027, Pittsburgh | 14 Apr, Chicago |
| sgna-annual-course-2027 | 22–24 May 2027, New Orleans | 7 May, Orlando |
| smsna-fall-scientific-meeting-2027 | 23–26 Sep 2027, San Diego | 15 Oct, Chicago |
| sufu-winter-meeting-2027 | 17–20 Feb 2027, San Diego | 23 Feb, Scottsdale |

Legacy rows re-verified (dates unchanged unless noted): IMCAS World 2027, WHX Dubai, NSICON 2026, NAEMSP, DGHO Frühjahrstagung, ESAIC statistics masterclass, ERS Lung Science Conference, SOAP, SBR Reumatologia, NUTRITION 2027, JGS 69th. Two changed dates:
- SAP 43rd Congreso Argentino de Pediatría: now 6–10 Oct 2027 (was 8–10). The page gives "6, 7, 8, 9 y 10 de octubre".
- SACO 2027: now 26–29 Aug 2027 (was 27–29). The organiser's sentence gives that range.

## Duplicates removed

| Removed | Kept | Why |
|---|---|---|
| nkf-spring-clinical-meetings | nkf-spring-clinical-meetings-2027 | same SCM27; 11 May is the pre-course day |
| sigo-congresso-2027 | ebcog-congress (renamed "30th EBCOG Congress and 102nd SIGO National Congress") | sigo.it: joint congress, Rome 12–15 May 2027 |
| smsna-fall-scientific-meeting-2028 | joint-issm-smsna-scientific-meeting-2028 | smsna.org: the 2028 fall meeting is the World Meeting, Miami 26–29 Oct |
| escap-congress-2027 | escap-congress-athens-2027 | same meeting, same evidence page |
| jgs-annual-meeting | jgs-69th-annual-meeting-2027 | same meeting, Kagoshima 11–13 Jun 2027 |
| espen-congress-2027 (Prague, estimate) | espen-istanbul | espencongress.com: ESPEN 2027 is in Istanbul |

## For a person to check

- **ishlt-annual-meeting-2027** (CA row, Toronto, estimate): ishlt.org says the 47th Annual Meeting is 14–17 Apr 2027 at ICC Sydney. Moving it makes it an AU row, so it was left for the AU/NZ desk.
- **ISAKOS 2027** is in Sydney (30 May–2 Jun 2027 per listings). It is an AU row, left for the AU/NZ desk. **WCLC 2029** is in Melbourne, 8–11 Sep 2029 (wclc.iaslc.org/future-conferences), also for the AU/NZ desk.
- **sso-singapore-2027/2028-expected**: the url is sso.org.sg, which is the Singapore Symphony Orchestra. The Singapore Society of Ophthalmology's meeting is the January Singapore-Malaysia Joint Meeting, hosted in alternate years. These rows look wrong and need a person.
- **cosm-triological-2027** (Austin, 28 Apr, estimate): ahns.info says "AHNS Annual Meeting at COSM 2027, April 7–11, 2027, Seattle". triological.org is blocked, so this row was not changed.
- **eusem-congress** (legacy, 16–20 Oct 2027): the only 2027 page lists the pre-courses on 16–17 Oct.
- **escmid-global-2028**: 31 Mar–4 Apr 2028 on escmid.org, but no city is named.
- **femecog 2027**: the national congress is 10–13 Nov 2027 (femecog.org.mx), but the page does not name the city. The row says 6 Oct, Mexico City.
- 57 site-root review rows still have dates only on the society's home page. Most are society calendars with several events.

## Blocked or failing hosts (skipped, not bypassed)

- **Bot challenge (39):** aae.org, aaopt.org, aasm.org, accp.com, acep.org, acsm.org, adaa.org, amia.org, aorn.org, apacrs.org, arvo.org, ashp.org, astro.org, bgs.org.uk, cap-acp.org, east.org, endocrinology.org, esska.org, heart.org, professional.heart.org, himss.org, hkcr.org, kbb-bbc.org.tr, medicos.cr, naccho.org, oaa-anaes.ac.uk, pediatr.org.tw, philippinemedicalassociation.org, posna.org, pvrinstitute.org, rcoa.ac.uk, rsroc.org.tw, scct.org, scu.org.uy, semfyc.es, socesp.org.br, surgery.org.tw, theabn.org, triological.org. Also ifem.cc (ICEM / IFEM Global Congress 2027) and iasociety.org (IAS 2027).
- **robots.txt (15):** anesth.org.tw, asi.org.in, ddw.org, easd.org, easl.eu, entnet.org, hksn.org, internisten.nl, oftalmologos.org.ar, ons.org, pathology.or.kr, radiology.or.kr, sfmu.org, sfrnet.org, sinitaly.org.
- **401/403 (14):** aacn.org, aplarcongress.com, auanet.org, clasa-anestesia.org, dermatology.ca, jslm.org, nephrothai.org, pedsendo.org, secardiologia.es, senefro.org, sgim.org, siim.org, iasp-pain.org, worldallergy.org/wao-meetings.
- **Redirect off https (6):** aagponline.org, abhh.org.br, aspho.org, diabetes.org.ar, klimik.org.tr, ucd.org.tr.
- **Still failing at the session proxy after 4 tries (45 hosts):** 2027am.uscap.org, uscap.org, acmi.org.co, ahpba.org, amg.org.mx, apsresp.org, asme.org.uk, b-s-h.org.uk, britishfertilitysociety.org.uk, caca.org.cn, ccs.ca, cmda.net, cpa-apc.org, cpsp.edu.pk, csmls.org, csnscn.ca, eaes.eu, ebcog.org, espen.org, fecolsog.org, hematology.or.kr, hkoa.com, hub.eaaci.org, integratedcarefoundation.org, jsco.or.jp, jssr.jp, jsts.gr.jp, kca.or.kr, ksid.or.kr, medicinainternaaltovalor.fesemi.org, nichigan.or.jp, ophthalmology.org, sbcp.com.br, scc.org.co, securemembers.cas.ca, sedar.es, sehh.es, seom.org, sesc.org, sidnet.org, siot.it, sleepmeeting.org, smu.org.mx, sochradi.cl, intensive.org / isicem.org (ISICEM). Try them from the laptop.

## Leads for global-3

1. **Missing majors with no organiser page yet:** World Stroke Congress 2027, ISICEM 2027 (Brussels, March; site not reachable), IFEM Global Congress 2027 (Kuala Lumpur, June; ifem.cc blocked), IAS 2027 (Geneva, July; blocked), World Allergy Congress 2027 (Florianópolis, 21–23 Oct; dates only on the WAO home page), ICRE 2027 (Halifax per listings), SIU 2027 (save-the-date is an image), IPNA 2027 (Kyoto; dates rendered by script), WOC 2028, World Heart Summit 2027, ASH 2027 and 2028.
2. **Majors still legacy or estimated:** the same list as global-1. AHA, ASTRO, ARVO and ESSKA are blocked. DDW, EASD and EASL are blocked by robots.txt. TCT and BSG Live give dates on the root only. EACTS 2027 says only "Berlin, October 2027". ERS 2028, EHA 2028 and the ESC 2028 family are not announced.
3. **Asian placeholder rows** (`*-expected`) are the biggest pool of estimates. About 150 have no page with dates. JSA 2027 (anesth.or.jp), SHBC 2027 and the Singapore-Malaysia ophthalmology meeting should be re-checked in Q1 2027.
4. **ACG regional courses 2027** (Las Vegas, Naples, New Orleans) are on gi.org with dates and are not in the database. They are small, but claimable.
