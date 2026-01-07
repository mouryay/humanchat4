CREATE TABLE IF NOT EXISTS skill_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  skills_description TEXT NOT NULL,
  search_query TEXT,
  request_count INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  last_requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_requests_user ON skill_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_requests_status ON skill_requests(status);
CREATE INDEX IF NOT EXISTS idx_skill_requests_last_requested ON skill_requests(last_requested_at DESC);

DROP TRIGGER IF EXISTS skill_requests_set_updated_at ON skill_requests;
CREATE TRIGGER skill_requests_set_updated_at
  BEFORE UPDATE ON skill_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
