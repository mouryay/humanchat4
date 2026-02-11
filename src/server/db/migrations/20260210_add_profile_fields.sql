-- Add extended profile fields for onboarding via Sam
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS experiences TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS location_born TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cities_lived_in TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS date_of_birth TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS accept_inbound_requests BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for finding users who accept inbound requests
CREATE INDEX IF NOT EXISTS idx_users_accept_inbound ON users(accept_inbound_requests) WHERE accept_inbound_requests = TRUE;
