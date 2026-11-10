# Hoggy country desks

Each desk has one lead agent who owns that country's conference rows: finding new meetings, re-verifying dates on the organiser's page, and writing a shard to `data/shards/desk-<cc>.json`. Leads never edit `conferences.js`; the merge step validates and de-duplicates.

## Rules every desk follows
- Dates only from the organiser's or society's own page, opened that run. Otherwise drop the row.
- No invented CPD hours, no "largest/leading" claims, https only.
- Aggregators are leads, never a date source. Never bypass bot protection (Cloudflare, CAPTCHAs); a blocked site stays a lead.
- Flag rows that look predatory (vague organiser, no society behind it, no accreditation) instead of adding them.
- Daily: re-check own rows (dead link, date change, cancellation), then look for newly announced editions.

## Wave 1 desks (by conference volume)
US, GB, DE, FR, IT, ES, NL, CH, AU, NZ, CA, JP, CN, KR, IN, SG, AE, SA, BR, MX, ZA, TR

## Wave 2 (as wave 1 proves out)
Nordics, Central/Eastern Europe, rest of Asia, Gulf, rest of Latin America, East/West/North Africa
