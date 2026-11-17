# Hoggy

Medical conference scanner: discover conferences, plan trips, forward receipts, claim expenses, track CPD.

## Run

```
npm install             # runtime dependencies: pdfjs-dist (reads PDF receipts), pg (Postgres, used only when DATABASE_URL is set)
node server.js          # Node 22+; SQLite in data-store/ unless DATABASE_URL is set
```

Open http://127.0.0.1:8123. Without the server (any static host) the app still works in offline mode, with data on the device only.

## Backend (server.js)

- Accounts (scrypt, HttpOnly session cookie, rate-limited login/register; limits are stored in the database so every instance counts the same attempts), CSRF header check on every mutating call. Passwords need at least 10 characters (shown under the field).
- `GET/PUT /api/state` — per-user sync with revision conflict detection.
- Reviews belong to a conference **series** (every edition), keyed by `lib/series.js` (organiser tag + name with years, ordinals and edition numbers removed). One review per user per series per year attended (up to 10 years back), five ratings (content and speakers, networking, venue and organisation, value for money, CPD worth) and a comment of up to 600 characters.
  - `GET /api/reviews?series=<key>` (or `?conf=<id>`), `GET /api/ratings` (per series), `GET /api/my-reviews`; `POST /api/reviews` `{series, editions:[{year, city}], ratings, text}` adds one or more years at once; `PUT`/`DELETE /api/reviews/<id>` (author only); `POST /api/reviews/<id>/report`.
  - `POST /api/reviews/<id>/proof?kind=certificate|cpd|receipt` (PDF/JPG/PNG, 5 MB, magic bytes checked). Proof files are never served publicly: only `GET /api/admin/proofs/<id>/file` returns them, and they are deleted once an admin approves or rejects.
  - Share link `/#/review/<seriesKey>` opens the review form (sign-in first if needed).
- `GET /api/courses` — course catalogue and upcoming sessions from `data/courses/catalogue.json` and `sessions.json` (bundled static files, like `data/conferences.js`; finished sessions are dropped; ETag). Without the server the app reads the same two files. Certificates ("My certificates") live in the synced state (`certs`), their files in the receipt file store (`c-` keys). Expiry comes from the catalogue's sourced validity (APLS 5 years, ALS 4 years), otherwise the user types it; reminders are in-app only (email needs D3). Check the data with `node tools/check-courses.js` (also run by `npm test`).
- `POST /api/inbound/email` with header `X-Hoggy-Secret` (or HTTP Basic, password = secret) — inbound-email webhook (Postmark-style JSON, or `{to,from,subject,text,attachments}`). Matches `dr-<token>@receipts.hoggy.app` to a user, parses the receipt, stores the attachment, and the app pulls it into Receipts within a minute.
- Storage goes through `lib/db.js`: **Postgres** when `DATABASE_URL` is set (production, see below), otherwise **SQLite** in `data-store/` (SQLite file, daily backups, inbound secret). Back that folder up; do not publish it.

### Live global database (constantly updated)

The server keeps conferences in SQLite (seeded from `data/conferences.js`, new ids only) and serves them at `GET /api/conferences`; the app loads that list, falling back to the bundled file offline.

Start with `HOGGY_INGEST=1 HOGGY_ADMINS=you@example.com HOGGY_ADMIN_KEY=<long random string> node server.js` (the admin key is mandatory: without it all admin endpoints are disabled) to enable the updater (runs 30s after start, then every 6h):
- **Refresh:** re-checks each conference's organiser page (robots.txt respected, https only, private addresses blocked, polite delays). When the page publishes schema.org Event JSON-LD or iCal that matches, dates update automatically. Dead links (3 strikes) and cancelled/postponed wording flag the conference with a warning in the app.
- **Discover:** polls `data/sources.json` (journal, society and publisher feeds: iCal, RSS, JSON-LD, Crossref) and queues unknown events as candidates. Nothing external goes live until an admin approves it at `/admin.html` (the Data desk).
- `node tools/merge-shards.js` merges curated JSON shards; `node tools/check-sources.js` writes an offline freshness report.

### Go live checklist

1. Host behind HTTPS with `HOST=0.0.0.0` behind a reverse proxy (cookies are `Secure` automatically unless HOST is loopback; set `HOGGY_TRUST_PROXY=1` so rate limits use the real client IP, and add HSTS at the proxy).
2. Point an MX record for your mail domain at an inbound-email provider (e.g. Postmark inbound) and have its webhook send `X-Hoggy-Secret: <HOGGY_INBOUND_SECRET>` (or Basic auth with that as the password) to `https://<host>/api/inbound/email`. Set `HOGGY_MAIL_DOMAIN` to that domain. Without `HOGGY_INBOUND_SECRET` the server makes one: SQLite keeps it in `data-store/inbound-secret.txt`, Postgres in `hoggy.meta` (key `inbound_secret`).

Known gaps: no email verification or password reset (needs outbound mail), so registration reveals whether an email exists and reviewers are not email-verified.
3. Receipt files are stored per device (IndexedDB); synced state covers trips, receipts metadata, CPD and settings.

## Deploying to Vercel

`vercel.json` sends every path to one Node 22 function (`api/index.js`, which reuses the handler from `server.js`). Locally nothing changes: `node server.js` still listens as before.

