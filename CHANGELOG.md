# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **The session now carries a `specialtyScope`: the specialty codes its user may see and act on, derived from their `Inspector` record.** `Inspector.specialty` is already the single source of truth for who does what (each inspector's linked specialties, managed in AtroCore), and the app already fetches the inspector profile at login, so nothing is duplicated onto the assignment groups — a second copy there would only be a sync hazard. `GET /api/auth/login` and `GET /api/auth/session` now return `specialtyScope` (an array of codes, or `null` for unscoped), resolved through Node-RED's existing `GET /inspector/:externalId` and cached in `auth_session.metadata_json` (`groups` is already stored there), so no schema change was needed. `null` means full access and covers an `admin`, a user with no inspector record, and an inspector with no specialties linked — unmatched users are never locked out. It refreshes with the 15-minute role cache; if that lookup fails, the previously cached scope is kept rather than silently widened, while a login-time failure starts the session unscoped. The specialty *ids* are stored beside the codes (`specialtyScopeIds`), because AtroCore relations are keyed by id while findings, CAPs and document ids use codes. Scope-filtered API responses and the UI gating follow in later changes.

- **The browser no longer talks to Node-RED directly: `/nodered` goes through the app server, which requires the session, attaches the gateway API key and the session's own Alfresco ticket, and refuses writes outside the session's specialty scope.** nginx used to forward `location /nodered/` straight to the gateway, so every Node-RED route was reachable by anyone who could load the app — no session, no `X-API-Key`, and whatever `X-Alfresco-Ticket` the client sent was forwarded as-is. nginx now sends that prefix to the app server exactly as it already does for `/api`, the Vite dev proxy does the same, and `server/nodered/router.cjs` forwards each request on with `X-API-Key` from `NODE_RED_API_KEY` and the ticket decrypted from the session — the client's ticket is ignored, and the session cookie is never forwarded. Reads pass through untouched (the prefix is stripped, so Node-RED still sees `/queryEntity?entity=Location`). Writes (`addEntity`/`updateEntity`/`deleteEntity`) that touch a specialty-attributable entity are checked first by `server/nodered/scopeGuard.cjs`: it reads the specialty out of the payload, and for a delete or a status-only update out of the stored record — following `Inspection.inspectedSpecialties → InspectedSpecialty.specialtyId` when the entity itself only holds link ids — then answers 403 `AUTH_SCOPE_FORBIDDEN` when it falls outside the session's scope, or 403 `AUTH_SCOPE_UNVERIFIED` when the record cannot be read (a write that cannot be attributed is not assumed in-scope). Unscoped sessions (an `admin`, a user with no inspector record, an inspector with none linked) are untouched, and entities shared across specialties — locations, providers, contacts, regulations — are deliberately not scope-controlled. 10 new tests drive the proxy against a real local HTTP stand-in for the gateway, covering the unauthenticated case, key/ticket injection, error pass-through, in-scope and out-of-scope writes, the relation read-back, and the unscoped session.

- **The gateway proxy filters Node-RED *reads* too, not just writes.** The read path was the last way a scoped session could still see another specialty's records: the UI lists inspections, checklist questions and cadences through `POST /nodered/queryEntity`, which the proxy passed through untouched. For the entities that carry a specialty the proxy now forces the identifying fields into the upstream `select` — a caller asking for `select=id` cannot hide the data the filter needs — drops the rows whose specialty is outside the session's scope, and recomputes `total` so the count agrees with the list it is returned with. A record that carries no specialty at all is kept, matching the rule everywhere else: not attributable to a specialty means not scope-controlled. Unscoped sessions are untouched. 3 more proxy tests cover the row filtering, the forced select and the unscoped session.

