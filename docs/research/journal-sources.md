# Hoggy: journal and publisher sources for medical conference discovery

Researched 2026-11-06. Everything below was opened or called live from this machine. Items I could not open are marked "not verified". Companion file: `data/sources.json`.

## 1. Headline findings

1. No major journal publisher offers a clean, reusable events feed. In testing, no RSS, iCal or JSON events feed was found for BMJ, Lancet, NEJM, JAMA, Nature, Cell Press, Elsevier, Springer, Wiley, OUP, MJA or Wolters Kluwer. Several are Cloudflare-blocked (HTTP 403) to non-browser clients, which is itself a signal that scraping is unwelcome.
2. The strongest machine-readable, legitimate signal is the congress abstract supplement. Crossref, PubMed and Europe PMC all index titles such as "Abstracts from the ESVONC Annual Congress, 21-23 May 2026" or "Selected Abstracts from The Royal College of Ophthalmologists Annual Congress 2026, Manchester, UK". These prove that a meeting is real, scholarly and recurring, and give name, year, city and sometimes dates.
3. Crossref `type=proceedings` carries structured `event` metadata (name, location, start, end, acronym, sponsor), but is dominated by IEEE/ACM/engineering. Medical societies mostly publish supplements as `journal-article`, with no `event` object. Parse the title instead.
4. Use journals as a verification and quality layer, not as the primary calendar. The primary calendar should come from society and organiser sites (with permission or via their own iCal/JSON-LD), cross-checked against the supplement signal.

## 2. Publisher and journal sources

Value score: 1 = skip, 5 = core ingestion source. "Tested" is what I actually observed.

| Source | URL | Tested | RSS/iCal/JSON/API | Reuse and ToS | Coverage and freshness | Value |
|---|---|---|---|---|---|---|
| BMJ events | https://www.bmj.com/events (events.bmj.com does not resolve) | 403 from WebFetch and curl | None found | BMJ ToS restricts automated access; not verified | Not verified | 1 |
| BMJ journals feeds | https://www.bmj.com/rss | 200, 280 bytes only | Not usable | n/a | n/a | 1 |
| The Lancet | https://www.thelancet.com/events, /conferences, /rss | 403 on all | None reachable | Elsevier ToS; not verified | Not verified | 1 |
| NEJM Group events | https://events.nejm.org/ | 200, 2.6 KB Nuxt shell | Data loaded from third-party rubiconportals.com API (not used) | NEJM ToS; no reuse grant seen | Live-streamed webinars and CME, not congresses | 1 |
| NEJM RSS | https://www.nejm.org/rss | 403 | n/a | n/a | n/a | 1 |
| JAMA Network | https://jamanetwork.com/pages/cme-events (404); /journals/jama/pages/rss (200 HTML) | No events calendar found | Article RSS only | AMA ToS | No conference calendar | 1 |
| Nature Careers events | https://www.nature.com/naturecareers/events/ | 200; 8 events, 5 Nov 2026 to 2 Jun 2027; keyword, date and location filters | None (no RSS/iCal) | Springer Nature ToS; scraping needs permission | General science, thin, sponsor-driven | 2 |
| Nature Conferences | https://conferences.nature.com/ | 200, 660 KB static site; sitemap.xml lastmod 2026-11-05 | Sitemap only | Ask Springer Nature; otherwise link out | High quality, few events, life sciences | 3 |
| Nature.com RSS | https://www.nature.com/nature.rss | 200 RSS 1.0 (RDF) | RSS, articles only | Non-commercial reading | No events | 1 |
| Cell Press | https://www.cell.com/symposia, /cell-symposia | 403 | None reachable | Elsevier ToS | Cell Symposia are high quality; not verified | 2 (manual) |
| Elsevier events | https://www.elsevier.com/events | 200, 209 KB; JSON-LD is only WebSite/Breadcrumb; list JS-rendered | None found | robots.txt allows generic crawlers; ToS apply | Elsevier's own events, not a medical calendar | 1 |
| Springer Nature events | https://www.springernature.com/gp/events | 404 | None | n/a | n/a | 1 |
| Springer Link search RSS | https://link.springer.com/search.rss?query=congress+abstracts | 200 valid RSS but query ignored (generic latest items) | RSS, unreliable | n/a | Not useful for discovery | 1 |
| Wiley | https://www.wiley.com/en-us/events (404); onlinelibrary eTOC feed (404) | Nothing usable | None | n/a | n/a | 1 |
| Oxford Academic | https://academic.oup.com/pages/events | 403 | None reachable | OUP ToS | Not verified | 1 |
| MJA (Australia) | https://www.mja.com.au/events, /rss | 404 | None | AMPCo ToS | MJA carries no calendar; use AMA, RACP, specialty colleges | 1 |
| Medscape / WebMD | https://www.medscape.com/conferences (404); https://www.medscape.com/rss (200 HTML) | No calendar page found | Article RSS exists in principle, not verified | Medscape ToS prohibit scraping | Conference coverage articles are a good "this meeting mattered" signal but not a calendar | 2 |
| Cochrane | https://colloquium-2026.cochrane.org/ (cochrane.org/events 404) | 200; JSON-LD plus RSS alternate link | JSON-LD and RSS present, not extracted | Cochrane site terms | One flagship event per year | 2 |
| Wolters Kluwer | https://www.wolterskluwer.com/en/events | 200, 291 KB; JS filters (single day, multiple days, repeating) | None found | WK ToS | Mostly tax/legal/finance plus Health training | 1 |
| WHO events | https://www.who.int/news-room/events | 200; CollectionPage JSON-LD | No RSS (rss-feeds URL 404) | WHO content CC BY-NC-SA 3.0 IGO | WHO-run events only | 2 |
| ESMO (society) | https://www.esmo.org/meeting-calendar; RSS https://www.esmo.org/rss/feed/esmo-news | 200; RSS valid, current (pubDate 2026-11-06) | RSS (news), sitemap | Society terms; ask for permission | Oncology; example of society calendars being the real primary source | 3 |
| Societies (ESC, ERS, ASHG, ACC, ASCO, NCI) | see sources.json | 200 (not inspected, no iCal/RSS string found in HTML) | Not verified | Per society | Primary-source calendars; must be added one by one | 3 |

