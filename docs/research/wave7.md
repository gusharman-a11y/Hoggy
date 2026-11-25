# Data wave 7 (25 Nov 2026), AU/NZ conferences and course sessions

Branch `data-wave7`, from `data-combined`. This wave added AU/NZ conference rows and course sessions from organisers' and providers' own event pages, and fixed one AU row (AMA National Conference). I did not edit any non-AU/NZ rows. `tools/official-domains.json` is unchanged.

How pages were read: through `tools/courses/http.js`, via `tools/courses/x10/cache-fetch.js`. That means robots.txt is checked (also on redirect targets), requests to a host are at least 3 s apart, the User-Agent is generic and only https is used. Bot walls, 401/403 and robots refusals were recorded and skipped. In this container Node's fetch needs `NODE_USE_ENV_PROXY=1` to use the session proxy. Every new date comes from the organiser's or provider's own event page, never a site root. Its quote is checked by script against the cached page text, and it carries `verifiedOn`/`lastVerified` 2026-11-25. I used search results and listings on other sites as leads only. An event that RACP or MJA lists for a third party was not taken from that listing.

## Numbers

"Upcoming" means the row ends on or after 25 Nov 2026. A course session counts if it starts on or after 25 Nov 2026.

| | before | after |
|---|---|---|
| Upcoming conferences | 2556 | 2569 |
| AU/NZ upcoming | 258 | 271 |
| Upcoming with evidence | 1131 | 1145 |
| AU/NZ with evidence | 150 | 164 |
| Estimated (all upcoming) | 1196 | 1195 |
| AU/NZ estimated | 85 | 84 |
| AU/NZ course sessions (upcoming) | 1605 | 1660 |
| Course sessions, all (file total) | 3546 | 3601 |
| Course types | 218 | 244 |

That is +13 AU/NZ conference rows, +1 AU row moved from estimate to confirmed, and +55 AU/NZ sessions. Upcoming conferences plus course sessions went from 6102 to 6170. The 11,000 target is still far off: the college and society calendars that are readable were mostly worked through in waves 2 to 6.

I ran `merge-shards`, `merge-courses`, `validate-data` (0 errors), `check-courses` (0 errors), `check-experiences` (0 errors) and `npm test` (123 tests: 121 pass, 0 fail, 2 skipped).

## Conferences (`data/shards/wave7-aunz.json`)

| Row | Dates | Where | Read from |
|---|---|---|---|
| ANZSTR inaugural ASM | 20–21 Feb 2027 | Rydges, Melbourne | ranzcr.com event page |
| RANZCR WA Branch: MSK Imaging Update | 13–14 Feb 2027 | Perth | ranzcr.com event page |
| 15th General Breast Imaging Meeting | 4–7 Mar 2027 | Tākina, Wellington | ranzcr.com event page |
| RANZCR NSW Women's Imaging Weekend | 3–4 Apr 2027 | Amora Hotel, Sydney | ranzcr.com event page |
| FROGG Trainee Weekend (radiation oncology) | 1–2 May 2027 | Melbourne | ranzcr.com event page |
| ACEM/EMF Research Symposium | 24–25 Feb 2027 | Hillstone St Lucia, Brisbane | acem.org.au event page |
| ACEM Queensland Autumn Symposium | 27–28 May 2027 | BCEC, Brisbane | acem.org.au event page |
| RACGP Practice Owners Conference | 22–23 May 2027 | GCCEC, Gold Coast | practiceownersconference.com.au registration page |
| NBMPHN Healthy Ageing Conference | 3 Apr 2027 | Western Sydney Conference Centre | Nepean Blue Mountains PHN events calendar |
| Burns Critical Care Symposium | 22 Mar 2027 | The Alfred, Melbourne | plasticsurgery.org.au event page |
| MENTOR APAC Breast Symposium (industry) | 5–6 Mar 2027 | W Sydney | plasticsurgery.org.au event page |
| 8th APFSRM with the ASPS Plastic Surgery Congress | 18–20 May 2028 | Melbourne | plasticsurgery.org.au event page |
| RACP SA Research Forum and Trainee Research Awards | 5 Dec 2026 | Royal Adelaide Hospital | racp.edu.au event page (RACP-hosted) |

**Fixed (`provenance-wave7-2026-11-25.json`):** `ama-national-conference` was an estimate for Canberra, 28–30 May 2027, sourced to ama.com.au's home page. The AMA's own event page reads: "Held on the 27 & 28 August 2027 in Melbourne". It is now confirmed for Melbourne, 27–28 Aug 2027.

All rows are In-person. Online-only events were left out, because the conference schema takes only In-person or Hybrid.

## Courses (`data/courses/sources/aunz-wave7.*`, built by `tools/courses/x10/aunz7-build.js` from `aunz7-groups.js`)

