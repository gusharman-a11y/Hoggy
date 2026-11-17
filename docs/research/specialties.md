# Specialty names: canonical list and mapping

The home page counted **179 specialties** because the same field was spelled several ways
("Allergy & Immunology" / "Allergy and Immunology", "Anaesthesia" / "Anaesthesiology",
"Infectious Disease" / "Infectious Diseases") and because narrow sub-specialty labels with one or two
rows each sat beside their parent. After normalising there are **71**.

- Mapping and canonical list: `tools/specialties.json` (shared lookup in `tools/specialties.js`).
- `tools/normalise-specialties.js` rewrites the `specialty` value in `data/conferences.js` and every
  `data/shards/*.json`, leaving the rest of each file byte-for-byte. It exits 1 on an unmapped value.
- `tools/merge-shards.js` maps shard rows to the canonical name before validation, rejects any shard row
  whose specialty is not canonical (`unknown specialty ...`), and refuses to write if a base row is not canonical.
  So the daily job cannot bring a duplicate back: a new label must be added to `canonical` (or mapped) on purpose.
- Lookup is exact first, then loose: case, spacing, punctuation, "and" vs "&", a trailing plural, and US
  spellings (pediatr-, anesth-, gynec-, hematol-, orthoped-) are ignored.

## Rules used
1. Australian spelling and the app's existing chip names (`HUES` in `app.js`): Anaesthesia, Paediatrics,
   Orthopaedics, Obstetrics & Gynaecology, Respiratory, Infectious Disease, Critical Care, General Practice.
2. "&" rather than "and" in canonical names.
3. Sub-specialty labels with only a handful of rows join their parent when that is how the field is organised
   in Australia (colorectal, breast, endocrine, trauma and bariatric surgery are general surgery; hepatology is
   gastroenterology; paediatric medical subspecialties are Paediatrics; every nursing area is Nursing).
4. Cancer meetings named by organ or by the treating discipline (neuro-, GI, gynaecological, surgical oncology)
   go to Oncology. Radiation Oncology stays separate (its own college faculty). Blood cancers go to Haematology.
5. Distinct professions or recognised specialties stay separate even when small (Optometry, Medical Physics,
   Nuclear Medicine, Forensic Medicine, Addiction Medicine, Paediatric Surgery, Spine Surgery, Hand Surgery).

## Canonical list (71) with row counts after normalising
Addiction Medicine (4), Allergy & Immunology (14), Allied Health (21), Anaesthesia (70), Cardiology (152), Cardiothoracic Surgery (9), Clinical Pharmacology & Toxicology (4), Critical Care (26), Dentistry (30), Dermatology (45), Emergency Medicine (29), Endocrinology (67), Forensic Medicine (2), Gastroenterology (46), General Medicine (3), General Practice (68), Genetics (18), Geriatrics (23), Haematology (51), Hand Surgery (4), Health Informatics (10), Health Management (5), Health Services Research (8), Immunology (8), Indigenous Health (3), Infectious Disease (41), Internal Medicine (52), Medical Education (12), Medical Ethics (1), Medical Physics (2), Medical Research (3), Nephrology (43), Neurology (84), Neurosurgery (10), Nuclear Medicine (2), Nursing (51), Nutrition (11), Obesity Medicine (6), Obstetrics & Gynaecology (93), Occupational Medicine (4), Oncology (95), Ophthalmology (60), Optometry (5), Oral & Maxillofacial Surgery (5), Orthopaedics (67), Otolaryngology (ENT) (20), Paediatric Surgery (3), Paediatrics (65), Pain Medicine (8), Palliative Care (13), Pathology (36), Pharmacy (35), Plastic Surgery (14), Psychiatry (46), Public Health (35), Radiation Oncology (8), Radiology (101), Rehabilitation Medicine (15), Reproductive Medicine (8), Respiratory (40), Rheumatology (34), Sexual Health (6), Sleep Medicine (4), Spine Surgery (6), Sports Medicine (15), Surgery (108), Transplantation (5), Urology (38), Vascular Medicine (1), Vascular Surgery (9), Wound Care (3)

