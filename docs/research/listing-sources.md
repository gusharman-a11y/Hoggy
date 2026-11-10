# Hoggy: listing sources for a global medical conference list

Research date: 2026-11-06. Method: WebSearch/WebFetch only. Status tags: **[V]** = verified by opening the page this session; **[S]** = from search-result snippet only; **[U]** = unverified (fetch blocked, 404, or page content not returned). Nothing here is legal advice; ToS verdicts are a reading of the text we could see and should be checked by counsel before commercial ingestion.

## Headline findings

1. **No public, documented API or bulk feed exists that aggregates medical conferences across all specialties and regions.** None of the aggregators checked advertise one. [V for 10times, Conference Alerts, eMedEvents, CMEList, RACGP, ACCME events page; S for search sweep]
2. **Most aggregators either block or contractually prohibit automated collection.** 10times blocks `/rss-feeds/`, `/xml_feeds/`, `/json/`, `/search/`, API paths in robots.txt [V]; eMedEvents terms prohibit scraping via automated means [V]; AllConferenceAlert robots.txt blocks ClaudeBot from the whole site and several SEO bots [V]; 10times and AllConferenceAlert returned HTTP 403 to our fetcher [V].
3. **medicalconferences.com (listed by INASP as 7000+ events) is now a parked, for-sale domain.** [V: redirects to GoDaddy for-sale page]. Treat as dead.
4. **The legitimate and durable path is first-party**: organiser/society sites (schema.org Event JSON-LD, iCal, sitemaps), plus accreditor registries for CPD hours. Aggregators serve as discovery leads (URL and name of an event), not as a data source to republish.
5. **Eventbrite public search was shut down on 2019-12-12** [S: Eventbrite changelog via search], so it cannot be used for discovery. Per-organiser/venue endpoints only.
6. **Accreditor data is mostly search UIs without bulk export.** EACCME (UEMS) says all EACCME-accredited events are on its platform, but no export or data licence is described [V]. ACCME links CME Passport for activity discovery; the CME Passport page text did not render for our fetcher [U]. ACCME's own events calendar lists only ACCME events (4 events) and has no iCal [V].

## 1. Aggregators and directories

