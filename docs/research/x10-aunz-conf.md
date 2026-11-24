# x10-aunz-conf: Australian and New Zealand conferences (research run 18 Nov 2026)

Tag `aunz-conf`. Outputs: `data/shards/x10-aunz-conf.json` (46 new rows, all `datesConfirmed: true` with `datesSourceUrl`, `datesQuote`, `verifiedOn: 2026-11-18`) and `data/shards/provenance-x10-aunz-conf.json` (59 evidence entries for existing rows). No other files touched; nothing committed.

## How the run worked
- Every date was read this run from the organiser's or society's own page, fetched with the repo's polite client (`tools/courses/http.js`: robots.txt, at least 3 s per host, generic User-Agent, https only; challenges, 401/403 and robots refusals skipped, never worked around). Quotes were cut by `tools/dates/extract.js` (`findRanges` + `quoteAround`) from the saved page text, never typed by hand; each row and entry was checked with `tools/evidence.js` before writing.
- Web search, venue calendars (ICC Sydney, PCEC, Te Pae, Cairns, GCCEC) and acecc.org.au listings were used as leads only; none is a date source.
- Existing rows: `tools/verify-dates.js --ids <all 196 upcoming AU/NZ estimated or legacy rows>` was run on a temp copy (32 entries). I then went through its review list by hand: where the page shows several ranges and the row's own dates are one of them, the quote beside that range was taken (16 entries), and 14 more entries were written from event pages I found (corrections included). These are all merged into the one provenance shard.
- Duplicate check: series key + year, normalised name + year, and url host + start date against `data/conferences.js` (the same keys the merge and validator use). Where the meeting already existed, I wrote a provenance entry and did not add a row.
- `cpdHours` is 0 on every row (several ACM pages state CPD hours, but the merge zeroes figures that have not been re-checked by hand).
- Validation on a fresh temp copy with only these two shards added: `node tools/merge-shards.js` gave added 46, provenance withEvidence 59, downgraded by the evidence rule 0. `node tools/validate-data.js` gave **0 errors** and 24 warnings, none of them from these shards (the same warnings appear without them). Confirmed went from 707 to 757; confirmed with evidence went from 0 to 105; legacy went from 707 to 652; estimated went from 1336 to 1332.

## New rows: 46
By specialty: Psychiatry 8, Nursing/midwifery 6, Anaesthesia 5, Cardiology 3, Emergency Medicine 2, Paediatrics 2, General Practice 2, and 1 each for Pain Medicine, Plastic Surgery, Rehabilitation Medicine, General Medicine, O&G, Immunology, Pathology, Cardiothoracic Surgery, Nephrology, Rheumatology, Palliative Care, Orthopaedics, Oncology, Infectious Disease, Medical Physics, Neurology, Internal Medicine and Sexual Health.
By state: NSW 10, WA 8, SA 7, QLD 6, VIC 6, NZ 6, TAS 2, ACT 1. By year: 2026 1, 2027 43, 2028 2.
Kinds of meeting: college faculty, branch and SIG meetings (RANZCP faculties and branches, ANZCA/ACE regional meetings and SIGs, FPM, RACP AMD and AChSHM, AOA WA papers day), society meetings and workshops (CSANZ, ANZSN DNT, ASI, AACB/RCPA, ANZSCTS NZ, ACCCN, ACM national and state), rural courses (Rural Health West) and multidisciplinary meetings (Hauora Taiwhenua rural health, MWIA, Immunisation Coalition, SIOP 2027 Sydney, IACAPAP 2028 Auckland).

