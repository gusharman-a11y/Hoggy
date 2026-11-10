# Hoggy review checklist (run each round)

Internal. The orchestrator runs this after every build round and records pass or fail per line. A round passes only if all Gate items pass. Record the date, commit or file state and the backlog IDs claimed done. Update the scores in north-star.md when a dimension moves.

## 0. Scope and process (Gate)

| Check | Pass | Fail |
|---|---|---|
| Only the backlog items claimed this round changed | Diff matches the claimed IDs | Unrelated edits |
| Each claimed item meets its done-check in backlog.md, with evidence (command output or screenshot) | Evidence attached | "Done" without evidence |
| No decision from D1-D7 was assumed as made | None assumed | Code or copy presumes a partner, key or licence |

## 1. Automated (Gate)

| Test | How | Pass |
|---|---|---|
| Server starts | `node server.js` on a temp `HOGGY_DATA` dir | Listens, no errors |
| Data validator | `node scripts/validate-data.js` (once B02 lands) | Exit 0; counts printed |
| Unit and integration tests | `npm test` (once B05 lands) | All green, none skipped or deleted |
| Syntax | `node --check` on server.js, app.js, parse.js | Exit 0 |

## 2. Data quality (sample 10 rows chosen at random each round)

| Check | Pass | Fail |
|---|---|---|
| Date matches the organiser's page | 10/10 | Any mismatch (stop and raise R3) |
| `sourceUrl`, `lastVerified`, `dateStatus` present | 100% | Any missing |
| No event dated before today shown as upcoming | 0 | Any |
| Duplicates, bad lat/lng, unknown specialty or country code | 0 | Any |
| Coverage counts reported: conferences, specialties, countries, regions, with date | Reported vs target | Not reported |
| No copied organiser text or logos beyond facts | None | Copied content (R1) |

## 3. Review trust

| Check | Pass | Fail |
|---|---|---|
| Fresh DB: a conference with no reviews says so | "No reviews yet" | Any invented review |
| Offline mode shows no canned reviews | Zero | Canned text visible |
| Post, edit, delete, report flows work; one review per user | Work | Any break |
| Unverified user blocked from posting (after B07, B08) | Blocked | Allowed |
| Review text is escaped | `<script>` shown as text | Executes |

## 4. Journeys (manual, browser, desktop and 360 px)

1. Discover: find "cardiology, Europe, next 6 months" in under 30 seconds; open detail; dates, status and source visible.
2. Plan a trip: flight and hotel links open with correct city and dates; ICS exports (after B16).
3. Receipts: send a test email to the user's address via the webhook with a PDF; it appears within 60 seconds; fields parsed; spam message creates nothing.
4. Claim: a trip with one bad receipt shows red; fix it; pack exports; CSV matches the receipt list; foreign currency handled (after B11).
5. CPD: add an entry; the total and the college export are correct.

Pass: all five journeys finish without error. Fail: any dead end, console error or wrong figure.

## 5. Security (SEC runs; Gate for any change touching auth, files or email)

| Check | Pass |
|---|---|
| Mutating call without `X-Requested-With: hoggy` | 403 |
| Another user's file, receipt or state | 404 or 401, never data |
| Inbound webhook without or with wrong secret | 401 |
| Oversized body, bad magic bytes, 6th attachment | Rejected or ignored |
| Login brute force | 429 after limit |
| Register with existing email (after B07) | Same response as a new email |
| CSP present; no inline script; no secrets in client code or logs | Yes |
| Receipts and PII absent from logs | Yes |

## 6. Reliability and performance

| Check | Pass |
|---|---|
| Restart keeps users, state, reviews, inbox | Data intact |
| Concurrent state PUT from two devices | 409 conflict, no silent overwrite |
| Discover with 1,000 rows | Filter responds in under 200 ms; first load under 3 s on throttled 4G |
| Backup and restore (after B14) | Restores on a clean machine |

## 7. Copy and compliance

| Check | Pass |
|---|---|
| No "guaranteed", "world's largest" or "best" without a cited, dated source | None found |
| Australian English in UI copy | Yes |
| Estimates marked and dated; figures carry unit and date | Yes |
| No client or personal data in the repo, fixtures or screenshots | None |

## Round record (copy per round)

Round N, date, items claimed, gates passed or failed, new risks added to raid.md, north-star scores changed, decisions needed from Angus.
