# Expert QA of the wave-1 research output (x10)

Reviewer: medical expert lead, 18 Nov 2026. Rubric: `docs/research/expert-blueprint.md` §4. Targets: `docs/research/expert-gaps.json`.
Method: (1) a rule check of every row with a script (canonical specialty, aggregator or predatory source, B30 evidence fields, past dates, accent corruption, duplicates against `data/conferences.js` and within wave 1); (2) **live spot checks**: each sampled row's `sourceUrl`/`datesSourceUrl` was fetched politely (≥3.5 s per host, generic UA, no bypass), and the page was checked for the quote and for the stored start date; (3) expert reading for relevance, specialty and duplicates across the course and conference datasets.

**Status.** All five desks delivered. Snapshot taken at 07:50 UTC, after every file had been unchanged for 3+ minutes (the last write was at 07:45). **`data/conferences.js` was merged at 07:50**, so the conference findings below are now live data: it holds 2,168 rows (was 2,043), 364 confirmed *with* B30 evidence (was 0), and 241 upcoming AU/NZ rows (was 193). The course files in `data/courses/incoming/` are **not yet merged**: `sessions.json` still has 579 sessions. If an agent writes more after 07:50, re-run the checks (`scratchpad/qa.js`, `scratchpad/spot.js`).

## 1. What came in

| File | Rows | Confirmed with evidence | Notes |
|---|---|---|---|
| `data/shards/x10-aunz-conf.json` | 46 | 46 | 25 specialties; 7 are courses (see 3.1) |
| `data/shards/provenance-x10-aunz-conf.json` | 59 | 59 | 54 existing rows confirmed unchanged, 5 corrected |
| `data/shards/x10-intl-conf.json` | 79 | 79 | Europe 29, US/CA 22, Asia-Pacific 18, UK/IE 10. Fills RCOG WC, ISUOG, FIGO, WCN, World Sleep, EuGMS, ISAM, WFNS, ISPRM, ICOH, ATTD, FESSH, CSI, PRIDoC |
| `data/shards/provenance-x10-intl-conf.json` | 180 | 180 | 148 unchanged, **32 estimates corrected** (median ~7 days, up to 28: `acoem-aohc-2028`, `aaem-scientific-assembly-2028` −21 d) |
| `data/courses/incoming/resus.*` | 294 sessions, 23 course types | all | NZ PRIME (68), NZ ACLS (46), PACLS (34), NZRC CORE (49), ACCCN ALS (30), ACRRM Airway/RACM/PHEC/POCUS (19), CTEC (13), APLS-type paediatric ALS (14) |
| `data/courses/incoming/womens-gp.*` | 437 sessions, 65 course types | all | FSEP 23 (AU+NZ), SCCA 13, HealthCert 18, FP/SHINE/SHQ/SHV 17, Healthed 9, RHW 10, SAPMEA 4, **AIU 343** |
| `data/courses/incoming/intl.*` | 2,072 sessions, 39 course types | all | ERC 1,293 (41 countries), RCUK 530, RCS England/RCSEd 249 (ATLS 104, BSS 53, CCrISP 30) |

Course sessions by country if all are merged: AU +526, NZ +205 (NZ goes from 4 to 209), GB 787, rest of Europe ≈1,280.

## 2. Spot checks (82 rows opened live)

