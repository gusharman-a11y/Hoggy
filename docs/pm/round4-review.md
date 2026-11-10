# Hoggy round 4 review

Internal. DRAFT FOR ANGUS REVIEW. As at 6 Nov 2026. Runs `docs/pm/review-checklist.md` against the changes since round 3. No app code was edited. Overall: **23 of 45** (round 3: 22). North star: **NOT MET**. Sampled accuracy: **19 of 19 confirmed rows correct (100%)**; strict across all 25 sampled rows **19 of 25 (76%)**.

How this was checked: read server.js, app.js, admin.js, parse.js, lib/ingest.js, tools/merge-shards.js, tests, CI file, index.html and README; ran `node --test tests/hoggy.test.js`, `node tools/merge-shards.js --dry` and `node --check` on six files; computed counts from `data/conferences.js`; drew 25 random rows (19 confirmed, 6 estimated) and fetched each row's `sourceUrl` with Node `fetch`; then started a throwaway server on a temp data folder (admin key, report, restore, forged-review and seed-lock paths). **Deviations:** no browser, so the five journeys were not run (counts as not passed); there is no round 3 snapshot, so I cannot isolate the rows verified since round 3 or the 54 corrected rows. I sampled from all 377 confirmed rows, of which about 104 are new since round 3 (273 to 377).

## Headline numbers

| Measure | Round 3 | Round 4 | Target |
|---|---|---|---|
| Conferences | 477 | 477 | 1,000 |
| Specialties / countries | 51 / 58 names (57 ISO) | 51 / 58 names (57 ISO) | 40 (met) / 80 |
| Confirmed / estimated | 273 / 204 (57%) | **377 / 100 (79%)** | 95% / under 5% |
| Confirmed rows with provenance, sourceUrl and lastVerified | 210 | **377 of 377** | 100% (met) |
| Estimated rows carrying a verified stamp | 40 stale stamps | **0** | 0 (met) |
| Confirmed rows citing a site root (not an event page) | 115 of 210 | **149 of 377 (40%)** | 0 |
| Stored date quote or event-page field (`datesQuote`) | 0 | 0 | 100% |
| Rows with CPD hours 0 ("check organiser") | 0 | 175 (37%) | n/a |
| Rows still showing a typical, unsourced CPD number | 477 | 302 | 0 unsourced |
| Rows dated Nov-Dec 2026 / before 1 Mar 2027 | 3 / n/a | **3 / 43** | 40 before Mar 2027 (met by count only if confirmed) |
| Estimated rows dated before 1 Mar 2027 | n/a | 7 | 0 |
| Past events shown | 0 | 0 | 0 |
| Tests | 5 pass | 5 pass, 0 fail (1.2 s) | CI green |

Command results:
- `node --test tests/hoggy.test.js`: 5 of 5 pass. Same five test names as round 3. **No test covers any round 4 feature** (see T1).
- `node tools/merge-shards.js --dry`: `provenance {"verified":376,"downgraded":94,"corrected":0}`, `{"added":0,"dupId":417,"dupName":1,"invalid":0,"skippedUnconfirmed":27} total 477 specialties 51 countries 58 confirmed 377`. Idempotent. Your 377 and 100 match the file. I cannot confirm "54 corrected" because the corrections are already applied.
- `node --check` passes on server.js, app.js, parse.js, admin.js, lib/ingest.js, tools/merge-shards.js. `scripts/validate-data.js` still does not exist.
- CI: `.github/workflows/test.yml` runs `npm test` only. The folder is still not a git repo, so it has never been seen to run.

## Sampled accuracy (25 random conferences)

Method: Node `fetch` of each row's `sourceUrl`, then a date-pattern search for our start day, month and year, then my read of the surrounding text. All 25 pages returned HTTP 200.

