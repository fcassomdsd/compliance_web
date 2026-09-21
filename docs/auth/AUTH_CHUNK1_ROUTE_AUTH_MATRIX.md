# Route authorization matrix

Status: current — regenerated from the code on `develop`, 2026-09-21
Scope: every role gate in `compliance_web`, frontend and server

This replaces an earlier draft that had drifted from the code (it listed an `/inspection` route that
no longer exists and the wrong roles for three others, and interleaved frontend routes with `/api`
paths). Frontend routes and server routes are now separate tables, because they are separate
mechanisms: the first decides what the browser will navigate to, the second is the boundary.

## 1. Conventions

- **Any-role match, both sides.** A user is authorized if `userRoles ∩ requiredRoles` is non-empty.
  Server: `requireRoles` in `server/auth/sessionAuth.cjs`. Frontend: `authStore.hasRole` via
  `requireRole` in `src/router/guards.js`. Comparison is trimmed and lowercased on both sides.
- An empty or absent `requiredRoles` means **no role gate** — not "deny".
- Every server route except `/health` and the login/session bootstrap requires a session; every
  mutating route additionally requires the CSRF header.
- `admin` appears in every role gate; it is the break-glass role.
- Unknown Alfresco groups grant no roles, so a user whose groups map to nothing authenticates and is
  refused by every gated route.

Frontend guard order (`applyAuthGuards`): `requireAuth` → redirect to `login` with a `redirect`
query; then `requireRole` → redirect to `forbidden`.

## 2. Role catalog

Seeded by `migrations/0001_initial_schema.sql` and `0002_closure_reviewer_role.sql`:

| Role | What it is for |
|---|---|
| `admin` | Full access |
| `inspector` | Inspection execution, checklists, finding/CAP review |
| `planner` | Site visits, planning, inspection cadences |
| `reporter` | Reports and report views |
| `cap_entry` | Corrective-action entry and drafts, deadline-extension requests |
| `assigner` | Inspector-to-specialty assignment (`/assign-inspectors`) |
| `closure_reviewer` | Approving/rejecting a pending finding closure |

Roles come from Alfresco group membership through the `alfresco_group_role_map` table; group names
are normalised (trim, lowercase, optional `GROUP_` prefix stripped) before lookup. Only
`U-VSO-IN_ClosureReviewer` is seeded in the repo — the rest are deployment data. Changing a user's
roles means changing their group membership or the mapping table, and the user must log out and
back in (or wait for the 15-minute role refresh).

Whether a session is additionally narrowed to a set of specialties is a separate rule that keys off
this same role set: see [`SPECIALTY_SCOPE_ENFORCEMENT.md`](SPECIALTY_SCOPE_ENFORCEMENT.md).

## 3. Frontend routes (`src/router/index.js`)

| Route | Name | requiresAuth | requiredRoles |
|---|---|---:|---|
| `/` | home | true | *(none — redirects to the first permitted nav entry)* |
| `/oversight-posture` | oversightPosture | true | inspector, planner, reporter, admin |
| `/site-visit` | siteVisit | true | planner, admin |
| `/site-visit/:siteVisitId/provider/:providerId` | providerInspection | true | planner, admin |
| `/assign-inspectors` | assignInspectors | true | assigner, admin |
| `/checklist` | checklist | true | inspector, admin |
| `/inspection-plan` | inspectionPlan | true | planner, inspector, admin |
| `/inspection-report` | inspectionReport | true | inspector, admin |
| `/findings` | findings | true | inspector, planner, cap_entry, closure_reviewer, admin |
| `/corrective-actions` | correctiveActions | true | inspector, planner, cap_entry, admin |
| `/follow-ups` | followUps | true | inspector, planner, cap_entry, admin |
| `/inspection-cadences` | inspectionCadences | true | planner, admin |
| `/provider-history` | providerHistory | true | inspector, planner, reporter, admin |
| `/usoap-evidence-report` | usoapEvidenceReport | true | inspector, planner, reporter, admin |
| `/notifications` | notifications | true | *(none)* |
| `/login` | login | false | *(public)* |
| `/forbidden` | forbidden | true | *(none)* |
| `/:pathMatch(.*)*` | notFound | false | *(public)* |

The navigation bar and the landing page are both derived from these same arrays
(`src/router/navigation.js`): the nav offers only the entries the session may open, and `/` lands on
the first of them, falling back to `/notifications`. Neither is a boundary — they exist so the app
does not offer what the guard would refuse.

