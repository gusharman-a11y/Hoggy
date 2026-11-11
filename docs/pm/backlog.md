# Hoggy backlog

Internal. DRAFT FOR ANGUS REVIEW. Re-prioritised after round 4 (6 Nov 2026). Sizes: S under 0.5 day, M 1-2 days, L 3-5 days, XL more than 1 week (engineering effort `[ASSUMPTION]`). Owner roles: Data curator (DC), Backend (BE), Frontend (FE), QA, Security (SEC). Priority P0 = trust or safety, P1 = north-star core, P2 = growth. IDs are stable; new items continue from B35. Rows are ordered by impact on the north star, not by ID. "Can build now" means no decision or key is needed.

## Done (removed from the open list)

| ID | Item | Evidence |
|---|---|---|
| B01 | Seeded "Sample data" reviews removed | Round 2 |
| B04 | Date status on cards and detail; past events hidden | 0 past rows; "est." on card and city, status pill in detail |
| B25 | Versioned DB seed, and admin edits survive reseeding (was B33) | Seed compares `seedhash`; patches and approved changes set `source='live-edited'` and the seed skips them; proved live in round 4. Side effect tracked in B43 |
| B33 | Admin edits survive reseeding | As above |
| B29 (part) | Reported reviews (3 or more) excluded from score and verified tally; admin Restore and Delete | Proved live: score disappears after 3 reports, Restore brings it back. Rest of B29 is now B36 |
| B23 (core) | Provenance on every confirmed row; CPD guess zeroed; accreditation, price, city labelled | 377 of 377 confirmed rows have provenance, `sourceUrl`, `lastVerified`; 0 estimated rows stamped; 0 rows at exactly 20 h. Sample 19 of 19 confirmed correct. Quote and event-page field not stored, see B30 |
| B26 (part) | Updater queues date changes and no longer promotes estimated to confirmed | ingest.js:90 only re-stamps rows already confirmed; estimated hits go to `date_changes`. Not tested; end-date check is a tautology, see B26 below |
| B11 (part) | Foreign receipts need an exchange rate; totals, CSV and pack in home currency | app.js:98, 110, 323. Rate has no date or source, see B11 below |
| B14 (part) | `/healthz`, daily backup (7 kept) | Round 3. Restore, logs and monitoring still open |
| B05 (part) | CI workflow and 5 tests; dataset test now requires `sourceUrl` on confirmed rows | 5 of 5 pass. Superlative assertion is inert, see B35 |
| B24 (part) | "Claim-ready" heading and home copy | app.js:146, 189. Remaining overclaims are B37 |
| B36 (part) | Verified attendee decided on the server only; reviews per conference series | 11 Nov 2026. Client fields and synced trips are ignored (negative tests in `tests/reviews.test.js`). Verified = a registration receipt the server received by email naming the conference and dated in its window, or an admin-approved proof upload (private, admin-only file route, deleted after the decision). Old verified flags reset on migration. Scores weight verified x1, unverified x0.5, shown from 3 reviews. Admin endpoints need `HOGGY_ADMINS` and `HOGGY_ADMIN_KEY` (warning at start if the key is missing) |
| B06 (part) | 477 conferences, 51 specialties (met), 58 countries | `merge-shards --dry` |

## Decisions and blockers for the user

| ID | Decision | Status and why it matters | Needed from |
|---|---|---|---|
| D1 | Data sourcing and licence: which sources may we ingest? | Open. Updater still unrun on real data. Needed before scaling beyond hand-curated first-party pages | Angus |
| D2 | Review source: community only, or a licensed feed? | Open, not blocking | Angus |
| D3 | Outbound email provider and sender domain | Open. Blocks email verification, reset, alerts, and closing the admin-takeover gap (R13) for good | Angus plus key |
| D4 | Live booking: affiliate links or partner API | Open. Blocks Travel above 2 | Angus plus partner |
| D5 | Hosting, domain, inbound mail MX | Open. Blocks go-live and real receipts by email | Angus |
| D6 | "Claim-ready, not guaranteed" | Applied in the receipts heading and home copy. Confirm, then B37 removes the remaining overclaims | Angus |
| D7 | Target markets and CPD bodies for v1 | Open. AU 55, NZ 8 rows (33 of 63 confirmed) | Angus |
| D8 | Unsourced CPD, price, attendees: hide or label | Team chose **label**. Round 4 recommendation changes to **hide** the typical CPD number and accreditation pill until sourced: the one organiser figure sampled (BSR, 22 credits) contradicted ours (15) | Angus |
| D9 | Relax zero-dependency rule for PDF text or OCR | Open. Blocks B09 | Angus |
| D10 | Updater: queue or auto-apply | Team chose **queue**; built. Confirm | Angus |
| D11 (new) | Make `HOGGY_ADMIN_KEY` mandatory whenever `HOGGY_ADMINS` is set | Recommend yes. Closes the optional-key gap (F12) | Angus |

