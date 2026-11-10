# Hoggy round 3 review

Internal. DRAFT FOR ANGUS REVIEW. As at 6 Nov 2026. Runs the checklist in `docs/pm/review-checklist.md` against the changes since round 2. No app code was edited. Overall: **22 of 45** (round 2: 21). North star: **NOT MET**. Sampled accuracy: **14 of 15 checkable = 93%** (strict 14 of 22 = 64%).

How this was checked: read server.js, app.js, lib/ingest.js, tools/merge-shards.js, tests, the CI file and the round 1 and 2 docs; ran `node --test tests/hoggy.test.js` and `node tools/merge-shards.js --dry`; computed counts from `data/conferences.js`; drew 22 random rows with a shuffle and fetched each row's `sourceUrl` with Node `fetch` (WebFetch was not available), following the organiser's own event or calendar pages where the first page was silent. **Deviation:** no browser was available, so the manual journeys were not run. Pages that render dates with JavaScript could not be read, and those rows are counted unverifiable, not correct.

## Headline numbers

| Measure | Round 2 | Round 3 | Target |
|---|---|---|---|
| Conferences | 413 | 477 | 1,000 |
| Specialties | 38 | 51 | 40 (met) |
| Countries | 48 | 58 names, 57 ISO codes (Czech Republic and Czechia both used) | 80 |
| Date window | 8 Jan to 22 Dec 2027 | 29 Nov 2026 to 26 Nov 2028; 3 rows in 2026, 442 in 2027, 32 in 2028 | next 24 months |
| Confirmed / estimated | 210 / 203 | 273 / 204 (57% / 43%). You reported 272; the file and the merge dry run both give 273 | 95% / under 5% |
| Rows with provenance tag | 0 genuine | 210 (merge prints "verified 209, downgraded 1") | 100% |
| Confirmed rows with no provenance tag | n/a | 63 | 0 |
| Past events shown | 0 | 0 | 0 |
| Tests | 4 pass | 5 pass, 0 fail (about 1.3 s) | CI green |

Command results:
- `node --test tests/hoggy.test.js`: 5 tests, 5 pass. The dataset test still only asserts `length >= 60` and a `>= 60` server list.
- `node tools/merge-shards.js --dry`: `provenance {"verified":209,"downgraded":1,"corrected":0}`, then `{"added":0,"dupId":417,"dupName":1,"invalid":0,"skippedUnconfirmed":27} total 477 specialties 51 countries 58 confirmed 273`. Idempotent. 27 unconfirmed rows from the late-2026-2028 shard are skipped, and one name duplicate is dropped.
- CI file exists (`.github/workflows/test.yml`, Node 24, runs `npm test` only). It has never been seen to run because this folder is not a git repository.

## Sampled accuracy (22 random conferences)