- **The UI only offers the specialties a session may act on.** The session response now carries `specialtyScopeIds` beside the codes — the views key inspected specialties by AtroCore link id (`spec_ats`), while findings, CAPs and document ids use codes — and `useAuthStore` exposes both with `specialtyInScope(code)` / `specialtyIdInScope(id)` getters that treat a null/empty scope as full access. The three views that build a specialty picker filter it: the inspection-cadence form (a cadence for a specialty outside the scope is one the server would refuse to create), the assign-inspectors table (only the inspection's in-scope specialties are assignable), and the checklist manager's specialty selector. This is offer-side gating, not the enforcement itself — the Node-RED proxy and the `/api` filters remain the boundary; what is left on the UI side is dropping out-of-scope records from the *lists*, which is a read-filtering gap on the gateway, not a per-view one (tracked for the next change).

- **Findings, corrective actions, CAP drafts and the oversight reports are narrowed to the session's specialty scope.** `server/auth/scopeEnforcement.cjs` gates the app's own `/api` surface, the counterpart to the Node-RED write guard: list endpoints (`GET /api/findings`, `GET /api/findings/follow-ups`, `GET /api/caps`, `GET /api/caps/drafts`) drop rows whose `specialtyCode` is outside the session's scope, and endpoints addressed by a document id — every `/:findingId/...` and `/:capId/...` route — are refused with 403 `AUTH_SCOPE_FORBIDDEN` before any Alfresco call, including `/caps/drafts/:draftId` (whose specialty comes from the draft's stored finding). The document ids already embed the specialty (`H-…-EEE-###`, `P-…-EEE###-##`, `S-…-EEE###-##`, `LV-…-EEE`), so no extra lookup is needed, and an explicit `?specialtyCode=` outside the scope is refused rather than answered with an empty page — a scoped user must not read "no findings" as "none exist". The oversight-posture report and its filter options are computed from scoped findings and CAPs only, and the USOAP CE-evidence report pushes the session's codes upstream through the `specialtyCode` filter its webscript already accepts, so the sampled-population counts stay correct for what the caller may see. Unscoped sessions (admin, no inspector record, no specialties) and records without a specialty are untouched. `/reports/provider-history` is the one endpoint still unfiltered: its summary and by-inspection aggregates are computed inside the CMIS webscript, which takes no specialty filter yet — adding the same `specialtyCode` parameter there is what closes it, and the route carries a note saying so. 11 new tests cover the findings list, an id-addressed refusal, CAP and draft narrowing, the explicit-filter refusal and the unscoped session.

- **`docs/endpoints.md` now covers the pass-through gateway route** (`ALL /nodered/*`). The manifest is derived from the routers in `server/app.cjs`, so the new proxy mount had to be registered in `scripts/verify-endpoints.mjs`; a pass-through router answers every method under its prefix and has no per-route list to derive, so it is rendered as one entry rather than silently omitted.

- **The specialty scope now follows the role the user works under, not the existence of an `Inspector` record.** It was resolved for any non-`admin` session whose Alfresco user had an `Inspector` record with linked specialties, which is a data fact rather than a role: planners and assigners who occasionally run an inspection themselves have such a record, so they were silently narrowed to its specialties while working under a role that should see everything. `isSpecialtyScopedSession` (`server/auth/specialtyScope.cjs`) now decides it — `inspector` present and none of `admin`, `planner`, `assigner`, `reporter`, `cap_entry`, `closure_reviewer` — and for any other session the Inspector record is never looked up at all. The rule is written against the role catalog rather than as "inspector is the only role", so a deployment-local group→role mapping the app gates on nowhere cannot silently switch the scope off. Nothing that *consumes* the scope changed: an unscoped session arrives with a null scope, which the gateway guard, the `/api` filters and the UI pickers already treat as full access. `ChecklistManager`'s ad-hoc copy of the same idea (`hasRole('inspector') && !hasRole(['admin','planner'])`) now uses the store's `isActingAsInspector`.

