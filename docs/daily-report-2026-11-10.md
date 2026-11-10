# Hoggy daily report, 2026-11-10

Backup: data/work/conferences.before-daily-2026-11-10.js

## Totals
- Rows: 2029 -> 2043 (+14). Confirmed dates: 689 -> 707 (+14 new, +4 corrected). Tests: 18/18 pass. A second dry-run merge is a no-op.

## Source check (2029 urls)
- 1842 OK, 42 dead or erroring, 145 blocked (130 returned 403, 15 disallowed by robots.txt; skipped, not bypassed), 21 date mismatches in the pages' JSON-LD event data.
- All 42 dead or erroring rows are already estimated, so no confirmed row lost its source. They are mostly "-expected" placeholders, plus bapm (404), icpem-jeddah (404), sufu, degro, spmi, suo, cpa, kca/jsts/jssr/ccs and amg/smu.
- The 21 mismatches are the same set as yesterday: past editions, webinars and null dates in JSON-LD. RSNA 2026, RACS Founders Centenary and World Congress of Dermoscopy were re-read against the organiser page yesterday and match the DB. No change.
- Removed: none (no cancellations found).

## Corrected (organiser page read today; recorded in data/shards/provenance-daily-2026-11-10.json, coordinates updated)
| id | was | now | source |
|---|---|---|---|
| congresso-paulista-de-pediatria-2027 | 2027-03-31, estimated | 2027-03-17 to 03-20, São Paulo, confirmed | https://www.spsp.org.br/ |
| congresso-brasileiro-de-reproducao-humana-2027 | 2027-05-12, São Paulo, estimated | 2027-04-22 to 04-24, Belo Horizonte, confirmed | https://sbrh.org.br/cursos-eventos/congresso-brasileiro-de-reproducao-humana-2027/ |
| sbc-congresso-cardiologia | 2027-09-24, São Paulo, estimated | 2027-10-14 to 10-16, Rio de Janeiro, confirmed | https://portal.cardiol.br |
| usicon-chennai-2027-expected | 2027-01-20, Chennai, estimated | 2027-01-21 to 01-24, Lucknow, confirmed | https://www.usicon2027.com/ |

## Added (discovery: IN, SG, AE, SA, BR, MX; 18 shard rows, 14 new, 4 used as corrections above)
- IN 4: ASICON 2026 Ahmedabad (Dec 17-19), NSICON 2026 Ahmedabad (Dec 9-13), AMPICON 2026 Goa (Dec 10-12), Neurotrauma 2027 New Delhi (Aug 5-8).
- SG 1: IDF Congress 2027, Singapore EXPO (Apr 9-12).
- AE 1: 16th EROC Global Forum, Dubai (2027-01-14 to 16).
- SA 2: WCO6 with the 11th Saudi Optometry Conference, Riyadh (2027-04-02 to 04); 11th SPNS Conference, Jeddah (2026-12-16 to 19).
- BR 4: 58th SBOT Congress, Porto Alegre (2026-11-18 to 20); SBA CBA 2026, Fortaleza (Nov 26-29); SIAC Mulher 2026, Maceió (Nov 19-20); IMCAS Americas 2027, São Paulo (May 20-22).
- MX 2: World Physiotherapy Congress 2027, Guadalajara (May 14-16); 26th World Congress of Dermatology 2027, Guadalajara (Jun 21-26).
- Shards: data/shards/desk-<cc>-2026-11-10.json. cpdHours is 0 throughout.
- Rotation note: the countries continue the Wave 1 order after yesterday's AU-KR batch, rather than being computed from the day of year.

## Sites blocked or unreachable (skipped)
- 403: jpr.org.br, cbgo2027.com.br, sbcpcongressobrasileiro.com.br, cba2026.com.br, amcg.org.mx, sono2026.com.br, cbmi2026.congressosamib.org.br, apacrs.org.
- Sucuri bot protection: sidc.org.sa, radiologyuae.com.
- Refused, empty or not loading: amg.org.mx, cbo.com.br, smri.org.mx, apbcs.org.
- Plus the 145 blocked urls in the source check.

## Needs human review
- **Likely wrong existing rows (left estimated, not removed):**
  - ascvts-singapore-2027-expected: ascvts.org says the 2027 meeting is in Yokohama.
  - gulf-heart-association-annual-congress-2027/2028 (Dubai): the 2026 meeting is in Muscat, so the congress appears to rotate between countries.
  - apicon-jaipur-2027-expected: apiindia.org names a Gurgaon organising secretary.
  - criticare-2027: the venue is listed in Agra, not Mumbai.
  - apsicc-singapore-2027-expected: no sign of a 2027 Singapore congress.
- **Dead domains:**
  - smu.org.mx is now a parked domain, used by congreso-nacional-de-urologia-2027/2028.
  - aoan.org is a domain-for-sale page, used by aocn-singapore-2027-expected.
  - These rows need new urls or removal.
- **USICON id:** the row id still contains "chennai" although the event is now in Lucknow. The id is kept for stability.
- **SPNS 2026:** the page shows a "postponed, confirmed new dates" banner with Dec 16-19. Older listings show Nov 11-14.
- **SBOT 2026:** the page title says 2026 but the url slug says 2027, and no venue is named.
- **SBA CBA 2026:** the url is the society homepage because the event site returned 403.
- **SIAC Mulher:** the page is on a registration platform, not a society domain.
- **EROC:** the organiser and format come from listings. The page itself gave only the dates and edition number.
- **Commercial organisers:** IMCAS Americas (company-run, no accreditation shown).
- **Scope:** World Physiotherapy (allied health) may not belong in a medical database.
- **Inferred or default fields:**
  - AMPICON city (Margao) and specialty (filed under Radiation Oncology for medical physics).
  - NEUROTRAUMA organiser.
  - In-person format defaulted on WCD 2027 and CBC 2027.
- **Leads worth a manual retry (organiser page lacked dates or was blocked):**
  - 62nd Congresso Brasileiro de Cirurgia Plástica (likely 2026-11-11 to 14)
  - 22nd Congresso Brasileiro do Sono (Dec 2-5)
  - ESMO Asia 2026, Singapore (Dec 4-6)
  - ISNCON 2026, Kochi
  - 64th CBGO (May 2027)
  - Saudi Urological Association congress (sources conflict on city and dates)
  - SIDC 2027
  - ARM 2027 Dubai
- **Predatory-looking listings not added:**
  - Several Singapore and Dubai commercial "world congress" brands (Iris Scientific, Arjyopa, Mathews, Aver Conferences).
  - "NCMHS" listings across India.
