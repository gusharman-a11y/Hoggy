# Hoggy round 7: adversarial review of the claim-flow build (C01, C02-lite, C04-lite, C05, C06-lite)

Internal. DRAFT FOR ANGUS REVIEW. As at 7 Nov 2026. This is the head PM's review of what engineering built after round 6. No app code was edited.

**Bottom line.** The build is real and mostly does what engineering says. Receipts can now leave the browser, the policy gate works on the fixture numbers, and the .eml draft is well formed. **But the new server copy of receipts has made the old sync shortcuts dangerous.** Signing in on a device that already holds data pushes that local state over the account on the server, even when the local data belongs to a different person (critical on shared hospital workstations). Uploads to the server copy fail silently. "Erase everything" also wipes the synced account. Employee ID and cost centre now sit unencrypted on the server, which goes against the round 6 recommendation on O3. **Score: 22 of 45, down 1 from 23.** The pre-agreed security penalty applies. **Fix sync and file safety (R7-B1) before building anything new.**

How this was checked:
- Read pack.js, app.js (claim, receipt, sync, settings and leave paths), server.js, tests/pack.test.js, tests/hoggy.test.js, README.md and docs/pm/north-star.md.
- Ran `npm test`: 16 of 16 pass.
- Probed pack.js in Node (script in the session scratchpad) for subject encoding, header injection and policy edge cases.
- **Not done:** no browser run and no mail client run by me. The engineering browser run (gate blocks a $300/night hotel against a $250 limit, a 3-attachment .eml, a correct leave body) is taken as reported, not reproduced.

---

## 1. Engineering claims, verified against the code

| Claim | Verdict | Evidence |
|---|---|---|
| C01: receipt files downloadable from the Receipts page | **True** | Download button per row, app.js:218. `openFile` falls back to the server, app.js:120-123 |
| C01: server copy via /api/rfile and /api/rfiles | **True** | server.js:236-255. Scoped per user (`'u'+id+':'+key`, plus a `user_id` filter), magic bytes checked, 300 MB quota. Test at tests/hoggy.test.js:59-67 |
| C01: "file missing" check via FILES_LOADED in receiptIssues | **True when online. Never runs offline** | app.js:132. `syncFiles()` (which sets FILES_LOADED) is skipped when the server is unreachable (`return` at app.js:473, before app.js:476). See R7-09 |
| C01: invented caps removed | **True for new users only** | `caps: {}` at app.js:34. No migration: existing local and synced caps are merged back in (app.js:37, 453). See R7-05 |
| C01: copy fixed | **Partly** | "from your policy" is gone (grep returns 0). False or misleading copy remains: app.js:249, 257, 422, 219. See R7-04, R7-07, R7-11 |
| C02-lite: employer profile; evaluate() with hotel per night, meals per day, per-receipt caps, clause, claim deadline, no defaults | **True, with gaps** | pack.js:11-35; Settings at app.js:255. A single free-text clause is applied to every limit, so there is no per-rule citation. Limits carry no currency label |
| C04-lite: nights and personal-portion fields; gate blocks on policy 'bad' | **True, but easy to bypass** | Fields at app.js:336. Gate at app.js:227 and 234. A blank nights field or any note at all downgrades a breach to a warning. See R7-06 |
| C05: .eml with claim-schedule.csv and R1..Rn; mailto webmail fallback | **True. Not proven in mail clients. No mobile share** | app.js:371-391; pack.js:52-59. `navigator.share` is absent. No Outlook or Apple Mail run is recorded. See R7-08 |
| C06-lite: study-leave request .eml from the conference sheet | **True** | app.js:393-413; `leaveDays` at pack.js:38-43. Estimates are not checked against policy, and no approval reference is captured. See R7-12 |
| Tests: 16 pass | **True** (re-run 7 Nov 2026) | Missing from the C01 done-check: a unit test that `ready()` is false with a key and no file (`receiptIssues` sits inside the app IIFE, so it cannot be tested), and a cross-user rfile test |

