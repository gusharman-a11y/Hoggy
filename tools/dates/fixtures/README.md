Hand-made HTML fixtures for tests/verify-dates.test.js. They copy the shape of real society and congress pages (navigation,
cookie banners, JSON-LD, footers with past editions, deadlines next to the event dates) but every society, host and date is
invented: hosts are under the reserved `.example` domain. They were written by hand because the session that built
tools/verify-dates.js could not reach organiser websites through its network proxy. `index.json` maps each URL to its file
(`blocked` entries replay a bot challenge); `rows.json` holds the conference rows the test turns into data/conferences.js.