| id | dates | city | specialty | dates read on |
|---|---|---|---|---|
| fpm-symposium-2027 | 2027-04-30 | Adelaide | Pain Medicine | <https://www.anzca.edu.au/events-and-courses/2027-fpm-symposium> |
| anzca-rural-sig-meeting-2027 | 2027-03-05..2027-03-07 | Kingscliff | Anaesthesia | <https://www.anzca.edu.au/events-and-courses/2027-rural-sig-meeting> |
| nsw-ace-winter-meeting-2027 | 2027-06-19 | Sydney | Anaesthesia | <https://www.anzca.edu.au/events-and-courses/2027-nsw-ace-winter-meeting> |
| wa-ace-country-conference-2027 | 2027-06-11..2027-06-13 | Broome | Anaesthesia | <https://www.anzca.edu.au/events-and-courses/2027-wa-ace-country-conference> |
| qld-ace-sanctuary-symposium-2027 | 2027-07-17..2027-07-18 | Sanctuary Cove | Anaesthesia | <https://www.anzca.edu.au/events-and-courses/2027-qld-ace-annual-conference> |
| anzca-perioperative-medicine-sig-2026 | 2026-11-26..2026-11-28 | Hobart | Anaesthesia | <https://www.anzca.edu.au/events-and-courses/2026-perioperative-medicine-sig-meeting> |
| ranzcp-sa-branch-conference-2027 | 2027-03-13 | Adelaide | Psychiatry | <https://www.ranzcp.org/events-learning/ranzcp-sa-branch-conference-2027> |
| ranzcp-fcap-conference-2027 | 2027-09-01..2027-09-03 | Canberra | Psychiatry | <https://www.ranzcp.org/events-learning/faculty-of-child-and-adolescent-psychiatry-2027-conference> |
| csanz-hrs-pfa-summit-2027 | 2027-06-04..2027-06-05 | Adelaide | Cardiology | <https://www.csanz.edu.au/EventDetail?EventKey=PFA2027> |
| csanz-indigenous-cardiovascular-health-conference-2027 | 2027-08-04..2027-08-05 | Auckland | Cardiology | <https://www.csanz.edu.au/EventDetail?EventKey=ICHC2027> |
| csanz-adult-congenital-heart-symposium-2027 | 2027-11-11..2027-11-13 | Barossa | Cardiology | <https://www.csanz.edu.au/EventDetail?EventKey=ANZACHD27> |
| asps-advanced-aesthetic-workshop-2027 | 2027-03-05..2027-03-06 | Melbourne | Plastic Surgery | <https://plasticsurgery.org.au/event/advanced-aestheticplastic-surgery-workshop/> |
| tbi-conference-nz-2027 | 2027-03-09..2027-03-11 | Christchurch | Rehabilitation Medicine | <https://willorganise.eventsair.com/2027-tbi-conference/> |
| imhaanz-conference-2027 | 2027-03-10..2027-03-12 | Christchurch | Psychiatry | <https://imhaanz.nz/conference2027/> |
| mwia-western-pacific-regional-conference-2027 | 2027-10-22..2027-10-24 | Melbourne | General Medicine | <https://afmw.org.au/mwiawp2027/> |
| ages-perioperative-surgical-meeting-2027 | 2027-08-12..2027-08-14 | Sydney | Obstetrics & Gynaecology | <https://events.ages.com.au/psm2027/> |
| asi-mucosal-immunology-microbiome-symposium-2027 | 2027-05-11..2027-05-14 | Noosa | Immunology | <https://www.immunology.org.au/events/ASI-Mucosal-Immunology-and-Microbiome-Symposium-2027/> |
| rcpa-aacb-chemical-pathology-course-2027 | 2027-02-08..2027-02-12 | Brisbane | Pathology | <https://www.aacb.asn.au/AACB/Events/Event_Display.aspx?EventKey=CPC2027&WebsiteKey=d4c31fa4-467a-4959-b48b-cae3ea93e516> |
| anzscts-aotearoa-cardiothoracic-meeting-2027 | 2027-04-02..2027-04-04 | Christchurch | Cardiothoracic Surgery | <https://anzscts.org/events/annual-cardiothoracic-surgery-meeting-of-aotearoa-nz-2027/> |
| anzsn-dnt-workshop-2027 | 2027-03-14..2027-03-16 | Kingscliff | Nephrology | <https://anzsnevents.com/anzsn-dnt-2027/> |
| rhw-react-karratha-2027 | 2027-04-03..2027-04-04 | Karratha | Emergency Medicine | <https://ruralhealthwest.eventsair.com/2027-react-karratha-april/eoi/Site/Register> |
| rhw-neostars-northam-2027 | 2027-04-30 | Northam | Paediatrics | <https://ruralhealthwest.eventsair.com/2027-neostars-northam-april/eoi/Site/Register> |
| rhw-peaches-geraldton-2027 | 2027-03-05 | Geraldton | Paediatrics | <https://ruralhealthwest.eventsair.com/2027-peaches-geraldton/eoi/Site/Register> |
| rhw-tide-perth-2027 | 2027-03-19 | Perth | General Practice | <https://ruralhealthwest.eventsair.com/2027-tide-perth-march/eoi/Site/Register> |
| rhw-emergency-airway-busselton-2027 | 2027-02-05 | Busselton | Emergency Medicine | <https://ruralhealthwest.eventsair.com/2027-emergency-airway-management-skills-eam-busselton/registration/Site/Register> |
| ara-asm-2028 | 2028-05-06..2028-05-09 | Sydney | Rheumatology | <https://rheumatology.org.au/For-Healthcare-Professionals/CPD-and-Upcoming-Events/ASM-2028-and-2029> |
| hauora-taiwhenua-national-rural-health-conference-2027 | 2027-04-29..2027-05-01 | Christchurch | General Practice | <https://htrhn.org.nz/event/national-rural-health-conference-2027/> |
| anzspm-medical-surgical-update-2027 | 2027-11-04..2027-11-06 | Melbourne | Palliative Care | <https://www.anzspm.org.au/Web/News/Articles/Help%20Shape%20the%20Medical%20and%20Surgical%20Update%202027.aspx> |
| ranzcp-act-branch-conference-2027 | 2027-03-05..2027-03-07 | Thredbo | Psychiatry | <https://www.ranzcp.org/events-learning/ranzcp-act-branch-conference-2027> |
| ranzcp-fclp-conference-2027 | 2027-08-26..2027-08-28 | Adelaide | Psychiatry | <https://www.ranzcp.org/events-learning/faculty-of-consultation-liaison-psychiatry-2027-conference> |
| ranzcp-child-adolescent-forensic-conference-2027 | 2027-10-07..2027-10-09 | Melbourne | Psychiatry | <https://www.ranzcp.org/events-learning/section-of-child-and-adolescent-forensic-psychiatry-2027-conference> |
| ranzcp-fpoa-conference-2027 | 2027-10-20..2027-10-22 | Adelaide | Psychiatry | <https://www.ranzcp.org/events-learning/faculty-of-psychiatry-of-old-age-2027-conference> |
| iacapap-world-congress-2028 | 2028-09-19..2028-09-22 | Auckland | Psychiatry | <https://www.ranzcp.org/events-learning/28th-world-congress-of-iacapap> |
| acm-national-conference-2027 | 2027-10-12..2027-10-14 | Hobart | Nursing | <https://midwives.org.au/EventDetail?EventKey=2027NATCON> |
| acm-vic-state-conference-2027 | 2027-05-07 | Melbourne | Nursing | <https://midwives.org.au/EventDetail?EventKey=2027057VIC> |
| acm-qld-state-conference-2027 | 2027-05-21..2027-05-22 | Sunshine Coast | Nursing | <https://midwives.org.au/EventDetail?EventKey=20270521QS> |
| acm-sa-state-conference-2027 | 2027-06-04 | Hahndorf | Nursing | <https://midwives.org.au/EventDetail?EventKey=202706SABC> |
| acm-wa-state-conference-2027 | 2027-07-30 | Perth | Nursing | <https://midwives.org.au/EventDetail?EventKey=20270730WA> |
| aoa-wa-branch-scientific-papers-day-2027 | 2027-02-20 | Perth | Orthopaedics | <https://aoa.org.au/events/key-aoa-events/detail/10efb19b-3e96-4cef-9fe2-20f92a7af0ca> |
| siop-congress-2027-sydney | 2027-09-08..2027-09-11 | Sydney | Oncology | <https://anzchog.org/events/siop-2027/> |
| immunisation-coalition-asm-2027 | 2027-02-14..2027-02-15 | Melbourne | Infectious Disease | <https://immunisationcoalition.org.au/events/28th-annual-scientific-meeting/> |
| mmnd-itro-2027 | 2027-02-08..2027-02-13 | Mooloolaba | Medical Physics | <https://conference.uow.edu.au/mmnd-itro-2027/> |
| acccn-asm-2027 | 2027-10-05..2027-10-08 | Sydney | Nursing | <https://acccn.com.au/events/conferences-2/> |
| anzan-eeg-esa-epilepsy-courses-2027 | 2027-02-26..2027-02-28 | Sydney | Neurology | <https://www.ivvy.com.au/event/EEG2027/> |
| racp-amd-leadership-workshop-2027 | 2027-02-27..2027-02-28 | Brisbane | Internal Medicine | <https://www.racp.edu.au/about/college-structure/adult-medicine-division/amd-ebulletin---august-2026/> |
| achshm-asm-2027 | 2027-04-02..2027-04-03 | Sydney | Sexual Health | <https://www.racp.edu.au/about/college-structure/adult-medicine-division/amd-ebulletin---august-2026/> |

