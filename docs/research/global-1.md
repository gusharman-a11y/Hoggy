# Data global-1 (25 Nov 2026)

Branch `data-global-1` (from `main`). Non-AU/NZ conference rows only. Only `data/shards/*`, `tools/official-domains.json`, the rebuilt `data/conferences.js` and this file changed. No AU/NZ row, AU/NZ shard or course source was touched. The 245 AU/NZ rows are byte-identical after the merge.

Every page was read this run with the repo's polite client (`tools/courses/http.js`: robots.txt, at least 3 s per host, generic User-Agent, https only). Challenges, 403s and robots refusals were logged and skipped, never worked around. Search results were leads only, never a date source. Every quote was taken from the page text and checked against it by script. None was typed by hand.

## Numbers (upcoming rows, end on or after 25 Nov 2026)

| | before | after |
|---|---|---|
| Upcoming conferences | 2178 | 2168 |
| Confirmed with evidence | 544 | 624 |
| Legacy (not yet re-checked) | 343 | 282 |
| Estimated | 1291 | 1262 |

Non-AU/NZ only:

| | before | after |
|---|---|---|
| Upcoming | 1937 | 1927 |
| Confirmed with evidence | 432 | 512 |
| Legacy | 302 | 241 |
| Estimated | 1203 | 1174 |

Upcoming fell by 10: 14 duplicate rows were removed (13 estimates and 1 legacy row) and 4 new rows were added. `validate-data` 0 errors. `check-courses` 0 errors. `check-experiences` 0 errors. `npm test` passes (120 pass, 2 skipped, 0 fail). In the cloud session, `npm test` needs `npm ci` and `NO_PROXY=localhost,127.0.0.1`, because the client-ready test calls the local server.

## Files

- `data/shards/provenance-global-1.json`: 79 evidence entries (19 estimates confirmed, 60 legacy rows re-verified).
- `data/shards/global-1.json`: 4 new rows with evidence.
- `data/shards/fix-global-1.json`: 14 duplicate removals and 17 blurb rewrites. The blurb rewrites cover rows confirmed this run whose blurb still said "dates expected" or named the estimated city.
- `tools/official-domains.json`: 2 entries, added at the top of the list. `euroanaesthesia.org` is the ESAIC congress site, linked from esaic.org. `esceo.org` is for `wco-iof-esceo`: ESCEO co-organises the congress and its events page lists WCO 2027.

## How rows were checked

1. `verify-dates` `checkRow` ran over all 1505 upcoming non-AU/NZ estimated and legacy rows. Result: 9 confirmed, 216 review, 1062 no dates for the edition, 117 blocked, 101 errors.
2. Review rows whose dates were found only on a site root: up to 5 same-domain subpages were read. An entry was kept only where a subpage gave exactly the same range.
3. Review rows on a site root with several ranges: the same subpage pass. An entry was kept only where the subpage gave the row's own dates.
4. "No dates" rows on a site root: a subpage pass (8 found).
5. Major congresses by hand, as in the priority order. Each quote was taken from the page and checked by `manual.js`.

Seven automatic matches were rejected after reading the page, because the page was about a different meeting or the city was not the venue:
- `sca-annual-meeting-2027`: the page was SCA Echo.
- `aast-annual-meeting`: the page was the AAST Practical Surgery Summit.
- `aedv-congreso-2027`: the page was a course for department heads.
- `dgrh-kongress-2027`: the dates appeared only in a student-travel note.
- `ddg-tagung-dermatologie-2027`: Berlin appeared only as the organiser's address.
- `esceo-congress-2027`: duplicate (see below).
- `apasl-taipei-2027-expected`: duplicate (see below).

## Majors confirmed or added