- Import the repo in Vercel; Framework Preset **Other**. Leave build, output and install settings at their defaults (`vercel.json` sets them; the empty `public/` output stops Vercel publishing the source tree as static files). Node.js version 22.x (from `package.json`).
- When `VERCEL` is set, the server marks cookies `Secure`, trusts `X-Forwarded-For`, never runs the updater (`HOGGY_INGEST` is ignored) and skips local backups. Functions run in Sydney (`"regions": ["syd1"]` in `vercel.json`), next to the Supabase database in ap-southeast-2: every request makes a few database round trips, so keep the two in the same region.
- **With `DATABASE_URL` set** (production) all data lives in Postgres and is shared by every instance. **Without it** the server falls back to SQLite in `/tmp/hoggy-data`, which is per instance and wiped when the instance is recycled (accounts vanish, sign-ins fail on another instance); the site then shows a small "Preview — accounts and receipts reset" notice. The notice disappears as soon as `DATABASE_URL` is set (it can be forced locally with `HOGGY_DEMO=1`).
- Request bodies on Vercel are limited to 4.5 MB, so proof uploads and receipt files above that size are refused by Vercel before they reach the app (the app's own caps are 5 MB and 16 MB).

## Production database (Supabase)

Postgres on Supabase (project `ipnkzavrbfzuphicycuc`, region ap-southeast-2). Everything lives in the schema `hoggy`; every table has row level security **on with no policies**, and `anon` / `authenticated` have no grants, so the public Data API (anon key) sees nothing. The server connects as `postgres`, which bypasses RLS.

1. **Schema.** Apply `db/postgres/001_init.sql` once (Supabase SQL editor or the Supabase tools). It is idempotent. The server runs the same file again on its first cold start (it records the file's hash in `hoggy.meta` and skips it afterwards; an advisory lock stops two instances running it at once), so applying it by hand first is optional but recommended.
2. **Vercel env vars** (Project, Settings, Environment Variables, Production; then redeploy):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Supabase, Connect, **Transaction pooler** URI (port **6543**): `postgresql://postgres.ipnkzavrbfzuphicycuc:<db-password>@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres` (copy the exact host from the dashboard) |
   | `HOGGY_INBOUND_SECRET` | a long random string (`openssl rand -hex 24`); the inbound-email provider sends it as `X-Hoggy-Secret` |
   | `HOGGY_ADMIN_KEY` | a long random string; admins send it as `X-Admin-Key` at `/admin.html` |
   | `HOGGY_ADMINS` | comma-separated admin emails, e.g. `you@example.com` |
   | `HOGGY_PG_CA` (optional) | Supabase's CA certificate (PEM text, Database Settings, SSL) to verify the server certificate; without it the connection is encrypted but the certificate is not checked |

3. Redeploy and open `/healthz`: it should say `"db":"pg"` and the conference count. The "Preview" notice is gone.

Notes:
- Transaction pooler: the server only uses unnamed statements (node-postgres `pg`, no prepared-statement names) and qualifies every table with the schema instead of relying on `search_path`, so PgBouncer/Supavisor transaction mode is fine. Tested through PgBouncer in transaction mode with `max_prepared_statements = 0`.
- Conferences are seeded from `data/conferences.js` only when the file changes (its hash is kept in `hoggy.meta`, key `conf_seed_hash`); admin edits are never overwritten.
- Sessions, rate limits (`hoggy.rate_hits`, hashed keys), the inbound secret (when the env var is missing) and files all live in the database, so any instance can serve any request. Scores (`/api/ratings`) are cached per instance for 15 s; the conference list is re-checked every 10 s.
- Receipt files and proof-of-attendance uploads are stored as `bytea` (16 MB and 5 MB caps; proofs are deleted once an admin decides). Supabase Storage (private bucket) is the better long-term home once volumes grow.
- Optional: `HOGGY_PG_SCHEMA` (default `hoggy`), `HOGGY_PG_POOL` (connections per instance, default 3).
- Backups: Supabase's daily backups cover the database; the SQLite backup job does not run with Postgres.

### Tests

- `npm test` runs everything on SQLite (a `DATABASE_URL` in your shell is ignored).
- `npm run test:pg` runs the same suite plus `tests/pg.test.js` against a **local** Postgres (each server gets a throwaway schema): `createdb hoggy_test`, then `HOGGY_TEST_DATABASE_URL=postgres://postgres:<pw>@127.0.0.1:5432/hoggy_test npm run test:pg`. It refuses a non-local host. `tests/pg.test.js` also checks the schema file on a fresh database (RLS, no anon access) and runs two instances (two processes loading `api/index.js`) on one database: register on one, sign in on the other, shared reviews, files, inbound secret and rate limits.

## Trust rules

- **Verified attendee** is decided on the server only, never from the request or from synced trip state. Either (a) the server received, at the reviewer's private Hoggy address, a registration receipt that names the conference and is dated from 400 days before that edition to 7 days after it, or (b) an admin approved an uploaded certificate of attendance, CPD certificate or registration receipt at `/admin.html`. Otherwise a review shows "Attended (not verified)"; while a proof waits it is `pending_proof` (still unverified).
- Scores are per series: a verified review counts in full, an unverified one counts half, and nothing is shown until a series has 3 reviews. Reports from accounts younger than 24h (`HOGGY_REPORT_MIN_AGE_H`) are ignored; 3 reports hide a review pending admin review. Organisers have no way to edit or delete reviews.
- Older per-conference reviews were moved into the series model on first start (old table kept as `reviews_v1`); every old "verified" flag was reset because it came from client state.
- Dates are shown as confirmed only when an organiser page was read (stored `sourceUrl` + `lastVerified`). CPD hours/accreditation are shown only when published; otherwise "check organiser".

## Not built

Live booking (needs airline/hotel partner APIs and keys; Hoggy opens prefilled searches), password reset and email verification (need outbound mail), photo/scan receipt OCR (PDFs with a text layer are read; image-only receipts are stored but not read), automatic currency rates (foreign receipts take a manually entered exchange rate).
