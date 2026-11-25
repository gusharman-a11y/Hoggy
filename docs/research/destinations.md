# Destination CPD: "Ski & CPD" and "Sun & CPD" (24 Nov 2026)

Owner's brief: *"Do we have all the ones in Japan? There are loads that start in the morning and allow people to go skiing. This is the sort of angle we're looking for."* Before this run the data had no Niseko, Rusutsu, Hakuba, Furano or Nozawa meeting at all.

This run adds **35 confirmed rows** (`data/shards/destinations-2026-11.json`) and tags **4 existing rows** (`data/shards/provenance-destinations-2026-11.json`). Every date was read on the organiser's own page on 24 Nov 2026 and each quote was machine-checked against the saved page before the shard was written. No CPD hours or fees were entered (`cpdHours` 0 everywhere); CPD statements appear only as quotes in `accreditation.text`.

## What was added

| Collection | Rows | Where |
|---|---|---|
| Ski & CPD | 16 | Japan 10 (Rusutsu 6, Niseko 1, Tomamu/Furano tour 3), NZ 2 (Queenstown, Wanaka), Canada 1 (Whistler), US 2 (Vail, Big Sky), France 1 (Val d'Isère) |
| Sun & CPD | 10 | Maldives 6, Hoi An 1, Bali 1, Koh Samui 1, Maui (Ka'anapali) 1 |
| Other destination meetings | 9 | Queenstown (AQUA), Fiji (Momi Bay), Hawaii 4 (Ko Olina, Kauai, Wailea ×2), Big Sky (Jefferson), Banff, Malta |

| Tag | New rows | Existing rows tagged |
|---|---|---|
| `destination` | 35 | 4 |
| `ski` | 16 | 0 |
| `family-friendly` | 11 | 0 |
| `beach` | 10 | 2 |
| `cruise` | 0 | 0 |
| `school-holidays-au` | 0 | 0 (derive in the app, see UI spec) |

- **19 of the 35 have a session pattern stated by the organiser** (13 of the 16 ski rows). The clearest: Hokkaido Trauma Conference (programme PDF: 07:15–10:30 and 15:15–18:30), Whistler Anesthesiology Summit (talks 6:55–9:00 a.m. and from 4:00 p.m., "Après Ski with Exhibitors" at 3:30 p.m.), Jefferson Big Sky (6:45–9:30 am and 4:30–7:15 pm), CSA Maui ("Sessions end by 12:15 PM").
- 18 carry an accreditation or CPD statement quoted from the organiser.
- Organiser type: commercial 23, society 7, university 4, hospital 1. Commercial rows say so in the blurb ("CPD holiday (commercial provider)"), as the expert blueprint asks.
- Existing rows tagged (dates untouched): `ranzcp-act-branch-conference-2027` (Thredbo, March: destination, not ski), `acp-conference-2027` (Queenstown), `wa-ace-country-conference-2027` (Cable Beach, Broome), `anzca-rural-sig-meeting-2027` (Salt Beach, Kingscliff).

## Organisers

| Organiser | Site | What they run | How dates are published | Type | robots / access |
|---|---|---|---|---|---|
| The Royal Melbourne Hospital (anaesthesia) | thermh.org.au | International Hokkaido Trauma Conference, Rusutsu, each January (18th in 2027; 400 places) | One sentence on the course page, plus a programme PDF with session times | hospital | Allowed |
| AMPED Medical Conferences (Sydney, since 1995) | ampedmedicalconferences.com.au | Rusutsu integrated conferences (Jan, Feb), Niseko Mental Health Conference (with Prof Patrick McGorry), Maldives ×3 a year, Wanaka (Sept) | One page per country listing each edition and its dates; 2028 Maldives dates already up | commercial | Allowed. Their CPD wording ("approved for CPD hours by a number of Australasian Medical Colleges") is on the booking partner's page, quoted from there |
| EMS Conferences | emsconferences.com.au | Emergency care weeks: Rusutsu ×3, Hoi An, Queenstown (July), Bali, Koh Samui (2028) | One page per destination with a "When is … held?" line; timetable stated in a sentence | commercial | Allowed. States "26 PD hours"; **no college accreditation named**; audience is nurses, paramedics and doctors. Review: keep or drop (7 rows, ids `ems-*`) |
| Wilderness Medicine (US) | wilderness-medicine.com | Guided Hokkaido ski trip (Tomamu, Furano, Otaru) with afternoon lectures; Big Sky winter conference | Date list at the top of each trip page | commercial | Allowed. AMA PRA credits via CEME (US) |
| UBC CPD | ubccpd.ca | Whistler Anesthesiology Summit (17th, Feb 2027) | Activity page with a full timed programme | university | Allowed |
| University of Colorado (CU Anschutz) | web.cvent.com (CRASH 2027 event) | CRASH, Vail, each February | Cvent summary page | university | Allowed; added to `tools/official-domains.json` |
| Thomas Jefferson University | jefferson.cloud-cme.com | Jefferson Anesthesia Conference, Big Sky | Cloud-CME course page with agenda | university | Allowed |
| University of Calgary CME | ecme.ucalgary.ca | Emergency Medicine for Rural Hospitals, Banff (Jan) | Programme page | university | Allowed |
| Joint Anaesthesia Faculty Auckland (JAFA) | anaesthesia.nz (NZSA listing) | AQUA, Queenstown (Aug); South Pacific Anaesthesia Meeting, Fiji (June) | Save-the-date on the NZ Society of Anaesthetists event pages. JAFA's own EventsAir site still shows 2025; aqua.ac.nz no longer belongs to the meeting (do not link it) | society | Allowed |
| California Society of Anesthesiologists | csahq.org | Hawaii meetings each winter, summer and autumn | One event page per meeting | society | Allowed |
| Maui Derm | mauiderm.com | Maui Derm Hawaii (Jan) | Meeting page | commercial | Allowed |
| Doctors Updates (UK) | doctorsupdates.com | Winter meeting, Val d'Isère (Feb); also Algarve | Page title and heading | commercial | Allowed. No CPD statement found |
| AMA Queensland | amaq.com.au | International annual conference (Malta, Sept 2027) | Event detail page | society | Allowed |
| SkiJapan.com | skijapan.com/groups-and-conferences | Booking agent and event pages for eight Australian-run Hokkaido medical meetings: the index to check each year | "WHEN" block per event | travel company | Allowed. Used for schedule and CPD quotes only, never for dates |

## Leads not added (and why)

| Lead | Dates seen | Why not added |
|---|---|---|
| SONS MedSki Japan (Society of Neuromuscular Sciences Inc), Niseko | 18–22 Jan 2027 | Delegate-speaker format, no CPD or accreditation statement; dates are on the site root only. Blueprint: holiday CME only from a college, society with a programme, university or accredited provider |
| WASABI Medical Conference, Rusutsu | 22–26 Feb 2027 | Run by one clinician, sells on tax deductibility, no accreditation statement, no programme times |
| Kaizen Health Conference (Flying Penguins), Niseko | 17–22 Jan 2027, "Presentations from 4pm daily" | Delegate presenters; its own FAQ says it "does not provide a structured program" of CPD |
| MSK Japan 2027 Destination Ultrasound Conference, Hokkaido | 25–28 Jan 2027 (booking page) | Organiser site mskaustralia.com.au returned a bot challenge (403): skipped, not worked around |
| Hakuba, Nozawa Onsen, Myoko, Shiga Kogen, Appi, Kiroro | — | No doctor meeting found for 2027–28. The one Nozawa "conference" found is veterinary. Furano and Kiroro appear only as ski days on the Wilderness Medicine tour |
| ANZCA/ASA ACT Scan and Ski Workshop, Thredbo | 2026 ran 29–31 July | 2027 page not published yet (404). Re-check in March |
| Other Australian snow meetings (Perisher, Falls Creek, Hotham, Buller) | — | Nothing for doctors found; the Thredbo ski conference found is optometry |
| Rocky Mountain Winter Conference on Emergency Medicine, Snowmass | 26 Feb – 2 Mar 2027 (listing sites) | Organiser's own site not found or not reachable; listing sites are not a date source |
| UF Spring Anesthesia Ski Summit, Vail | — | robots.txt disallows anest.cme.ufl.edu |
| 6th South Pacific ORL Forum, Denarau, Fiji | 14–18 Aug 2027 (listing sites) | robots.txt disallows southpacificorl.org |
| Otago Internal Medicine course, Queenstown (Millbrook) | 2026 ran 20–23 Aug | otago.ac.nz returned a bot challenge (403) |
| Unconventional Conventions (AU travel CPD: safaris, river cruises) | — | Host unreachable through the proxy (502); try from the laptop |
| Education at Sea (cruise conferences from Sydney) | Many 2027 sailings | Nursing and midwifery CPD only; not for doctors. No doctor cruise meeting was confirmed, so the `cruise` tag is unused |
| Hamilton Island GP Conference; Hamilton Island Medical Conference | June (listing) | Only ticketing and listing pages found; no organiser page read |
| Banff Rural Anesthesia Conference | 22 Jan 2027 | One-day course beside the Banff EMRH row; left out to avoid padding |
| Northwest Anesthesia Seminars (US, many ski and beach venues) | — | Large commercial catalogue; not opened this run |
| WellMedix Morzine; Austria Ski CME St Anton; AO Davos Courses | Jan/Feb 2027; Dec | Ticketing or listing pages only, or page not found |

Blocked or refused hosts (never bypassed): mskaustralia.com.au (403 challenge), otago.ac.nz (403 challenge), anest.cme.ufl.edu, southpacificorl.org and healthmanagement.org/go (robots.txt), unconventionalconventions.com and rmwcem.com (unreachable), acecc.org.au (certificate error; an aggregator anyway).

## Data model (optional fields, `tools/destination-fields.js`)

| Field | Shape | Rule |
|---|---|---|
| `tags` | array of `ski`, `beach`, `cruise`, `family-friendly`, `destination`, `school-holidays-au` | Fixed vocabulary, no repeats. `destination` = held at a resort or holiday location named on the organiser page; `ski`/`beach`/`family-friendly` only when the page says so (ski lifts, beach, "family-friendly") |
| `schedule` | `{ pattern, quote, sourceUrl }` | Only when the organiser states session times. `pattern` is our one-line summary; `quote` is copied (" … " marks omitted text); `sourceUrl` https |
| `organiserType` | `college`, `society`, `commercial`, `university`, `hospital` | Show "commercial" in the UI |
| `accreditation` | `{ text, sourceUrl }` | Verbatim from the organiser. Never converted into `cpdHours` |
| `audience` | string | Who the organiser says it is for |

`tools/merge-shards.js` carries these from conference shards and from provenance entries (a tags-only entry `{ id, tags, note }` needs no `verified`). An invalid field is left out and listed; the row still merges. `tools/validate-data.js` treats an invalid field in `conferences.js` or in a provenance shard as an error and prints "destination fields: N rows tagged, M with a stated session pattern". Rows without the fields behave as before.

## UI spec for the app agent

1. **Two collections on the home screen**, as cards or chips beside the specialty picker: "Ski & CPD" (`tags` includes `ski`) and "Sun & CPD" (`tags` includes `beach` or `cruise`). A third, "Destination meetings", is every row with `destination`. Each opens the normal list, pre-filtered and sorted by start date. Show the count on the card.
2. **Session-pattern line on the card**, under the dates, when `schedule` exists: a clock icon and `schedule.pattern` ("Sessions 7:15–10:30 and 15:15–18:30"). On the detail view show `schedule.quote` in quotation marks with a "from the organiser's programme" link to `schedule.sourceUrl`. No pattern, no line: do not infer one.
3. **Organiser label**: a small "Commercial provider" pill when `organiserType` is `commercial`; "College", "Society", "University" or "Hospital" otherwise. Never hide it.
4. **Accreditation**: on the detail view, `accreditation.text` in quotation marks with its source link and the line "Check with your college before you claim". Keep CPD hours blank while `cpdHours` is 0.
5. **Filters** (in the existing filter sheet): tag chips (Ski, Beach, Family-friendly), "Has a stated session pattern", organiser type, and country. Combine with specialty: "Anaesthesia + Ski" should give Hokkaido Trauma, Whistler, CRASH.
6. **School holidays**: do not store a tag. Compute a "In AU school holidays" badge from `data/holidays.js` and the row's dates for the user's state; the `school-holidays-au` tag is reserved for an organiser who says so.
7. **Audience**: show `audience` as one line on the detail view ("For: …").
8. **Empty or thin states**: the Japan list is January–March only; say "New season dates usually appear from August" rather than showing an empty year.
9. Copy must pass `tools/copy-lint.js` (no superlatives). Organiser quotes are exempt because they are shown as quotes.

## Re-check calendar
- **August–September**: skijapan.com/groups-and-conferences and the AMPED, EMS and RMH pages for the next January–March season.
- **March**: ANZCA events for the Thredbo Scan and Ski Workshop; NZSA events for AQUA's programme.
- Add evidence for 2028 editions through `tools/verify-dates.js` as usual; give new rows the optional fields by hand from the organiser page.
