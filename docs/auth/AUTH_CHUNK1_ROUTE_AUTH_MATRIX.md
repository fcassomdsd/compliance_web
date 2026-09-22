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

Order of checks: session → classification → role → **field rules → record ownership** → specialty
scope → forward.

### Reads — a session is enough

`POST /queryEntity`, `GET /getLinks`, `GET /inspector/:externalId`, `GET /siteVisit/:ref`,
`GET /assignmentGroup/:group`.

Every role legitimately reads reference data, and `/inspector/:externalId` is called for *every*
user at login. What a scoped session may **see** is decided by the specialty read filter, not by a
role. A prefixed read takes exactly one further path segment.

### Writes — per entity

| Entity | add | update | delete |
|---|---|---|---|
| `SiteVisit` | planner, admin | planner, admin | planner, admin |
| `InspectedProvider` | planner, admin | planner, admin | planner, admin |
| `Inspection` | planner, admin | planner, **inspector**, **assigner**, admin — per field, see below | planner, admin |
| `InspectionSchedule` | planner, admin | planner, admin | planner, admin |
| `InspectedService` | planner, admin | planner, admin | planner, admin |
| `InspectedSpecialty` | planner, admin | planner, admin | planner, admin |
| `InspectionQuestion` | inspector, admin | inspector, admin | inspector, admin |
| `InspectionCadence` | planner, admin | planner, admin | planner, admin |

Any other entity cannot be written through the proxy at all: locations, providers, inspectors,
specialties, checklist questions and the rest of the reference data are maintained in AtroCore
itself.

#### Field rules on `Inspection.update`

`Inspection.update` is the only gateway write more than one non-admin role performs, and the three
roles do three different jobs on it — so its rule names the fields, and where a screen writes one
value or one person's data, the values and the owner too:

| Role | May write | Why |
|---|---|---|
| `planner` | `activityTypeId`, `objective`, `scope`, `code` | InspectionManager defines the inspection. `code` is there because `updateInspection` re-mints the activity code when the activity type changes while the inspection is still at `Created`. |
| `inspector` | `description`, `conclusion` — **and only if the session is the site visit's main inspector** | InspectionReport stamps the report outcome. The objective, scope and activity type are the planner's and are shown read-only there. |
| `admin` | *anything* | Break-glass. |

**`status` is nobody's to write here.** Every transition is a gateway action that decides the target
status itself (see below), so the assigner — whose only write to an `Inspection` was the move to
`Assigned` — no longer appears on this entity at all.

The two screens are separated in the UI to match: InspectionManager shows `description`/`conclusion`
read-only ("set during report"), and InspectionReport shows `objective`/`scope`/activity type
read-only. Neither submits the fields it only displays.

A session holding two roles gets the **union** of their field sets, the same way authorization is an
any-role match. Ownership, though, is tracked **per field**: a second role lifts the requirement only
on the fields it grants in its own right, so an inspector who is also a planner may write the
planner's fields freely and still only sets the report outcome on a visit they lead.

A payload is refused whole, with 403 `AUTH_GATEWAY_FIELD_FORBIDDEN`, as soon as one field is out of
bounds; nothing reaches the gateway.

#### Record ownership

`description` and `conclusion` are the **report outcome**, and they belong to the main inspector of
the site visit — the person designated to lead it, not to whoever holds the inspector role. Being
main inspector is a per-site-visit attribution (`SiteVisit.mainInspectorId`): anyone can lead one
visit and not the next, so no group membership and no role can express it.

`server/nodered/ownershipGuard.cjs` resolves it the same way the specialty guard reads records back:

```
Inspection.inspectedProviderId -> InspectedProvider.siteVisitId -> SiteVisit.mainInspectorId
```

compared against the session's own `Inspector` id, resolved at login and carried in
`metadata.inspectorId`. Note this is resolved for **any** session holding the `inspector` role, not
only a specialty-scoped one — an inspector who is also a planner can still lead a visit.

It fails closed, as the specialty guard does: 403 `AUTH_NOT_RECORD_OWNER` when the session is not
the main inspector, and 403 `AUTH_OWNERSHIP_UNVERIFIED` when the chain cannot be followed or the
visit names no main inspector. A write that cannot be attributed is not assumed to be the owner's.

Every other write keeps a plain role list, because a single role owns the entity outright. Field
rules are for a role reaching an entity for one narrow purpose; ownership rules are for a field that
belongs to a person.

### Link writes — per entity + relation

| Relation | Roles |
|---|---|
| `InspectedSpecialty.actingInspectors` | assigner, admin |

The paths are `/addLinks` and `/deleteLinks` — **no `Entity` suffix**, which is what the flows
expose and what the client calls. The proxy previously looked for `/addLinksEntity`, so link writes
matched no rule and were forwarded without a specialty check.

### Actions — the state-changing GETs

Each action *is* a transition: the caller names the action and never a target status, so the role
that performs it in the UI is the role that may call it, and the state machine is enforced in the
flow rather than in the browser.

| Action | Transition | Roles |
|---|---|---|
| `GET /inspectionDefine` | `Created → Defined` | planner, admin |
| `GET /inspectionAssign` | `→ Assigned`, from `Defined` or `Planned` | assigner, admin |
| `GET /inspectionPlan` | `→ Planned` | planner, inspector, admin |
| `GET /inspectionReport` | `→ Reported` | inspector, admin |

`Planned → Assigned` is the reassignment revert: assigning different inspectors to an inspection
that already has a plan sends it back so the plan is regenerated. A disallowed transition answers
`409` from the flow, an unknown inspection `404`, and one already in effect `200` with
`changed: false`.

`compliance_flow` owns the rules — see its "Inspection Status Transitions" tab and its README's API
Reference. `Planned → Uploaded` is `/importCanonical`'s, reached by the Electron app rather than
from here.

Note the specialty-scope check on actions is keyed by `siteVisit`+`provider` and so does not apply
to the two id-keyed transitions; both are performed by roles that are unscoped by definition
(planner, assigner), so there is nothing to narrow.

### What this means for `assigner`

`assigner` is enforced server-side: it is the only role besides `admin` that may write
`InspectedSpecialty.actingInspectors`, and the only one that may call `/inspectionAssign`. It no
longer writes the `Inspection` entity at all — its transition became an action — so it is a
frontend-only role no more, and its server surface is now exactly its job.

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
13. Gateway fields: `assigner` → `PUT …updateEntity?entity=Inspection` with `{"status":"Assigned"}`
    → 200; with `{"status":"Complete"}` or `{"objective":"…"}` → 403
    `AUTH_GATEWAY_FIELD_FORBIDDEN`. `planner` → its own form fields → 200; `{"conclusion":"…"}` → 403.
14. Gateway ownership: the visit's main inspector → `{"conclusion":"…"}` → 200; another inspector of
    the same specialty → 403 `AUTH_NOT_RECORD_OWNER`; a visit with no main inspector → 403
    `AUTH_OWNERSHIP_UNVERIFIED`.
15. Gateway transitions: `planner` → `GET /nodered/inspectionDefine?inspection=…` → 200,
    `/inspectionAssign` → 403; `assigner` the reverse. Any role writing `{"status":…}` through
    `updateEntity` → 403 `AUTH_GATEWAY_FIELD_FORBIDDEN`.

Covered by `tests/unit/router/guards.test.js`, `tests/unit/router/navigation.test.js`,
`tests/unit/App.test.js`, `tests/server/nodeRedProxy.test.js` and the server router tests;
`npm run test:auth:all` runs the gate. `scripts/verify-specialty-scope-e2e.sh` drives the gateway
rules over HTTP against the real server process.