| Row | Dates | City | Source |
|---|---|---|---|
| ERS Congress 2027 (legacy → evidence) | 11–14 Sep 2027 | Milan | ersnet.org congress page |
| EULAR 2027 (legacy → evidence) | 9–12 Jun 2027 | Berlin | congress.eular.org/general-information |
| ESMO Congress 2027 (legacy → evidence) | 17–21 Sep 2027 | Barcelona | esmo.org meeting calendar |
| **ESMO Congress 2028 (new)** | 20–24 Oct 2028 | Milan | esmo.org meeting calendar |
| **ESMO Asia Congress 2027 (new)** | 3–5 Dec 2027 | Singapore | esmo.org meeting calendar |
| ESMO Breast, GI, Sarcoma, TAT, ELCC 2027 | as listed | Milan, Barcelona, Lugano, Paris, Munich | esmo.org |
| ESMO Gynaecological 2027 (estimate → evidence) | 16–18 Jun 2027 (was 17–18) | Vienna | esmo.org |
| Euroanaesthesia 2027 (legacy → evidence) | 29–31 May 2027 | Copenhagen | euroanaesthesia.org/2027 |
| **Euroanaesthesia 2028 (new)** | 20–22 May 2028 | Vienna | euroanaesthesia.org/2028 |
| ACC.27 with WCC (legacy → evidence) | 10–12 Apr 2027 | Houston | accscientificsession.acc.org |
| Heart Rhythm 2027 | 13–16 May 2027 | San Francisco | heartrhythm.com |
| SIR 2027 and SIR 2028 | 20–24 Mar 2027 / 18–22 Mar 2028 | | sirweb.org |
| WCO-IOF-ESCEO 2027 | 8–11 Apr 2027 | Vienna | esceo.org |
| IDF World Diabetes Congress 2027 | 9–12 Apr 2027 | Singapore | idf2027.org |
| WCN 2027 (World Congress of Neurology) | 23–25 Oct 2027 | Cape Town | wcn-neurology.com |
| SABCS 2026 | 8–11 Dec 2026 | San Antonio | sabcs.org |
| EANO 2027 | 16–19 Sep 2027 | Athens | eano.eu |
| **Highlights of ASH in Asia-Pacific 2027 (new)** | 12–13 Feb 2027 | Bangkok | hematology.org |

### Estimates corrected on the organiser's page (dates and/or city)

| Row | Now | Was |
|---|---|---|
| aadocr-iadr-general-session-2027 | 17–20 Mar 2027, Minneapolis | 3 Mar, Denver |
| acpgb-annual-meeting-2027 | 28–30 Jun 2027, Brighton | 21 Jun, Glasgow |
| aiom-congresso-2027 | 15–17 Oct 2027, Rome | 22 Oct |
| apasl-taipei-2028-expected | 13–16 Apr 2028, Seoul | 15 Mar, Taipei |
| can-neuroscience-meeting-2027 | 6–9 Jun 2027, Calgary | 18 May, Montreal |
| sggg-jahreskongress-2027 | 24–26 Jun 2027, Bern | 16 Jun, Lugano |
| samba-annual-meeting-2027 | 6–8 May 2027, Savannah | 12 May, Austin |
| sitc-annual-meeting-2027 / 2028 | 3–7 Nov 2027, National Harbor / 1–5 Nov 2028, Houston | Washington both |
| sobp-annual-meeting-2027 / 2028 | 6–8 May 2027, Chicago / 20–22 Apr 2028, San Francisco | San Diego both |
| dgp-palliativkongress-2028 | 13–16 Sep 2028, Münster | 20 Sep, Hamburg |
| dgfn-kongress-2027 | 7–10 Oct 2027, Berlin | 15 Sep |
| bsc-annual-meeting-2027 | 28–29 Jan 2027, Brussels | 10 Mar |

The other legacy rows re-verified with evidence (dates unchanged) include ACMG, ACNP, AEEDC, APOA, APTA CSM, ASGCT, CAEP, COA, Diabetes UK, EACR, ECTES, EMAS, ESPGHAN (2 meetings), ESSR, JSSR, OSSA, SHEA Spring, SGAIM, SLAC, TKRCD, WAS and others. The full list is in the provenance shard.

## Duplicates removed (`fix-global-1.json`)

| Removed | Kept |
|---|---|
| esc-acvc-2027 | esc-acute-cardiovascular-care |
| esc-europrevent-2027 | esc-preventive-cardiology |
| esmo-gi-2027 | esmo-gastrointestinal-cancers-congress |
| esmo-tat-2027 | esmo-targeted-anticancer-therapies-congress |
| ectrims-congress-2027 | ectrims-2027 |
| eadv-spring-2027 | eadv-symposium-2027 |
| eadv-spring-2028 | eadv-symposium-2028 |
| eano-meeting-2027 | eano-2027 |
| eco-european-congress-on-obesity-2027 | european-congress-on-obesity |
| ecp-european-congress-of-pathology-2027 | european-congress-of-pathology |
| ese-european-congress-of-endocrinology-2027 | european-congress-of-endocrinology |
| esceo-congress-2027 | wco-iof-esceo |
| ddw-2027 | ddw |
| apasl-taipei-2027-expected | apasl-2027 (AU row, untouched; apasl.info lists APASL 2027 in Sydney) |

