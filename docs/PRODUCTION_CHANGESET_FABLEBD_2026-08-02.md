# NEXORA `fablebd.com` Production Change Set

**Prepared:** 2026-08-02
**Status:** **Scope A approved; controlled execution in progress**

**Scope:** GitHub publication, VPS release, database migration, `fablebd.com` DNS/TLS cutover, private-first multi-model runtime, and post-deployment acceptance

> **Approval boundary:** Ei document-ti implementation plan; live change noy. User-er explicit approval chara GitHub push, VPS deploy, database migration, Cloudflare record change, provider enablement, ba public hostname cutover kora jabe na.

## 1. Executive decision

NEXORA-r nijer API o worker-i **policy authority** thakbe. Ollama hobe private, low-cost default; NEXORA server-side allowlist, data-class rule, retry/fallback, budget, trace, ebong approval policy provider/model select korbe. Manus sudhu complex asynchronous research, planning o judgment-er jonno use hobe. n8n deterministic orchestration korbe, kintu direct provider key ba unrestricted model control pabe na.

Hermes production-e deploy kora hobe na. OpenClaw-o production brain hisebe deploy kora hobe na; sudhu version-gated, network-isolated, review-only future-worker scaffold repository-te thakbe. Caddy-i ekmatro public ingress thakbe; n8n, Ollama, PostgreSQL, Redis, MinIO, Qdrant, Grafana, Prometheus, API, worker, ba optional agent gateway direct internet-e publish hobe na.

## 2. Measured current state

2026-08-02-e public DNS measurement-e `fablebd.com`-er Cloudflare nameserver active chhilo, kintu apex `A`/`AAAA` answer chhilo na; `www`, `api`, `app`, ebong `n8n` names-o resolve korchhilo na. Ei measurement Cloudflare DNS-over-HTTPS endpoint diye kora hoyeche; kono record mutate kora hoyni.

Existing verified production baseline `46.250.242.20` VPS-e temporary `https://46-250-242-20.sslip.io` hostname use kore. Repository checkpoint-e Caddy-ke only public HTTP/HTTPS ingress, key-only SSH, UFW, fail2ban, restricted `.env` mode, Docker log limits, daily PostgreSQL backup, checksum, ebong isolated restore validation recorded ache. Fresh release-er thik age ei control-gulo abar read-only preflight-e pass korte hobe.

| Surface | Measured or verified baseline | Planned target |
|---|---|---|
| Apex DNS | No `A`/`AAAA` answer | `A @ → 46.250.242.20` |
| `www` DNS | NXDOMAIN | `CNAME www → fablebd.com` |
| Public application host | `46-250-242-20.sslip.io` | `https://fablebd.com` |
| Canonical alias | None | `www` permanently redirects to apex |
| Public ingress | Caddy on 80/443 | Unchanged |
| Internal services | Private/loopback | Unchanged |
| Default AI | Ollama | Ollama private-first |
| Cloud AI | Not production-enabled | Adapter present; disabled until secure key staging |
| Manus | Project brain/runbook prepared | Adapter present; disabled until secure API key/profile staging |
| OpenClaw/Hermes | Not deployed | Not deployed |

## 3. Release contents

The local release adds a server-authoritative model registry and task router; private Ollama and disabled-by-default OpenAI-compatible cloud adapters; an idempotent Manus API v2 delegation client; RSA-SHA256 signed webhook verification with freshness and replay controls; normalized AI execution, provider-attempt, Manus delegation, webhook receipt, and approval records; worker-side provider-attempt persistence; trace links from AI interpretations to their execution ledger; and additive Alembic revision `20260801_0004_ai_orchestration`.

The n8n daily AI workflow now sends explicit `data_class: internal` while leaving provider/model selection to NEXORA policy. A separate Manus workflow is manual-only, disabled, contains no webhook trigger, grants no connector or skill IDs, and calls the trusted NEXORA API rather than Manus directly.

The frontend release adds the premium NEXORA visual system, optimized WebP intelligence assets, responsive command navigation, upgraded dashboard and automation workspace, and a credential-free Model Control Center showing only server-authorized provider/model status and execution traces.