Rows on registration platforms: `rhw-*` (ruralhealthwest.eventsair.com, Rural Health West's own EventsAir site), `tbi-conference-nz-2027` (willorganise.eventsair.com; the secretariat is the conference organiser WILL Organise) and `anzan-eeg-esa-epilepsy-courses-2027` (ivvy.com.au/event/EEG2027, linked from anzan.org.au, with `organiserUrl` set). They pass the evidence check because `url` is the same page. Someone should add official-domains entries if the team wants these platforms listed explicitly.

## Existing rows newly evidenced: 59
Five rows changed dates: `acem-asm` moved to 7 to 12 Nov 2027 (42nd ASM, Auckland). `cicm-asm-2027` moved to 26 to 29 May 2027. `anzgog-asm-2027` moved to 21 to 23 Apr 2027 and from Melbourne to Adelaide. `ages-asm-2027` moved to 4 to 6 Mar 2027 and from Sydney to Brisbane. `achsm-congress-2027` moved to 13 to 15 Oct 2027 and from Sydney to Adelaide. Four of these were estimates and are now confirmed. The other 54 entries confirm legacy rows as listed and remove `legacyConfirmed`.

| id | dates | change | source |
|---|---|---|---|
| acem-asm | 2027-11-07..2027-11-12 | was 2027-11-21..2027-11-25 (estimated) | <https://acem.org.au/Events/42nd-Annual-Scientific-Meeting> |
| cicm-asm-2027 | 2027-05-26..2027-05-29 | was 2027-05-27..2027-05-29 (legacy) | <https://asm.cicm.org.au/call-for-abstracts/> |
| anzgog-asm-2027 | 2027-04-21..2027-04-23 | was 2027-03-11..2027-03-13 (estimated) | <https://www.anzgog.org.au/registrations-open-for-2027-annual-scientific-meeting/> |
| ages-asm-2027 | 2027-03-04..2027-03-06 | was 2027-03-25..2027-03-27 (estimated) | <https://events.ages.com.au/asm2027/> |
| achsm-congress-2027 | 2027-10-13..2027-10-15 | was 2027-09-15..2027-09-17 (estimated) | <https://www.achsm.org.au/events/2027-achsm-congress-adelaide/> |
| trog-asm-2027 | 2027-03-09..2027-03-12 | confirmed as listed | <https://trog.com.au/Events/> |
| acm-nsw-state-conference | 2027-06-25..2027-06-26 | confirmed as listed | <https://midwives.org.au/EventDetail?EventKey=20270625NB> |
| acccn-asm-2028 | 2028-10-25..2028-10-27 | confirmed as listed | <https://acccn.com.au/events/conferences-2/> |
| acorn-international-conference-2028 | 2028-05-24..2028-05-27 | confirmed as listed | <https://www.acorn.org.au/events> |
| ranzcog-asm | 2027-10-23..2027-10-27 | confirmed as listed | <https://ranzcogasm.com.au/about/key-dates/> |
| csanz-annual-scientific-meeting | 2027-08-05..2027-08-08 | confirmed as listed | <https://www.csanzasm.com/program/program-overview> |
| ranzcp-congress | 2027-05-16..2027-05-20 | confirmed as listed | <https://www.congress.ranzcp.org/keydates> |
| ashm-viral-hepatitis-conference | 2027-08-18..2027-08-20 | confirmed as listed | <https://ashm.org.au/training/> |
| anzsgm-asm | 2027-05-11..2027-05-14 | confirmed as listed | <https://anzsgm.org/event/> |
| aoa-tas-vic-branch-asm-2028 | 2028-02-25..2028-02-27 | confirmed as listed | <https://aoa.org.au/events/key-aoa-events/detail/4b6092af-b839-4954-83d3-874618614676> |
| closing-the-gap-indigenous-health-2026 | 2026-12-08..2026-12-10 | confirmed as listed | <https://icsconferences.org/event/2026-national-closing-the-gap-indigenous-health-conference> |
| aps-counselling-psychologists-conference-2027 | 2027-02-25..2027-02-26 | confirmed as listed | <https://psychology.org.au/training-and-careers/aps-conferences> |
| aoa-vic-branch-asm-2027 | 2027-02-26..2027-02-28 | confirmed as listed | <https://aoa.org.au/events> |
| aoa-qld-trifecta-2027 | 2027-03-19..2027-03-20 | confirmed as listed | <https://aoa.org.au/events> |
| amsig-asm-2027 | 2027-05-01..2027-05-02 | confirmed as listed | <https://www.amsig.org/events/> |
| aps-business-of-psychology-symposium-2027 | 2027-05-06..2027-05-07 | confirmed as listed | <https://psychology.org.au/training-and-careers/aps-conferences> |
| nzssd-asm-2027 | 2027-05-11..2027-05-14 | confirmed as listed | <https://nzssd.org.nz/meetings/meeting/98/2027-nzssd-annual-scientific-meeting> |
| psa-consultant-pharmacist-conference-2027 | 2027-05-21..2027-05-23 | confirmed as listed | <https://www.psa.org.au/networking-events/information-on-major-events-and-conferences/> |
| aoa-nsw-branch-asm-2027 | 2027-07-23..2027-07-24 | confirmed as listed | <https://aoa.org.au/events> |
| aoa-tas-branch-asm-2027 | 2027-07-31..2027-07-31 | confirmed as listed | <https://aoa.org.au/events> |
| psa-conference | 2027-08-05..2027-08-07 | confirmed as listed | <https://www.psa.org.au/networking-events/information-on-major-events-and-conferences/> |
| aoa-qld-branch-asm-2027 | 2027-08-06..2027-08-08 | confirmed as listed | <https://aoa.org.au/events> |
| aoa-wa-branch-asm-2027 | 2027-08-13..2027-08-14 | confirmed as listed | <https://aoa.org.au/events> |
| australian-public-health-conference-2027 | 2027-09-22..2027-09-24 | confirmed as listed | <https://www.phaa.net.au/events> |
| aoa-asm | 2027-10-10..2027-10-13 | confirmed as listed | <https://aoa.org.au/events/key-aoa-events> |
| masc-scientific-meeting-2026 | 2026-11-19..2026-11-19 | confirmed as listed | <https://www.masc.org.au/sm-2026/> |
| epsm-2026 | 2026-11-22..2026-11-25 | confirmed as listed | <https://www.acpsem.org.au/Courses-and-Events/EPSM> |
| hsr-2026-wellington | 2026-12-02..2026-12-04 | confirmed as listed | <https://eventstudio.eventsair.com/hsr-2026> |
| nsa-asm-2026 | 2026-12-02..2026-12-04 | confirmed as listed | <https://members.asnevents.com.au/register/event/2044/manager> |
| lorne-genome-2027 | 2027-02-14..2027-02-17 | confirmed as listed | <https://web.cvent.com/event/e57907a5-de4c-4c8f-a219-967fe9e30eff/summary> |
| asofre-foundation-meeting-2027 | 2027-03-19..2027-03-20 | confirmed as listed | <https://aso.org.au/events> |
| asohns-asm | 2027-03-19..2027-03-21 | confirmed as listed | <https://asm.asohns.org.au/au> |
| wa-rural-health-conference-2027 | 2027-03-20..2027-03-21 | confirmed as listed | <https://ruralhealthwest.com.au/events/warhc27/> |
| tsanz-asm | 2027-04-02..2027-04-06 | confirmed as listed | <https://tsanzsrsasm.com/abstracts/tsanz-awards-criteria> |
| psanz-congress | 2027-04-04..2027-04-07 | confirmed as listed | <https://www.psanz.com.au/events/psanz-annual-congress/> |
| asmirt-conference-2027 | 2027-04-14..2027-04-17 | confirmed as listed | <https://conference.asmirt.org/2027/> |
| acp-conference-2027 | 2027-04-29..2027-05-02 | confirmed as listed | <https://www.phlebology.com.au/conference/2027> |
| anzca-asm | 2027-04-30..2027-05-04 | confirmed as listed | <https://www.anzca.edu.au/events-and-courses/2027-anzca-annual-scientific-meeting-(asm)> |
| ranzcog-regional-symposium | 2027-05-01..2027-05-02 | confirmed as listed | <https://ranzcog.eventsair.com/ranzcog-2027-regional-symposium/key-dates> |
| asid-asm | 2027-05-05..2027-05-08 | confirmed as listed | <https://asid.net.au/events/> |
| acd-asm | 2027-05-14..2027-05-16 | confirmed as listed | <https://acdasm.com.au/base/> |
| ara-asm | 2027-05-22..2027-05-26 | confirmed as listed | <https://rheumatology.org.au/For-Healthcare-Professionals/CPD-and-Upcoming-Events/ASM-2027> |
| asps-plastic-surgery-meeting | 2027-06-17..2027-06-19 | confirmed as listed | <https://plasticsurgery.org.au/event/psc-2027/> |
| anzup-asm-2027 | 2027-06-20..2027-06-22 | confirmed as listed | <https://anzup.org.au/asm2027/> |
| anzahpe-conference | 2027-07-05..2027-07-08 | confirmed as listed | <https://www.anzahpe.org/page-1075631> |
| acem-rural-remote-em-conference | 2027-07-18..2027-07-20 | confirmed as listed | <https://acem.org.au/Events/Regional-Rural-and-Remote-Emergency-Medicine-Confe> |
| rmsanz-asm-2027 | 2027-07-18..2027-07-21 | confirmed as listed | <https://rmsanz.net/asm-conference/> |
| acn-national-nursing-forum | 2027-08-05..2027-08-06 | confirmed as listed | <https://www.acn.edu.au/events/national-nursing-forum> |
| dietitians-australia-national-conference-2027 | 2027-08-13..2027-08-15 | confirmed as listed | <https://dietitiansaustralia.org.au/national-conference-2027> |
| miccai-2027-auckland | 2027-09-27..2027-10-01 | confirmed as listed | <https://conferences.miccai.org/2027/en/> |
| acmhn-international-mental-health-nursing-conference-2027 | 2027-09-29..2027-10-01 | confirmed as listed | <https://www.acmhn.org/events> |
| apfcp-assr-sydney-2027 | 2027-11-17..2027-11-19 | confirmed as listed | <https://www.streams.co.jp/apfcp/> |
| iap-australasian-asm-2028 | 2028-05-26..2028-05-28 | confirmed as listed | <https://iap-aus-conference.org.au/annual-scientific-meeting-2028/> |
| icp2028-international-congress-of-psychology | 2028-07-16..2028-07-21 | confirmed as listed | <https://psychology.org.au/training-and-careers/aps-conferences> |

## Corrections found but not written (need an event page or a second look)
- `asa-nsc-2027` (row: Brisbane, Oct 2027, estimate): asansc.com.au says **ASA NSC 2027 is in Kyoto, Japan, 22 to 25 Sep 2027**. The dates appear only on the site root, so no entry was written. The row is probably wrong on both city and country.
- `haa-hsanz-asm`: apsth.bloodconference.com gives APSTH/Blood 2027, Adelaide, 24 to 27 Oct 2027 (it matches the row). The dates appear only on the site root.
- `anzos-asm-2027` (estimate 20 Oct, Sydney): anzos.com gives 13 to 16 Oct 2027 at Rydges Melbourne, on the site root only.
- `pca-palliative-care-conference` (estimate Sep 2027): PCA lists APHC27OPCC (Asia Pacific Hospice & Oceanic Palliative Care Conference) for 20 to 23 Apr 2027, with no city on the page.
- `cosa-asm`: the search lead says Cairns, 10 to 12 Nov 2027, but secure.cosa.org.au did not answer (fetch failed).
- `australian-dental-congress`: the home page says 19 to 22 May 2027 and the registration page says the scientific sessions run 20 to 22 May. Not written.
- `nzoa-asm` (row 18 to 19 Oct 2027): none of the NZOA page's ranges match the row.
- `adea-conference-2027` looks like a duplicate of `australasian-diabetes-congress` (ADC is the joint ADS-ADEA meeting, 18 to 20 Aug 2027, Adelaide).
- **PHAA rows not touched on purpose**: phaa.net.au/events lists all five 2027 PHAA conferences with dates and venues, but `merge-shards.js` treats any provenance id matching /phaa|population-health/ as weak and would *downgrade* those rows. The rule needs a look before anyone adds PHAA evidence.
- `gsa-anz-hernia-asm-2027` (GSA + ANZ Hernia, 2 to 5 Dec 2027): the home page says Hilton Sydney, but the site's venue page is titled Cairns Convention Centre. Left out until that is resolved.
- AOA SA/NT Papers Day (26 Feb 2027, SAHMRI) and AOA SA/NT ASM (13 Aug 2027, Kooyonga) were read on aoa.org.au but left out. The merge's host+start de-duplication would drop them, because other AOA rows share aoa.org.au and the same start dates. They need a different `url` or a merge change.

## Leads for the next run (not added)
RACS state ASMs and the Founders Centenary (surgeons.org blocked; asc.surgeons.org loads but shows dates only on its root). ANZSN 62nd Congress, Hobart, 11 to 15 Sep 2027 (only aggregators found; anzsnasm.com failed). TSANZ 45th ASM, 23 to 27 Jul 2027 (city not found; tsanz.com.au/meetings failed). PSA & PISA combined ASC, Fiji, 5 to 7 Aug 2027 (outside AU/NZ). RANZCO NSW/VIC/WA branch ASMs 2027, ANZSS 2027 and ANZSRS 2027 (ranzco.edu closes the connection for the tool). RANZCOG Aotearoa ASM, Napier, Apr 2027 (ranzcog.edu.au robots.txt disallows). ACRRM Emerging Leaders, RMA27 and GP27 (not announced yet). ANZMOSS x NACOS obesity masterclass, Sydney, 4 to 5 Jun 2027 (listed on anzos.com only). PaCCSC & CST Research Forum, ICC Sydney, 23 to 24 Feb 2027, and Australasian Oncology Summit, Brisbane, 5 to 6 Mar 2027 (TROG listing only). ACM workshops in Hobart (11 Oct 2027) and Bowral (24 Jun 2027), whose titles were not on the pages. HSANZ, AACB and ANZSOM branch evening meetings in Nov and Dec 2026. ASI Advanced Immunology School, Long Point NSW, 15 to 18 Jun 2027 (venue location uncertain). Victorian Rural Health Conference 2027, 14 to 16 May (RDAA; city not on the page). NZ Pain Society ASM 2027 (Hamilton per nzccp.co.nz).

## Blocked or failing hosts (skipped, not bypassed)
- Bot challenge (403): surgeons.org (RACS), rcpa.edu.au, dermcoll.edu.au (ACD), racma.edu.au, awma.com.au, hospice.org.nz, goodfellowunit.org, ilae.org, and some csanzasm.com paths.
- robots.txt disallows: ranzcog.edu.au, anzics.org, anzsnm.org.au, asid.net.au (root and meetings), fertilitysociety.com.au, menopause.org.au, asaps.org.au, anzba.org.au.
- Connection closed or failed for the tool's client: ranzco.edu, usanz.org.au, thoracic.org.au, anzics.com.au, anzsnasm.com, strokesociety.com.au, secure.cosa.org.au, agitg.org.au, adpha.au, themhs.org, tsanz.com.au/meetings, cicmasm.org.au, several NZ society sites (nzra, nzrs, nzdermsoc, racs.org.nz, nzma) and others.
- HTTP 520/522: allergy.org.au (ASCIA), ruralhealth.org.au (NRHA), hisa.org.au and hic.org.au, anzsnm.org.au.
- 404 on guessed paths (not blocked): many society /events URLs. They are listed in the run logs.

## Predatory or "world congress" brands seen (not added)
Two items appeared on genuine society event lists: "5th Global Summit on Diabetes & Endocrinology (GSD 2027), Paris", run by intelliglobalconferences, which is on anzsgm.org's external events list; and "Global Summit on Health Sciences, Nursing and Midwifery, Dubai", plus "2nd World Congress on Oncology and Cancer Research" and "World Congress on ENT, Anesthesiology and Perioperative Medicine", all on acecc.org.au. These are generic commercial "summit / world congress" brands with no society behind them, so they were flagged and not added.
