# Authentication Chunk 1 Route Authorization Matrix

Status: Draft for review
Scope: Frontend route meta policy and guard behavior

## 1. Guard Conventions

1. requiresAuth: route requires authenticated session.
2. requiredRoles: list of roles accepted by any-role match.
3. requireRole behavior: allow if user has at least one required role.

Pseudo-rule:

1. if requiresAuth is true and user is not authenticated -> redirect to login entry route.
2. if requiredRoles exists and user has no role intersection -> redirect to forbidden route.
3. else allow navigation.

## 2. Route Matrix (Current App)

| Route | Name | requiresAuth | requiredRoles | Notes |
|---|---|---:|---|---|
| /inspection | inspection | true | inspector, admin | Main inspection management |
| /assign-inspectors | assignInspectors | true | planner, admin | Assignment workflow |
| /checklist | checklist | true | inspector, planner, admin | Checklist access |
| /inspection-plan | inspectionPlan | true | planner, admin | Planning route |
| /inspection-report | inspectionReport | true | reporter, admin | Reporting route |
| /api/findings | findingsApi | true | inspector, planner, cap_entry, admin | Findings list and filters |
| /api/findings/:findingId | findingDetailApi | true | inspector, planner, cap_entry, admin | Finding detail |
| /api/findings/:findingId/caps | capSubmitApi | true | cap_entry, admin | CAP submission |
| /api/caps | capsApi | true | inspector, planner, cap_entry, admin | CAP list and filters |
| /api/caps/:capId | capDetailApi | true | inspector, planner, cap_entry, admin | CAP detail |
| /api/caps/:capId | capUpdateApi | true | cap_entry, admin | CAP content edit (Returned CAPs only; PATCH) |
| /api/caps/:capId/review | capReviewApi | true | inspector, admin | CAP review decision (only from Pending review) |
| /api/caps/drafts | capDraftCreateApi | true | cap_entry, admin | Create a draft CAP (Postgres-staged, POST) |
| /api/caps/drafts | capDraftListApi | true | cap_entry, admin | List current user's draft CAPs (GET) |
| /api/caps/drafts/:draftId | capDraftDetailApi | true | cap_entry, admin | Draft CAP detail (GET) |
| /api/caps/drafts/:draftId | capDraftUpdateApi | true | cap_entry, admin | Save draft CAP content (PATCH) |
| /api/caps/drafts/:draftId | capDraftDeleteApi | true | cap_entry, admin | Discard a draft CAP (DELETE) |
| /api/caps/drafts/:draftId/submit | capDraftSubmitApi | true | cap_entry, admin | Promote a draft into a real, Pending-review CAP |
| /api/caps/:capId/evidence/:evidenceNodeId/content | capEvidenceContentApi | true | inspector, planner, cap_entry, admin | View/download RCA or Risk Assessment evidence (never gated by CAP status) |
| /api/caps/:capId/evidence/:evidenceNodeId | capEvidenceDeleteApi | true | cap_entry, admin | Remove evidence (Returned CAPs only; DELETE) |
| /forbidden | forbidden | true | (none) | UX page for denied role |
| /login | login | false | (none) | Login entry point |
| /:pathMatch(.*)* | notFound | false | (none) | Catch-all |

## 3. Notes on Backend Enforcement

1. Router guards improve UX but do not replace API authorization.
2. API endpoints for each domain action must enforce the same role policy.
3. API policy should use the same any-role semantics for consistency.

## 4. Proposed Role Catalog (Initial)

1. admin: full access
2. inspector: inspection execution and checklist operations
3. planner: assignment and planning operations
4. reporter: report generation and report views
5. cap_entry: corrective action entry operations

## 5. Mapping Source

1. Roles are assigned by mapping Alfresco groups to app roles via database table.
2. Mapping table owner: application administration process.
3. Group naming should be normalized before lookup (trim + lowercase).

## 6. Test Cases for This Matrix

1. Anonymous user to /inspection -> redirect login.
2. Authenticated user with inspector role to /inspection -> allowed.
3. Authenticated user with inspector role to /assign-inspectors -> forbidden.
4. Authenticated user with planner role to /assign-inspectors -> allowed.
5. Authenticated user with admin role -> allowed on all protected routes.
6. Unknown route -> notFound.
