# Course refresh 2026-11-25

Run: `node tools/refresh-courses.js`. Sessions before: 3223, after: 3173. Added 13, updated 119, unchanged 423, removed 37, kept from failed sources 0.

check-courses: courses: 144, sessions: 3173, errors: 0, warnings: 25

## Sources

| Source | Status | Rows read | Sessions | URL |
|---|---|---|---|---|
| APLS Australia (Arlo API) | ok | 75 | 75 | <https://apls.arlo.co/api/2012-02-01/pub/resources/eventsearch/?fields=EventID,EventTemplateID,Name,Code,StartDateTime,EndDateTime,Location,IsFull,PlacesRemaining,AdvertisedOffers,RegistrationInfo,ViewUri,Summary&top=200> |
| ARC course-dates page | ok | 490 | 420 | <https://www.resus.org.au/training-and-education/advanced-life-support-courses/course-dates> |
| ACRRM als | ok | 19 | 19 | <https://www.acrrm.org.au/courses/face-to-face/als> |
| ACRRM rest | ok | 19 | 19 | <https://www.acrrm.org.au/courses/face-to-face/rest> |
| ACRRM paediatric-emergencies-for-rural-generalists | ok | 9 | 9 | <https://www.acrrm.org.au/courses/face-to-face/paediatric-emergencies-for-rural-generalists> |
| ACRRM advanced-neonatal-resuscitation | ok | 3 | 3 | <https://www.acrrm.org.au/courses/face-to-face/advanced-neonatal-resuscitation> |
| ACRRM reot | ok | 6 | 6 | <https://www.acrrm.org.au/courses/face-to-face/reot> |
| NZDA course portal (NZRC CORE) | ok | 4 | 4 | <https://www.nzda.org.nz/education/courses-events/search-events?title=core> |

## x10 source runs

| Source | Status | Sessions (new file / held) |
|---|---|---|
| resus | ok | 274 / 294 |
| womens-gp | ok | 405 / 437 |

merge-courses: conf-courses: +2 types, +2 sessions; resus: +23 types, +274 sessions, 76 updates; womens-gp: +63 types, +405 sessions; intl: +39 types, +1939 sessions, 44 duplicates, 89 finished; aunz-wave2: +6 types, +51 sessions, 1 duplicates; fixes: 68 course patches, 53 length variants folded, 20 marked closed

### Rows not used

- ARC course-dates page: {"reason":"no start date","title":"Advanced Life Support Level 1 (1-Day Course) - Melbourne","dateCell":"Sunday 1 Nov"}

## Added (13: als1 5, als2 3, acrrm-rest 1, nzrc-core-advanced 3, nzrc-core-immediate 1)

