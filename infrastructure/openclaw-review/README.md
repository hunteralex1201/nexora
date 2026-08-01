# NEXORA Optional OpenClaw Future-Worker Package

**Status:** Review-only; live deployment **not approved**
**Owner:** NEXORA platform team
**Author:** Manus AI
**Prepared:** 2026-08-01

Ei directory-ti NEXORA production stack-er angsho noy. Eta sudhu future security review-er jonno ekta **fail-closed OpenClaw worker scaffold**. Main `docker-compose.yml`, Caddy, n8n, API, worker, PostgreSQL, Redis, MinIO, Qdrant, Ollama, Prometheus ba Grafana-r sathe kono network/mount/credential connection ekhane deya hoyni.

> **Policy decision:** NEXORA-r authoritative brain, model gateway, job ledger, approval engine o audit boundary hobe NEXORA API/worker. Ollama private low-cost default, n8n deterministic orchestrator, ebong Manus complex asynchronous research/planning/judgment layer. OpenClaw sudhu future isolated worker hote pare; Hermes ekhono production-approved noy.

## Decision summary

| Option | NEXORA decision | Karon |
|---|---|---|
| NEXORA API/worker | **Authoritative control plane** | Server-side allowlist, data-class policy, budgets, idempotency, retries, structured validation, audit o approvals ekhane enforce hoy. |
| Manus API | **Approved high-level async delegation path** | Project-scoped instruction, private task, structured result, signed webhook, lifecycle state o human-confirmation mapping NEXORA ledger-e persist hoy. |
| Ollama | **Default inference provider** | Private, local o low-cost path; restricted data cloud-e pathano hoy na. |
| OpenClaw | **Optional future isolated worker only** | Broad agent/tool ecosystem ache, kintu sandbox default off; Gateway sandbox-er baire thake, native plugins-o Gateway trust boundary-te chole.[1] |
| Hermes Agent | **Production-e deploy kora jabe na** | Recent gateway/shell advisories-er exact fixed-version mapping latest release note-e sufficiently verifiable noy; code/commit-level review chara approval deya hobe na. |

## Ei scaffold je control-gulo enforce kore

`compose.review-only.yml` kono host port publish kore na; Gateway sudhu ekta isolated internal Docker network-e thake. Eta NEXORA-r production network-e join kore na, host Docker socket mount kore na, `host.docker.internal` alias dey na, ebong kono database/application secret ney na. Container-er sob Linux capability drop kora, `no-new-privileges` active, root filesystem read-only, bounded tmpfs, PID/CPU/RAM limit set, ebong restart disabled.

`openclaw.json` sob session-e sandbox require kore, per-session scope use kore, workspace access `none`, sandbox network `none`, read-only root o all capabilities drop kore. Global tool profile `minimal`; runtime, filesystem, web, browser/UI, automation, messaging, node, media, agent-spawn o plugin tool groups denied. Host escape hisebe elevated mode disabled, exec denied, code mode disabled, ebong native plugin allowlist empty. Official documentation onujayi sandboxing default-e off ebong Gateway sandbox-er baire thake; elevated mode sandbox bypass korte pare, tai ei controls mandatory.[1] [2] [3]

`approval-gate` service container start-er age char-ti condition check kore: explicit change-record marker, official GHCR image path, non-floating/non-beta stable tag plus immutable SHA-256 digest, ebong minimum-length unique Gateway token. Etar konotai source control-e secret store kore na.

## Important limitation

OpenClaw-er Docker/Podman sandbox backend normally engine CLI/socket use kore. Host Docker socket agent Gateway-e mount kora NEXORA policy-te forbidden, karon seta production daemon-er control boundary expose korte pare.[1] Ei scaffold-e socket nei; tai tool sandbox execution intentional bhabe **fail closed** thakbe. Functional pilot-er age alada sandbox host/daemon ba alada VPS security review o approval dorkar. Production Docker daemon share kora jabe na.

## Future approval prerequisites

