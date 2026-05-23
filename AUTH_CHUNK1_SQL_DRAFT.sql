-- Authentication Chunk 1 SQL Draft (PostgreSQL)
-- Status: Draft for review

-- Optional extension for UUID generation.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Application roles
CREATE TABLE IF NOT EXISTS app_role (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key TEXT NOT NULL UNIQUE,
  role_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional seed data for baseline application roles.
INSERT INTO app_role (role_key, role_name)
VALUES
  ('admin', 'Administrator'),
  ('inspector', 'Inspector'),
  ('planner', 'Planner'),
  ('reporter', 'Reporter'),
  ('assigner', 'Assigner'),
  ('cap_entry', 'CAP Entry')
ON CONFLICT (role_key) DO NOTHING;

-- 2) Mapping between Alfresco groups and application roles
CREATE TABLE IF NOT EXISTS alfresco_group_role_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alfresco_group TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES app_role(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (alfresco_group, role_id)
);

CREATE INDEX IF NOT EXISTS idx_agrm_group
  ON alfresco_group_role_map (alfresco_group);

CREATE INDEX IF NOT EXISTS idx_agrm_active
  ON alfresco_group_role_map (is_active);

-- 3) Server-side auth sessions
-- Notes:
-- - session_id is opaque random id returned only via secure cookie.
-- - alfresco_ticket_encrypted stores protected provider ticket value.
-- - roles_json is cached role array to avoid provider call on each request.
CREATE TABLE IF NOT EXISTS auth_session (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  email TEXT,
  alfresco_ticket_encrypted TEXT NOT NULL,
  roles_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_role_refresh_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at_idle TIMESTAMPTZ NOT NULL,
  expires_at_absolute TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  user_agent_hash TEXT,
  ip_hash TEXT,
  csrf_secret TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_auth_session_idle
  ON auth_session (expires_at_idle);

CREATE INDEX IF NOT EXISTS idx_auth_session_absolute
  ON auth_session (expires_at_absolute);

CREATE INDEX IF NOT EXISTS idx_auth_session_revoked
  ON auth_session (revoked_at);

CREATE INDEX IF NOT EXISTS idx_auth_session_username
  ON auth_session (username);

-- Optional view for active sessions only.
CREATE OR REPLACE VIEW auth_session_active AS
SELECT *
FROM auth_session
WHERE revoked_at IS NULL
  AND expires_at_idle > NOW()
  AND expires_at_absolute > NOW();

-- Cleanup job statement example (to be run by scheduler):
-- DELETE FROM auth_session
-- WHERE revoked_at IS NOT NULL
--    OR expires_at_idle <= NOW()
--    OR expires_at_absolute <= NOW();