| # | Row | Flag | Our dates and city | Organiser page says | Result |
|---|---|---|---|---|---|
| 1 | ASN Kidney Week | confirmed | 27-31 Oct 2027, San Diego | "October 27-31, 2027 ... San Diego Convention Center" | Correct |
| 2 | SIR 2028 | confirmed | 18-22 Mar 2028, Philadelphia | "Mar 18, 2028 - Mar 22, 2028 ... Philadelphia" | Correct |
| 3 | AACR Annual Meeting | confirmed | 2-7 Apr 2027, Orlando | "April 2-7, 2027 \| Orlando" | Correct |
| 4 | TSANZSRS ASM | confirmed | 2-6 Apr 2027, Gold Coast | "02 - 06 April 2027 ... Gold Coast" | Correct |
| 5 | The Pharmacy Show Sandton | confirmed | 17-18 Mar 2027, Johannesburg | "17-18 March 2027 - Sandton Convention Centre" | Correct |
| 6 | AAEM Scientific Assembly | confirmed | 25-29 Apr 2027, San Antonio | "April 25-29, 2027" | Correct |
| 7 | CKM Riyadh | confirmed | 29-30 Jan 2027, Riyadh | "29-30 January 2027, Voco Riyadh Hotel" | Correct |
| 8 | ACEM Rural, Remote EM | confirmed | 18-20 Jul 2027, Hobart | "Sunday 18 July to Tuesday 20 July 2027 ... Hobart" | Correct |
| 9 | ESVS Annual Meeting | confirmed | 28 Sep-1 Oct 2027, Lisbon | "28 September 2027 - 1 October 2027, CCL Lisbon" (shared calendar page) | Correct |
| 10 | Intl Conference on Integrated Care | confirmed | 10-12 May 2027, Tallinn | "ICIC27 Tallinn, Estonia 10-12 May 2027" | Correct |
| 11 | SSDDS Riyadh | confirmed | 8-10 Jan 2027, Riyadh | "08 - 10 January 2027, Riyadh" | Correct |
| 12 | SNO/ASCO CNS Metastases | confirmed | 12-14 Aug 2027, San Diego | "August 12-14, 2027 in San Diego" | Correct |
| 13 | ACEP28 Scientific Assembly | confirmed | 17-20 Sep 2028, Las Vegas | "ACEP28 ... 9/17/2028 - 9/20/2028 Las Vegas, Nevada" | Correct |
| 14 | ESSHM 2027 | confirmed | 17-18 Mar 2027, Cairo | "17-18 March 2027 · Hilton Cairo Grand Nile" | Correct |
| 15 | TCT | confirmed | 18-21 Oct 2027, San Francisco | "October 18-21, 2027 Moscone Center" | Correct |
| 16 | AAO Annual Meeting 2028 | confirmed | 13-16 Oct 2028, Chicago | "Oct. 13-16: AAO 2028 ... Chicago, McCormick Place" | Correct |
| 17 | APA Annual Meeting 2028 | confirmed | 6-10 May 2028, Chicago | "May 06, 2028 - May 10, 2028" | Correct |
| 18 | Global Health Exhibition | confirmed | 25-28 Oct 2027, Riyadh | "25-28 October 2027, Riyadh Exhibition and Convention Center" | Correct |
| 19 | BSR Annual Conference | confirmed | 28-30 Apr 2027, Liverpool | "28-30 April 2027 ... Liverpool Experience Campus" | Correct (dates). **CPD is wrong, see below** |
| 20 | SBCP Congresso Cirurgia Plastica | estimated | 10-13 Nov 2027, Sao Paulo | Home page shows a Fortaleza/CE congress; no 2027 date | Unverifiable (city doubtful) |
| 21 | **ABEn CBEn 2027** | estimated | 8-12 Nov 2027, Brasilia | Page: "76th CBEn, 8 to 12 November **2026**, Brasilia" | **Suspect: our 2027 row copies the 2026 edition's days and city** |
| 22 | CBR Jornada Paulista | estimated | 29 Apr-2 May 2027, Sao Paulo | Calendar lists other events, no JPR date | Unverifiable |
| 23 | JDA Annual Meeting | estimated | 4-6 Jun 2027, Kyoto | Page is 186 characters (JavaScript) | Unverifiable |
| 24 | SBMT MEDTROP 2027 | estimated | 22-25 Aug 2027, Sao Paulo | MEDTROP described, no date | Unverifiable |
| 25 | **SOCHICAR Congreso 2027** | estimated | 1-4 Dec 2027, Santiago | Page: "2 al 5 de Diciembre 2026, Hotel Enjoy Coquimbo" (the 2026 edition) | Unverifiable; city likely differs |

