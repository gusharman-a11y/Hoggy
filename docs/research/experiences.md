# Experiences: "make a trip of it" (25 Nov 2026)

Owner's direction: the **conference comes first** (right specialty, CPD, dates, budget). Then Hoggy shows what is worth doing around that conference, in that place, at that time of year, and helps package the trip and claim the work part. This run builds the data and the matching for the second step.

Output:

| File | What it is |
|---|---|
| `data/experiences/experiences.json` | 356 experiences keyed by place and time, each with an official source and a verbatim quote |
| `tools/experiences.js` | `experiencesFor(conference, { extraDays })` and `bestTrips(conferences, interests)`; works in Node and the browser (`window.HoggyExperiences`) |
| `tools/experiences.test.js` | 13 unit tests with fixtures (in `npm test`) |
| `tools/check-experiences.js` | Validator (in `npm test`); 0 errors, 0 warnings |
| `tools/experiences/fetch.js`, `build.js`, `src/*.js` | How the file is made: polite fetcher, the curated source rows, and the build that checks every quote against the saved page |

It builds on the `data-destinations` branch rather than repeating it: that branch tags conference rows that are themselves held at resorts (`tags`, `schedule`, `organiserType`). This dataset is the other half: what is on near *any* conference city at *that* time. The two meet in the UI (below): a Hokkaido Trauma Conference row has `tags: ['ski']` and a stated session pattern, and `experiencesFor` adds the Sapporo Snow Festival and the Hokkaido powder months.

## Method