| Set | Sampled | Page loaded | Dates confirmed on page | Problems |
|---|---|---|---|---|
| `x10-aunz-conf` rows + provenance | 25 (15 rows, 10 provenance) | 25 | **25** (every quote supports start/end; 1 quote differs only by an HTML entity, `&#x202F;`, FPM) | none |
| `resus` sessions | 14 | 11 HTML + 3 Arlo JSON (406 to a browser Accept header; re-read as JSON: matched) | **14** | ACRRM/CTEC quotes are table cells joined with " \| ", not verbatim text (see 3.4) |
| `intl` sessions | 10 | 10 | **8** (RCUK, RCS England, RCSEd: ATLS, CCrISP, BSS, NLS, EPALS, NOTSS, core lap) | **2 ERC CoSy rows cannot be re-verified**: `sourceUrl` is the CoSy search list page (`cosy.erc.edu/en/sessions/calendar/view-mode/list`), whose static HTML has no dates; there is no per-session page (`/sessions/view/id/<n>` redirects) |
| `womens-gp` sessions | 13 | 13 | **13** (FSEP AU+NZ, SCCA NZ, HealthCert, SHV SRHA, Healthed, RHW MHST, SAPMEA EMET, AIU ×3) | AIU "Closed" sessions not flagged (see 3.3) |
| `x10-intl-conf` rows + provenance | 20 (14 rows, 6 provenance) | 19 (+1 HTTP 403: AACN) | **19** (ISAM counted, with a caveat) | `aacn-nti-2027` stores **exhibit dates** (see 3.1b). `isam-annual-congress-2027`: the quote is cut mid-sentence ("Aug 26-28, Innovation Day"); confirm whether 26 Aug is a pre-day |

Sampled ids (all checked):
- aunz-conf: fpm-symposium-2027, wa-ace-country-conference-2027, ranzcp-sa-branch-conference-2027, csanz-indigenous-cardiovascular-health-conference-2027, tbi-conference-nz-2027, ages-perioperative-surgical-meeting-2027, anzscts-aotearoa-cardiothoracic-meeting-2027, rhw-neostars-northam-2027, rhw-emergency-airway-busselton-2027, anzspm-medical-surgical-update-2027, ranzcp-child-adolescent-forensic-conference-2027, acm-national-conference-2027, acm-sa-state-conference-2027, siop-congress-2027-sydney, acccn-asm-2027; provenance: acem-asm, anzgog-asm-2027, achsm-congress-2027, acm-nsw-state-conference, acorn-international-conference-2028, csanz-annual-scientific-meeting, ashm-viral-hepatitis-conference, aoa-tas-vic-branch-asm-2028, aps-counselling-psychologists-conference-2027, aoa-qld-trifecta-2027.
- resus: acccn-adult-als-recertification-nsw-westmead-2027-02-09, acccn-als-instructor-recertification-nsw-westmead-2027-01-19, acccn-paediatric-als-recertification-wa-welshpool-2027-03-20, acrrm-advanced-airway-qld-brisbane-2027-05-07, acrrm-phec-qld-brisbane-2027-03-20, acrrm-pocus-rg-vic-melbourne-2027-04-04, acrrm-racm-vic-melbourne-2027-04-16, als1-sa-adelaide-2027-09-03-art, als2-recertification-wa-osborne-park-2027-11-27-mts, awls-waikato-kinloch-2027-03-28, bls-instructor-sa-adelaide-2027-05-06-art, ctec-critical-care-procedures-wa-perth-2027-05-05-ctec, ctec-cutting-edge-emergency-procedures-wa-perth-2027-05-20-ctec, ctec-cutting-edge-practical-ed-skills-wa-perth-2027-04-30-ctec.
- intl: rcsed-notss-london-2027-03-05-rcsed, ccrisp-full-london-2027-03-17-rcs, rcuk-als-e-als-leeds-2027-02-20-lambda-medical, rcuk-nls-full-watford-2027-02-13-west-hertfordshire-hospitals-nhs-trust, atls-full-manchester-2027-03-27-regional, bss-full-london-2027-04-01-rcs, rcuk-epals-full-london-2027-04-10-north-middlesex-university-hospital-nhs-trust, rcseng-cslap-full-london-2027-03-01-rcs, erc-als-recertification-de-pasing-2026-11-22-450808, erc-epals-full-fr-lyon-2026-11-30-442668.
- womens-gp: fsep-full-day-qld-rockhampton-2026-11-26, fsep-full-day-nz-tauranga-2026-11-20, scca-certificate-skin-cancer-medicine-nz-auckland-2027-07-24, healthcert-skin-cancer-medicine-workshop-advanced-nsw-sydney-2027-04-11, iud-insertion-training-healthcert-advanced-workshop-qld-brisbane-2027-03-14, srha-national-certificate-doctors-shv-face-to-face-vic-box-hill-2027-08-02, healthed-womens-childrens-health-update-qld-brisbane-2027-05-29, rhw-mental-health-skills-training-wa-perth-2027-03-19, emet-major-trauma-workshop-sa-waikerie-2026-11-27, aiu-basic-emergency-medicine-ultrasound-pocus-3-days-2027-06-02, aiu-ultrasound-in-rural-medicine-3-days-2027-06-28, aiu-obstetric-ultrasound-5-days-2027-05-17.
- intl-conf: american-transplant-congress-2027, wfns-20th-world-congress-of-neurosurgery-2027, rcog-world-congress-2027, pridoc-2026, world-congress-of-nephrology-2027, isuog-world-congress-2027, csi-frankfurt-2027, attd-2027, aacn-nti-2027, scts-annual-meeting-2028, eugms-congress-2027, world-sleep-2027, xxvi-figo-world-congress-2027, isam-annual-congress-2027; provenance: cpdd-annual-meeting-2027, ewma-conference-2028, eurospine-annual-meeting, rcpsych-international-congress, acp-internal-medicine-meeting, ash-annual-meeting-2026.