- **Confirmed rows: 19 of 19 correct = 100%.** With n = 19 the 95% lower bound is about 83% `[ASSUMPTION]`. Dates, city and year all matched. This is the first round with no mismatch on the confirmed set, and it covers a larger share of event-specific and root-page evidence.
- **Estimated rows: 0 of 6 verified, 1 suspect, 5 unverifiable.** That is consistent with the label. The two with an organiser edition on the page (ABEn, SOCHICAR) show the row is last year's pattern moved by 12 months.
- Checkable rows 20; correct 19; counting ABEn as a miss gives **19 of 20 = 95%**. Strict (correct only if shown correct) **19 of 25 = 76%**.
- Estimated rows are not random across the catalogue: 54 Asia-Pacific, 25 Latin America, 10 Africa, 9 North America, 2 Europe. 25 are Australia, 22 Brazil. A clinician in AU/NZ sees 33 of 63 rows confirmed.
- **CPD, sampled on the 19 confirmed pages:** 18 pages state no CPD figure, so the "~hours" and body are unverifiable. One page states one: BSR says "CPD 22 credits are available"; our row says ~15 hours, body "RCP/CPD UK". A typical number was wrong on the only page that stated it.
- **Missing, not wrong:** two real events sit in the catalogue's own window but are absent: ABEn CBEn 8-12 Nov 2026 Brasilia (opens in 2 days; before the 29 Nov start of the window) and SOCHICAR 2-5 Dec 2026 Coquimbo. Only 3 rows fall in Nov-Dec 2026.
- Not sampled: price, attendees, city on non-sampled estimated rows.

## What was fixed since round 3 (verified in code)

| Claim | Result |
|---|---|
| 377 confirmed, all with provenance, sourceUrl, lastVerified | Yes (377 of 377). No estimated row carries a stamp |
| Guessed CPD zeroed | Yes: 0 rows at exactly 20; 175 at 0 shown as "CPD: check organiser" (app.js:134) |
| Typical accreditation, price, city labelled | Yes: "Typical accreditation:" grey pill (app.js:278), "Registration (indicative) about US$" (app.js:277), "(est.)" after the city on cards (app.js:133), "City is an estimate" in detail |
| Round 3 copy N1, N3, N5, N8 | Fixed: home copy now "organised and claim-ready"; accreditation pill caveated; city "(est.)"; filter says "typical CPD hrs" |
| Verified attendee needs attended trip plus receipt file | Rule exists (server.js:221). **Not proof**: see F8 |
| Reported reviews (3 or more) excluded from ratings | Yes (server.js:148), and the ratings cache is cleared on report. Proved live: score gone after 3 reports; admin Restore brings the review back |
| Reported reviews moderated in admin | Yes: `/api/admin/reported` with Restore or Delete (admin.js:17, server.js:198-199) |
| Optional `HOGGY_ADMIN_KEY` | Works: no key gives 403 "admin key required", wrong key 403, right key 200 (live). Constant-time compare. **Optional, and not in the README** |
| Updater never auto-promotes estimated to confirmed | Yes (ingest.js:90 only stamps rows already confirmed; an estimated row with a matching hit goes to `date_changes`). Not covered by a test |
| Admin-edited rows locked from seed overwrite | Yes: patch and approved change set `source='live-edited'` (server.js:185, 196) and the seed skips non-curated rows (server.js:55). Proved live. Trade-off: a locked row also misses later data corrections |
| Foreign-currency receipts need a rate; totals and exports in home currency | Yes: bad-level issue blocks export (app.js:110), `homeAmt` used in totals, CSV and pack. Rate has no date or source, and rates are typed by hand |
| Parser amount regex fixed | Yes: "Total nights: 3 / Total $300.00" now returns 300 (test line 13) |
| Tests now 5 | Same 5 as round 3. Only the dataset test gained assertions |

