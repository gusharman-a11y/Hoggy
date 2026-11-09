-- Sending the claim (US-022): emails can carry CCs, and each sent claim is recorded.
ALTER TABLE outbox ADD COLUMN cc_addr TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS claims (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id       INTEGER NOT NULL UNIQUE REFERENCES trips(id) ON DELETE CASCADE,
  org_id        INTEGER NOT NULL REFERENCES orgs(id),
  sent_by       INTEGER NOT NULL REFERENCES users(id),
  to_addr       TEXT    NOT NULL,
  cc_addr       TEXT    NOT NULL DEFAULT '',
  filename      TEXT    NOT NULL,
  total_cents   INTEGER NOT NULL,
  currency      TEXT    NOT NULL DEFAULT 'AUD',
  receipt_count INTEGER NOT NULL,
  page_count    INTEGER NOT NULL,
  email_id      INTEGER REFERENCES outbox(id) ON DELETE SET NULL,
  sent_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS claims_org_id ON claims(org_id);
