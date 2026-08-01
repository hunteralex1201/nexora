# Changelog — NEXORA Intelligence

## [1.1.0] — 2026-08-02

### Added

- Added the governed AI execution ledger, model registry, provider policy, server-side routing service, asynchronous AI job handling, and additive Alembic revision `20260801_0004`.
- Added the private-first Ollama path and disabled-by-default cloud/Manus adapters with allowlists, budgets, data-class controls, idempotency, structured-output validation, correlation IDs, and signed Manus webhook handling.
- Added deterministic landed-cost and Bangladesh dropshipping calculators.
- Added `/sourcing`, `/leads`, and `/agents` dashboard workspaces, together with the premium visual system and responsive navigation.
- Added review-only OpenClaw configuration in an isolated package with no production profile, public port, workspace access, privileged mode, restart policy, or implicit approval.
- Added production Compose/Caddy configuration, inactive n8n workflow definitions, deployment change-set documentation, and security validation evidence.

### Changed

- Reclassified hard-coded supplier, dropshipping, lead, and SEO records as explicit **synthetic demonstration data**. These records are unverified and are not presented as live discovery, audit, or production evidence.
- Converted the 25-agent prototype into a **configuration-only catalog**. Run and Telegram actions remain disabled until a durable, policy-enforced worker exists; no endpoint reports fabricated execution, memory, dispatch, or always-on status.
- Removed the unbacked discovery API shim and its deleted unsafe worker dependency instead of restoring a prototype solely to satisfy imports.
- Rebased the unpublished AI-orchestration migration directly onto the tracked commerce-core head and removed the unrelated unpublished connector-telemetry revision.
- Upgraded FastAPI to `0.141.1`, Starlette to `1.3.1`, `python-multipart` to `0.0.32`, and Prometheus FastAPI instrumentator to `8.1.0`.
- Replaced `python-jose` with `PyJWT 2.13.0`, preserving a fixed server-configured HMAC allowlist and required `exp`/`sub` claims while removing the unfixed transitive `ecdsa` dependency.
- Declared `cryptography 50.0.0` directly because the Manus RSA webhook verifier imports it; clean production installs no longer depend on an incidental transitive package.

### Security

- Preserved Caddy as the only public ingress. PostgreSQL, Redis, MinIO, Qdrant, Ollama, n8n, Prometheus, Grafana, workers, and agent gateways remain private.
- Kept cloud AI and Manus disabled for the private-first launch; no provider key, cookie, token, database URL, internal service URL, or restricted field is exposed to clients, prompts, logs, or workflow payloads.
- Scanned 253 files in the exact staged Git tree with Gitleaks in redacted mode: **0 findings**.
- Audited the exported Poetry main dependency lock and the frontend production dependency graph: **no known vulnerabilities found**.

### Verified

- Backend: **84/84 tests passed**, **80.16% coverage**, the complete suite also passed with warnings promoted to errors, Black passed for **64 mutable release files** while applied historical migrations remained byte-identical to HEAD, full Ruff passed, and strict MyPy passed for **47 source files**.
- Frontend: **28/28 tests passed**, lint passed, TypeScript passed, and the optimized Next.js production build generated **20 app-path manifest entries**.

- Infrastructure: the base plus production Compose graph parsed successfully; the candidate Caddyfile validated against the exact production Caddy `2.11.4` image without starting or reloading production services.
- Database: Alembic reports sole head `20260801_0004`; the full PostgreSQL upgrade SQL and additive `0004 -> 0002` downgrade SQL generated successfully offline.

### Deferred by policy

- OpenClaw remains review-only and is not deployed.
- Hermes is not approved for production pending a clearly verified patched release for recent security advisories.
- Cloud/Manus provider activation, external communication, publishing, payments, destructive actions, and credential changes require separate explicit human approval.
