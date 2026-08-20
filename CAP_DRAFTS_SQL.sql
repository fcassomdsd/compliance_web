-- Corrective Action Plan (CAP) drafts (PostgreSQL)
-- Status: Draft for review
--
-- Draft CAPs are staged here, never as Alfresco nodes, so incomplete
-- in-progress work never pollutes the versioned vso:correctiveAction
-- audit trail the CAA consults. A draft is promoted into a real Alfresco
-- CAP node (and the row deleted) only when explicitly submitted for review.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
