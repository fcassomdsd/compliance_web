# Specialty scope enforcement

A session may carry a **specialty scope**: the specialties its user is allowed to see and act on,
derived from their `Inspector` record. This document is the map of where that scope is enforced and
what each layer is responsible for. The session field itself (how it is resolved, refreshed and
returned) is specified in [`AUTH_CHUNK1_API_SPEC.md`](AUTH_CHUNK1_API_SPEC.md) §4.1–4.2.

## The rule

| Session scope | Meaning |
|---|---|
| `specialtyScope: null` | **Unscoped** — full access. An `admin`, a user with no `Inspector` record, or an inspector with no specialties linked. |
| `specialtyScope: ["ATS", "NAV"]` | The session may only see and act on those specialties. |

Two views of the same set travel on the session, because the platform uses both:

| Field | Shape | Used by |
|---|---|---|
| `specialtyScope` | codes (`ATS`, `NAV`) | findings, CAPs, follow-ups and document ids (`H-…-EEE-###`) |
| `specialtyScopeIds` | AtroCore link ids (`spec_ats`, `spec_nav`) | AtroCore relations (`Inspection.inspectedSpecialties`, `ChecklistQuestion.specialty`) |

A record that carries **no** specialty is not attributable to one, so it is not restricted. That
applies to whole entities (locations, providers, contacts, regulations are shared across
specialties) and to individual records (an `Inspection` whose `inspectedSpecialties` is empty).

Unmatched users must never be locked out: a failed scope lookup at login starts the session
unscoped, and a failed lookup during the 15-minute refresh keeps the previously cached scope rather
than widening it.

## Where it is enforced

### 1. Node-RED proxy — `server/nodered/router.cjs`

The browser reaches the gateway through the app server (`/nodered/*`), never directly. Every call
already requires a session; with a scope it is also checked:

- **Writes** (`addEntity`, `updateEntity`, `deleteEntity`, `addLinksEntity`, `deleteLinksEntity`):
  `server/nodered/scopeGuard.cjs` reads the specialty from the payload, and for a delete, a
  status-only update or a link write from the stored record — following
  `Inspection.inspectedSpecialties → InspectedSpecialty.specialtyId` when the entity only holds link
  ids. A link write is attributed to the record it hangs off, which is the record that carries the
  specialty. Outside the scope → 403 `AUTH_SCOPE_FORBIDDEN`; record unreadable → 403
  `AUTH_SCOPE_UNVERIFIED` (a write that cannot be attributed is not assumed in scope).
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

### 3. UI — `useAuthStore`

The UI is the *offer* side, not the boundary: it must not propose an action the server will refuse.
`specialtyInScope(code)` / `specialtyIdInScope(id)` (null scope = everything) gate the specialty
pickers — inspection cadence, assign-inspectors and the checklist manager's specialty selector.
The lists themselves are filtered by the proxy's read filter, so no view needs its own copy of that
rule.

## What is deliberately not covered

- **`getLinksEntity`** (a read of one record's relations) is not filtered; the record it hangs off
  is checked on the write path, and the relations themselves are what the caller already may read
  through `queryEntity`.
- **`/api/auth/ticket`** still returns the Alfresco ticket to the browser, although the proxy no
  longer needs it (it uses the session's own). Removing it is a contract change for other clients
  and is tracked separately.

## Testing

Unit and route tests live next to the code they cover:

| Area | Test |
|---|---|
| scope resolution, refresh, unscoped cases | `tests/server/authSpecialtyScope.test.js` |
| gateway proxy: auth, key/ticket injection, write guard, link writes, plan/report actions, read filter | `tests/server/nodeRedProxy.test.js` |
| API narrowing: lists, id-addressed refusals, CAP drafts | `tests/server/scopeEnforcement.test.js` |
| store and picker gating | `tests/unit/...`, `tests/server/...` (see `npm run test:auth:all`) |

`npm run test:auth:all` runs the full pre-merge gate for anything touching auth, roles or scope.

`scripts/verify-specialty-scope-e2e.sh` boots the **real** server process against a throwaway
PostgreSQL and a stub of the two upstreams (their credentials are not in this repository) and drives
it over HTTP: an unauthenticated gateway call is refused, login resolves the scope, a scoped
`queryEntity` read drops the out-of-scope row, the gateway is shown to receive the API key and the
session's ticket and never the session cookie, and an out-of-scope write is refused. The unit tests
call `createApp` directly, so this is what covers the wiring in `server/index.cjs` and the real
session store. It needs Docker.
