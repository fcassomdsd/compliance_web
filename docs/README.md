# Project Documentation by Domain and Development Phase

This directory contains all project documentation that was previously in the repository root, organized by functionality and phase.

## Structure

### Checklist Manager Documentation (Delivery Phase)
Path: `docs/checklist/phase-4-delivery/`

Files:
- `CHECKLIST_DEVELOPER_GUIDE.md`
- `CHECKLIST_IMPLEMENTATION_SUMMARY.md`
- `CHECKLIST_MODULE_DOCS.md`
- `CHECKLIST_QUICK_START.md`
- `DELIVERY_SUMMARY.md`
- `DOCUMENTATION_INDEX.md`
- `PROJECT_DELIVERABLES.txt`
- `START_HERE.md`

Rationale:
- `START_HERE.md` and `DOCUMENTATION_INDEX.md` identify these files as final module handoff and delivery artifacts.

### Authentication Documentation (Contract and Operational Readiness Phases)
Path: `docs/auth/phase-1-contract/`

Files:
- `AUTH_CHUNK1_API_SPEC.md`
- `AUTH_CHUNK1_ROUTE_AUTH_MATRIX.md`

Rationale:
- These are draft/specification documents for early auth design and policy definition.

Path: `docs/auth/phase-8-operational-readiness/`

Files:
- `ALFRESCO_ROLE_SETUP.md`
- `AUTH_CHUNK8_OPERATIONAL_READINESS.md`

Rationale:
- These focus on deployment validation, role mapping setup, and production readiness.

### Shared Operations Documentation
Path: `docs/shared/operations/`

Files:
- `DOCKER_SETUP.md`
- `GITLAB_CI.md`
- `LINTER_RESULTS.md`

Rationale:
- These are cross-cutting infrastructure and quality-operation references that support all phases.

## Related Reference Kept in Place

- `server/README.md` remains in `server/` because it documents that module directly.
- `AUTH_CHUNK1_SQL_DRAFT.sql` remains at repository root because it is a schema artifact, not markdown documentation.
