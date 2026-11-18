# What a complete Hoggy looks like (expert blueprint)

Written 18 Nov 2026 by the medical expert lead. It covers AU/NZ doctors first, then the places they travel to (UK/IE, US/CA, Asia-Pacific, Europe).
Machine-readable target list: `docs/research/expert-gaps.json` (488 items). QA of the wave-1 research output: `docs/research/expert-review.md`.

> **Why doctors said "hardly any conferences".** The data has 2,005 upcoming rows (next 24 months). Only **193 are in Australia or NZ (about 10%)**. For a doctor in Sydney or Auckland, the first screen of their specialty usually shows one or two local meetings followed by a list of US and European congresses. Several AU/NZ specialties have **no local meeting at all**: Nephrology, ENT, Neurosurgery, Vascular Surgery, Radiation Oncology, Paediatric Surgery, OMFS, Hand Surgery, Sleep, Addiction, Occupational Medicine and Nuclear Medicine. Some of these are mapping errors (see §5); the rest are real gaps. Courses are the same story. The 579 sessions are all resuscitation (ALS1/ALS2/APLS/ACRRM), so a surgeon, an obstetrician, an anaesthetist or a city GP finds nothing they need.

## 0. Current state (data/conferences.js and data/courses, 18 Nov 2026, before the wave-1 merge)

_The wave-1 merge at 07:50 UTC took this to 2,168 rows, 364 confirmed with evidence, and 241 upcoming AU/NZ rows. See `expert-review.md` §5._

| | Rows |
|---|---|
| Conference rows, total | 2,043 (2026: 54, 2027: 1,226, 2028: 763) |
| Upcoming in the next 24 months | 2,005 |
| `datesConfirmed` with B30 evidence | **0** |
| `legacyConfirmed` (dates kept, source not re-checked) | 707 |
| Estimated | 1,336 |
| Upcoming by region | AU 169 · NZ 24 · UK/IE 104 · US/CA 543 · Europe 457 · Asia-Pacific 340 · Other 368 |
| Course types / sessions | 11 types / 579 sessions (APLS 77, ALS1 258, ALS2 201, ACRRM 39, NZ CORE 4, EMST 0, PALS 0) |

Upcoming rows by specialty (24 months). "AU+NZ" is the number a local doctor sees first.

| Specialty | Total | AU+NZ | | Specialty | Total | AU+NZ |
|---|---|---|---|---|---|---|
| Cardiology | 148 | 2 | | Emergency Medicine | 29 | 2 |
| Surgery | 107 | 10 | | Critical Care | 25 | 2 |
| Radiology | 100 | 9 | | Geriatrics | 23 | 3 |
| Oncology | 93 | 11 | | Otolaryngology (ENT) | 20 | **0** |
| Obstetrics & Gynaecology | 89 | 10 | | Rehabilitation Medicine | 15 | 3 |
| Neurology | 80 | 2 | | Sports Medicine | 15 | 3 |
| General Practice | 68 | 7 | | Palliative Care | 13 | 2 |
| Anaesthesia | 68 | 4 | | Plastic Surgery | 13 | 2 |
| Endocrinology | 67 | 8 | | Neurosurgery | 10 | **0** |
| Orthopaedics | 66 | 9 | | Vascular Surgery | 9 | **0** |
| Paediatrics | 65 | 4 | | Radiation Oncology | 8 | **0** |
| Ophthalmology | 60 | 3 | | Pain Medicine | 8 | 1 |
| Haematology | 50 | 4 | | Reproductive Medicine | 8 | **0** |
| Internal Medicine | 49 | 2 | | Addiction / Sleep / Occ Med | 4 each | **0** |
| Gastroenterology | 46 | 3 | | Hand Surg / OMFS / Paed Surg | 3–5 | **0** |
| Psychiatry | 44 | 6 | | Nuclear Medicine | 2 | **0** |
| Dermatology | 44 | 3 | | General Medicine | 2 | **0** |
| Nephrology | 43 | **0** | | Indigenous Health | 3 | 3 |
| Infectious Disease | 41 | 7 | | Respiratory / Rheumatology | 38 / 32 | 2 / 2 |

Pattern: the international flagships are mostly there (ESC, ACC, ASCO, RSNA, AAOS and so on all matched). What is missing is the **AU/NZ layer**: second editions (2028) of college ASMs, state branch meetings, SIG meetings, NZ national meetings, and every procedural/skills course outside resuscitation.

---

## 1. Per-specialty must-haves

How to read this section. **College** means the specialist college ASM. **National** means the main society ASM. **State/SIG** means branch and sub-specialty meetings. **Intl** lists the 3–6 meetings Australians actually travel to. **Courses** lists the courses for training and CPD, with the provider and its official site. ✅ = already in Hoggy (any edition), ⚠ = present but wrong specialty or missing an edition, ❌ = missing. Official sites are organiser home pages and are **never a date source**: dates must come from the event page (B30).

### 1.1 Acute care