## 4. Server routes

### `/api/findings` — `server/findings/router.cjs`

| Route | Roles |
|---|---|
| `GET /api/findings` | inspector, planner, cap_entry, closure_reviewer, admin |
| `GET /api/findings/follow-ups` | inspector, planner, cap_entry, closure_reviewer, admin |
| `GET /api/findings/:findingId` | inspector, planner, cap_entry, closure_reviewer, admin |
| `GET /api/findings/:findingId/evidence/:evidenceNodeId/content` | inspector, planner, cap_entry, closure_reviewer, admin |
| `GET /api/findings/:findingId/follow-ups/:followUpId/evidence/:evidenceNodeId/content` | inspector, planner, cap_entry, closure_reviewer, admin |
| `POST /api/findings/:findingId/follow-ups` | inspector, admin |
| `POST /api/findings/:findingId/follow-ups/:followUpId/evidence` | inspector, admin |
| `PATCH /api/findings/:findingId/follow-ups/:followUpId/evidence-review` | inspector, admin |
| `PATCH /api/findings/:findingId/review` | inspector, admin |
| `PATCH /api/findings/:findingId/deadline-extension-review` | inspector, admin |
| `POST /api/findings/:findingId/deadline-extension-requests` | cap_entry, admin |
| `PATCH /api/findings/:findingId/closure-review` | closure_reviewer, admin |

`closure_reviewer` reads only; `closure-review` is the role's sole write.

### `/api/caps` and CAP submission — `server/caps/router.cjs`

| Route | Roles |
|---|---|
| `GET /api/caps`, `GET /api/caps/:capId` | inspector, planner, cap_entry, admin |
| `GET /api/caps/:capId/evidence/:evidenceNodeId/content` | inspector, planner, cap_entry, admin |
| `PUT /api/caps/:capId/evaluation` | inspector, admin |
| `PATCH /api/caps/:capId/review` | inspector, admin |
| `POST /api/findings/:findingId/caps` | cap_entry, admin |
| `PATCH /api/caps/:capId` | cap_entry, admin |
| `PATCH /api/caps/:capId/actions/:sequenceNumber` | cap_entry, admin |
| `POST /api/caps/:capId/{rca,risk-assessment,containment}/evidence` | cap_entry, admin |
| `DELETE /api/caps/:capId/evidence/:evidenceNodeId` | cap_entry, admin |
| `/api/caps/drafts*` — create, list, read, update, delete, submit | cap_entry, admin |

### Reports and USOAP — `server/reports/router.cjs`, `server/usoap/router.cjs`

| Route | Roles |
|---|---|
| `GET /api/reports/oversight-posture` + `/filter-options` | inspector, planner, reporter, admin |
| `GET /api/reports/provider-history` | inspector, planner, reporter, admin |
| `GET /api/reports/usoap-ce-evidence` + `/candidates/:nodeId/content` | inspector, planner, reporter, admin |
| `POST /api/usoap/direct-tag` | inspector, planner, reporter, admin |

### Notifications — `server/notifications/router.cjs`

| Route | Roles |
|---|---|
| `GET /api/notifications`, `/unread-count`, `PATCH /:id/read` | *(session only — scoped to the recipient)* |
| `GET /api/notifications/failures` | admin |

### Auth — `server/auth/router.cjs`

No role gate on any route: `POST /login`, `GET /session`, `POST /locale`, `POST /logout`,
`GET /ticket` (own session + CSRF), `GET /diagnostics` (unauthenticated).

## 5. The Node-RED gateway (`/nodered/*`)

`server/nodered/router.cjs` is an **allow-list**, not a pass-through: a request that
`server/nodered/gatewayPolicy.cjs` does not classify is refused with 403 `AUTH_GATEWAY_FORBIDDEN`
and never reaches the gateway. That matters because the same gateway also serves the Electron app
and the import service — `/importCanonical`, `/importFollowUps`, `/checklist`, `/findings/open` and
the rest are not reachable from a browser session.

Order of checks: session → classification → role → specialty scope → forward.

### Reads — a session is enough

`POST /queryEntity`, `GET /getLinks`, `GET /serviceAreas`, `GET /inspector/:externalId`,
`GET /siteVisit/:ref`, `GET /assignmentGroup/:group`.

Every role legitimately reads reference data, and `/inspector/:externalId` is called for *every*
user at login. What a scoped session may **see** is decided by the specialty read filter, not by a
role. A prefixed read takes exactly one further path segment.