- `als1-nsw-prestons-2027-01-12-code-blue-medical` 2027-01-12 Prestons NSW · Code Blue Medical
- `als2-sa-ridleyton-2027-02-13-australian-clinical-education-services-aces` 2027-02-13–2027-02-14 Ridleyton SA · Australian Clinical Education Services (ACES)
- `als1-wa-nedlands-2027-03-16-hollywood-private-hospital` 2027-03-16 Nedlands WA · Hollywood Private Hospital
- `als1-wa-nedlands-2027-05-10-hollywood-private-hospital` 2027-05-10 Nedlands WA · Hollywood Private Hospital
- `als1-wa-nedlands-2027-08-17-hollywood-private-hospital` 2027-08-17 Nedlands WA · Hollywood Private Hospital
- `als2-wa-nedlands-2027-09-13-hollywood-private-hospital` 2027-09-13–2027-09-14 Nedlands WA · Hollywood Private Hospital
- `als1-wa-nedlands-2027-10-15-hollywood-private-hospital` 2027-10-15 Nedlands WA · Hollywood Private Hospital
- `als2-acrrm-qld-warwick-2027-05-08` 2027-05-08 Warwick QLD · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-rest-qld-warwick-2027-03-20` 2027-03-20–2027-03-21 Warwick QLD · ACRRM (Australian College of Rural and Remote Medicine)
- `nzrc-core-advanced-auckland-albany-2026-11-27-emcare-services-limited` 2026-11-27 Albany Auckland · Emcare Services Limited
- `nzrc-core-advanced-otago-palmerston-north-2026-11-28-emcare-services-limited` 2026-11-28 Palmerston North Otago · Emcare Services Limited
- `nzrc-core-immediate-wellington-wellington-2026-12-04-triple-one-care-ltd` 2026-12-04 Wellington Wellington · Triple One Care Ltd
- `nzrc-core-advanced-otago-central-dunedin-2026-12-05-emcare-services-limited` 2026-12-05 Central Dunedin Otago · Emcare Services Limited

## Updated (119)

- `apls-full-tas-launceston-2026-12-04`: seatsStatus waitlist → open; placesRemaining — → 1; bookingUrl https://apls.arlo.co/waiting-list?sid=155030e38e2543bca9574f9573f81441 → https://apls.arlo.co/register?sgid=155030e38e2543bca9574f9573f81441
- `apls-full-sa-adelaide-2027-01-29`: placesRemaining 12 → 15
- `apls-full-nsw-coffs-harbour-2027-02-12`: placesRemaining 18 → 16
- `apls-full-vic-melbourne-2027-02-17`: seatsStatus open → waitlist; placesRemaining 4 → —; bookingUrl https://apls.arlo.co/register?sgid=bd8a3b1cc2914bc7b08e4a8f1a3eb482 → https://apls.arlo.co/waiting-list?sid=bd8a3b1cc2914bc7b08e4a8f1a3eb482
- `apls-full-nsw-sydney-2027-02-17`: placesRemaining 13 → 11
- `apls-full-tas-hobart-2027-02-24`: placesRemaining 21 → 19
- `apls-full-vic-melbourne-2027-03-17`: placesRemaining 21 → 20
- `apls-full-qld-brisbane-2027-03-18`: placesRemaining 23 → 21
- `apls-full-wa-albany-2027-03-19`: placesRemaining 20 → 19
- `apls-refresher-vic-melbourne-2027-03-23`: placesRemaining 7 → 6
- `apls-full-wa-perth-2027-04-06`: placesRemaining 14 → 11
- `apls-full-vic-melbourne-2027-05-05`: placesRemaining 20 → 17
- `apls-refresher-nsw-sydney-2027-06-01`: placesRemaining 14 → 12
- `apls-full-qld-cairns-2027-06-17`: placesRemaining 23 → 21
- `apls-full-qld-brisbane-2027-07-16`: placesRemaining 24 → 23
- `apls-refresher-vic-melbourne-2027-08-19`: placesRemaining 21 → 19
- `apls-refresher-nsw-sydney-2027-08-24`: placesRemaining 13 → 11
- `apls-full-nsw-parramatta-2027-09-21`: placesRemaining 17 → 18
- `als2-qld-townsville-2027-02-06-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als1-qld-townsville-2027-04-17-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als2-qld-townsville-2027-06-05-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als2-qld-townsville-2027-11-06-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als1-qld-townsville-2027-12-04-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als2-recert-sa-hindmarsh-2026-12-04-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als1-sa-hindmarsh-2026-12-05-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als2-sa-hindmarsh-2026-12-10-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als1-sa-hindmarsh-2027-02-03-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als2-sa-hindmarsh-2027-02-04-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als1-sa-hindmarsh-2027-02-26-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als2-recert-sa-hindmarsh-2027-02-27-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als2-sa-hindmarsh-2027-03-13-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als1-sa-hindmarsh-2027-03-19-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als1-sa-hindmarsh-2027-04-10-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als2-sa-hindmarsh-2027-04-29-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als1-sa-hindmarsh-2027-05-07-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als2-sa-hindmarsh-2027-05-29-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als2-recert-sa-hindmarsh-2027-06-18-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als1-sa-hindmarsh-2027-06-19-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als2-sa-hindmarsh-2027-06-24-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als1-sa-hindmarsh-2027-08-05-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als2-sa-hindmarsh-2027-08-12-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als2-recert-sa-hindmarsh-2027-09-03-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als2-sa-hindmarsh-2027-12-02-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als1-sa-hindmarsh-2027-12-09-advanced-resuscitation-training`: priceNote — → —; providerBookingUrl — → —
- `als2-wa-osborne-park-2026-11-28-medical-training-solutions-wa`: priceNote — → —; placesRemaining — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2026-12-01-medical-training-solutions-wa`: priceNote — → —; placesRemaining — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2026-12-10-medical-training-solutions-wa`: priceNote — → —; placesRemaining — → —; providerBookingUrl — → —
- `als2-wa-osborne-park-2026-12-12-medical-training-solutions-wa`: priceNote — → —; placesRemaining — → —; providerBookingUrl — → —
- `als2-wa-osborne-park-2027-01-16-medical-training-solutions`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-01-21-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-01-30-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-02-09-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als2-recert-wa-osborne-park-2027-02-13-medical-training-solutions`: priceNote — → —; placesRemaining — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-02-25-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als2-wa-osborne-park-2027-02-27-medical-training-solutions`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-03-10-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als2-wa-osborne-park-2027-03-20-medical-training-solutions`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-03-23-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-04-03-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als2-wa-osborne-park-2027-04-10-medical-training-solutions`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-04-13-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-04-29-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als2-wa-osborne-park-2027-05-01-medical-training-solutions`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-05-18-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als2-recert-wa-osborne-park-2027-05-22-medical-training-solutions`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-05-27-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als2-wa-osborne-park-2027-05-29-medical-training-solutions`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-06-10-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als2-recert-wa-osborne-park-2027-06-12-medical-training-solutions`: priceNote — → —; providerBookingUrl — → —
- `als2-wa-osborne-park-2027-06-26-medical-training-solutions`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-07-03-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-07-14-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-07-20-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-07-24-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als2-wa-osborne-park-2027-07-31-medical-training-solutions`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-08-05-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-08-10-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-08-21-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-08-25-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-08-31-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als2-wa-osborne-park-2027-09-04-medical-training-solutions`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-09-14-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als2-recert-wa-osborne-park-2027-09-18-medical-training-solutions`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-09-22-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-09-29-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-10-09-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als2-wa-osborne-park-2027-10-23-medical-training-solutions`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-10-28-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-11-09-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-11-13-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als2-wa-osborne-park-2027-11-20-medical-training-solutions`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-11-24-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als2-wa-osborne-park-2027-12-04-medical-training-solutions`: priceNote — → —; providerBookingUrl — → —
- `als1-wa-osborne-park-2027-12-11-medical-training-solutions-wa`: priceNote — → —; providerBookingUrl — → —
- `als2-acrrm-vic-melbourne-2026-12-01`: venue — → Ibis & Novotel Melbourne Airport, 1 Grants Rd, MELBOURNE AIRPORT; seatsStatus waitlist → —; placesRemaining 0 → —; bookingUrl https://mycollege.acrrm.org.au/search/find-college-event/details?ID=41852 → https://mycollege.acrrm.org.au/express-interest/express-interest-in-courses-als; datesQuote Tue, 01 Dec 2026 \| Advanced Life Support Level 2 (ALS2) \| Melbourne VIC \| CPD Hours 15 … → Tue, 01 Dec 2026 \| Advanced Life Support Level 2 (ALS2) \| Melbourne Airport VIC \| CPD H…
- `als2-acrrm-qld-brisbane-2027-01-10`: seatsStatus open → —; placesRemaining 4 → —; bookingUrl https://mycollege.acrrm.org.au/search/find-college-event/details?ID=43558 → https://mycollege.acrrm.org.au/express-interest/express-interest-in-courses-als; datesQuote Sun, 10 Jan 2027 \| Advanced Life Support Level 2 (ALS2) \| Brisbane QLD \| CPD Hours 15 \|… → Sun, 10 Jan 2027 \| Advanced Life Support Level 2 (ALS2) \| Brisbane QLD \| CPD Hours 15 \|…
- `als2-acrrm-vic-melbourne-2027-02-07`: placesRemaining 19 → 4; datesQuote Sun, 07 Feb 2027 \| Advanced Life Support Level 2 (ALS2) \| Melbourne VIC \| CPD Hours 15 … → Sun, 07 Feb 2027 \| Advanced Life Support Level 2 (ALS2) \| Melbourne VIC \| CPD Hours 15 …
- `als2-acrrm-wa-perth-2027-02-19`: placesRemaining 19 → 16; datesQuote Fri, 19 Feb 2027 \| Advanced Life Support Level 2 (ALS2) \| Perth WA \| CPD Hours 15 \| Mem… → Fri, 19 Feb 2027 \| Advanced Life Support Level 2 (ALS2) \| Perth WA \| CPD Hours 15 \| Mem…
- `als2-acrrm-nt-darwin-2027-02-26`: placesRemaining 17 → 15; datesQuote Fri, 26 Feb 2027 \| Advanced Life Support Level 2 (ALS2) \| Darwin NT \| CPD Hours 15 \| Me… → Fri, 26 Feb 2027 \| Advanced Life Support Level 2 (ALS2) \| Darwin NT \| CPD Hours 15 \| Me…
- `als2-acrrm-act-canberra-2027-03-21`: placesRemaining 20 → 19; datesQuote Sun, 21 Mar 2027 \| Advanced Life Support Level 2 (ALS2) \| Canberra ACT \| CPD Hours 15 \|… → Sun, 21 Mar 2027 \| Advanced Life Support Level 2 (ALS2) \| Canberra ACT \| CPD Hours 15 \|…
- `als2-acrrm-qld-toowoomba-2027-03-21`: placesRemaining 18 → 13; datesQuote Sun, 21 Mar 2027 \| Advanced Life Support Level 2 (ALS2) \| Toowoomba QLD \| CPD Hours 15 … → Sun, 21 Mar 2027 \| Advanced Life Support Level 2 (ALS2) \| Toowoomba QLD \| CPD Hours 15 …
- `als2-acrrm-sa-adelaide-2027-04-16`: placesRemaining 20 → 17; datesQuote Fri, 16 Apr 2027 \| Advanced Life Support Level 2 (ALS2) \| Adelaide SA \| CPD Hours 15 \| … → Fri, 16 Apr 2027 \| Advanced Life Support Level 2 (ALS2) \| Adelaide SA \| CPD Hours 15 \| …
- `als2-acrrm-nsw-coffs-harbour-2027-04-17`: placesRemaining 20 → 18; datesQuote Sat, 17 Apr 2027 \| Advanced Life Support Level 2 (ALS2) \| Coffs Harbour NSW \| CPD Hours… → Sat, 17 Apr 2027 \| Advanced Life Support Level 2 (ALS2) \| Coffs Harbour NSW \| CPD Hours…
- `als2-acrrm-qld-brisbane-2027-05-21`: placesRemaining 15 → 11; datesQuote Fri, 21 May 2027 \| Advanced Life Support Level 2 (ALS2) \| Brisbane QLD \| CPD Hours 15 \|… → Fri, 21 May 2027 \| Advanced Life Support Level 2 (ALS2) \| Brisbane QLD \| CPD Hours 15 \|…
- `als2-acrrm-nsw-sydney-2027-05-28`: placesRemaining 19 → 17; datesQuote Fri, 28 May 2027 \| Advanced Life Support Level 2 (ALS2) \| Sydney NSW \| CPD Hours 15 \| M… → Fri, 28 May 2027 \| Advanced Life Support Level 2 (ALS2) \| Sydney NSW \| CPD Hours 15 \| M…
- `als2-acrrm-tas-devonport-2027-05-28`: placesRemaining 19 → 17; datesQuote Fri, 28 May 2027 \| Advanced Life Support Level 2 (ALS2) \| Devonport TAS \| CPD Hours 15 … → Fri, 28 May 2027 \| Advanced Life Support Level 2 (ALS2) \| Devonport TAS \| CPD Hours 15 …
- `als2-acrrm-qld-brisbane-2027-06-07`: placesRemaining 19 → 17; datesQuote Mon, 07 Jun 2027 \| Advanced Life Support Level 2 (ALS2) \| Brisbane QLD \| CPD Hours 15 \|… → Mon, 07 Jun 2027 \| Advanced Life Support Level 2 (ALS2) \| Brisbane QLD \| CPD Hours 15 \|…
- `als2-acrrm-qld-dalby-2027-06-12`: placesRemaining 20 → 18; datesQuote Sat, 12 Jun 2027 \| Advanced Life Support Level 2 (ALS2) \| Dalby QLD \| CPD Hours 15 \| Me… → Sat, 12 Jun 2027 \| Advanced Life Support Level 2 (ALS2) \| Dalby QLD \| CPD Hours 15 \| Me…
- `als2-acrrm-vic-melbourne-2027-06-25`: placesRemaining 18 → 16; datesQuote Fri, 25 Jun 2027 \| Advanced Life Support Level 2 (ALS2) \| Melbourne VIC \| CPD Hours 15 … → Fri, 25 Jun 2027 \| Advanced Life Support Level 2 (ALS2) \| Melbourne VIC \| CPD Hours 15 …
- `acrrm-rest-qld-brisbane-2026-12-01`: seatsStatus open → waitlist; placesRemaining 2 → 0; datesQuote Tue, 01 Dec 2026 \| Rural Emergency Skills Training (REST) \| Brisbane QLD \| CPD Hours 28… → Tue, 01 Dec 2026 \| Rural Emergency Skills Training (REST) \| Brisbane QLD \| CPD Hours 28…
- `acrrm-rest-nsw-sydney-2027-01-16`: placesRemaining 20 → 19; datesQuote Sat, 16 Jan 2027 \| Rural Emergency Skills Training (REST) \| Sydney NSW \| CPD Hours 28 \|… → Sat, 16 Jan 2027 \| Rural Emergency Skills Training (REST) \| Sydney NSW \| CPD Hours 28 \|…
- `acrrm-rest-nt-darwin-2027-02-21`: placesRemaining 19 → 18; datesQuote Sun, 21 Feb 2027 \| Rural Emergency Skills Training (REST) \| Darwin NT \| CPD Hours 28 \| … → Sun, 21 Feb 2027 \| Rural Emergency Skills Training (REST) \| Darwin NT \| CPD Hours 28 \| …
- `acrrm-rest-wa-perth-2027-03-12`: placesRemaining 19 → 18; datesQuote Fri, 12 Mar 2027 \| Rural Emergency Skills Training (REST) \| Perth WA \| CPD Hours 28 \| M… → Fri, 12 Mar 2027 \| Rural Emergency Skills Training (REST) \| Perth WA \| CPD Hours 28 \| M…
- `acrrm-rest-qld-brisbane-2027-03-19`: placesRemaining 18 → 16; datesQuote Fri, 19 Mar 2027 \| Rural Emergency Skills Training (REST) \| Brisbane QLD \| CPD Hours 28… → Fri, 19 Mar 2027 \| Rural Emergency Skills Training (REST) \| Brisbane QLD \| CPD Hours 28…
- `acrrm-rest-qld-brisbane-2027-05-15`: placesRemaining 20 → 19; datesQuote Sat, 15 May 2027 \| Rural Emergency Skills Training (REST) \| Brisbane QLD \| CPD Hours 28… → Sat, 15 May 2027 \| Rural Emergency Skills Training (REST) \| Brisbane QLD \| CPD Hours 28…
- `acrrm-anr-qld-brisbane-2026-12-09`: placesRemaining 9 → 8; datesQuote Wed, 09 Dec 2026 \| Advanced Neonatal Resuscitation \| Brisbane QLD \| CPD Hours 11 \| Memb… → Wed, 09 Dec 2026 \| Advanced Neonatal Resuscitation \| Brisbane QLD \| CPD Hours 11 \| Memb…
- `acrrm-reot-qld-brisbane-2026-12-08`: seatsStatus waitlist → —; placesRemaining 0 → —; bookingUrl https://mycollege.acrrm.org.au/search/find-college-event/details?ID=41862 → https://mycollege.acrrm.org.au/express-interest/express-interest-in-courses-reot; datesQuote Tue, 08 Dec 2026 \| Rural Emergency Obstetrics Training (REOT) \| Brisbane QLD \| CPD Hour… → Tue, 08 Dec 2026 \| Rural Emergency Obstetrics Training (REOT) \| Brisbane QLD \| CPD Hour…
- `acrrm-reot-wa-perth-2027-01-25`: placesRemaining 9 → 6; datesQuote Mon, 25 Jan 2027 \| Rural Emergency Obstetrics Training (REOT) \| Perth WA \| CPD Hours 16… → Mon, 25 Jan 2027 \| Rural Emergency Obstetrics Training (REOT) \| Perth WA \| CPD Hours 16…
- `acrrm-reot-sa-adelaide-2027-05-22`: placesRemaining 18 → 17; datesQuote Sat, 22 May 2027 \| Rural Emergency Obstetrics Training (REOT) \| Adelaide SA \| CPD Hours… → Sat, 22 May 2027 \| Rural Emergency Obstetrics Training (REOT) \| Adelaide SA \| CPD Hours…

## Removed (37; logged in data/courses/removed-log.json)

- `als1-vic-box-hill-2026-11-17-citi-medical` 2026-11-17 Box Hill VIC: finished
- `als1-wa-belmont-2026-11-17-st-john-wa` 2026-11-17 Belmont WA: finished
- `als1-wa-osborne-park-2026-11-17-medical-training-solutions-wa` 2026-11-17 Osborne Park WA: finished
- `als1-sa-hindmarsh-2026-11-18-advanced-resuscitation-training` 2026-11-18 Hindmarsh SA: finished
- `als1-nsw-blacktown-2026-11-19-aimsi` 2026-11-19 Blacktown NSW: finished
- `als2-qld-chermside-2026-11-19-the-prince-charles-hospital` 2026-11-19 Chermside QLD: finished
- `als1-nsw-sydney-2026-11-20-parasol-emt-pty-ltd` 2026-11-20 Sydney NSW: finished
- `als1-qld-brisbane-airport-2026-11-20-code-blue-medical` 2026-11-20 Brisbane Airport QLD: finished
- `als1-qld-brisbane-2026-11-20-parasol-emt-pty-ltd` 2026-11-20 Brisbane QLD: finished
- `als1-sa-adelaide-2026-11-20-parasol-emt-pty-ltd` 2026-11-20 Adelaide SA: finished
- `als1-sa-hindmarsh-2026-11-20-advanced-resuscitation-training` 2026-11-20 Hindmarsh SA: finished
- `als1-vic-melbourne-2026-11-20-parasol-emt-pty-ltd` 2026-11-20 Melbourne VIC: finished
- `acrrm-reot-nsw-sydney-2026-11-21` 2026-11-21 Sydney NSW: finished
- `als2-qld-brisbane-2026-11-21-parasol-emt-pty-ltd` 2026-11-21 Brisbane QLD: finished
- `als2-qld-cairns-2026-11-21-parasol-emt-pty-ltd` 2026-11-21 Cairns QLD: finished
- `als2-sa-adelaide-2026-11-21-parasol-emt-pty-ltd` 2026-11-21 Adelaide SA: finished
- `als2-sa-hindmarsh-2026-11-21-advanced-resuscitation-training` 2026-11-21 Hindmarsh SA: finished
- `als2-vic-melbourne-2026-11-21-parasol-emt-pty-ltd` 2026-11-21 Melbourne VIC: finished
- `als2-recert-wa-osborne-park-2026-11-21-medical-training-solutions-wa` 2026-11-21 Osborne Park WA: finished
- `als2-wa-perth-2026-11-21-parasol-emt-pty-ltd` 2026-11-21 Perth WA: finished
- `als2-wa-subiaco-2026-11-21-st-john-of-god-subiaco-hospital` 2026-11-21 Subiaco WA: finished
- `nzrc-core-advanced-wellington-lower-hutt-2026-11-21-emcare-services-limited` 2026-11-21 Lower Hutt Wellington: finished
- `nzrc-core-immediate-auckland-rosedale-auckland-2026-11-21-triple-one-care-ltd` 2026-11-21 Rosedale, Auckland Auckland: finished
- `acrrm-anr-nsw-sydney-2026-11-22` 2026-11-22 Sydney NSW: finished
- `als2-nsw-sydney-2026-11-22-parasol-emt-pty-ltd` 2026-11-22 Sydney NSW: finished
- `nzrc-core-advanced-auckland-rosedale-auckland-2026-11-22-triple-one-care-ltd` 2026-11-22 Rosedale, Auckland Auckland: finished
- `als1-qld-brisbane-airport-2026-11-23-code-blue-medical` 2026-11-23 Brisbane Airport QLD: finished
- `als1-wa-nedlands-2026-11-23-hollywood-private-hospital` 2026-11-23 Nedlands WA: finished
- `als2-nsw-wollongong-2026-11-23-illawarra-shoalhaven-health-education-centre` 2026-11-23 Wollongong NSW: finished
- `als1-sa-elizabeth-vale-2026-11-24-nalhn` 2026-11-24 Elizabeth Vale SA: finished
- `als1-wa-belmont-2026-11-24-st-john-wa` 2026-11-24 Belmont WA: finished
- `als1-wa-osborne-park-2026-11-24-medical-training-solutions-wa` 2026-11-24 Osborne Park WA: finished
- `nzrc-core-immediate-nelson-richmond-2026-11-24-resus-nelson-ltd` 2026-11-24 Richmond Nelson: finished
- `als2-acrrm-nsw-sydney-2026-11-25` 2026-11-25 Sydney NSW: no longer listed on the source page (cancelled, moved or unlisted)
- `acrrm-rest-nsw-sydney-2026-11-26` 2026-11-26 Sydney NSW: no longer listed on the source page (cancelled, moved or unlisted)
- `apls-full-nsw-sydney-2026-12-04` 2026-12-04 Sydney NSW: no longer listed on the source page (cancelled, moved or unlisted)
- `apls-full-wa-scarborough-2026-12-04` 2026-12-04 Scarborough WA: no longer listed on the source page (cancelled, moved or unlisted)
