-- Add skills column to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';