## What is still misleading to users today

| # | Where | What users or others see | What is true | Severity |
|---|---|---|---|---|
| M1 | index.html:9 (search snippet) | "Find the **best** medical conferences worldwide ... and **never lose an expense claim**." | An unsupported superlative and a guarantee in all but name; this is the first thing a search engine shows. Missed in rounds 1 to 3 | High |
| M2 | app.js:329 (printed claim pack, goes to an employer) | "**all checked.** Receipt files are held in Hoggy and **attached on submission**." | Files sit in the browser's IndexedDB; nothing is submitted or attached anywhere; "Mark submitted" only changes a status | High |
| M3 | data blurbs (31 "largest", 53 on a wider superlative match) | "The world's largest radiology meeting", "Largest haematology meeting worldwide" | Unsourced. The merge script rewrites these to "a major" only on a real run, which has not been done. The test meant to block them is a no-op (T2) | High |
| M4 | app.js:281 | "reviews from verified attendees (trip marked attended with receipts **on file in Hoggy**)" with a "✓ Verified attendee" pill | Files are on the reader's own device; the server checks no file. Anyone can forge it (F8) | High |
| M5 | app.js:419 (Mark attended) | CPD hours pre-filled, "Defaults to the **maximum on offer**" | It is the typical, unconfirmed number. It writes a guess into the user's CPD log | Medium |
| M6 | app.js:174 and 213 | Trips show a green "**0** CPD hrs" pill on 175 rows; CPD "Close the gap" shows "20h" with no "~" | The card says "check organiser"; these two places drop the caveat and the "0" reads as "no CPD" | Medium |
| M7 | app.js:188 | "land in your Receipts within a minute with the vendor, amount and date read for you and a suggested trip, which you confirm" | Only email body text is read (PDFs and images give amount 0). The trip is auto-assigned (app.js:368), not suggested. Polling runs only while the app is open | Medium |
| M8 | app.js:146 and 158 | "scans the world's medical conferences", "477 conferences worldwide" | True as a count, but 3 rows fall before Jan 2027 and two real Nov-Dec 2026 events are missing | Low to Medium |
| M9 | app.js:189 | Four static green ticks | They are rules drawn as passed checks | Low |
| M10 | app.js:277 | "Dates confirmed by organiser · checked 2026-11-06" | True in my sample (19 of 19). `sourceUrl` is stored for all 377 but never shown (`grep sourceUrl app.js` returns 0), so users cannot check it | Low to Medium |
| M11 | app.js:71 | Offline, your own single review shows as the conference's star score | Not a community score | Low |
| M12 | detail pills | "Typical accreditation: AMA PRA Category 1" on 5 non-US rows (Dubai, Riyadh exhibition, 3 Canada), while the card says "CPD: check organiser" on 146 rows with a body | Body is a guess and sits beside a zero | Low |
| M13 | app.js:64 and 283 | Stale "demo seed" comment and `v.demo` check | Dead code, not visible | Low |
| M14 | README | "dates update automatically", "Not built: currency conversion", no mention of `HOGGY_ADMIN_KEY` | Updater now queues; manual FX exists | Low |

## Code and test findings (adversarial)

