# StudyLeave

Find a medical conference, get the trip approved, book travel, collect every
receipt and send the hospital one claim pack. See `CLAUDE.md` for the brief.

## Getting started

```bash
npm install
npm run seed      # demo hospital (join code DEMO2026) + SAMPLE conferences
npm run dev       # http://localhost:3000
```

Quality gate: `npm run typecheck && npm run lint && npm test`.
End-to-end: `CI=1 npm run e2e`.

## Adding conference sources

Conferences can be loaded from any web page that publishes schema.org
JSON-LD events (`Event`, `EducationEvent`, `EventSeries`, ...). Pages to read
are kept in the `sources` table.

```bash
npm run ingest -- add https://example.org/events   # add one or more pages
npm run ingest -- list                             # show sources + last status
npm run ingest                                     # fetch every source now
```

What a run does, for each source:

1. Reads the host's `robots.txt` once per run (as `StudyLeaveBot/0.1`). A
   404 means "allowed"; a 5xx or network error skips that host for the run.
   Disallowed pages are not fetched (status `blocked by robots.txt`).
2. Waits at least 2 seconds between requests to the same host.
3. Fetches the page with the User-Agent `StudyLeaveBot/0.1`, extracts events
   (`src/ingest/extract.ts`) and upserts them (`src/ingest/upsert.ts`): the
   same name + start date updates the existing conference instead of
   duplicating it, and blank fields never wipe known values.
4. Records `last_fetched_at`, `last_status` (`ok`, `http 404`,
   `blocked by robots.txt`, `error: ...`) and `events_found`.

The runner lives in `src/ingest/runner.ts`; `fetch`, `sleep` and the clock
are injectable, so tests use a fake web and never touch the network. Uses
`DATABASE_PATH` or `data/app.db`.
