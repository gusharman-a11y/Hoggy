-- Receipts a doctor uploads themselves (taxi, meals, registration...).
-- uploaded_by = who uploaded it (only they may delete it);
-- original_name = the file name they picked, used for downloads.
ALTER TABLE receipts ADD COLUMN uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE receipts ADD COLUMN original_name TEXT;