## 2. Findings

Severity: Critical = loses or leaks user data in normal use. High = breaks a promise the UI makes, or a privacy decision. Medium = wrong result or misleading copy with a workaround. Low = polish or spec hygiene.

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| R7-01 | **Critical** | **Signing in pushes local state over the account, including another person's data.** `pullState` replaces local data with server data only when local is empty. Otherwise it calls `pushState()` with the server rev, which overwrites the server copy. Sign-out leaves localStorage and IndexedDB in place. So on a shared workstation, user B signs in, B's synced trips and receipts are replaced by A's, and A's employer profile (employee ID, cost centre) and receipt files are uploaded into B's account by `syncFiles`. The same path also makes a second device overwrite the first. Device A then gets a 409 and `pullState(true)` discards its unpushed edits (app.js:447) | app.js:452-454, 487, 506, 109-116 |
| R7-02 | **High** | **The server copy is best effort, and failures are silent.** `putFile` does not await `upFile` or check its result. A 415 (HEIC, GIF, files with no MIME type; the input accepts `image/*`), a 413 (quota) or a network failure leaves the file on this device only, with no indicator. `syncFiles` retries on the next load, but a 415 fails forever. In `pullInbox` the inbound server copy is deleted straight after a fire-and-forget upload. If the `/api/files` fetch fails, the receipt is saved with **no file** and the inbox item is still deleted, so the attachment is lost (the round 6 defect F-C2 is only partly fixed) | app.js:100-101, 331, 460-462; server.js:248-250 |
| R7-03 | **High** | **"Erase everything" also erases the synced account.** The dialog says "Erase all Hoggy data in this browser", but it then calls `save()`, which schedules `pushState` of the default (empty) state when the user is signed in. Server receipt files are left orphaned and still count against the quota | app.js:532, 38, 441 |
| R7-04 | **High** | **Employee PII is synced unencrypted, against O3, and the Settings copy is contradictory.** Employee ID, cost centre and the approver's name and email (a third party's data) are in `S.profile.employer`, sent to `/api/state` (syncPayload strips only reviews) and stored as plain JSON, then copied into 7 daily backups. Round 6 recommended device-only storage until B15 encryption lands. The Settings page heading still says "Data stays in this browser" and the data panel says "Everything lives in this browser", while the employer note says "synced with your account" | app.js:442, 249, 255, 257; server.js:216, 306-314 |
| R7-05 | Medium | **Existing users keep the invented caps.** Old saves and old server state still hold Meals 100, Accommodation 450, Flights 2500 and so on. They are merged back in on load and pull, then shown in Settings and enforced as if they were the user's own policy. This is the round 6 defect F-C4 surviving for every existing account | app.js:37, 453, 296 |
| R7-06 | Medium | **The policy gate is easy to bypass.** (a) A hotel with nights left blank is only a 'warn', so it passes the gate whatever the amount (probe: AUD 3,000 with 0 nights against a 250 limit gives warn). (b) **Any** note text, such as "ref 123", turns a breach into a warning, because the field is shared with general notes. (c) A meal note on one receipt clears the whole day. (d) The cap check in `receiptIssues` uses the gross amount while `evaluate` uses the net amount, so the user sees two different numbers for one cap | pack.js:18-19, 22, 27; app.js:136-137, 337 |
| R7-07 | Medium | **The pack hides policy exceptions from the admin, and the printed pack gives the admin an instruction they cannot follow.** Neither the .eml body nor the CSV says that an item is over a limit. The admin sees only a note. The CSV has no policy-result or clause column. The printed pack says "all checked" and "Download each one from its row on the Receipts page", which the admin cannot do. Personal portions do not appear in the printed pack | app.js:365-367, 381, 421-422 |
| R7-08 | Medium | **The .eml route is stated more strongly than it is proven.** The toast says it "opens as a draft" in Outlook **or Apple Mail**. `X-Unsent: 1` is a classic Outlook for Windows convention. Behaviour in Apple Mail, new Outlook, Outlook for Mac and Outlook on the web is untested `[UNVERIFIED]`, and Gmail web cannot open .eml at all. Other gaps: the subject is one RFC 2047 encoded-word of 164 characters (the limit is 75), and it is **always** encoded because `range()` contains an en dash. There is no Date or From header, and `To:` is empty on the leave draft when no approver is set. The size warning checks raw bytes against 20 MB, but base64 adds about 37% and many health services cap mail at about 10 MB `[ASSUMPTION]`. The warning is a 2.8-second toast and the file downloads anyway. The whole message is built as one in-memory string. No Web Share on mobile. The button label "Email to claims admin" reads as if Hoggy sends the email | pack.js:46, 54; app.js:384, 62, 234, 410 |
| R7-09 | Medium | **In offline mode the missing-file check never runs.** FILES_LOADED stays false, so a receipt whose key exists but whose file is gone shows "Ready" and the gate opens. `emailPack` still stops with a toast | app.js:473, 476, 132 |
| R7-10 | Medium | **Server storage can be abused.** Each account gets 300 MB. Registration allows 10 accounts per hour per IP (about 3 GB per hour per IP). Uploads have no rate limit. Each PUT buffers up to 16 MB in memory and runs a full `SUM(length(data))` scan. Every blob is copied into 7 daily `VACUUM INTO` backups. The quota check has a race between concurrent uploads | server.js:123, 246-251, 306-314 |
| R7-11 | Low | Receipts-page copy overclaims. The four checklist ticks are static green "✓" whatever the state. "They land in your Receipts within a minute" is stated while MX and hosting (D5) are not live and the inbox polls only while the app is open. "Sign in to restore it" is shown even when the user is already signed in | app.js:219-220, 132 |
| R7-12 | Low | The leave draft does not check estimates against the policy (part of the C06 acceptance), does not show the indicative price hint, does not flag an estimated city, and does not record an approval reference or amount for later use as the claim limit. `S.leave` stores only the drafted date and total | app.js:396-411 |
| R7-13 | Low | C01 acceptance is incomplete. There is no "download all receipts for this trip" option, which matters most for the webmail route: the user has to download every receipt one by one. Tests are missing for `ready()` and for cross-user isolation on `/api/rfile` | app.js:386-391; tests/hoggy.test.js:59-67 |
| R7-14 | Low | The claim deadline is counted from the conference end date, but the label says "days after the trip". Two receipts for one stay (deposit and balance) are each checked per night, which is wrong. Limits carry no currency | pack.js:29-32, 16-19 |

