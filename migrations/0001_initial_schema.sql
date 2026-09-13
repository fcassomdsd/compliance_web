-- Compliance Web — initial database schema (PostgreSQL)
--
-- This is the single baseline migration. It consolidates the three files that
-- previously lived at the repository root (AUTH_CHUNK1_SQL_DRAFT.sql,
-- CAP_DRAFTS_SQL.sql, NOTIFICATIONS_SQL.sql); only the first of those was ever
-- mounted by docker-compose, so the CAP-draft and notification tables were
-- missing on a fresh database and the corresponding endpoints returned 502.
--
-- Applied by: npm run db:migrate  (see server/db/migrate.cjs)
-- Every statement is idempotent, so re-running against an existing database is
-- safe; the runner additionally records applied files in schema_migrations.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Application roles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_role (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key TEXT NOT NULL UNIQUE,
  role_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Baseline application roles.
INSERT INTO app_role (role_key, role_name)
VALUES
  ('admin', 'Administrator'),
  ('inspector', 'Inspector'),
  ('planner', 'Planner'),
  ('reporter', 'Reporter'),
  ('assigner', 'Assigner'),
  ('cap_entry', 'CAP Entry')
ON CONFLICT (role_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2) Mapping between Alfresco groups and application roles
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3) Server-side auth sessions
-- Notes:
-- - session_id is an opaque random id returned only via a secure cookie.
-- - alfresco_ticket_encrypted stores the protected provider ticket value.
-- - roles_json is a cached role array to avoid a provider call on each request.
-- ---------------------------------------------------------------------------
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

-- Active sessions only.
CREATE OR REPLACE VIEW auth_session_active AS
SELECT *
FROM auth_session
WHERE revoked_at IS NULL
  AND expires_at_idle > NOW()
  AND expires_at_absolute > NOW();

-- Cleanup statement for the scheduler:
-- DELETE FROM auth_session
-- WHERE revoked_at IS NOT NULL
--    OR expires_at_idle <= NOW()
--    OR expires_at_absolute <= NOW();

-- ---------------------------------------------------------------------------
-- 4) Login rate limiting (PostgreSQL-backed, shared across instances)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_login_attempt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_key TEXT NOT NULL UNIQUE,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempt_key
  ON auth_login_attempt (attempt_key);

-- ---------------------------------------------------------------------------
-- 5) Auth audit event log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_audit_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'auth',
  event TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_event_category
  ON auth_audit_event (category);
CREATE INDEX IF NOT EXISTS idx_audit_event_created_at
  ON auth_audit_event (created_at);

-- ---------------------------------------------------------------------------
-- 6) Corrective Action Plan (CAP) drafts
--
-- Draft CAPs are staged here, never as Alfresco nodes, so incomplete
-- in-progress work never pollutes the versioned vso:correctiveAction audit
-- trail the CAA consults. A draft is promoted into a real Alfresco CAP node
-- (and the row deleted) only when explicitly submitted for review.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cap_draft (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id TEXT NOT NULL,
  owner_username TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cap_draft_owner
  ON cap_draft (owner_username);

CREATE INDEX IF NOT EXISTS idx_cap_draft_finding
  ON cap_draft (finding_id);

-- ---------------------------------------------------------------------------
-- 7) Notifications
--
-- One row per (event, channel) delivery. Audit-grade: every send attempt
-- updates attempts/last_attempt_at, terminal state is always sent/failed, and
-- is_critical rows that exhaust retries stay queryable as a DB-persisted
-- failure record (see GET /api/notifications/failures) rather than depending on
-- another notification to report the failure.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'in_app')),
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_critical BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  failure_reason TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Retry job: find pending rows due for another attempt.
CREATE INDEX IF NOT EXISTS idx_notification_pending_due
  ON notification (next_attempt_at)
  WHERE status = 'pending';

-- In-app notification center: a user's own notifications, newest first.
CREATE INDEX IF NOT EXISTS idx_notification_recipient_channel
  ON notification (recipient, channel, created_at DESC)
  WHERE channel = 'in_app';

-- Critical-failure admin view (see notificationRepository.listCriticalFailures).
CREATE INDEX IF NOT EXISTS idx_notification_critical_failed
  ON notification (created_at DESC)
  WHERE is_critical AND status = 'failed';
