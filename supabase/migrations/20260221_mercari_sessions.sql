-- ============================================================
-- Marketplace Server-Side Sessions
-- Stores captured auth tokens + cookies so server can proxy
-- marketplace API calls on behalf of the user (enables mobile listing).
-- ============================================================

CREATE TABLE IF NOT EXISTS user_marketplace_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace  TEXT NOT NULL,                 -- 'mercari', 'ebay', etc.

  -- Auth headers (JSON object of header name → value)
  auth_headers JSONB DEFAULT '{}',

  -- Cookie jar captured from the marketplace tab
  cookies      JSONB DEFAULT '{}',            -- { name: value, ... }

  -- Metadata
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_hint TIMESTAMPTZ,                   -- optional known expiry
  source_url   TEXT,                          -- URL where headers were captured

  UNIQUE (user_id, marketplace)
);

-- RLS
ALTER TABLE user_marketplace_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select_own" ON user_marketplace_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "sessions_insert_own" ON user_marketplace_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sessions_update_own" ON user_marketplace_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "sessions_delete_own" ON user_marketplace_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_marketplace_session_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_marketplace_session_updated_at
  BEFORE UPDATE ON user_marketplace_sessions
  FOR EACH ROW EXECUTE FUNCTION update_marketplace_session_ts();

-- Index for fast per-user per-marketplace lookups
CREATE INDEX IF NOT EXISTS idx_marketplace_sessions_lookup
  ON user_marketplace_sessions (user_id, marketplace);
