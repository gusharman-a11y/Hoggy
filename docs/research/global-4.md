# Data global-4 (25–26 Nov 2026)

Branch `data-global-4` (from `data-combined`). This pass added new non-AU/NZ meetings. Files changed:

- `data/shards/global-4.json`: the new rows.
- `data/shards/provenance-global-4.json`: evidence for 2 existing rows.
- `data/shards/fix-global-4.json`: names and blurbs for those 2 rows.
- `tools/official-domains.json`: 53 entries added at the top of the `official` list.
- The rebuilt `data/conferences.js` and this file.

What was left alone:

- No AU/NZ row, AU/NZ shard, `data/courses` file or `tools/merge-shards.js` was touched. The 261 AU/NZ rows are byte-identical after the merge.
- `ishlt-annual-meeting-2028` is unchanged.

## How pages were read

Every page was fetched in this session with a polite client:

- robots.txt was read first. That includes wildcard rules (for example `Disallow: /*?field` on ce.mayo.edu) and Crawl-delay: 10 s on ce.mayo.edu, cpd.utoronto.ca and the EthosCE sites, and 30 s on cme.wustl.edu.
- At least 3.2 s between requests to one host, a generic User-Agent, and https only (redirects too).
- A 401/403, a Cloudflare or captcha page, or a robots refusal was logged and skipped, never worked around.

CloudCME listings were read with the site's own public listing form, using "50 results per page" and the page links. No login was used.

Every `datesQuote` was checked by script against the whitespace-collapsed visible text of the page it cites. No quote was typed by hand. Each `datesSourceUrl` is an event page or an event-listing page on the organiser's own site, never a site root. The city comes from the same organiser page.

Rows were left out in these cases:

- The page named only a region, island or park: Grand Cayman, Yellowstone, Yosemite, Glacier, Zion, Napa/Sonoma, Sicily, Cape Cod, Peninsula Papagayo, Acadia.
- The venue had no city.
- The event was online only.
- Two dates on one page disagreed.

Search results and listing sites were used only as leads.

**Clock note.** The session ran past midnight UTC, so some pages were fetched on 26 Nov 2026. The brief asked for `verifiedOn` 2026-11-25, so every row carries that date.

## Numbers

Conference rows that end on or after the run date:

| | before | after |
|---|---|---|
| Upcoming conferences (all) | 2555 | 2973 |
| Confirmed with evidence | 1129 | 1549 |
| Legacy (not yet re-checked) | 229 | 229 |
| Estimated | 1197 | 1195 |
| Course sessions (`data/courses`, not touched) | 3457 | 3457 |

The database now holds about 6,430 conferences plus course sessions, against the 11,000 target.

- **+420 new rows, all with evidence.** 66 start in Nov–Dec 2026, 347 in 2027 and 7 in 2028.
  - By country: 322 US, 66 GB, and 32 in 18 other countries.
  - Countries outside US and GB: IT 4, DE 4, IN 3, DK 3, SE 2, AE 2, GR 2, JP 2, MX, BS, PR, AT, NL, ES, BR, CL, PE, RS.
- **2 existing estimates confirmed and corrected**:
  - `wms-summer-conference-2027`: now Stevenson WA, 27–30 Jun 2027 (was Park City, July).
  - `wms-summer-conference-2028`: now Vail, 8–12 Jul 2028.

The checks gave these results:

| Check | Result |
|---|---|
| `merge-shards` | ok: 420 new rows applied, 0 invalid, 0 downgrades |
| `validate-data` | 0 errors. Warnings unchanged at 1371. |
| `check-courses` | 0 errors |
| `check-experiences` | 0 errors |
| `npm test` | 120 pass, 2 skipped, 0 fail (needs `npm ci` and `NO_PROXY=localhost,127.0.0.1`) |

## New rows by source