Conclusion: journals and publishers are weak as calendars. Do not build scrapers against them. Partnerships (a publisher events team might supply a feed or CSV) are worth one outreach email each to Springer Nature (Nature Conferences) and BMJ.

## 3. Machine-readable scholarly signals (the strong ones)

All URLs below were called live on 2026-11-06 and returned data.

### 3.1 Crossref API (value 4)

- Docs: https://api.crossref.org. Metadata is CC0/facts. Use the polite pool: send `User-Agent: Hoggy/1.0 (mailto:you@domain)` or `&mailto=`.
- Proceedings with event metadata (10,558 hits since 2025-01; mostly IEEE/ACM):
  `https://api.crossref.org/works?filter=type:proceedings,from-pub-date:2025-01&rows=2`
  Returned `event: {name, location, start:{date-parts}, end:{date-parts}}`, for example "2025 17th International Conference on COMmunication Systems and NETworks (COMSNETS)", Bengaluru, 6-10 Jan 2025.
- Same with trimmed payload (ACM also gives `acronym` and `sponsor`):
  `https://api.crossref.org/types/proceedings/works?filter=from-pub-date:2025-06&rows=2&select=DOI,title,event`
- Search by event name:
  `https://api.crossref.org/works?query.event-name=congress&rows=1&select=DOI,event`
- Medical signal (journal-article supplements; best query):
  `https://api.crossref.org/works?query.title=abstracts+congress&filter=prefix:10.1016,from-pub-date:2026-06&rows=3&select=DOI,title,container-title,issued`
  Returned "Abstracts of the AMP Europe 2026 Congress" (J Mol Diagn), "Abstracts from the 51st Brazilian Congress of Stomatology and Oral Pathology" (OOOO). 189 hits for that window.
- Cross-publisher:
  `https://api.crossref.org/works?query.bibliographic=abstracts+of+the+annual+congress&filter=from-pub-date:2026-01&rows=3&select=DOI,title,container-title,publisher,type`
  Returned Eye (RCOphth Annual Congress 2026, Manchester), Annals of Nutrition and Metabolism (ECOG 35th), Human Gene Therapy (ESGCT 32nd, Seville, 7-10 Oct 2025).
- Caveats seen in testing:
  - `filter=has-event:true` is not a valid filter name; use `query.event-name` or check `event` in results.
  - `query` with OR does not behave as boolean; a medical keyword query on proceedings returned 14 mostly junk or predatory-looking records, so Crossref proceedings alone is a noisy signal.
  - Combining `container-title:` filter with `query.title` often returned 0; use `prefix` filters or `query.container-title` instead.
  - Name collisions: "ESMO '98" matched an IEEE power conference. Always require a medical container or publisher.
