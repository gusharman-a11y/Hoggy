# Data global-11 (27 Nov 2026)

Branch `data-global-11` (from `data-combined`). This pass added meetings and course sessions outside AU/NZ and the US/Canada, and confirmed existing estimates there. Files changed:

- `data/shards/global-11.json`: 130 new rows, all with evidence.
- `data/shards/provenance-global-11.json`: evidence for 19 existing estimates.
- `data/shards/fix-global-11.json`: names and blurbs for those 19 rows.
- `tools/official-domains.json`: 8 entries added at the end of the `official` list (meeting sites linked from the society's own site).
- The rebuilt `data/conferences.js` and this file.

Left alone: AU/NZ and US/Canada rows (checked: all 2170 are byte-identical to `data-combined`), `data/courses`, `tools/merge-shards.js`, `lib/`.

**The pass stopped early because the shared disk filled.** Free space fell from 2.9 GB to about 310 MB during the session (other sessions' files). The brief says to stop below 500 MB, so work stopped after batch 4. The target was 300 rows; 130 were added.

## How pages were read

- All pages were fetched with the repo's client (`tools/courses/http.js`, `NODE_USE_ENV_PROXY=1`): robots.txt first (including the Claude and Anthropic agent names), at least 3.3 s between requests to one host, one request at a time per host, a generic User-Agent, https only. A wrapper also read `Crawl-delay` and waited that long when it was above 3.3 s (5 s on rcpch.ac.uk); hosts asking for more than 60 s would have been skipped (none did). A 401/403, a bot challenge, a robots refusal or a failed connection was logged and the host skipped.
- The wrapper decoded each page with the charset it declares (header or `<meta charset>`), so windows-1250 pages (kardio-cz.cz) give verbatim Czech quotes. Named HTML entities left over by `tools/courses/util.js` (`&auml;`, `&ouml;` …) were decoded too, so quotes match what the page shows.
- Every `datesQuote` was sliced by script from the whitespace-collapsed visible text of the page it cites, and a build script checked again that it is on that page and passes `tools/evidence.js`. `verifiedOn` is the UTC date of the fetch: 2026-11-27 for every row and entry.
- `datesSourceUrl` is always an event, course, listing or congress page, never a site root (two candidates were moved off `index.html`/root pages for that reason).
- The build script also refused a row when the merge step would drop it: same id, same series key and start, same series in the same year (these were confirmed as estimates instead where they were estimates), same name and year (merge-shards' own normalisation), or the same url and start day (merge-shards' url+date rule; one BVOU row was dropped for this).
- Only meetings run by the society or academy whose page was read were added. BDC|Akademie pages were filtered on "Veranstalter BDC|Akademie" (the BDC calendar also lists Conventus, durchblicken.org, Laserakademie and other organisers' events). The DRG event platform was filtered on "Veranstalter Deutsche Röntgengesellschaft". UKKA's events feed was filtered to UKKA, KQIP, BAPN and RaDaR events (category "External" left out). BVF Akademie was read through its own "BVF Akademie" filter.
- Left out: online-only and webinar sessions, multi-week mixed online/in-person courses (Psychosomatische Grundversorgung, child protection courses spanning weeks), e-learning windows ("1 Jan – 30 Jun 2027" RCS England modules), courses for practice staff only (MFA, Praxismanager IHK, MVZ-Geschäftsführer), student courses (Nur Mut, Staatsexamen und Karriere), short practice slots (RCS England learner-led laparoscopy sessions), invite-only events, business meetings, and pages with no city (THD 2027 congresses, DOG 2027, ÖKG 2027, DDG Diabetes Kongress 2027).
- End dates come from the page. One-day rows are pages that show a single date or say one day.
- **Map pins.** Cities new to the data were pinned from Wikidata P625, reached through the city's en.wikipedia.org article and `www.wikidata.org/wiki/Special:EntityData/Q….json` (the SPARQL endpoint and `w/api.php` are disallowed by robots.txt). Items: Lippstadt Q3943, Homburg Q7040, Bamberg Q3936, Pulheim Q4113, Bernburg Q14938, Heringsdorf Q543232, Landshut Q3974, Templin Q519157, Magdeburg Q1733, Recklinghausen Q3050, Duisburg Q2100, Rendsburg Q490457, Blankenfelde-Mahlow Q574128, Blankenburg (Harz) Q525960, Weimar Q3955, Chemnitz Q2795, Baden-Baden Q4100, Greifswald Q4098, Braunschweig Q2773, St. Anton am Arlberg Q659996, Mechelen Q162022, Erfurt Q1729, Solihull Q397343, Warrington Q215733. They were not added to `tools/city-coords.json`.

## Numbers

| | before | after |
|---|---|---|
| Upcoming conferences (end on or after 27 Nov 2026) | 4599 | 4729 |
| Upcoming with evidence (`datesSourceUrl`) | 3263 | 3412 |

- **+130 new rows, all with evidence.** By start year: 16 in 2026 (Dec), 114 in 2027.
- By country: DE 97, GB 25, CZ 5, JP 1, CH 1, AT 1.
- **19 estimates confirmed** (provenance entries, with fixes to name and blurb):

| Row | Now | Was |
|---|---|---|
| turkish-endocrinology-and-metabolism-congress-2027 | 48th TEMD congress, 28 Apr – 2 May 2027, Antalya | 20 Oct |
| cks-vyrocni-sjezd-2027 | XXXV. výroční sjezd ČKS, 8–11 May 2027, Brno | 9 May |
| nham-kuala-lumpur-2027-expected | NHAM Congress 2027, 15–18 Apr 2027, Kuala Lumpur | 23 Apr |
| jastro-yokohama-2027-expected | JASTRO 40th, 28–30 Oct 2027, Kyoto | Yokohama, 18 Nov |
| drg-roentgenkongress-2027 | RÖKO 2027, 5–7 May 2027, Leipzig | Hamburg, 12 May |
| drg-roentgenkongress-2028 | RÖKO 2028, 24–26 May 2028, Leipzig | 10 May |
| dgthg-tagung-2027 | DGTHG/DGPK, 13–15 Feb 2027, Cologne | Leipzig, 21 Feb |
| dgp-kongress-2027 | 67. DGP-Kongress, 3–6 Mar 2027, Cologne | Leipzig, 10 Mar |
| dgk-jahrestagung-2027 | 93. DGK-Jahrestagung, 31 Mar – 3 Apr 2027, Mannheim | 14 Apr |
| ddg-tagung-dermatologie-2027 | DDG-Tagung, 21–24 Apr 2027, Berlin | 28 Apr |
| degro-kongress-2027 | 33. DEGRO-Kongress, 24–26 Jun 2027, Leipzig | Berlin, 9 Jun |
| dgnc-jahrestagung-2027 | DGNC 2027, 6–9 Jun 2027, Erfurt | Berlin, 9 Jun |
| dgsmp-annual-meeting-2027 | 62. DGSMP, 22–24 Sep 2027, Hamburg | Berlin, 8 Sep |
| dgsm-kongress-2027 | 35. DGSM, 2–4 Dec 2027, Mannheim | Berlin, 22 Sep |
| dgou-kongress-2027 | DKOU 2027, 19–22 Oct 2027, Berlin | 26 Oct |
| boa-congress-2027 | BOA 2027, 14–17 Sep 2027, Liverpool | Manchester, 21 Sep |
| boa-congress-2028 | BOA 2028, 19–21 Sep 2028, Aberdeen | Birmingham |
| bssh-autumn-scientific-meeting-2027 | BSSH Scientific Meeting, 8–10 Sep 2027, Manchester | 10 Nov |
| semicyuc-congreso-2027 | LXII Congreso SEMICYUC, 6–9 Jun 2027, Seville | Valencia, 9 Jun |

## New rows by source

| Source (organiser's own pages) | Rows | Notes |
|---|---|---|
| BDC\|Akademie (bdc.de/events, found from `wp-sitemap-posts-event-1.xml`) | 34 | Facharztseminare, Viszeralchirurgie kompakt, MIC 1–3, VATS, robotics hospitation, Chirurginnen auf dem Weg nach oben, Basischirurgie, Kindertraumatologie, Begutachtung courses (only Veranstalter BDC\|Akademie) |
| BVF Akademie (bvf.de, own filter) | 18 | Regional Gynäkologentage, FOKO 2027, Sexualmedizin and Facharzt seminars |
| AE – Arbeitsgemeinschaft Endoprothetik (ae-gmbh.com/ae-veranstaltungen) | 16 | In-person master and basic courses, 29. AE-Kongress Berlin |
| BVOU regional meetings, BVKJ, DGTHG seminars, DRG own events, DWG Akademie, DGK (DEK, Herztage) | 31 | The two BDA Anästhesietage were already in the data |
| UK: RCPsych (sitemap `detail/YYYY/MM/DD` pages), UKKA events feed, RCPCH, RCPE, RCEM, RCS England PERT course, BSSH | 25 | |
| ČLS JEP calendar, Lékařský dům Praha (place=1) | 5 | One-day seminars and workshops |
| JASTRO brachytherapy division (2027jgb.com) | 1 | |

## For a person to check

- **THD 2027** (Turkish Society of Haematology): 53. Ulusal Hematoloji Kongresi is 9–14 Nov 2027 on thd.org.tr, but neither the list nor the event page names a city, so the estimate (27 Oct, Antalya) was not changed.
- **ÖKG 2027** is 2–5 Jun 2027 on atcardio.at, with no city given (2026 was Salzburg). **DDG Diabetes Kongress 2027** is 5–8 May 2027 on ddg.info with no city. **SGI 2027** is 22–23 Sep 2027 in Lausanne (sgi-ssmi.ch home page news), but the news page itself returns 404, so it was not used. **DOG 2027** is 30 Sep – 3 Oct 2027 (dog.org), no city.
- **ESCP 2027** is in Geneva (escp.eu.com menu) with dates to follow. **EFORT 2027** is 19–21 May 2027 in Athens (efort.org home page). **ESGO 2027** is 25–27 Feb 2027 in London (esgo.org). These were not checked against the data in this pass.
- **SEMICYUC event pages** show dates but not venues in the visible text (the venue sits in the Events Calendar JSON). Only VENTIBARNA (Barcelona, already in the data) and the congress (Seville, in its title) had a visible city.
- **RCPsych** pages show the day and month without the year ("04 Dec One Day Event"); the year comes from the page URL (`detail/2026/12/04/…`) and the page title.

## Blocked hosts (skipped, not bypassed)

- **Bot challenge or 403:** rcoa.ac.uk, bgs.org.uk, oaa-anaes.ac.uk, endocrinology.org, theabn.org, esska.org, aga-online.ch, semfyc.es, kbb-bbc.org.tr.
- **robots.txt:** internisten.nl, sfrnet.org, sinitaly.org, sfmu.org, sfo.asso.fr.
- **Fetch failed at the session proxy:** jsts.gr.jp, jssr.jp, veranstaltungen.slaek.de, rcp.ac.uk/events, ucd.org.tr, klimik.org.tr, sedar.es, seom.org, sehh.es, siot.it, kniegesellschaft.de, bpsasm.org; b-s-h.org.uk annual conference page returned HTTP 520.
- **Rendered by script, no dates in the HTML:** DGK-Akademie course calendar (herzmedizin.de, about 235 courses a year), services.rcsed.ac.uk listing and most RCSEd course pages ("To be confirmed"), rcr.ac.uk events (my.rcr.ac.uk), DGU event calendar beyond the first page ("Mehr laden").
- **Others' events, not used:** aekno.de event sitemap (6,693 certified CME events by many organisers), DRG platform events by hospitals and companies, DGU calendar submissions, BVHNO calendar (mostly webinars and other organisers).

## Leads for global-12

1. **German professional associations and society academies** remain the densest source. Not yet read: DGK-Akademie (script), DGPPN Akademie (dgppnakademie.de: Kompaktkurs Facharzt, workshops), DIVI Akademie (akademie.divi.de; AKI-NET 18–19 Feb 2027 Nürnberg and Beginner-Kurs Intensivmedizin 15–19 Mar 2027 Berlin are on divi.de), DGU Arbeitskreise, BVOU/ADO course pages, IHF (Hausärztetage, aerzte.ihf-fortbildung.de), DGRh/Rheumaakademie, DGPRÄC (ICOPLAST 2027 site), DGG/DGKCH academies. Pattern that worked: WordPress `wp-sitemap-posts-event-1.xml` (BDC), TYPO3 listing filters (BVF, BVKJ), Drupal paged lists (`?page=1`, AE).
2. **The Events Calendar JSON** (`/wp-json/tribe/events/v1/events?per_page=50&start_date=…`) worked on ukkidney.org and semicyuc.org this pass. Quotes must come from the event page, and those pages often show the date without the year or without the venue.
3. **Polish Cardiac Society** (ptkardio.pl) home page lists 2027 section conferences (Opole 90. Wiosenna Konferencja 5–6 Mar, Kasprowisko Karpacz 17–20 Mar, AITK Poznań 1–3 Apr, PolEcho Poznań 21–22 May, HFA Kraków 11–12 Jun and others); the event pages behind "Zobacz więcej wydarzeń" were not read. ESSO courses on essoweb.org (thyroid cancer surgery 15–16 Jan 2027, CRS 3–5 Feb, HIPEC 11–12 Mar), Danish Cardiology Society (cardio.dk) and Turkish Radiology Society branch symposia (turkrad.org.tr) are also leads.
4. **Estimates still open** in DE/GB/IE/CH/AT for 2027: DGRh, DGKJ, DGPPN, DGN, DIVI, DGPRÄC, Palliativkongress, BCIS, BMFMS, BSH, BFS, BSCCP, BPS, UK Kidney Week, BAUS, AUGIS annual, BAPM, RCR, BHRS (millbrook-events.co.uk), RCGP, ICS, BAPEN, BSPED (2026 meeting is 8–10 Dec in Bristol), BAPRAS, BSI, UKSF, ICGP, SGK, ÖGHO, ESNR. About 380 non-US/AU/NZ estimates for 2027 and 400 for 2028 remain, half of them in Latin America, Korea, Turkey and Spain.
