# Data wave 6 (25 Nov 2026), AU/NZ course sessions

Branch `data-wave6`, from `data-combined` at f5dfa4c. This wave added course sessions from nine new AU/NZ source groups. It also widened the merge window to 2029, added WCLC 2029 Melbourne and fixed ISHLT 2028. The only non-AU/NZ conference row I edited is `ishlt-annual-meeting-2028`, as the brief asked. `tools/official-domains.json` is unchanged.

How pages were read: through `tools/courses/http.js`, via the new `tools/courses/x10/cache-fetch.js`. That means robots.txt is checked (also on redirect targets), requests to a host are at least 3 s apart, the User-Agent is generic and only https is used. Bot walls, 401/403 and robots refusals were recorded and skipped. Every new date comes from the provider's own page, never a site root. Its quote was checked by script against the cached page text, and it carries `lastVerified`/`verifiedOn` 2026-11-25. I used search results as leads only.

## Numbers

"Upcoming" means the row ends on or after 25 Nov 2026. A course session counts if it starts on or after 25 Nov 2026.

| | before | after |
|---|---|---|
| Upcoming conferences | 2195 | 2196 |
| AU/NZ upcoming | 257 | 258 |
| Upcoming with evidence (`datesSourceUrl`) | 734 | 736 |
| AU/NZ with evidence | 149 | 150 |
| Estimated (all upcoming) | 1224 | 1223 |
| AU/NZ estimated | 85 | 85 |
| Legacy confirmed (all upcoming) | 237 | 237 |
| AU/NZ course sessions (upcoming) | 1516 | 1605 |
| Course sessions, all (file total) | 3457 | 3546 |
| Course types | 189 | 218 |

That is +89 AU/NZ sessions. Upcoming conferences plus course sessions went from 5652 to 5742.

I ran `merge-shards`, `merge-courses`, `validate-data` (0 errors), `check-courses` (0 errors), `check-experiences` (0 errors) and `npm test` (123 tests: 121 pass, 0 fail, 2 skipped).

## Courses: new sources (`tools/courses/x10/aunz6-build.js` and `aunz6-groups.js`, one source file pair per group)

| Source | Provider | Types | Sessions | Read from |
|---|---|---|---|---|
| `lightbox-radiology` | Lightbox Radiology Education: CT, MSK imaging, POCUS, critical care ultrasound, US-guided cannulation (Sydney, Brisbane, Noosa, Melbourne, Queenstown) | 5 | 18 | lightboxradiology.com course finder |
| `scssc` | Sydney Clinical Skills and Simulation Centre, Royal North Shore Hospital: EMAC ×10, ATTAAC ×2, Safe Procedural Sedation ×3, Paediatric Emergencies for anaesthetists ×2 | 4 | 17 | sim.scssc.edu.au EMAC and ATTAAC pages, course calendar |
| `alfred-icu` | The Alfred ICU: PRIME ×4, ALS2 ×2 + recert, ABC CICM exam course ×2, ECMO ×2, FBI, Critically Ill Airway ×2, basic and advanced echo | 7 (+ core `als2`) | 16 | alfredicu.org.au/courses |
| `apls-nz` | APLS New Zealand: 3-day APLS in Auckland, Wellington, Christchurch, Dunedin, Hamilton, Rotorua (all waitlisted, NZ$3,700) | core `apls` | 14 | apls.org.nz/courses |
| `rmh-courses` | Royal Melbourne Hospital: ALS2 ×5 + recert, CRASH; RMH ICU: REACT ×2, advanced and foundation echo | 4 (+ core `als2`) | 12 | thermh.org.au/news/events; RMH ICU's Humanitix host page |
| `healthcert-aesthetic` | HealthCert aesthetic medicine workshop days (Brisbane, Sydney, Melbourne) | 3 | 6 | healthcert.com workshop calendar |
| `acco` | Australasian College of Cutaneous Oncology: Essentials, Dermoscopy, Flap and Graft, Face and Ear (Docklands, Melbourne) | 4 | 4 | acco.edu.au/calendar |
| `aunz-wave6` | SA Critical Care Ultrasound Course (Adelaide, 8–9 Apr 2027); SunSmart / ACD Practical Dermoscopy day (Melbourne, 8 May 2027) | 2 | 2 | saica.com.au; sunsmart.com.au program page |