| Source (organiser's own pages) | Rows | Notes |
|---|---|---|
| CloudCME catalogues of 52 US academic and health-system CME offices | 218 | Quote is the event page's "Date & Location …" line. See the CloudCME section below. |
| Royal Society of Medicine (rsm.ac.uk/events/…) | 43 | Section meetings of at least 3.5 h at the RSM in London, a Chertsey meeting, and the Urology Section winter meeting in Sälen. See the RSM section below. |
| Mayo Clinic School of CPD (ce.mayo.edu/content/…) | 42 | See the Mayo section below. |
| Medical Education Resources (mer.org) | 19 | See the MER section below. |
| University of Chicago CME (EthosCE) | 17 | |
| UT Southwestern CME (EthosCE) | 6 | |
| Baptist Health South Florida CME (EthosCE) | 6 | |
| ESSO courses | 10 | Berlin, Milan, Halle, Dubai, Hamburg, Birmingham, Innsbruck, Verona, Utrecht |
| ESVS courses | 7 | Brescia, Copenhagen ×3, Barcelona, Thessaloniki, Stockholm |
| RCOG courses (rcog.eventsair.com, linked from rcog.org.uk/events) | 9 | Basic Practical Skills and ROBuST in Bradford, Nottingham, Sheffield, Bishop Auckland, Pune ×3 and Abu Dhabi; Scottish Senior Staff Conference in Dunblane |
| RCPsych conferences | 8 | Only rows whose quote also names the year |
| ACP chapter meetings | 7 | Colorado, Hawaii, Idaho, Louisiana, Maryland, Rhode Island, Japan (Kyoto) |
| Highlights of ASH 2027 | 6 | Chicago, New York, Seattle, Washington, Athens, Santiago |
| BSG | 5 | Birmingham, Sheffield, London, Aberdeen, Leamington Spa |
| RCOphth courses | 5 | London |
| MGH Psychiatry Academy (mghcme.org) | 4 | Boston ×2, Ko Olina, Lake Buena Vista |
| ACC | 3 | ACC Latin America (Lima), ACC Mediterranean (Belgrade), Colorado ACC (Colorado Springs) |
| ACS | 2 | Innovation Summit (Chicago), Quality, Safety & Cancer (Seattle) |
| ESICM | 2 | Euro-Brazil (São Paulo), Euro-Japan Forum (Kyoto) |
| WMS | 1 | Winter Conference 2027, Keystone |

### CloudCME catalogues (218 rows)

Kept: live, in-person activities of at least 4 h, or multi-day ones of up to 7 days.

Left out: online, webinar and ECHO activities; regular series and grand rounds; nursing-only courses (TNCC, ENPC, AWHONN, S.T.A.B.L.E.); internal staff training; and items with no city.

Many rows are destination meetings: Snowmass, Big Sky, Beaver Creek, Vail, Steamboat, Mammoth, Park City, Kiawah Island, Marco Island, Half Moon Bay, and Hawaii (Kamuela, Koloa, Honolulu, Ka'anapali).

The CloudCME hosts are: ucsf, stanford, hopkinscme, cedars, chop, cchmc, intermountain, iu, jefferson, mdanderson, miami, mssm, musc, nationwidechildrens, northwestern, uams, uci, ucsd, uiowa, umich, upenn, uva, uw, vcu, vumc, yale, adventhealth, allina, medstar, piedmont, sentara, sharp, slu, stjude, ttuhsc, uf, uofuhealth, mskcc, washu, hmh, albanymed, beaumont, billingsclinic, case western (cwru), childrensal, cooperhealth, hoag, lahey, mcg, metrohealth, ohiohealth and spectrumhealth.

### Royal Society of Medicine (43 rows)

The event list was built from the sitemap and the 25 search-result pages. Club, library, membership, history evenings, online and partner events were left out.

### Mayo Clinic School of CPD (42 rows)

These are the course pages that global-3 did not reach. They include:

- Endocrine Update 2027 (Paradise Island)
- STiR 2027 (Carolina, PR)
- Selected Topics in Internal Medicine 2028 (Kamuela)
- Diving & Hyperbaric Medicine (Cozumel)
- Transforming Women's Health (Rome)

The quote is the page's own "City, ST US date" header, or its "dates – venue – city" line.

### Medical Education Resources (19 rows)

These conferences were on MER's schedule but not in the data. MER's schedule names the resort town for each: Ko Olina, Wailea, Ka'anapali, Poipu, Kapalua, San Antonio and Lake Buena Vista.

## tools/official-domains.json (53 entries at the top)

- `rcog.eventsair.com`: the RCOG events site, linked from rcog.org.uk/events.
- One host entry for each CloudCME catalogue used (for example `ucsf.cloud-cme.com`), listing the row ids. Each subdomain is a single institution's catalogue and carries its name. The rows' `url` and `datesSourceUrl` are on the same subdomain.

## For a person to check

- **Mayo pages whose dates disagree** (left out):
  - FaceAcademy 360: the header says 23–26 Jun 2027 and the body says 22–26 Jun.
  - NEPHROGENETICS Update 2026: the header says 3–5 Dec and the body says 4–5 Dec.
  - 2027 Best Practices for Mood Disorders: the body still describes Oct 2026.
- **Copy lint** (left out, as in global-3): "Best Practices for Mood Disorders" and "Updates in Lymphoid Malignancies 2027: Best of Lugano".
- **Same day on one CloudCME host** (6 rows dropped). The merge treats two rows on the same host with the same start day and the same path (`/default.aspx`) as one meeting, because the event id is in the query string. These were dropped:
  - Johns Hopkins: Beacham Geriatrics (25 Feb 2027) and Tumulty Topics in Clinical Medicine (12 May 2027).
  - Cedars-Sinai AI in Medicine Symposium (11 Dec 2026).
  - MD Anderson Cell Therapy Symposium (15 Jan 2027).
  - UC Irvine HoLEP Masterclass and TNT Child & Adolescent (Jan–Feb 2027).
  - UCSF Infectious Diseases in Clinical Practice, Kauai (14 Feb 2027).

  If the merge rule is relaxed to compare the query string for `cloud-cme.com`, they can be added from the cached pages.
- **RCPsych**: about 25 conference pages give the date without the year (the year is only in the URL), or use a page layout the parser did not read. They were not added.
- **MER 2028 conferences** with ids 1487, 1488 and 1497 (Feb 2028) are not on MER's schedule yet, so no town is named. They were not added.
- **RSM Applied Therapeutics in Palliative Medicine** (Jan–Jun 2027) runs for months, so it was not added as a conference.

## Blocked hosts (skipped, not bypassed)

- **Bot challenge or 403:** aapl.org, ascp.org, asgbi.org.uk, bmj.com, eans.org, efp.org/events, efort.org/events, gotoper.com (Physicians' Education Resource), isth.org, nyulangone.org, and cme.utsouthwestern.edu/course-catalog-table. The UTSW course pages themselves loaded.
- **robots.txt:** bad.org.uk/events, easl.eu, ehra.org, ers-education.org (redirects to channel.ersnet.org), hrsonline.org, isrs.org, cme.ufl.edu, cme.vcu.edu, and ce.mayo.edu's filtered listing (`/*?field`). Mayo's paged homepage listing and course pages are allowed.
- **Rendered by script, no dates in the HTML:**
  - Cleveland Clinic (clevelandclinicmeded.com, which loads an Ungerboeck calendar)
  - RCS England course finder
  - AO Foundation courses
  - ESMO calendar
  - IRCAD
  - EHA
  - acc.org meeting list (the individual meeting pages work)

## Leads for global-5

1. **More CloudCME and EthosCE catalogues.** Hosts were found by trying `<name>.cloud-cme.com` and `cme.<university>.edu`. About 70 hosts answered, and about 300 more names gave nothing. Hosts that were found but gave few or no rows: osu, uab, ucla, ucdavis, ouhsc, cuanschutz, umaryland, mainehealth, avera, wellspan, uchealth, tenet, hcahealthcare, aahs, premierhealth, promedica, stelizabeth, adventisthealth, virginiamason, childrensmercy, etsu, wmed, wsu, fairview and stlukes. Other EthosCE sites: cme.wisc.edu (its live list is mostly virtual), cme.bu.edu, ccehs.upmc.com and cme.healthpartners.com.
2. **UK college pages** that list dates and cities: RCPSG (Glasgow), RCEM, the RCPsych pages above, the ICS and the RCPE symposia. RCS England and RCP London are rendered by script.
3. **European society course calendars**: the ESGO courses page (Milan, Dec 2026), the ESNM calendar, EACMFS postgraduate programmes, and the ESPU and ESOT endorsed-event lists. The organisers' own course pages are needed for these.
4. **Japanese societies.** Homepages often give 会期 and 会場 only on the site root, for example haigan.gr.jp (JLCS 67th, Kobe), jsct.jp (2027 meeting), sanei.or.jp (2028) and jspid.jp (59th, 2027). Each needs the meeting's own page.
5. **Asia and the Gulf**: no bulk source was found. AMS, SingHealth, NUHS, DHA and Cleveland Clinic Abu Dhabi gave 404s at their usual event paths, and HKAM lists mostly online CME. Their event pages should be found one by one.
