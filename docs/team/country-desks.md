# Hoggy country desks

Each desk has one lead agent who owns that country's conference rows: finding new meetings, re-verifying dates on the organiser's page, and writing a shard to `data/shards/desk-<cc>.json`. Leads never edit `conferences.js`; the merge step validates and de-duplicates.

## Rules every desk follows
- Dates only from the organiser's or society's own page, opened that run. Otherwise drop the row.
- No invented CPD hours, no "largest/leading" claims, https only.
- Aggregators are leads, never a date source. Never bypass bot protection (Cloudflare, CAPTCHAs); a blocked site stays a lead.
- Flag rows that look predatory (vague organiser, no society behind it, no accreditation) instead of adding them.
- Daily: re-check own rows (dead link, date change, cancellation), then look for newly announced editions.
- **Evidence (B30, from 17 Nov 2026).** A row or provenance entry may say `datesConfirmed: true` / `verified: true` only with all three of `datesSourceUrl` (the event page the dates were read from: https, not the site's home page, not an aggregator), `datesQuote` (the words on that page that give the dates, copied exactly, at most 200 characters, including the start day) and `verifiedOn` (the date you read it, ISO). The page must be on the organiser's or society's own domain (subdomains count) or in `tools/official-domains.json` (add an entry, with the row ids and a note, only after seeing the organiser runs that site). Without them the merge adds the row as an estimate with an `estimateReason`, and a provenance entry without a quote is ignored. Never type a quote from memory or a listing: if the page cannot be read, the row stays an estimate.
- Rows confirmed before 17 Nov 2026 carry `legacyConfirmed: true` (dates kept, the app says "source not yet re-checked"). They lose the flag only when an entry with evidence confirms them; `tools/verify-dates.js` works through them, soonest first.

## Wave 1 desks (by conference volume)
US, GB, DE, FR, IT, ES, NL, CH, AU, NZ, CA, JP, CN, KR, IN, SG, AE, SA, BR, MX, ZA, TR

## Wave 2 (as wave 1 proves out)
Nordics, Central/Eastern Europe, rest of Asia, Gulf, rest of Latin America, East/West/North Africa

## Daily job: date checks and the data gate (B28, B30)

Run from the repo root on the laptop (the organiser sites are reachable there; cloud sessions mostly are not), after the report file `docs/daily-report-<date>.md` has been started and before committing:

```
node tools/verify-dates.js --limit 40
node tools/merge-shards.js
node tools/validate-data.js
npm test
```

- `verify-dates` takes the 40 soonest upcoming rows that are estimated or `legacyConfirmed`, reads each organiser page politely (robots.txt, at least 3 s between requests to a host, generic User-Agent, https only; a Cloudflare challenge, CAPTCHA, 401/403 or robots.txt refusal is recorded as blocked and skipped, never worked around), and writes evidence entries to `data/shards/provenance-dates-<date>.json` only where exactly one plausible range for the edition's year sits near the conference's name on a page on the organiser's domain (and, for an estimated row, the page names its city). Everything else (two ranges, a range that disagrees with a confirmed row, a move of more than 120 days, dates only on a site root, nothing for this year) is listed under **Date checks** in the day's report for a person to look at. It replaces only its own "## Date checks" section, so write the rest of the report before or after it, but do not overwrite the file afterwards.
- `merge-shards` applies the evidence (dates, `datesSourceUrl`, `datesQuote`, `verifiedOn`, drops `legacyConfirmed`) and downgrades any confirmed row that breaks the rule, with the reason in `estimateReason`.
- `validate-data` must exit 0 (it prints the counts for the report: confirmed with evidence, legacy, estimated, site-root sources). If it fails, fix the shard and re-run the merge; do not commit a failing `data/conferences.js`.
- The default takes the soonest rows of both kinds, which are mostly legacy ones for the next few weeks. For the B28 audit of estimates, replace the first line with `node tools/verify-dates.js --limit 40 --only estimated` on Mondays and Thursdays (one run per day: a second run replaces the day's "Date checks" section).
- Dry run first if in doubt: `node tools/verify-dates.js --limit 40 --dry` prints the section and writes nothing. `--ids a,b` checks named rows; `--save DIR` keeps the fetched pages so a run can be replayed with `--from DIR`.
- Review items: open the page, and if the dates are right add a provenance entry by hand with the three evidence fields (the quote copied from the page), or fix the row's `url`/`sourceUrl` to the event page so the next run finds it.
