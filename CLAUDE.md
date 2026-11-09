# StudyLeave — project brief (working name)

A web app for doctors: find a medical conference, get the trip approved, book
flights and a hotel, collect every receipt, and send the hospital one claim
pack (a single PDF) by email. Sold to doctors first, hospitals later.
Launch market: Australia (NSW Health style study-leave claims).

This is NOT the Bondi Surf Rentals repo. Nothing here touches it.

## North star (definition of done for v1)
One automated Playwright test (`npm run e2e`) walks the whole journey and passes:
1. A doctor signs up and joins their hospital (organisation) with an org code.
2. They search conferences, open one, and click "Plan trip".
3. They submit the trip for approval; a manager logs in and approves it.
4. The doctor books a flight and a hotel (test-mode providers); a receipt
   for each appears on the trip automatically.
5. They upload one extra receipt (e.g. a taxi, PDF or image).
6. They click "Send claim": the hospital's finance address receives ONE email
   with ONE PDF attached = cover sheet + filled claim form + every receipt.
7. Their study budget shows the trip as spent.

## Stack (decided — do not change without a strong reason)
- Next.js (App Router) + TypeScript, `src/` layout. Server actions / route handlers.
- Database: Node's built-in `node:sqlite` (`DatabaseSync`), file `data/app.db`
  (tests use `:memory:` or a temp file). No native npm DB drivers.
  Migrations: numbered SQL files in `src/db/migrations/NNN_name.sql`, applied
  in order by `src/db/migrate.ts`, tracked in a `_migrations` table.
- Tests: Vitest (`npm test`). E2E: `@playwright/test` pinned to **1.63.0**
  (matches the preinstalled Chromium). Pass `--trace off`.
- PDFs: `pdf-lib`. Styling: plain CSS modules / a small global CSS; no UI kit.
- Quality gate for every commit: `npm run typecheck && npm run lint && npm test`.

## External services — always behind an interface with a mock
| Concern | Interface | Dev/test implementation | Real one (env-gated, later) |
|---|---|---|---|
| Flights | `FlightProvider` | `MockFlightProvider` (deterministic) | Duffel (`DUFFEL_TOKEN`) |
| Hotels | `HotelProvider` | `MockHotelProvider` | Expedia Rapid / Hotelbeds |
| Payment | `PaymentProvider` | `MockPayment` (always succeeds in test) | Stripe |
| Email out | `Mailer` | `OutboxMailer` → `outbox` table, viewable at /outbox | SMTP / Resend |
| Conference data | `ConferenceSource` | fixtures + schema.org JSON-LD extractor | live fetch via `npm run ingest` |

Never call a real paid API in tests. Never commit secrets. Seed conference
data is labelled SAMPLE — never invent real-looking dates for real events.

## Conventions
- Money is stored as integer cents with a currency code (AUD default).
- Every row that belongs to a hospital carries `org_id`; queries filter by it.
- Roles: `doctor`, `manager`, `finance`, `admin` (per org).
- Uploaded files live in `data/uploads/` (git-ignored); DB stores the path.
- Keep pages simple, mobile-friendly, plain English.

## Ralph
Built by the Ralph loop (`scripts/ralph/`): one user story per iteration,
stories and status in `scripts/ralph/prd.json`, learnings in
`scripts/ralph/progress.txt` (read its Codebase Patterns section first).

## North star v2 — receipts (added after v1)
Doctors pay themselves and get reimbursed; the hospital needs real tax
invoices. Hoggy never reads bank accounts or whole inboxes. Two ways in:
1. **Snap/upload** a receipt → the `ReceiptReader` fills in supplier, ABN,
   GST, amount, date → doctor confirms.
2. **Forward** an email to their personal address `inbox-<code>@in.studyleave.app`
   → Hoggy reads it, matches it to the right trip, doctor confirms.
   Unmatched (e.g. personal holidays) go to a private Unfiled area and are
   deleted after 7 days. A checklist + tax-invoice check make every claim complete.
`ReceiptReader`: Mock in dev/tests; Claude (ANTHROPIC_API_KEY) for real.
