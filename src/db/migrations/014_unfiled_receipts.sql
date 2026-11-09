-- Receipts that reached a doctor's personal Hoggy inbox but couldn't be matched
-- to one of their trips (no fit, or more than one trip fits). Private to that
-- doctor; deleted after 7 days (US-030). Same detail columns as receipts, plus
-- why it wasn't filed. file_path is relative to the uploads folder, e.g.
-- "unfiled/12/inbox-ab12cd34ef56ab78.pdf".
CREATE TABLE IF NOT EXISTS unfiled_receipts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            TEXT    NOT NULL DEFAULT 'other',
  description     TEXT    NOT NULL DEFAULT '',
  amount_cents    INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  currency        TEXT    NOT NULL DEFAULT 'AUD',
  file_path       TEXT    NOT NULL,
  mime_type       TEXT    NOT NULL,
  original_name   TEXT,
  supplier_name   TEXT,
  supplier_abn    TEXT,
  gst_cents       INTEGER CHECK (gst_cents IS NULL OR gst_cents >= 0),
  receipt_date    TEXT,
  is_tax_invoice  INTEGER CHECK (is_tax_invoice IS NULL OR is_tax_invoice IN (0, 1)),
  extraction_json TEXT,
  email_subject   TEXT    NOT NULL DEFAULT '',
  reason          TEXT    NOT NULL CHECK (reason IN ('no_match', 'ambiguous')),
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);
CREATE INDEX IF NOT EXISTS unfiled_receipts_user_id ON unfiled_receipts(user_id);
CREATE INDEX IF NOT EXISTS unfiled_receipts_created_at ON unfiled_receipts(created_at);