- **The Node-RED proxy is an allow-list with a role gate per operation.** `/nodered/*` required a session and then forwarded any method and any path to the gateway, so the Vue router was the only thing between an authenticated user and every gateway operation: a `reporter` could create site visits, a `cap_entry` user could delete inspections, and anyone could call the routes the Electron app and the import service use — `/importCanonical` moves inspections `Planned → Uploaded` — simply by issuing the request. It is also why `assigner` was enforced nowhere on the server. `server/nodered/gatewayPolicy.cjs` now classifies every request as a read, an entity write, a link write or an action, and anything it does not classify is refused with 403 `AUTH_GATEWAY_FORBIDDEN` before it reaches the gateway; the order is session → classification → role → specialty scope → forward. Reads stay open to any session (every role reads reference data, and `/inspector/:externalId` is called for every user at login — the read boundary for a scoped session is the specialty filter, not a role). Writes are gated per entity with the role set being the union of the screens that perform them, so `Inspection.update` carries `planner`, `inspector` and `assigner` because three screens do it under three roles; entities the app never writes cannot be written through the proxy at all. Link writes are gated per `Entity.relation` — the only one is `InspectedSpecialty.actingInspectors` → `assigner`, `admin`, which makes `assigner` a server-enforced role for the first time. This is entity-level authorization: "an assigner may set `status=Assigned` and nothing else" is not expressible here and belongs in the flows. 28 new proxy tests.

- **The group → role mappings are in version control.** `0001` seeded the role catalog but no mappings and `0002` added only `closure_reviewer`, so every other role's mapping lived as deployment data and a fresh install had a full catalog that nothing could reach — the demo's `demo.inspector1`, created in `U-VSO-IN_Inspector` by `compliance_cmis/scripts/seed-demo-identities.sh`, authenticated with no roles at all and was refused by every gated route. `migrations/0003_group_role_mappings.sql` seeds the six remaining rows using the group names the reference deployment and the demo scripts actually use (`U-VSO-IN_Admin`, `U-VSO-IN_Inspector`, `U-VSO-PI_PlanInspeccion`, `U-VSO-IN_Assigner`, `U-VSO-FN_CAPEntry`, and `U-VSO-IN_Reporter` for the `reporter` role, which had no group anywhere and was therefore unreachable). These are the adopting authority's names, not a product constant: an authority with its own naming adds or renames rows and nothing else changes, since the lookup is by name, strips a leading `GROUP_` and compares case-insensitively. The migration is additive and re-runnable, with one deliberate exception — it deactivates any mapping for `U-VSO-EL_EspecialistaLider`, a deployment-added group pointing at a `mainInspector` role no code has ever referenced; being main inspector is a per-site-visit attribution (`SiteVisit.mainInspectorId`), which a standing group membership cannot express.

- **The navigation offers only what the session's roles permit, and `/` lands on the first route it may open.** All twelve links rendered unconditionally, so every user saw every destination and a click landed on `/forbidden`; worse, `HomeView` sent anyone without the `inspector` role to `/site-visit`, which requires `planner|admin`, so a bare `reporter`, `cap_entry`, `closure_reviewer` or `assigner` was bounced to `/forbidden` straight from login. Both now derive from one ordered manifest (`src/router/navigation.js`) that reads each route's own `meta.requiredRoles` back off the route record, so the role lists stay in `src/router/index.js` and are never copied, with `/notifications` as the fallback for a session no navigation entry admits. This is the offer side, not a boundary — the route guard and the server gates are unchanged.

### Fixed

- **Every job's log line was failing to reach the audit table — and auth events were losing who they were about.** `PgAuditLogger.info/log` handed their arguments straight to `write()`, whose `({ category, event, details })` destructuring turns a message string into `event: undefined`; the `auth_audit_event.event` column is `NOT NULL`, so `logger.info('Session cleanup sweep completed', { deleted })` — the shape every job in the server uses — failed its insert on every run, printing `null value in column "event"` and leaving nothing behind. The same `write()` ignored a payload's extra top-level keys, and `auditAuthEvent` spreads its details across the top level (`{ category, event, timestamp, username, ip, sessionId }`), so *every* auth event was stored with an empty `details` — the username, IP and session id were dropped. All four methods now normalise their arguments (message + details, payload object, `Error`), `write()` collects the payload's non-reserved keys into `details` and refuses to insert a NULL event. Verified live against the real Alfresco: a login now records `login_success` with `{"userId":"admin","username":"admin","sessionId":"…"}`, the startup jobs record their scheduled events, and the server log has no insert failures. 5 new tests pin the payload shapes.

