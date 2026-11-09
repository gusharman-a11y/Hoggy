-- Pages the ingest runner (`npm run ingest`) fetches conferences from.
CREATE TABLE sources (
  id INTEGER PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  last_fetched_at TEXT,
  last_status TEXT,
  events_found INTEGER
);
