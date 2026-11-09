-- Email outbox: every email the app "sends" in dev/test (OutboxMailer) lands here.
-- org_id is set when the email belongs to a hospital (e.g. a claim to its finance address).
CREATE TABLE IF NOT EXISTS outbox (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id     INTEGER REFERENCES orgs(id),
  to_addr    TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body_text  TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS outbox_org_id ON outbox(org_id);

CREATE TABLE IF NOT EXISTS outbox_attachments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id     INTEGER NOT NULL REFERENCES outbox(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL,
  content      BLOB NOT NULL
);
CREATE INDEX IF NOT EXISTS outbox_attachments_email_id ON outbox_attachments(email_id);
