# Specialty scope enforcement

A session may carry a **specialty scope**: the specialties its user is allowed to see and act on,
derived from their `Inspector` record. This document is the map of where that scope is enforced and
what each layer is responsible for. The session field itself (how it is resolved, refreshed and
returned) is specified in [`AUTH_CHUNK1_API_SPEC.md`](AUTH_CHUNK1_API_SPEC.md) §4.1–4.2.

## The rule

The scope follows the **role the user works under**, not the existence of an `Inspector` record.
Only a session working as an inspector is narrowed; holding any other role in the app's catalog
means the user is working under *that* role and sees everything. Planners and assigners who
occasionally run an inspection themselves have an `Inspector` record, and it must not narrow the
work they do as a planner or an assigner.

`server/auth/specialtyScope.cjs` holds both halves of the rule:

```js
SCOPE_EXEMPTING_ROLES = ['admin', 'planner', 'assigner', 'reporter', 'cap_entry', 'closure_reviewer']
isSpecialtyScopedSession(roles) = 'inspector' ∈ roles && roles ∩ SCOPE_EXEMPTING_ROLES = ∅
```

| Session roles | Scoped? |
|---|---|
| `inspector` | **yes** — narrowed to the Inspector record's specialties |
| `inspector` + any of `admin`/`planner`/`assigner`/`reporter`/`cap_entry`/`closure_reviewer` | no |
| `planner`, `assigner`, … (no `inspector`), with or without an Inspector record | no |
| `inspector` + a role the catalog does not carry | **yes** — see below |
| no roles at all | no (and every role-gated route refuses them anyway) |

The rule is written against the **catalog** rather than as "inspector is the only role": a
deployment-local group→role mapping the app gates on nowhere must not be able to switch the scope
off. `SCOPE_EXEMPTING_ROLES` is every catalog role except `inspector`
(`migrations/0001_initial_schema.sql` + `0002_closure_reviewer_role.sql`), so adding a role to the
catalog means deciding whether it belongs on that list.

For a session that is not working as an inspector the `Inspector` record is **never looked up** —
`resolveSpecialtyScope` (`server/auth/router.cjs`) returns `null` before it reaches Node-RED.

| Session scope | Meaning |
|---|---|
| `specialtyScope: null` | **Unscoped** — full access. Any session not working as an inspector, a user with no `Inspector` record, or an inspector with no specialties linked. |
| `specialtyScope: ["ATS", "NAV"]` | The session may only see and act on those specialties. |

Two views of the same set travel on the session, because the platform uses both:

| Field | Shape | Used by |
|---|---|---|
| `specialtyScope` | codes (`ATS`, `NAV`) | findings, CAPs, follow-ups and document ids (`H-…-EEE-###`) |
| `specialtyScopeIds` | AtroCore link ids (`spec_ats`, `spec_nav`) | AtroCore relations (`Inspection.inspectedSpecialties`, `ChecklistQuestion.specialty`) |

A record that carries **no** specialty is not attributable to one, so it is not restricted. That
applies to whole entities (locations, providers, contacts, regulations are shared across
specialties) and to individual records (an `Inspection` whose `inspectedSpecialties` is empty).

Roles are re-resolved with the role cache every 15 minutes, and the scope is re-evaluated with
them: a user added to the planners' group loses the scope at the next refresh rather than at the
next login. A role change forces a session rotation, and the rotated session carries the
re-evaluated scope.

Unmatched users must never be locked out: a failed scope lookup at login starts the session
unscoped, and a failed lookup during the 15-minute refresh keeps the previously cached scope rather
than widening it.

## Where it is enforced

### 1. Node-RED proxy — `server/nodered/router.cjs`

The browser reaches the gateway through the app server (`/nodered/*`), never directly. Every call
already requires a session; with a scope it is also checked:

The proxy checks the session, then the **role** (`server/nodered/gatewayPolicy.cjs` — an allow-list
of gateway operations with a role set each; see
[`AUTH_CHUNK1_ROUTE_AUTH_MATRIX.md`](AUTH_CHUNK1_ROUTE_AUTH_MATRIX.md) §5), then the scope:

- **Writes** (`addEntity`, `updateEntity`, `deleteEntity`, `addLinks`, `deleteLinks`):
  `server/nodered/scopeGuard.cjs` reads the specialty from the payload, and for a delete, a
  status-only update or a link write from the stored record — following
  `Inspection.inspectedSpecialties → InspectedSpecialty.specialtyId` when the entity only holds link
  ids. A link write is attributed to the record it hangs off, which is the record that carries the
  specialty. Outside the scope → 403 `AUTH_SCOPE_FORBIDDEN`; record unreadable → 403
  `AUTH_SCOPE_UNVERIFIED` (a write that cannot be attributed is not assumed in scope).

  **Which writes this actually reaches.** A scoped session works as an inspector, and the only
  gateway writes an inspector may perform are `InspectionQuestion.*` and `Inspection.update` — so
  those are where the write guard bites. Every other gateway write belongs to a planner or an
  assigner, and those sessions are unscoped by definition. The guard still runs for them; it is
  simply unreachable under the current role matrix, and stays so that it holds if the matrix
  changes.
- **State-changing GETs** (`/inspectionPlan`, `/inspectionReport`): attributed to the inspections
  they act on — the provider's inspection at that site visit, or every inspection of the visit when
  the call names no provider (read through
  `SiteVisit.inspectedProviders → Inspection.inspectedSpecialties`). Any inspection outside the
  scope refuses the action.