| # | Row | Our flag | Our dates and city | Organiser page says | Result |
|---|---|---|---|---|---|
| 1 | SCCM Critical Care Congress | confirmed, provenance | 14-16 Mar, San Diego | "March 14-16, 2027, San Diego" | Correct |
| 2 | European Congress of Immunology | confirmed, provenance | 5-8 Sep, Florence | "Florence from September 5th to 8th, 2027" | Correct |
| 3 | ASHM Viral Hepatitis Conference | confirmed, provenance | 18-20 Aug, Wollongong | "18-20 August 2027, Novotel Wollongong" | Correct |
| 4 | UHS Pediatric Dubai | confirmed, provenance | 28-30 Jan, Dubai | "28-30 Jan 2027, Dubai" | Correct |
| 5 | European Public Health Conference | confirmed, provenance | 16-19 Nov, Belgrade | "16-19 November 2027, Belgrade" (page's date table still shows the 2026 conference) | Correct |
| 6 | EuroPCR | confirmed, provenance | 18-21 May, Paris | "18-21 May 2027, Paris" | Correct |
| 7 | ESC Preventive Cardiology | confirmed, provenance | 15-17 Apr, Lisbon | ESC calendar "15-17 April / Lisbon" | Correct |
| 8 | TKRCD Antalya | confirmed, provenance | 13-17 Apr, Antalya | "13-17 Nisan 2027, Belek, Antalya" | Correct |
| 9 | ASGCT Annual Meeting | confirmed, provenance | 3-7 May, Philadelphia | "May 3-7, 2027 ... Philadelphia" | Correct |
| 10 | Heart Rhythm 2028 | confirmed, no tag | 4-7 May 2028, Atlanta | "May 4-7, 2028, Atlanta, GA" (in page markup) | Correct |
| 11 | AAAC 2027 | confirmed, no tag | 13-16 Sep, Dar es Salaam | "13-16 September 2027 ... JNICC, Dar es Salaam"; JSON-LD startDate 2027-09-13 | Correct |
| 12 | ESSHM 2027 | confirmed, no tag | 17-18 Mar, Cairo | "17-18 March 2027, Hilton Cairo Grand Nile" | Correct |
| 13 | ACEP28 Scientific Assembly | confirmed, no tag | 17-20 Sep 2028, Las Vegas | "9/17/2028 - 9/20/2028, Las Vegas" | Correct |
| 14 | ASRA Regional Anesthesiology Meeting | estimated | 13-15 May, Houston | "May 13 2027, Houston, TX, 52nd Annual" (end date not shown) | Correct start and city; end not seen |
| 15 | **ANCIPS 2027** | estimated | **20-24 Jan, Hyderabad** | IPS page: "**7th to 10th January 2027 ... Madurai**" | **Wrong: dates and city** |
| 16 | PAS Meeting | estimated | 30 Apr-3 May, Minneapolis | Site has a PAS 2027 page but the text carries no date (PDF only) | Unverifiable |
| 17 | AAHPM Annual Assembly | estimated | 17-20 Mar, Pittsburgh | "Registration is open for the 2027 Annual Assembly", no date in the page | Unverifiable |
| 18 | Palliative Care Conference (PCA) | estimated | 14-16 Sep, Melbourne | No 2027 event on the home page | Unverifiable |
| 19 | JDDW | estimated | 4-7 Nov, Kobe | Japanese society home page, no event date | Unverifiable |
| 20 | TSOC Annual Meeting | estimated | 27-28 Mar, Taipei | Home page shows 2026 Winter meeting only | Unverifiable |
| 21 | CBO Congresso de Oftalmologia | estimated | 8-11 Sep, Sao Paulo | Page is JavaScript-rendered (17 characters of text) | Unverifiable |
| 22 | AdPha Advanced Pharmacy | estimated | 29-31 Oct, Gold Coast | Home page news only; no 2027 date | Unverifiable |

- **Accuracy where checkable: 14 of 15 = 93%.** That is under the 95% bar for B23, so the round gate for sampled accuracy is marginal (checklist rule: no mismatches in a fresh sample).
- **Strict (correct only if shown correct): 14 of 22 = 64%.**
- By flag: **confirmed rows 13 of 13 correct** (9 with provenance tags, 4 without); **estimated rows 1 of 2 checkable correct, 7 of 9 unverifiable**. Provenance work has made "confirmed" trustworthy in this sample. The weakness is the 204 estimated rows (43% of the catalogue), where the one hard miss is a 13-day, different-city error for an event only 2 months away.
- Margin: 15 checkable rows is small; the true confirmed-row accuracy could be well below 100% `[ASSUMPTION]`. Not sampled: CPD hours, accreditation, price, attendees.
- Link liveness for the sample: 22 of 22 returned HTTP 200.
- Adversarial notes on provenance:
  - 115 of the 210 tagged rows cite a site root as evidence (five of my nine tagged sample rows did, and were right today). A homepage rolls to the next edition after the event and no quote is stored, so the claim cannot be re-audited. Event-specific URL plus stored quote is still open (B30).
  - The ESC Preventive Cardiology row is "verified" against a shared six-row ESC calendar page. It is correct, but it is a listing, not an event page.
  - 40 rows in the file still carry `lastVerified` without a provenance tag, 6 of them homepage-only (RSNA, SABCS, ASH among them, the only three rows dated in 2026). The merge strips the blanket stamp only when run for real; I ran it with `--dry` only.
  - The previous wrong row (IDWeek) is now fixed: 6-9 Oct 2027, Boston, confirmed.

## What is misleading to users today

Fixed since round 2: "How we guarantee your claim" is now "How Hoggy makes your claim claim-ready" (app.js:188). Cards and detail show "~20 CPD hrs" with a tooltip, detail says "Typical credits, not confirmed" (0 rows are marked `cpdVerified`), price is "Registration (indicative) about US$", detail says "City is an estimate until the organiser confirms" on estimated rows. Nothing says "Sample data". Reviews are escaped.

| # | Where | What users see | What is true | Severity |
|---|---|---|---|---|
| N1 | app.js:145 (home) | "keeps your CPD hours and expense claims watertight" | Same overclaim D6 was meant to remove. A guarantee in all but name | High |
| N2 | app.js:187 (Receipts) | "land in your Receipts within a minute, already read and matched to your trip" | Unchanged since round 2: forwarded email bodies are parsed, attachments are only stored, nothing is matched to a trip | High |
| N3 | app.js:277 (detail pills) | Green pill "Accreditation: AMA PRA Category 1" | Shown whenever `cpdBody` is set, with none of the caveat the CPD fact box carries two lines away. 143 rows say exactly 20 hours and 0 rows are verified. Contradicts the "Typical credits" note | High |
| N4 | app.js:282 and server.js:217 | Green pill "check Verified attendee", and "verified attendees (trip marked attended in Hoggy)" | The reader sees "Verified"; the footnote admits it is the reviewer's own click. A new account can set it in two clicks. Still R4 and R15 | High |
| N5 | app.js:132 (cards) | City shown plain on every card; only the date gets "est." | On estimated rows the city can be wrong (ANCIPS shows Hyderabad, organiser says Madurai). The city caveat only appears after opening the detail panel | Medium |
| N6 | app.js:276 and 277 | "Dates confirmed by organiser · checked 2026-11-06" and a "Dates confirmed" pill | True in my sample (13 of 13), but 63 of the 273 confirmed rows carry no provenance tag, and the date is a batch date, not proof for that row. No source link is shown next to the claim | Medium |
| N7 | app.js:157 | "477 conferences worldwide" | True as a count. Only 3 are dated before January 2027, so a clinician searching Nov or Dec 2026 finds almost nothing and may conclude none exist | Medium |
| N8 | app.js:163 (filter) | "20+ CPD hrs" | Filters on the estimated figure, so 143 rows at exactly 20 pass a 20+ filter on a guess | Medium |
| N9 | Blurbs (data) | "The world's largest radiology meeting", "Largest haematology meeting worldwide", "The Middle East's largest healthcare exhibition" | 31 blurbs match "largest" or "world's" (45 on a wider superlative match; round 2 counted 30). No source or date. Breaks the firm no-unsupported-superlatives rule | Medium |
| N10 | app.js:188 | Four static green ticks "Every receipt must have a file, amount, date and trip" etc. | They are rules, drawn as passed checks regardless of the user's receipts | Low to Medium |
| N11 | app.js:277 | "Large (3,000+)" and "~N attendees" | 474 of 477 attendee figures are round hundreds; "~" is shown but the size pill reads as fact | Low |
| N12 | app.js:182 | "checked against your claim rules the moment it arrives" | Checks run when the receipt is parsed, not on files the parser cannot read | Low |
| N13 | app.js:64 and 282 | Stale "demo seed" comment and a `v.demo` class check | Dead code, not user-visible; remove with the copy pass | Low |

Reviews score: still gated at 5 verified reviews, which is good, but because "verified" is self-asserted and reported reviews still count (see below), the gate is weak.

## Code findings from reading the changes (adversarial)

| # | Finding | Evidence | Impact |
|---|---|---|---|
| F1 | **Hidden reviews still move the score.** The ratings query reads every review with no report filter, so a review hidden after 3 reports still counts in the average and in the "verified" tally that unlocks the score | server.js:147 (query) against server.js:158 (list filters by reports) | A bad-faith review stays in the number after moderation |
| F2 | **Three throwaway accounts can hide any review.** Accounts need no email verification, each reports once, and 3 reports hides the review. Report limit is 30 an hour per account | server.js:122, 158, 222 | Cheap censorship of honest negative reviews |
| F3 | **Admin edits do not survive a reseed.** Admin patches and approved date changes keep `source='curated'` and the old `seedhash`. The next change to that row in `conferences.js` overwrites the admin's edit | server.js:54, 182-183, 191 | Queue approvals can be silently lost. Round 2 goal "admin edits are preserved" holds only until the file row changes |
| F4 | **`refresh()` still upgrades estimated rows to confirmed on its own** when a fuzzy name match has the same dates, and stamps `lastVerified` and `provenance: organiser-jsonld`. Date changes are queued but status promotion is not. Matching is still `similar()` at Jaccard 0.3 with a shared acronym, and the six ESC rows still share one URL | lib/ingest.js:71, 89-90 | A wrong match promotes a row to "confirmed" with no human check. The updater has still not run on real data |
| F5 | **Admin takeover through an unverified email is still open** (R13). `HOGGY_ADMINS` matches the registered email, and register still returns 409 for an existing email and a test locks that in | server.js:10, 98, 122, 167; tests line 40 | Whoever registers the admin's address first becomes admin |
| F6 | **Backups sit on the same disk as live data** and hold users and receipts unencrypted. Only the first run of each day writes, 7 are kept. The test checks a file exists, not that it restores | server.js:262-271; test line 81 | Disk loss or a leaked data folder loses everything or leaks everything |
| F7 | **CI is not proof.** The workflow runs `npm test` only. The dataset test checks shape, not the real rules; there is no validator script (`scripts/` does not exist) | `.github/workflows/test.yml`; tests line 19 | A catalogue of 477 wrong dates would still pass CI |

## Checklist run

**0. Scope and process: PARTIAL.** No git history, so I cannot diff; I verified each claimed change against code and the data file. Claims confirmed: merge to 477 (yes), per-row provenance (yes, 210, no quote), stamp removed (mostly; 40 leftovers in the file), estimated labels on CPD, price and city (yes, detail only for city), versioned seed (yes), updater queue and admin approval UI (yes), report and delete and auto-hide at 3 (yes, see F1 and F2), `/healthz` (yes), nightly backup (daily, yes), CI workflow (file exists, unproven), "claim-ready" wording (heading only, see N1 and N2). Claim "272 confirmed": I count 273.

**1. Automated: PASS with gaps.** Tests 5 of 5. `merge-shards --dry` clean. Data validator absent (FAIL, F7). Syntax not rechecked this round.

**2. Data quality: PASS for confirmed rows, FAIL for estimated.** Confirmed 13 of 13. Estimated 1 of 2 with 7 unverifiable. 0 past events. 18 shared `url` values (14 distinct shared `sourceUrl` values, ESC six rows). Czech Republic and Czechia both used. 31 superlative blurbs.

**3. Review trust: FAIL.** Post, edit, delete, report and auto-hide work. Unverified users are not blocked; "verified" is self-asserted; hidden reviews count in scores.

**4. Journeys: NOT RUN** (no browser). Counts as not passed.

**5. Security: PASS for what is tested, with the same known gaps** (F2, F5, F6).

**6. Reliability: PARTIAL.** `/healthz` and backups present; no restore test, monitoring or CI run evidence.

**7. Copy and compliance: FAIL** (N1 to N4, N9).

## Remaining gaps, highest impact first

| # | Gap | I can build now? |
|---|---|---|
| 1 | 204 rows (43%) have estimated dates; one of two checkable is wrong (ANCIPS), and 63 "confirmed" rows and all 210 "verified" rows lack a stored quote or event-page URL. No validator | **I can build now** (B28, B30; Node-fetch audit plus a human pass for JavaScript-rendered sites) |
| 2 | Near-term coverage hole and scale: 3 rows in Nov-Dec 2026, 477 of 1,000 | **I can build now** for curated first-party shards (B27, B06). Ingesting at scale **needs D1** |
| 3 | Review trust: "verified" is self-asserted, reported reviews still count, three accounts can censor, admin takeover open | **I can build now**: F1 fix, relabel, receipt-proof rule, moderation queue (B29, B08). **Email verification needs D3** (provider and key) |
| 4 | Receipts untested on real documents: no PDF or image text, no FX, no 50-receipt set, files per device, copy overclaims | **Needs user decision/keys**: Angus's redacted real receipts and D9 for PDF or OCR. FX, file sync and the copy fixes (B10, B11, B32) **I can build now** |
| 5 | CPD tracking depth: 143 rows at an unsourced 20 h, no per-body rules, no certificate upload or college export (dimension stuck at 2) | **I can build now** (B13). Which bodies first **needs D7** |
| 6 | Travel stops at deep links and ICS: no itinerary, no affiliate links, no booking | Itinerary **I can build now** (B16). Live booking and affiliates **need user decision/keys** (D4) |

Also open but lower rank: operations and privacy (restore test, off-disk backups, privacy policy; go-live needs D5), and the copy and code findings N1 to N13 and F3, F4 (**I can build now**).

## Decisions and keys needed from Angus

| ID | Decision | Recommendation |
|---|---|---|
| D1 | Which sources may the updater fetch and scale to | First-party organiser pages only, robots-aware; ask top societies |
| D3 | Email provider, sender domain, key | Needed for verification, reset and admin safety |
| D4 | Booking route | Affiliate links first, partner API later |
| D5 | Hosting, domain, MX | Needed before go-live |
| D6 | Confirm "claim-ready, not guaranteed" | Confirm, then remove N1 and N2 |
| D7 | Target markets and CPD bodies | AU/NZ first |
| D8 | CPD, price, attendees: hide or label | Team chose label. I recommend hiding CPD hours and the Accreditation pill until sourced, because N3 and N8 show a guess as a fact |
| D9 | Allow one library for PDF text or OCR | Yes |
| D10 | Queue, not auto-apply | Confirmed by the build; also stop F4 |
| New | 50 real, redacted receipts for the parser test set | Angus to supply |

Round record: Round 3, 6 Nov 2026. Items claimed: B23, B25, B26, B24, B08, B14, B05 (parts). Score changes: Data quality 2 to 3 (borderline); all other dimensions unchanged. New backlog items B28 to B34. New risks for `raid.md` (not edited this round): R16 hidden reviews still counted in scores (F1); R17 report brigading with free accounts (F2); R18 admin edits lost on reseed (F3); R19 updater promotes estimated to confirmed without sign-off (F4); R20 backups co-located and unencrypted (F6).

Review notes: Sources are the repo files named, the 22 organiser pages in the sample table, and scratch scripts in the session temp folder (nothing added to the repo), accessed 6 Nov 2026. Open assumptions: sample size and interval; reading "unverifiable" as not evidence either way; sizes in the backlog. `[UNVERIFIED]`: CPD, accreditation, price, attendees on all rows; the 7 unverifiable sample rows; ASRA end date; whether the CI workflow runs. Compliance checks done: no client data used, no search terms contained client names, the repo and OneDrive were not modified. Recommended reviewer: Angus.
