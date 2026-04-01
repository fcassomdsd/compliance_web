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
