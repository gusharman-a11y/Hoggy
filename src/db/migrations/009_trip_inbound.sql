-- Each trip gets its own inbound email address: trip-<inbound_code>@in.studyleave.app.
-- A doctor forwards a receipt email there and the attachments land on the trip.
-- The code is random (not the trip id) so addresses can't be guessed.
ALTER TABLE trips ADD COLUMN inbound_code TEXT;
UPDATE trips SET inbound_code = lower(hex(randomblob(6))) WHERE inbound_code IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS trips_inbound_code ON trips(inbound_code);

-- New trips get a code however they are inserted.
CREATE TRIGGER IF NOT EXISTS trips_inbound_code_default
AFTER INSERT ON trips
WHEN NEW.inbound_code IS NULL
BEGIN
  UPDATE trips SET inbound_code = lower(hex(randomblob(6))) WHERE id = NEW.id;
END;
