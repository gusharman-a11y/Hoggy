-- Bookings (flights/hotels bought through a provider) and receipts (every
-- piece of evidence for a claim). Both hang off a trip, which carries org_id.
-- Money is integer cents + currency. Receipt files live under data/uploads;
-- file_path is relative to that folder (e.g. "12/booking-3.pdf").
CREATE TABLE IF NOT EXISTS bookings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id      INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  kind         TEXT    NOT NULL CHECK (kind IN ('flight', 'hotel')),
  provider     TEXT    NOT NULL,
  reference    TEXT    NOT NULL,
  details_json TEXT    NOT NULL DEFAULT '{}',
  total_cents  INTEGER NOT NULL CHECK (total_cents >= 0),
  currency     TEXT    NOT NULL DEFAULT 'AUD',
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);
CREATE INDEX IF NOT EXISTS bookings_trip_id ON bookings(trip_id);

CREATE TABLE IF NOT EXISTS receipts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id      INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  kind         TEXT    NOT NULL,
  description  TEXT    NOT NULL DEFAULT '',
  amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  currency     TEXT    NOT NULL DEFAULT 'AUD',
  file_path    TEXT,
  mime_type    TEXT,
  source       TEXT    NOT NULL CHECK (source IN ('generated', 'upload', 'email')),
  booking_id   INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);
CREATE INDEX IF NOT EXISTS receipts_trip_id ON receipts(trip_id);
CREATE UNIQUE INDEX IF NOT EXISTS receipts_booking_id ON receipts(booking_id) WHERE booking_id IS NOT NULL;