**Security checks with no defect found:**
- Header injection in the .eml `To:` and `Subject:` is blocked. CR and LF are stripped, U+2028 does not break a MIME header, and the boundary (`=_...`) cannot appear inside base64.
- `/api/rfile` keys are bound to the user on both the id prefix and `user_id`, so there is no IDOR path (code read; no test).
- Mutating calls need `X-Requested-With`, so CSRF is covered.
- Downloads are served as `attachment` with `nosniff`.
- The text/plain upload path is limited to 100 KB and is served back as an attachment.

## 3. North star re-score (code read, `npm test`; no browser or data re-sample by me)

| # | Dimension | R6 | R7 | Why |
|---|---|---|---|---|
| 1 | Coverage | 2 | **2** | No data work this round |
| 2 | Data quality | 3 | **3** | Unchanged |
| 3 | Review trust | 3 | **3** | Unchanged |
| 4 | Travel | 2 | **2** | Unchanged. Bookings are still not reconciled to receipts |
| 5 | Receipts to claim | 3 (borderline 2) | **3** (firm) | The borderline is removed: files leave the browser, policy checks work per night and per day, and the .eml carries every receipt. A 4 still needs the 50-receipt set at 90% (owner), FX with rate date and source, inbound currency from the profile, and the merged PDF (D12) |
| 6 | CPD | 2 | **2** | Unchanged |
| 7 | UX | 3 | **3** | One engineering browser run of the claim journey. No accessibility audit. Copy defects R7-08 and R7-11 |
| 8 | Security and privacy | 3 | **2** | Applies the rule set in round 6: employee IDs sit unencrypted on the server (R7-04). Also R7-01, a cross-account data transfer on shared devices, and R7-10 |
| 9 | Reliability | 2 | **2** | 16 tests (up from 6), but three data-loss paths (R7-01 to R7-03), no restore test and no green CI run |

