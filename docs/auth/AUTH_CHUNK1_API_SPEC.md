# Authentication Chunk 1 API Contract

Status: Draft for review
Scope: Contract and policy definition only (no implementation in this chunk)

## 1. Goals

1. Define stable authentication endpoints for frontend and backend parallel work.
2. Define ticket-backed server session model with PostgreSQL persistence.
3. Define role caching and refresh rules based on Alfresco groups.
4. Define standard auth error payloads.

## 2. Core Principles

1. Browser does not store Alfresco ticket.
2. Backend stores Alfresco ticket server-side and issues app session cookie.
3. Authorization is enforced by backend APIs; router guards are UX-level only.
4. Roles are cached in session and refreshed on interval.

## 3. Session and Timing Policy

1. Idle timeout: 30 minutes.
2. Absolute timeout: 12 hours.
3. Role refresh interval: 15 minutes.
4. Sliding expiration: extend idle timeout only when remaining idle time is <= 15 minutes.
5. Absolute timeout is never extended.
6. Session id rotation required on successful login and on role/privilege elevation.

## 4. Endpoints

### 4.1 POST /api/auth/login

Purpose: Authenticate against Alfresco, resolve roles, create server-side session.

Request body:

```json
{
  "username": "string",
  "password": "string"
}
```

Success: 200

```json
{
  "authenticated": true,
  "user": {
    "id": "string",
    "username": "string",
    "displayName": "string",
    "email": "string (optional)"
  },
  "roles": ["inspector", "planner"],
  "specialtyScope": ["ATS", "NAV"],
  "locale": "en",
  "session": {
    "issuedAt": "2026-03-31T12:00:00Z",
    "expiresAt": "2026-03-31T12:30:00Z",
    "absoluteExpiresAt": "2026-04-01T00:00:00Z",
    "idleTimeoutSeconds": 1800,
    "absoluteTimeoutSeconds": 43200,
    "roleRefreshAt": "2026-03-31T12:15:00Z"
  }
}
```

Failure:

1. 401 AUTH_INVALID_CREDENTIALS
2. 423 AUTH_ACCOUNT_LOCKED (if surfaced by provider)
3. 503 AUTH_IDP_UNAVAILABLE

### 4.2 GET /api/auth/session

Purpose: Initialize app auth state and optionally refresh session/roles by policy.

Success: 200

```json
{
  "authenticated": true,
  "user": {
    "id": "string",
    "username": "string",
    "displayName": "string",
    "email": "string (optional)"
  },
  "roles": ["inspector"],
  "specialtyScope": ["ATS", "NAV"],
  "locale": "en",
  "session": {
    "issuedAt": "2026-03-31T12:00:00Z",
    "expiresAt": "2026-03-31T12:40:00Z",
    "absoluteExpiresAt": "2026-04-01T00:00:00Z",
    "idleTimeoutSeconds": 1800,
    "absoluteTimeoutSeconds": 43200,
    "roleRefreshAt": "2026-03-31T12:30:00Z"
  }
}
```

Failure: 401 AUTH_SESSION_EXPIRED

Behavior notes:

1. If role refresh interval has elapsed, backend re-fetches groups and remaps roles.
2. If role refresh fails due to provider outage, backend may use cached roles for a short grace period (default 5 minutes) before forcing re-auth.
3. `specialtyScope` is the set of specialty codes the session may see and act on, taken from the signed-in user's `Inspector` record (`externalUserID` = the Alfresco username) through Node-RED's `GET /inspector/:externalId`, which returns `specialties: [{ id, code, name }]`. The Inspector record is the single source of truth; nothing is duplicated onto the assignment groups, which would need keeping in sync.
   - It is resolved **only for a session working as an inspector**: `inspector` among its roles and none of `admin`, `planner`, `assigner`, `reporter`, `cap_entry`, `closure_reviewer`. Any of those means the user is working under that role and is unscoped — a planner or an assigner who occasionally runs an inspection has an `Inspector` record, and it must not narrow their work. For such a session the record is never looked up.
   - `null` means **unscoped** (full access): any session not working as an inspector, a user with no `Inspector` record, or an inspector with no specialties linked. Unmatched users must never be locked out by this feature.
   - It is resolved at login and re-evaluated with the role cache, so a role gained mid-session clears it at the next refresh rather than at the next login; on a refresh *failure* the previously cached scope is kept rather than widened. On a login-time failure the session starts unscoped.
   - It is stored in `auth_session.metadata_json` alongside `groups`, so no schema change was needed.
   - `specialtyScopeIds` travels beside it: the same specialties as AtroCore link ids (`spec_ats`).
     Findings, CAPs and document ids use the codes; the AtroCore relations the UI and the gateway
     filters work with use the ids. Both are `null` for an unscoped session.
   - Where the scope is enforced — the gateway proxy (writes *and* reads), the `/api` filters and
     the UI's pickers — is documented in [`SPECIALTY_SCOPE_ENFORCEMENT.md`](SPECIALTY_SCOPE_ENFORCEMENT.md).

### 4.3 POST /api/auth/logout

Purpose: Revoke app session and clear cookie.

Success: 200

```json
{
  "ok": true
}
```

Behavior notes:

1. Endpoint is idempotent.
2. CSRF token is validated **before** the session cookie is cleared; a CSRF mismatch returns 403 without destroying the session.
3. Provider ticket revocation is async best effort.
4. Session is revoked server-side immediately even if provider ticket revocation fails.

### 4.4 POST /api/auth/locale

Purpose: Persist the caller's UI locale preference (`en` or `es`) for the current session.

Request body:

```json
{
  "locale": "en"
}
```

Success: 200

```json
{
  "ok": true,
  "locale": "en"
}
```

Failure:

1. 401 AUTH_SESSION_EXPIRED (no active session, or session expired)
2. 403 AUTH_FORBIDDEN (CSRF token missing or mismatched)
3. 400 AUTH_BAD_REQUEST (`locale` is anything other than `"en"` or `"es"`)

Behavior notes:

1. CSRF token is validated **before** the preference is persisted, matching the `/logout` pattern in §4.3.
2. Stored in the existing `auth_session.metadata_json` column, merged with existing metadata (e.g. `groups`) rather than overwriting it — no schema change was required.
3. `locale` is `null` in `/login` and `/session` responses (§4.1, §4.2) until this endpoint has been called at least once for that session; the frontend falls back to browser-detected locale in that case.

## 5. Cookie Requirements

1. HttpOnly = true
2. Secure = true (production)
3. SameSite = Lax (default); Strict if topology allows
4. Path scoped to auth/api prefix where practical

## 6. Error Payload Contract

All non-2xx auth responses use:

```json
{
  "code": "AUTH_FORBIDDEN",
  "message": "You do not have permission to access this resource.",
  "requestId": "req_01HV...",
  "timestamp": "2026-03-31T12:00:00Z"
}
```

Required auth codes:

1. AUTH_INVALID_CREDENTIALS
2. AUTH_SESSION_EXPIRED
3. AUTH_FORBIDDEN
4. AUTH_IDP_UNAVAILABLE
5. AUTH_ROLE_REFRESH_FAILED
6. AUTH_ACCOUNT_LOCKED
7. AUTH_BAD_REQUEST

## 7. Role Semantics

1. Route and API authorization use any-role match semantics.
2. User is authorized if intersection(userRoles, requiredRoles) is non-empty.
3. Unknown groups grant no roles.

## 8. Open Review Items

1. Confirm grace period for role-refresh outage (default 5 minutes).
2. Confirm whether to revoke provider ticket on logout synchronously or async best-effort.
3. MVP payload requires displayName; email remains optional.
