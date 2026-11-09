-- Study budgets: a doctor's study-leave allowance for one calendar year.
-- A missing row falls back to the hospital's default (orgs.default_allowance_cents).
CREATE TABLE IF NOT EXISTS budgets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id          INTEGER NOT NULL REFERENCES orgs(id),
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year            INTEGER NOT NULL,
  allowance_cents INTEGER NOT NULL CHECK (allowance_cents >= 0),
  UNIQUE (user_id, year)
);
CREATE INDEX IF NOT EXISTS budgets_org_id ON budgets(org_id);

ALTER TABLE orgs ADD COLUMN default_allowance_cents INTEGER NOT NULL DEFAULT 0;
