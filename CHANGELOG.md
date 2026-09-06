# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.5.0] - 2026-09-06

### Added
- **English/Spanish localization**: `vue-i18n` (Composition API) wired into the frontend, with a new `src/i18n/` locale catalog covering UI chrome. See `docs/STYLE_GUIDE.md` §13.
- **Locale persistence**: new `POST /api/auth/locale` endpoint persists a user's locale choice onto their session (`sessionPolicy.cjs`'s `buildSessionResponse()` returns it as `locale` on `/login`/`/session`). See `docs/auth/phase-1-contract/AUTH_CHUNK1_API_SPEC.md` §4.4.
- **`NOTIFICATION_LOCALE` env var**: selects the locale for the new locale-keyed notification catalog (`server/notifications/messages.cjs`); defaults to `es` to preserve existing all-Spanish notification behavior. Documented in `README.md`.
- **Locale-aware plan/report generation**: `apiInspectionPlan`/`apiInspectionReport` now forward the active UI locale as a `locale` query param, consumed by `compliance_flow` and `compliance_cmis`.
- **Client-side evidence file validation**: `src/utils/evidenceFile.js` mirrors the server's MIME allowlist and 15MB size limit, and is now checked at file-selection time in both `FollowUpManager.vue` and `CorrectiveActionManager.vue` — an unsupported or oversized file is rejected immediately, before the parent follow-up/CAP record is ever created (previously, evidence upload was a separate step after creation, so a rejected file left a "dud" record with no evidence and no indication anything had already been created).
- **`ActivityType` catalog support**: new `activityTypeStore.js` fetching the Nomenclatura activity-type reference entity (Auditoría/Inspección/Monitoreo/Revisión documental/Análisis de suceso, letter-coded A/I/M/D/S) dynamically, replacing a hardcoded English enum in `InspectionCadenceManager.vue` and a free-text input in `InspectionManager.vue`.
- **Rich Corrective Action Plan (CAP) registration**: CAP submission now captures 5 required sections — Root Cause Analysis (method, main category, root cause, contributing factors, evidence upload), Risk Assessment (hazard, consequence, probability, severity, calculated risk level, tolerability level, justification, evidence upload), Corrective Actions (repeatable list with sequence number, description, priority, responsible person, deadline), Expected Residual Risk (probability, severity, risk level, justification), and Effectiveness Verification (method, indicators, projected verification date).
- **Individually trackable corrective action items**: each action item has its own status (Open/In Progress/Closed) and closure date/notes, updatable via a new `PATCH /api/caps/:capId/actions/:sequenceNumber` endpoint independent of overall CAP acceptance status.
- **Evidence upload for CAPs**: new `POST /api/caps/:capId/rca/evidence` and `POST /api/caps/:capId/risk-assessment/evidence` endpoints accept multipart file uploads (via `multer`, memory storage), enforcing an evidence MIME-type allowlist and a 15 MB size limit, and link the uploaded `vso:evidenceItem` node to its section via the `vso:relatedEvidence` association.
- **`CorrectiveActionManager.vue`** redesigned with a 5-section Submit CAP form (add/remove corrective actions with auto sequence numbers) and a CAP detail view showing all sections plus per-action-item status/closure controls and evidence upload.
- **`capStore.js`**: new `updateActionItem` and `uploadCapEvidence` actions.
- **`apiServices.js`**: new `apiUpdateCapActionItem` and `apiUploadCapEvidence` functions.

### Changed
- **BREAKING — adopted the platform-wide Nomenclatura document-ID formats** (`V-`/`AV-`/`LV-`/`H-`/`P-`/`S-` prefixes — see root `CLAUDE.md` for the full table). `idFormats.cjs`/`documentCodes.js` rewritten accordingly.
- **BREAKING — Activity (Inspection) codes are now independently sequenced from their parent SiteVisit's code**, instead of copying it. SiteVisit codes reset per location per year (`V-XXXX-YYYY-##`); Activity codes are scoped by location + activity-type letter and never reset (`AV-XXXX-T-####`).
- **BREAKING — specialty catalog replaced** with a flat 16-code list (APR, AVIS, FAU, PAV, SSEI, AIM, ATS, COM, ECNS, EMET, FIS, MET, NAV, SAR, SUR, DPR), dropping the AGA/SNA/MET domain-grouping concept.
- **Permission change**: `authStore`'s domain-based specialty-scope restriction on the `assigner` role (keyed on retired AGA/SNA/VA Alfresco groups) is removed. An `assigner` can now act across all 16 specialties instead of a domain-restricted subset. Removed the dead `specialtyStore.js` this scoping used to read from.

### Fixed
- **Router-guard Pinia-initialization bug**: `applyAuthGuards()` accessed the auth store eagerly at router-module load time, before `app.use(pinia)` ran in `main.js`, crashing app boot with `getActivePinia() was called but there was no active Pinia`. Store access moved into the lazy `beforeEach` callback.
- **CI lint crash on JSON files**: `eslint-plugin-vue`'s `flat/essential` config carries rule sets with no `files` restriction, so adding the new `src/i18n/locales/*.json` resources crashed `vue-eslint-parser`. Locale JSON files excluded from lint (this repo has no JSON parser configured).
- **Activity-code sequence off-by-one**: `InspectionManager.vue` auto-creates an Inspection on mount (correct sequence), then a later save (setting the real activity type) re-scans existing Inspections to regenerate the code — the scan included the record's own current row, counting itself and inflating the sequence by one. Now excludes the record being updated.