| # | Source | URL | Covers | Access method | Licence / ToS verdict | Cost | Freshness | Value (1-5) |
|---|---|---|---|---|---|---|---|---|
| 1 | 10times | https://10times.com/medical | Global trade shows and conferences, including a medical vertical. Page itself returned 403 [V], so counts unverified [U] | HTML only. robots.txt [V] disallows `/rss-feeds/`, `/xml_feeds/`, `/json/`, `/search/`, `/react-api/v1`, `/api/react-api/v1`, parameterised URLs, `/in-town/`; sitemap at `/xml/sitemaps.xml` is declared. No public API found [S] | **Do not ingest.** robots.txt explicitly blocks feeds, JSON and API paths. ToS page returned 403 [U]. Use only as a manual lead source, or approach 10times for a commercial data deal | Free to view; data licensing unquoted [U] | High volume, organiser-driven [S] | 3 as lead source, 1 as pipeline input |
| 2 | Conference Alerts (Conal) | https://conferencealerts.com/ | Academic events worldwide since 2000, filterable by topic (Cardiology, Oncology, Public Health, "Medicine and Medical Science" and others) and country [V] | HTML, free email alerts. No API or RSS mentioned [V]. robots.txt returned 404, so no crawl rules published [V] | Terms of use [V] are silent on scraping and reuse. Silence is not permission: the site retains rights over its listings content and may edit listings. Verdict: **low-rate fetch for discovery is defensible, republishing is not; ask for written permission before bulk use**. Note much of its coverage is mixed-quality or predatory-adjacent academic events, so filter hard | Free to browse | Active | 3 |
| 3 | AllConferenceAlert | https://www.allconferencealert.com/medical-conferences.php | Global academic/medical conferences | HTML. sitemap.xml declared [V] | **Do not ingest.** robots.txt [V] blocks ClaudeBot site-wide plus many other bots; page returned 403 to our fetcher [V] | Free | Unknown [U] | 2 |
| 4 | eMedEvents | https://www.emedevents.com/ | CME/CE marketplace: claims 29,000+ CME/CE activities online library, live and hybrid conferences, specialties, credit types shown on each card (AMA PRA Cat 1, ECMEC, MOC etc.) [V] | HTML. No API or feed mentioned [V]. robots.txt allows all except `*/null*`, no sitemap declared [V] | **Do not scrape.** Terms 3.C prohibit scraping or collecting content via automated means, and copying or redistribution needs written authorisation (2.B) [V]. A partnership or affiliate/data agreement is the only compliant route | Free to browse; commercial deal unquoted [U] | Active, commercial | 4 for credit metadata; 1 as pipeline input without agreement |
| 5 | CMEList | https://www.cmelist.com/ | Board review, CME courses, live and online conferences across specialties [V] | HTML, newsletter only. No feed or API [V]. Terms not readable [U] | Not ingestible without permission; vendor-promotion model (providers pay to be listed) means listings are biased. Lead source only | Free to view | Unknown [U] | 2 |
| 6 | Conference Lists | https://www.conferencelists.org/health-and-medicine/ | Health and medicine international conferences 2026-27 [S] | Page returned 429 [V]; contents unverified [U] | Unknown [U] | Free | Unknown [U] | 2 |
| 7 | International Conference Alerts | https://internationalconferencealerts.com/medical/ | Medical conferences by country [S] | Unverified [U] | Unknown [U]. Possible predatory-conference exposure | Free | Unknown | 1 |
| 8 | HCEA Directory of Healthcare Meetings and Conventions | via https://www.successfulmeetings.com (news item) | Claims 2,000+ medical meetings worldwide, annual print/digital directory [S] | Paid directory [S] | Commercial licence. Ask for data licence terms [U] | Paid, price unknown [U] | Annual | 2 |
| 9 | Medscape conference list | https://www.medscape.com/medicalconferences | US-centred conference listing [S, historically] | Fetch returned HTTP 402 [V] | Not accessible to us; treat as no. [U] | Registration wall | Unknown | 2 |
| 10 | medicalconferences.com | https://www.medicalconferences.com/ | Was 7000+ events per INASP [S] | Redirects to GoDaddy for-sale page [V] | **Dead.** Remove from consideration | n/a | Defunct | 0 |
| 11 | WikiCFP | http://www.wikicfp.com/cfp/ | Computer science/academic CFPs; essentially no medical coverage [S] | Connection refused when fetched [U] | n/a | Free | n/a | 1 |
| 12 | smartcalendars.ai medical feeds | https://smartcalendars.ai/en/feeds/c/conferences/medical-healthcare | Subscribable iCal feeds with EMA, FDA device and NIH events [S] | iCal subscribe links [S] | Regulator events only, small. Check provenance and terms before use [U] | Free | Unknown | 2 |
| 13 | Wikidata (SPARQL) | https://query.wikidata.org/ | Notable recurring conferences and societies as entities (QIDs, websites, locations) | SPARQL endpoint and dumps | **Ingestible.** All structured data is CC0 [V: Wikidata:Licensing]. Coverage of upcoming dated instances is thin, so use it to seed series/society identity, not dates | Free | Community-edited | 3 |

### Not usable
- **Eventbrite**: public event search endpoint shut down 2019-12-12; only event-by-ID and per-organiser/venue listings remain [S].
- **PredictHQ** (commercial events API, "Conferences" is a category): licensed per location/category/time horizon, custom quotes, 14-day trial [S]. It is attendance-weighted (large events) so it will miss most small specialty meetings. Value 2; only worth a trial if budget exists.

## 2. Specialty societies and national CPD calendars

| Source | URL | What we found | Access | Verdict | Value |
|---|---|---|---|---|---|
| RACGP events | https://www.racgp.org.au/racgp-digital-events-calendar/home | Lists "every event delivered by the entire RACGP community": webinars, in-person, live streams. Date, title, format shown. No RSS/iCal link and no CPD hours on the listing page [V] | HTML listing, newsletter | First-party facts (title, date, URL) may be linked and cited. Do not copy descriptions or member-only content. CPD hours must come from each event page [U] | 3 (AU) |
| RACGP CPD (via PHN calendars) | e.g. https://swsphn.com.au/cpd-events-calendar/ | PHNs publish calendars with RACGP CPD hours per session [S] | HTML | Good second-tier source for AU CPD hours; check each site's terms [U] | 3 |
| RACP events | https://www.racp.edu.au/events and /fellows/cpd | Both URLs 404 [V]; page structure unknown | n/a | Needs manual lookup [U] | ? |
| ACRRM events | https://www.acrrm.org.au/events | Only RMA conference, networking events and an Emerging Leaders conference highlighted; not a general listing [V] | HTML | Add RMA and Emerging Leaders as seed entries | 2 |
| ACCME events calendar | https://accme.org/events-calendar/ | Four ACCME-own events (PARS office hours, Learn to Thrive 2027, accreditation workshop, a CE-professionals day). No feed [V] | HTML | Not a conference source | 1 |
| ESMO meeting calendar | https://www.esmo.org/meeting-calendar | Page rendered empty ("No results found"); JS-driven. No iCal link seen [V] | JS app | Representative of society sites: need headless render or per-event page JSON-LD [U] | 3 (oncology) |
| Society sites generally (ESC, ASCO, AAN, ATS, ERS, EULAR, etc.) | each society's site | Not individually opened this session [U] | Varies | Primary truth for dates and CPD; see section 3 | 5 collectively |