Total: 82 rows opened (25 + 14 + 10 + 13 + 20). 79 dates confirmed on the organiser page (25 + 14 + 8 + 13 + 19); 1 wrong date type (AACN: exhibit dates, page 403 to us, judged from its own quote); 2 ERC rows not reproducible from their sourceUrl; 1 of the 79 needs a check (ISAM, truncated quote).

**Verdict on accuracy:** no wrong date was found in any sampled row. Evidence discipline (organiser page, quote, verifiedOn) is good across all desks. The problems are scope, relevance, duplication and mapping, not fabrication.

## 3. Rows to fix or remove

### 3.1 Conferences: `x10-aunz-conf`
| id(s) | Action | Reason |
|---|---|---|
| `rhw-react-karratha-2027`, `rhw-neostars-northam-2027`, `rhw-peaches-geraldton-2027`, `rhw-tide-perth-2027`, `rhw-emergency-airway-busselton-2027` | **Remove from conferences** | These are Rural Health West *courses*. They are also in `womens-gp.sessions.json` (`rhw-react-plus`, `rhw-neostars`, `rhw-peachs`, `rhw-tide`, `rhw-eam`), so they would appear twice. Keep them as course sessions only |
| `rcpa-aacb-chemical-pathology-course-2027`, `anzan-eeg-esa-epilepsy-courses-2027` | Move to courses (or tag `format: course`) | Training courses, not scientific meetings |
| `acm-national-conference-2027`, `acm-vic/qld/sa/wa-state-conference-2027` | Keep, but specialty → **Obstetrics & Gynaecology** (or keep Nursing and add a secondary) | `tools/specialties.json` maps Midwifery → O&G. Midwifery meetings matter to GP obstetricians, but they are not doctor meetings, so do not count them towards doctor targets |
| `acccn-asm-2027` (Nursing, Sydney 5–8 Oct 2027, confirmed) | Keep | It **contradicts the existing estimate `anzics-asm`** ("ANZICS-ACCCN Intensive Care ASM", Gold Coast 13–15 Oct 2027). ACCCN now runs its own ASM. Re-check `anzics-asm` on anzics.org: rename it "ANZICS ASM" or drop the 2027 estimate. That row also carries invented figures (attendees 1,500, priceFrom 800, cpdBody "ANZCA CPD") |
| `siop-congress-2027-sydney` | Specialty → Paediatrics (secondary Oncology) | SIOP is paediatric oncology |
| `mwia-western-pacific-regional-conference-2027` | Specialty → Health Management (or Medical Education) | Medical Women's International Association, a professional/advocacy meeting |
| `iacapap-world-congress-2028` | Keep (confirm city/country on the page) | Child psychiatry world congress; relevance score 3 |
| `ara-asm-2028` | Keep | Second edition of a college-level ASM: exactly what was missing |

