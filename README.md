# StudyLeave

A web app for doctors' study leave. A doctor finds a medical conference,
plans the trip, gets it approved by their manager, books a flight and a
hotel, collects every receipt in one place and sends the hospital **one
claim pack** (cover sheet + filled claim form + every receipt, as a single
PDF) by email. Finance marks it paid, and the doctor's study budget shows
the trip as spent. Built for Australian public hospitals (NSW Health style
claims) first.

> **Status: working prototype, not live.** Flights, hotels, payments,
> outgoing email and the conference list are all mocked or sample data —
> see [What is mocked](#what-is-mocked). Nothing books, charges or emails
> anyone for real.

## Quick start

Needs Node 22.5+ (uses the built-in `node:sqlite`).

```bash
npm install
npm run seed      # demo hospital (join code DEMO2026) + SAMPLE conferences
npm run dev       # http://localhost:3000
```

The database is a single file, `data/app.db` (override with
`DATABASE_PATH`); uploaded receipts go to `data/uploads/` (`UPLOADS_DIR`).
Both are git-ignored. Delete them to start again, then re-run the seed.

### Demo logins

| Who | Email | Password | Sees |
|---|---|---|---|
| Manager | `manager@demo.test` | `password123` | Approvals, Team budgets |
| Finance | `finance@demo.test` | `password123` | Claims (mark paid) |
| Doctor | sign up at `/signup` with join code **`DEMO2026`** | your own | My trips, Dashboard |

Choosing "new hospital" at sign-up instead creates a hospital (with its own
join code) and makes you its admin (Approvals, Claims, Team and Settings; set the finance email under
Settings).

### The journey

1. **Conferences** — search, open one, click **Plan trip** (creates a draft).
2. Fill in the estimates, **Submit for approval**. The manager is emailed
   and approves or rejects (with a comment) from **Approvals**.
3. Once approved: **Find flights** / **Find hotels** and book. Each booking
   adds a PDF receipt to the trip.
4. Add other receipts: upload a PDF/JPG/PNG, or forward the email to the
   trip's own address. Any receipt's description and amount can be edited
   until the claim is sent.
5. **Send claim** — finance gets one email with one PDF; you are cc'd.
6. Finance marks it paid; the **Dashboard** budget shows the trip as spent.

Every email the app "sends" is stored and shown at **`/outbox`**.

### Checks

```bash
npm run typecheck && npm run lint && npm test   # quality gate (Vitest)
npm run build
CI=1 npm run e2e                                # Playwright, incl. e2e/north-star.spec.ts
```

E2E starts its own dev server on port 3100 with a fresh temp database and
uses Chromium at `/opt/pw-browsers/chromium` (`@playwright/test` 1.63.0).
No test touches the network.

## What is mocked

Every outside service sits behind an interface in `src/providers/` or
`src/lib/mailer.ts`. Without the env var below, the mock is used.

| Concern | Today (mock) | To go live | Env var | State of the real code |
|---|---|---|---|---|
| Flights | `MockFlightProvider`: 3 made-up, deterministic AUD fares; fake booking refs | [Duffel](https://duffel.com) (or a travel agent / TMC API) | `DUFFEL_TOKEN` | Search written (untested against the live API); **booking throws — not built** |
| Hotels | `MockHotelProvider`: 3 made-up hotels near the venue | Expedia Rapid, Hotelbeds or similar (needs an approved partner account) | `EXPEDIA_RAPID_KEY` | Stub only, throws |
| Payment | `MockPayment`: always succeeds, no money moves | Stripe (or the hospital's corporate card / travel account) | `STRIPE_SECRET_KEY` | Stub only, throws |
| Email out | `OutboxMailer`: saved to the `outbox` table, shown at `/outbox`. **No email leaves the app** — finance never really receives a claim | SMTP, Resend, Postmark or SES, on a verified sending domain (SPF/DKIM) | `SMTP_URL` | Stub only, throws |
| Email in (receipts) | `POST /api/inbound` works, but nothing routes `*@in.studyleave.app` to it | An inbound-mail provider (Postmark, Mailgun, SendGrid Inbound Parse) + MX records for the domain | `INBOUND_SECRET` | Real handler; needs a provider adapter for its payload format |
| Conferences | SAMPLE fixtures (names start "SAMPLE –", `example.org` links) — **not real events or dates** | Real sources added with `npm run ingest -- add URL` (schema.org JSON-LD pages), checked by a human; permission/terms of each site | — | Ingest runner works; no real sources added |
| Currency | Static indicative rates to AUD (`src/lib/fx.ts`), only to prefill estimates | A rates feed if needed | — | — |
| Claim form | A generic study-leave form drawn by `pdf-lib`, per-hospital field list in `orgs.claim_form_json` | Each hospital's actual form layout / approval | — | — |

Also set `APP_URL` (links in emails; default `http://localhost:3000`).

## What is needed to go live

- **Travel booking is regulated.** Selling flights in Australia generally
  means being (or partnering with) an accredited travel agent: IATA
  accreditation or a host agency/consolidator, and an aggregator such as
  Duffel acting as merchant of record. Hotels need a wholesaler/partner
  agreement. Expect ticketing, changes, refunds and cancellations to need
  real code and customer support. Many hospitals already mandate a travel
  management company (TMC) — integrating with theirs may be the simpler
  path. Get legal advice before taking payment for travel.
- **Payments:** finish `StripePayment` (or decide the hospital pays
  directly) — refunds and failed payments are not handled.
- **Email:** a real `Mailer` with a verified domain; inbound mail routing.
- **Hosting:** the app uses one SQLite file and local disk for uploads, so
  it needs a single server with a persistent volume and backups (not
  serverless), or a move to Postgres + object storage.
- **Security & privacy:** passwords are hashed and sessions are httpOnly
  cookies, but there is no password reset, email verification, rate
  limiting, 2FA or audit log. Receipts contain personal and financial
  data: Australian Privacy Principles, hospital IT/security review, data
  hosted in Australia, retention rules.
- **Real conference data** with permission, and each hospital's real claim
  form and finance address.

## Adding conference sources

Conferences can be loaded from any web page that publishes schema.org
JSON-LD events (`Event`, `EducationEvent`, `EventSeries`, ...). Pages to read
are kept in the `sources` table.

```bash
npm run ingest -- add https://example.org/events   # add one or more pages
npm run ingest -- list                             # show sources + last status
npm run ingest                                     # fetch every source now
```

What a run does, for each source:

1. Reads the host's `robots.txt` once per run (as `StudyLeaveBot/0.1`). A
   404 means "allowed"; a 5xx or network error skips that host for the run.
   Disallowed pages are not fetched (status `blocked by robots.txt`).
2. Waits at least 2 seconds between requests to the same host.
3. Fetches the page with the User-Agent `StudyLeaveBot/0.1`, extracts events
   (`src/ingest/extract.ts`) and upserts them (`src/ingest/upsert.ts`): the
   same name + start date updates the existing conference instead of
   duplicating it, and blank fields never wipe known values.
4. Records `last_fetched_at`, `last_status` (`ok`, `http 404`,
   `blocked by robots.txt`, `error: ...`) and `events_found`.

The runner lives in `src/ingest/runner.ts`; `fetch`, `sleep` and the clock
are injectable, so tests use a fake web and never touch the network. Uses
`DATABASE_PATH` or `data/app.db`.

## Receipts by email (inbound webhook)

Each trip shows an address `trip-<code>@in.studyleave.app`. Point your mail
provider's inbound webhook at `POST /api/inbound` with header
`x-inbound-secret: $INBOUND_SECRET` and a JSON body
`{to, from, subject, attachments: [{filename, contentType, base64}]}`.
PDF/JPG/PNG attachments become receipts (source `email`, amount 0,
description = subject; the doctor edits the amount on the trip page) only when `from` is the trip owner's email.
Without `INBOUND_SECRET` set, every request is rejected (401). Replies:
201 stored, 400 bad JSON, 404 no trip for that sender/address, 409 claim
already sent, 413 too large, 422 no usable attachments.