## 4. Exact live mutations requiring approval

| Step | Mutation | Safety gate | Rollback |
|---|---|---|---|
| 1 | Create a timestamped PostgreSQL backup and record the current Git commit, image IDs, Compose state, `.env` mode, and Caddy config hash. | Backup checksum and archive listing must pass before release. | Abort without service changes if any preflight fails. |
| 2 | Commit the reviewed local change set and push it to the user-owned GitHub repository. | No secrets; no temporary reports; secret scan, tests, typing, lint, and build already pass. Diff is reviewed again immediately before push. | Revert commit or reset deployment branch to the recorded pre-release commit. |
| 3 | Pull the approved commit on `/opt/nexora/app`; update server-side `.env` without printing values. | File remains mode `0600`; cloud and Manus remain disabled unless separately staged. | Restore the pre-release `.env` copy and checked-out commit. |
| 4 | Run `docker compose config --quiet`, build/recreate application services, and allow the API startup command to apply Alembic `upgrade head`. | Single Alembic head and offline PostgreSQL SQL generation passed. Backup must exist. | Revert images/commit; use migration downgrade only if application rollback requires it and backup remains available. |
| 5 | Verify loopback API readiness, worker state, database revision, internal n8n access, and every Docker health state before DNS cutover. | No public hostname change until all checks pass. | Restore prior containers and stop. |
| 6 | Add temporary DNS-only `A @ → 46.250.242.20` and `CNAME www → fablebd.com`, TTL Auto. | No `api`, `app`, `n8n`, monitoring, database, or agent records are created. | Remove the two new records; temporary sslip.io host remains available. |
| 7 | Set `NEXORA_HOST=fablebd.com`, matching origin/CORS/public URL settings, reload Caddy, and obtain certificates for apex and `www`. | Direct origin TLS certificate CN/SAN and expiry must validate before Cloudflare strict mode. | Restore old host environment/Caddy config and recreate previous web/API/Caddy containers. |
| 8 | Change the two web records to **Proxied**, then set Cloudflare SSL/TLS to **Full (strict)**. | Public apex health, redirect, login, protected page, API readiness, headers, and origin certificate all pass. | Return records to DNS-only or remove them; restore prior Cloudflare SSL mode only if required for rollback. |
| 9 | Import/update the versioned n8n workflows. Keep the Manus workflow inactive. | Daily AI workflow is active; manual Manus workflow remains disabled. | Disable/re-import the previous workflow export. |
| 10 | Run acceptance checks and keep the temporary sslip.io hostname during the stabilization window. | No restricted service becomes public; no provider key appears in logs or responses. | DNS removal/reversion plus application rollback to recorded commit/images. |

## 5. Cloudflare record and TLS plan

| Type | Name | Content | Initial state | Final state |
|---|---|---|---|---|
| `A` | `@` | `46.250.242.20` | DNS-only for origin certificate verification | Proxied, TTL Auto |
| `CNAME` | `www` | `fablebd.com` | DNS-only for origin certificate verification | Proxied, TTL Auto |

No public `api.fablebd.com`, `app.fablebd.com`, `n8n.fablebd.com`, `ollama`, database, storage, vector, monitoring, or agent-gateway record will be created. API traffic remains same-origin under `https://fablebd.com/api/...`, and Caddy redirects `https://www.fablebd.com` permanently to the apex.

Cloudflare documents that proxied web records route HTTP/HTTPS through Cloudflare and recommends proxying web-serving `A`, `AAAA`, and `CNAME` records.[1] Cloudflare also recommends **Full (strict)** when the origin has an unexpired trusted certificate matching the hostname.[2] Caddy automatically provisions and renews public certificates when DNS resolves to the server and ports 80/443 are reachable.[3]

## 6. AI-provider activation boundary

The code supports configured local and cloud models, but **all possible models will not be blindly enabled**. Provider and model selection remains server-side, allowlisted, budgeted, and data-class restricted. The sandbox's own service credential will never be copied to NEXORA.

