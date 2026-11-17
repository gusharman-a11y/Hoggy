# Hoggy round 8: north-star rescore after the 10-17 Nov builds, and the copy clean-up (B35, B37)

Internal. DRAFT FOR ANGUS REVIEW. As at 17 Nov 2026, branch `to-main` (GitHub main of the hoggy repo plus three local commits from this round).

**Bottom line.** **24 of 45, up from 22 (round 7) and 23 (round 4).** The app has grown a lot since 6 Nov: a rewritten homepage, server-side review verification with admin queues, highest rated by attendees, "Covered in" links, Postgres on Supabase, courses and certificates, hospitals (approvals, budgets, claims to finance), and Snap receipt with a checklist and tax-invoice check. Most of that work makes existing scores firmer rather than higher, because the next level on each dimension needs something outside the code: outbound email (D3), a mail domain (D5), 50 real receipts, or a much higher share of confirmed dates. Data quality **drops to 2**, because the list grew from 477 to 2,043 rows mostly with estimates (34% confirmed, was 79%). The north star is **not met**.

How this was checked:
- Read app.js, server.js, stats.js, pack.js, lib/, README.md, the tests and the CI workflow at `to-main`.
- `npm test`: 78 tests, 76 pass, 2 skipped (Postgres-only), 0 fail. `npm run test:pg` against local Postgres 16: 78 tests, 77 pass, 1 skipped, 0 fail.
- GitHub Actions: the last 5 runs on main are green on both jobs (`test` on SQLite, `test-postgres` on Postgres 16).
- Counts computed from `data/conferences.js` with `stats.js` (`homeStats`, `discoverSummary`), today = 17 Nov 2026.
- Headless Chromium on a throwaway server: Discover, Receipts and CPD headings render with 0 console errors.
- **Not done:** no re-sample of rows against organiser pages, no re-run of the Playwright hospital and Snap journeys, no accessibility audit.

---

## 1. Built this round