## Variants mapped (only values that changed; 365 rows in conferences.js, 740 values across 28 files)
| Variant | Rows (conferences.js) | Canonical | Reason |
|---|---|---|---|
| Allergy and Immunology | 3 | Allergy & Immunology | "and" vs "&" |
| Occupational Therapy | 4 | Allied Health | allied health profession; umbrella chip |
| Paramedicine | 2 | Allied Health | allied health profession in AU (AHPRA-registered) |
| Physical Therapy | 3 | Allied Health | US name for physiotherapy; allied health |
| Physiotherapy & Rehabilitation | 1 | Allied Health | World Physiotherapy congress; allied health |
| Psychology | 2 | Allied Health | APA convention; APS psychology rows were already under Allied Health |
| Speech Pathology | 2 | Allied Health | allied health profession |
| Anaesthesiology | 38 | Anaesthesia | same specialty, AU name (ANZCA) |
| Cardiovascular Medicine | 2 | Cardiology | synonym |
| Hypertension | 2 | Cardiology | HBPRCA blood-pressure meeting; cardiology chip |
| Thoracic Surgery | 1 | Cardiothoracic Surgery | RACS specialty is Cardiothoracic |
| Clinical Pharmacology | 2 | Clinical Pharmacology & Toxicology | ASCEPT covers pharmacology and toxicology |
| Toxicology | 2 | Clinical Pharmacology & Toxicology | clinical toxicology (NACCT) |
| Neurocritical Care | 2 | Critical Care | ICU subspecialty |
| Skin Cancer Medicine | 2 | Dermatology | Skin Cancer College; skin cancer sits under dermatology for search (judgement call) |
| Emergency | 5 | Emergency Medicine | truncated name |
| Wilderness Medicine | 2 | Emergency Medicine | pre-hospital/remote emergency care |
| Diabetes | 2 | Endocrinology | endocrine chip covers diabetes |
| Diabetes Education | 2 | Endocrinology | ADEA; diabetes care |
| Endocrinology & Diabetes | 3 | Endocrinology | same |
| Hepatology | 3 | Gastroenterology | in AU hepatology is part of gastroenterology (GESA) |
| Family Medicine | 5 | General Practice | US/intl name for general practice |
| GP | 2 | General Practice | abbreviation |
| Primary Care | 4 | General Practice | synonym |
| Rural Health | 0 (+1 in shards) | General Practice | rural generalism is GP-based in AU (ACRRM/RACGP) |
| Rural Medicine | 2 | General Practice | RDAA meeting; rural GPs |
| Gene and Cell Therapy | 1 | Genetics | ESGCT; genetics chip |
| Gene Therapy | 1 | Genetics | ASGCT; genetics chip |
| Haematological Oncology | 2 | Haematology | blood cancers sit with haematology |
| Haematology & Oncology | 1 | Haematology | DGHO; haematology-led society |
| Transfusion Medicine | 1 | Haematology | haematology subspecialty |
| Digital Health | 1 | Health Informatics | synonym |
| Imaging Informatics | 2 | Health Informatics | SIIM; informatics |
| Medical Policy | 2 | Health Management | AMA House of Delegates; health policy/management |
| Health Economics | 3 | Health Services Research | ISPOR; HEOR |
| Medical Decision Making | 1 | Health Services Research | SMDM; health services research |
| Infection Control | 1 | Infectious Disease | infection prevention is part of ID |
| Infection Prevention | 4 | Infectious Disease | same |
| Infectious Diseases | 9 | Infectious Disease | plural; app chip is singular |
| Travel Medicine | 1 | Infectious Disease | ISTM; ID-led |
| Hospital Medicine | 1 | Internal Medicine | hospitalist = internal medicine |
| Biochemistry & Molecular Biology | 1 | Medical Research | FAOBMB; basic science |
| Neuroscience | 4 | Neurology | neuroscience societies; neurology chip (judgement call) |
| Critical Care Nursing | 2 | Nursing | nursing meeting; all nursing areas share one chip |
| Emergency Nursing | 1 | Nursing | nursing meeting; all nursing areas share one chip |
| Gastroenterology Nursing | 2 | Nursing | nursing meeting; all nursing areas share one chip |
| Neonatal Nursing | 1 | Nursing | nursing meeting; all nursing areas share one chip |
| Nephrology Nursing | 2 | Nursing | nursing meeting; all nursing areas share one chip |
| Neuroscience Nursing | 2 | Nursing | nursing meeting; all nursing areas share one chip |
| Nurse Anaesthesia | 2 | Nursing | nursing meeting; all nursing areas share one chip |
| Nurse Practitioner Practice | 0 (+2 in shards) | Nursing | nursing |
| Nursing Leadership | 2 | Nursing | nursing meeting; all nursing areas share one chip |
| Obstetric Nursing | 1 | Nursing | nursing (AWHONN) |
| Oncology Nursing | 1 | Nursing | nursing meeting; all nursing areas share one chip |
| Paediatric Nursing | 1 | Nursing | nursing meeting; all nursing areas share one chip |
| Pediatric Nursing | 1 | Nursing | nursing meeting; all nursing areas share one chip |
| Perianesthesia Nursing | 2 | Nursing | nursing meeting; all nursing areas share one chip |
| Psychiatric Nursing | 2 | Nursing | nursing meeting; all nursing areas share one chip |
| Clinical Nutrition | 5 | Nutrition | ESPEN/ASPEN/BAPEN |
| Nutrition Science | 1 | Nutrition | ASN |
| Gynaecology | 8 | Obstetrics & Gynaecology | O&G is one specialty (RANZCOG) |
| Midwifery | 2 | Obstetrics & Gynaecology | maternity care; no separate chip (judgement call) |
| Obstetrics | 2 | Obstetrics & Gynaecology | O&G |
| Obstetrics and Gynaecology | 33 | Obstetrics & Gynaecology | "and" vs "&" |
| Women's Health | 3 | Obstetrics & Gynaecology | menopause societies; O&G |
| Gastrointestinal Oncology | 2 | Oncology | cancer meetings -> Oncology |
| Gynaecologic Oncology | 5 | Oncology | spelling variant; cancer meetings -> Oncology |
| Gynaecological Oncology | 2 | Oncology | cancer meetings -> Oncology |
| Neuro-oncology | 2 | Oncology | cancer meetings -> Oncology |
| Neuro-Oncology | 2 | Oncology | case variant |
| Surgical Oncology | 3 | Oncology | SSO/ESSO; cancer meetings -> Oncology (judgement call) |
| Optometry & Ophthalmology | 1 | Optometry | World Council of Optometry congress |
| Maxillofacial Surgery | 3 | Oral & Maxillofacial Surgery | same specialty |
| Oral and Maxillofacial Surgery | 2 | Oral & Maxillofacial Surgery | "and" vs "&" |
| ENT | 2 | Otolaryngology (ENT) | same specialty |
| Otolaryngology | 17 | Otolaryngology (ENT) | same specialty; label shows both names |
| Paediatric Urology | 1 | Paediatric Surgery | ESPU; paediatric surgical |
| Neonatology | 2 | Paediatrics | paediatric subspecialty (BAPM) |
| Paediatric Critical Care | 2 | Paediatrics | paediatric medical subspecialty; Paediatrics chip |
| Paediatric Endocrinology | 7 | Paediatrics | paediatric medical subspecialty; Paediatrics chip |
| Paediatric Gastroenterology | 2 | Paediatrics | paediatric medical subspecialty; Paediatrics chip |
| Paediatric Infectious Diseases | 1 | Paediatrics | paediatric medical subspecialty; Paediatrics chip |
| Paediatric Neurology | 1 | Paediatrics | paediatric medical subspecialty; Paediatrics chip |
| Paediatric Oncology | 4 | Paediatrics | paediatric medical subspecialty; Paediatrics chip |
| Clinical Biochemistry | 2 | Pathology | laboratory medicine (RCPA) |
| Laboratory Medicine | 3 | Pathology | pathology |
| Microbiology | 1 | Pathology | ASM Microbe; laboratory |
| Molecular Pathology | 1 | Pathology | pathology |
| Pharmacy Education | 2 | Pharmacy | pharmacy |
| Burn Care | 1 | Plastic Surgery | burns sit with plastic surgery |
| Burns and Plastic Surgery | 2 | Plastic Surgery | same |
| Forensic Psychiatry | 2 | Psychiatry | psychiatry subspecialty |
| Mental Health | 2 | Psychiatry | TheMHS mental health services |
| Preventive Medicine | 1 | Public Health | Swedish Preventionsdagen; public health |
| Public Health Research | 2 | Public Health | public health |
| Breast Imaging | 2 | Radiology | radiology |
| Interventional Radiology | 3 | Radiology | radiology |
| Neurointervention | 2 | Radiology | SNIS; mostly interventional neuroradiologists (judgement call) |
| Neuroradiology | 4 | Radiology | radiology |
| Paediatric Radiology | 2 | Radiology | radiologists, not paediatricians |
| Rehabilitation | 13 | Rehabilitation Medicine | AU name is Rehabilitation Medicine (AFRM) |
| Pulmonary Vascular Disease | 1 | Respiratory | PVRI; respiratory chip |
| Pulmonology | 8 | Respiratory | US name |
| Respiratory & Critical Care | 1 | Respiratory | CHEST; respiratory-led |
| Respiratory Medicine | 16 | Respiratory | synonym; app chip is "Respiratory" |
| Family Planning | 2 | Sexual Health | contraception/abortion care = sexual & reproductive health |
| Sexual Medicine | 2 | Sexual Health | rows are ASHM and WAS sexual health congresses |
| Bariatric Surgery | 2 | Surgery | general surgery subspecialty |
| Breast Surgery | 4 | Surgery | general surgery subspecialty |
| Colorectal Surgery | 8 | Surgery | general surgery subspecialty |
| Endocrine Surgery | 2 | Surgery | general surgery subspecialty |
| Trauma Surgery | 3 | Surgery | general surgery subspecialty |