Notes:
- **Duplicates checked** against held sessions. None of the Alfred, RMH or APLS NZ runs were in the ARC, APLS Arlo or ACRRM sources. HealthCert's skin cancer, procedures, vasectomy, IUD and MSK days are already held by `womens-gp`, so only the aesthetic days are new. ACCO's "Combined Essentials and Dermoscopy" is the same two workshops, so it is not counted again. Lightbox's two-hour cannulation slots on one day count as one session.
- **End dates.** Lightbox gives only a start date and a length ("4 days", "2 days"), so those ends carry `endInferred: true`.
- **Left out:** the Alfred Burns Symposium (a meeting, not a course), SCSSC instructor and supervisor courses, Lightbox's courses abroad (Fiji, Bali, Niseko) and its nurse-practitioner course, a Gympie Lightbox run marked "Course full", and RMH ICU's December 2026 events (the host listing gives no year).
- **Fees** come only from the page. Lightbox's currency is unclear (the page shows both "$" and "US$"), so no price is recorded. CPD is "check provider" throughout.

## Looked for, not added
- **No 2027 dates yet:** FPNSW IUD/implant training ("check again in March 2027"), Sexual Wellbeing Aotearoa (2026 only), SCGH FELS (2026), CICM course calendar (most rows have no city), RACGP faculty events, Rural Health West, RWAV, NSW RDN, GP Synergy, ANZCA EMAC page (no runner list), Adelaide Health Simulation (2026 only), PEM Revision ("2027 COURSE TBC").
- **Not specific enough:** the NZ Resuscitative Ultrasound Course says "November 2027" with no day. The WACHS educational opportunities page lists WAPEC dates, but it was last updated years ago.
- **Already covered:** ACRRM's upcoming face-to-face list, SCCA, AIU, CRANAplus, TEN-360 and LearnEM, EMUGS, and HealthCert's skin cancer days.

## Conferences
- **Merge window.** `tools/merge-shards.js` now takes rows starting up to 2029-12-31 (it was 2028-12-31). There is a new test in `tests/validate.test.js`: a 2029-12-31 start merges, and a 2030 start is rejected as out of range. `lib/ingest.js` still has its own 2028-12-31 match window for ingest; I did not change it.
- **WCLC 2029 Melbourne added** (`wclc-2029-melbourne`, shard `wave6-aunz.json`). I re-read wclc.iaslc.org/future-conferences this run: "WCLC 2029 Melbourne, Australia September 8 – 11, 2029". The page gives no venue.
- **ISHLT 2028 fixed** (`provenance-wave6-2026-11-25.json`, name and blurb in `fix-wave6.json`). ishlt.org's future-dates page reads: "ISHLT 48 TH ANNUAL MEETING & SCIENTIFIC SESSIONS Seattle Convention Center | Summit Seattle, WA USA Pre-Conference Day 25 April, 2028 Annual Meeting 26–29 April, 2028". The row was an estimate for Toronto, 19–23 Apr. It is now confirmed for Seattle, 26–29 Apr 2028.

## Blocked or failing hosts (skipped, not bypassed)
- **403 / bot challenge:** www.surgeons.org (RACS EMST/CCrISP schedules), www.goodfellowunit.org, medicine.unimelb.edu.au (UEG POCUS short courses), www.otago.ac.nz, www.canberrahealthservices.act.gov.au, lightboxradiology.com/courses.aspx (the course finder page used instead was readable).
- **robots.txt refuses:** csds.qld.edu.au (Queensland Clinical Skills Development Service).
- **Connection failure:** acecc.org.au (again), www.truerelationships.org.au, www.nets.org.au.
- **Gone (404):** www.nzrc.org.nz/courses/, www.cicm.org.au/Events, monashhealth.org/education/simulation/, www.austin.org.au/education-and-training/.

## Code changed
- `tools/merge-shards.js`: rows may now start up to 2029-12-31 (with a test in `tests/validate.test.js`).
- New: `tools/courses/x10/cache-fetch.js`, the polite page cache (http.js) that writes `index.tsv` for the hand-checked builds.
- New: `tools/courses/x10/aunz6-build.js` and `aunz6-groups.js`. They rebuild the eight wave 6 sources from a cache: `node tools/courses/x10/cache-fetch.js --cache DIR <urls>`, then `node tools/courses/x10/aunz6-build.js --cache DIR`.