The provenance shard (`provenance-x10-aunz-conf.json`, 59 entries) confirmed 54 existing rows unchanged and **corrected 5 estimates**: `acem-asm` (21–25 Nov → **7–12 Nov 2027**), `anzgog-asm-2027` (11 Mar → **21–23 Apr 2027**), `ages-asm-2027` (25 Mar → **4–6 Mar 2027**), `achsm-congress-2027` (15 Sep → **13–15 Oct 2027**), `cicm-asm-2027` (27 → 26 May). Lesson: **estimates were off by 3–6 weeks**. Hoggy should not show an estimated date as if it were a date (show "usually <month>" instead).

### 3.1b Conferences: `x10-intl-conf` (now merged, so these are live)
| id(s) | Action | Reason |
|---|---|---|
| `american-transplant-congress-2027`, `american-transplant-congress-2028` | **Remove**, and move their evidence onto `atc-american-transplant-congress-2027/2028` | **Duplicates**: the same meeting and the same dates (5–9 Jun 2027, 3 Jun 2028) under new ids. The old rows are still estimates |
| `aacn-nti-2027` | **Remove** (duplicate of `aacn-nti`), then fix dates | Its quote says "May 4-5, 2027 **(exhibit dates)**": these are the expo days, not the conference. `aacn-nti` (legacy, 2 May 2027) is closer. Re-read the NTI page for the education dates (the page returned 403 to us) |
| `isam-annual-congress-2027` | Check | The quote is truncated at "Innovation Day"; confirm the main-congress dates |
| `stfm-*` (4 rows), `aacn-nti-2027`, `sigma-european-regional-conference-2027`, `icn-congress-2027`, `asht-50th-annual-meeting-2027`, `wfh-comprehensive-care-summit-2027`, `esdr-annual-meeting-2027`, `isid-…-2028` | Keep, AU-relevance 1 | Nursing, hand therapy, US family-medicine teaching and research-dermatology meetings: legitimate, but not what AU doctors judge Hoggy on |
| `apasl-single-topic-conference-*` (4) | Keep, relevance 1 | Single-topic satellite meetings of APASL |
| `esicm-lives-physiology-transbiology-2027`, `esicm-intensive-care-innovation-2027` | Keep | Small ESICM meetings; must not be confused with ESICM LIVES (present) |
| `ecr-2028`, `ismrm-annual-meeting-2028`, `world-congress-of-nephrology-2028`, `eugms-congress-2028` | Keep | Second editions: exactly what "complete" needs |

No predatory or vanity brands in this shard: all 79 organisers are named international societies or federations.

### 3.2 Courses: `resus`
| id(s) / courseId | Action | Reason |
|---|---|---|
| `nz-acls` (46, Emcare + Resuscitation Matters), `pacls` (34) | Keep, but **rename/annotate** | These are NZ provider-branded "ACLS" courses (RNZCGP-recognised), **not AHA ACLS**. The catalogue name must not imply AHA certification. They may also be the same product as NZRC CORE Advanced: check overlap with `nzrc-core-advanced` from the same providers on the same dates |
| `acccn-adult-als`, `acccn-paediatric-als` | Keep | Fills the ACCCN gap noted on 17 Nov. Note in the catalogue that ACCCN ALS is nurse-led but open to doctors |
| `acccn-als-instructor` (12), `bls-instructor` (5) | Keep, relevance 1 | Instructor courses: rank last |
| `ecg-12-lead` (4) | Low relevance (1) | Nursing-level workshop; hide from the doctor default view |
| `wilderness-rescue-medicine` (4), `awls` (2) (RescueMED) | Keep, label commercial | Niche; AWLS is a recognised brand |
| `ran-moum` (2) | Check eligibility | Navy course: confirm civilians can enrol (SPUMS lists it) or mark "restricted" |
| `als1`/`als2` from provider Arlo feeds (3) | **Check duplicates** with ARC course-dates rows | The same centre's sessions are already in `data/courses/sessions.json` from the ARC page; merge on provider + date |

