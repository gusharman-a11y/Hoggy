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
- `GET/POST /api/reviews`, `GET /api/ratings` — real shared reviews, one per user per conference.
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

## Trust rules

- **Verified attendee** = the reviewer marked the trip attended AND a receipt was emailed to their private Hoggy address dated within the event window (±7 days). Self-claims never verify.
- Review scores show only after 5 verified reviews. Reports from accounts younger than 24h (`HOGGY_REPORT_MIN_AGE_H`) are ignored; 3 reports hide a review pending admin review.
- Dates are shown as confirmed only when an organiser page was read (stored `sourceUrl` + `lastVerified`). CPD hours/accreditation are shown only when published; otherwise "check organiser".

## Not built

Live booking (needs airline/hotel partner APIs and keys; Hoggy opens prefilled searches), password reset and email verification (need outbound mail), photo/scan receipt OCR (PDFs with a text layer are read; image-only receipts are stored but not read), automatic currency rates (foreign receipts take a manually entered exchange rate).
