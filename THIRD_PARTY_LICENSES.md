# Third-party licenses

This repository is licensed under Apache License 2.0 for original project code and documentation.

Runtime dependencies and container images used by this project are provided by third parties and remain under their respective licenses and terms.

## Container images

| Image | Upstream project/vendor | License source |
|---|---|---|
| postgres:16-alpine | PostgreSQL Global Development Group | PostgreSQL License |
| node:20-alpine (build stage, both `Dockerfile.backend`/`Dockerfile.frontend`) | Node.js Foundation / Alpine | MIT (Node.js) + Alpine package licenses; not present in the final images below |
| nginx:1.27-alpine (frontend `prod` stage) | F5/NGINX, Inc. | BSD-2-Clause (nginx) + Alpine package licenses |

`compliance-web-backend:local`/`compliance-web-frontend:local` are this repository's own build output (`Dockerfile.backend`/`Dockerfile.frontend`), not third-party images.

## npm dependencies (production, scanned with `license-checker --production`)

142 resolved packages. License breakdown: **131 MIT, 7 ISC, 2 BSD-3-Clause, 1 BSD-2-Clause, 1 MIT-0**, plus this package's own `package.json` (correctly Apache-2.0 per `LICENSE`/`NOTICE`, though not yet declared in the `license` field — worth fixing for tooling hygiene). **No copyleft dependencies found.**

Notable entries worth naming explicitly (everything else is a standard permissive license, not individually listed here):
- `entities@7.0.0` — BSD-2-Clause
- `nodemailer@9.0.6` — MIT-0

Regenerate the full list with: `npx license-checker --production --csv` (or `--summary` for just the counts). Re-run after any `package.json` dependency change.

## How to maintain this file

1. Add new third-party libraries or images when introduced.
2. Record version numbers used in this repository.
3. Link to the canonical license source where possible.
4. Preserve required attribution and notice text when redistributing.

## Important note

This file is an operational tracking document, not legal advice.
For commercial redistribution or productization, perform a legal review of all third-party license obligations.