- **Reads** (`queryEntity`): the fields that identify a record's specialty are forced into the
  upstream `select` (a caller asking for `select=id` cannot hide them), rows outside the scope are
  dropped, and `total` is recomputed so it matches the list returned.

Scope-controlled entities are listed in `SCOPE_CONTROLLED_ENTITIES`
(`server/auth/specialtyScope.cjs`): `ChecklistQuestion`, `QuestionTopic`, `InspectionCadence`,
`LocationService`, `Inspector`, `InspectedSpecialty`, `Inspection`, `InspectedService`,
`InspectionQuestion`.

### 2. App API — `server/auth/scopeEnforcement.cjs`

The `/api` surface (findings, CAPs, drafts, reports) is filtered server-side:

- **Lists** (`GET /api/findings`, `/api/findings/follow-ups`, `/api/caps`, `/api/caps/drafts`) drop
  rows whose `specialtyCode` is outside the scope.
- **Document-id routes** — every `/:findingId/...` and `/:capId/...` — are refused before any
  Alfresco call. Findings, CAPs, follow-ups and checklists embed the specialty in the id
  (`H-…-EEE-###`, `P-…-EEE###-##`, `S-…-EEE###-##`, `LV-…-EEE`), so no extra lookup is needed. CAP
  drafts are resolved through their stored `findingId`.
- An explicit `?specialtyCode=` outside the scope is refused rather than answered with an empty
  page: "no findings" must not mean "none you may see".
- **Reports**: the oversight-posture report and its filter options are computed from scoped
  findings and CAPs; the CE-evidence and provider-history reports push the session's codes into the
  `specialtyCode` filter their web scripts accept, so their counts describe the same population as
  the lists they return.

Note the link paths are `/addLinks` and `/deleteLinks`, with no `Entity` suffix — what the flows
expose and what the client calls. The proxy used to match `/addLinksEntity`, so link writes fell
through the guard entirely until the gateway allow-list replaced that matching.

### 3. UI — `useAuthStore`

The UI is the *offer* side, not the boundary: it must not propose an action the server will refuse.
`specialtyInScope(code)` / `specialtyIdInScope(id)` (null scope = everything) gate the specialty
pickers — inspection cadence, assign-inspectors and the checklist manager's specialty selector.
The lists themselves are filtered by the proxy's read filter, so no view needs its own copy of that
rule.

`isActingAsInspector` is the store's mirror of `isSpecialtyScopedSession` — the same role rule, for
the one UI behaviour that keys off it rather than off the resolved scope: `ChecklistManager` narrows
the specialty list to the inspector's own assignments. Its `SCOPE_EXEMPTING_ROLES` constant must be
kept in step with the server's.

## What is deliberately not covered

- **`getLinks`** (a read of one record's relations) is not filtered; the record it hangs off
  is checked on the write path, and the relations themselves are what the caller already may read
  through `queryEntity`.
- **`/api/auth/ticket`** still returns the Alfresco ticket to the browser, although the proxy no
  longer needs it (it uses the session's own). Removing it is a contract change for other clients
  and is tracked separately.

## Testing

Unit and route tests live next to the code they cover:

| Area | Test |
|---|---|
| scope resolution, the role rule, refresh, unscoped cases | `tests/server/authSpecialtyScope.test.js` |
| gateway proxy: auth, allow-list, role gate, key/ticket injection, write guard, link writes, plan/report actions, read filter | `tests/server/nodeRedProxy.test.js` |
| API narrowing: lists, id-addressed refusals, CAP drafts | `tests/server/scopeEnforcement.test.js` |
| store and picker gating | `tests/unit/...`, `tests/server/...` (see `npm run test:auth:all`) |

`npm run test:auth:all` runs the full pre-merge gate for anything touching auth, roles or scope.

`scripts/verify-specialty-scope-e2e.sh` boots the **real** server process against a throwaway
PostgreSQL and a stub of the two upstreams (their credentials are not in this repository) and drives
it over HTTP: an unauthenticated gateway call is refused, login resolves the scope, a scoped
`queryEntity` read drops the out-of-scope row, the gateway is shown to receive the API key and the
session's ticket and never the session cookie, and an out-of-scope write is refused. A second user
with the **same** Inspector record but the planner role as well then logs in unscoped, reads the row
the inspector could not, and writes outside that record's specialties. The unit tests
call `createApp` directly, so this is what covers the wiring in `server/index.cjs` and the real
session store. It needs Docker.

Against a **live stack** the same path is: run the app server (`npm run server`) and the Vite dev
server with `VITE_API_PROXY_TARGET` pointed at it, log in with a real Alfresco account, and call
`/nodered/queryEntity` through the dev server. A session scoped to one specialty (set
`specialtyScope`/`specialtyScopeIds` in the session's `metadata_json`, which is what login writes for
a scoped user) then sees only its own rows, and an out-of-scope write is refused with
`AUTH_SCOPE_FORBIDDEN` before anything reaches AtroCore. Verified on 2026-09-21 against the reference
instance: 9 `ChecklistQuestion` rows unscoped, 3 (ATS) scoped, `total` recomputed, and
`/inspector/inspector.ejemplo` → `['ATS']` through the proxy.