**Overall: 22 of 45 (R6: 23). North star NOT MET.**

On the proposed "Claim to reimbursement" measure (round 6, awaiting Angus), the score moves from 1 to **2 (works in demo)**. A pack with every receipt can now be drafted. There is still no real employer (O1), no admin acceptance (O2) and no status beyond "submitted".

## 4. Ranked next builds

| Rank | ID | Build | Size `[ASSUMPTION]` | Owner input |
|---|---|---|---|---|
| 1 | R7-B1 | Sync and file safety | M | None |
| 2 | R7-B2 | PII handling and storage hardening | S-M | O3 (confirm device-only) |
| 3 | R7-B3 | Honest gate and admin-visible exceptions | S | None |
| 4 | C03 | Merged claim PDF (from round 6) plus "download all" | L | **D12** |
| 5 | R7-B4 | Finish C05: client matrix, standards and mobile share | S-M | None |
| 6 | C07, then C08 | FX v2, then claim status and allowance (round 6 specs unchanged) | M each | O4 |

**R7-B1. Sync and file safety (fixes R7-01, R7-02, R7-03, R7-09)**

Build:
- Tag local state with the user id that owns it.
- On sign-in, if local data exists and is untagged or tagged to someone else, ask the user to choose: "Add to this account", "Keep on this device only" or "Discard". Never push silently.
- Sign-out offers "Remove my data from this device" (default on).
- On a 409, merge by record id instead of replacing local state.
- Await uploads and show a per-receipt "Backed up / Not backed up (retry)" state.
- Convert or reject unsupported types (HEIC, no MIME type) at pick time.
- Move inbox files to the user's rfile store **on the server** (no client round-trip) before the inbox row is deleted. Never delete an inbox item whose file did not land.
- Split "Erase this device" from "Delete my synced data".
- Run `syncFiles` (or set FILES_LOADED) in offline mode.

Acceptance criteria:
- User A signs out and user B signs in on the same browser: B's server state is unchanged, and none of A's data or files reach B's account.
- Two devices edit different receipts while offline, then sync: both edits survive.
- An upload rejected with 415 shows "Not backed up" on that row.
- If the server cannot store an inbound file, the inbox item stays on the server.
- "Erase this device" leaves server state and rev unchanged.

Done-check: API and unit tests for each criterion. A scripted two-user journey in a browser, with evidence in the round record.

**R7-B2. PII handling and storage hardening (fixes R7-04, R7-10, R7-05)**

Build:
- Remove `employeeId`, `costCentre`, `approverName` and `approverEmail` from `syncPayload` (device only) until B15 encryption lands.
- Fix the Settings copy ("Data stays in this browser" becomes an accurate statement of what syncs).
- One-time migration that clears legacy caps matching the old invented defaults exactly, with a notice asking the user to enter their own policy figures.
- Add a per-user rate limit on rfile PUT, stream or limit the body, keep a running per-user usage total instead of a SUM scan, and lower the default quota (`[ASSUMPTION]` 100 MB).
- Document backup retention of deleted accounts in the privacy notice (B21).

Acceptance criteria:
- After saving an employee ID, `SELECT json FROM state` contains no employee ID.
- A legacy profile with Meals 100 loads with Meals blank and a notice.
- The 61st upload in a minute gets 429.

