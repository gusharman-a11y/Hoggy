# Course refresh 2026-11-17

Run: `node tools/refresh-courses.js`. Sessions before: 540, after: 579. Added 39, updated 21, unchanged 519, removed 0, kept from failed sources 0.

check-courses: courses: 11, sessions: 579, errors: 0, warnings: 2

## Sources

| Source | Status | Rows read | Sessions | URL |
|---|---|---|---|---|
| APLS Australia (Arlo API) | ok | 77 | 77 | <https://apls.arlo.co/api/2012-02-01/pub/resources/eventsearch/?fields=EventID,EventTemplateID,Name,Code,StartDateTime,EndDateTime,Location,IsFull,PlacesRemaining,AdvertisedOffers,RegistrationInfo,ViewUri,Summary&top=200> |
| ARC course-dates page | ok | 483 | 440 | <https://www.resus.org.au/training-and-education/advanced-life-support-courses/course-dates> |
| ACRRM als | ok | 19 | 19 | <https://www.acrrm.org.au/courses/face-to-face/als> |
| ACRRM rest | ok | 19 | 19 | <https://www.acrrm.org.au/courses/face-to-face/rest> |
| ACRRM paediatric-emergencies-for-rural-generalists | ok | 9 | 9 | <https://www.acrrm.org.au/courses/face-to-face/paediatric-emergencies-for-rural-generalists> |
| ACRRM advanced-neonatal-resuscitation | ok | 4 | 4 | <https://www.acrrm.org.au/courses/face-to-face/advanced-neonatal-resuscitation> |
| ACRRM reot | ok | 7 | 7 | <https://www.acrrm.org.au/courses/face-to-face/reot> |
| NZDA course portal (NZRC CORE) | ok | 4 | 4 | <https://www.nzda.org.nz/education/courses-events/search-events?title=core> |

### Rows not used

- ARC course-dates page: {"reason":"no start date","title":"Advanced Life Support Level 1 (1-Day Course) - Melbourne","dateCell":"Sunday 1 Nov"}

## Added (39: acrrm-rest 19, acrrm-paediatric-emergencies 9, acrrm-anr 4, acrrm-reot 7)

