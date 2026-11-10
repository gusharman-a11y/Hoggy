# Hoggy round 6: the reimbursement wedge, reviewed against the code

Internal. DRAFT FOR ANGUS REVIEW. As at 7 Nov 2026. Head PM review of the owner's new direction ("remove the pain from getting conference costs reimbursed"). No app code was edited.

**Bottom line.** The direction is right, but as proposed it is the wrong order. **Today Hoggy creates double work rather than removing it.** Receipt files are trapped in one browser and cannot be downloaded or opened (PDFs). The claim pack tells the user to "attach them when you submit". So the user has to keep a second copy of every receipt somewhere else. Fix that first. Next, build one merged claim PDF (cover, schedule, then every receipt labelled in order) checked against one real employer's policy. Then build the pre-approval generator. Leave booking (item 3) and auto-forwarding (item 8) until later: they depend on partners and mail infrastructure, and many hospitals will block or forbid them. **The single input that decides whether any of this works is one real employer's claim form, study-leave form and policy document. We do not have them yet.**

How this was checked: I read app.js, server.js, parse.js, lib/pdftext.js, tests, index.html, README and docs/pm/*. I ran `npm test` (6 of 6 pass, including the new PDF text test) and counted rows in `data/conferences.js` (477 total, 377 confirmed, 0 "largest" blurbs, 1 row with `cpdVerified`). Deviations: no browser and no live server run this round, so the multi-device finding (F-C3) comes from reading the code, not from a demo.

---

## 1. The proposal against what exists

Legend: **Built** = works now. **Half** = some code exists but it does not do the job. **Claimed** = the UI or README says it, but the code does not do it. **Absent** = no code.

| # | Owner's proposal | State | Evidence in code | What is missing for the hospital side |
|---|---|---|---|---|
| 1 | Employer profile, set once | **Half** | `profile.caps` holds one flat number per category (app.js:34). Settings has "Expense caps per receipt" (app.js:224). There are no fields for employer, admin email, cost centre, employee ID, approver, form format, allowance or claim deadline | Everything except the caps. And the caps are not policy: the defaults (Meals 100, Accommodation 450, Flights 2500 ...) were **invented**, yet the Receipts page says "Caps and date windows **from your policy** are checked" with green ticks (app.js:190). **Claimed** |
| 2 | Study-leave / pre-approval request from the conference page | **Absent** | No leave, approval or request code. Trips carry only the conference dates, with no travel days or leave days (app.js:418) | All of it |
| 3 | Booking inside Hoggy | **Absent** (deep links only) | Google Flights and Booking.com links (app.js:77-84). "Log a booking" is manual: no currency, no file, and no link to the matching receipt (app.js:421) | Partner (D4). Bookings and receipts are entered twice and never reconciled, which is double work **inside** Hoggy |
| 4 | Policy checks before spend | **Absent** | Caps are checked only **after** spend, per receipt (app.js:106-107). A 3-night hotel bill of AUD 900 at AUD 300 a night is flagged against a 450 "cap" because there is no per-night logic. Meals are per receipt, not per day | Per-night, per-day, per-trip and allowance rules; a check before booking |
| 5a | Claim pack in the hospital's own form | **Absent** | `printPack` prints a generic HTML table through the browser print dialog (app.js:325-334). There is no form template | Template engine, form fill, PDF assembly |
| 5b | Receipts sorted, labelled and in the pack | **Claimed / broken** | The pack text says "Receipt files are stored in Hoggy; attach them when you submit this claim" (app.js:330). **No UI downloads or opens a receipt file**: the only `DB.get` renders image thumbnails (app.js:260). PDFs show an icon only. The backup JSON excludes files (app.js:434) | The receipts themselves. **This is the double work the owner describes, and Hoggy causes it today** |
| 5c | FX at the right rate and date | **Half** | Rate typed by hand with no date or source (app.js:303, 99). Inbound email hard-codes AUD (server.js:257, 280), so an NZD user's receipts are mislabelled | Rate date, source and method (card-statement actual vs published rate), evidence in the pack |
| 5d | One-click send to admin | **Absent** | No mailto, .eml or share code. "Mark submitted" only flips a status (app.js:429) | All of it. Note that `mailto:` **cannot carry attachments** |
| 6 | Status tracking with nudges | **Half** | Draft, Submitted and Reimbursed, derived from receipt statuses. `S.claims` stores two dates (app.js:197, 429-430). Two Home tiles sum the amounts (app.js:144) | Pre-approved, queried, approved, rejected and partly paid states; reference numbers; amount approved vs paid; deadlines; nudges. Outbound mail needs D3 |
| 7 | CPD from the same data | **Half** | "Mark attended" logs hours (app.js:420). CPD export CSV exists | Attendance certificate upload (the same file is claim evidence and CPD evidence); per-body rules (B13) |
| 8 | Auto-forward rules, nothing forwarded | **Half, not live** | Inbound webhook, private `dr-…` address and PDF text layer all work (server.js:246-282, lib/pdftext.js). It needs MX and hosting (D5) and polls only while the app is open (app.js:383). The inbox is capped at 50 items. After the app pulls an item, **the server copy is deleted** (app.js:370, server.js:234), so the browser holds the only copy | Go-live (D5). See section 2 on why hospital IT may block auto-forwarding |

### Claim-flow defects found this round

| ID | Finding | Evidence | Severity |
|---|---|---|---|
| F-C1 | Receipt files cannot be opened or downloaded from the app. The pack tells users to attach files they cannot get out | app.js:260 (only `DB.get`), app.js:330 | **Critical**: defeats the whole proposition |
| F-C2 | Server deletes the inbound file once the browser pulls it. Clearing browser data loses every receipt with no recovery | app.js:370 → server.js:234 | **Critical** |
| F-C3 | `ready()` checks only that a `fileKey` string exists. On a second device the synced receipt has the key but no file, and still shows "Ready" (code read, not run) | app.js:102, 114; README line 37 | High: a "ready" claim can have no receipts |
| F-C4 | Invented cap defaults are presented as "your policy", with green ticks | app.js:34, 190 | High: an unsupported claim in the UI |
| F-C5 | Caps are per receipt, so hotels and meals are flagged wrongly | app.js:106-107 | Medium |
| F-C6 | One claim per trip, built only after the trip. Registration paid months earlier cannot be claimed early | app.js:193-197 | Medium: many clinicians want early-bird registration repaid before travel `[ASSUMPTION]` |
| F-C7 | The parser reads no GST, ABN, "tax invoice" wording, nights or line items | parse.js:4-25 | Medium for AU employers that require a valid tax invoice `[UNVERIFIED: depends on employer policy]` |
| F-C8 | No personal-portion split (partner's flight, extra private nights) | receipt model, app.js:313 | Medium: a common reason for a queried claim `[ASSUMPTION]` |
| F-C9 | Bookings carry no currency or file and are never matched to receipts | app.js:421 | Low to Medium |

---

## 2. Challenge to the proposal

### Is it the right wedge?
**Yes, conditionally.** Discovery is crowded: society calendars and event sites already list conferences (R12). Reviews are slow to build. Reimbursement is the one recurring, money-backed pain where a clinician feels the saving every time. But the wedge only works if both of these are measurably true:

1. **The admin accepts the pack the first time.** The real cost of claiming is not filling the form. It is the query email three weeks later ("missing tax invoice", "no pre-approval", "card statement needed for the USD charge"), when the receipt is lost. If Hoggy cuts queries, it wins. If it only makes a prettier form, it loses to "just email it".
2. **The second claim is faster than emailing the hospital.** Emailing is free and needs no setup. Hoggy's setup (employer profile) is a cost the user pays up front. It is only worth it if (a) one person sets up the employer once and the whole department imports it, and (b) receipts are captured at the point of spend so there is no hunting later.

### What would make a clinician choose Hoggy over emailing the hospital
- **"How much study-leave money do I have left, and by when must I claim?"** Most clinicians cannot answer this `[ASSUMPTION]`. An allowance balance and deadline tracker is missing from the proposal, and it is the hook that brings users back between conferences.
- **A pre-approval done in two minutes from the conference page**, with the approved amount and reference carried into the claim. Approval lead times are long and a missing pre-approval is a hard rejection `[ASSUMPTION; confirm in the employer's policy]`.
- **One PDF the admin can process without opening ten emails**: cover form, itemised schedule, every receipt labelled R1, R2 ... in schedule order, FX evidence, pre-approval and attendance certificate.
- **The leftover goes to tax time.** Whatever the hospital does not reimburse (personal portions, amounts over the cap, unfunded conferences) may be relevant to the user's tax return. An export for their accountant turns the rejected part into value. This is general information only, not tax advice, and the user's adviser decides.

### What is wrongly prioritised
- **Item 3, booking inside Hoggy, should move to last.** It needs a partner (D4, R10), and partner approval takes months. Some health employers require bookings through their own contracted travel management company, which would make Hoggy booking irrelevant or prohibited for those users `[UNVERIFIED: check the first employer's policy]`. The value item 3 promises (itinerary and receipts arrive automatically) is mostly delivered by capture at point of spend plus a pre-spend policy check.
- **Item 8, auto-forward, should not be the headline.** It needs MX and hosting (D5). Many hospital mail systems block automatic forwarding to external addresses to stop data leaving the organisation `[UNVERIFIED; plausible, test with the first employer's IT]`. Clinicians who book on work email may not be able to forward at all. Personal-email forwarding plus **phone photo capture** is more reliable. Photo capture needs image OCR, which is not built (README "Not built").
- **Items 5 and 1 are the core and should come first**, but only after F-C1 and F-C2 are fixed. Today the base layer (getting the receipts back out) is broken.

### What is missing from the proposal
1. Allowance balance and claim deadline (above).
2. Personal-portion split and over-cap justification printed in the pack (never hidden).
3. Evidence types beyond "a receipt": tax invoice vs itinerary vs booking confirmation, proof of payment, card statement for foreign charges, attendance certificate, program or brochure, post-conference report if required.
4. More than one claim per trip (early registration claim, then a travel claim) and more than one employer per user (staff specialists with private practice, registrars who rotate employers each year).
5. The query and rejection loop: queried, resubmitted, partly paid, with the reason recorded.
6. Department sharing of an employer "policy pack". This is the growth loop.
7. Privacy design for employee ID and cost centre. Synced state is stored unencrypted on the server (server.js:216, R6). **Never store bank details.**

### What will fail in real life
| Reality | Consequence for the plan |
|---|---|
| Hospital claim forms are often Word, Excel or flat PDF files, or an online HR or finance portal, not fillable PDFs `[ASSUMPTION]` | A "fill the hospital's form" engine works only for fillable PDFs. Flat PDFs need coordinate overlays. Portals need an **entry sheet** (field by field, copy buttons) plus the merged receipts PDF to upload. Build the merged PDF first because it is useful in every channel |
| Head of department signature (wet or e-signature) | Hoggy cannot sign for anyone. The pack leaves a signature block and the .eml goes to the approver first if the policy says so |
| Approvals live in email chains or HR systems | Hoggy records the outcome (approved amount, reference, date, approver) entered by the user. It cannot read the HR system |
| Caps vary by city, country, seniority and award version | The rules model needs city or country tiers and an effective date, and every rule cites its clause. No defaults are shipped |
| Airline "receipts" are itineraries; hotel bills differ from the booking amount; registration invoices are not proof of payment | Evidence types and a "proof of payment" check (F-C7) |
| Foreign charges: the employer usually wants what was actually charged in AUD, shown on the card statement `[ASSUMPTION]` | FX method is a policy setting. Prefer "actual charged plus statement attached". Fall back to a published rate on the transaction date (for example RBA historical rates, free, no key `[CHECK CURRENCY]`) |
| `mailto:` cannot attach files; Gmail web cannot open .eml drafts; Outlook opens .eml as a draft only with `X-Unsent: 1` | Three send routes: .eml (desktop Outlook or Apple Mail), Web Share with the file (mobile), and download plus mailto with a prefilled body (webmail) |
| Policies change with each enterprise agreement | Policy pack versioning with an effective date; each claim is checked against the version in force on the expense date |
| Some awards pay professional development as an allowance in salary, with no employer receipts needed `[UNVERIFIED: varies by state and award]` | For those users the hospital wedge does not apply and the tax-time export is the value. **Ask the owner which model their employer uses** |

---

## 3. Prioritised build plan

All of these are buildable now with no outside accounts, except where a decision is marked **Owner**. Sizes: S under 0.5 day, M 1-2 days, L 3-5 days `[ASSUMPTION]`. New IDs C01 to C12 continue the backlog and supersede B12 and part of B10 and B11. Every item ships with tests in `npm test`, and each done-check is a command or a scripted journey whose evidence goes in the round record.

| Rank | ID | Item | Size | Owner decision needed? |
|---|---|---|---|---|
| 1 | C01 | Get receipts out and keep them safe | M | No |
| 2 | C02 | Employer profile, policy pack and rules engine | L | Real values: O1 |
| 3 | C03 | Merged claim pack PDF (cover, schedule, labelled receipts) | L | **D12 (PDF library)**; employer form: O1 |
| 4 | C04 | Pre-send validation gate and evidence fields | M | No |
| 5 | C05 | Send: .eml draft, mobile share, mailto fallback | S | No (real outbound mail is D3, not needed) |
| 6 | C06 | Study-leave / pre-approval request generator | M | Employer form: O1 |
| 7 | C07 | FX v2: method, rate date and source, evidence | M | FX method default: O4 |
| 8 | C08 | Claim status, allowance balance, deadlines and nudges | M | No (email nudges need D3) |
| 9 | C09 | Attendance certificate: one file for claim and CPD | S | No |
| 10 | C10 | Pre-spend check on the trip page ("check before you book") | S | No |
| 11 | C11 | Policy pack import and export for a department | S | No |
| 12 | C12 | Tax-time export of out-of-pocket amounts | S | No |
| Later | (3) and (8) | Booking partner; live auto-forwarding; photo OCR | XL | D4, D5, D9 extension |

### C01. Get receipts out and keep them safe (fixes F-C1, F-C2, F-C3, F-C4)
- Open and download any receipt file from the receipt row and the edit dialog. "Download all receipts for this trip" as one file (a store-only ZIP written in about 60 lines with no dependency, or folded into C03).
- Keep server-side copies of receipt files for signed-in users (finish B10). Stop deleting the server copy after pull (app.js:370). Per-user quota.
- `ready()` requires the file to be present on this device or on the server, not just a key.
- Replace the app.js:190 copy with what is true ("Checked against the caps you entered in Settings"). Remove the invented cap defaults (app.js:34) and start blank.
- **Acceptance:** a receipt added on device A opens on device B. Clearing site data and signing in again restores every file. A receipt whose file is missing shows "File missing", not "Ready". No caps are pre-filled.
- **Done-check:** an API test uploads, syncs, deletes the local copy and fetches the file again. A unit test proves `ready()` is false with a key and no file. `grep "from your policy" app.js` returns 0.

### C02. Employer profile, policy pack and rules engine
- Data model `employers[]` (more than one per user), each with: name, submission channel (email / portal / paper), claims admin email, approver chain (name, role, email, order), employee ID, cost centre(s), allowance (amount, period start and end, opening balance), claim deadline (days after expense or travel), required evidence list, FX method. Plus a **policy pack** of rules, each rule having: `type` (per-night, per-day, per-trip, per-receipt, class-of-travel, pre-approval-required, allowance), `amount`, `currency`, `scope` (category, country or city tier), `effectiveFrom`, and `clause` (document, version, section).
- `evaluate(claim, receipts, policy)` is a pure function in its own module (`lib/policy.js`, shared like parse.js). It returns issues with level, message and clause.
- Store employee ID and cost centre on the device only, or encrypted, pending O3. Never ask for bank details.
- **Acceptance:** a 3-night hotel at AUD 300 a night passes a per-night cap of 350 and fails one of 250. Meals on one day are summed against a per-day cap. Every issue shows the clause. Changing the policy pack changes the result with no code change.
- **Done-check:** at least 15 unit tests over `lib/policy.js`, including effective dates and country tiers. A fixture policy pack in `tests/fixtures/` that is not presented as any real employer's.

### C03. Merged claim pack PDF (the core deliverable)
- One PDF in this order: (1) cover. If O1 supplies a fillable PDF form, fill its fields from a JSON field map. Otherwise use a Hoggy cover sheet laid out with the employer's field names. (2) Itemised schedule: R-number, date, vendor, category, original amount and currency, FX rate, date and source, home-currency amount, GST if known, policy result and clause, personal portion excluded, justification. (3) Each receipt page stamped with a header "R3 · Accommodation · AUD 1,234.00", with images converted to pages and PDF pages copied. (4) FX evidence, pre-approval and attendance certificate. A signature block is left empty.
- Plus a portal entry sheet (HTML or CSV, one row per line with copy buttons) for employers that use a portal.
- Supports more than one claim per trip (F-C6): pick which receipts go into this claim.
- **Needs D12:** allow `pdf-lib` (MIT) or an equivalent for PDF assembly and form fill. pdfjs-dist reads PDFs but cannot write them.
- **Acceptance:** a trip with 2 PDF receipts, 2 JPG receipts and 1 foreign receipt gives one PDF. Its page count equals the cover and schedule pages plus every receipt page. The schedule total equals the CSV total equals the sum of receipts minus personal portions. Every receipt page carries its R-number. Opening the PDF in a viewer shows no errors.
- **Done-check:** a test builds the pack from fixtures, re-reads it with pdfjs (page count, R-labels present in the text layer, total string matches), and checks the AcroForm values on the fixture form.

### C04. Pre-send validation gate and evidence fields
- Receipt fields: GST amount, supplier ABN, evidence type (tax invoice, receipt, itinerary, booking confirmation, statement), paid (yes or no), nights, personal portion, justification. Extend parse.js to detect GST, ABN and "tax invoice" (best effort, user confirms).
- One "Ready to send" checklist per claim, built from `evaluate()` plus completeness checks: every booking matched to a receipt; pre-approval reference present if the policy requires it; spend inside the approved amount and dates; inside the claim deadline; allowance balance sufficient; required evidence present. Blockers stop C05. A warning can be overridden only with a justification, and that justification is printed in the pack.
- **Acceptance:** each blocker type has a fixture that triggers it, and fixing it clears it. An override appears in the schedule.
- **Done-check:** unit tests per rule. Scripted journey 4 (rewritten, see section 4) passes in a browser.

### C05. Send without an email provider
- `.eml` draft download (multipart/mixed, pack PDF base64-attached, `X-Unsent: 1`). To: claims admin, or the approver first if the chain says so. Subject from a template: "Expense claim – {name} – {employee ID} – {conference} – {dates}". On mobile, `navigator.share({ files })` with the PDF. For webmail, `mailto:` with a prefilled body plus a visible "attach the downloaded PDF" step.
- Hoggy records "sent" only when the user confirms. Copy must never say "sent by Hoggy".
- **Acceptance:** the .eml opens as an editable draft in desktop Outlook and Apple Mail with the attachment. Share works on iOS Safari and Android Chrome.
- **Done-check:** a test parses the generated .eml (headers, boundary, attachment decodes byte-identical to the PDF). A manual check on two mail clients is recorded with screenshots.

### C06. Study-leave / pre-approval request generator
- A "Request study leave" button on the conference detail and trip pages. It pre-fills conference name, organiser, sourced URL, dates (marked "estimated" if `datesConfirmed === false`), city, travel days (configurable buffer), working days of leave (weekends excluded; public holidays from a bundled state list, `[CHECK CURRENCY]` per year), and cost estimates by category entered by the user. The indicative `priceFrom` is shown only as a hint labelled "indicative, US$". Each estimate is checked against C02. A CPD justification draft comes from a template the user edits. Hoggy never invents CPD hours: if `cpdVerified` is false it writes "CPD credits to be confirmed with the organiser". Also a roster-cover note and the approver chain.
- Output: the employer's leave form (C03 engine) or a Hoggy request letter, sent by C05. Records the status, reference and approved amount, and C04 uses that amount as the claim limit.
- **Acceptance:** from the conference page to a downloadable request takes under 2 minutes with a filled employer profile (timed in the browser). An estimated-date conference prints the "estimated" warning. A request over a cap shows the clause before generation.
- **Done-check:** a unit test of the leave-day calculation (spanning a weekend and a public holiday). A pack test re-reads the generated request.

### C07. FX v2 (supersedes B11)
- Per policy: "actual charged" (user enters the home-currency debit, statement attached as evidence) or "published rate on transaction date" (a bundled historical rate table refreshed by a script from a free public source such as RBA, `[CHECK CURRENCY]`, no key). Store rate, date, source and method. Inbound currency defaults to the profile currency (server.js:257, 280).
- **Acceptance:** a USD receipt shows rate, date, source and method in the schedule and CSV. An NZD user's inbound receipt is labelled NZD.
- **Done-check:** a unit test with a fixed rate table. An API test of the inbound currency.

### C08. Claim status, allowance and nudges
- States: draft, pre-approval requested, pre-approved, submitted, queried, approved, paid, partly paid, rejected. Each has a date, reference, amount and note. The allowance balance moves on approval and payment.
- Nudges without email: Home tiles ("2 claims past the expected payment date", "claim deadline in 14 days", "AUD x of allowance left until 30 Jun"), an `.ics` reminder download, and a prefilled follow-up .eml to the admin. Real email nudges wait for D3.
- **Acceptance:** status history shows every transition. A partly paid claim reports the outstanding amount. A claim older than the deadline goes red.
- **Done-check:** unit tests of the state machine and balance. An ICS test (parses, correct date).

### C09. Attendance certificate, shared by claim and CPD
- Upload on the trip. It is listed as claim evidence (C03) and attached to the CPD entry. Hours come from the certificate as entered by the user, never from a typical figure.
- **Acceptance and done-check:** one upload appears in both the pack and the CPD export. Test.

### C10. Pre-spend check on the trip page
- "Check before you book": enter a nightly rate or a fare and get green, amber or red against the policy pack, with the clause. This is the owner's item 4 without a travel partner.
- **Acceptance and done-check:** fixture rates around each cap give the right result. Unit test.

### C11. Policy pack import and export
- Export the employer's policy pack (no personal fields) as a file. Import it on another account. Version and effective date shown.
- **Acceptance and done-check:** round-trip test. The exported file contains no employee ID, cost centre or email of the exporter.

### C12. Tax-time export
- Per financial year (1 Jul to 30 Jun for AU): spent, reimbursed, personal portion and out-of-pocket, as CSV. Labelled "for your accountant; general information, not tax advice".
- **Done-check:** fixture totals reconcile with C08.

### Decisions and inputs needed from the owner

| ID | Decision or input | Blocks | Recommendation |
|---|---|---|---|
| **O1** | **One real employer:** claim form file(s), study-leave form, the policy document (with version), the submission channel (email or portal), and one de-identified example of a claim that was queried or rejected, with the reason | Real value of C02, C03, C06; the acceptance test | Supply now. Without it we build against a fixture and ship a generic cover sheet |
| O2 | Five clinicians and one claims admin at that employer to run the acceptance test | Measuring "accepted first time" | Recruit from the owner's department |
| **D12** | Allow `pdf-lib` (or equivalent) as a second runtime dependency | C03, C06 form fill | Yes. The zero-dependency rule already gave way for pdfjs-dist (D9) |
| O3 | Where employee ID and cost centre may live (device only, or server encrypted) | C02 | Device only until B15 encryption lands |
| O4 | Default FX method | C07 | "Actual charged plus statement", with published rate as fallback |
| O5 | Is the employer's professional development money an allowance paid in salary or a reimbursement? | Whether the wedge applies at all to that cohort | Answer before C06 |
| D3, D4, D5 | Outbound mail, booking partner, hosting and MX (open since round 1) | Email nudges, item 3, item 8 | Unchanged; not needed for C01 to C12 |
| 50 receipts | Angus's 50 real, redacted receipts (open since round 4) | Receipts score 4 | Still needed |

---

## 4. North star rescore

### Baseline as at 7 Nov 2026 (code read; no data re-sample; no browser)
Changes since round 4 that I verified in code: PDF text layer read on inbound (lib/pdftext.js, test passes). Verified attendee now decided on the server from a `proofs` row written by the inbound webhook (server.js:226, 273-277), not from client state. Copy-lint fires and 0 blurbs say "largest". The pack no longer says "attached on submission". "Mark attended" no longer pre-fills a typical figure (app.js:420). The index.html description no longer says "never lose". The F-C1 to F-C4 defects are new.

| # | Dimension | R4 | Now | Why |
|---|---|---|---|---|
| 1 | Coverage | 2 | **2** | 477 rows, 43 before 1 Mar 2027, AU 30 of 55 confirmed |
| 2 | Data quality | 3 | **3** | Superlatives gone and CPD hidden unless sourced (1 row); quote field and validator still absent |
| 3 | Review trust | 3 | **3** | Server-side proof now real (F8 closed in code, not re-proved live); no email verification |
| 4 | Travel | 2 | **2** | Unchanged |
| 5 | Receipts to claim | 3 | **3, borderline 2** | PDF text is real progress. But a pack without the receipts, plus files that cannot leave the browser, fails the new direction outright |
| 6 | CPD | 2 | **2** | Guess removed from the attend dialog; no rules, certificates or college export |
| 7 | UX | 3 | **3** | Journeys not run in a browser |
| 8 | Security and privacy | 3 | **3** | Unchanged; C02 adds PII to protect |
| 9 | Reliability | 2 | **2** | 6 tests; no restore test, CI run or monitoring |

**Overall: 23 of 45, unchanged. North star NOT MET.**

### What each build item adds (existing checklist, `[ASSUMPTION]` PM judgement)

| Item | Dimension moved | Adds | Condition |
|---|---|---|---|
| C01 | Receipts | Holds 3 (removes the borderline 2) | None; prerequisite for every other point |
| C02 + C04 | Receipts ("policy checks") | Part of +1 | Real policy pack from O1 |
| C03 + C05 | Receipts ("pack export") | Part of +1 | D12 |
| C07 | Receipts ("FX") | Part of +1 | None |
| C01-C05 + C07 together | **Receipts 3 to 4** | **+1** | **Also needs the 50-receipt set at 90%** (owner). Without it, Receipts stays 3 |
| C09 (+ B13 for one body) | **CPD 2 to 3** | **+1** | B13 rules for one body (D7) |
| C06, C08, C10, C11, C12 | None on the current checklist | +0 | The checklist does not reward pre-approval, status, pre-spend checks or allowance tracking; see the amendment below |
| Tests shipped with C01-C12 | Reliability | +0 alone | Reliability reaches 3 only with the restore test and a green CI run (B34, B05) |
| Browser run of rewritten journeys 3 and 4 | UX | +0 | Holds 3; it is a gate, not a gain |
| C02 with PII handled per O3 | Security | 0, or **-1** if employee IDs sit unencrypted on the server | O3 |

**Projected: 25 of 45** with C01 to C09, D12, O1, the 50 receipts and B13 for one body. **24 of 45** without the owner's inputs (CPD only). **The claim pivot cannot meet the north star by itself.** It moves 2 of 9 dimensions, and the other gaps (coverage, data evidence, email verification, reliability) are unchanged.

### Proposed amendment to the north star (for Angus to decide)
The current dimension 5 measures parsing and exporting, not what the owner now cares about. Proposed replacement: **"Claim to reimbursement"**. Target: on 10 real claims at one employer, (a) at least 90% accepted by the claims admin with no query, (b) median clinician time from trip end to claim sent under 5 minutes, (c) every pack contains every receipt, (d) pre-approval generated from the conference page, (e) status tracked to paid with the allowance balance. Under that measure today's score is **1** (stub). C01 to C08 plus O1 and O2 would take it to 3, and to 4 once the admin acceptance rate is evidenced.

---

## Biggest objection
The plan's success depends on something we do not hold: one real employer's forms, policy and claims admin. Until O1 and O2 arrive, the team would be building an "in the hospital's own format" feature with no format, and checks against a policy nobody wrote. The safe path is to build C01 now (it is broken regardless), build C02 to C05 against a neutral fixture, and refuse to call any of it "works with your hospital" until one real admin has accepted ten real packs.

## Round record
Round 6 (PM review only), 7 Nov 2026. Items claimed: none (review round). Gates: automated PASS (6 of 6 tests); journeys NOT RUN; copy FAIL (F-C4). New risks for raid.md (not edited): R25 receipts trapped on one device (F-C1, F-C2); R26 hospital IT blocks auto-forwarding; R27 employer forms are not fillable or are portal-only; R28 employee PII in synced state; R29 policy versions drift after each enterprise agreement. New assumption A7: claims admins accept one merged PDF (replaces A3; test with O2). New backlog items C01 to C12; B12 is superseded by C02 to C05; B10 is folded into C01; B11 is superseded by C07.

Review notes: Sources are the repo files cited by line (read 7 Nov 2026) and `npm test` output. No web sources were used. Hospital practice statements are marked `[ASSUMPTION]` or `[UNVERIFIED]` because no employer policy has been supplied. The RBA rate source and public-holiday lists are `[CHECK CURRENCY]`. Nothing here is legal or tax advice: C12 is an export for the user's adviser, and any wording about reimbursement entitlements needs the employer's policy. Sizes and scores are PM judgement `[ASSUMPTION]`. No app code, data, raid.md or backlog.md was modified, and no OneDrive or SharePoint file was touched. This file was written in the project's `docs/pm/` folder as instructed by the orchestrator, not in `AI_TEAM\outputs`. Recommended reviewer: Angus.