**Emergency Medicine** (ACEM: acem.org.au)
- College: ACEM ASM ✅ (2027 Auckland, estimated). ACEM Regional, Rural & Remote EM Conference ✅. ACEM Winter Symposium ❌.
- National/SIG: DFTB conference (dontforgetthebubbles.com) ❌. CODA (codachange.org) ❌. CENA conference (cena.org.au) for ED teams ❌.
- Intl: ICEM/IFEM (ifem.cc) ❌ · RCEM ASC ✅ · ACEP Scientific Assembly ✅ · EUSEM ✅ · SAEM ✅.
- Courses: **APLS** (apls.org.au) ✅ · **ALS2** (ARC, resus.org.au) ✅ · **EMST** (RACS, surgeons.org) ⚠ catalogued but 0 sessions · **ETM** (etmcourse.com) ❌ · **POCUS**: ASUM CCPU units (asum.com.au) ❌ · ACEM Emergency Medicine Certificate/Diploma (for GPs/RMOs) ❌ · ACLS/BLS (AHA, for private hospitals and IMGs) ❌ · procedural sedation · MIMMS (major incident) · ATACC · PHTLS (lower priority).

**Anaesthesia** (ANZCA: anzca.edu.au; ASA: asa.org.au; NZSA: anaesthesia.nz)
- College: ANZCA ASM ✅ 2027 only (add 2028). Regional CME meetings (Vic, NSW, Qld, WA, SA/NT, Tas, NZ) ❌.
- National: ASA NSC ✅ (2027, 2028). **NZSA ASM ❌**. SPANZA (paediatric) ❌. ANZCA/ASA SIG meetings (Obstetric, Airway, Perioperative Medicine, Welfare, Rural & Regional) ❌.
- Intl: Euroanaesthesia (esaic.org) ✅ · ASA ANESTHESIOLOGY (asahq.org) ✅ · Association of Anaesthetists WSM/Annual Congress ✅ · WCA (WFSA, every 4 years) ❌ · DAS ASM ❌ · ESRA ✅ · ASRA ✅ · SOAP ✅.
- Courses: **EMAC** (ANZCA; core trainee course and an ANZCA emergency-response activity) ❌ · **ALS2** ✅ · **CICO/difficult airway workshops** (ANZCA-recognised emergency response) ❌ · RACM and Advanced Airway (ACRRM, for GP anaesthetists) ❌ · regional anaesthesia/POCUS workshops (ASUM-accredited) ❌ · basic perioperative TTE (HeartWeb, Uni Melbourne) ❌ · Primary/Final exam courses.

**Critical Care** (CICM: cicm.org.au; ANZICS: anzics.org)
- College: CICM ASM ✅ (2027). National: ANZICS/ACCCN ICU ASM ✅. ANZICS Safety & Quality ❌.
- Intl: ESICM LIVES ✅ · **ISICEM Brussels ❌** · SCCM Congress ✅ · Critical Care Reviews (Belfast) ❌ · ICS State of the Art ✅ · ELSO/EuroELSO ❌.
- Courses: **BASIC** (CUHK collaboration, run by AU/NZ ICUs) ❌ · **ALS2** ✅ · **ECMO** (ELSO-endorsed centres, e.g. Alfred) ❌ · **ICU echo/POCUS** (ASUM CCPU; UK FUSIC) ❌ · DETECT (NSW CEC) · CICM exam courses.

**Pain Medicine** (FPM, part of ANZCA)
- College: **FPM Spring Meeting ❌**. National: Australian Pain Society ASM ⚠ (mapped to Anaesthesia). NZ Pain Society ✅.
- Intl: IASP World Congress ❌ · EFIC ✅ · ASRA Pain ✅.

### 1.2 Primary care and rural

**General Practice** (RACGP: racgp.org.au; ACRRM: acrrm.org.au; RNZCGP: rnzcgp.org.nz)
- College: RACGP GP26 ✅, GP27 ✅ (estimated) · Rural Medicine Australia ✅ (but duplicated: see §5) · RNZCGP conference ✅.
- National/state: RACGP faculty events (state faculties, Rural, Aboriginal & Torres Strait Islander Health) ❌ · RDAQ conference ❌ · NSW RDN/RDAN ❌ · WA Rural Health Conference ✅ · National Rural Health Conference ✅ · Hauora Taiwhenua (NZ rural) ❌ · Healthed education evenings and Women's & Children's Health Updates (healthed.com.au; label commercial) ❌ · GPCE (label commercial, industry-heavy) ❌ · Jean Hailes women's health ❌.
- Intl: WONCA World ✅ · WONCA Asia Pacific ✅ · RCGP ✅ · AAFP FMX ✅.
- Courses (what GPs actually book):
  - **Mental health**: GPMHSC Mental Health Skills Training (MHST; gpmhsc.org.au; unlocks the higher GP Mental Health Treatment Plan items) ❌ · Focussed Psychological Strategies (FPS) ❌.
  - **Skin cancer**: Skin Cancer College Australasia certificates (skincancercollege.org) ❌ · HealthCert certificates (healthcert.com; commercial) ❌ · dermoscopy courses.
  - **Women's health**: IUD/implant insertion and the Certificate in Sexual & Reproductive Health (Family Planning Australia members: FPNSW, SHQ, SHINE SA, FP Tasmania, Sexual Health Victoria) ❌ · MS-2 Step prescriber training (MS Health) ❌ · RANZCOG Certificate/Diploma of Women's Health (CWH/DRANZCOG) ❌ · AMS menopause courses · antenatal shared-care accreditation.
  - **Prescribing**: ASHM s100 HIV/HBV/HCV prescriber courses (ashm.org.au) ❌ · state opioid treatment accreditation (e.g. NSW OTAC) ❌.
  - **Procedural/emergency**: CPR/BLS (RACGP practice standards: clinical staff at least every 3 years) ❌ · ALS2 ✅.
  - **Other**: CASA DAME training · cultural safety modules (a Medical Board CPD expectation).

