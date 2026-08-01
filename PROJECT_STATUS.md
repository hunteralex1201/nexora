# NEXORA Intelligence — Project Status Report

**Last updated:** 2026-08-02
**Release state:** **Validated release candidate; live rollout pending**
**Approved launch scope:** **Private-first Scope A**

## Executive status

NEXORA is an executable commerce-intelligence platform with authenticated FastAPI and Next.js applications, PostgreSQL-backed commerce and AI ledgers, a durable deterministic worker, private Ollama integration, governed asynchronous cloud/Manus adapter boundaries, n8n workflow definitions, and Caddy-only public ingress. This statement describes implemented code and measured validation; it does not claim that the current release commit has already been deployed.

| Area | Measured or implemented state | Boundary |
|---|---|---|
| Backend validation | 84/84 tests passed; 80.16% coverage; warning-as-error suite, 64-file mutable-source Black gate, Ruff, and strict MyPy passed | Evidence from the rebased release-candidate worktree |
| Frontend validation | 28/28 tests, lint, TypeScript, and optimized production build with 20 app-path manifest entries passed | Evidence from the rebased release-candidate worktree |
| Runtime dependency security | 39 exported locked Poetry main-group dependencies and the frontend production graph report no known vulnerabilities | Point-in-time advisory scan, not a perpetual guarantee |

| Core commerce | Auth, RBAC, source/product evidence, jobs, alerts, worker retries, idempotency, and local AI paths implemented | Deterministic code remains deterministic |
| Model routing | Ollama private default; cloud and Manus paths are server-side, allowlisted, budgeted, audited, and disabled for private-first launch | No client-selected arbitrary provider/model |
| Agent catalog | 25 planned roles are exposed as configuration metadata | No autonomous execution, persistent memory, Telegram dispatch, or 24/7 runtime is claimed |
| Sourcing/dropshipping | Deterministic input-based calculators implemented | Included supplier/opportunity rows are synthetic, unverified examples |
| Leads/SEO | Demonstration workspaces and preview contracts implemented | Included records and metrics are synthetic; no crawler or live provider ran |
| Discovery prototype | Unsafe/unbacked route removed | No discovery feed is advertised until a reviewed worker and evidence contract exist |
| OpenClaw | Isolated review-only package | Not in production Compose and not approved for deployment |
| Hermes | Research only | Production deployment blocked pending a clearly verified patched release |
| Production rollout | Scope A change-set approved; backup, deploy, migration, DNS/TLS cutover, and acceptance remain to be executed | Any new provider activation or external action requires separate approval |

## Planned agent-role catalog

The repository defines 25 role configurations covering orchestration, discovery, pricing, market analysis, sourcing, finance, quality control, reporting, and recovery. These entries are **planning metadata only**. Operator controls that would imply real execution or dispatch remain disabled until a durable policy-enforced worker, structured outputs, audit records, retries, and human approval gates are implemented and validated.

## Release gates

| Gate | Status |
|---|---|
| Backend tests and 80% coverage threshold | Passed |
| Backend formatting, lint, and strict typing | Passed for mutable release source; already-applied migration `20260801_0002` intentionally remains byte-identical to HEAD |
| Frontend tests, lint, type-check, and production build | Passed |
| Alembic linear head and PostgreSQL offline SQL | Passed; sole head `20260801_0004` |
| Production Compose rendering | Passed without starting containers |
| Exact-version Caddy parser validation | Passed with Caddy 2.11.4 and no live reload |
| Credential leak scan | Gitleaks: all 253 files in the exact staged Git tree, 0 findings |
| Live backup/deployment/DNS/TLS acceptance | Pending execution |

## Next controlled step

Create and push the reviewed release commit, take a validated VPS backup, deploy the exact base-plus-production Compose topology, apply the additive Alembic migration, verify private services and Caddy ingress, then cut over the approved Cloudflare records for `fablebd.com` and `www.fablebd.com`. Cloud AI, Manus credentials, OpenClaw, Hermes, external publishing, payments, and destructive operations remain outside Scope A.