## Trip angle (ski, food and wine, festivals)

Every tagged destination row outside AU/NZ (Rusutsu, Niseko, Tomamu, Big Sky, Vail, Whistler, Banff, Val d'Isère, Maui, Maldives, Hoi An, Bali) was already confirmed with evidence before this run. Of the estimated rows in food-and-wine and festival cities (Lyon, Bologna, Florence, Porto, Cape Town, Edinburgh, New Orleans, Rio, Kyoto), the ones whose pages had dates were confirmed in the pass above: OSSA, WCN and WAS (Cape Town) and JSSR (Kyoto, 15–17 Apr 2027). The rest have no published dates yet. SACO 2027 (Cape Town) is still waiting, because its page shows the dates apart from the name.

## Blocked or failing hosts (skipped, not bypassed)

- **Bot challenge (38):** aae.org, aaopt.org, aasm.org, accp.com, acep.org, acsm.org, adaa.org, amia.org, aorn.org, apacrs.org, arvo.org, ashp.org, astro.org, bgs.org.uk, cap-acp.org, east.org, endocrinology.org, esska.org, himss.org, hkcr.org, kbb-bbc.org.tr, medicos.cr, naccho.org, oaa-anaes.ac.uk, pediatr.org.tw, philippinemedicalassociation.org, posna.org, professional.heart.org, pvrinstitute.org, rcoa.ac.uk, rsroc.org.tw, scct.org, scu.org.uy, semfyc.es, socesp.org.br, surgery.org.tw, theabn.org, triological.org. Also, by hand: isth.org, iasociety.org, eans.org.
- **robots.txt (15):** anesth.org.tw, asi.org.in, ddw.org, news.ddw.org, easd.org, easl.eu, entnet.org, hksn.org, internisten.nl, oftalmologos.org.ar, ons.org, pathology.or.kr, radiology.or.kr, sfmu.org, sinitaly.org.
- **403 (9):** aplarcongress.com, auanet.org, clasa-anestesia.org, jslm.org, pedsendo.org, secardiologia.es, senefro.org, sgim.org, siim.org.
- **Connection failures through the session proxy (UND_ERR_SOCKET, about 55 hosts; retried, still failing):** these include aapmr.org, aapos.org, ahpba.org, asrm.org, ccs.ca, eaes.eu, espen.org, ebcog.org, hub.eaaci.org, seom.org, sehh.es, sedar.es, snfge.org, siot.it, sesc.org and uscap.org. Try them from the laptop.
- **JavaScript-only pages (no dates in the HTML):** estro.org, tctconference.com (home page only), idweek.org (FAQ says "coming soon"), aasld.org, vam.vascular.org (dates on the site root only).

## Leads for global-2

1. **Majors still legacy**, mostly on blocked hosts: DDW 2027, EASD 2027 and 2028, AAO-HNSF, ACEP 2027 and 2028, AUA 2027, EASL 2027, ESCRS 2027 (the page lists the range without a name), EACTS 2027 (page says only "October 2027"), IDWeek 2027, TCT 2027 (dates on tctconference.com root only), AAO 2027, BSG Live 2027 (dates on the root only), EUSEM 2027 (Helsinki, 16–20 Oct, root only).
2. **Majors still estimated:** AHA 2027 and 2028 (blocked), ASH 2027 (no page yet), ASTRO and ARVO (blocked), ESTRO 2027 (Milan, 21–25 May, appears only in a grants PDF), ESSKA 2027 (blocked), ESCMID 2028 (31 Mar–4 Apr 2028 on escmid.org, but the city is not named), AASLD, ACG and AAGL 2027.
3. **Missing majors not added** (blocked or no page): ISTH 2027 (Vancouver; isth.org blocked), IAS 2027, EANS 2027, WCLC 2027, ISAKOS 2027.
4. **verify-dates review list:** 216 items, the "N different ranges" cases with no exact match. Regenerate with the run1 approach, or with `node tools/verify-dates.js --ids ...`.
5. **Legacy rows whose page now shows other dates** (for a person to check): epns-congress (page shows 25–27 Oct 2027), nkf-spring-clinical-meetings (12–15 May vs 11–15), sap-43-congreso-argentino-pediatria-2027, ags-annual-scientific-meeting and amp-annual-meeting (the pages were for other events).
6. **ESC 2028 family** (ESC Congress, EHRA, ACVC, EuroPrevent, EuroEcho 2028): not on escardio.org yet. Re-check in Q1 2027.
