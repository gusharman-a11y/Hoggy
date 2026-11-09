-- Finance view (US-023): finance marks a sent claim paid.
ALTER TABLE claims ADD COLUMN paid_at TEXT;
ALTER TABLE claims ADD COLUMN paid_by INTEGER REFERENCES users(id);
