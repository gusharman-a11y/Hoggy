# Data wave 3 (25 Nov 2026)

Branch `data-wave3` (from `redesign`). Only `data/**`, `tools/**` and this file were touched. Every page was read this run, one request at a time with at least 3 s between requests to a host, robots.txt checked first, https only, generic User-Agent. Bot challenges, 403s, robots refusals and failed connections were skipped and listed below, never worked around. Search results and listing sites were used as leads only, never as a date source. Every change carries `datesSourceUrl` (an event page, not a site root), `datesQuote` (copied from the page; a script checked each quote against the saved page text before the shard was written) and `verifiedOn: 2026-11-25`.

## Numbers (upcoming rows, end on or after 25 Nov 2026)

| | before | after |
|---|---|---|
| Upcoming conferences | 2178 | 2183 |
| AU/NZ upcoming | 241 | 246 |
| Confirmed with evidence | 544 | 584 |
| AU/NZ confirmed with evidence | 112 | 133 |
| Legacy (not yet re-checked) | 343 | 312 |
| Estimated | 1291 | 1287 |
| AU/NZ course sessions (start on or after 25 Nov) | 1246 | 1246 |

All rows: with evidence 548 → 588, legacy 361 → 330. `validate-data` 0 errors, `check-courses` 0 errors, `check-experiences` 0 errors, `npm test` passes (122 tests, 0 failures).

## What changed

### New AU/NZ rows (5, `data/shards/wave3-aunz.json`)

| id | dates | city | source |
|---|---|---|---|
| aoa-sant-branch-papers-day-2027 | 26 Feb 2027 | Adelaide (SAHMRI) | aoa.org.au event detail page |
| aoa-sant-branch-asm-2027 | 13 Aug 2027 | Adelaide (Kooyonga) | aoa.org.au event detail page |
| nz-orthopaedic-spine-society-meeting-2027 | 19–22 Aug 2027 | Queenstown | nzoa.org.nz/nzoa-meetings-2026 |
| nz-pelvic-trauma-meeting-2027 | 7–8 Aug 2027 | Queenstown | nzoa.org.nz/nzoa-meetings-2026 |
| nz-orthopaedic-foot-ankle-society-meeting-2027 | 20–21 Nov 2027 | Auckland | nzoa.org.nz/nzoa-meetings-2026 |

The two AOA SA/NT rows (wave 2 lead 3) were held back by the merge's host + start-day duplicate rule: each shares a day with another AOA branch meeting on aoa.org.au. `tools/merge-shards.js` now treats two rows on one host and one start day as different meetings only when both urls are distinct event pages; a site-root url still collides with anything on its host. A dry run showed this lets no real duplicate through (it also re-admits `jastro-39th-2026`, a separate Japanese meeting that ended 14 Nov 2026, as an estimate).

Two rows I drafted were already there (`nzssd-asm-2027`, `anzscts-aotearoa-cardiothoracic-meeting-2027`) and were dropped.

### Dates checked on organiser pages (37 entries, `data/shards/provenance-wave3-2026-11-25.json`)

AU/NZ (18):