- **The site visit scheduling job no longer orphans the visits it creates.** Two defects with one root cause: `Inspection` declares no `siteVisit` field (its only path to a visit is `Inspection → InspectedProvider → SiteVisit`), yet the job passed `siteVisitId` when creating one — silently discarded by AtroCore, leaving the freshly created `SiteVisit` with nothing attached — and it reused the cadence's own `InspectedProvider`, a junction row belonging to whichever visit it was created under, so the new `Inspection` resolved to that *older* visit. The job now creates an `InspectedProvider` joining the new visit to the cadence's provider and points the `Inspection` at that. Neither defect had ever fired, because no seed or data pack created a cadence row, so the sweep never ran outside unit tests — and the test that claimed to cover the linkage asserted `siteVisitId` against a schema-less echo double, so it passed on a field the real entity does not have. The double now rejects any field the entity does not declare (with a meta-test so that guard cannot rot), and a regression test seeds a prior visit and junction row to prove the new inspection attaches to the new visit.
- **`InspectionCadence` is now read from `LocationService` instead of the per-visit `InspectedProvider`** (matching the model change in `atrocore-docker`). The cadence picker queried `InspectedProvider`, which only exists after a site visit has been planned — so the dropdown was empty on a fresh install, and a cadence, whose entire purpose is to *cause* the first visit, could not be created until a visit already existed. `refreshPickerOptions` now queries `LocationService`; the cadence carries no `location` of its own (it is derived through the service, which also supplies the provider the job needs). The specialty picker is narrowed to the specialties the chosen service actually covers, read from `LocationServiceSpecialty` because `LocationService.specialty` is declared `noLoad` and so is absent from the entity payload — a cadence for a specialty the service does not provide would describe an inspection that cannot happen. A duplicate check on (service, specialty, activity type) surfaces the new unique index as a readable message rather than a server error.
- **Changing an inspection's activity type no longer fails with "Could not find site visit for activity code generation".** `Inspection` declares no `siteVisit` field — its only path to a visit is `Inspection → InspectedProvider → SiteVisit` — but `inspectionStore` wrote `siteVisitId` when creating one (silently discarded by AtroCore), mapped it back out of the query result, and then fed `current.siteVisitId`, always `undefined`, into `generateActivityCode`. So re-minting the code on a type change threw for every real record. The store now resolves the visit through the inspection's `InspectedProvider` and no longer sends or surfaces a field the entity does not have. The existing test passed only because its `mockInspection` supplied a `siteVisitId` the real API never returns; that mock now reflects the real entity, and a regression test asserts the junction row is what gets queried.