## 3. Structured-data options

- **schema.org Event JSON-LD** on organiser pages. Google's Event docs [V: developers.google.com/search/docs/appearance/structured-data/event] require `name`, `startDate`, and `location` (Place with address and name); recommended `endDate`, `eventStatus` (default EventScheduled), `description`, `image`, `offers`, `organizer`, `previousStartDate`. Each event needs its own leaf URL with markup. `eventAttendanceMode` was not on the fetched page [V], though it exists in schema.org [not verified here].
- **EducationEvent** is a subtype of Event (Thing > Event > EducationEvent) with `teaches`, `assesses`, `educationalLevel`; it has **no property for CPD/CME credits** [V]. Credits will need a free-text or custom extraction (look for "AMA PRA Category 1", "ECMEC", "CPD points" strings) rather than a standard field.
- **Practical reality**: JSON-LD adoption is strong on platform-built congress sites (WordPress event plugins, Eventbrite, Cvent, Confex pages) and weak on older society sites [U, not measured]. Crawl sample before relying on it.
- **iCal**: individual institutions publish feeds (BC Centre for Excellence CME, Canadian Cancer Care calendar, AlumnIQ-based sites) [S]. Subscribing to a publisher's own iCal feed is the cleanest legitimate method (publisher intends redistribution to calendar apps), but each is per-organiser.
- **Google Events / Search** is not an ingestible source: there is no public Google Events API, and its results are derived from the same JSON-LD. Do not scrape SERPs; read JSON-LD at source. [Reasoned; no Google event API page was found in this research.]
- **schema.org licence**: the vocabulary page links to terms but states no licence on the page we fetched [V]; vocabulary reuse is standard practice, the markup data on third-party sites is theirs.
- **Sitemaps**: 10times declares `https://10times.com/xml/sitemaps.xml` [V] and AllConferenceAlert `https://www.allconferencealert.com/sitemap.xml` [V]; neither site's permission extends to bulk event-page crawling for reuse. Use sitemaps on **organiser** sites (lastmod helps change detection).

## 4. Accreditation sources (CPD hours)

| Scheme | URL | What it offers | Access | Verdict | Value |
|---|---|---|---|---|---|
| EACCME (UEMS, Europe) | https://eaccme.uems.eu/general-information | States all EACCME-accredited events are published on its platform; menu "Find a CME accredited activity": Live Educational Events, E-learning, Blended learning, Webpacks. Terms and privacy pages exist but unread [V] | Search UI. No export or data licence described [V]. Questions to accreditation@uems.eu [S] | Ask UEMS for a data-sharing arrangement; otherwise link out, and extract "EACCME" credit statements (ECMEC counts) from organiser pages. The `www.eaccme.uems.eu` host does not resolve (use `eaccme.uems.eu`) [V] | 5 for EU credit authority, 2 as ingestible feed |
| ACCME / CME Passport (US) | https://www.cmepassport.org/ ; https://accme.org/cme-provider-directory/ | ACCME home links "Find a CME Activity" (CME Passport) and a provider directory, and a PARS batch/web-services submission route for providers only [V] | CME Passport page text did not render [U]. PARS web services are for providers submitting data, not public queries [V] | Credits are issued by providers, not ACCME. Do not expect a public API. Ask ACCME about CME Passport data access. Provider directory is useful to enumerate US accredited providers (the organisations that run conferences) | 3 |
| AMA PRA Category 1 | https://edhub.ama-assn.org/pages/cme-finder | Redirected to a JAMA SSO login [V] | Login wall | Not ingestible. Credit appears in organiser statements ("AMA PRA Category 1 Credit(s)™", only MDs/DOs) [S] | 2 |
| RACGP CPD | https://www.racgp.org.au | Hours appear on activity pages, not listing page [V]. PHN calendars often show RACGP CPD hours [S] | HTML | Extract per event page; no bulk list found | 3 |
| RACP CPD | https://www.racp.edu.au | URL checked 404 [V] | n/a | Manual lookup needed [U] | ? |
| ACRRM CPD | https://www.acrrm.org.au/events | Mentions CPD in general terms only [V] | HTML | Per-event | 2 |
| UEMS specialty sections / European societies | e.g. EAACI CME page https://eaaci.org/events_congress/eaaci-congress-2026/scientific-programme/cme-accreditation/ | Societies publish EACCME hours on congress pages [S] | HTML | Extract from congress page | 3 |

## 5. Recommended ingestion architecture

