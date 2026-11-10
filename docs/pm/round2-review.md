# Hoggy round 2 review

Internal. DRAFT FOR ANGUS REVIEW. As at 6 Nov 2026. Runs the checklist in `docs/pm/review-checklist.md`. No app code was edited. Overall: **21 of 45** (round 1: 18). Round gate: **FAIL** (data accuracy, copy and review gates fail; see section 1).

How this was checked: read server.js, lib/ingest.js, app.js, admin.js, parse.js, tools/*, data/sources.json and the docs; ran `node --test tests/hoggy.test.js` and `node tools/merge-shards.js --dry`; computed counts from `data/conferences.js`; copied `data-store/hoggy.db` to a temp folder and queried the copy; fetched 15 random organiser URLs. **Deviation:** the WebFetch tool was not available in this session, so I fetched pages with Node `fetch` (plain GET, browser-style user agent, text extracted from HTML) and followed each site's own event and calendar pages where the homepage was silent. No browser was available, so the manual journeys (checklist section 4) were not run.

## Headline numbers

| Measure | Round 1 | Round 2 | Target |
|---|---|---|---|
| Conferences | 60 | 413 | 1,000 |
| Specialties | 20 | 38 | 40 |
| Countries (ISO codes) | 22 | 48 | 80 |
| Regions | 6 | 6 (Africa has 9 rows, all ZA, KE, TZ) | 6 |
| Date window | all 2027 | 8 Jan to 22 Dec 2027; **nothing in Nov or Dec 2026** | next 24 months |
| Dates flagged confirmed | 42 | 210 (51%) | 95% |
| Dates flagged estimated | 18 | 203 (49%) | under 5% |
| Rows with `sourceUrl` and `lastVerified` | 0 | 413, but see gap 1 | 100% genuine |
| Tests | none | 4 pass, 0 fail | CI green |

## Sampled accuracy (15 random conferences, drawn with a shuffle on 6 Nov 2026)

| # | Row | Flag | Our dates and city | Organiser page says | Result |
|---|---|---|---|---|---|
| 1 | SSRC 2027 (ssrc-sa.com) | confirmed | 25-27 Mar, Madinah | "March 25th to 27th, 2027 ... Madinah" | Correct |
| 2 | ABA Annual Meeting (ameriburn.org) | confirmed | 13-16 Apr, Chicago | "April 13-16, 2027, Chicago, IL" | Correct |
| 3 | EAUN27 (nurses.uroweb.org) | confirmed | 20-22 Mar, Amsterdam | "20-22 March 2027, Amsterdam" | Correct |
| 4 | ACMG Annual Meeting | confirmed | 13-17 Apr, Minneapolis | "April 13 - 17 ... Minneapolis"; JSON-LD startDate 2027-04-13 | Correct |
| 5 | SaudiPerio5 (saudiperio.org) | confirmed | 11-13 Nov, Riyadh | "11 to 13 November 2027 ... Riyadh" | Correct |
| 6 | MEDINFO 2027 | confirmed | 29 Aug-2 Sep, Dubai | "August 29 - September 2, 2027, Dubai" | Correct |
| 7 | ESHRE 2027 | confirmed | 4-7 Jul, Stockholm | "ESHRE 2027, from 4 to 7 July" in Stockholm | Correct |
| 8 | Cairo Retina Meeting 2027 | confirmed | 14-15 Jan, Cairo | "January 14-15, 2027", Hilton Cairo Grand Nile | Correct |
| 9 | EFIC Congress 2027 | confirmed | 21-23 Apr, Glasgow | "Glasgow, 21-23 April 2027" | Correct |
| 10 | CHEST Annual Meeting | estimated | 24-27 Oct, Vancouver | "October 24 to 27, in Vancouver" | Correct (understated: it could be confirmed) |
| 11 | SMFM Pregnancy Meeting | estimated | 21-26 Mar, National Harbor | SMFM events calendar: "Mar 21 to Mar 26, SMFM 2027 Pregnancy Meeting" (venue not shown) | Dates correct, city not checked |
| 12 | EAN Congress | confirmed | 12-15 Jun, Gothenburg | Gothenburg confirmed; programme shows "Sunday, 13 June 2027", full range not seen | Consistent, not fully verified |
| 13 | **IDWeek** | estimated | **20-24 Oct, Washington DC** | idweek.org: "ID Week 2027, **Oct. 6-9, in Boston, MA**" | **Wrong: dates and city** |
| 14 | Population Health Congress (PHAA) | estimated | 6-8 Sep, Adelaide | No 2027 congress on phaa.net.au | Unverifiable |
| 15 | AAE Annual Meeting | estimated | 14-17 Apr, San Antonio | aae.org returned HTTP 403 to our fetcher | Unverifiable |

- **Accuracy where checkable: 11 of 12 = 92%** (rows 1-11 correct, row 13 wrong; rows 12, 14 and 15 excluded).
- **Strict (correct only if shown correct): 11 of 15 = 73%.**
- Rows flagged confirmed: 9 of 9 checkable were correct (row 12 consistent). Rows flagged estimated: 2 of 3 checkable were correct, and the one miss is a different city and a two-week error. On this sample, "estimated" is a fair label but the estimate itself can be badly wrong.
- The checklist rule is 10 of 10 or fail. **This round fails the data gate** and R3 (wrong dates) has now happened in the sample.
- **Not sampled for accuracy:** CPD hours, accreditation body, price, attendees. None of the 15 organiser pages I read stated CPD hours for the 2027 event, so none of those fields were verified. A sample size of 15 gives a wide margin (the true accuracy could plausibly be 65% to 99%) `[ASSUMPTION]`.
- **Link liveness (all 413 URLs, one GET each):** 403 of 413 (98%) returned a 2xx status after redirects, 6 returned HTTP 403 (bot-blocking, not necessarily dead), 4 failed to connect or timed out (cairo-retina-meeting reset the socket for this run although it loaded in the sample; iars-annual-meeting, sobracil-congresso-2027 and asrm-scientific-congress also failed). 338 of 413 URLs are site homepages, not event pages.

## What is misleading to users today

| # | Where | What users see | What is true | Severity |
|---|---|---|---|---|
| M1 | Detail panel (app.js:276) | "Dates confirmed by organiser, checked 2026-11-06" on 210 rows | All 413 rows carry `lastVerified: 2026-11-06` because `tools/merge-shards.js` stamps it by default, not because anything was checked. 150 of the 210 confirmed rows link only to a homepage, and six ESC congresses share one URL. In the live updater, `lastVerified` is set whenever the page returns 2xx, which proves the page loaded, not that the dates match | High |
| M2 | Card and detail | City, venue and country shown as plain fact | On estimated rows the city is guessed from a past edition. IDWeek shows Washington DC, the organiser says Boston. Only the dates carry "est." | High |
| M3 | Detail panel | "N CPD hrs, [body]" and accreditation pill | 143 of 413 rows say exactly 20 hours; 106 are tagged EACCME and 81 AMA PRA Category 1 with no per-event evidence. Accreditation is event-specific | High |
| M4 | Detail panel | "Registration from US$500", "~1,500 attendees" | 410 of 413 attendee figures are round hundreds; prices are unsourced. Registration price currency is hard-coded US$ | Medium |
| M5 | app.js:188 (Receipts) | "**How we guarantee your claim**" | D6 says the wording must be "claim-ready", not a guarantee. Home page also says "watertight" | High (R5) |
| M6 | app.js:187 (Receipts) | "land in your Receipts within a minute, already read and matched to your trip" | Inbound parses the email body only; attachments are stored, not read, and nothing matches the receipt to a trip | Medium |
| M7 | Reviews | Pill "Verified attendee" and note "verified attendees" | `verified` means the user marked their own trip "attended" in their own synced state. No email check, no receipt proof, no attendance proof. A fresh account can set this in two clicks | High (R4) |
| M8 | Blurbs | "The world's largest orthopaedic meeting", "Europe's largest radiology meeting" (30 blurbs with superlatives) | No source or date. Breaks the firm rule on unsupported superlatives (I8, still open) | Medium |
| M9 | Discover header | "413 conferences worldwide" | True as a count, but the list starts 8 Jan 2027, so a clinician looking for Nov or Dec 2026 finds nothing and may conclude there are none | Medium |
| M10 | "Official site" button | Implies the event page | 338 of 413 go to a society homepage, 9 URLs are shared by 2 to 6 events | Low to Medium |

Not misleading (checked): offline mode no longer shows canned reviews (no "Sample data" text anywhere in app.js, server.js or index.html; the only trace is a stale code comment at app.js:64 and a `v.demo` class check at line 282). Reviews are HTML-escaped with `esc()`. The review score only shows once 5 verified reviews exist.

## Checklist run

**0. Scope and process (Gate): FAIL**
- Diff matches claimed IDs: **cannot be checked.** The folder is not a git repository and no round-1 snapshot exists, so I cannot diff. I inferred what changed from the code (below).
- Evidence per claimed item: no claim list or evidence was supplied; evidence is in the table below.
- D1-D7 not assumed: **partial fail.** `lib/ingest.js` fetches third-party organiser pages and polls `data/sources.json` before D1 (data licensing) was decided; the research doc says to get permission first. It is robots-aware and https-only, and it has not yet run (`ingest_runs` has 0 rows in the dev DB), so no data has been taken. Treat as a risk, not a breach.

Inferred round-1 backlog movement:

| ID | State | Evidence |
|---|---|---|
| B01 | Done | No canned review text in the UI path; "No reviews yet" shown on empty lists |
| B02 | Partial | `dateStatus`, `sourceUrl`, `lastVerified` exist on all 413 rows but are defaulted (`sourceUrl` equals `url` on 413 of 413). `cpdSource` absent. `scripts/validate-data.js` does not exist |
| B03 | Not done | No audit log; my sample found 1 wrong row in 12 checkable |
| B04 | Done with caveats | "est." shown on cards and detail; `upcoming()` hides past events (0 rows are past today); "checked" date shown. Caveat: M1 and M2 |
| B05 | Partial | `package.json`, 4 tests pass. No CI, no 50-receipt set, parser has 6 assertions |
| B06 | Partial | 413 of the 1,000 target |
| B16 | Partial | ICS export works in code (single all-day event, escaped text, notes "dates estimated"); no itinerary or affiliate links |
| B18 | Partial | Free-text search covers name, city, country, organiser, specialty, blurb; sorts and "confirmed only" filter exist; no map, saved searches or alerts |
| B20 | Partial | `refresh()` and `discover()` exist; never run; auto-patches dates with no human sign-off (see gap 3) |
| B08 | Partial | Sorted verified-first, score gated at 5 verified, five rating dimensions; "verified" is self-asserted, no report, delete or moderation |

**1. Automated (Gate)**

| Test | Result |
|---|---|
| Server starts on a temp `HOGGY_DATA` | PASS (the server test spawns it on a temp dir and the API calls succeed) |
| Data validator | **FAIL**: `scripts/validate-data.js` does not exist. `tools/merge-shards.js --dry` validates shard rows only (required fields, dates, https, region, format, CPD range); it does not check base rows, lat/lng, duplicate URLs, `dateStatus` or source evidence |
| `node tools/merge-shards.js --dry` | Output: `{"added":0,"dupId":353,"dupName":0,"invalid":0} total 413 specialties 38 countries 49 confirmed 210`. All 353 shard rows are already in the main file (idempotent, nothing lost). Its "49 countries" counts names, my count of ISO codes is 48; the gap is a country spelt two ways, to be checked |
| `node --test tests/hoggy.test.js` | PASS: 4 tests, 4 pass, 0 fail, 0 skipped, about 0.7 s. The dataset test only asserts `length >= 60`, so it would pass with 413 rows of nonsense dates |
| Syntax (`node --check` server.js, app.js, parse.js, admin.js) | PASS, exit 0 |

**2. Data quality: FAIL**

| Check | Result |
|---|---|
| Date matches organiser (sample) | **FAIL**: 11 of 12 checkable; IDWeek wrong. Sample was 15, not 10 |
| Fields present on 100% | Present but not genuine (M1) |
| Past events shown as upcoming | PASS: 0 before today |
| Duplicates, bad lat/lng, unknown specialty or country code | Lat/lng in range (0 bad). 9 URLs are shared across 2 to 6 rows. Row-level duplicates by name and year: 0 found by the merge script. One country spelt two ways to check |
| Coverage counts reported | Reported above |
| No copied organiser text | Blurbs are short, rewritten text; 30 contain superlatives (M8). No logos in the repo |

**3. Review trust: FAIL**

| Check | Result |
|---|---|
| Fresh DB shows "No reviews yet" | PASS by code and a fresh DB (0 reviews); not seen in a browser |
| Offline mode shows no canned reviews | PASS |
| Post, edit, delete, report; one per user | Post and edit (by re-posting) work and are covered by one test. **No delete, no report** |
| Unverified user blocked from posting | **FAIL**: nothing blocks it; no email verification exists |
| Review text escaped | PASS by code reading (`esc()`); not executed in a browser |

**4. Journeys: NOT RUN.** No browser available. By code reading: Discover works and has a "confirmed dates only" filter; Plan trip links look right and ICS exists; Receipts, Claim and CPD logic is unchanged since round 1. Checklist rule: not run counts as not passed.

**5. Security: PASS for what is tested, with known gaps**
- Covered by the existing test and re-read in code: missing CSRF header gives 403, wrong inbound secret gives 401, files need a session, `/server.js` and `/data-store/...` give 404, bad URL escape gives 400, wrong delete-account password gives 403.
- By code only: login brute force limits (in memory), 8 MB attachment cap with magic bytes, 5-attachment cap, CSP present with no inline script, secret compare is timing-safe, private IPs blocked in the ingest fetcher (tested with 6 addresses).
- **Open:** register still returns 409 for an existing email (test asserts it, so the leak is locked in); rate limits reset on restart; receipts are unencrypted in SQLite; no logging policy.
- New surface to note: the admin routes check `HOGGY_ADMINS` by email, and with no email verification an attacker who registers an admin's email address first becomes that admin. This is a real gap until B07 lands (new risk R13).

**6. Reliability: PARTIAL**
- Concurrent PUT gives 409: PASS (tested). Restart keeps data: SQLite on disk, not exercised by a test.
- Filter speed at 1,000 rows, first load on throttled 4G: not measured. `conferences.js` is 302 KB and the live API sends the full list in one response (about the same size) `[ASSUMPTION]`.
- `/healthz`: absent. Backup and restore: absent. CI: absent (`.github` does not exist).

**7. Copy and compliance: FAIL**
- "Guaranteed", "world's largest": present (M5, M8).
- Australian English in UI copy: looks right ("Anaesthesia", "organiser"); a US-leaning "color" was not searched for.
- Estimates marked and dated: dates yes; city, CPD, price and attendees no (M2 to M4).
- No client or personal data in the repo: PASS on a scan of the docs and data. The dev `data-store/` folder contains an inbound secret file and an empty database (0 users); keep it out of any shared copy.

## Top 8 gaps that block the north star (highest impact first)

| # | Gap | Evidence | Concrete fix | Decision or keys needed |
|---|---|---|---|---|
| 1 | **Provenance is cosmetic, so "confirmed" cannot be trusted.** | M1: `lastVerified` is a default stamp, `sourceUrl` equals the homepage on 413 of 413, 150 of 210 confirmed rows have no event page, six ESC events share one URL. | Replace with real provenance: `datesSourceUrl` (event-specific page), `datesQuote` (the text seen), `verifiedOn` and `verifiedBy` (tool or person). Run `check-sources` over all rows plus a human pass on 210. Downgrade every row without a matching source to "estimated". Reword the UI to "Organiser lists 25-27 Mar 2027 (checked 3 Nov)". Do not show "confirmed" without a stored quote. | None. Data curator time (about 2-3 days for 210 rows `[ASSUMPTION]`) |
| 2 | **Guessed fields are shown as fact, and one is already wrong.** | M2 to M4: IDWeek wrong in dates and city; 143 rows at exactly 20 CPD hours; accreditation body assigned by region; round-number attendees; unsourced US$ prices. | Add per-field provenance. Show CPD hours, body, price and attendees only when sourced; otherwise "Not listed by organiser". Mark city as "location to be confirmed" on estimated rows. Fix IDWeek now and audit all 203 estimated rows, starting with October (37 of the 58 October rows are estimated). | **Angus: D8** (hide unsourced CPD, price and attendees, or show as indicative?). Recommend hide |
| 3 | **Corrections cannot reach the live database, and the updater could corrupt good data.** | `seedConferences` uses `INSERT OR IGNORE`, so editing `conferences.js` never changes an existing server row (fixing IDWeek changes nothing). `refresh()` auto-writes dates when `similar()` matches (Jaccard 0.3 plus a shared acronym), publishes with no sign-off, and six ESC rows share one URL where a different ESC congress can match. The updater has never run (`ingest_runs` = 0). | Versioned seed: upsert curated rows where `source='curated'` and the row has no admin edit. Make `refresh()` write a proposed diff to a review queue instead of patching. Require name plus city plus year to match. Add fixture tests for it. Run on 40 rows once and read the log before enabling `HOGGY_INGEST=1`. | **Angus: D10** (queue or auto-apply; recommend queue). D1 permission still open |
| 4 | **Receipts copy still promises a guarantee and a match that does not exist.** | M5, M6; D6 and R5. | Change "How we guarantee your claim" to "What claim-ready means", drop "watertight", and say "forwarded emails are read; attachments are stored for you to attach". Add a test that greps the UI for "guarantee". | **Angus: confirm D6 wording** |
| 5 | **"Verified attendee" is self-asserted; no moderation; admin takeover via unverified email.** | M7, R13; no report or delete route in server.js. | Relabel as "Attended (self-reported)" now. Count a review as verified only when the user has a receipt for that conference in their inbox, or a verified email on the organiser or society domain. Add report, hide, delete and a moderation list. Add email verification so `HOGGY_ADMINS` cannot be claimed by registering an address. | **D3 (email provider, key, sender domain)** for verification |
| 6 | **Coverage hole and scale.** | Nothing dated before 8 Jan 2027; whole file is 2027; 413 of 1,000; 48 of 80 countries; Africa 9 rows; AU 55, NZ 8. | Add Nov-Dec 2026 and 2028 shards (the next 60 days matter most to bookings). Then grow to 1,000 society by society using the seed-registry approach in `listing-sources.md`: first-party pages only. | **D1** (licence to ingest) and **D7** (AU/NZ first, or global) set the order |
| 7 | **Receipts pipeline is unproven on real receipts.** | No PDF or image text extraction; parser has 6 assertions, no 50-receipt set, no FX, no sender allowlist; files stay in the browser. | Build a 50-receipt redacted test set (Angus supplies real receipts), add PDF text extraction, a sender allowlist, FX with a stored rate and date, and server-side file sync. Target 90% field accuracy. | **Angus: real redacted receipts; X5** (relax the zero-dependency rule for PDF text or OCR) |
| 8 | **Operations and privacy not launch-ready.** | No CI, `/healthz`, backups, logging policy, privacy policy, persistent rate limits, password reset; register leaks emails; receipts unencrypted at rest. | GitHub Actions running `npm test`, `merge-shards --dry` and the new validator; `/healthz`; nightly SQLite backup with a restore test; rate limits in SQLite; privacy policy and terms; encrypt receipt blobs. | **D5** (hosting, domain, MX), **D3**, legal review (X8) |

Things this review cannot fix and that depend on others: live booking (D4, partner and keys), licensed reviews (D2), outbound email (D3), hosting and mail domain (D5), data permission (D1), target markets (D7).

## Decisions and keys needed from Angus

| ID | Decision | Recommendation |
|---|---|---|
| D1 | May the updater fetch organiser and society pages, and which sources may we ingest? | Keep it to first-party organiser pages, robots-aware, and email the top societies for permission |
| D3 | Outbound email provider, sender domain, API key | Needed for verification, reset and alerts (gap 5) |
| D5 | Hosting, domain, inbound mail MX | Needed before go-live and for receipts by email |
| D6 | Confirm "claim-ready, not guaranteed" | Confirm so copy can change (gap 4) |
| D7 | Target markets and CPD bodies for v1 | AU/NZ first: 63 rows today, only 15 carry RACGP or RACP bodies |
| D8 (new) | Unsourced CPD hours, price and attendees: hide or show as indicative? | Hide until sourced |
| D9 (new) | Relax the zero-dependency rule for PDF text or OCR (X5)? | Yes, one vetted library |
| D10 (new) | Updater: auto-apply date changes, or queue for sign-off? | Queue; never auto-publish |
| D2, D4 | Licensed reviews; booking partner | Not blocking this round |

Round record: Round 2, 6 Nov 2026. Items claimed (inferred): B01, B04 done; B02, B05, B06, B08, B16, B18, B20 partial. Gates: 0 FAIL (cannot diff), 1 FAIL (validator missing), 2 FAIL (accuracy), 3 FAIL, 4 not run, 5 PASS with gaps, 6 partial, 7 FAIL. New risks added to the RAID log by this review (not yet written to `raid.md`, which this task did not ask me to edit): R13 admin takeover through unverified email; R14 refresh overwrites correct dates; R15 "verified" label misleads. Scores changed: Coverage 1 to 2, Data quality 1 to 2, Reliability 1 to 2. Decisions needed: D1, D3, D5, D6, D7, D8, D9, D10.

Review notes: Sources are the repo files named above, three scripts I wrote in the session scratch folder (stats, sample fetch and liveness check; nothing was added to the repo), and the 15 organiser pages named in the sample table, accessed 6 Nov 2026. Open assumptions: the 15-row sample is small (`[ASSUMPTION]` on the interval); the inferred list of round-2 items; effort estimates. `[UNVERIFIED]`: CPD hours, accreditation, price and attendees for all rows; EAN dates, SMFM venue; PHAA and AAE dates; whether the 6 liveness failures are real. Compliance checks done: no client data used, no search terms contained client names, the repo and OneDrive were not modified. Recommended reviewer: Angus.
