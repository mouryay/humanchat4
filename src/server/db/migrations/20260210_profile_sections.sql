-- New structured profile sections
-- Multi-entry sections stored as JSONB arrays for flexibility

ALTER TABLE users ADD COLUMN IF NOT EXISTS current_role_title TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_focus TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lived_experiences JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS products_services JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS places_known JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests_hobbies JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS currently_dealing_with JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS education TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_connection_types TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS topics_to_avoid TEXT[] DEFAULT '{}';

-- Index for matching on experiences and interests
CREATE INDEX IF NOT EXISTS idx_users_lived_experiences ON users USING GIN (lived_experiences);
CREATE INDEX IF NOT EXISTS idx_users_interests_hobbies ON users USING GIN (interests_hobbies);
CREATE INDEX IF NOT EXISTS idx_users_products_services ON users USING GIN (products_services);
CREATE INDEX IF NOT EXISTS idx_users_places_known ON users USING GIN (places_known);