| Gate | Required evidence |
|---|---|
| Version | Current stable release abar verify korte hobe; `latest`, `main`, `extended-stable`, beta, dev ba source-head forbidden. |
| Provenance | Signed release/tag review, official GHCR manifest, SBOM/provenance review, ebong exact immutable image digest change record-e thakte hobe. |
| Security | Current CVE/advisory scan, OpenClaw `security audit --deep`, plugin/skill inventory, config-schema validation, ebong documented exception review pass korte hobe.[3] |
| Isolation | Dedicated host/VM ba separate rootless sandbox engine; kono production Docker socket, host root, NEXORA repository, database, Redis, MinIO, provider keys ba application `.env` mount kora jabe na. |
| Network | Default deny egress; sudhu approved NEXORA internal adapter destination/mTLS identity. Public DNS, Caddy route, Cloudflare route, messaging channel ba Control UI exposure forbidden. |
| Capability | Ekta narrow task class, bounded input/output schema, no arbitrary shell, no browser, no cron, no publishing, no external message, no deployment, no deletion. |
| Data | Sudhu `public` ba explicitly approved `internal` sanitized payload; `restricted` data, secrets, cookies, tokens, PII ba raw customer records forbidden. |
| Operations | Health probe, audit logs, correlation ID, idempotency key, timeout, retry ceiling, dead-letter behavior, alert, backup, upgrade staging o rollback rehearsal documented hote hobe. |
| Human approval | Security owner, platform owner o product owner-er written change record chara `NEXORA_OPENCLAW_APPROVED=CHANGE_RECORD_APPROVED` set kora jabe na. |

## Review-only validation

Real secret ba image pull chara Compose syntax validation-er jonno placeholder values use kora jay:

```bash
OPENCLAW_IMAGE='ghcr.io/openclaw/openclaw:2026.7.1@sha256:0000000000000000000000000000000000000000000000000000000000000000' \
OPENCLAW_GATEWAY_TOKEN='validation-only-token-000000000000' \
NEXORA_OPENCLAW_APPROVED='NOT_APPROVED' \
docker compose -f infrastructure/openclaw-review/compose.review-only.yml config
```

Ei command container start kore na. **`docker compose up` run kora prohibited**, jotokkhon na upor-er sob gate complete o live change explicitly approved.

## Future approved pilot sequence

1. Current official stable release o advisory status re-check kore signed change record banate hobe. Official registry theke manifest digest resolve kore digest-ti peer-review korte hobe.[4]
2. Dedicated isolated sandbox host/engine provision korte hobe; NEXORA production host daemon use kora jabe na.
3. `.env.example` theke untracked `.env` banie unique Gateway token secret manager theke inject korte hobe. Kono provider credential OpenClaw-e deya hobe na; narrow NEXORA adapter identity alada kore issue hobe.
4. Config-schema validation, image/SBOM scan, `openclaw security audit --deep`, network-policy test o negative permission test pass korte hobe.
5. Canary-te sudhu synthetic data diye narrow task class test korte hobe. Measured evidence o AI interpretation alada records-e rakhte hobe.
6. Approval chara kono public route, channel, plugin, MCP, browser, cron, elevated mode, writable mount ba external communication enable kora jabe na.

## Rollback

Pilot rollback-e adapter route disable, task class allowlist remove, Gateway stop, dedicated credentials revoke, network policy remove, state volume forensic hold-e neya, audit/correlation records preserve, ebong incident review complete korte hobe. NEXORA API/worker/n8n/Ollama path unaffected thakbe, karon OpenClaw production network ba model-routing authority share kore na.

## References

[1]: https://docs.openclaw.ai/gateway/sandboxing "OpenClaw — Sandboxing"
[2]: https://docs.openclaw.ai/tools/elevated "OpenClaw — Elevated mode"
[3]: https://docs.openclaw.ai/gateway/security "OpenClaw — Gateway security"
[4]: https://docs.openclaw.ai/install/docker "OpenClaw — Docker installation and official image registry"
