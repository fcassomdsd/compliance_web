# Auth Server Foundation (Chunk 2)

This folder contains the backend authentication foundation for:

1. POST /api/auth/login
2. GET /api/auth/session
3. POST /api/auth/logout
4. GET /api/auth/diagnostics

It implements server-side session persistence through PostgreSQL and async best-effort provider ticket revocation on logout.

## Required Environment Variables

1. DATABASE_URL
2. ALFRESCO_BASE_URL

Optional:

1. AUTH_SERVER_PORT (default: 4000)
2. AUTH_COOKIE_NAME (default: compliance_session_id)
3. AUTH_IDLE_TIMEOUT_SECONDS (default: 1800)
4. AUTH_ABSOLUTE_TIMEOUT_SECONDS (default: 43200)
5. AUTH_ROLE_REFRESH_INTERVAL_SECONDS (default: 900)
6. AUTH_SLIDING_RENEW_THRESHOLD_SECONDS (default: 900)

## Prerequisites

1. Apply schema from AUTH_CHUNK1_SQL_DRAFT.sql to PostgreSQL.
2. Ensure Alfresco authentication endpoint is reachable.

## Run

```bash
npm run server
```

## Test

```bash
npm run test:server
```

## Notes

1. Ticket storage currently uses plain persisted value placeholder and must be replaced with encryption/secret-management in hardening chunk.
2. Role mapping from Alfresco groups to app roles is planned for Chunk 3.