### 3.3 Courses: `womens-gp`
| courseId | Action | Reason |
|---|---|---|
| `aiu-*` (343 of 437 sessions, 46 course types) | Keep, but **collapse duration variants** and **flag dominance** | One commercial provider (Australian Institute of Ultrasound, Gold Coast only) is 78% of the file. 47 date groups list the same course start 2–4 times for 2/3/4/5/6-day options (**57 extra rows**): make one session with `durationOptions`. 25 sessions whose quote says **"Closed"** have `seatsStatus: null`: set them to closed |
| `aiu-third-trimester-ultrasound-for-midwives`, `aiu-emergency-nurse-practitioner-ultrasound`, `aiu-return-to-clinical-practice` (sonographers) | Relevance 1 | Not doctor courses |
| `aiu-*` vs the blueprint target "ASUM CCPU" | Note | AIU courses are not the ASUM CCPU credential that ED/ICU credentialing asks for. Keep them, but ASUM remains a P1 gap |
| `sexual-reproductive-health-certificate-nurses`, `cervical-screening-training-nurses`, `contraceptive-implant-training` (RN/RM variants) | Relevance 1 for doctors | Keep the doctor variants prominent (`srha-national-certificate-doctors`, Implanon training for doctors) |
| `healthcert-*`, `healthed-*` | Keep, **label commercial** | Legitimate, accredited commercial education (rubric legitimacy 1–2) |
| `rhw-mental-health-skills-training` | Keep; link to GPMHSC | It is a GPMHSC-accredited MHST provider. The catalogue should say "GPMHSC-accredited" only if the page says so |
| `fsep-full-day` (19 AU + 4 NZ) | Keep | P1 item delivered. Also add the FSEP online/eLearning program as "on demand" |

### 3.4 Courses: `intl`
| courseId | Action | Reason |
|---|---|---|
| `erc-*` (1,293 sessions in 41 countries; 1,198 not taught in English) | Keep, but **downgrade AU-relevance to 0–1** and **fix evidence** | `sourceUrl` is the CoSy list view, which does not show the session on a plain GET. A reviewer cannot reproduce the date, so this fails the spirit of B30. Store the exact query (POST parameters) or the per-session URL, or mark `datesConfirmed:false` until it is reproducible. Also hide sessions taught in a language other than English from the AU default view |
| `rcuk-als`, `atls` (GB), `ccrisp` (GB/IN), `bss`, `rcuk-nls`, `rcuk-epals` | Keep (relevance 2) | Useful for AU/NZ doctors moving to the UK. **Do not merge with AU courses of the same name**: RCS England CCrISP ≠ RACS CCrISP certification, and UK BSS ≠ RACS ASSET. Keep them under separate ids (already done) and say so in the UI |
| `rcsed-robotic-hugo` (4) | Label industry-linked | Named for one vendor's robot (Medtronic Hugo). Allowed (college-run), but label it |
| `rcsed-oncoplastic-breast` (AE) | Keep | RCSEd-run, overseas venue |
| quotes joined with " \| " (ACRRM, CTEC, FSEP, AIU, ERC, RCS) | Accept for courses, document it | B30 says "copied exactly". Joined table cells are a reasonable reading of a table, but say so in the catalogue note so the checker does not reject them |