- `acrrm-rest-nsw-sydney-2026-11-26` 2026-11-26–2026-11-27 Sydney NSW · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-rest-qld-brisbane-2026-12-01` 2026-12-01–2026-12-02 Brisbane QLD · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-rest-nsw-sydney-2027-01-16` 2027-01-16–2027-01-17 Sydney NSW · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-rest-qld-brisbane-2027-02-06` 2027-02-06–2027-02-07 Brisbane QLD · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-rest-nt-darwin-2027-02-21` 2027-02-21–2027-02-22 Darwin NT · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-rest-wa-perth-2027-03-12` 2027-03-12–2027-03-13 Perth WA · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-rest-qld-brisbane-2027-03-19` 2027-03-19–2027-03-20 Brisbane QLD · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-rest-qld-brisbane-2027-04-10` 2027-04-10–2027-04-11 Brisbane QLD · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-rest-nsw-sydney-2027-04-17` 2027-04-17–2027-04-18 Sydney NSW · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-rest-vic-melbourne-2027-04-23` 2027-04-23–2027-04-24 Melbourne VIC · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-rest-sa-adelaide-2027-05-06` 2027-05-06–2027-05-07 Adelaide SA · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-rest-qld-brisbane-2027-05-15` 2027-05-15–2027-05-16 Brisbane QLD · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-rest-nsw-sydney-2027-05-22` 2027-05-22–2027-05-23 Sydney NSW · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-rest-vic-melbourne-2027-05-29` 2027-05-29–2027-05-30 Melbourne VIC · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-rest-qld-brisbane-2027-06-05` 2027-06-05–2027-06-06 Brisbane QLD · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-rest-act-canberra-2027-06-12` 2027-06-12–2027-06-13 Canberra ACT · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-rest-vic-churchill-2027-06-12` 2027-06-12–2027-06-13 Churchill VIC · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-rest-qld-brisbane-2027-06-26` 2027-06-26–2027-06-27 Brisbane QLD · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-rest-tas-hobart-2027-07-21` 2027-07-21–2027-07-22 Hobart TAS · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-paediatric-emergencies-qld-brisbane-2026-12-06` 2026-12-06–2026-12-07 Brisbane QLD · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-paediatric-emergencies-wa-perth-2027-01-27` 2027-01-27–2027-01-28 Perth WA · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-paediatric-emergencies-nsw-sydney-2027-02-20` 2027-02-20–2027-02-21 Sydney NSW · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-paediatric-emergencies-qld-brisbane-2027-03-13` 2027-03-13–2027-03-14 Brisbane QLD · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-paediatric-emergencies-vic-melbourne-2027-04-10` 2027-04-10–2027-04-11 Melbourne VIC · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-paediatric-emergencies-nt-darwin-2027-05-22` 2027-05-22–2027-05-23 Darwin NT · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-paediatric-emergencies-qld-brisbane-2027-06-11` 2027-06-11–2027-06-12 Brisbane QLD · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-paediatric-emergencies-qld-dalby-2027-08-14` 2027-08-14–2027-08-15 Dalby QLD · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-paediatric-emergencies-qld-kingaroy-2027-09-21` 2027-09-21–2027-09-22 Kingaroy QLD · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-anr-nsw-sydney-2026-11-22` 2026-11-22 Sydney NSW · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-anr-qld-brisbane-2026-12-09` 2026-12-09 Brisbane QLD · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-anr-qld-brisbane-2027-06-09` 2027-06-09 Brisbane QLD · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-anr-tas-hobart-2027-07-17` 2027-07-17 Hobart TAS · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-reot-nsw-sydney-2026-11-21` 2026-11-21 Sydney NSW · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-reot-qld-brisbane-2026-12-08` 2026-12-08 Brisbane QLD · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-reot-wa-perth-2027-01-25` 2027-01-25 Perth WA · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-reot-qld-townsville-2027-05-08` 2027-05-08 Townsville QLD · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-reot-sa-adelaide-2027-05-22` 2027-05-22 Adelaide SA · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-reot-qld-brisbane-2027-06-08` 2027-06-08 Brisbane QLD · ACRRM (Australian College of Rural and Remote Medicine)
- `acrrm-reot-tas-hobart-2027-07-16` 2027-07-16 Hobart TAS · ACRRM (Australian College of Rural and Remote Medicine)

## Updated (21)

- `apls-full-vic-melbourne-2027-02-17`: placesRemaining 5 → 4
- `apls-refresher-nsw-sydney-2027-06-01`: placesRemaining 15 → 14
- `als1-vic-box-hill-2026-11-17-citi-medical`: bookingUrlNote — → source booking link was not https; points to source page
- `als1-vic-box-hill-2026-11-25-citi-medical`: bookingUrlNote — → source booking link was not https; points to source page
- `als1-wa-belmont-2026-11-17-st-john-wa`: bookingUrl https://www.stjohnwa.com.au/first-aid-training/als1-course?gad_source=1&gad_campaignid=… → https://www.stjohnwa.com.au/first-aid-training/als1-course; bookingUrlNote — → ad-tracking parameters removed
- `als1-wa-belmont-2026-11-24-st-john-wa`: bookingUrl https://www.stjohnwa.com.au/first-aid-training/als1-course?gad_source=1&gad_campaignid=… → https://www.stjohnwa.com.au/first-aid-training/als1-course; bookingUrlNote — → ad-tracking parameters removed
- `als1-wa-belmont-2026-11-28-st-john-wa`: bookingUrl https://www.stjohnwa.com.au/first-aid-training/als1-course?gad_source=1&gad_campaignid=… → https://www.stjohnwa.com.au/first-aid-training/als1-course; bookingUrlNote — → ad-tracking parameters removed
- `als1-wa-belmont-2026-12-12-st-john-wa`: bookingUrl https://www.stjohnwa.com.au/first-aid-training/als1-course?gad_source=1&gad_campaignid=… → https://www.stjohnwa.com.au/first-aid-training/als1-course; bookingUrlNote — → ad-tracking parameters removed
- `als1-wa-belmont-2026-12-15-st-john-wa`: bookingUrl https://www.stjohnwa.com.au/first-aid-training/als1-course?gad_source=1&gad_campaignid=… → https://www.stjohnwa.com.au/first-aid-training/als1-course; bookingUrlNote — → ad-tracking parameters removed
- `als1-wa-belmont-2026-12-19-st-john-wa`: bookingUrl https://www.stjohnwa.com.au/first-aid-training/als1-course?gad_source=1&gad_campaignid=… → https://www.stjohnwa.com.au/first-aid-training/als1-course; bookingUrlNote — → ad-tracking parameters removed
- `als1-wa-belmont-2027-01-09-st-john-wa`: bookingUrl https://www.stjohnwa.com.au/first-aid-training/als1-course?gad_source=1&gad_campaignid=… → https://www.stjohnwa.com.au/first-aid-training/als1-course; bookingUrlNote — → ad-tracking parameters removed
- `als1-wa-belmont-2027-01-23-st-john-wa`: bookingUrl https://www.stjohnwa.com.au/first-aid-training/als1-course?gad_source=1&gad_campaignid=… → https://www.stjohnwa.com.au/first-aid-training/als1-course; bookingUrlNote — → ad-tracking parameters removed
- `als1-wa-belmont-2027-01-27-st-john-wa`: bookingUrl https://www.stjohnwa.com.au/first-aid-training/als1-course?gad_source=1&gad_campaignid=… → https://www.stjohnwa.com.au/first-aid-training/als1-course; bookingUrlNote — → ad-tracking parameters removed
- `als1-wa-belmont-2027-01-30-st-john-wa`: bookingUrl https://www.stjohnwa.com.au/first-aid-training/als1-course?gad_source=1&gad_campaignid=… → https://www.stjohnwa.com.au/first-aid-training/als1-course; bookingUrlNote — → ad-tracking parameters removed
- `als1-wa-belmont-2027-02-02-st-john-wa`: bookingUrl https://www.stjohnwa.com.au/first-aid-training/als1-course?gad_source=1&gad_campaignid=… → https://www.stjohnwa.com.au/first-aid-training/als1-course; bookingUrlNote — → ad-tracking parameters removed
- `als1-wa-belmont-2027-02-06-st-john-wa`: bookingUrl https://www.stjohnwa.com.au/first-aid-training/als1-course?gad_source=1&gad_campaignid=… → https://www.stjohnwa.com.au/first-aid-training/als1-course; bookingUrlNote — → ad-tracking parameters removed
- `als1-wa-belmont-2027-02-20-st-john-wa`: bookingUrl https://www.stjohnwa.com.au/first-aid-training/als1-course?gad_source=1&gad_campaignid=… → https://www.stjohnwa.com.au/first-aid-training/als1-course; bookingUrlNote — → ad-tracking parameters removed
- `als1-wa-belmont-2027-02-23-st-john-wa`: bookingUrl https://www.stjohnwa.com.au/first-aid-training/als1-course?gad_source=1&gad_campaignid=… → https://www.stjohnwa.com.au/first-aid-training/als1-course; bookingUrlNote — → ad-tracking parameters removed
- `als1-wa-belmont-2027-02-27-st-john-wa`: bookingUrl https://www.stjohnwa.com.au/first-aid-training/als1-course?gad_source=1&gad_campaignid=… → https://www.stjohnwa.com.au/first-aid-training/als1-course; bookingUrlNote — → ad-tracking parameters removed
- `nzrc-core-advanced-wellington-lower-hutt-2026-11-21-emcare-services-limited`: bookingUrl https://www.nzda.org.nz/education/courses-events/core-advanced-206 → https://www.emcare.co.nz/nzrc-core-advanced.html
- `nzrc-core-immediate-nelson-richmond-2026-11-24-resus-nelson-ltd`: bookingUrl https://www.nzda.org.nz/education/courses-events/core-immediate-130 → https://www.resusnelson.nz/cpr-courses/upcoming-course-dates

## Removed (0; logged in data/courses/removed-log.json)