Principle: **discover widely, ingest only from permissioned or first-party sources, link out for everything else.** Never republish aggregator descriptions.

1. **Seed registry (society/series table)**: a curated list of roughly 1,500 societies and recurring congresses (ESC, ASCO, ESMO, AAN, RACGP, RMA etc.), with homepage and events-page URL. Seed from Wikidata (CC0), the ACCME provider directory, UEMS section/board member lists, and manual curation. This is the durable asset; events hang off it.
2. **Per-series fetchers (tiered by quality)**:
   - Tier A: publisher iCal / JSON-LD / sitemap. Parse `schema.org/Event` JSON-LD first, fall back to iCal, fall back to RSS. Respect robots.txt, identify the bot, rate-limit (at most 1 request every few seconds per host), cache with ETag/If-Modified-Since, re-check weekly, daily within 90 days of an event.
   - Tier B: HTML pages with LLM-assisted extraction into a fixed schema (name, start/end, city/country, online/hybrid, URL, organiser, credit statement, source URL, fetched_at, confidence). Store the source URL and a content hash. Human review queue for low confidence.
   - Tier C: JS-rendered sites (e.g. ESMO calendar rendered empty to a plain fetch) via a headless browser, only where robots.txt allows.
3. **Discovery-only lane** (aggregators): use a manual or low-rate human-in-the-loop process to find *new series not yet in the registry* from Conference Alerts and similar; record only the event name and organiser URL, then ingest from the organiser. Obtain written permission before anything automated. For 10times, AllConferenceAlert, eMedEvents: no automated access. Pursue partnership/data-licence conversations (eMedEvents for credit metadata; 10times for a feed).
4. **Accreditation enrichment**: regex/LLM extraction of credit statements from organiser pages (AMA PRA Category 1, ECMEC/EACCME, RACGP CPD, RACP, ACRRM), stored as `{scheme, hours, evidence_url, verified}`. Show "claimed by organiser" until cross-checked against EACCME search or ACCME provider status. Open data requests to UEMS (accreditation@uems.eu) and ACCME for an export.
5. **Dedup and freshness**: key on (series_id, start_date, city/online). Mark an event stale if source not re-confirmed in 60 days; detect cancellations/postponements via JSON-LD `eventStatus` and page text.
6. **Compliance**: per-source record of robots.txt snapshot, ToS URL and reviewed date; kill-switch per host; facts (name, date, place, URL) stored, prose descriptions rewritten or omitted; attribute and link back to organiser.
7. **Quality filter**: exclude predatory events (generic "International Conference on X" mass-organiser patterns, found in aggregator feeds), and weight societies with recognised accreditation.

## 6. Top 10 sources, ranked

| Rank | Source | Why | Score |
|---|---|---|---|
| 1 | Organiser/society event pages with JSON-LD, iCal and sitemaps (ESC, ASCO, EULAR, ESMO, RACGP etc.) | Authoritative, legitimate, structured where available, carries CPD statements | 5 |
| 2 | EACCME platform (eaccme.uems.eu) | Authority for EU credits; need data-sharing agreement. Currently search UI only | 4 |
| 3 | eMedEvents (partnership route only) | Largest-looking CME marketplace with credit types displayed; scraping prohibited, so needs a licence | 4 |
| 4 | Wikidata (CC0) | Free, legally clean seed of series and societies | 3 |
| 5 | ACCME provider directory and CME Passport | Enumerate US accredited providers; no public API verified | 3 |
| 6 | Conference Alerts | Clean to read, silent on scraping; discovery lead only, needs permission for bulk | 3 |
| 7 | 10times | Biggest breadth, but robots.txt blocks feeds/JSON/API; lead source manually or via commercial deal | 3 (lead) |
| 8 | RACGP events + PHN CPD calendars (AU) | Concrete AU CPD hours and event listings, no feed | 3 |
| 9 | PredictHQ (trial only) | Licensed API, conferences category, large events only | 2 |
| 10 | smartcalendars.ai medical feeds / ACRRM/RACP pages | Small, regulator or college events, iCal available for some | 2 |

## Open items to close before build

- Read the 10times ToS (403 for us) and eMedEvents/AllConferenceAlert commercial data policy; email each for a data licence.
- Open EACCME Terms and Conditions and UEMS contact for bulk data.
- Confirm CME Passport has any public JSON endpoint (page text did not render). Check network calls in a real browser; use only if ACCME grants permission.
- Locate RACP and AMA CME-finder pages that work (both failed).
- Sample 50 society sites for JSON-LD/iCal prevalence to size Tier A vs Tier B.
- Research not covered: Asia-Pacific, Latin America and Africa regional calendars, and Google Events behaviour in practice.