**Rural Generalist** (ACRRM, RACGP Rural; filed under General Practice)
- Courses: **REST** ✅ · **Paediatric Emergencies for RGs** ✅ · **ANR** ✅ · **REOT** ✅ · **PHEC** ❌ (seen on ACRRM, not added) · **RACM** ❌ · **Advanced Airway** ❌ · **ACRRM POCUS** ❌ · Emergency Week ❌ · **EMST / ETM** ❌ · **CRANAplus REC (Remote Emergency Care) and MEC (Maternity Emergency Care)** (crana.org.au) ❌ · **ALSO, now PIMS/AIMS** (AMaRE, amare.org.au) ❌ · **RESUS4KIDS, now KidsResus** (SCHN/HETI NSW; RESUS4KIDS completions are recognised) ❌ · APLS ✅ · NeoResus ❌.
- Meetings: RMA ✅ · RDAQ/RDAN/RDAA state conferences ❌ · CRANAplus conference ❌.

### 1.3 Women's and children's

**Obstetrics & Gynaecology** (RANZCOG: ranzcog.edu.au)
- College: RANZCOG ASM ✅ · RANZCOG Aotearoa NZ ASM ✅ · state/territory ASMs and Regional Symposium ✅ (one row; Qld, Vic, WA, SA/NT, NSW meetings missing).
- National/SIG: AGES ✅ · PSANZ ✅ · AMS ✅ · **SOMANZ** (somanz.org) ❌ · **UGSA** (urogynaecology) ❌ · ASCCP (colposcopy) ❌ · ASUM ✅ · FSANZ ⚠ (map to Reproductive Medicine as well).
- Intl: **RCOG World Congress ❌** (other RCOG events are present) · **ISUOG World Congress ❌** · FIGO ❌ · ACOG ✅ · AAGL ✅ · ESHRE ✅ · IUGA ✅ (joint AUGS/IUGA).
- Courses: **FSEP** (RANZCOG, fsep.ranzcog.edu.au) ❌ · **PROMPT** (promptmaternity.org; state programs) ❌ · **ALSO/PIMS/AIMS** (AMaRE) ❌ · **MOET** ❌ · **NeoResus** ❌ · REOT ✅ · colposcopy training/NCSP recognition ❌ · DRANZCOG/CWH ❌ · obstetric ultrasound (ASUM, COGU).

**Paediatrics** (RACP Paediatrics & Child Health Division: racp.edu.au; PSNZ: paediatrics.org.nz)
- College: RACP Congress ✅ · Paediatric Society of NZ ✅.
- National/SIG: PSANZ ✅ · APEG ✅ · ANZCHOG ❌ · AAAH ✅ · DFTB ❌ · SPANZA ❌ · ANZSPGHAN/paediatric sub-specialty meetings ❌.
- Intl: PAS ✅ · RCPCH ✅ · AAP NCE ✅ · ESPID ✅ · ESPGHAN ✅ · IPA ❌.
- Courses: **APLS** ✅ · **PLS** (APLS Australia; templates exist, no public events yet) ❌ · **NeoResus** (Safer Care Victoria, neoresus.org.au) ❌ · NZ paediatric/newborn courses (NZRC) ❌ · S.T.A.B.L.E. ❌ · KidsResus (NSW) ❌ · Optimus (CHQ) ❌ · PALS ⚠ 0 sessions · Sydney Child Health Program / Diploma of Child Health ❌.

**Reproductive Medicine**: FSANZ ⚠ · IFFS 2027 ⚠ (both mapped O&G) · ESHRE ✅ · ASRM ✅.

**Sexual Health**: Australasian Sexual & Reproductive Health Conference ✅ · IUSTI ❌ · courses: ASHM s100, FP NSW certificate ❌.

### 1.4 Surgery

All surgical trainees (RACS SET) need **ASSET, CCrISP, EMST** and later **TIPS**; RACS also mandates **Operating with Respect**. RACS (surgeons.org) blocks automated reading (Cloudflare), so these need a person, or a laptop run with a human reading the page.