| Runtime | Release state | Activation requirement |
|---|---|---|
| Ollama | Enabled private default | Existing local runtime and allowlisted model readiness pass |
| OpenAI-compatible cloud | Disabled | User-owned key staged through a no-echo server-side procedure; explicit allowlist, per-task budgets, and data policy approved |
| Manus API v2 | Disabled | User-owned Manus API key, project ID/profile, callback URL, and connector/skill allowlists staged securely; signed callback test passes |
| Manual Manus n8n template | Imported but inactive | Separate operator decision for each reviewed research brief |
| OpenClaw | Not deployed | Future security review, immutable image digest, isolated host/network, and separate approval |
| Hermes | Not deployed | No production consideration until recent advisories have a clearly verified patched release |

**Recommended launch mode:** deploy and cut over the domain with Ollama active and cloud/Manus adapters disabled. After the public application is stable, stage user-owned provider credentials without sharing them in chat and perform a separate controlled enablement. This preserves rollback clarity and avoids coupling DNS, database migration, and paid-provider activation in one failure domain.

## 7. Validation evidence already completed

| Gate | Measured result |
|---|---|
| Backend regression | 84/84 tests passed; the complete suite also passed with warnings promoted to errors |
| Backend coverage | 80.16%, repository gate passed |
| Strict Python typing | 47 source files passed |
| Backend security/style lint | Full Ruff gate passed; Black checked 64 mutable backend, test, entrypoint, and new-migration files; applied historical migrations remain byte-identical to HEAD |
| Frontend tests | 28/28 passed |
| Frontend coverage | 79.96% statements/lines, 75.28% functions, and 68.88% branches |
| Frontend lint/type/build | Full lint passed; TypeScript passed; Next.js production build passed with 20 app-path manifest entries |

| Migration structure | Single head; full PostgreSQL upgrade SQL and additive downgrade SQL generated offline |
| Compose topology | Full production rendering passed; Caddy only non-loopback public service; OpenClaw absent |
| Secret scan | Gitleaks scanned all 253 files in the exact staged Git tree with redaction; 0 findings; historical acceptance/handover artifacts excluded from the pre-deployment commit |
| JavaScript dependency audit | No known vulnerability |
| Python dependency audit | 39 Poetry main-group runtime dependencies exported and audited after framework, multipart, metrics, JWT, and direct `cryptography` dependency remediation; no known runtime vulnerabilities found |

Measured test results are evidence. Security classifications, routing suitability, and reachability decisions are engineering interpretation and are documented separately in `SECURITY_VALIDATION_2026-08-02.md`.

## 8. Stop conditions

Deployment stops before DNS if backup validation, Compose rendering, migration status, service health, `.env` permissions, or Caddy validation fails. DNS cutover stops before proxy/Full-strict if origin TLS does not match apex and `www`. Provider activation stops if credentials are absent, model/profile identifiers are not allowlisted, callback signature validation fails, or any prompt would contain restricted data. Any unexpected public port, uncommitted VPS change, migration divergence, or missing rollback artifact is a hard stop.

## 9. Required approval

The recommended approval is intentionally split into two scopes.

| Approval | Effect |
|---|---|
| **A — Launch private-first** | Authorizes GitHub push, VPS backup/deploy/migration, the two Cloudflare DNS records, certificate validation, Cloudflare proxy plus Full (strict), n8n workflow import, and acceptance testing. Ollama is active; cloud AI and Manus remain disabled. |
| **B — Provider activation later** | After A is stable, separately authorizes secure user-owned cloud/Manus credential staging, exact model/profile allowlists, signed callback validation, budget limits, and controlled enablement. No credential should be sent in chat. |

**Approval record:** Scope A was explicitly confirmed in this task. Scope B remains unapproved.

The Scope A approval does **not** authorize OpenClaw or Hermes deployment, public exposure of internal services, credential disclosure, paid-model activation, external publishing by agents, payments, or destructive data operations.

## References

[1]: https://developers.cloudflare.com/dns/proxy-status/ "Cloudflare DNS proxy status"
[2]: https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/ "Cloudflare Full (strict)"
[3]: https://caddyserver.com/docs/automatic-https "Caddy automatic HTTPS"
[4]: https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/ "Cloudflare DNS record management"
