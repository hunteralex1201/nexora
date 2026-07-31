# NEXORA Intelligence Operations Guide

**Scope:** Engineering foundation and local validation
**Production status:** Not approved or production-ready
**Last updated:** 2026-08-01

## Operating Boundary

This guide covers the validated local Docker Compose foundation. It does not authorize production deployment, DNS changes, VPS modification, public exposure, paid integrations, live marketplace collection, external messaging, destructive restoration, or autonomous actions.

> The current repository can reproduce the application and local service definitions. It is not yet a production disaster-recovery system, and the Git repository is not a data backup.

## Service Profiles

| Profile | Included services | Operational note |
| --- | --- | --- |
| `core` | PostgreSQL, Redis, MinIO, Qdrant, API, web | Primary local development and smoke-test topology |
| `automation` | n8n | Optional isolated workflow service; no production workflows or credentials are supplied |
| `ai` | Qdrant | Storage foundation only; no local model or native-agent runtime is implemented |
| `monitoring` | Prometheus, Grafana | Use alongside `core` when API request metrics are required |
| `full` | Every defined service | Integration topology; still bound to loopback and not a production deployment |

## First-Time Preparation

On Linux or macOS with Bash:

```bash
./scripts/bootstrap.sh
```

On Windows PowerShell:

```powershell
.\scripts\bootstrap.ps1
```

The bootstrap command checks tool versions, preserves an existing `.env`, creates `.env` from `.env.example` only when needed, and installs locked JavaScript and Python dependencies. It never starts services.

Before running Compose, replace all `CHANGE_ME` values in `.env`. Use unique values for PostgreSQL, Redis, MinIO, the API token secret, n8n encryption, n8n basic authentication, and Grafana. Keep `.env` outside Git and restrict its filesystem permissions.

## Start and Verify the Core Stack

Start the current foundation:

```bash
docker compose --profile core up --build -d
```

Inspect container state and recent logs:

```bash
docker compose --profile core ps
docker compose --profile core logs --tail=100 api web postgres redis
```

The API starts only after PostgreSQL and Redis are healthy, applies Alembic migrations, and then serves requests. The web application starts only after the API health check passes.

| Check | Command | Expected result |
| --- | --- | --- |
| API liveness | `curl -fsS http://127.0.0.1:8000/api/v1/health` | HTTP 200 and an application status payload |
| Dependency readiness | `curl -fsS http://127.0.0.1:8000/api/v1/ready` | HTTP 200 when PostgreSQL and Redis are healthy; HTTP 503 when a required dependency is unavailable |
| Metrics | `curl -fsS http://127.0.0.1:8000/metrics` | Prometheus text exposition |
| Web landing page | Open `http://127.0.0.1:3000` | Foundation landing page |
| Protected route | Open `http://127.0.0.1:3000/overview` without a session | Redirect to `/login` |

Responses include request-tracing headers. Error responses use a structured envelope and must not expose secrets or dependency credentials.

## Create the Initial Administrator

Create an administrator interactively inside the API container:

```bash
docker compose --profile core exec api \
  python scripts/create_admin.py --email admin@example.com
```

The command prompts for a password without displaying it. It refuses an existing email and creates the reusable `admin` role when absent. Avoid `NEXORA_BOOTSTRAP_PASSWORD` in interactive shell history; that variable exists for controlled ephemeral automation only.

After creation, sign in at `http://127.0.0.1:3000/login`. The web server exchanges credentials with the API and stores the access token in an HTTP-only session cookie rather than browser-readable storage.

## Monitoring Profile

Start monitoring alongside the application foundation:

```bash
docker compose --profile core --profile monitoring up -d
```

Prometheus is available at `http://127.0.0.1:9090`, and Grafana is available at `http://127.0.0.1:3001`. Grafana provisions the repository-managed Prometheus data source and foundation dashboard. Replace the Grafana administrator password before starting the service.

The current dashboard uses only real availability and API request metrics. It does not display fabricated commerce data or claim production alerting coverage.

## Optional Automation Profile

The optional n8n service can be started with:

```bash
docker compose --profile automation up -d
```

No NEXORA business workflow is enabled in this phase. Preserve `N8N_ENCRYPTION_KEY`; credentials stored by n8n cannot be reliably recovered without the original key. Telegram, email, SMS, WhatsApp, and other external notifications remain disabled until credentials, adapters, tests, and approval exist.