| Specialty | AU/NZ meetings | Intl | Courses |
|---|---|---|---|
| General Surgery | RACS ASC ✅ (2027; add 2028) · RACS state ASMs incl. Victorian Annual Surgical Meeting ❌ · GSA/NZAGS ❌ · CSSANZ ✅ · BreastSurgANZ ✅ · ANZHPBA ❌ · ANZMOSS ❌ · ANZES (endocrinesurgeons.org.au) ❌ · Australasian Trauma Society ❌ | ACS Clinical Congress ✅ · ASGBI ✅ · SAGES ✅ · EAES ✅ · ESCP ✅ · ASCRS ✅ · IFSO ❌ · IHPBA ❌ | CCrISP ❌, ASSET ❌, EMST ⚠, TIPS ❌, Operating with Respect ❌, DSTC (IATSIC) ❌, laparoscopic/robotic skills |
| Orthopaedics | AOA ASM ✅ · AOA branches ✅ (Vic, NSW, Qld, WA, Tas) · NZOA ✅ · AOA subspecialty meetings (Arthroplasty, Knee, Shoulder & Elbow, Foot & Ankle, Paediatric) ❌ | AAOS ✅ · EFORT ✅ · BOA ✅ · ISAKOS ❌ · APOA ✅ · SICOT ❌ | **AO Trauma Principles/Advanced** (aofoundation.org) ❌ · fracture/plastering workshops |
| Spine | Spine Society of Australia ✅ | NASS ✅ · EUROSPINE ✅ | AO Spine |
| Hand | **Australian Hand Surgery Society ASM ❌** (AOA subspecialty page) · NZSSH ❌ | ASSH ✅ · IFSSH ❌ · FESSH ❌ | |
| Urology | USANZ ASM ✅ · USANZ sections ❌ | AUA ✅ · EAU ✅ · BAUS ✅ · SIU ❌ · WCE ❌ | |
| Neurosurgery | **Neurosurgical Society of Australasia ASM ❌** (nsa.org.au) | CNS ✅ · AANS ✅ · EANS ❌ · WFNS ❌ | |
| Cardiothoracic | ANZSCTS ✅ | AATS ✅ · EACTS ✅ · STS ✅ · ASCVTS ✅ | |
| Vascular | ANZSVS ⚠ (mapped Surgery) | **CX Symposium ❌** · SVS VAM ✅ · VEITH ✅ · ESVS ✅ | |
| Plastic & Burns | ASPS ⚠ (mapped Surgery) · NZAPS ❌ · ANZBA ✅ · ASAPS ❌ | Plastic Surgery The Meeting ✅ · BAPRAS ✅ | |
| ENT | ASOHNS ⚠ (mapped Surgery; ENT shows 0 AU) · **NZSOHNS "ORL" ASM ❌** (listed on asohns.org.au) · ANZHNCS ❌ | AAO-HNSF ✅ · IFOS ❌ · ENT UK ❌ | |
| OMFS | **ANZAOMS ❌** | AAOMS ✅ · ICOMS ❌ | |
| Paediatric Surgery | **ANZAPS ❌** (2026 was joint with SPANZA, Gold Coast) | PAPS ❌ · BAPS ❌ · APSA ✅ | |

### 1.5 Medicine (physician specialties; RACP training)

RACP Congress ✅ is the umbrella. Each specialty's own society ASM is what physicians actually go to:

| Specialty | AU/NZ must-have | Intl (Australians attend) |
|---|---|---|
| Cardiology | CSANZ ASM ✅ (2027 Auckland) · CSANZ NZ ASM ❌ · ANZET ❌ · HBPRCA ✅ | ESC ✅ · ACC ✅ · AHA ✅ · TCT ✅ · EuroPCR ✅ · HRS ✅ · APHRS ✅ |
| Respiratory | TSANZ ASM ✅ · TSANZ branches ❌ | ERS Congress ✅ · ATS ✅ · APSR ✅ · CHEST ✅ |
| Sleep | Sleep DownUnder ⚠ (mapped Respiratory) | SLEEP ✅ · World Sleep ❌ |
| Gastroenterology | AGW ✅ · NZSG ✅ · GESA IBD/Liver meetings ❌ | DDW ✅ · UEG Week ✅ · AASLD ✅ · EASL ✅ · ECCO ✅ · APDW ❌ |
| Endocrinology | ESA ASM ✅ · ESA Clinical Weekend ❌ · ADC ✅ · NZSSD ✅ · ANZBMS ✅ · ADIPS ✅ | ENDO ✅ · EASD ✅ · ADA ✅ · ECE ✅ · ATTD ❌ |
| Nephrology | **ANZSN ASM ❌ · ANZSN DNT Workshop ❌** (nephrology.edu.au) | ASN Kidney Week ✅ · ERA ✅ · WCN ❌ |
| Transplantation | TSANZ ASM ⚠ (2028 only) | ATC ✅ · TTS ❌ · ESOT ✅ |
| Haematology | HAA ✅ · ALLG ✅ · ANZTCT ❌ | ASH ✅ · EHA ✅ · ISTH ❌ |
| Medical Oncology | COSA ✅ · MOGA ✅ · trial-group ASMs (AGITG, ANZGOG, ANZUP, TROG, MASC) ✅ · BCT ❌ · TOGA ❌ · COGNO ❌ · ANZSA ❌ | ASCO ✅ · ESMO ✅ · ESMO Asia ❌ · SABCS ✅ · WCLC ✅ (2028 only) |
| Rheumatology | ARA ✅ · NZRA ✅ | ACR Convergence ✅ · EULAR ✅ · APLAR ✅ |
| Neurology | ANZAN ✅ · **Stroke Society of Australasia ❌** · Epilepsy Society of Australia ❌ · ANZ Headache Society ❌ | AAN ✅ · EAN ✅ · ECTRIMS ✅ · ESOC ✅ · World Stroke Congress ❌ |
| Infectious Diseases | ASID ✅ · ASHM conferences ✅ · ACIPC ✅ · ASM ✅ · ACTM ❌ | ESCMID ✅ · IDWeek ✅ · CISTM ✅ · IAS/AIDS ❌ · CROI ✅ |
| Immunology & Allergy | ASCIA ✅ · ASI ✅ | EAACI Congress ✅ · AAAAI ✅ · WAO ❌ |
| General/Internal Medicine | **IMSANZ ASM ❌** · SOMANZ ❌ | ACP IM ✅ · RCP/RCPE ❌ |
| Geriatrics | ANZSGM ✅ · AAG ✅ | AGS ✅ · EuGMS ❌ · IAGG ❌ |
| Rehabilitation | RMSANZ ✅ · ANZSCoS ❌ | ISPRM ❌ |
| Palliative | **ANZSPM conference ❌** · PCA/Oceanic ✅ · Hospice NZ ✅ | EAPC ✅ · AAHPM ✅ |
| Clinical Pharmacology/Tox | ASCEPT ✅ | APAMT ❌ · EAPCCT ❌ |
| Genetics | HGSA ✅ | ASHG ✅ · ESHG ✅ · ACMG ✅ |
| Addiction | APSAD ⚠ (mapped Psychiatry) · RACP AChAM ❌ | ASAM ✅ · ISAM ❌ |
| Occupational | ANZSOM ⚠ (mapped Internal Medicine) · SPUMS ❌ · ASAM (aerospace) ❌ | ICOH ❌ |
| Sports & Exercise | ACSEP ✅ · SMA ✅ | IOC Prevention Conference ❌ · ACSM ✅ |
| Public Health | PHAA conferences ✅ · AFPHM ❌ | WCPH ❌ |

