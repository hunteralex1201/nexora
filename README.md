# NEXORA Intelligence

NEXORA Intelligence is a **Bangladesh-first, self-hosted commerce intelligence platform**. The repository is organized as a modular monorepo for collecting lawful public commerce observations, preserving evidence, producing governed intelligence, and adding controlled automation over successive validated phases.

> **Current status:** The engineering foundation is implemented. It provides the web shell, FastAPI service, authentication and RBAC foundation, initial database migration, shared configuration and logging packages, local service topology, monitoring bootstrap, tests, and validation automation. Live marketplace connectors, browser collection, workers, intelligence engines, native agents, and production deployment are deliberately not claimed in this phase.

## Foundation Capabilities

| Area | Implemented foundation |
| --- | --- |
| Web | Next.js App Router application with landing, login, protected overview, system, and settings routes; responsive application shell; loading, empty, partial, error, restricted, and not-found states |
| API | FastAPI application with structured errors, request and correlation IDs, liveness, dependency readiness, Prometheus metrics, OAuth2 password login, current-user lookup, and reusable role enforcement |
| Data | Async SQLAlchemy, PostgreSQL runtime support, an isolated SQLite test path, Alembic history, and initial roles, users, sources, and crawl-job tables |
| Security | Argon2 password hashing, signed access tokens, HTTP-only web session cookie, server-side authentication bridge, route protection, production secret validation, and least-privilege container users |
| Local infrastructure | Profile-based Docker Compose topology for PostgreSQL, Redis, MinIO, Qdrant, API, web, optional n8n, Prometheus, and Grafana |
| Quality | Strict TypeScript and Python checks, unit and route tests, automated accessibility checks, coverage thresholds, migration reversibility checks, production builds, container builds, and CI |
| Governance | Connector and data-trust standards, phase tracking, repository audit, security architecture, and explicit unavailable-data behavior |

## Repository Layout

| Path | Purpose |
| --- | --- |
| `apps/web` | Next.js dashboard and server-side authentication bridge |
| `apps/api` | FastAPI service, models, migrations, security services, and tests |
| `packages/config` | Shared TypeScript configuration parsing and credential redaction |
| `packages/logger` | Shared structured logging and request-context support |
| `infrastructure/monitoring` | Provisioned Prometheus and Grafana foundation configuration |
| `scripts` | Cross-platform bootstrap and complete validation commands |
| `docs/checkpoints` | Auditable pre-implementation, dependency, visual, and validation evidence |
| `CONNECTOR_STANDARD.md` | Required contract and safety gate for future source connectors |
| `DATA_TRUST_STANDARD.md` | Evidence, provenance, confidence, freshness, and presentation rules |
| `PHASE_STATUS.md` | Current validated phase state and next permitted work |

## Prerequisites

Local source development requires **Node.js 20.9 or newer**, **pnpm 10**, **Python 3.11 or newer**, and **Poetry 2**. Docker Engine or Docker Desktop with the Compose v2 plugin is required for the local service topology and image validation.

No paid service, cloud AI key, proxy subscription, hosted database, external authentication service, or live marketplace credential is required for the engineering foundation.

## Secure Local Bootstrap

Clone or open the repository, then use the platform-specific bootstrap command. The script is idempotent, preserves an existing `.env`, installs locked dependencies, and does not start services or contact external business systems.

```bash
./scripts/bootstrap.sh
```

On Windows PowerShell:

```powershell
.\scripts\bootstrap.ps1
```

The first run copies `.env.example` to `.env` when `.env` is absent. **Replace every `CHANGE_ME` value before starting shared or persistent services.** Never commit `.env`, credentials, dumps, raw source material, customer or lead records, n8n credential exports, or encryption keys.

## Start the Core Local Stack

The `core` profile starts the web and API applications with PostgreSQL, Redis, MinIO, and Qdrant. Ports bind to loopback only.

```bash
docker compose --profile core up --build -d
docker compose --profile core ps
```

The API container applies Alembic migrations before serving traffic. After all services are healthy, create the first local administrator interactively:

```bash
docker compose --profile core exec api \
  python scripts/create_admin.py --email admin@example.com
```

The command requests a password without echoing it. Use a unique local address and password; do not place the password in shell history.

| Local endpoint | Address |
| --- | --- |
| Web application | `http://127.0.0.1:3000` |
| API documentation | `http://127.0.0.1:8000/docs` |
| API liveness | `http://127.0.0.1:8000/api/v1/health` |
| API readiness | `http://127.0.0.1:8000/api/v1/ready` |
| MinIO console | `http://127.0.0.1:9001` |

Stop the stack without deleting data volumes:

```bash
docker compose --profile core down
```

`docker compose down --volumes` deletes local persistent data and is intentionally not part of normal instructions.

## Compose Profiles

| Profile | Services | Intended use |
| --- | --- | --- |
| `core` | PostgreSQL, Redis, MinIO, Qdrant, API, web | Current local application foundation |
| `automation` | n8n | Optional future workflow experimentation; no business workflows are pre-enabled |
| `ai` | Qdrant | Vector-storage foundation only; no model or agent runtime is claimed |
| `monitoring` | Prometheus, Grafana | Optional local metrics collection and dashboard provisioning |
| `full` | All defined services | Combined local topology for integration validation |

Start only the profile needed. Optional external integrations remain disabled until their adapters, lawful access, credentials, tests, and explicit approvals exist.

## Development Without Containers

After bootstrap, the frontend can be started with:

```bash
pnpm --dir apps/web dev
```

The API can be started from its directory after providing local host-resolvable `DATABASE_URL`, `REDIS_URL`, and `SECRET_KEY` values:

```bash
cd apps/api
poetry run alembic upgrade head
poetry run uvicorn main:app --reload
```

Do not reuse the Compose service hostnames `postgres`, `redis`, or `api` from a process running directly on the host unless local name resolution has been configured intentionally.

## Complete Validation

Run the full deterministic gate before committing foundation changes:

```bash
./scripts/validate.sh
```

On Windows PowerShell:

```powershell
.\scripts\validate.ps1
```

The validators check the JavaScript dependency audit, formatting, lint, strict typing, tests, coverage, production builds, API import and required routes, Alembic upgrade/downgrade/re-upgrade, every Compose profile, and both production images. If a Docker daemon is unavailable, `--skip-images` or `-SkipImages` may be used only when the limitation is recorded; Compose rendering still runs.

Individual workspace commands are also available:

| Command | Scope |
| --- | --- |
| `pnpm run audit:dependencies` | JavaScript dependency audit with no known vulnerabilities |
| `pnpm run format:check` | Repository formatting |
| `pnpm run lint` | Web and shared-package lint |
| `pnpm run typecheck` | Strict TypeScript validation |
| `pnpm run test` | Web and shared-package tests with coverage |
| `pnpm run build` | Production web and package builds |
| `pnpm run validate:api` | Python formatting, lint, strict typing, tests, and coverage |

## Data and Connector Boundaries

NEXORA may collect only data that is public, authorized, and permitted by the applicable source. Exact sales, customer lists, revenue, private inventory, private advertising performance, and internal marketplace analytics are **unavailable** unless an approved source explicitly provides them.

Future connectors must comply with `CONNECTOR_STANDARD.md`. Every metric and claim must comply with `DATA_TRUST_STANDARD.md`, including classification as verified, derived, estimated, AI-generated, stale, or unavailable. Fixture and demo data must remain visibly labeled and isolated from production records and exports.

## Documentation

Read `ARCHITECTURE.md` and `SYSTEM_DESIGN.md` for the system model, `ROADMAP.md` and `PHASE_STATUS.md` for implementation order, `SECURITY.md` for security design, `OPERATIONS.md` for local operating procedures, and `docs/REQUIREMENTS_ADDENDUM_2026-08-01.md` for the newly accepted self-hosting, disaster-recovery, native-agent, and modular-product requirements mapped to later phases.

Production deployment, DNS changes, VPS operations, paid services, marketplace authentication, external notifications, destructive recovery, and autonomous external actions require a later validated phase and explicit approval.
