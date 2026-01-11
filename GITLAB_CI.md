# GitLab CI/CD Pipeline Configuration

This document describes the GitLab CI/CD pipeline configuration for the Aviation Safety Compliance System web frontend.

## Overview

The pipeline is triggered automatically on merge requests and runs on the `main` and `develop` branches. It performs three main stages:

1. **Lint** - Code quality checks using ESLint
2. **Test** - Unit tests with coverage reporting
3. **Build** - Project build verification

## Pipeline Stages

### 1. Lint Stage (`lint:eslint`)

- **Purpose**: Checks code quality and style compliance
- **Image**: `node:20-alpine`
- **Script**:
  - Installs dependencies via npm
  - Runs ESLint on all `.js`, `.vue`, and `.json` files
  - Generates a JSON report for GitLab integration
  
- **Artifacts**:
  - `eslint-report.json` - Code quality report (expires in 1 week)
  - Can be viewed in GitLab MR widget

- **Allow Failure**: Yes (warnings won't block the pipeline)

### 2. Test Stage (`test:unit`)

- **Purpose**: Runs unit tests and generates coverage metrics
- **Image**: `node:20-alpine`
- **Script**:
  - Installs dependencies via npm
  - Runs vitest with `--run` flag and coverage collection
  
- **Coverage**:
  - Generates Cobertura format report for GitLab integration
  - Generates JUnit format report for test results
  - Coverage percentage is extracted and displayed in MR
  
- **Artifacts**:
  - `coverage/` directory with full coverage reports
  - Coverage reports expire in 30 days

- **Coverage Regex**: Extracts overall line coverage percentage

### 3. Build Stage (`build`)

- **Purpose**: Verifies the project can be built successfully
- **Image**: `node:20-alpine`
- **Script**:
  - Installs dependencies via npm
  - Runs `npm run build` to generate production artifacts
  
- **Artifacts**:
  - `dist/` directory with built application (expires in 1 week)

### 4. MR Approval Check (`mr_approval`)

- **Purpose**: Final validation that all checks passed
- **Dependencies**: Requires all previous stages to succeed
- **Runs On**: Merge requests only

## Configuration

### Variables

- `npm_config_cache`: Cache directory for npm packages (`.npm/`)
- `CACHE_COMPRESSION_LEVEL`: Set to "fastest" for better performance

### Caching

- Caches `node_modules/` and `.npm/` directories to speed up subsequent runs
- Cache is shared across all jobs in the pipeline

## Running Locally

To simulate the pipeline locally before pushing:

```bash
# Run linting
npm run lint

# Run tests with coverage
npm run test -- --run --coverage

# Build the project
npm run build
```

## NPM Scripts

Added scripts for CI/CD integration:

```bash
npm run lint          # Run ESLint and generate JSON report
npm run lint:fix      # Run ESLint with auto-fix
npm run test          # Run tests in watch mode (development)
npm run test:ui       # Run tests with UI dashboard
```

## Merge Request Checks

When you create a merge request, GitLab will:

1. **Automatically trigger** the pipeline
2. **Display** linting issues in the MR widget
3. **Show** test results and coverage metrics
4. **Block merging** if any tests fail
5. **Warn** if coverage decreases

### MR Widget Integration

- **Code Quality**: Shows ESLint violations
- **Test Results**: Shows test pass/fail status
- **Coverage**: Shows line coverage percentage and changes

## Troubleshooting

### Pipeline Failures

1. **Lint Failures**
   - Check the `eslint-report.json` artifact
   - Run `npm run lint:fix` locally to auto-fix issues
   - Some issues require manual fixes

2. **Test Failures**
   - Download coverage reports from pipeline artifacts
   - Run `npm run test` locally to reproduce
   - Check test output in the pipeline logs

3. **Build Failures**
   - Check pipeline logs for specific error
   - Run `npm run build` locally
   - Ensure all dependencies are installed with `npm ci`

### Cache Issues

If the cache becomes corrupted:

1. Go to **CI/CD > Pipelines**
2. Click the three dots on a pipeline
3. Select **Clear Runner Caches**
4. Re-run the pipeline

## Best Practices

1. **Always run locally first**: Use `npm run lint`, `npm run test -- --run`, and `npm run build` before pushing
2. **Keep dependencies up to date**: Regularly update npm packages
3. **Maintain test coverage**: Aim for >80% code coverage
4. **Write descriptive commit messages**: Helps with tracing issues
5. **Review MR comments**: Address all CI/CD findings before merge

## Future Enhancements

Potential improvements to the pipeline:

1. **Security scanning** - SAST (Static Application Security Testing)
2. **Dependency checking** - Vulnerability scanning with Snyk
3. **Performance testing** - Build size and load time metrics
4. **E2E testing** - End-to-end tests with Playwright/Cypress
5. **Automated deployment** - Deploy to staging/production environments
6. **Dependency analysis** - Track outdated packages

## References

- [GitLab CI/CD Documentation](https://docs.gitlab.com/ee/ci/)
- [ESLint Documentation](https://eslint.org/)
- [Vitest Documentation](https://vitest.dev/)
- [Vite Documentation](https://vitejs.dev/)