Physician courses: few are mandated. Hospitals expect ALS2 (adult) or APLS (paediatrics). Common CPD: POCUS (ASUM CCPU), ASHM s100 (ID/sexual health), PEPA (palliative), opioid prescriber accreditation (addiction), state radiation-use licence training (fluoroscopy for cardiology, GI and urology), spirometry (ANZSRS).

### 1.6 Mind, eyes, skin, imaging and labs

| Specialty | AU/NZ must-have | Intl |
|---|---|---|
| Psychiatry | RANZCP Congress ✅ · **RANZCP faculty conferences** (Child & Adolescent, Old Age, Forensic, Psychotherapy, Adult) ❌ · RANZCP branch conferences ❌ · TheMHS ✅ · ANZAPPL ✅ · SMHR ❌ | APA ✅ · RCPsych ✅ · EPA ✅ · WPA ❌ |
| Ophthalmology | RANZCO ✅ · RANZCO NZ/state branches ❌ · ANZGS ✅ · ANZSRS (ranzco.edu/anzsrs) ❌ | AAO ✅ · ESCRS ✅ · APAO ✅ · WOC ❌ · ASCRS ✅ · ARVO ✅ |
| Dermatology | ACD ASM ✅ · NZDS ❌ · Skin Cancer College ✅ | AAD ✅ · EADV ✅ · WCD ✅ · Dermoscopy World Congress ✅ |
| Radiology | RANZCR ASM ✅ · RANZCR NZ ✅ · **IRSA ❌** · ANZSNR ✅ · ASUM ✅ | RSNA ✅ · ECR ✅ · CIRSE ✅ · SIR ✅ · ISMRM ✅ |
| Radiation Oncology | RANZCR ASM (FRO stream) ✅ · TROG ⚠ (mapped Oncology) | ASTRO ✅ · ESTRO ✅ |
| Nuclear Medicine | ANZSNM ⚠ (mapped Radiology) | SNMMI ✅ · EANM ✅ |
| Pathology | RCPA Pathology Update ✅ · AACB ✅ · IAP ✅ | USCAP ✅ · ECP ✅ |

### 1.7 Cross-cutting

- **Indigenous health**: **AIDA Conference ❌** (aida.org.au) · Te ORA ✅ · LIME ❌ · NACCHO ❌ (the row that matched is the US NACCHO) · PRIDoC ❌.
- **Medical education**: ANZAHPE ✅ · ANZ Prevocational Medical Education Forum ❌ · SimHealth ❌ · AMEE ✅ · Ottawa ❌.
- **Medical administration**: **RACMA conference ❌** · ACHSM ✅ · ISQua ❌.
- **IMGs**: AMC exam preparation and state IMG orientation programs ❌. IMGs are a large share of Hoggy users who look for these.

---

## 2. Mandatory and recertification courses by role

Validity figures marked **(read)** were read on the provider's page this month (see `data/courses/catalogue.json`). Those marked **(verify)** are well known but were not read this run, so check them before showing them as facts.

### All registered doctors
| Requirement | What | How often |
|---|---|---|
| Medical Board of Australia CPD standard | 50 h/year with a CPD home: ≥12.5 h educational, ≥25 h reviewing performance + measuring outcomes (≥5 h each), and a written plan. Must address cultural safety, health inequity, professionalism and ethics | Every year |
| MCNZ recertification (Inpractice / college programs) | 50 h/year including cultural safety and health equity, plus an annual conversation, audit and peer review | Every year |
| Employer resuscitation | BLS (all), ALS1 (JMOs/ward), ALS2 (ED, ICU, anaesthesia, rapid response) | Usually every 1–2 years by hospital policy; ARC certificates are **recognised 4 years (read)** |

