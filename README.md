# Compliance Web

![Status](https://img.shields.io/badge/status-active%20development-brightgreen)
![Stack](https://img.shields.io/badge/stack-vue%20%7C%20express%20%7C%20postgresql-blue)
![Tests](https://img.shields.io/badge/tests-vitest-informational)

Compliance Web is an open-source web application for inspection and compliance workflows. It combines checklist management, findings/corrective-action processes, and role-based access with server-side session authentication.

This repository is intended for both adopters evaluating the platform and contributors extending the codebase.

## Why This Project

- Turn inspection processes into traceable, repeatable workflows.
- Manage checklist selections by specialty and topic.
- Support role-aware operations for inspectors, planners, and related users.
- Keep auth/session control on the server with PostgreSQL-backed persistence.

## Feature Highlights

- **Inspection status state machine** — linear lifecycle from `Created` through `Reported` with `Complete` (external) and `Inactive` (soft-delete) states. Status governs available actions (editing, service assignment, inspector assignment, checklist processing, plan/report generation). Backward transitions supported for plan regeneration and inspector reassignment.
- Checklist manager with grouped questions and persisted selections.
- Role-aware route and API authorization model.
- Auth endpoints for login, session bootstrap, logout, and diagnostics.
- Session policy controls: idle timeout, absolute timeout, refresh cadence, and rotation.
- PostgreSQL-backed login rate limiting and auth audit logging with graceful fallback.
- ZIP bomb protection and upload size limits on import endpoints.
- Test coverage spanning frontend units, router/store auth paths, and server auth behavior.

### Inspection Status States

| Status | Meaning | Available Actions |
|---|---|---|
| `Created` | Basic values saved (location, dates, objective, scope, inspectors) | Edit basics, assign services/schedules |
| `Defined` | Services and schedules configured | Assign inspectors |
| `Assigned` | Inspectors assigned | Process checklists, generate plan, reassign inspectors |
| `Planned` | Inspection plan generated | Upload checklists, regenerate plan, reassign (reverts to Assigned) |
| `Uploaded` | Checklist data uploaded | Generate report |
| `Reported` | Report generated | Regenerate report |
| `Complete` | All operations confirmed (external) | Read-only |
| `Inactive` | Soft-deleted, no longer operational | Read-only; permanent delete only for inactive inspections |

## Project Status

- Stack: Vue + Vite frontend with Node/Express auth backend.
- Auth/session state: server-side sessions persisted in PostgreSQL.
- Identity integration: Alfresco-backed login and group-to-role mapping.
- Documentation model: organized by domain and development phase under [docs/README.md](docs/README.md).

## Architecture at a Glance

- Frontend: Vue 3, Pinia, Vue Router, Axios.
- Backend: Express auth service with cookie-based sessions.
- Data/auth integration: PostgreSQL + Alfresco.

Core paths:
- [src](src): frontend modules (components, stores, router, services, views).
- [server](server): auth/session backend and supporting domain routes.
- [tests](tests): unit, e2e, and server tests.
- [docs](docs): phase-based project documentation.

## Tech Stack

- Runtime: Node.js
- Frontend: Vue 3, Vite, Pinia, Vue Router
- Backend: Express, pg, cookie-parser
- Testing: Vitest, Vue Test Utils, Supertest
- Linting: ESLint

## Getting Started

### Local Development

1. Install dependencies.

```bash
npm install
```

2. Start the frontend in one terminal.

```bash
npm run dev
```

3. Start the auth backend in another terminal.

```bash
npm run server
```

4. Open the app.

```text
http://localhost:5173
```

### Docker Option

Use the Docker setup guide at [docs/shared/operations/DOCKER_SETUP.md](docs/shared/operations/DOCKER_SETUP.md).

## Environment Configuration

Prerequisites:

- Node.js 20+
- npm
- PostgreSQL
- Reachable Alfresco endpoint

Required auth environment variables:

- `DATABASE_URL`
- `ALFRESCO_BASE_URL`

Common optional auth settings:

- `AUTH_SERVER_PORT` (default `4000`)
- `AUTH_COOKIE_NAME` (default `compliance_session_id`)
- `AUTH_IDLE_TIMEOUT_SECONDS`
- `AUTH_ABSOLUTE_TIMEOUT_SECONDS`
- `AUTH_ROLE_REFRESH_INTERVAL_SECONDS`
- `AUTH_TICKET_ENCRYPTION_KEY` (required in production — server refuses to start without it)
- `AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS`

Notification settings (see `NOTIFICATIONS_SQL.sql` for the schema):

- `SMTP_HOST` — if unset, email notifications queue as `pending` and fail on every retry attempt until configured; in-app notifications are unaffected.
- `SMTP_PORT` (default `587`), `SMTP_SECURE` (default `false`), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (default `noreply@compliance.local`)
- `NOTIFICATION_SEND_INTERVAL_MS` (default `60000`) — how often the retry sweep runs
- `CASE_ESCALATION_EMAIL` — fixed distribution-list address for case-escalation notifications (finding overdue job)
- `INSPECTOR_NOTIFICATIONS_EMAIL` — fixed distribution list for events an inspector/reviewer needs to act on: CAP submitted, follow-up evidence needs review, evidence marked inadequate, finding pending post-upload review (daily digest), finding closure pending approval, finding closure rejected, deadline extension requested
- `CAP_ENTRY_NOTIFICATIONS_EMAIL` — fixed distribution list for events the CAP submitter side needs to know about: CAP reviewed, deadline extension reviewed, finding closed

All notification env vars are optional — each notification type is skipped (not queued) if its target env var isn't set, rather than failing.

Auth backend details: [server/README.md](server/README.md)

## Available Scripts

- `npm run dev`: start frontend development server.
- `npm run server`: start auth backend service.
- `npm run build`: build frontend for production.
- `npm run preview`: preview the built frontend.
- `npm run lint`: run ESLint and produce JSON report output.
- `npm run lint:fix`: run ESLint with auto-fix.
- `npm run test`: run Vitest.
- `npm run test:server`: run server tests.
- `npm run test:e2e`: run e2e-oriented tests.
- `npm run test:auth:all`: run consolidated auth-related tests.
- `npm run load:auth:probe`: run auth/session load probe.

## Authentication and Authorization

Auth endpoints exposed by the backend:

- `POST /api/auth/login`
- `GET /api/auth/session`
- `POST /api/auth/logout` (CSRF-protected, validates token before clearing cookie)
- `GET /api/auth/diagnostics`
- `GET /api/findings` / `GET /api/findings/:id`
- `POST /api/findings/:id/follow-ups`
- `GET /api/caps` / `GET /api/caps/:id` / `PATCH /api/caps/:id/review`
- `POST /api/findings/:id/caps`

Auth documentation:

- Contract and policy docs: [docs/auth/phase-1-contract](docs/auth/phase-1-contract)
- Readiness and role-setup docs: [docs/auth/phase-8-operational-readiness](docs/auth/phase-8-operational-readiness)

## Testing and Quality

Recommended baseline before opening a pull request:

```bash
npm run lint
npm run test:server
npm run test:e2e
npm run test:auth:all
npm run build
```

Operational references:

- [docs/shared/operations/GITLAB_CI.md](docs/shared/operations/GITLAB_CI.md)
- [docs/shared/operations/LINTER_RESULTS.md](docs/shared/operations/LINTER_RESULTS.md)

## Documentation Map

Start at [docs/README.md](docs/README.md).

Direct entry points:

- Checklist delivery docs: [docs/checklist/phase-4-delivery/DOCUMENTATION_INDEX.md](docs/checklist/phase-4-delivery/DOCUMENTATION_INDEX.md)
- Authentication contract docs: [docs/auth/phase-1-contract](docs/auth/phase-1-contract)
- Authentication operational readiness docs: [docs/auth/phase-8-operational-readiness](docs/auth/phase-8-operational-readiness)
- Shared operations docs: [docs/shared/operations](docs/shared/operations)

## Repository Structure

```text
compliance_web/
├── src/            # Vue frontend
├── server/         # Auth/session backend
├── tests/          # Unit, e2e, and server tests
├── docs/           # Domain- and phase-organized documentation
├── docker/         # Docker and nginx configuration
└── scripts/        # Utility and load-probe scripts
```

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for branching, commit conventions, testing expectations, and merge request checklist requirements.

Community participation is guided by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Roadmap

- Harden authentication operational readiness and observability.
- Expand role-based workflow coverage across findings and CAP operations.
- Improve e2e coverage for core user flows.
- Continue documentation consolidation and developer onboarding improvements.

## Support

- Use project issues for bug reports and feature requests.
- Include reproduction steps, expected behavior, and environment details in reports.
- For authentication-related topics, attach relevant logs and reference [docs/auth/phase-8-operational-readiness](docs/auth/phase-8-operational-readiness).

## Troubleshooting

- Auth/session issues:
  - Verify `DATABASE_URL` and initialize schema from [AUTH_CHUNK1_SQL_DRAFT.sql](AUTH_CHUNK1_SQL_DRAFT.sql).
  - Verify provider connectivity using `ALFRESCO_BASE_URL`.
  - Check [server/README.md](server/README.md) and auth readiness docs.
- Frontend cannot reach auth routes:
  - Confirm backend process is running on expected port.
  - Confirm frontend proxy/config matches your environment.
- CI/lint differences:
  - Run `npm run lint` locally and compare with [docs/shared/operations/GITLAB_CI.md](docs/shared/operations/GITLAB_CI.md).

## Security

Do not commit secrets or production credentials. Use environment variables for sensitive values, especially auth and encryption settings.

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE).
Additional attribution and legal notice details are available in [NOTICE](NOTICE).

Copyright (c) 2026 Fernando A. Casso Rodriguez.
