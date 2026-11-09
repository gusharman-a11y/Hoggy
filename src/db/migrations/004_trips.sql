-- Trips: a doctor's plan to attend one conference, moving through
-- draft -> pending_approval -> approved -> booked -> claimed -> paid
-- (rejected trips go back to draft/pending_approval). Transitions are
-- enforced in src/lib/trips.ts; the CHECK only guards the value set.
CREATE TABLE IF NOT EXISTS trips (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id                 INTEGER NOT NULL REFERENCES orgs(id),
  user_id                INTEGER NOT NULL REFERENCES users(id),
  conference_id          INTEGER NOT NULL REFERENCES conferences(id),
  status                 TEXT    NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'booked', 'claimed', 'paid')),
  depart_city            TEXT,
  notes                  TEXT,
  est_registration_cents INTEGER NOT NULL DEFAULT 0,
  est_flights_cents      INTEGER NOT NULL DEFAULT 0,
  est_hotel_cents        INTEGER NOT NULL DEFAULT 0,
  est_other_cents        INTEGER NOT NULL DEFAULT 0,
  currency               TEXT    NOT NULL DEFAULT 'AUD',
  manager_comment        TEXT,
  created_at             TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);
CREATE INDEX IF NOT EXISTS trips_org_id ON trips(org_id);
CREATE INDEX IF NOT EXISTS trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS trips_org_status ON trips(org_id, status);