### By role
| Role | Expected/mandated courses | Expiry |
|---|---|---|
| Interns / PGY1–2 | BLS, ALS1 (or hospital equivalent), DETECT (NSW), hand hygiene (NHHI) | Hospital policy (often annual) |
| ED registrars and FACEMs | ALS2, APLS, EMST or ETM, POCUS (CCPU) | APLS **5 y (read)**, ALS2 4 y (read), EMST (verify; RACS offers a refresher) |
| Anaesthesia | EMAC (training), ALS2, CICO/airway. The **ANZCA CPD emergency-response requirement** covers several emergency responses each triennium (e.g. cardiac arrest/ALS, CICO, anaphylaxis, major haemorrhage, LAST) (verify exact rules) | Triennium |
| ICU | BASIC (first year), ALS2, ECMO for ECMO centres, ICU echo | ALS2 4 y |
| Surgical SET | **ASSET, CCrISP, EMST** (early SET), **TIPS**, **Operating with Respect** (RACS mandate) | EMST (verify); others one-off |
| O&G and GP obstetricians | **FSEP** (most hospitals require it annually or every 2 years) (verify by state), **PROMPT** (annual in many units), NeoResus (annual in maternity units), ALSO→PIMS/AIMS or REOT, DRANZCOG/CWH for GP obstetricians | Hospital policy |
| Paediatrics | APLS (or PLS for juniors), NeoResus/newborn life support, STABLE | APLS 5 y (read) |
| GPs | Practice accreditation needs CPR for clinical staff **at least every 3 years** (RACGP Standards) (verify current edition). Optional but item-linked: GPMHSC MHST (higher MHTP items), FPS (FPS items), ASHM s100 (s100 prescribing), MS-2 Step training, state opioid accreditation | CPR 3 y; prescriber accreditations renew per program |
| Rural generalists (ACRRM / RACGP RG) | ACRRM training requires approved emergency courses covering adult resus (ALS), paediatric resus (APLS/PEFRG), trauma (EMST/ETM) and, for obstetrics/anaesthesia ASTs, REOT/PIMS/AIMS or RACM/EMAC (verify on the current ACRRM handbook). Fellows keep emergency skills each triennium (REST, ALS2, PHEC, CRANAplus REC/MEC) | Triennium (verify) |
| GP anaesthetists | RACM or EMAC, Advanced Airway, ALS2 | Triennium |
| Doctors using fluoroscopy | State radiation-use licence training (ortho, cardiology, urology, GI) | 1–5 y, by state |
| IMGs | AMC MCQ/clinical, state orientation, BLS/ALS before starting | One-off / employer |
| Private hospitals / overseas locums | AHA BLS/ACLS/PALS often requested | **2 years** (AHA; verify) |
| NZ doctors | NZRC CORE Immediate/Advanced (ALS equivalents), NZRC newborn/paediatric courses | NZRC interval (commonly 2 y; resus.org.nz unreadable to us, verify) |

**Product implication:** courses need `certificateValidityYears` plus a "renew by" reminder. That is the feature doctors will open Hoggy for every year.

---

## 3. Coverage targets (24 months from Nov 2026)

### 3a. Conferences
Rule of thumb for "complete" in AU/NZ: for every specialty, **2 editions** of the college ASM, the national society ASM and the NZ meeting, **plus** state/branch meetings and the main SIG meetings. International: 2 editions of each flagship meeting in §1 (about 3–6 per specialty), with sourced dates.

| Specialty group | AU+NZ now | AU+NZ target | Intl flagships (2 editions each) |
|---|---|---|---|
| General Practice + Rural (incl. RACGP faculty days, RDA state meetings, Healthed evenings) | 7 | **120** | 10 |
| Surgery (general + subspecialty societies + RACS state ASMs) | 10 (+5 mis-mapped) | **60** | 20 |
| Anaesthesia + Pain (ANZCA regional CME, SIGs, NZSA, FPM) | 5 | **45** | 14 |
| Emergency Medicine (ACEM ASM/Winter/RRR, DFTB, state ED conferences) | 2 | **30** | 10 |
| Critical Care | 2 | **20** | 10 |
| Obstetrics & Gynaecology + Reproductive | 10 | **40** | 14 |
| Paediatrics (+ paeds sub-specialties) | 4 | **35** | 10 |
| Psychiatry + Addiction (RANZCP faculties and branches) | 6 | **40** | 8 |
| Physician specialties (each: society ASM ×2 + NZ + 1–2 SIG) | ~45 | **200** (about 12 per specialty) | 6 per specialty |
| Oncology + Radiation Oncology (incl. trial groups) | 11 | **45** | 12 |
| Radiology + Nuclear + Pathology | 15 | **45** | 12 |
| Ophthalmology, Dermatology, ENT, OMFS, Plastics | 8 (+1 mis-mapped) | **60** | 18 |
| Public health, Indigenous, Med Ed, Administration, Occ/Sports | ~25 | **70** | 10 |
| **Total (doctor-facing)** | **193** | **≈ 1,000** (5×; 10× ≈ 2,000 with half-day/evening CPD and workshops) | ≈ 350 sourced flagship editions |