| Provider | Types | Sessions | Read from |
|---|---|---|---|
| UWA CTEC, Perth: surgical core skills (ENT, plastics, vascular, microsurgery, laparoscopy, neck dissection, gynae), endoscopy, Cutting Edge GP workshops (plastering, skin, wound suturing, soft tissue, rural surgery, proceduralist O&G), JDocs surgical skills | 19 | 22 | each ctec.uwa.edu.au workshop page, parsed with the existing `resus-ctec.js` |
| Cardiac Skills Australia: Focussed Cardiac Ultrasound 2-day (Sydney, Melbourne, Brisbane, Perth, Adelaide, Hobart, Canberra, Darwin, Auckland, Queenstown) and Diastolic one-day | 2 | 26 | one booking page per workshop (cardiacskillsaustralia.com.au/service-page/...) |
| SHINE SA IUD insertion practical workshops, 2027 (Woodville) | 1 | 3 | shinesa.org.au IUD training page |
| RANZCR SMART workshop (Hobart) and FLiRO (Melbourne) | 2 | 2 | ranzcr.com event pages |
| Ace the OSCE (ACEM OSCE prep, Westmead) | 1 | 1 | the course's own Humanitix page |
| SWSPHN Resuscitation skills for general practice | 1 | 1 | swsphn.com.au event page |

Notes:
- **CTEC.** The resus source holds CTEC's six emergency workshops. This wave adds the other doctor workshops. Nurse-only workshops are left out. Fees are on the CTEC pages (WA and non-WA rates) but are not copied per session, as in resus.
- **Cardiac Skills Australia.** The fee is the page's "AU $ 2,700 (+ GST)" (diastolic: $1,300). The Auckland pages also price in Australian dollars. The Queenstown destination workshop (14–17 Sept 2027) page gives no venue.
- **SHINE SA.** The general `iud-insertion-training` type belongs to the womens-gp source, so these workshops have their own type, `shine-iud-insertion-workshop`.
- CPD is "check provider" throughout.

## Re-checked from waves 5 and 6
- **Now dated:** SHINE SA IUD workshops (28 Jan, 23 Mar, 11 May 2027), added. AMA National Conference, fixed (see above).
- **Still no 2027 dates:** FPNSW IUD training ("more training positions may become available in early 2027"), ACSEP MSK ultrasound workshop ("2027 COURSE DATES COMING SOON"), Adelaide Health Simulation short courses, PIPER and Royal Women's neoResus (2026 only), SCGH simulation courses, RWAV, the RACGP faculty events page (rendered by script), CICM events site (2026 only), RNZCUC (no live events), Airway course (airwaycam: "2027 Dates TBD"), University of Auckland ACME (2026).
- **Not specific enough:** RDAA's events page lists the Victorian Rural Health Conference 2027 as 14–16 May 2027 but names no city, so it was not added. WCPGHAN 2028 (Brisbane, 30 Aug–2 Sep 2028) is only on the congress site's home page, which is a site root, so it was not added.
- **2028–29 international meetings coming to AU/NZ:** APLAR 2028 (Melbourne), CAOS 2028 (Brisbane), IUHPE 2028 (Melbourne), AACNS 2028 (Wellington) and IAGG 2029 (Sydney) are announced only by convention bureaus and trade press. No organiser page with dates could be read, so none were added.
- **Already held:** most RANZCP, RANZCR, ANZCA ACE, CSANZ, AOA, ANZSGM, NZSA-listed and ACEM meetings found this run (SA branch, FCAP, FPOA, ANZSNR, ARGANZ, RRR EM27, ACEM ASM, AQUA, PANNZ, ASPS aesthetic workshop, and so on).

## Blocked or failing hosts (skipped, not bypassed)
- **403 / bot challenge:** www.rcpa.edu.au, www.dermcoll.edu.au, racma.edu.au, www.petermac.org, www.mcri.edu.au, www.monash.edu, www.ramsayhealth.com.au, www.epworth.org.au, matereducation.qld.edu.au, www.emphn.org.au, www.anzbms.org.au.
- **robots.txt refuses:** www.asid.net.au/events, www.ranzcog.edu.au/events, www.anzics.org/events, www.anzsnm.org.au/events.
- **Connection failure:** ranzco.edu, www.racs.edu.au, acecc.org.au (again), www.amasa.org.au, www.nzma.org.nz, sneh.org.au, www.iuhpe.org, www.iagg2029.com, www.usanz.org.au, www.thoracic.org.au, www.ctphn.org.au, www.ntphn.org.au, wvphn.org.au, www.ccqphn.org.au. HTTP 520: www.ruralhealth.org.au.
- **Dates only drawn by script (nothing in the HTML):** the acem.org.au/events calendar (its Search-Pages list was used instead), the ANZCA members event list, the MJA conference calendar, the SAPMEA education calendar.

## Code changed
- New: `tools/courses/x10/aunz7-build.js` and `aunz7-groups.js`. They rebuild this wave's conference shard and course source from a cache. Run `node tools/courses/x10/cache-fetch.js --cache DIR <urls>`, then `node tools/courses/x10/aunz7-build.js --cache DIR`. The build also finds a cached page by the address it was read from after redirects.
