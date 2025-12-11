ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure existing rows have an explicit value in case the column already existed without data.
UPDATE users
   SET onboarding_complete = FALSE
 WHERE onboarding_complete IS NULL;