| ID | What changed | Evidence |
|---|---|---|
| B35 | **Copy-lint fixed and widened.** `tests/hoggy.test.js:30` held `\b` as two literal backspace characters (0x08), so the "largest" check could never match. Fixed. New `tests/copy.test.js` (now in `npm test`) lints index.html, app.js, admin.html, admin.js, courses.js, stats.js, pack.js, server.js, lib/*.js, README.md and every string field of `data/conferences.js` for largest, biggest, leading, best, premier, foremost, guarantee\*, world's, world-leading, #1, number one, top rated / top-rated, never lose, watertight, seamless. "Highest rated" passes only as "Highest rated by attendees"; the API path `/api/top-rated` is allowed as code. A self-test proves it fires on seeded copy, and a guard fails on any control character in `tests/` or `tools/` JS | Run against the previous commit, it fails on app.js "Best match" and on 10 blurbs; on this commit it passes |
| B35 | **Blurbs fixed**: 10 rows in `data/conferences.js` ("The leading ...", "The world-leading ...", "Premier ...", "Leading ...") now read "A major ..." or "Major ...", the wording `tools/merge-shards.js` already uses for "largest". The same blurbs were fixed in `data/shards/` (europe, late2026-2028, north-america) so a re-merge does not bring them back | `git diff 4b25525^ 4b25525` |
| B37 | **Remaining overclaims removed** (see section 2) | `914f038` |
| — | **Discover subtitle** was "`${CONFS.length}` conferences worldwide, mostly 2027" (the count included past rows; 1,226 of 2,041 upcoming rows are in 2027, so "mostly" was not true). Now computed by `HoggyStats.discoverSummary`: "2,041 upcoming conferences in 73 countries, Nov 2026 to Dec 2028. 705 (34%) have dates confirmed by the organiser; the rest are marked as estimates." | `tests/copy.test.js` pins the helper and the absence of "worldwide" and a fixed year |

## 2. Copy changes (B37)

| Where | Before | After |
|---|---|---|
| index.html meta description | "Find medical conferences worldwide ... keep every receipt claim-ready." | "Find upcoming medical conferences and courses, plan travel, track CPD and check your receipts are claim-ready." |
| Discover sort | "Best match" | "Closest match" |
| Discover subtitle | "... conferences worldwide, mostly 2027. Filter by ... CPD value." | Computed counts and date span (above); "Filter by specialty, region, country, month and published CPD." |
| Receipts heading | "Every receipt in one place, checked against your claim rules the moment it arrives." | "Your receipts in one place, checked for a file, amount, date and trip, and against the caps you enter in Settings." |
| Forwarding address note | "They land in your Receipts within a minute with the vendor, amount and date read for you and a suggested trip" | "While Hoggy is open it checks for new ones every minute (or tap Check inbox now). It reads the vendor, amount and date where it can and suggests a trip when only one fits; you check each one." (matches `pullInbox` every 60 s and `suggestTrip`) |
| Receipts panel | "How Hoggy makes your claim claim-ready" with four static green ✓ | "What Hoggy checks before you claim", plain bullets; the export rule now also names the policy-limit check that the gate applies |
| CPD heading | "Hours banked automatically when you mark a conference attended." | "When you mark a trip attended, enter the hours on your certificate and they are logged here." (the dialog asks for the certificate hours) |
| Trips heading | "... to bank your CPD" | "... to log your CPD hours" |
| Home hero | "Hoggy handles the admin." | "Hoggy helps with the admin." |
| Home benefit | "export the log for your college" | "export the log as a CSV (college-specific formats are not built yet)" |
| README | "Live global database (constantly updated)"; "dates update automatically"; "Receipt files are stored per device" | "Conference database and updater"; matches re-stamp `lastVerified` only, any change is queued for an admin, the updater has not run on the full dataset; receipt files are also copied to the server file store |

Already fixed before this round and confirmed by grep: "attached on submission", "maximum on offer", "never lose an expense claim", unconditional CPD hours ("0 CPD hrs", "20h"), the `v.demo` flag, and the source link next to "Dates confirmed".

## 3. North-star rescore

| # | Dimension | R7 | R8 | Why |
|---|---|---|---|---|
| 1 | Coverage | 2 | **3** | 2,041 upcoming rows (target 1,000 met), 71 specialties, 6 regions, window to Dec 2028; 115 confirmed rows start before 1 Mar 2027 (round 4 bar: 40). Short: 73 of 80 countries; AU/NZ completeness unconfirmed (D7) |
| 2 | Data quality | 3 | **2** | 34% confirmed (707 of 2,043), 231 confirmed rows cite a site root, 0 stored quotes, no validator, CPD sourced on 1 row. Labels are honest and the copy-lint now works, but the target is 95% confirmed |
| 3 | Review trust | 3 | **3** | Server-side verification with admin queues for receipts and proofs, mandatory admin key, report weighting. A 4 needs email-verified reviewers (D3) |
| 4 | Travel | 2 | **2** | Unchanged (D4) |
| 5 | Receipts to claim | 3 | **3** | Much richer (Snap, checklist, tax flags, currencies, finance claims), but a 4 needs measured accuracy on 50 real receipts, the key decision (D9), inbound MX (D5) and automatic FX |
| 6 | CPD | 2 | **2** (borderline 3) | Honest hours and course certificates with expiry. No per-body rules, conversion or college export |
| 7 | UX | 3 | **3** | Homepage rewrite and two Playwright journeys at phone and desktop sizes with 0 console errors. No WCAG audit |
| 8 | Security and privacy | 2 | **3** | Round 7 penalty lifted: owner-tagged local state, employer PII device-only, device-only erase, RLS on Postgres, persistent rate limits, scoped hospital records with tests. No email verification, register reveals existing emails, no privacy policy |
| 9 | Reliability | 2 | **3** | CI green on SQLite and Postgres for the last 5 pushes; 78 tests. No restore test, no monitoring |

**Overall: 24 of 45.**

## 4. What blocks a higher score

| Rank | Gap | Dimensions | Points available | Needs |
|---|---|---|---|---|
| 1 | **Confirmation rate 34%**, no quotes, 231 site-root URLs, no validator | Data quality | +1 to +2 | Data curation (B28, B30); can start now |
| 2 | **Outbound email (D3)**: email verification and reset, reminders, hospital emails | Review trust, Security, CPD | +1 to +2 | Angus: provider and sender domain |
| 3 | **Domain and inbound MX (D5)**: forwarded receipts do not reach production | Receipts, go-live | +1 with item 4 | Angus |
| 4 | **Receipts not proven**: 50 redacted receipts at 90%, Anthropic key in production (D9), automatic FX with date and source | Receipts | +1 | Angus: receipts and D9; B11 can start now |
| 5 | **CPD depth and accessibility**: per-body rules and college export (B13, D8); WCAG 2.2 AA audit with axe and keyboard pass (B19) | CPD, UX | +1 to +2 | B19 can start now; B13 needs D8 |

Also blocked: EMST and PALS course data (B46: surgeons.org and international.heart.org behind a Cloudflare challenge, medcast.com.au robots.txt disallows), no daily course refresh (B48), countries 73 of 80 (B06), live booking (D4), restore test and monitoring (B34, B14).

## 5. Backlog changes made

- B35 moved to Done (evidence above).
- B37 moved to Done.
- B27 updated: 115 confirmed events before 1 Mar 2027 (count met); quotes still missing (B30).
- B06 updated: 2,043 rows (1,000 met), 73 countries (80 not met).
- B40 updated: admin key, report exclusion and FX are now covered by tests; seed lock and updater fixture are not.

## Round record

Round 8 (PM rescore plus copy build), 17 Nov 2026, `to-main` at `06b7ee7` plus this document.
- Items claimed: B35, B37 (done), Discover subtitle.
- Gates: automated PASS (`npm test` 76 of 78 pass, 2 skipped; `npm run test:pg` 77 of 78 pass, 1 skipped; CI green). Copy PASS (copy-lint green over every listed source). Journeys: smoke check only, not the five checklist journeys. Data sample: NOT RUN.
- North-star scores changed: Coverage 2 to 3, Data quality 3 to 2, Security 2 to 3, Reliability 2 to 3.
- Decisions needed from Angus: D3, D5, D9 (set the key?), D6 (confirm "claim-ready"), D7, D8.

Review notes:
- **Sources:** repo files at `to-main`, test output and GitHub Actions run list (17 Nov 2026). No web sources were used.
- **Unverified:** accuracy of the 1,566 rows added since round 4 (no organiser re-sample); production configuration (whether `ANTHROPIC_API_KEY` and `DATABASE_URL` are set on Vercel).
- **Assumptions:** scores are PM judgement `[ASSUMPTION]`; Angus should adjust.
- **Scope:** app copy, `stats.js`, `data/conferences.js` and three shards, tests, README and `docs/pm/` were changed. Nothing in `tools/`, `data/courses/` or `docs/research/` was touched.
- **Recommended reviewer:** Angus.
