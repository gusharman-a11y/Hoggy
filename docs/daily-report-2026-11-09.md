# Hoggy daily report, 2026-11-09

Backup: data/work/conferences.before-daily-2026-11-09.js

## Totals
- Rows: 2013 -> 2027 (+14). Confirmed dates: 676 -> 689. Tests: 18/18 pass.

## Source check (2013 urls)
- 1822 OK, 43 dead/error, 146 blocked (403 or robots-disallowed; skipped, not bypassed), 21 JSON-LD date mismatches.
- Most mismatches are JSON-LD noise (webinars, past editions, null dates). Re-read on organiser pages: RSNA 2026 (Nov 29-Dec 3), RACS Founders Centenary (11-13 Feb 2027, Dunedin) and World Congress of Dermoscopy (12-15 May 2027) all match the DB; no change.
- Corrected/downgraded: icpem-jeddah (icpem.co and icpem.co/en both 404) -> estimated, datesConfirmed false (also set verified:false in data/shards/provenance-1.json so merge does not re-confirm it).
- Removed: none (no cancellations found).
- Not re-read (still flagged, mostly "expected" rows with fetch failures/timeouts): about 40 ids, e.g. bapm-annual-conference-2027/2028 (404, already unconfirmed), sufu, degro, kca/jsts/jssr/ccs-*-expected, congresso-brasileiro-de-coloproctologia, spmi, cpa, suo. Full list in data/verification-report.json.

## Added (discovery: AU, NZ, CA, JP, CN, KR; 15 shard rows, 14 merged, 1 duplicate)
AU 4, NZ 2, CA 3, JP 4, CN 1 (IMCAS China 2027), KR 1 (KSOG 112th, Seoul, Nov 2026). Shards: data/shards/desk-<cc>-2026-11-09.json. cpdHours 0 throughout.

## Sites blocked/unreachable
cma.ca (403), csimonline.ca, ksgh.org, ksem.or.kr, anzsn.org (unreachable), nzma.org.nz (self-signed cert), dev3.termis.org (cert mismatch). Plus 146 blocked in the source check.

## Needs human review
- CA Canadian Pain Society: page mixes 2024/2025 and 2027 details.
- CN IMCAS China: commercial organiser, no accreditation shown.
- AU AMSIG: expression-of-interest stage; Melbourne inferred from venue.
- AU ACCCN 2027 Sydney Oct 5-8 omitted: possible clash with existing ANZICS-ACCCN 2027-10-13 row.
- City/venue inferred or unstated: ACCCN 2028, JSCA Wakayama, ACPA acronym.
- JSSR Spine organiser is host departments.
- NZ/CA rows not checked against other desks' shards for duplicates.
- Leads dropped for lack of organiser-page dates: KCR 2027, TERMIS 2027 Shanghai, ICKSH 2027, AMMI-CACMID 2027, ASBD Wellington, CSHM 2027, Pan-Canadian NP Conference 2027 (conflicting dates).