## [0.4.0] - 2026-08-02

### Added
- **Site Visit + Per-Provider Inspection architecture**: SiteVisit as top-level container (`siteVisitStore.js`), per-provider `Inspection` entity (`inspectionStore.js`) with auto-generated opening/closing meeting schedules.
- **SiteVisitManager.vue**: Basic site visit data (code, location, dates, inspectors, status). Provider management with cards and +Add Provider dropdown. Services and schedules moved to per-provider `InspectionManager.vue`.
- **InspectionManager.vue**: Per-provider operations (inspection type, objective, scope, services, schedules, inspector assignments). Read-only description/conclusion fields populated after report generation.
- **Status badge per inspection**: Each per-provider Inspection has independent status (Created→Defined→Assigned→Planned→Uploaded→Reported→Complete→Inactive). Site visit status no longer used for operational gating.
- **InspectionReport.vue**: Description and Conclusion fields (editable, saved to Inspection on generate). Objective/Scope/Type displayed read-only from per-provider Inspection.
- **Smart date defaults**: Site visit start = today+20 days. End date = start+1 on blur. Schedule start = site visit start date 10:00. Report date = today.
- **Responsive hamburger navigation**: 8-link nav bar collapses to hamburger menu at ≤1024px.
- **STYLE_GUIDE.md**: Contributor reference with design tokens, component API, layout conventions, view patterns, and date defaults.

### Changed
- **Inspection → SiteVisit rename**: `Inspection` entity renamed to `SiteVisit` across all stores, views, and Node-RED flows. Objective and scope moved to per-provider `Inspection`.
- **Status gates per inspection**: `AssignInspectors`, `InspectionPlan`, `ChecklistManager`, `InspectionReport` filter by per-inspection status (`inspectionStore`) instead of site visit status.
- **Inspection Plan uses provider filter**: Service area selector replaced with provider selector. Plans generated per-provider for confidentiality.
- **ChecklistManager compact filters**: Three stacked dropdowns replaced with single-row 3-column grid. Saves ~250px vertical space.
- **Schedule form 2×2 layout**: 4-column layout (Name/Start/End/Place) replaced with 2×2 grid to prevent overflow.
- **Login page rebranded**: Added logo, CSS variables, input focus ring, branded title.
- **Delete → soft-delete**: Delete button on active site visits inactivates instead of hard-deleting. Inactivation cascades to all inspections. Blocked if any inspection at Uploaded+.

### UI Facelift (Design System)
- **Design token system**: 107 CSS custom properties in `style.css` — brand colors, neutrals, semantic colors (success/warning/error/info), spacing scale, border-radius scale, typography scale, shadows, transitions.
- **BaseButton.vue**: Unified button component with 6 variants, 3 sizes, icon/loading support. All 12 views migrated from raw buttons. Removed ~80 lines of duplicate CSS.
- **StatusBadge.vue**: Reusable status badge with color coding. Eliminated ~110 lines of duplicated CSS across SiteVisitManager and InspectionManager.
- **LoadingSpinner.vue**: Spinner component (sm/md/lg) with optional text. Replaced 5 inline loading indicators.
- **Inter font loaded** via Google Fonts.
- **Loader spinner fixed**: Border/border-top colors corrected for visible animation.
- **All hardcoded hex colors replaced** with CSS variables across 13 files.
- **Font-size standardization**: All `px`/raw `rem` values replaced with design tokens (`--text-xs` through `--text-2xl`).

### Layout Fixes
- **Button centering standardized**: All view action buttons now use `justify-self: center`.
- **Orphan grid cells removed**: SiteVisitManager (grid-cell5/6 removed), InspectionManager (grid-cell1 renumbered).
- **Missing grid-area CSS added**: AssignInspectors, InspectionPlan, InspectionReport now have proper `grid-area` assignments.
- **Responsive breakpoints added** to all grid views (single-column at 768px).
- **Findings/CorrectiveActions/Follow-ups** modernized with BaseButton, design tokens, card layouts. CorrectiveActions Submit/Review sections toggleable by button.

### Checklist Upsert Optimization
- **Diff-based upsert**: `inspectionQuestionStore.upsertChecklist()` compares existing vs selected questions. Only deletes removed questions, creates new ones, updates changed sequences. Typical save: ~5 API calls instead of ~50.

### Fixed
- Fixed orphan `grid-cell5`/`grid-cell6` in SiteVisitManager causing empty row gap.
- Fixed orphan `grid-cell1` in InspectionManager leaving left column empty on row 1.
- Fixed missing `grid-area` CSS in AssignInspectors, InspectionPlan, InspectionReport (dead `grid-template-areas`).
- Fixed InspectionManager grid-cell numbering after removing orphan cell.
- Fixed schedule form overflow (4 columns → 2×2 grid).
- Fixed `toInputDateTime` not handling space-separated backend datetime format.
- Fixed `DEFAULT_INSPECTION` references not renamed to `DEFAULT_SITEVISIT` in SiteVisitManager.
- Fixed `providerName` and `checklistSummaryTable` commented out in report webscript return object.

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
