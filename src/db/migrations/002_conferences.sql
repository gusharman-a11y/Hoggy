-- Conferences doctors can browse. Money in integer cents.
CREATE TABLE IF NOT EXISTS conferences (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  slug                   TEXT    NOT NULL UNIQUE,
  name                   TEXT    NOT NULL,
  specialty              TEXT    NOT NULL,
  start_date             TEXT    NOT NULL, -- YYYY-MM-DD
  end_date               TEXT    NOT NULL, -- YYYY-MM-DD
  city                   TEXT    NOT NULL,
  country                TEXT    NOT NULL,
  venue                  TEXT,
  lat                    REAL,
  lng                    REAL,
  url                    TEXT,
  cpd_points             INTEGER,
  registration_fee_cents INTEGER,
  currency               TEXT    NOT NULL DEFAULT 'AUD',
  source                 TEXT    NOT NULL DEFAULT 'sample',
  source_url             TEXT,
  updated_at             TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS conferences_start_date ON conferences(start_date);
CREATE INDEX IF NOT EXISTS conferences_specialty ON conferences(specialty);
CREATE INDEX IF NOT EXISTS conferences_country ON conferences(country);
