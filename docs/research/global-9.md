# Data global-9 (26–27 Nov 2026)

Branch `data-global-9` (from `data-combined`). This pass added meetings and course sessions in the UK, Europe and Asia outside Japan. Files changed:

- `data/shards/global-9.json`: 328 new rows, all with evidence.
- `data/shards/provenance-global-9.json`: evidence for 2 existing estimates.
- `data/shards/fix-global-9.json`: names and blurbs for those 2 rows.
- The rebuilt `data/conferences.js` and this file.

Left alone: AU/NZ rows and shards, US/Canada (none added), `data/courses`, `tools/merge-shards.js`, `lib/`. `tools/official-domains.json` did not need new entries, because every source page is on the row's own `url` domain.

## How pages were read

- All pages were fetched with the repo's client (`tools/courses/http.js`). It reads robots.txt first, including the Claude and Anthropic agent names. It waits at least 3.3 s between requests to the same host and sends one request at a time per host, with a generic User-Agent, over https only. A 401/403, a bot challenge or a robots refusal was logged and the host skipped.
- Each `datesQuote` was sliced from the whitespace-collapsed visible text of the page it cites, and a script checked that the quote is still on that page. `verifiedOn` is the UTC date that page was fetched (2026-11-26 or 2026-11-27). The date was taken from the cache file's fetch time, not from the day the row was written.
- `datesSourceUrl` is always an event, course or listing page, never a site root.
- The city is one the organiser's page names. Rows were left out where it names only a region (RCS England sessions listed as "Maharashtra" or "Gujarat"), only a country ("Case Reading Week … Greece") or a disputed territory (Girne, KKTC).
- Only meetings run by the society whose page was read were added. Society calendars that list other organisers' events were left out: GESEA centre sessions on esge.org, ESVS/ESTES/EFORT/EHS "endorsed" events, the RCPath and DIVI calendars, the RCUK and ISUOG "approved course" lists, DGIM's Intensivkurse (DGIM patronage only), the ESICM and ECCO lists of others' meetings and external events on PTK, ČGS, BSH and BAPS pages. Some rows are run jointly with the page's society and say so in `organiser` (EACTS MCS workshop, TCD/UEMS breast course, BSG/BSH iron meeting).
- Online-only events, e-learning windows (RCS England "1 Dec 2026 – 30 Jun 2027" Professional Passport modules), virtual courses and student exam-prep (BDI M3 courses) were left out. Hybrid is used only where the page says in person and online (BAPM Spring Conference 2027).
- **End dates.** These were never assumed, with two exceptions where the page states the length. BAPM NeoNATE is "a two day in person event", so it ends the next day. EULAR course pages show the end as 00:00 of the next day, so those rows end on the start day. Multi-module DGVS seminars are entered as their in-person module only, with that module's dates.
- **Map pins.** Cities new to the data were pinned from Wikidata P625. The item was found through the city's en.wikipedia.org article, then read from `www.wikidata.org/wiki/Special:EntityData/Q….json`. `query.wikidata.org/sparql` and `www.wikidata.org/w/api.php` are disallowed by robots.txt and were not used. The coordinates were not added to `tools/city-coords.json`. Items: Eastbourne Q208262, Weston-super-Mare Q845623, Kettering Q984613, Chelmsford Q210985, Chesterfield Q823600, Merthyr Tydfil Q752762, Cirencester Q852772, Basildon Q216649, Hastings Q29245, Rotherham Q217039, Peterborough Q172438, Plymouth Q43382, Poole Q203349, Coventry Q6225, Reading Q161491, Guildford Q213465, Colchester Q184163, Burton upon Trent Q1000597, Northampton Q192240, Larissa Q178405, Riffa Q1771398, Navi Mumbai Q61445, Mangalore Q127041, Nyborg Q3530435, Karpacz Q606126, Poznań Q268, Katowice Q588, Gdańsk Q1792, Rzeszów Q598, Bydgoszcz Q41252, Karlovy Vary Q384544, Luhačovice Q933480, Hradec Králové Q180139, Mainz Q1720, Tromsø Q42328401, Sint-Michielsgestel Q12013374, Bled Q202852, Längenfeld Q524538, Brussels Q240, Kassel Q2865, Koblenz Q3104, Frankfurt Q1794, Meran Q131605, Calvià Q491786, Pörtschach Q875805, Puerto de la Cruz Q623549, Saarbrücken Q1724, Karlsruhe Q1040, Unterhaching Q264899, Bielefeld Q2112, Potsdam Q1711, Lünen Q3822, Rostock Q2861, Wernigerode Q15982, Kaarst Q7088, Jena Q3150 and Leipzig Q2079.

