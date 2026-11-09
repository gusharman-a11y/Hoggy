-- What was read off each receipt (by the ReceiptReader or typed by the doctor).
-- status: 'needs_review' = read automatically, doctor hasn't confirmed yet;
--         'confirmed'    = doctor (or the system, for generated receipts) is happy.
-- Every receipt that already exists becomes 'confirmed' via the column default;
-- code that adds a receipt the doctor must check sets 'needs_review' explicitly.
-- is_tax_invoice: 1 yes, 0 no, NULL = unknown. receipt_date: YYYY-MM-DD.
-- extraction_json: the raw reader output (kept for audit / re-review).
ALTER TABLE receipts ADD COLUMN supplier_name TEXT;
ALTER TABLE receipts ADD COLUMN supplier_abn TEXT;
ALTER TABLE receipts ADD COLUMN gst_cents INTEGER CHECK (gst_cents IS NULL OR gst_cents >= 0);
ALTER TABLE receipts ADD COLUMN receipt_date TEXT;
ALTER TABLE receipts ADD COLUMN is_tax_invoice INTEGER CHECK (is_tax_invoice IS NULL OR is_tax_invoice IN (0, 1));
ALTER TABLE receipts ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('needs_review', 'confirmed'));
ALTER TABLE receipts ADD COLUMN extraction_json TEXT;
CREATE INDEX IF NOT EXISTS receipts_status ON receipts(status);

-- Each doctor gets a personal Hoggy address: inbox-<inbox_code>@in.studyleave.app.
-- Random (not the user id) so addresses can't be guessed.
ALTER TABLE users ADD COLUMN inbox_code TEXT;
UPDATE users SET inbox_code = lower(hex(randomblob(6))) WHERE inbox_code IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_inbox_code ON users(inbox_code);

CREATE TRIGGER IF NOT EXISTS users_inbox_code_default
AFTER INSERT ON users
WHEN NEW.inbox_code IS NULL
BEGIN
  UPDATE users SET inbox_code = lower(hex(randomblob(6))) WHERE id = NEW.id;
END;
