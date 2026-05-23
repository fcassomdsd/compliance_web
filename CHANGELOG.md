# Changelog

All notable changes to this project will be documented in this file.

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
