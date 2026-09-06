-- Notifications (PostgreSQL)
-- Status: Draft for review
--
-- One row per (event, channel) delivery. Audit-grade: every send attempt
-- updates attempts/last_attempt_at, terminal state is always sent/failed,
-- and is_critical rows that exhaust retries stay queryable as a
-- DB-persisted failure record (see GET /api/notifications/failures) rather
-- than depending on another notification to report the failure.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