1. **Demand.** From `data/conferences.js`: 2,132 upcoming rows in 334 cities. Priority was AU/NZ (227 rows), the rest of Asia-Pacific (364) and the 60 cities with the most rows (1,383 rows). Months per city were listed so sources could be chosen for the right season (for example Adelaide in February–April, Seoul in April–May and September–November).
2. **Sources.** Only the official tourism board (national, state or city), a national parks or government agency, or the event organiser. No blogs, listing sites, booking sites or encyclopaedias; the validator rejects a list of such hosts. Tourism Australia (`australia.com`), JNTO (`japan.travel`), Sapporo Tourist Association, Discover Tasmania, NT Tourism, DOC (NZ), NPS (US), Formula 1, Supercars and the festival organisers carry most of the rows.
3. **Fetching.** `tools/experiences/fetch.js`: robots.txt checked per host (User-agent `*`), at least 3.5 s between requests to a host, https only, ordinary browser User-Agent string, no cookies or scripts. A 403, 429 or bot-challenge page is recorded as blocked and not retried in any other way. 1,259 URLs requested, 927 read.
4. **Quotes.** Each row carries `sourceQuote`, copied from the page text (at most 200 characters) and machine-checked by `build.js` against the page saved on `verifiedOn`. Only whitespace, curly quotes and zero-width characters are normalised. Quotes in Japanese or Spanish are kept as written (Kobe Luminarie and Sendai Tanabata from the organisers' Japanese pages, Hay Festival Cartagena and FICCI in Spanish).
5. **Seasons and dates.**
   - `fixed-event`: exact dates from the organiser (`season.dates: [{ start, end }]`, several editions allowed, e.g. WOMADelaide 2027 and 2028).
   - `seasonal`: recurring month-day ranges (`season.ranges: [{ from: 'MM-DD', to: 'MM-DD' }]`); a range whose `from` is after its `to` wraps the year end (southern summer, northern ski season, aurora season). A season with this year's exact window (Thredbo alpine hiking 21 Nov 2026 – 25 Apr 2027, Milford Track huts) is `seasonal` with `dates`.
   - Where a page gives "late May" or "early to late February", the range follows those words and the row has a `note`. Where a page gives a start but no end, the row was dropped rather than given an invented end (Berlin markets, Navy Pier WinterFest) or kept as a one-day item (Cactus League opening day, LAAX season opening).
   - Cherry blossom and autumn-leaf rows use JNTO's forecast table (first bloom, peak colour) with a window around it and a note that the season shifts each year.
6. **Place.** `place = { city, region, countryCode, lat, lng, radiusKm, nearby[], sameCountry? }`. `radiusKm` is how far a conference can be for the item to count as "around the conference": 40 km for city items, 60–250 km for day trips (Phillip Island, Blue Mountains, Barossa, Hakuba from Tokyo), up to 450–750 km for a short flight where that is the normal way to do it (Lapland aurora from Helsinki, Oman whale sharks from Dubai, Ningaloo from Perth). `sameCountry: true` keeps national items (Rugby World Cup 2027, German asparagus season, Danish and Austrian Christmas markets) to conferences in that country. `nearby` lists towns matched by name when a conference row's coordinates are missing or wrong.
7. **Copy.** Titles, summaries and notes are Hoggy's words: at most 160 characters, plain, Australian English, checked with `tools/copy-lint.js` (no superlatives) and a lower-case US-spelling check. Organiser quotes are not linted: an organiser's own superlative may stay in a quote, never in our summary.

## Matching (`tools/experiences.js`)

- **Where.** A conference matches a place when its point is within `radiusKm`, or its city (or a listed nearby town) has the same name in the same country. 32 upcoming conference rows carry another city's coordinates (for example `tsanz-asm`, Gold Coast, has Melbourne's; `acem-rural-remote-em-conference`, Hobart, has Brisbane's; full list from the check below). When the dataset knows the conference's city and the row's point is more than 100 km from it, the dataset's point is used and `match.locationCorrected` is set. Those rows should still be fixed in `conferences.js` (see Gaps).
- **When.** The window is `[start - extraDays, end + extraDays]`, `extraDays` 0–7 (capped). Seasonal ranges are expanded for each year the window touches, so a meeting on 30 Dec – 2 Jan matches a December–April ski season and a 29 February range falls back to 28 February in common years.
- **Order.** Fixed events first, then seasons. Score: event 100, season 40 plus up to 30 for a short season; +15 when it overlaps the conference days themselves, −3 per extra day needed; up to −10 for distance within the radius; −25 for year-round items. Each match returns `kind`, `during`, `extraDaysNeeded`, `extraDaysBefore/After`, `overlapStart/End`, the concrete `dates`, `distanceKm`, `placeMatchedBy` and `score`.
- **`bestTrips(conferences, interests, { extraDays = 3, from = today })`** ranks upcoming conferences: top match + half the second + a quarter of the third + 10 per interest matched. With no interests it ranks on all categories.

## Coverage

**Experiences: 356** (194 fixed events, 162 seasonal) from 154 official hosts, in 40 countries.

| Category | Rows | | Country | Rows |
|---|---|---|---|---|
| festival-event | 105 | | Australia | 115 |
| sport-event | 74 | | Japan | 55 |
| nature-wildlife | 70 | | United States | 46 |
| culture-history | 24 | | New Zealand | 17 |
| food-wine | 23 | | United Kingdom | 15 |
| family | 19 (112 rows in all are flagged `family: true`) | | Canada | 14 |
| hiking-outdoors | 16 | | Austria 8, France 6, Singapore/Spain/Switzerland/Netherlands/Korea 5 each | |
| ski-snow | 8 | | 27 more countries | 1–4 each |
| beach-surf 6, dive-reef 5, city-break 3, wellness 3 | | | | |

**Upcoming conferences with at least one matching experience** (2,132 rows):

| Region | Rows | On the conference days | With up to 3 extra days | With a fixed event |
|---|---|---|---|---|
| AU/NZ | 227 | 189 (83%) | 192 (85%) | 59 |
| Rest of Asia-Pacific | 364 | 108 (30%) | 112 (31%) | 5 |
| Middle East (incl. Türkiye) | 80 | 42 (53%) | 43 (54%) | 1 |
| North America | 568 | 95 (17%) | 103 (18%) | 25 |
| Europe | 608 | 90 (15%) | 102 (17%) | 43 |
| Latin America | 218 | 3 (1%) | 5 (2%) | 3 |
| Africa | 67 | 0 | 0 | 0 |
| **All** | **2,132** | **527 (25%)** | **557 (26%)** | **136** |

Of the top 60 cities by row count, 45 have at least one enriched conference (450 of their 1,383 rows). Every Melbourne, Sydney, Adelaide, Hobart and Antalya row has a match; Brisbane 18 of 19.

## 20 "make a trip of it" pairings (content for the app and marketing)

All dates are from the conference row and the experience's source; "during" means the experience overlaps the conference days.

| # | Conference (id) | Where, when | Experience (id) | Experience dates |
|---|---|---|---|---|
| 1 | ANZGOG ASM 2027 (`anzgog-asm-2027`) | Adelaide, 21–23 Apr 2027 | Barossa Vintage Festival (`barossa-barossa-vintage-festival-2027`) | 21–25 Apr 2027, during |
| 2 | Communicable Diseases & Immunisation Conference (`phaa-communicable-diseases-immunisation-conference-2027`) | Cairns, 22–24 Jun 2027 | Swim with dwarf minke whales (`cairns-reef-swim-with-dwarf-minke-whales-cairns`) | June–July, during |
| 3 | ASID ASM (`asid-asm`) | Cairns, 5–8 May 2027 | Reef dry-season diving (`cairns-reef-great-barrier-reef-dry-season-diving-and-snorkelling`) | May–October, during |
| 4 | 124th JSIM Annual Meeting (`jsim-124th-annual-meeting-2027`) | Osaka, 9–11 Apr 2027 | F1 Japanese Grand Prix, Suzuka (`suzuka-formula-1-japanese-grand-prix-2027`) | 9–11 Apr 2027, during |
| 5 | Japan Surgical Society Congress (`jss-annual-congress`) | Tokyo, 8–10 Apr 2027 | Cherry blossom season (`tokyo-jp-cherry-blossom-season-tokyo`) | to about 8 Apr, during |
| 6 | Australasian College of Phlebology ASM (`acp-conference-2027`) | Queenstown, 29 Apr – 2 May 2027 | Milford Track, last Great Walks days (`fiordland-milford-track-great-walks-season-2026-27`) | to 30 Apr 2027, during |
| 7 | NZSG Annual Meeting (`nzsg-asm`, dates estimated) | Queenstown, 27–29 Aug 2027 | Queenstown ski season (`queenstown-region-queenstown-ski-season-coronet-peak-the-remarkables-cardrona`) | June–August, during |
| 8 | ACEM Rural & Remote EM (`acem-rural-remote-em-conference`) | Hobart, 18–20 Jul 2027 | Aurora australis (`south-arm-tas-aurora-australis-southern-lights-in-tasmania`) | May–September, during |
| 9 | ASCIA 2027 (`ascia-annual-conference-2027`) | Canberra, 7–10 Sep 2027 | Floriade (`canberra-au-floriade-2027`) | opens 10 Sep 2027, during |
| 10 | ANZSNR ASM 2027 (`anzsnr-asm-2027`) | Melbourne, 18–20 Mar 2027 | Melbourne International Flower & Garden Show (`melbourne-au-melbourne-international-flower-and-garden-show-2027`) | 17–21 Mar 2027, during |
| 11 | NSW ACE Winter Meeting (`nsw-ace-winter-meeting-2027`) | Sydney, 19 Jun 2027 | Vivid Sydney final night (`sydney-au-vivid-sydney-2027`) | 28 May – 19 Jun 2027, during |
| 12 | ARA ASM (`ara-asm`) | Darwin, 22–26 May 2027 | Taste of Kakadu (`kakadu-taste-of-kakadu`) | May, during |
| 13 | ADIPS ASM 2027 (`adips-asm-2027`) | Darwin, 23–25 Jul 2027 | Litchfield waterholes, dry season (`litchfield-litchfield-waterholes-in-the-dry-season`) | May–October, during |
| 14 | RANZCP ACT Branch Conference (`ranzcp-act-branch-conference-2027`) | Thredbo, 5–7 Mar 2027 | Thredbo alpine hiking season (`thredbo-thredbo-alpine-hiking-season-2026-27`) | to 25 Apr 2027, during |
| 15 | ACCCN ASM 2027 (`acccn-asm-2027`) | Sydney, 5–8 Oct 2027 | Bathurst 1000 (`bathurst-bathurst-1000-2027`) and Rugby World Cup 2027 (`sydney-au-rugby-world-cup-2027`) | 7–10 Oct; 1 Oct – 13 Nov 2027, during |
| 16 | EAU Congress (`eau-annual-congress`) | Amsterdam, 19–22 Mar 2027 | Keukenhof opens (`keukenhof-keukenhof-tulip-gardens-2027`) | 18 Mar – 9 May 2027, during |
| 17 | EuroPCR (`europcr`) | Paris, 18–21 May 2027 | Roland-Garros (`roland-garros-roland-garros-2027`) | 17 May – 6 Jun 2027, during |
| 18 | German-Austrian-Swiss Sports Traumatology Congress (`german-austrian-swiss-sports-traumatology-congress`) | Seefeld in Tirol, 12–20 Feb 2027 | Zugspitze ski season (`zugspitze-zugspitze-ski-season`) | November – early May, during |
| 19 | SCAI Scientific Sessions (`scai-scientific-sessions`) | Fort Lauderdale, 2–4 May 2027 | F1 Miami Grand Prix (`miami-gp-formula-1-miami-grand-prix-2027`) | 30 Apr – 2 May 2027, during |
| 20 | ADLM Annual Meeting 2028 (`adlm-annual-meeting-2028`, dates estimated) | Anaheim, 23–26 Jul 2028 | LA28 Olympic Games (`los-angeles-us2-la28-olympic-games-2028`) | 14–30 Jul 2028, during |

Also worth a card: JSGE General Meeting, Sapporo 6–8 May 2027, with Sapporo's late cherry blossoms; WA Rural Health Conference, Perth 20–21 Mar 2027, with Sculpture by the Sea Cottesloe (to 22 Mar).

Marketing lines must keep to the facts in the row ("ANZGOG is in Adelaide 21–23 April; the Barossa Vintage Festival runs 21–25 April, an hour away"). No superlatives, no promises about whales or auroras: say "season", not "you will see".

## Sources by country

| Country | Sources used (rows) |
|---|---|
| Australia | australia.com (45), supercars.com (11), discovertasmania.com.au (8), northernterritory.com (5), southaustralia.com (4), westernaustralia.com, thredbo.com.au, sydney.com, parks.vic.gov.au, parks.tas.gov.au, nationalparks.nsw.gov.au, penguins.org.au, rugbyworldcup.com, and the organisers of Vivid, Mardi Gras, Australian Open, Moomba, Melbourne Flower & Garden Show, MIFF, Melbourne Food & Wine, Melbourne Fringe, Adelaide Fringe, Adelaide Festival, WOMADelaide, Tour Down Under, Tasting Australia, Barossa Vintage Festival, Floriade, Enlighten, Darwin Festival, Brisbane Festival, Sydney Writers' Festival, Royal Easter Show, Sculpture by the Sea, FRINGE WORLD, Noosa Food & Wine, Castlemaine, Grampians Grape Escape, Sydney Opera House, Rolex Sydney Hobart |
| New Zealand | queenstownnz.co.nz, doc.govt.nz, aucklandnz.com, wellingtonnz.com, nelsontasman.nz, lakewanaka.co.nz, hobbitontours.com, artdecofestival.co.nz, worldofwearableart.com, supercars.com |
| Japan | japan.travel (31), sapporo.travel (12), yokohamajapan.com, yokanavi.com (gofukuoka.jp), kyoto.travel, marathon.tokyo, formula1.com |
| Rest of Asia | english.visitkorea.or.kr, english.visitseoul.net, eng.taiwan.net.tw, visitsingapore.com, gardensbythebay.com.sg, mandai.com, hksevens.com, philippines.travel, visitoman.om, visitqatar.com |
| United States | nps.gov, visitnapavalley.com, visitdenver.com, choosechicago.com, architecture.org, visitcalifornia.com, neworleans.com, la28.org, circuitoftheamericas.com, indianapolismotorspeedway.com, and event organisers (Boston and Chicago marathons, Kentucky Derby, Jazz Fest, French Quarter Festival, CMA Fest, SXSW, Head of the Charles, EPCOT) |
| Canada | destinationtoronto.com, mtl.org, quebec-cite.com, banfflakelouise.com, visitcalgary.com, calgarystampede.com, montrealjazzfest.com |
| Europe | wien.info, austria.info, salzburgerfestspiele.at, germany.travel, oktoberfest.de, visitdenmark.com, tivoli.dk, iamsterdam.com, keukenhof.nl, france.fr, noel.strasbourg.eu, chateauversailles.fr, rolandgarros.com, geneve.com, lausanne-tourisme.ch, myswitzerland.com, artbasel.com, edinburghfestivalcity.com, edfringe.com, edintattoo.co.uk, eif.co.uk, rhs.org.uk, theopen.com, visitliverpool.com, visitdublin.com, stpatricksfestival.ie, rydercup.com, visitvalencia.com, esmadrid.com, sonar.es, yesmilano.it, salonemilano.it, giroditalia.it, visitlisboa.com, thisisathens.org, visitgreece.gr, visitfinland.com, myhelsinki.fi, visitstockholm.com, visitbruges.be, goturkiye.com, motogp.com |
| Latin America, Africa | colombia.travel, hayfestival.com, ficcifestival.com, argentina.travel, bienal.org.br, comrades.com, formula1.com |

## Gaps

- **Blocked (403 or bot challenge, not worked around):** queensland.com, tropicalnorthqueensland.org.au, parks.des.qld.gov.au, visitmelbourne.com, visitvictoria.com, alpineresorts.vic.gov.au, rottnestisland.com, margaretriver.com, barossa.com, cairns.qld.gov.au, newzealand.com, nzski.com, coronetpeak.co.nz, theremarkables.co.nz, mthutt.co.nz, whalewatch.co.nz, dunedinnz.com, rotoruanz.com, discoverhongkong.com, travel.taipei, malaysia.travel, tourismthailand.org, tourismfiji.com, visitbritain.com, visitlondon.com, parisjetaime.com, spain.info, lisboa.pt, visitnorway.com, visitdubai.com, capetown.travel, sanparks.org, magicalkenya.com, visitbrasil.com, cidadedesaopaulo.com, visittheusa.com, vail.com, sandiego.org, sftravel.com, discoverlosangeles.com, visitmusiccity.com, gohawaii.com, floridastateparks.org, nationalcherryblossomfestival.org, metopera.org and about 40 more listed in the run log. **robots.txt refused:** amsterdam.nl, thetasteoftasmania.com.au, athensauthenticmarathon.gr, english.seoul.go.kr, world.seoul.go.kr.
- **No usable page this run (unreachable, script-only, or no dates yet):** Great Barrier Reef Marine Park Authority, Hunter Valley and Yarra Valley wine bodies, Dark Mofo, Taste of Tasmania, Sydney Marathon, Ekka, Melbourne Cup 2027 (VRC shows 2026 only), Australian Grand Prix 2027 ticket page (the F1 calendar is used), Queenstown Winter Festival, Matariki, Waitangi Day page, TIFF, NYC Marathon, Lollapalooza 2027, Taste of Chicago 2027, Chicago Christkindlmarket, Seoul Lantern Festival, Taiwan Lantern Festival 2027, Singapore and Hong Kong event calendars, Buenos Aires city tourism, Viña del Mar festival, Mexico City and Brazil tourism boards, Cape Town and Kruger.
- **Weakest regions:** Latin America (São Paulo 52 rows, Buenos Aires 44, Cartagena 22, Viña del Mar 18) and Africa (Cape Town, Johannesburg) have almost nothing; Orlando (59 rows) has one item; Vienna, Lisbon, Seoul, Singapore, Hong Kong, Copenhagen, Madrid and Seattle are thin outside their Christmas or spring windows. These need a run from the laptop (sites blocked from the cloud) and city sport seasons (football, baseball, opera seasons) with an official season page each.
- **Dates still to come:** many 2027 editions are not published (Dark Mofo, Ekka, Melbourne Cup, Lollapalooza, TIFF, Berlin Festival of Lights, Busan film festival). Re-check from March 2027. Most Christmas-market rows are for 2026 and need their 2027 dates from September 2027.
- **Not added on purpose:** pop concerts (single nights), commercial tours, anything whose end date we would have had to guess, the Tour de France 2027 dates on france.fr (the line "2 July to 7 August 2027" does not match a single race), US national holidays.
- **Conference data issue found:** 32 upcoming rows in `data/conferences.js` carry another city's coordinates (for example `usanz-asm`, `racs-asc`, `anzsgm-asm`, `tsanz-asm`, `anzsnm-asm`, `acem-rural-remote-em-conference`, `ranzcog-regional-symposium`, `acog-annual-meeting`, `aao-annual-meeting`, `asa-anesthesiology`, `esmo-congress`, `jss-annual-congress`, `jaam-annual-meeting`). The matcher works around it; the desks should fix the rows. Check: group upcoming rows by city and flag any more than 60 km from the city's median point.

## Re-check calendar

- **Each run:** `node tools/experiences/fetch.js <urls>` then `node tools/experiences/build.js` (fails on any quote not found) and `node tools/check-experiences.js`. The page cache lives in `tools/experiences/.cache` (not committed).
- **January:** JNTO cherry-blossom forecast; adjust the Japanese sakura windows.
- **March:** Australian winter festivals (Dark Mofo, Vivid programme), ski-season opening dates, Melbourne Cup and AFL finals dates.
- **August–September:** JNTO autumn-leaf forecast, 2027 Christmas markets, Japanese ski season.
- **When an organiser announces:** F1 2028 calendar, Supercars 2028, LA28 session schedule, RWC 2027 match venues (use them to narrow the national row to host cities).

## UI spec for the app agent

### (a) "Make a trip of it" on each conference page

- Below the dates and CPD block, a section titled "Make a trip of it". Call `experiencesFor(conf, { extraDays: n })` with `n` from the chips.
- **Chips:** "Conference days only", "+1 day", "+2 days", "+3 days", "+5 days", "+7 days". The chosen value also sets the trip window shown at the top ("Fri 19 – Tue 23 Mar"). Default: +2.
- **Cards** (fixed events first, as returned): title; the dates as the source gives them ("21–25 Apr 2027" for an event, "May to October" for a season); category icon; summary; distance or "day trip" when `match.distanceKm` > 40; a chip "During the conference" when `match.during`, otherwise "Add N days" (from `match.extraDaysNeeded`, with before/after: "+2 days after"). Tapping "Add N days" sets the chip to N.
- **Source line:** "From [host]" linking to `sourceUrl`, and on expand the `sourceQuote` in quotation marks with "Checked [verifiedOn]". Show `note` in grey when present. Never show a season as a promise ("Whales pass from May to November", not "See whales").
- **Free time:** if the conference row has a `schedule` (from the destinations work), show its pattern ("Sessions 07:15–10:30 and 15:15–18:30") and mark the middle of the day as free on each conference day; seasonal items get "Fits your free afternoons". Without `schedule`, treat conference days as full and suggest only evenings for city events (Vivid, markets) and the extra days for day trips. Do not infer a session pattern.
- **Filters:** category chips from `CATEGORIES`, and "Family" (rows with `family: true` or category `family`).
- **Empty state:** "Nothing listed for these dates yet." No filler.

### (b) Trip builder day plan

- A day-by-day list from (start − days before) to (end + days after). Each day is **Work** (a conference day), **Travel** (first and last day, editable) or **Personal**. The user can drag an experience onto a day; an experience on a conference day goes in the free slot only when a `schedule` exists, otherwise it is shown as "evening".
- **Claimable split** (for a tax adviser, not tax advice): show counts and the ratio, `work days ÷ total days`, with travel days listed separately because rules on them differ. Suggested wording: "4 work days, 2 personal days, 2 travel days. Costs that relate only to the conference (registration) are usually claimed in full; shared costs such as flights are often apportioned. Check with your accountant." Registration, conference-only accommodation nights and conference meals sit in a "Work" column; nights on personal days, and experiences, in "Personal".
- Export: the existing claim pack gets a "Trip" page with the day plan, the split and the conference evidence; experiences are listed as personal.

### (c) Conference-first chat

The assistant asks, in this order: "What CPD do you need, and in which specialty?", "When can you go, and from where?", "Anything you'd like to do while you're there?" Then:

1. Filter conferences by specialty, CPD, dates and budget (existing search). The conference is always chosen first.
2. If the user named interests, map them to categories ("ski" → `ski-snow`, "the reef" → `dive-reef`, "wine" → `food-wine`, "the kids" → `family`, "footy, F1, rugby" → `sport-event`) and call `bestTrips(shortlist, cats, { extraDays: <days they can add, default 3>, from: today })`. Present the top three conferences with one line each: "ASID ASM, Cairns 5–8 May 2027: reef day trips are in season (May–October)".
3. For the conference they pick, call `experiencesFor(conf, { extraDays })` and offer two or three cards, plus "Add 2 days for the Barossa Vintage Festival?" when an event sits just outside the dates.
4. If they named no interests, still call `experiencesFor` with `extraDays: 2` and mention at most one fixed event and one season. Never let an experience push a conference that does not meet the CPD need up the list.
5. Every claim in the reply comes from the row (dates, summary); link the source. If nothing matches, say so and move on.