- Crossref Event Data (https://api.eventdata.crossref.org/v1/events) tracks mentions of DOIs on Wikipedia and social media, not conferences. My calls timed out (HTTP 000) so it is not verified and not useful here.

### 3.2 PubMed E-utilities (value 4)

- Docs: https://www.ncbi.nlm.nih.gov/books/NBK25501/. Free; 3 req/s, 10/s with API key; include `tool` and `email`.
- `[pt]Congress` and `[pt]Meeting Abstract` returned **0** results in tests (including all-years); do not rely on them.
- Working pattern 1 (MeSH): 351 hits for 2026, 563 for 2025:
  `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=%22Congresses+as+Topic%22%5Bmh%5D+AND+2026%5Bdp%5D&retmax=0&retmode=json`
- Working pattern 2 (title; 82 hits for 2026, includes supplements indexed in MEDLINE/PMC):
  `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=(congress%5Bti%5D+OR+symposium%5Bti%5D)+AND+abstracts%5Bti%5D+AND+2026%5Bdp%5D&retmax=3&retmode=json`
- Fetch details with `efetch.fcgi?db=pubmed&id=...&retmode=xml`; journal volume strings like "24 Suppl 2" confirm a supplement.
- Note that most meeting abstract supplements are not indexed in PubMed (journals like Annals of Oncology, Blood, JCO publish them but NLM often skips them), so absence is not evidence a meeting is fake.

### 3.3 Europe PMC (value 4)

- Docs: https://europepmc.org/RestfulWebService. Free; metadata reusable.
- Conference proceedings in 2026 (425 hits):
  `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=PUB_TYPE:%22conference%20proceedings%22%20AND%20FIRST_PDATE:%5B2026-01-01%20TO%202026-12-31%5D&format=json&pageSize=1&resultType=lite`
- Title pattern (5 hits): `...query=TITLE:%22annual%20congress%22%20AND%20TITLE:abstracts%20AND%20FIRST_PDATE:%5B2026-01-01%20TO%202026-12-31%5D...`
  Returned "Abstracts from the ESVONC Annual Congress, 21-23 May 2026", pubType "conference proceedings", `journalVolume: "24 Suppl 2"`. Cursor pagination via `nextCursorMark`.
- `PUB_TYPE:"Congress"` returned 0.

## 4. Quality scoring from the scholarly signal

A conference is scored as real, recurring and scholarly when:
- +3 abstract supplement DOI exists for a prior edition (Crossref journal-article with title match), +2 more if two or more consecutive years.
- +2 a Crossref `proceedings` record with `event.name` matching.
- +1 per indexed presence in PubMed (MeSH or title pattern) or Europe PMC.
- +2 host society has a registered journal; +1 sponsor in `event.sponsor`.
Score 0 means "listed but unverified": show with lower rank or hold for review.

## 5. Recommended automated update architecture

**Principle:** society/organiser pages are the source of dates; scholarly APIs are the source of legitimacy; humans resolve disagreements.

1. **Seed registry**: a table of series (e.g. ESMO Congress) with canonical name, aliases, society, journal ISSN, official URL, and the supplement title regex. Seed from the Crossref/Europe PMC queries above (run monthly, harvesting container-title plus title regex).
2. **Pollers** (all with ETag/If-Modified-Since, conditional requests, polite UA, robots.txt respected, per-host rate limits):
   - Crossref supplements and proceedings: weekly, `from-index-date` = last run. Also run `filter=from-pub-date` monthly.
   - PubMed/Europe PMC: weekly with `mindate/maxdate` or `FIRST_PDATE` windows; use `reldate=14`.
   - Society pages with iCal/JSON-LD/RSS (those that offer one): daily. Pages with only HTML: check `sitemap.xml` lastmod daily and fetch only changed pages, after getting written permission or confirming terms.
   - ESMO-style news RSS and organiser feeds: every 6 hours, keyword-scan for "postponed", "cancelled", "rescheduled", "virtual", "new dates".
   - Event page for any event starting within 90 days: re-verify weekly; within 14 days: daily.
3. **Normalise** to schema.org Event shape: name, series_id, start, end, city, country (ISO), venue, mode (in-person/hybrid/virtual), url, specialty (MeSH/ICD-ish), source_ids[], last_verified_at, status.
4. **Dedupe**: key = (series_id, year) first. If no series: normalised name (lowercase, strip ordinal, "annual", "congress/conference/meeting", punctuation), start date within +/-3 days, and country. Fuzzy match threshold ~0.9 (token set ratio) plus date and city agreement; below threshold goes to review. Keep every source as provenance row; merge with source priority organiser > society > journal supplement > aggregator.
5. **Status flags**: states `scheduled`, `postponed`, `cancelled`, `moved_virtual`, `unverified`, `past`. Triggers: keyword in feed or page title/banner; HTTP 404/410 on official URL for 2 consecutive checks; date drift between two sources; page text containing "postponed/cancelled/rescheduled". Auto-set `unverified` on any trigger and show a badge; auto-set `cancelled` only with an organiser-sourced signal or human confirmation.
6. **Verification**: URL liveness and TLS check; JSON-LD Event parse where present; confirm dates appear on the official page text; scholarly score from section 4; for events within 30 days, confirm registration page is open. Queue anything with conflicting dates or score 0 for human review.
7. **Freshness SLA**: events <=30 days out verified within 7 days; 31-180 days within 30 days; later within 90. Store `last_verified_at` and expose it.
8. **Legal**: store facts (name, dates, place, URL) only, not descriptions or logos from publishers; link out to the organiser; keep a per-source `license_note`. Obtain permission (email) before scraping HTML calendars; prefer partner feeds. Honour robots.txt (Cloudflare 403 on BMJ, Lancet, NEJM, Cell, OUP means do not scrape those).

## 6. Gaps and next steps

- Not verified: BMJ, Lancet, Cell Press, OUP events (blocked); Medscape/Healio conference hubs (no calendar found); JAMA (no calendar).
- Next: inspect society pages individually for JSON-LD or iCal (ESC, ERS, ACC, ASCO, ASH, EULAR returned HTML only in my sweep); contact Springer Nature and BMJ about partner feeds; check the Crossref `event` coverage for Karger, Wiley and Elsevier proceedings DOIs by publisher prefix; test Wikidata (instances of academic conference with medical field) as a free seed, not tested here.
