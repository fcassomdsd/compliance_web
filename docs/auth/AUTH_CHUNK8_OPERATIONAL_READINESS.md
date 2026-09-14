# Auth Chunk 8 Operational Readiness

Status: Ready for validation and rollout

## 1. Purpose

This document defines release checks, outage procedures, and rollback steps for the auth/session stack.

## 2. CI Gate Commands

Run these before merge:

1. `npm run test:server`
2. `npm run test:e2e`
3. `npm run test:auth:all`
4. `npm run build`
5. `npm run load:auth:probe`

## 3. Production Smoke Test (Post-Deploy)

1. Login with a valid user and confirm cookie session is created.
2. Call `/api/auth/session` and verify `authenticated=true`, role list, and csrf token present.
3. Open protected route as authorized user and confirm access.
4. Open protected route requiring other role and confirm forbidden UX.
5. Logout with csrf header and confirm session invalidation.
6. Repeat `/api/auth/session` and confirm 401 `AUTH_SESSION_EXPIRED`.

## 4. Alfresco Outage Runbook

Symptoms:

1. Spike in `AUTH_IDP_UNAVAILABLE` or failed login attempts.
2. Audit events showing repeated provider failures.
3. Increased session refresh warnings.

Immediate actions:

1. Confirm Alfresco health and network path from auth service.
2. Confirm no DNS/cert changes in runtime environment.
3. Announce incident with auth impact scope.

Mitigation policy:

1. Existing sessions continue with cached roles until expiry.
2. New login attempts may fail depending on provider status.
3. Role refresh failures should keep cached roles and emit audit events.

Recovery validation:

1. Verify new logins succeed.
2. Verify role refresh resumes by checking role refresh audit events.
3. Verify logout still revokes app session immediately.

## 5. Rollback Procedure

1. Roll back to previous auth release artifact/tag.
2. Keep PostgreSQL data intact unless schema rollback is explicitly required.
3. Verify endpoints:
   1. `/health`
   2. `/api/auth/diagnostics`
   3. `/api/auth/session`
4. Re-run smoke tests from section 3.

## 6. Operational Metrics to Track

1. Login success rate.
2. Login failure rate and rate-limited count.
3. Session 401 rate.
4. CSRF mismatch count.
5. Session rotation count.
6. Role refresh failure count.

## 7. Residual Risks and Follow-up

1. Rate limiter is PostgreSQL-backed with in-memory fallback when the `auth_login_attempt` table is absent. Multi-instance deployments share rate-limit state through the database — no external Redis dependency needed.
2. Auth audit events are persisted to the `auth_audit_event` table when available; falls back to console-only logging. Audit event spikes should trigger alert thresholds.
3. Add real PostgreSQL load tests in staging using production-like data volume.
4. AUTH_TICKET_ENCRYPTION_KEY is enforced at startup in production mode — the server refuses to start without it.