## Numbers

| | before | after |
|---|---|---|
| Upcoming conferences (end on or after 26 Nov 2026) | 3837 | 4165 |
| Upcoming with evidence (`datesSourceUrl`) | 2427 | 2757 |

- **+328 new rows, all with evidence.** By start year: 31 in 2026, 291 in 2027, 5 in 2028 and 1 in 2029.
- By country: GB 207, DE 52, CZ 12, PL 12, IT 6, ES 6, BE 5, AT 3, DK 3, PT 3, FR 3, GR 2, IN 2, TR 2, and 1 each for BH, EG, IE, SE, MY, TW, NO, CH, NL and SI.
- **2 estimates confirmed** (provenance entries, with fixes to name and blurb):

| Row | Now | Was |
|---|---|---|
| bsecho-annual-meeting-2027 | BSEcho 2027, 15–16 Oct 2027, Belfast | 10 Nov, Manchester |
| dac-anaesthesiologie-2027 | DGAI-Jahreskongress 2027, 22–24 Sep 2027, Kassel | Deutscher Anästhesiecongress, 12 May, Leipzig |

- One row (PHA-PCC Midyear Convention 2027) was dropped because it was already in the data.

## New rows by source

| Source (organiser's own pages) | Rows | Notes |
|---|---|---|
| RCS England course pages (rcseng.ac.uk/education-and-exams/courses/search/…, found from the College sitemap) | 193 | ATLS provider, instructor and reverification; CCrISP; Basic Surgical Skills; SSSHP; core and intermediate laparoscopy; DSTS; SSET; Training the Trainers; ATNC; START. Mostly UK, plus sessions in Larissa, Riffa, Cairo, Navi Mumbai and Mangalore. |
| German professional bodies and societies: BDI, BVDD, DGVS, DGAI, AUC (DGU), DGGG academy, BDC, BVKJ | 52 | BDI courses and regional internal medicine days; BVDD regional dermatology meetings; DGVS certificate seminars (in-person modules only); DGAI meetings and ECLS courses; AUC paediatric and geriatric trauma courses; DAGG courses |
| European associations: EACTS Academy, ESGAR, EULAR, ESH, ESUR, ESSR, EHS, EORTC, EANO, ESPGHAN, EuSEM, ESRA, ESAIC | 41 | Courses and workshops in 2027, plus EHS 2028 in Basel |
| Polish, Czech, Greek, Turkish and Danish societies: PTK, PTD, PTP, PTMR, ČGS, ČDS, ČLS JEP calendar, Hellenic Endocrine Society, TCD, TGD, DPS | 32 | DPS annual meetings 2027–2029 |
| UK societies and colleges: RCPSG (more sessions of courses already listed), RCSEd, RCPCH, BSH, BAPM | 15 | |
| Asia: NHAM (Malaysia), TUA (Taiwan) | 2 | |

## Checks

| Check | Result |
|---|---|
| `merge-shards` | ok: 0 invalid |
| `validate-data` | 0 errors. Warnings went from 1535 to 1541: "possible duplicate edition" warnings for course sessions run several times a year (expected) |
| `check-courses` | 0 errors |
| `check-experiences` | 0 errors |
| `npm test` | 122 pass, 0 fail (with `NO_PROXY=localhost,127.0.0.1`) |

**Disk note.** On 27 Nov the shared disk was full more than once because of other sessions' scratch folders. During that time `npm test` failed in its server tests, which could not write their temporary files. Batch 11 was committed while that was happening. The suite was run again once space was free and passed (122 pass, 0 fail). The data changes do not touch the server code.

## For a person to check

- **RCS England ATLS sessions** are held at host centres around the UK, while RCS England runs the booking page. The row's city is the one the College page gives.
- **RCOphth calendar.** Dates and titles on rcophth.ac.uk could be matched more than one way, and one existing row (23 Apr 2027, Manual SICS) may not match the current page. No new RCOphth rows were added.
- **Turkish Society of Haematology (THD) 2027 meetings** (Akdeniz Hematoloji Sempozyumu 26–28 Mar, KİT Kongresi 15–17 Apr, 53. Ulusal Hematoloji Kongresi 9–14 Nov 2027) are listed with no city. The existing estimate "National Hematology Congress (THD) 2027" (27 Oct, Antalya) is probably wrong on the date.
- **TEMD 48th congress** is 28 Apr – 2 May 2027 at the Susesi Kongre Merkezi, Antalya (temd.org.tr). The existing estimate says 20 Oct 2027. It was not corrected this pass, so it is a lead for a provenance entry.
- **Czech Society of Cardiology** (kardio-cz.cz) pages are served in windows-1250, and the client decodes them as UTF-8, so quotes cannot be taken verbatim. The XXXV. výroční sjezd ČKS is 8–11 May 2027; the existing estimate says 9 May.

## Blocked hosts (skipped, not bypassed)

- **Bot challenge or 403:** asgbi.org.uk, eadv.org, eans.org, hkcr.org, gest.org.tw, surgery.org.tw, derma.org.tw, ficm.ac.uk.
- **robots.txt:** query.wikidata.org/sparql and www.wikidata.org/w/api.php (geocoding went through Special:EntityData instead), easd.org, anesth.org.tw, augeninfo.de, legeforeningen.no (the sitemap is allowed but stale; the course search runs in JavaScript).
- **Fetch failed at the session proxy:** eaes.eu, easl.eu, ehaweb.org, espen.org, essm.org, eaa-andrology.eu, bsac.org.uk, bes.org.uk, noroloji.org.tr, kbb.org.tr, ttb.org.tr, endocrinesociety.org.sg, hkcem.com, hkcpaed.org.hk, sccm.org.tw, moa.org.my, thaiheart.org, rcpt.org, thaigastro.org, thaipediatrics.org, pcs.org.ph, pafp.com.ph, danskradiologi.dk, paediatri.dk, dgp-berlin.de, sicitalia.org.
- **Rendered by script, no dates in the HTML:** estro.org, esmo.org, cosy.erc.edu, ams.edu.sg, alsg.org, aofoundation.org course finder, uroweb.org event lists, aekn.de calendar pagination, akademie-wl.de, IRCAD (2027 sessions not yet open).

## Leads for global-10

1. **German professional associations (Berufsverbände) and society academies** gave dense, well-structured calendars: BDI, BVDD, DGVS, DGAI, AUC and DAGG. Not finished: BVKJ (pages 2–4 of fortbildungen), BVOU/ADO, BDA (regional meetings and OP-Management), DGTHG seminars, DGRh academy, DGK Akademie calendar (script-heavy), and other BDC pages beyond the "Top Events".
2. **ČLS JEP calendar** (cls.cz/kalendar-akci with `calendarCongressFilter[month]/[year]/[place]=2`) lists Czech societies' external-venue meetings month by month. Only Dec 2026 – Nov 2028 with place=2 were read.
3. **The Events Calendar (tribe) JSON** at `/wp-json/tribe/events/v1/events` lists events (with venue) on many WordPress society sites: hsg.gr, endo.gr, diab.cz, dsgh.dk, neuro.dk, dpsnet.dk, esvs.org, estesonline.org, eortc.org, semes.org and saudi-heart.com. It is useful for finding events, but the quote must come from the event page. Some of those pages show dates without the year (esge.org).
4. **Asia outside Japan** stayed thin. Malaysia, Philippines, Taiwan, Hong Kong and Singapore society sites mostly list webinars, other organisers' events or no dates, and several Taiwanese sites block. Next: Saudi Heart Association's conference site, NHAM's own event pages (MYLIVE 2027, NHAM Congress 16–18 Apr 2027 at KLCC: the existing estimate says 23 Apr), the TSN meeting site (meeting.tsn.org.tw), and POGS midyear and annual conventions.
5. **Norway, Finland, Hungary, Romania, Israel and the Baltic states** gave nothing usable from homepages: they are script-built, have stale sitemaps or show no dated events. Legeforeningen's course search would be the big Norwegian source if it served HTML.