## 4. Predatory and irrelevant items found
- **Wave 1: none.** No OMICS/Conference Series/WASET/Pulsus/Allied Academies/BIT domains or organisers, no aggregator date sources, no "World Congress on X & Y" names (script check over all rows; see blueprint §4 for the patterns used). The intl-conf shard was checked the same way: no hits. Its weakest rows are low-relevance (nursing and teaching meetings), not predatory.
- **Existing data** (found while building the blueprint; not wave-1 rows):
  - **Text corruption in 114 European rows** from `data/shards/exp-europe.json`: "Congrèss" (164×), "Congrèso" (64×), "Congrèsso" (60×), "Thérapies" (e.g. `esmo-tat-2027`, `eco-european-congress-on-obesity-2027`, `rcoa-annual-congress-2027`, `esska-congress-2027`). Fix in the shard. Search for "congress" misses these rows today.
  - **Unsourced numbers in 449 rows** (`attendees`, `priceFrom`, `cpdHours`/`cpdBody` with no source; e.g. `rsna-annual-meeting-2026` attendees 40,000, `anzics-asm` attendees 1,500 / $800 / "ANZCA CPD"). The desk rules forbid invented CPD. Zero these out or source them.
  - **1,553 rows whose `sourceUrl` is a site root.** None can become B30-confirmed without an event page.
  - **Duplicates:** `rdaa-rural-medicine-australia-2027/2028` duplicate `rma-rural-medicine-australia` (RMA is joint ACRRM+RDAA; the RDAA rows give Adelaide, which was RMA26's city). `adea-conference-2027/2028` duplicate `australasian-diabetes-congress` (joint ADS+ADEA, same dates, but a different city is listed).
  - **Mis-mapped specialties** that hide AU meetings (ASOHNS→Surgery, ASPS→Surgery, ANZSVS→Surgery, APS→Anaesthesia, Sleep DownUnder→Respiratory, ANZSNM→Radiology, ANZSOM→Internal Medicine, APSAD→Psychiatry, TROG→Oncology, FSANZ/IFFS→O&G, MICCAI→Radiology): full table in blueprint §5.
  - **Commercial organiser** with no society behind it: `closing-the-gap-indigenous-health-2026` (Indigenous Conference Services). Keep and label; add AIDA/NACCHO.

## 5. Coverage after wave 1 (if merged as is, after the fixes above)

| Measure | Before (18 Nov, morning) | After wave 1 (conferences merged; courses as delivered) | Blueprint target |
|---|---|---|---|
| Upcoming AU/NZ conference rows | 193 | **241** (≈234 after removing the 7 course rows) | ≈1,000 |
| Rows confirmed with B30 evidence | 0 | **364** | 100% of P1 |
| AU/NZ course sessions | 579 | **≈1,250** after collapsing 57 AIU duplicates (+526 AU, +205 NZ) | 1,600–1,800 |
| Training programs with a bookable course type (ACEM, ANZCA, CICM, RACS, RANZCOG, RACP-paeds, RACGP, ACRRM) | 3 of 8 | **5 of 8** (adds RANZCOG via FSEP and RACGP via SCCA/HealthCert/FP/MHST) | 8 of 8. **ANZCA (EMAC), CICM (BASIC) and RACS (CCrISP/ASSET/EMST)** are still empty |
| Doctor specialties with 0 AU/NZ rows | 14 | **12** (Nephrology and General Medicine gained one each): Addiction, Hand, Neurosurgery, Nuclear Med, Occ Med, OMFS, ENT, Paed Surgery, Radiation Oncology, Reproductive, Sleep, Vascular Surgery | 0. The blueprint §5 mapping fixes alone take this to **4** (Hand, Neurosurgery, OMFS, Paed Surgery), which are all P1 items in §6A |
| P1 items present (by series) | 120 / 161 | **126 / 161** (+5 more in unmerged course files) | 161 |

The wave was accurate but small. The AU/NZ conference count rose by 25%, not 10×, and most new local rows are state, faculty and SIG meetings (RANZCP faculties, ANZCA ACE meetings, CSANZ symposia), which is the right kind. What blocks 10× is breadth: dozens of AU/NZ societies are still absent (§6), and every 2028 college ASM is still missing.

## 6. Remaining priority-1 gaps for wave 2

From `expert-gaps.json`: 161 priority-1 items, **35 not yet in merged data**, of which 5 are covered by the unmerged course files (FSEP, MHST via RHW, SCCA/HealthCert skin cancer, IUD/implant, ACRRM PHEC). That leaves **30 for wave 2**. Priority 2: 80 missing (73 after wave 1). Priority 3: 79 missing (78 after wave 1). EMST is catalogued but has 0 sessions. Items marked `inWave1` are covered by the unmerged wave-1 files. The rest are listed below, grouped by what blocks them.

**A. AU/NZ society meetings: fetchable, just not done yet (13)**
1. Neurosurgical Society of Australasia ASM (nsa.org.au)
2. ANZAOMS ASM (anzaoms.org)
3. ANZAPS ASM (anzaps.org; 2026 was joint with SPANZA)
4. Australian Hand Surgery Society ASM (AOA subspecialty page; secretariat austhandsurgery.com.au)
5. IRSA ASM, interventional radiology (irsa.com.au)
6. Stroke Society of Australasia ASM (usually late August)
7. IMSANZ ASM (imsanz.org.au)
8. ANZSPM Palliative Medicine Conference (anzspm.org.au; wave 1 added only its Medical & Surgical Update)
9. AIDA Conference (aida.org.au)
10. RACMA Annual Conference (racma.edu.au: 403 to us, needs a person)
11. NZSOHNS "ORL 20xx" ASM (listed on asohns.org.au)
12. NZSA ASM (anaesthesia.nz). Wave 1 added the ANZCA ACE meetings but not NZSA
13. ANZSN ASM itself (nephrology.edu.au). Wave 1 added only the DNT Workshop

**B. International flagships still missing (2)**: ISICEM Brussels (isicem.org) and CX Symposium (cxsymposium.com, 403 to us).

**C. Courses with an official, readable provider (11)**: ETM (etmcourse.com, 403: person), ASUM CCPU/POCUS units (asum.com.au), EMAC (ANZCA), CICO/airway workshops (ANZCA-recognised list), BASIC (AU/NZ host ICUs), ICU echo (ASUM/FUSIC), NeoResus (neoresus.org.au), PROMPT (promptmaternity.org, plus state programs), PIMS/AIMS, formerly ALSO (amare.org.au, 403: person), DRANZCOG/CWH (ranzcog.edu.au), ASHM s100 prescriber courses (ashm.org.au), CRANAplus REC/MEC (crana.org.au), AO Trauma Principles (aofoundation.org).

**D. Blocked hosts, so a person or an allowlist change is needed (4)**: RACS CCrISP, ASSET and EMST (surgeons.org Cloudflare: 0 sessions for the three courses every surgical trainee needs). NZRC newborn/paediatric courses (resus.org.nz, proxy-refused). NeoResus/NZRC newborn for maternity units (repeats C for NZ).

**Top 20 for wave 2, in order:** EMST sessions, CCrISP, ASSET, EMAC, NZSA ASM, ANZSN ASM, Neurosurgical Society ASM, IMSANZ, ANZSPM conference, AIDA, ASUM CCPU, NeoResus, PROMPT, PIMS/AIMS (ALSO), BASIC, ETM, CRANAplus REC/MEC, ANZAOMS, IRSA, Stroke Society of Australasia.

**Also for wave 2 (cheap, high value):** add the 2028 editions of every AU/NZ college ASM (ANZCA, RACS, ACEM, CICM, RANZCOG, RACP, RANZCP, RANZCO, CSANZ, TSANZ, ANZAN, ACD, ESA); add the TSANZ (transplant) 2027 edition; and add the aliases "ALSO"→PIMS/AIMS, "RESUS4KIDS"→KidsResus, "BSS"→ASSET and "EMST"↔ATLS.