Nursing, allied health, pharmacy and dentistry rows are useful but are not what doctors judge Hoggy on. Keep them, but do not count them towards the doctor targets.

### 3b. Courses (upcoming sessions, AU+NZ)
These are planning estimates from typical national schedules. They are not sourced counts.

| Course | Sessions now | Target (next 12 months) |
|---|---|---|
| ALS1 / ALS2 (ARC centres + ACRRM) | 459 | 500 (keep current) |
| APLS + PLS (+ NZ) | 77 | 100 |
| EMST (RACS) | 0 | 60–80 |
| CCrISP / ASSET / TIPS | 0 | 30 / 20 / 15 |
| ETM | 0 | 20–30 |
| EMAC | 0 | 40 |
| FSEP face-to-face | 0 | 100+ |
| PROMPT (state programs) | 0 | 40+ |
| NeoResus / NZ newborn | 0 | 100+ (hospital-run) |
| BASIC (ICU) | 0 | 20 |
| ASUM CCPU units / POCUS | 0 | 50 |
| AO Trauma | 0 | 15 |
| ACRRM (REST, PEFRG, ANR, REOT, PHEC, RACM, Airway, POCUS) | 39 | 100 |
| CRANAplus REC / MEC | 0 | 50 |
| PIMS / AIMS (AMaRE) | 0 | 15 |
| GP: MHST/FPS, SCCA, FP NSW IUD/certificate, ASHM s100, MS-2 Step | 0 | 150 (many are online: list as "online, on demand") |
| NZRC CORE (Immediate/Advanced) | 4 | 60 |
| **Total** | **579** | **≈ 1,600–1,800 (3×)**. 10× (≈ 5,800) needs hospital-run courses and NZ providers |

### 3c. How to measure "complete"
1. **P1 coverage**: share of `expert-gaps.json` priority-1 items with an upcoming row (or sessions) that carries evidence. Today 120/161 match by name, but **0** have B30 evidence. Target: 100% present, ≥80% evidenced.
2. **Local-first ratio**: for each of the 30 largest specialties, ≥5 AU/NZ upcoming rows (today 2 of 30 specialties meet it).
3. **No zero cells**: no doctor specialty with 0 AU/NZ rows (today 12).
4. **Course breadth**: at least one bookable course type per training program (ACEM, ANZCA, CICM, RACS, RANZCOG, RACP-paeds, RACGP, ACRRM). Today only ACEM, RACP-paeds and ACRRM are covered.

---

## 4. Quality rubric for rows

Score every new row before merge. A row needs **Relevance ≥2, Legitimacy ≥2, correct specialty** and B30 evidence to show as confirmed.

| Dimension | 3 | 2 | 1 | 0 → reject |
|---|---|---|---|---|
| **Clinical relevance** | College/society scientific meeting or accredited course for doctors | Multidisciplinary clinical meeting with a doctor stream | Research/basic-science or non-doctor professional meeting | Business, investment, marketing or wellness event |
| **Legitimacy** | Run by a college, society, university, health service or recognised course owner | PCO-run on behalf of a named society (Arinex, ICMS, Kenes, MCI, WALDRONSMITH, Encanta, Taylored Images and the like) | Commercial education company with real faculty and CPD accreditation (Healthed, GPCE, HealthCert, Medcast): label "commercial" | Predatory or vanity brand (below), no traceable society |
| **AU-relevance** (`auRelevance`) | In AU/NZ, or the flagship meeting of the specialty worldwide | Asia-Pacific regional meeting, or a UK/US meeting with a large ANZ following | Other national meeting abroad in English | Other national meeting in a local language with no international stream (keep the row, but rank it last for AU users) |
| **Specialty mapping** | The organiser's own specialty, canonical (`tools/specialties.json`) | — | — | Mapped to a parent ("Surgery") when the canonical child exists (ENT, Plastics, Vascular, Hand, Neurosurgery…) |

### Predatory / vanity brands and patterns: never add (flag them in the shard instead)
- **OMICS family**: OMICS International, *Conference Series LLC Ltd* (conferenceseries.com), Longdom, SciTechnol, Hilaris, iMedPub, Pulsus Group, Allied Academies, EuroSciCon.
- **Mass-topic organisers**: WASET (World Academy of Science, Engineering and Technology: "International Conference on X" for every city and month), Scientific Federation, Meetings International, Magnus Group, Coalesce Research Group, United Scientific Group, Innovinc, PEERS Alley Media, Scholars Conferences, BIT Congress ("World Congress of …" series).
- **Patterns**: "World Congress / Global Summit / International Conference on [Disease] & [unrelated Disease]"; 2-day hotel meetings with dozens of unrelated "keynotes"; "abstract accepted within 48 h"; CPD credits "from" an unnamed body; organiser address is a virtual office; the same template site for 100+ topics; "Webinar + Expo" brands; no named society, scientific committee or past programme. **Mega-listing aggregators** (10times, allconferencealert, conferenceindex, emedevents, waset, eventbrite listings, acecc.org.au) are leads only, never organisers or date sources.
- **Industry-only events**: pharma/device product launches, sponsored dinner meetings, satellite symposia (list the parent meeting instead), "masterclasses" run by a single company with no independent organiser. Exception: established device-maker education with independent faculty (e.g. AO Foundation), labelled.
- **Holiday CME** (ski, cruise, resort "conferences"): include only if the organiser is a college, society, university or accredited CPD provider, and label it "CPD holiday".
- **Cosmetic short courses** by commercial "academies" (injectables, lasers): exclude unless run by ACD, ASAPS, ACCSM or a university.