### Writes — per entity

| Entity | add | update | delete |
|---|---|---|---|
| `SiteVisit` | planner, admin | planner, admin | planner, admin |
| `InspectedProvider` | planner, admin | planner, admin | planner, admin |
| `Inspection` | planner, admin | planner, **inspector**, **assigner**, admin | planner, admin |
| `InspectionSchedule` | planner, admin | planner, admin | planner, admin |
| `InspectedService` | planner, admin | planner, admin | planner, admin |
| `InspectedSpecialty` | planner, admin | planner, admin | planner, admin |
| `InspectionQuestion` | inspector, admin | inspector, admin | inspector, admin |
| `InspectionCadence` | planner, admin | planner, admin | planner, admin |

Any other entity cannot be written through the proxy at all: locations, providers, inspectors,
specialties, checklist questions and the rest of the reference data are maintained in AtroCore
itself.

`Inspection.update` carries three roles because three screens perform it — InspectionManager as a
planner, InspectionReport as an inspector, AssignInspectors as an assigner. This is **entity-level**
authorization: it cannot express "an assigner may set `status=Assigned` and nothing else". That
distinction belongs in the flows or a domain layer.

### Link writes — per entity + relation

| Relation | Roles |
|---|---|
| `InspectedSpecialty.actingInspectors` | assigner, admin |

The paths are `/addLinks` and `/deleteLinks` — **no `Entity` suffix**, which is what the flows
expose and what the client calls. The proxy previously looked for `/addLinksEntity`, so link writes
matched no rule and were forwarded without a specialty check.

### Actions — the two state-changing GETs

| Action | Roles |
|---|---|
| `GET /inspectionPlan` | planner, inspector, admin |
| `GET /inspectionReport` | inspector, admin |

Matching `/inspection-plan` and `/inspection-report` in the frontend table.

### What this means for `assigner`

`assigner` is now enforced server-side: it is the only role besides `admin` that may write
`InspectedSpecialty.actingInspectors`, and one of three that may update an `Inspection`. It is no
longer a frontend-only role.

### Interaction with the specialty scope

The scope applies only to a session working as an inspector, and the only gateway writes an
inspector may perform are `InspectionQuestion.*` and `Inspection.update` — so those are where the
write-side specialty guard actually bites. Every other gateway write belongs to a planner or an
assigner, and those sessions are unscoped by definition. The guard still runs on link writes and on
the other entities; it is simply unreachable for them under the current role matrix, and stays in
place so that it holds if the matrix changes. The **read** filter is unaffected and still applies to
every scope-controlled read a scoped session makes.

## 6. Test cases for this matrix

1. Anonymous user → any `requiresAuth` route → redirect to `login` carrying `redirect`.
2. `inspector` → `/checklist` → allowed; → `/assign-inspectors` → `/forbidden`.
3. `assigner` → `/assign-inspectors` → allowed; → `/site-visit` → `/forbidden`.
4. `admin` → every protected route → allowed.
5. `closure_reviewer` → `GET /api/findings/:id` → 200; `PATCH …/closure-review` → 200;
   `PATCH …/review` → 403.
6. `cap_entry` → `POST /api/findings/:id/caps` → 200; `PUT /api/caps/:id/evaluation` → 403.
7. A session whose groups map to no role → authenticates, 403 on every gated route, lands on
   `/notifications`.
8. Unknown route → `notFound`.
9. Gateway: `reporter` → `POST /nodered/addEntity?entity=SiteVisit` → 403; `planner` → 200.
10. Gateway: `planner` → `POST /nodered/addEntity?entity=InspectionQuestion` → 403;
    `inspector` → 200.
11. Gateway: any role → `POST /nodered/importCanonical` → 403 `AUTH_GATEWAY_FORBIDDEN`;
    `DELETE /nodered/deleteEntity?entity=Location` → 403.
12. Gateway: `inspector` → `POST /nodered/addLinks?entity=InspectedSpecialty&link=actingInspectors`
    → 403; `assigner` → forwarded.

Covered by `tests/unit/router/guards.test.js`, `tests/unit/router/navigation.test.js`,
`tests/unit/App.test.js`, `tests/server/nodeRedProxy.test.js` and the server router tests;
`npm run test:auth:all` runs the gate. `scripts/verify-specialty-scope-e2e.sh` drives the gateway
rules over HTTP against the real server process.