## Ambiguous, left alone (kept as their own canonical name)
- **General Medicine** (3): the Finnish and Swedish national medical congresses (Läkarstamman, Lääkäripäivät),
  which cover all specialties. Not Internal Medicine, so not merged. A future "Multi-specialty" label may fit better.
- **Immunology** (8) vs **Allergy & Immunology** (14): Immunology rows mix basic-science societies (EFIS, BSI, ASI)
  with allergy academies (AAAAI, EAACI) and ESID. The allergy academies arguably belong in Allergy & Immunology,
  but the mapping is per label, not per row, so the label was kept.
- **Allied Health** (21): now an umbrella (psychology, audiology, dietetics, speech pathology, OT,
  physiotherapy, paramedicine). If allied health users grow, split it into professions again.
- **Medical Ethics** (1, Swedish Etikdag): no good parent.
- **Medical Physics** (2, ACPSEM/AAPM): spans radiation oncology and imaging; a separate profession.
- **Vascular Medicine** (1, Australasian College of Phlebology): phlebology is its own field, not vascular surgery.
- **Hand Surgery** (4) and **Spine Surgery** (6): both are shared between orthopaedics and plastics/neurosurgery.
- **Obesity Medicine** (6): multidisciplinary (ECO, ObesityWeek, ANZOS); not forced into Endocrinology.
- **Wound Care** (3), **Sleep Medicine** (4), **Nuclear Medicine** (2), **Indigenous Health** (3),
  **Reproductive Medicine** (8), **Transplantation** (5), **Medical Research** (3): distinct enough to keep.

## Judgement calls worth a second look
Skin Cancer Medicine -> Dermatology (Skin Cancer College members are mostly GPs); Neuroscience -> Neurology
(SfN/CAN are basic science); Neurointervention -> Radiology; Midwifery -> Obstetrics & Gynaecology;
Surgical Oncology -> Oncology; Paediatric Critical Care / Oncology -> Paediatrics; Psychology -> Allied Health.
Each is one line in `tools/specialties.json` to change.

## Not covered here
Saved user profiles that hold an old specialty (e.g. "Anaesthesiology") will no longer match a chip; the app
side (profile select / match score) is owned by the app code, not this data change.