## Database Migrations

The API container applies pending migrations at startup. Inspect the current revision:

```bash
docker compose --profile core exec api alembic current
```

Apply migrations explicitly when the API is stopped or during controlled local testing:

```bash
docker compose --profile core run --rm api alembic upgrade head
```

Review migration scripts before applying them to any persistent environment. The engineering-foundation validation exercises upgrade, complete downgrade, and repeat upgrade against an isolated disposable database:

```bash
poetry --directory apps/api run python scripts/validate_migrations.py
```

Never run a downgrade on important data without a verified backup and compatibility plan.

## Routine Diagnostics

Use bounded log views rather than unfiltered continuous output when diagnosing a failure:

```bash
docker compose --profile core ps
docker compose --profile core logs --tail=200 api
docker compose --profile core logs --tail=200 web
docker compose --profile core logs --tail=200 postgres redis
```

| Symptom | Safe first checks |
| --- | --- |
| API remains unhealthy | Inspect PostgreSQL and Redis health, then API migration and startup logs. Verify `DATABASE_URL`, `REDIS_URL`, and `SECRET_KEY` are populated. |
| Readiness returns 503 | Read the dependency status in the response and container health; do not replace the result with a false healthy state. |
| Login returns an error | Confirm an active user exists, the API is ready, and the web container’s `API_INTERNAL_URL` resolves to `api:8000`. Do not log passwords or tokens. |
| Protected page redirects unexpectedly | Confirm the browser uses a consistent host and that the session cookie is present. Login and logout use relative same-origin redirects. |
| Web page loads without content | Inspect browser errors and the web logs, then run component, accessibility, and production-build validation before modifying layout code. |
| Compose interpolation fails | Compare `.env` with `.env.example`; provide every required variable without committing the resulting file. |

## Validation Before a Checkpoint

Run the complete gate on Linux:

```bash
./scripts/validate.sh
```

Run the equivalent gate on Windows PowerShell:

```powershell
.\scripts\validate.ps1
```

The default gate performs the JavaScript dependency audit, repository formatting, lint, strict type checking, tests and coverage, production builds, API smoke validation, reversible migration validation, all Compose-profile renders, and both production image builds. Image builds may be explicitly skipped only when the Docker daemon is unavailable, and the limitation must be recorded in the phase evidence.

## Safe Shutdown and Cleanup

Stop services while preserving named volumes:

```bash
docker compose --profile full down
```

Remove only disposable validation images when desired:

```bash
docker image rm nexora-api:validation nexora-web:validation
```

The following command is destructive because it removes local PostgreSQL, Redis, MinIO, Qdrant, n8n, Prometheus, and Grafana volumes:

```bash
docker compose --profile full down --volumes
```

Do not run destructive cleanup unless the local data is known to be disposable and the action is explicitly intended.

## Secrets and Rotation

Secrets must never appear in commits, screenshots, logs, reports, test fixtures intended for production, or exported n8n workflows. To rotate a local secret, update `.env`, recreate the affected containers, verify health, and revoke the old value where relevant. Rotating `SECRET_KEY` invalidates existing access tokens. Rotating database, Redis, MinIO, n8n, or Grafana credentials may require coordinated service configuration and must not be performed as an unreviewed partial change.

## Backup and Recovery Status

Named Docker volumes provide persistence across normal local container recreation, but they are not off-site backups. Automated encrypted backups, manifests, checksums, retention, PostgreSQL recovery objectives, MinIO synchronization, Qdrant snapshots, n8n state recovery, secret recovery, isolated restore drills, production rollback, and one-command VPS replacement are accepted requirements for the later operations phase.

Until that phase is implemented and tested, do not treat this repository as a production recovery guarantee. See `docs/REQUIREMENTS_ADDENDUM_2026-08-01.md` for the approved future recovery scope and safety constraints.

## Escalation Boundaries

Stop and obtain explicit approval before purchasing or creating infrastructure, changing DNS, exposing services publicly, deploying to production, enabling a paid or external integration, handling a CAPTCHA or authenticated marketplace, sending messages, modifying production secrets, restoring over live data, deleting persistent data, making payments, or publishing externally consequential claims.