- **`auth_session` rows are now deleted once they are dead.** The table grew monotonically: the migration that creates it shipped the cleanup `DELETE` only as a comment and nothing implemented a sweep, so every login added a row forever (the `auth_session_active` view hid them but the table and its indexes kept growing). `PgSessionRepository.deleteExpiredSessions` now performs that delete — revoked, idle-expired or absolute-expired rows — and a new `sessionCleanupJob` runs it on an interval (`SESSION_CLEANUP_INTERVAL_MS`, default hourly), mirroring the existing notification-send job. 3 new unit tests cover the sweep.
- **AFTS/Lucene value escaping is centralized and now escapes backslashes.** The one-liner `replace(/"/g, '\\"')` was copied into the findings, caps and reports routers and twice into the Alfresco client, and escaped only the double quote — a value ending in `\` could escape the closing quote and malform the predicate. It now lives in `server/domain/aftsEscape.cjs`, escapes backslash before quote, and is imported by all four call sites. 4 new unit tests pin the behaviour.

- **The two remaining gateway write paths are scope-checked: link mutations and the state-changing `/inspectionPlan` / `/inspectionReport` GETs.** `addLinksEntity`/`deleteLinksEntity` are attributed to the record they hang off — the parent is what carries the specialty — and the plan/report actions to the inspections they act on: the provider's inspection at that site visit, or every inspection of the visit when the call names no provider, resolved through `SiteVisit.inspectedProviders → Inspection.inspectedSpecialties`. Any inspection outside the scope refuses the action with the same 403 `AUTH_SCOPE_FORBIDDEN`; when the record cannot be read, `AUTH_SCOPE_UNVERIFIED`. 4 more proxy tests cover the link guard, an out-of-scope plan, an in-scope plan and the no-provider resolution. With this, every gateway path that can change or reveal a specialty-attributable record is covered; `getLinksEntity` reads (the caller may already read those relations through `queryEntity`) and the `/api/auth/ticket` contract are the only deliberate exceptions, both recorded in `docs/auth/SPECIALTY_SCOPE_ENFORCEMENT.md`.

- **The bootstrap path is verified end to end, not just through `createApp`.** The new `scripts/verify-specialty-scope-e2e.sh` boots the real server process against a throwaway PostgreSQL and stubbed upstreams and drives it over HTTP: an unauthenticated `/nodered` call is refused (401), login resolves the session's scope and ids from the Inspector record, a scoped `queryEntity` read drops the out-of-scope row and fixes `total`, the gateway is shown to receive `X-API-Key` and the session's own ticket and never the session cookie, and an out-of-scope write is refused while an in-scope one goes through — 5/5. The unit tests call `createApp` directly, so nothing before this covered the wiring in `server/index.cjs` (the `nodeRed` config, the mount) or the real session store. Needs Docker; Alfresco and Node-RED stay stubbed there. **Live-verified separately against the running stack** (Vite dev server → app server → the real Node-RED → the real AtroCore/Alfresco, with a throwaway PostgreSQL for the session store): the real admin login was accepted, an unscoped session read all 9 real `ChecklistQuestion` rows (3 × ATS/NAV/MET), the same session scoped to ATS read exactly its 3 rows with `total` recomputed to 3, an out-of-scope `addEntity` was refused with `AUTH_SCOPE_FORBIDDEN` before touching AtroCore, the gateway's `/inspector/inspector.ejemplo` returned `['ATS']` through the proxy — the lookup the login resolves the scope with — and a real gateway call (`/serviceAreas`) still worked. The one live write the check issued before it was scoped was deleted again; the instance's data was left as found.

- **Link writes reached the gateway with no specialty check at all.** The proxy matched write routes with `/^\/([A-Za-z]+)Entity/`, but the link routes are `/addLinks` and `/deleteLinks` — no `Entity` suffix, both in `compliance_flow`'s flows and in `src/services/apiServices.js`. The `addLinks`/`deleteLinks` rules were therefore dead code and inspector assignment (`InspectedSpecialty.actingInspectors`) was forwarded unguarded, contrary to what `SPECIALTY_SCOPE_ENFORCEMENT.md` claimed. The gateway allow-list replaces that matching and routes link writes through the same guard.

- **A session rotation forced by a role change persisted the session's pre-refresh metadata**, so a rotated session kept the specialty scope the refresh had just recomputed — and the `/session` response left `specialtyScopeIds` out of its hydrated metadata, returning a stale id list alongside a fresh code list. Both now build from one `nextMetadata` object.

- **`docker-compose.dev.yml` no longer sets `VITE_NODE_RED_PROXY_TARGET`.** Vite proxies `/nodered` to the app server now, not to node-red, so the override and its `frontend-dev` service are gone; the comment on the `backend` override explains why the backend has to stay on the `alfresco_backend` network — it is what reaches node-red.

- **Role-addressed notifications reach the people who hold the role, and the notification centre is no longer empty.** `notifyRoleInbox` sent to a fixed address per role (`INSPECTOR_NOTIFICATIONS_EMAIL` and friends) on the reasoning recorded in `findingOverdueJob.cjs` — "no email addresses exist anywhere in this data model" — which is true of the domain model but not of Alfresco, where the users live. `server/notifications/roleRecipients.cjs` now resolves a role the way the login path already maps groups to roles, only in reverse: role → the active rows of `alfresco_group_role_map` → each Alfresco group's `PERSON` members → each person's username and email. Every holder gets an email *and* an `in_app` row addressed to their username — which matters because `channel: 'email'` was the only notification ever created, so `GET /api/notifications`, the header bell and `NotificationCenter.vue` were wired end to end and always showed nothing. The lookup is cached per role for 15 minutes (`ROLE_RECIPIENT_CACHE_MS`), renews an expired service ticket once, skips disabled accounts, de-duplicates a user who holds the role through two groups, and never throws: a failure returns an empty list and the caller falls back to the fixed address, so an overdue-finding escalation is not lost because Alfresco was unreachable. It needs the `ALFRESCO_JOB_USERNAME`/`ALFRESCO_JOB_PASSWORD` service account — the user who triggered the event has no business reading group membership, and a job has no user at all — and logs a warning at startup when it is not configured. `CASE_ESCALATION_EMAIL` keeps no role behind it deliberately: the BPMN routes a missed deadline to "Solución de Casos de Seguridad", a safety-case team that is not one of this application's roles. 14 new tests; `ALFRESCO_JOB_*` and the four notification addresses are documented in `.env.docker.example` for the first time.

- **Gateway writes are gated per field where a role reaches an entity it does not own.** The allow-list said who may write an `Inspection`; it could not say what they may change, so an assigner — whose one job is moving an inspection to `Assigned` — could rewrite its objective, or set any status, through `updateEntity`. `Inspection.update` is the only gateway write more than one non-admin role performs, so it is the only rule that needs this: an `assigner` may now write `status` and only the value `Assigned`; an `inspector` may write the five report-outcome fields (plus `code`) but **not** `status`, because the `Reported` transition belongs to the `/inspectionReport` action; a `planner` stays unrestricted because it owns the record — `InspectionManager` loads the inspection with `{ ...list[0] }` and saves it back whole, so a field list for the owner would be a list of the table's columns. A session holding two roles gets the union of their field sets, the same way authorization is an any-role match. A payload is refused whole with 403 `AUTH_GATEWAY_FIELD_FORBIDDEN` as soon as one field is out of bounds, before anything reaches the gateway. Every other write keeps a plain role list. 9 new proxy tests and 6 new end-to-end checks.

### Removed

- **The service-area client surface is gone: it was superseded by inspected providers.** A service area scoped *location services* — a location service belongs to a service area, so when a planner or an assigner worked an oversight activity the area decided which location services were offered for selection. Inspected providers replaced that selection path, and the code was left behind: `authStore.canManageServiceArea` had not been called by any view since the commit that introduced it (`bf8dad5 feat: add per-provider inspections and service areas`), `src/stores/serviceAreaStore.js` was imported nowhere, `apiServiceAreas()` was called nowhere, and none of it had a test — while still looking live, and carrying a latent bug (the getter required the `planner` role and so refused an `admin`). All four are removed, along with the `GET /serviceAreas` entry in the gateway allow-list. `inspectorProfile` and `refreshDomainContext` stay: `ChecklistManager` uses the profile's `id` to narrow a checklist to the inspector's own assignments. Node-RED still serves `/serviceAreas` and AtroCore still holds the entity — this removes only this app's unused client for them.

### Documentation

- **`docs/auth/SPECIALTY_SCOPE_ENFORCEMENT.md` is the map of the feature**: the rule (null scope = unscoped, ids vs codes, records with no specialty), every enforcement point (the gateway proxy's write guard and read filter, the `/api` list and document-id filters, the reports, the UI pickers), what is deliberately not covered yet (link mutations, `inspectionPlan`/`inspectionReport`, the `/api/auth/ticket` contract), and which test covers which layer. `AUTH_CHUNK1_API_SPEC.md` §4.2 now documents `specialtyScopeIds` and links to it.

- **`docs/auth/AUTH_CHUNK1_ROUTE_AUTH_MATRIX.md` regenerated from the code.** It had drifted: a `/inspection` route that no longer exists, the wrong roles for `/checklist`, `/inspection-plan` and `/inspection-report`, and frontend routes interleaved with `/api` paths. It is now a frontend table, per-router server tables, and a §5 covering the gateway allow-list — including which frontend routes have no server counterpart because their data path is Node-RED. `docs/auth/ALFRESCO_ROLE_SETUP.md` replaces its `app-*` naming proposal and its paste-a-UUID SQL with the group names the migration seeds and a `role_key`-matching insert for an authority's own names; `docs/endpoints.md` notes that `ALL /nodered/*` is a mount, not a licence to call anything under it.

- **README's development URL corrected to `http://localhost:3000`** (`vite.config.js` serves 3000, not 5173).
- **`CONTRIBUTING.md` and `.gitlab-ci.yml` no longer link to the removed `docs/auth/phase-1-contract` / `phase-8-operational-readiness` directories**; they point at `docs/auth/AUTH_CHUNK1_API_SPEC.md` and `docs/auth/AUTH_CHUNK8_OPERATIONAL_READINESS.md`.
- The `auth_session` cleanup statement in `migrations/0001_initial_schema.sql` is now documented as implemented by the session-cleanup job rather than as a scheduler TODO.

## [2026-09-18]

### Added

- **`THIRD_PARTY_LICENSES.md`, backed by a `license-checker --production` scan (142 packages) plus the Dockerfile base images.** No copyleft dependencies found — 131 MIT, 7 ISC, 2 BSD-3-Clause, 1 BSD-2-Clause, 1 MIT-0.

### Changed

- **`.env.docker.example`'s `NODE_RED_API_KEY` now ships a placeholder value instead of empty.** Previously blank, meaning this backend's own calls to Node-RED went out unauthenticated by default even when nothing else in the deployment was misconfigured. The shipped value (`demo-only-CHANGE-BEFORE-ANY-PUBLIC-DEPLOYMENT`) is a public placeholder committed to the repo and must be rotated, in lockstep with `compliance_flow`'s `API_KEY` and `compliance_import`'s `IMPORT_API_KEY`, before any deployment reachable by anyone untrusted. No code changed — `nodeRedClient.cjs` already read this env var.

### Fixed

- **The web UI no longer reports `unhealthy` on a working demo.** Both frontend healthchecks probed `http://localhost…`, and inside the container `localhost` resolves to `::1` first (busybox `wget` prefers it) while Vite binds only IPv4 — so the dev container failed the probe on every attempt (`FailingStreak` 4110 on the running stack) while the UI answered `200` on its published port, and `docker compose ps` showed `unhealthy` to anyone evaluating the demo. Both now probe `127.0.0.1` (nginx binds the IPv4 address in the prod image too). Verified live: the recreated container reports `Up (healthy)` and the UI still serves `200`; `wget --spider http://localhost:3000` exits 1 inside the container while `http://127.0.0.1:3000` exits 0. Found by the whole-stack demo guard's review of what a newcomer sees first.

- **A rejected closure no longer leaves `vso:findingClosureDate` behind on the reopened finding.** The reject branch of `PATCH /api/findings/:findingId/closure-review` set only `vso:findingStatus: In Progress` and `vso:closureRejectionReason`, so a finding that came back for further work still carried the date on which it had supposedly been formally closed — the property is surfaced by `mapFindingNode`, the provider-history report and the checklist's prior-findings view, so an open finding read as closed. It is cleared now. The date can be present at review time from either side: the standalone `/api/follow-up/import` stamped it at declaration, and an approval whose closure a later follow-up supersedes kept it while `vso:closureRejectionReason` alone was cleared. The reject test now seeds a closure date and asserts the response and the stored node both carry `null`; verified to fail against the previous branch.

### Changed



- **A closure reviewer can now read the finding it is asked to close.** The `closure_reviewer` role was granted only on `PATCH /api/findings/:findingId/closure-review`, while every findings *read* route and the frontend `/findings` guard listed `inspector, planner, cap_entry, admin`. The role could therefore decide a closure but not load the finding — the documented curl recipe worked, and the web UI bounced the reviewer with `403 AUTH_FORBIDDEN` (verified live: login as `closure.reviewer`, `GET /api/findings/H-ZZZZA0001-ATS-001` → 403). The role is now on all five findings GET routes (list, follow-ups, detail, both evidence-content routes) and on the `/findings` route guard; every write route is unchanged, so the role stays read-only except for the closure decision. 3 new tests cover the reads and assert the writes still return `403`; the route-auth matrix and `ALFRESCO_ROLE_SETUP.md` are updated.
- **README and the role setup guide point at the whole-platform demo quickstart, which lives in `atrocore-docker`.** §7 of `atrocore-docker/docs/COMPLIANCE_INTEGRATION_RUNBOOK.md` — executable as `atrocore-docker/scripts/demo-quickstart.sh`, which ends with the closure-review calls this app serves — is the single documented clean-clone-to-demonstrable sequence, so the README's Documentation Map links to it instead of restating it. `docs/auth/ALFRESCO_ROLE_SETUP.md` also now records the repository-access shape the end-to-end run settled on for a writing role: `SiteConsumer` at the site with `Contributor` only on the folders the role writes (`Datos de campo`, `Hallazgos`) — the shape `GROUP_U-VSO-IN_Inspector` holds, narrower than site-wide `SiteCollaborator` and needing no per-user membership.
- **The closure review's own record is now returned by the API.** `mapFindingNode` exposed neither `vso:closureRequestedBy` nor `vso:closureRejectionReason`, so although the review stored why a closure was rejected, the inspector who has to act on it could not see it. Both are mapped now, and `ALFRESCO_ROLE_SETUP.md` records a requirement the end-to-end verification uncovered: **an application role does not grant an Alfresco permission**, so a writing role's group also needs repository access — the reviewer's write failed with `403` from Alfresco (surfacing as `502`) until the account had site membership.
- **Closure review is now a supervising-authority action, and a rejected closure records why.** `PATCH /api/findings/:findingId/closure-review` was authorised to `(inspector, admin)`, so any inspector could approve a closure — including one they had declared themselves. It now requires the new `closure_reviewer` role (admin kept as break-glass), refuses a reviewer who is recorded as the declarer (`403 CLOSURE_REVIEW_SELF`), and refuses to review a finding whose declarer was never recorded (`409 CLOSURE_DECLARER_UNKNOWN`) rather than allowing an unattributable approval. A rejection must now carry a `reason`, which is stored on the finding as `vso:closureRejectionReason` and cleared when a closure is approved. The closure-review panel collects the reason and the reject path already notified inspectors (`closure_rejected`); migration `0002_closure_reviewer_role.sql` adds the role and its `U-VSO-IN_ClosureReviewer` group mapping. 5 new tests cover the new rules; the 5 existing closure-review tests now act as a `closure_reviewer`.
- **Versioning and tagging standardised across the platform.** Releases are tagged `YYYY-MM-DD` (CalVer) after the date of the newest `## [YYYY-MM-DD]` CHANGELOG section, with `YYYY-MM-DD.2` for a second release on the same day. The release jobs now run `scripts/release-tag.sh`, which fails when that section is missing, when `CHANGELOG.md` is unchanged since the previous release, or when the tag already exists; `scripts/release-tag.test.sh` is its self-test. See CONTRIBUTING.md, "Versioning and releases".
- **Documentation reorganised around the current state, and the endpoint manifest is now CI-checked.** Dropped the "phase-N" directory scheme (`docs/auth/phase-1-contract`, `docs/auth/phase-8-operational-readiness`, `docs/checklist/phase-4-delivery`) in favour of `docs/auth/`, `docs/checklist/` and `docs/shared/operations/`; superseded point-in-time artifacts (checklist delivery handoff, the historical lint report) moved to `docs/archive/`; `docs/README.md` rewritten as a current-state index. The stale partial endpoint list in `server/README.md` was replaced by `docs/endpoints.md` — the complete 47-endpoint surface, generated by the new `scripts/verify-endpoints.mjs` and verified by the new `verify:endpoints` CI job so the documented API cannot drift from the routers.

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