## Backlog (open items only, highest impact first)

| ID | Pri | Item | Owner | Size | Can build now? | Done-check |
|---|---|---|---|---|---|---|
| B35 | P0 | **Fix the copy-lint and strip superlatives.** tests/hoggy.test.js:29 holds `\b` as two backspace characters so the "largest" check never fires; 31 blurbs still say "largest" (53 on a wider match). Fix the regex, run the real `merge-shards` (it already rewrites to "a major"), and extend the lint to index.html, app.js and README for "best", "largest", "guarantee", "never lose", "watertight" | QA + DC | S | Yes | The test fails on a seeded "largest" blurb; 0 blurbs match after merge |
| B37 | P0 | **Remaining copy overclaims (M1 to M7, M9 to M14).** index.html:9 "best ... never lose an expense claim"; app.js:329 "all checked ... attached on submission"; app.js:281 "receipts on file in Hoggy" and "✓ Verified attendee"; app.js:419 "maximum on offer"; app.js:174 and 213 show "0 CPD hrs" and "20h" without caveat; app.js:188 "read for you and a suggested trip, which you confirm"; static green ticks; show the `sourceUrl` next to "Dates confirmed"; remove `v.demo`; update README (queue, FX, admin key) | FE | S | Yes (D6 confirm) | Copy lint passes; no sentence describes a feature that is not built |
| B36 | P0 | **Make "verified attendee" real.** Mostly done 11 Nov 2026 (see Done). Changed from the original plan at the owner's request: unverified reviews count half in the score rather than not at all. Left: email verification of reviewers (needs D3); emailed receipts are not sender-authenticated (SPF/DKIM), so a user could email themselves a made-up registration receipt; consider sending receipt matches to the admin queue instead of auto-verifying | BE + FE | S (left) | Mostly. Email verification needs D3 | A forged state yields "Attended (not verified)" (tested); admin refuses without a key (tested) |
| B28 | P0 | **Audit the 100 estimated rows**, soonest first (7 are dated before 1 Mar 2027). Round 4 found two rows that copy the previous edition's days and city (ABEn 2027 copies 8-12 Nov 2026 Brasilia; SOCHICAR 2027 copies the 2026 Coquimbo congress). Show provisional rows as month only and hide the city on the card where it cannot be verified | DC | L | Yes | Fresh random sample of 20 estimated rows: 0 wrong; every estimated row before 1 Mar 2027 checked |
| B30 | P0 | **Store evidence and enforce it.** Add `datesSourceUrl` (event page), `datesQuote`, `verifiedOn`. Write `scripts/validate-data.js` (required fields, duplicates, lat/lng, specialty and country lists, "confirmed" needs a quote, no URL shared unless one page, one spelling per country, no superlatives). Backfill the 149 confirmed rows that cite a site root. Run `merge-shards --dry` and the validator in CI | DC + BE + QA | M | Yes | Validator exits 0 on all rows and non-zero on a seeded bad row; 0 confirmed rows without a quote; CI runs it |
| B40 | P1 | **Tests for every round 4 change.** Ratings exclude hidden reviews; admin key (403 without, 200 with); seed lock (admin patch survives a changed file row and restart); updater fixture (estimated hit is queued, not promoted; the six ESC rows); FX rate required; verified negative case | QA + BE | M | Yes | Deleting each feature fails the build; CI count rises above 5 |
| B27 | P1 | **Fill the front and back of the window.** Only 3 rows are dated Nov-Dec 2026 (RSNA, SABCS, ASH); 43 before 1 Mar 2027. Known misses: ABEn CBEn 8-12 Nov 2026 (Brasilia), SOCHICAR 2-5 Dec 2026 (Coquimbo). Add at least 40 events for Nov 2026 to Feb 2027 with event-specific URLs and quotes | DC | L | Yes (first-party pages) | 40 confirmed events dated before 1 Mar 2027, all with quotes |
| B06 | P1 | Grow from 477 to 1,000 conferences and 58 to 80 countries; AU/NZ complete first (D7); one spelling per country. Every row passes B30 | DC | XL | Yes for curated first-party; ingest at scale needs D1 | Counts in validator output |
| B13 | P1 | **CPD v2**: per-body rules (RACGP, RACP, ANZCA, AMA PRA, EACCME), hours conversion, certificate upload, annual export; conference hours only where sourced; "Mark attended" must not pre-fill a typical number as "maximum on offer"; drop the accreditation guess where the body is unlikely (5 non-US AMA PRA rows) | FE + DC | L | Yes (D8 decides hide or label) | A RACGP export matches the college format; hours never exceed what the organiser lists |
| B09 | P1 | Receipt pipeline v2: PDF and image text, sender allowlist, spam guard, inbound flow end to end | BE | L | No: needs D9 and Angus's 50 real redacted receipts | At least 90% vendor, date and amount accuracy on 50 receipts |
| B10 | P1 | Server-side receipt files with sync, quota, retention (also the basis for B36 proof) | BE + FE | M | Yes | Receipt added on device A opens on device B; deletion removes the file |
| B11 | P1 | **FX v2.** Store rate date and source, suggest a rate, default inbound currency to the user's home currency (server.js:251 uses AUD), add currency to bookings, count foreign receipts correctly in the Home tile | BE + FE | M | Yes | Foreign receipt shows converted amount, rate and date in pack and CSV; NZD user's inbound receipt is not labelled AUD |
| B12 | P1 | Claim pack v2: employer policy templates, PDF export with receipts, status tracking | FE + BE | L | Yes | Template change alters the checks; one PDF with every receipt |
| B26 | P1 | **Finish updater safety.** Fix the end-date tautology (ingest.js:90); require name plus city plus year to match (not Jaccard 0.3 with an acronym); fixture test with the six ESC rows that share one URL; first run on 40 rows, log read by DC before `HOGGY_INGEST=1` | BE + DC | M | Yes (D1 for scale) | Fixture: a different ESC congress on the page changes nothing; a start-only match is not re-stamped |
| B43 | P1 | **Admin governance.** Audit log for admin patches and approvals (who, when, before, after); a "locked rows" report so `live-edited` rows do not miss later file corrections; store a quote with an approved updater change | BE | S | Yes | Every admin change is listed; locked rows listed in the merge dry run |
| B34 | P1 | **Backups you can trust.** Restore test (script plus CI step); copy backups off the data disk; encrypt (they hold users and receipts) | BE + SEC | M | Yes (off-box target needs D5) | Restore on a clean folder passes in CI; backup not on the same disk |
| B07 | P0 | Email verification and password reset (D3); identical register response for new and existing emails | BE + SEC | M | No: needs D3 | Unverified users cannot post reviews or use admin; reset link single use, 1 hour |
| B08 | P1 | Review trust, rest: link and profanity filter, show count and recency, bring auto-hide into the moderation queue | BE + FE | M | Yes | Moderator can restore a hidden review (restore exists; queue UI to add) |
| B05 | P1 | Tests and CI, rest: 50-receipt parser set, API tests for inbound and updater, prove CI green on a pull request (repo needs to be a git repo first) | QA + BE | L | Yes (receipt set needs Angus) | CI green; deleting a check fails the build |
| B14 | P1 | Structured logs without PII, error monitoring | BE + SEC | S | Yes | Logs hold no emails or amounts; alert on `/healthz` failure |
| B15 | P1 | Security pass: ASVS L1 report, persistent rate limits, session rotation, secret scan, encrypt receipt blobs | SEC | L | Yes | ASVS L1 report with 0 high findings |
| B20 | P2 | Refresh pipeline, rest: schedule, change digest, source register, kill switch per host | DC + BE | M | Yes after B26 | Weekly job lists changed dates; nothing live without sign-off |
| B16 | P2 | Travel v2: itinerary view, affiliate links (D4), nearest airport | FE | M | Itinerary yes; affiliates need D4 | Itinerary shows flights, hotel and conference in order |
| B17 | P2 | Live booking through a partner API | BE + SEC | XL | No: D4 | Sandbox booking end to end |
| B18 | P2 | Search, rest: proximity, calendar and map views, saved searches, alerts | FE + BE | L | Mostly; alerts need D3 | 10 scripted searches return the expected top result |
| B19 | P2 | Accessibility and mobile audit to WCAG 2.2 AA; onboarding; run the five journeys in a browser each round (not run in rounds 3 and 4) | FE + QA | M | Yes | axe 0 serious; keyboard-only pass; usable at 360 px |
| B21 | P2 | Privacy policy, terms, data export, deletion verification; legal review | SEC | M | Draft yes; legal review needs Angus | Documents published; export returns all user data |
| B22 | P2 | Licensed review feed (D2) | BE | XL | No: D2 | Each imported review has provenance and licence |

Review notes: Sizes are estimates `[ASSUMPTION]`. B07, B09, B16 (affiliates), B17, B22 need decisions or keys. Items B35 to B37, B40 and B43 are new from round 4 (`docs/pm/round4-review.md`); B28, B30, B27, B13, B11, B26 were reshaped by its findings. B33 is folded into B25 (done). Recommended reviewer: Angus.
