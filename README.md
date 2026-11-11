# Hoggy

Medical conference scanner: discover conferences, plan trips, forward receipts, claim expenses, track CPD.

## Run

```
npm install             # one runtime dependency: pdfjs-dist (reads PDF receipts)
node server.js          # Node 22+
```

Open http://127.0.0.1:8123. Without the server (any static host) the app still works in offline mode, with data on the device only.

## Backend (server.js)

- Accounts (scrypt, HttpOnly session cookie, rate-limited login/register), CSRF header check on every mutating call.
- `GET/PUT /api/state` — per-user sync with revision conflict detection.
- Reviews belong to a conference **series** (every edition), keyed by `lib/series.js` (organiser tag + name with years, ordinals and edition numbers removed). One review per user per series per year attended (up to 10 years back), five ratings (content and speakers, networking, venue and organisation, value for money, CPD worth) and a comment of up to 600 characters.
  - `GET /api/reviews?series=<key>` (or `?conf=<id>`), `GET /api/ratings` (per series), `GET /api/my-reviews`; `POST /api/reviews` `{series, editions:[{year, city}], ratings, text}` adds one or more years at once; `PUT`/`DELETE /api/reviews/<id>` (author only); `POST /api/reviews/<id>/report`.
  - `POST /api/reviews/<id>/proof?kind=certificate|cpd|receipt` (PDF/JPG/PNG, 5 MB, magic bytes checked). Proof files are never served publicly: only `GET /api/admin/proofs/<id>/file` returns them, and they are deleted once an admin approves or rejects.
  - Share link `/#/review/<seriesKey>` opens the review form (sign-in first if needed).
- `POST /api/inbound/email` with header `X-Hoggy-Secret` (or HTTP Basic, password = secret) — inbound-email webhook (Postmark-style JSON, or `{to,from,subject,text,attachments}`). Matches `dr-<token>@receipts.hoggy.app` to a user, parses the receipt, stores the attachment, and the app pulls it into Receipts within a minute.
- Data in `data-store/` (SQLite + inbound secret). Back this folder up; do not publish it.

### Live global database (constantly updated)

The server keeps conferences in SQLite (seeded from `data/conferences.js`, new ids only) and serves them at `GET /api/conferences`; the app loads that list, falling back to the bundled file offline.

Start with `HOGGY_INGEST=1 HOGGY_ADMINS=you@example.com HOGGY_ADMIN_KEY=<long random string> node server.js` (the admin key is mandatory: without it all admin endpoints are disabled) to enable the updater (runs 30s after start, then every 6h):
- **Refresh:** re-checks each conference's organiser page (robots.txt respected, https only, private addresses blocked, polite delays). When the page publishes schema.org Event JSON-LD or iCal that matches, dates update automatically. Dead links (3 strikes) and cancelled/postponed wording flag the conference with a warning in the app.
- **Discover:** polls `data/sources.json` (journal, society and publisher feeds: iCal, RSS, JSON-LD, Crossref) and queues unknown events as candidates. Nothing external goes live until an admin approves it at `/admin.html` (the Data desk).
- `node tools/merge-shards.js` merges curated JSON shards; `node tools/check-sources.js` writes an offline freshness report.

### Go live checklist

1. Host behind HTTPS with `HOST=0.0.0.0` behind a reverse proxy (cookies are `Secure` automatically unless HOST is loopback; set `HOGGY_TRUST_PROXY=1` so rate limits use the real client IP, and add HSTS at the proxy).
2. Point an MX record for your mail domain at an inbound-email provider (e.g. Postmark inbound) and have its webhook send `X-Hoggy-Secret: <contents of data-store/inbound-secret.txt>` (or Basic auth with that as the password) to `https://<host>/api/inbound/email`. Set `HOGGY_MAIL_DOMAIN` to that domain.

Known gaps: no email verification or password reset (needs outbound mail), so registration reveals whether an email exists and reviewers are not email-verified.
3. Receipt files are stored per device (IndexedDB); synced state covers trips, receipts metadata, CPD and settings.

## Deploying to Vercel

`vercel.json` sends every path to one Node 22 function (`api/index.js`, which reuses the handler from `server.js`). Locally nothing changes: `node server.js` still listens as before.

- Import the repo in Vercel; Framework Preset **Other**. Leave build, output and install settings at their defaults (`vercel.json` sets them; the empty `public/` output stops Vercel publishing the source tree as static files). Node.js version 22.x (from `package.json`).
- When `VERCEL` is set, the server keeps data in `/tmp/hoggy-data`, marks cookies `Secure`, trusts `X-Forwarded-For`, never runs the updater (`HOGGY_INGEST` is ignored), skips local backups and shows a small "Preview" notice (also shown locally with `HOGGY_DEMO=1`).
- Optional env vars: `HOGGY_INBOUND_SECRET` (otherwise a new one is generated in `/tmp` on every cold start and the inbound-email webhook cannot be configured), `HOGGY_MAIL_DOMAIN`, `HOGGY_ADMIN_KEY` + `HOGGY_ADMINS` (admin endpoints stay off without the key).
- **Data is not persistent on Vercel.** `/tmp` is per instance and wiped when it is recycled, so accounts, sessions, reviews, proof-of-attendance uploads and receipts disappear and can differ between concurrent instances. Conferences are re-seeded from `data/conferences.js` on each cold start. This is a preview only; production needs a hosted database (or a long-running host with a persistent disk for `HOGGY_DATA`).

## Trust rules

- **Verified attendee** is decided on the server only, never from the request or from synced trip state. Either (a) the server received, at the reviewer's private Hoggy address, a registration receipt that names the conference and is dated from 400 days before that edition to 7 days after it, or (b) an admin approved an uploaded certificate of attendance, CPD certificate or registration receipt at `/admin.html`. Otherwise a review shows "Attended (not verified)"; while a proof waits it is `pending_proof` (still unverified).
- Scores are per series: a verified review counts in full, an unverified one counts half, and nothing is shown until a series has 3 reviews. Reports from accounts younger than 24h (`HOGGY_REPORT_MIN_AGE_H`) are ignored; 3 reports hide a review pending admin review. Organisers have no way to edit or delete reviews.
- Older per-conference reviews were moved into the series model on first start (old table kept as `reviews_v1`); every old "verified" flag was reset because it came from client state.
- Dates are shown as confirmed only when an organiser page was read (stored `sourceUrl` + `lastVerified`). CPD hours/accreditation are shown only when published; otherwise "check organiser".

## Not built

Live booking (needs airline/hotel partner APIs and keys; Hoggy opens prefilled searches), password reset and email verification (need outbound mail), photo/scan receipt OCR (PDFs with a text layer are read; image-only receipts are stored but not read), automatic currency rates (foreign receipts take a manually entered exchange rate).
