# Docker Setup

This project includes a Docker Compose setup for:

1. Frontend (Vue/Vite)
2. Backend auth service (Express)
3. PostgreSQL

## Files Added

1. `docker-compose.yml`
2. `Dockerfile.frontend`
3. `Dockerfile.backend`
4. `docker/nginx/default.conf`
5. `.env.docker.example`

## Prerequisites

1. Docker Engine
2. Docker Compose plugin (`docker compose`)

## Configure Environment

Create a local env file for Compose:

```bash
cp .env.docker.example .env
```

Update values in `.env` as needed, especially:

1. `ALFRESCO_BASE_URL`
2. `AUTH_TICKET_ENCRYPTION_KEY`

For development with external Alfresco Compose networking:

1. Ensure external Docker network `alfresco_backend` exists
2. Ensure Alfresco proxy container is reachable on that network as `proxy`
3. Keep `ALFRESCO_BASE_URL=http://proxy` (or set the correct proxy URL)

## Run Development Stack

Runs:

1. PostgreSQL
2. Backend auth service on port 4000
3. Frontend Vite dev server on port 3000

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile dev up --build
```

Access:

1. Frontend: http://localhost:3000
2. Backend health: http://localhost:4000/health
3. PostgreSQL: localhost:5432

In dev profile, frontend auth calls use `/api/auth` and are proxied by Vite to backend.

## Run Production-like Stack

Runs:

1. PostgreSQL
2. Backend auth service on port 4000
3. Frontend static build behind nginx on port 8080

```bash
docker compose --profile prod up --build
```

Access:

1. Frontend: http://localhost:8080
2. Backend and PostgreSQL are internal-only (not exposed on host ports)

In prod profile, nginx proxies all `/api/` routes to the backend service.

## Stop and Remove Containers

```bash
docker compose down
```

Remove volume data too:

```bash
docker compose down -v
```

## Notes

1. `AUTH_CHUNK1_SQL_DRAFT.sql` is mounted as init script and runs on first db initialization.
2. `AUTH_COOKIE_SECURE=false` is recommended for local HTTP testing.
3. For real production behind TLS, set `AUTH_COOKIE_SECURE=true`.