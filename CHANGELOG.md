# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-07-30

### Added
- Added inspection status state machine with 8 states: `Created`, `Defined`, `Assigned`, `Planned`, `Uploaded`, `Reported`, `Complete`, `Inactive`.
- Added `src/utils/inspectionStatus.js` — status enum and 12 guard functions (`canTransitionTo`, `canInactivate`, `isReadOnly`, `canEditBasicValues`, `canAssignServices`, `canAssignInspectors`, `canProcessChecklists`, `canGeneratePlan`, `canGenerateReport`, `isActive`, `shouldRevertToAssignedOnReassign`).
- Added `INSPECTION_STATUS` enum and guard functions to `server/domain/statusRules.cjs`.
- Added `inactivateInspection()`, `reactivateInspection()`, and `updateInspectionStatus()` actions to inspection store.
- Added color-coded status badge to `InspectionManager.vue` with visual differentiation per state.
- Added create/read/update/inactivate gates to `InspectionManager.vue` (Edit, Services, Schedules, Inactivate/Reactivate buttons governed by status).
- Added state-filtered inspection lists to `AssignInspectors.vue`, `InspectionPlan.vue`, `ChecklistManager.vue`, and `InspectionReport.vue`.
- Added inspector assignment backward transition: reassigning a `Planned` inspection reverts status to `Assigned`.

### Changed
- New inspections auto-set to `Created` on first save.
- Delete button now soft-deletes (sets status to `Inactive`) instead of hard-deleting for active inspections. Hard delete still available for already `Inactive` inspections.
- `canGeneratePlan` expanded to accept `Planned` status (plan regeneration).
- `canAssignInspectors` expanded to accept `Planned` status (post-plan reassignment).

### Fixed
- Legacy inspections with null/empty status treated as `Created` for permissions and as active for inactivation.

## [0.2.1] - 2026-08-01

### Added
- Added `GET /api/auth/ticket` endpoint (CSRF-protected) returning decrypted Alfresco ticket
- Added `X-Alfresco-Ticket` header forwarding to all Node-RED API calls
- Added `authTicket()` service function and `buildNodeRedHeaders()` helper
- Added `refreshServiceTicket()` to authStore, called after login and session init

### Fixed
- Fixed `buildNodeRedHeaders()` returning `{}` instead of `undefined` when no ticket cached (axios treats `headers: undefined` as omission)

## [0.2.0] - 2026-06-21

### Added
- Added PostgreSQL-backed login rate limiter (`PgLoginRateLimiter`) with graceful fallback to in-memory when table is missing.
- Added PostgreSQL-backed audit event logger (`PgAuditLogger`) with graceful fallback to console-only logging.
- Added `auth_login_attempt` and `auth_audit_event` tables to `AUTH_CHUNK1_SQL_DRAFT.sql`.

### Changed
- Nginx now proxies all `/api/` routes to the backend (previously only `/api/auth/`), fixing findings and CAP API calls in production.
- CSRF validation now occurs before session cookie destruction on logout, preserving the session on CSRF mismatch.
- Session expiry comparison unified to use `<=` (inclusive boundary) in both the policy and middleware layers.
- `AUTH_TICKET_ENCRYPTION_KEY` now throws at startup in production instead of silently using a hardcoded dev key.
- `onBeforeMount` replaced with `onMounted` in 6 Vue views for correct async data-fetching lifecycle.
- `ScopePicker` now emits `status` alongside `findingStatus` so the Findings manager filter works correctly.

### Fixed
- Fixed CSS syntax error in `TopicChecklistGroup.vue` where `.question-details` block was never closed.
- Fixed `inspectorStore.loadInspectorSpecialties` writing to wrong state property (`specialties` → `inspectorSpecialties`).
- Fixed `AssignInspectors.saveAssignments` missing `await` on API calls, causing premature success toasts.
- Fixed overdue job follow-up lookup to also search directly under finding nodes (matching API behavior).
- Fixed `inspectionStore`, `locationStore`, and `inspectorStore` crashing on empty API responses (valid state for new installations).
- Fixed `apiCreateFollowUpReport` targeting non-existent `/caps/:id/follow-up-reports` endpoint.
- Fixed `eslint` duplicated in both `dependencies` and `devDependencies`.

### Removed
- Removed duplicate `getFollowUpReportsForFinding` from `findings/router.cjs` and `caps/router.cjs`; consolidated into `alfrescoMappers.cjs`.
- Removed duplicate `InMemorySessionRepository` from 4 test/script files; extracted to shared `tests/setup/mocks/`.
- Removed `AssignInspectors.test.js.bak` leftover file.
- Removed `httpx` from `compliance_import` requirements (unused dependency).

## [0.1.0] - 2026-05-23

Release scope: merge `develop` into `main`.

### Added
- Added backend session foundation and auth endpoints.
- Added Alfresco group-to-role mapping and session role refresh.
- Added Pinia auth store with session bootstrap.
- Added route guards (`requireAuth`, `requireRole`) and improved forbidden UX handling.
- Added CSRF protection, login rate limiting, and encrypted ticket handling for auth flows.
- Added auth e2e validation assets and operational-readiness documentation.
- Added containerized stack support for frontend/backend and CI publish jobs.
- Added global logout control in the app shell.
- Added inspection-scoped authorization and checklist assignment filtering.
- Added findings and CAP workflows.
- Added checklist risk levels and expanded associated tests.
- Added ID format parsers/builders for inspections, findings, CAPs, and follow-up reports.
- Added automatic CAP and follow-up report ID generation.
- Added redesigned scoped follow-up search and mapping.

### Changed
- Replaced legacy domain terminology with specialty terminology.
- Simplified inspection code generation to remove year dependency.
- Improved CAP acceptance status labels and aligned tests.
- Updated lint/test coverage and reorganized documentation.

### Fixed
- Fixed follow-up create flow to propagate upstream error details to the UI.
- Fixed follow-up CAP association tracking persistence (`inheritedCapId`).
- Fixed follow-up model constraints by removing invalid `vso:findingClosed` handling.
- Fixed Alfresco association listing by using where-filter query parameter.
