-- Persist Sam onboarding memory to avoid repeating declined/answered prompts.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sam_onboarding_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