| id | dates | city | note |
|---|---|---|---|
| nzoa-asm | 18–19 Oct 2027 | Auckland | city check, see below |
| aoa-asm | 10–13 Oct 2027 | Sydney | city check, see below |
| aoa-wa-branch-scientific-papers-day-2027 | 6 Mar 2027 | Perth | **date changed**: AOA moved it from 20 Feb |
| anzscts-asm-2027 | 3–6 Nov 2027 | **Queenstown, NZ** | was an estimate for March, Gold Coast |
| ascept-asm-2027 | 30 Nov – 3 Dec 2027 | **Gold Coast** | was an estimate for 23–25 Nov, Melbourne. Renamed APSA-ASCEPT Joint Scientific Meeting 2027 |
| apasl-2027 | 1–4 Apr 2027 | Sydney | apasl2027.org (added to `tools/official-domains.json`: apasl.info gives it as the meeting's URL) |
| ranzcr-asm / ranzcr-asm-2028 | 14–16 Oct 2027 / 19–21 Oct 2028 | Gold Coast / Sydney | RANZCR "Future ASMs" |
| ascia-annual-conference-2027 / -2028 | 7–10 Sep 2027 / 29 Aug – 1 Sep 2028 | Canberra / Perth | ASCIA future conferences page |
| anzcs-meeting-2027 | 4–5 Mar 2027 | Adelaide | |
| australian-lung-cancer-conference-2027 | 17–19 Feb 2027 | Brisbane | |
| antimicrobials-2027 | 25–27 Feb 2027 | Brisbane | |
| ranzcog-aotearoa-nz-asm-2027 | 2–4 Apr 2027 | Napier | |
| nzcom-biennial-conference-2027 | 22–23 Jul 2027 | Wellington | |
| international-festival-of-nursing-2027 | 29–31 Jul 2027 | Adelaide | |
| nzps-asm-2027 | 12–13 Mar 2027 | Hamilton | workshops on 11 Mar |
| nzas-audiology-conference-2027 | 16–18 Jun 2027 | Auckland | |

Largest international legacy and estimated rows (19): AAO 2027 and 2028, SfN 2027 and 2028, RSNA 2028, ASA 2028, APHA 2027, ACS Clinical Congress 2028, AAOS 2028, JSS 2027, JCS 2027, ERS 2027, JOA 2027 (congre.co.jp/joa2027, linked from joa.or.jp, added to official domains), ASGCT 2027, ASGCT 2028 (**city changed**: New Orleans, 1–5 May 2028; the estimate had Boston), SABCS 2026 and 2028, EULAR 2027 and AAIC 2028.

`data/shards/fix-wave3-blurbs.json` rewrites four blurbs that still said "dates not announced" or named the old guessed city (ANZSCTS 2027, ASCEPT 2027, ASGCT 2028, SABCS 2028).

### nzoa-asm and aoa-asm cities (wave 2 doubt)
Both stated cities are right. NZOA's 2027 events page: "NZOA Annual Scientific Meeting 2027, 18-19 October, The Pullman Hotel, Auckland". AOA's event page: "the 2027 AOA Annual Scientific Meeting will be held in Sydney from 10–13 October 2027 at the Hyatt Regency Sydney". The wrong part was the map pins (Queenstown and Perth), which wave 2 already moved. nzoa-asm now has evidence. A later x10 shard re-applies the older, shorter quote to aoa-asm; it stays confirmed with evidence.

### Legacy and no-date rows
`tools/verify-dates.js` was run over all 129 AU/NZ rows that were legacy or estimated (output kept outside the repo): 0 confirmed automatically, 30 for review, 70 with no dates for the edition, 13 blocked and 16 errors. The confirmations above came from working through that review list by hand, mostly by finding the event subpage when the tool found dates only on a site root. Of the 70 "no dates", nearly all are 2027 and 2028 society meetings whose pages still show 2026.

## Blocked or failing hosts (skipped, not bypassed)
- Bot challenge / 403: surgeons.org, rcpa.edu.au, dermcoll.edu.au, ada.org.au, hospice.org.nz, awma.com.au, anzsnrasm.com, immunology.org.au.
- robots.txt refuses: anzba.org.au, anzsnm.org.au, menopause.org.au, fertilitysociety.com.au, anzics.org, ranzcog.edu.au (/events/).
- Connection or TLS failure: usanz.org.au, adpha.au, agitg.org.au, aeromedicalsociety.com.au, easl.eu, jsco.or.jp, nichigan.or.jp.
- Tooling note: in this cloud session, Node's fetch in `verify-dates.js` failed ("fetch failed" or HTTP 520) on anzgsconference.com, ranzco.edu, australianpainsociety.org, congress.iffsreproduction.org, themhs.org, hisa.org.au, allergy.org.au and ruralhealth.org.au. These pages loaded with a plain `conference-dates-check/1.0` User-Agent and were read that way, with robots.txt checked first. Requests sent with the `Mozilla/5.0 (compatible; …)` form were reset on the way. Worth checking from the laptop before changing the client.

## Still unpublished, or only on a site root (left as they are)
- **Dates only on the site root** (the rule keeps them unconfirmed): Lorne Proteins 2027, ANZGS 2027, ANZSOM ASM 2027 (Brisbane, 1–4 Aug), RANZCR NZ ASM 2027, Australasian Diabetes Congress 2027 (diabetescongress.com.au), HIV&AIDS and ASRH 2027 (Hobart), APSTH/HAA 2027, ASM microbiology 2027, ESCRS 2027 and 2028, TCT 2027, ACC.27, IMCAS 2027, Hospitalar 2027, AEEDC 2027, Dubai Derma 2027.
- **Estimates the organiser contradicts, but only on a root page**: `anzos-asm-2027` (ANZOS gives 13–16 Oct 2027, Rydges Melbourne; the row says 20–22 Oct, Sydney) and `breastsurganz-asm-2027` (BreastSurgANZ gives the International Breast Cancer Conference as 9–11 Sep 2027; the row says April, Sydney). Fix both once an event page has the dates.
- **Partial**: Australian Pain Society 47th ASM. The event page gives only "April 13, 2027", Gold Coast, with no end date. NZRA ASM: "16 - 18 September", Paihia, with no year beside it.
- **Not announced on college pages**: 2028 ASMs of ANZCA, CICM, RANZCOG, RANZCP, ACEM and RACS (ACD's page is blocked). Also RACP Congress 2027, RACGP GP27, RMA27, GESA AGW 2027, ASA NSC 2027, SMA, PCA, ESA, HGSA, ANZBMS, SSA, ASUM (the 2027 city is still not on its page) and most 2028 society estimates. The National Rural Health Conference was last held 14–16 Sep 2026, and the next one is not announced (the row guesses 2027, Hobart).
- **Leads for wave 4**: CSSANZ hosts APFCP 2027 (16–19 Nov, Sydney; already a row), so the `cssanz-asm-2027` estimate (Aug, Melbourne) may not happen. ANZMOSS x NACOS Masterclass 2027 (4–5 Jun, Sydney) appears only on anzos.com. ACTM's 10th Southern Cross Travel and Tropical Medicine Conference (10–12 Sep 2027, Sydney) appears only on tropmed.org's root and JavaScript calendar. NZOA Registrar Paper Day (1 Apr 2027, New Plymouth) appears only on the NZOA home page. anaesthesia.nz lists NZPS 2027 as 11–13 March, counting its workshop day. AAAH Youth Health 2027 (5–7 May, Gold Coast) appears only on ASHM's calendar, which is not the organiser's.
- PHAA (B56 g) is unchanged and still needs a decision on the weak-provenance rule.
- Courses: no new AU/NZ sessions this wave (AO Trauma, ASUM CCPU, KidsResus and NeoResus are still as wave 2 left them).