---

## 5. Problems in the current data (fix before wave 2)

**Specialty mapping (rows exist, but the specialty view shows 0 AU):**

| id | now | should be |
|---|---|---|
| `asohns-asm` | Surgery | Otolaryngology (ENT) |
| `asps-plastic-surgery-meeting` | Surgery | Plastic Surgery |
| `anzsvs-asm` | Surgery | Vascular Surgery |
| `australian-pain-society-asm` | Anaesthesia | Pain Medicine |
| `sleep-downunder` | Respiratory | Sleep Medicine |
| `anzsnm-asm` | Radiology | Nuclear Medicine |
| `anzsom-asm-2027` | Internal Medicine | Occupational Medicine |
| `apsad-conference` | Psychiatry | Addiction Medicine |
| `trog-asm-2027` | Oncology | Radiation Oncology |
| `fsanz-annual-conference`, `iffs-world-congress-2027` | O&G | Reproductive Medicine |
| `otaus-national-conference`, `apa-physiotherapy-conference` | Rehabilitation Medicine | Allied Health |
| `hsr-2026-wellington` | Public Health | Health Services Research |
| `lorne-protein-structure-function-2027` | Genetics | Medical Research |
| `miccai-2027-auckland` | Radiology | Health Informatics (medical image computing, not a clinical radiology meeting) |

Better still: allow a secondary specialty (`specialties: []`), so that APSAD shows under both Psychiatry and Addiction.

**Duplicates and conflicts:**
- `rdaa-rural-medicine-australia-2027` (Adelaide, 27–29 Oct 2027) and `rdaa-rural-medicine-australia-2028` duplicate the joint ACRRM/RDAA **RMA** series (`rma-rural-medicine-australia`, Brisbane, 21–24 Oct 2027). All are estimates. RMA26 was Adelaide 21–24 Oct 2026, so the RDAA rows look rolled forward from it. **Remove the RDAA rows** and keep one RMA series.
- `adea-conference-2027` and `adea-conference-2028` duplicate the **Australasian Diabetes Congress** (ADS + ADEA joint, same dates 18–20 Aug 2027). The ADEA row also gives a different city (Melbourne vs Adelaide). **Merge** into `australasian-diabetes-congress`.
- `racgp-gp-conference` (GP27, 22–24 Oct 2027, estimated) overlaps RMA27. Re-check: GP2x has usually run in Oct/Nov, but the date is not sourced.
- Nearly every AU college ASM with a 2027 row lacks its **2028** edition: ANZCA, RACS, ACEM, CICM, RANZCOG, RACP, RANZCP, RANZCO, CSANZ, TSANZ, ANZAN, ACD and ESA. These are cheap to add as estimates with `estimateReason`.

**Text corruption (from `data/shards/exp-europe.json`):** 114 European rows have mangled names: "Congrèss" (164 occurrences), "Congrèso" (64), "Congrèsso" (60), "Thérapies", e.g. `esmo-tat-2027` "ESMO Targeted Anticancer Thérapies Congrèss 2027", `eco-european-congress-on-obesity-2027`, `rcoa-annual-congress-2027`. A find-and-replace for French accents ran over English, Spanish and Italian names. Fix in the shard and re-merge; search for "congress" currently misses these rows.

**Legitimacy flags:**
- `closing-the-gap-indigenous-health-2026` is run by *Indigenous Conference Services* (icsconferences.org), a commercial events company, not AIDA or NACCHO. Keep it, label it commercial, and add AIDA and NACCHO (§1.7).

---

## 6. Wave-2 order of work (for the PM)

1. Fix §5 (mapping, duplicates). This costs nothing and shows ENT, Plastics, Vascular, Sleep, Nuclear Medicine, Occ Med and Addiction with local rows immediately.
2. Add the 41 missing **priority-1** items in `expert-gaps.json` (top 20 listed in the review). Then add the 2028 editions of every AU college ASM.
3. Courses: RACS courses (EMST/CCrISP/ASSET/TIPS) need a person, because of the Cloudflare block. Parseable now or soon: ACRRM PHEC/RACM/Airway/POCUS (same parser), ANZCA EMAC, ETM, FSEP, ASUM CCPU, CRANAplus, AMaRE PIMS/AIMS, NeoResus, BASIC and the GPMHSC course list.
4. NZ layer: NZSA, NZSOHNS (ORL), NZDS, CSANZ NZ, TSANZ NZ branch, NZ RANZCO branch, NZRC courses (needs resus.org.nz allowlisted).
5. Add aliases so search finds the old names: "ALSO" finds PIMS/AIMS, "RESUS4KIDS" finds KidsResus, "EMST" finds ATLS, "BSS" finds ASSET.
