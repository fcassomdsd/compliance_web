# Contributing Guide

Thank you for considering contributing to Compliance Web.

Contributions of all sizes are welcome, including documentation updates, bug fixes, refactors, and new features.

## Before You Start

- Read the project documentation at [docs/README.md](docs/README.md).
- Review auth-specific guidance if your change touches authentication:
  - [docs/auth/phase-1-contract](docs/auth/phase-1-contract)
  - [docs/auth/phase-8-operational-readiness](docs/auth/phase-8-operational-readiness)
- Read and follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for all project interactions.

## Branch Workflow

This project uses a main/develop model:

- `main`: stable, production-ready branch.
- `develop`: active integration branch. Merge requests should target this branch unless maintainers specify otherwise.
- `feature/*`: new features. Example: `feature/add-logging-module`.
- `fix/*`: bug fixes. Example: `fix/ui-freeze`.
- `hotfix/*`: urgent fixes for production issues.

Example workflow:

```bash
git checkout develop
git pull

git checkout -b feature/awesome-improvement
# make changes
git add .
git commit -m "feat: add awesome improvement"
git push origin feature/awesome-improvement
```

Then open a merge request targeting `develop`.

## Code Style and Tooling

Consistency keeps reviews fast and safe.

- Linting is required: run `npm run lint`.
- Auto-fix lint issues when possible: run `npm run lint:fix`.
- Keep diffs focused and avoid unrelated reformatting.
- Follow existing patterns in [src](src), [server](server), and [tests](tests).

## Commit Convention

Use Conventional Commits.

Accepted types and examples:

- `feat:` new features. Example: `feat: introduce dynamic checklist loading`
- `fix:` bug fixes. Example: `fix: correct schema validation error`
- `chore:` maintenance or tooling. Example: `chore: update dependencies`
- `docs:` documentation-only updates. Example: `docs: clarify setup section`
- `test:` new or updated tests. Example: `test: add unit test for auth store`
- `refactor:` internal code improvements without behavior changes. Example: `refactor: simplify store initialization`

Write clear commit messages.

Good: `fix: handle null response in diagnostics route`
Poor: `update stuff`

## Testing Expectations

Run relevant tests locally before opening a merge request.

Minimum recommended baseline:

```bash
npm run lint
npm run test:server
npm run test:e2e
npm run test:auth:all
npm run build
```

If your change is limited in scope, include exactly what you ran in the MR description.

## Merge Request Checklist

Include the following in your merge request:

- Summary: what changed and why.
- Type: feat, fix, docs, refactor, chore, or test.
- Testing: commands run and results.
- Scope: affected modules, APIs, and docs.

Checklist:

- [ ] My code follows project style and linting rules.
- [ ] I performed a self-review before requesting review.
- [ ] I updated or added documentation where needed.
- [ ] Relevant tests pass locally.
- [ ] Commit messages follow Conventional Commits.

## Documentation Changes

If behavior changes, update related docs in [docs](docs) and any user-facing guidance in [README.md](README.md).

## Security and Secrets

- Never commit secrets, tokens, credentials, or private keys.
- Use environment variables for sensitive settings.
- For auth/session changes, call out security impact explicitly in your MR.

## Questions and Proposals

For large changes, open an issue first to align on scope and approach before implementation.