Done-check: API tests, plus a grep test over the synced payload.

**R7-B3. Honest gate and admin-visible exceptions (fixes R7-06, R7-07, R7-14)**

Build:
- When a hotel limit is set and nights are blank, the result is 'bad'.
- Add a separate "Justification for exceeding policy" field. Only that field downgrades a breach.
- Add "Policy check" and "Clause" columns to the CSV, and an "Exceptions" section to the .eml body and printed pack listing every over-limit item with its justification.
- Personal portions appear in every output.
- Remove the duplicate cap check from `receiptIssues`.
- Replace the printed pack's "download from the Receipts page" line with "Receipts attached separately, numbered R1 to Rn".
- Label limits with the home currency.

Acceptance criteria:
- A hotel with blank nights blocks the gate.
- A general note does not unblock a breach.
- An over-limit item with a justification appears under Exceptions in the .eml body and in the CSV.

Done-check: new pack.test.js cases for each, plus a parsed-.eml test.

**C03 plus "download all" (round 6 spec, unchanged)**

Build: one merged PDF with cover, schedule (including the R7-B3 exceptions) and receipts labelled R1 to Rn. A store-only ZIP of all receipts for the webmail route.

Acceptance criteria: as in round 6. In addition, the webmail route downloads one ZIP containing the schedule and every receipt.

Needs: **D12**.

**R7-B4. Finish C05 (fixes R7-08)**

Build:
- Fold the subject into encoded-words of 75 characters or fewer (or use plain ASCII with a hyphen instead of the en dash).
- Add Date and From headers (From left blank for the client to fill), and omit `To:` when it is empty.
- Size check on the encoded size, with a blocking confirm dialog above a configurable threshold (`[ASSUMPTION]` 10 MB default).
- `navigator.share({ files })` on mobile.
- Rename the button to "Create email draft".
- Change the toast to name only the clients that pass the test matrix.

Acceptance criteria: a recorded test matrix (screenshots) covering classic Outlook for Windows, new Outlook, Outlook for Mac, Apple Mail and Outlook on the web. Each client is marked opens-as-draft, opens-read-only or fails, and the UI copy matches the results.

Done-check: a pack test for header line lengths, plus the matrix in the round record.

### Decisions still open
- **O1** (one real employer's forms and policy): still the biggest blocker to real value.
- **D12** (pdf-lib): blocks C03.
- **O3**: R7-B2 assumes device-only storage.
- **50 receipts**: needed for Receipts to reach 4.

New risks for raid.md (not edited here):
- R30: shared-workstation account bleed (R7-01).
- R31: silent backup failure gives false confidence (R7-02).
- R32: storage abuse on hosted deploy (R7-10).

## Round record
Round 7 (adversarial PM review), 7 Nov 2026.
- Items verified: C01 (partial), C02-lite, C04-lite, C05 (partial), C06-lite.
- Gates: automated PASS (16 of 16). Journeys NOT RUN by the PM. Copy FAIL (R7-04, R7-07, R7-08, R7-11). Security FAIL (R7-01, R7-04).

Review notes:
- **Sources:** repo files cited by line (read 7 Nov 2026), `npm test` output, and a Node probe of pack.js. No web sources were used.
- **Unverified:** mail-client behaviour of .eml and `X-Unsent` outside classic Outlook, iOS HEIC conversion on upload, and typical hospital mail size limits.
- **Assumptions:** sizes, quotas, thresholds and scores are PM judgement.
- **Compliance:** nothing here is legal or privacy advice. The privacy notice and the handling of third-party approver data need legal review (B21).
- **Scope:** no app code, raid.md or backlog.md was changed, and no OneDrive or SharePoint file was touched. This file sits in `docs/pm/` as the orchestrator instructed.
- **Recommended reviewer:** Angus.
