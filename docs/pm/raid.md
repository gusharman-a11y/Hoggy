# Hoggy RAID log

Internal. DRAFT FOR ANGUS REVIEW. As at 6 Nov 2026. L = likelihood, I = impact (H/M/L). Not legal advice; items marked [ROUTE TO LEGAL] need a lawyer.

## Risks

| ID | Risk | L | I | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|
| R1 | Scraping organiser or society sites breaches their terms of service or copyright | H | H | Decision D1; prefer manual curation of facts (name, dates, URL), no copying of descriptions or logos; respect robots.txt; seek permission or a feed [ROUTE TO LEGAL] | Data curator / Angus | Open |
| R2 | Fabricated or seeded reviews mislead clinicians (offline mode shows 8 canned reviews, labelled "Sample data") | M | H | B01: remove from UI; never seed server data; trust layer B08 | Frontend | Open |
| R3 | Wrong dates cause clinicians to book travel for the wrong week; 42 rows are marked confirmed but have no recorded source | H | H | B02-B04: source and last-verified on every row, show status, audit | Data curator | Open |
| R4 | Review spam, defamation or organiser pushback on negative reviews | M | M | Verified attendees, report and moderation, takedown process [ROUTE TO LEGAL] | Backend | Open |
| R5 | "Guaranteed claim" is read as a promise of reimbursement | M | H | D6: wording is "claim-ready"; no guarantee language in app or marketing | Angus | Open |
| R6 | Receipt data is financial PII held unencrypted; breach or Privacy Act exposure | M | H | B15 encryption at rest, retention (30 days on inbox is already coded), B21 policy | Security | Open |
| R7 | Inbound email abuse (spam, oversized or malicious attachments, secret leak) | M | M | Sender checks and magic bytes exist; add allowlist and spam guard (B09); rotate secret | Backend | Partly mitigated |
| R8 | Single-process SQLite with no backups or tests; data loss or regressions | M | H | B05, B14 | Backend / QA | Open |
| R9 | Scale of curation (1,000 conferences) outruns the curator capacity | H | M | Prioritise AU/NZ, US, EU; pipeline B20; consider a volunteer society contribution form | Angus | Open |
| R10 | Affiliate or booking partners reject or delay approval | M | M | Keep deep links as fallback (already live) | Angus | Open |
| R11 | Parser errors put wrong amounts on claims | M | M | 50-receipt test set, user confirms fields before claim, show "parsed, please check" | Backend | Open |
| R12 | Competitors (society calendars, general event sites) already cover listings | M | M | Differentiate on receipts-to-claim and CPD; do not claim "largest" until counts prove it, and cite the count and date | Angus | Open |

## Assumptions

| ID | Assumption | Check |
|---|---|---|
| A1 | v1 audience is AU/NZ clinicians first, then US and EU `[ASSUMPTION]` | D7 |
| A2 | Node 22+ and SQLite are acceptable for launch scale (under 10,000 users) `[ASSUMPTION]` | Load test in B14 |
| A3 | Employers accept a PDF pack plus receipts for claims `[ASSUMPTION]` | Test with two real employer policies (B12) |
| A4 | A community-only review base is acceptable at launch, even if sparse | D2 |
| A5 | Dates in the 60 current rows came from general knowledge, not live sources `[UNVERIFIED]` | B03 |
| A6 | Pricing "priceFrom" and attendee counts are indicative only `[UNVERIFIED]` | B03 |

## Issues (found in the repo now)

| ID | Issue | Severity | Backlog |
|---|---|---|---|
| I1 | No tests, package.json or CI | High | B05 |
| I2 | No email verification or password reset; register reveals existing emails | High | B07 |
| I3 | All 60 rows lack source and verification fields; 18 dates estimated | High | B02, B03 |
| I4 | Receipt files stored only on the device; not synced | Medium | B10 |
| I5 | No FX conversion; foreign receipts only warned | Medium | B11 |
| I6 | Attachments stored but not text-extracted; parser reads email body only | Medium | B09 |
| I7 | Rate limits are in memory and reset on restart | Medium | B15 |
| I8 | Blurbs make superlative claims ("world's largest") with no source | Medium | B03 |
| I9 | Review role is hard-coded "Attendee"; no attendance check | Medium | B08 |

## Dependencies

| ID | Dependency | Owner | Due | Status |
|---|---|---|---|---|
| X1 | Outbound email provider and domain (D3) | Angus | [TBC] | Not started |
| X2 | Inbound mail MX and provider webhook (D5) | Angus | [TBC] | Not started |
| X3 | Booking or affiliate partner approval and keys (D4) | Angus | [TBC] | Not started |
| X4 | Data licence or permission from sources (D1) | Angus | [TBC] | Not started |
| X5 | OCR or PDF text library or service (B09); the zero-dependency rule may need relaxing | Backend | [TBC] | Decision needed |
| X6 | FX rate source (B11) | Backend | [TBC] | Not started |
| X7 | Hosting and HTTPS (D5) | Angus | [TBC] | Not started |
| X8 | Legal review of terms, review moderation, data use | Angus | [TBC] | Not started |

Dates are `[TBC]` because no dates have been agreed with Angus.

Review notes: Issues are from reading the repo, not from running it. Recommended reviewer: Angus.