| # | Finding | Evidence | Impact |
|---|---|---|---|
| F8 | **"Verified attendee" is still forgeable, and now falsely reassuring.** The server reads trips and receipts from the user's own synced state JSON and only checks that a `fileKey` string exists. I forged it live: state with one attended trip and a receipt `{fileKey:'t-fake', amount:0}` produced `verified: true, role: "Verified attendee"` with no file on the server. The existing test (line 45) locks this in. In the app, pasting any text into the receipt dialog creates a "file" (`t-` key, app.js:314) | server.js:221; tests line 45 and 49; live run | Five throwaway accounts unlock the star score for any conference, and the score averages all reviews, not only verified ones |
| F9 | **The copy-lint test is a no-op.** Line 29 of the test file holds `\b` turned into two backspace characters (code 8), so the regex `/<BS>(largest\|world's leading)<BS>/` never matches. 31 blurbs contain "largest" and the test passes | tests/hoggy.test.js:29 (char codes 8 around the group) | False assurance on the claim that superlatives were removed |
| F10 | **No test covers a round 4 change**: ratings exclusion, admin key, seed lock, updater promotion, FX requirement, verified negative case. Test count is unchanged at 5 | tests/hoggy.test.js | Regressions would ship silently |
| F11 | Updater end-date check is a tautology (`hit.end === (hit.end >= hit.start ? hit.end : hit.start)`), so a row whose start matches but whose end differs gets a fresh stamp and provenance. Matching is still Jaccard 0.3 with a shared acronym, with the six-row ESC URL case untested | lib/ingest.js:90, 71 | A confirmed row can be re-stamped when only the start agrees |
| F12 | Admin takeover (R13) is mitigated only if `HOGGY_ADMIN_KEY` is set. It is optional, undocumented, and the admin email can still be registered first by anyone | server.js:10, 169 | Operators who skip the key keep the old hole |
| F13 | Three throwaway accounts can still hide any review (no email verification, no account age, 30 reports an hour each) | server.js:122, 226 | Cheap censorship; now at least visible and reversible in the admin list |
| F14 | Admin patch can set any field (including `datesConfirmed`, `url`) with no audit log, and approved updater changes apply `provenance: organiser-jsonld` with no stored quote | server.js:185, 193 | No trail for who changed what, and locked rows miss future file fixes |
| F15 | Inbound email defaults currency to AUD (not the user's home currency), FX rate has no date, bookings have no currency, and the Home "Not yet claimed" tile counts a rate-less foreign receipt as 0 | server.js:251, 262; app.js:98, 143, 173 | An NZD or USD user can enter a wrong rate; totals can undercount |
| F16 | Backups still sit on the live data disk, unencrypted, with no restore test (F6 from round 3) | server.js:267-275 | Unchanged |

## Checklist run

**0. Scope and process: PARTIAL.** No git history; each claim checked against code or data. All claims hold except "54 corrected" (cannot be re-derived) and "verified attendee" (rule exists, not proof).
**1. Automated: PASS with gaps.** Tests 5 of 5, syntax clean, merge dry run clean. Data validator absent (FAIL).
**2. Data quality: PASS for confirmed rows, FAIL for estimated.** Confirmed 19 of 19. Estimated 0 of 6 verified. 0 past events. 18 shared `url` values. 149 root-only evidence URLs. No quote field.
**3. Review trust: PARTIAL.** Post, edit, delete, report, exclude-from-score, admin restore all work. Verified is forgeable; no email verification.
**4. Journeys: NOT RUN** (no browser). Counts as not passed.
**5. Security: PASS for what is tested**, with F8, F12, F13.
**6. Reliability: PARTIAL.** `/healthz` and daily backup; no restore test, monitoring or CI run.
**7. Copy and compliance: FAIL** (M1 to M4).

## Remaining gaps, highest impact first

| # | Gap | I can build now? |
|---|---|---|
| 1 | **Date evidence and the estimated tail.** 100 rows (21%) estimated, many copying last year's days and city (ABEn, SOCHICAR); 149 confirmed rows cite a site root; no quote field, no validator, and the copy-lint test never fires | **I can build now**: B30 validator and quote fields, fix the `\b` test, run the real merge to strip superlatives, B28 estimated-row audit |
| 2 | **Coverage hole and scale.** 3 rows in Nov-Dec 2026, real events missing, 477 of 1,000, AU/NZ only 33 of 63 confirmed | **I can build now** for curated first-party pages (B27, B06). Ingest at scale **needs D1** |
| 3 | **Review trust is asserted, not proved.** Verified is forgeable by API or by pasting text; 3 accounts hide a review; no email verification | Server-side proof, account age and mandatory admin key **I can build now** (B36). Email verification **needs D3** (provider, domain, key) |
| 4 | **Receipts on real documents.** PDFs and images are not read, no 50-receipt set, rates typed by hand, "attached on submission" is false, inbound currency defaults to AUD | Copy fix, FX date and source, currency default **I can build now** (B11, B37). PDF or OCR **needs user decision/keys** (D9 and Angus's 50 redacted receipts) |
| 5 | **CPD depth.** No per-body rules, certificate upload or college export; 302 typical numbers still shown (BSR wrong by 7 hours); attend dialog banks a guess | **I can build now** (B13, M5, M6). Which bodies first **needs D7**; whether to hide the typical numbers **needs D8** |
| 6 | **Travel stops at deep links.** No itinerary, affiliate links or booking | Itinerary **I can build now** (B16). Live booking and affiliates **need user decision/keys** (D4) |

Also open at lower rank: tests for every round 4 feature (B40), backups off-disk and restore test (B34, off-box target needs D5), privacy policy (B21), README drift (B37).

## Decisions and keys needed from Angus

| ID | Decision | Recommendation |
|---|---|---|
| D1 | Which sources may the updater fetch and scale to | First-party organiser pages only, robots-aware |
| D3 | Email provider, sender domain, key | Needed for verification and for closing R13 for good |
| D4 | Booking route | Affiliate links first |
| D5 | Hosting, domain, MX | Needed before go-live |
| D6 | Confirm "claim-ready, not guaranteed" | Confirm; then M1, M2, M7 get removed |
| D7 | Target markets and CPD bodies | AU/NZ first |
| D8 | CPD, price, attendees: label or hide | Hours are now zeroed or "~". I now recommend hiding the typical number and the accreditation pill until sourced, because the one sampled organiser figure contradicted ours |
| D9 | Allow one library for PDF text or OCR | Yes |
| D10 | Updater queue, not auto-apply | Done as designed; confirm |
| D11 (new) | Make `HOGGY_ADMIN_KEY` mandatory whenever `HOGGY_ADMINS` is set | Yes; I can build it |
| New | 50 real, redacted receipts for the parser test set | Angus to supply |

Round record: Round 4, 6 Nov 2026. Items claimed: B23, B26, B29, B33, B11 (parts), B24, B32 (parts). Score changes: Review trust 2 to 3 (borderline). All others unchanged. Data quality holds at 3 despite the move to 79% confirmed, because the exit criteria for 4 (stored quote, estimated under 15%, validator in CI, 95% on a fresh sample) are not met. New backlog items B35 to B37, B40 and B43. New risks for `raid.md` (not edited): R21 verified badge forgeable through synced state (F8); R22 copy-lint test inert (F9); R23 estimated rows extrapolate the previous edition (ABEn, SOCHICAR); R24 admin-locked rows miss later corrections (F14).

Review notes: Sources are the repo files named, the 25 organiser pages in the sample table (and the ACEP, CBR, SBCP, ABEn, SBMT, SOCHICAR, JDA home pages for the estimated rows), and scratch scripts in the session scratchpad (nothing added to the repo), accessed 6 Nov 2026. A throwaway server on a temp folder was started and stopped. Open assumptions: sample size and interval; reading "unverifiable" as no evidence either way; reading ABEn as a copy of the 2026 edition `[ASSUMPTION]`; sizes in the backlog. `[UNVERIFIED]`: CPD hours, accreditation, price and attendees on all rows; the 5 unverifiable estimated rows; the "54 corrected" claim; whether CI runs. Compliance checks done: no client data used, no search terms contained client names, the repo and OneDrive were not modified. Recommended reviewer: Angus.
