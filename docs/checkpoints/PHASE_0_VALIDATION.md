# Phase 0 Validation Checkpoint

**Project:** NEXORA Intelligence
**Repository phase:** Phase 0 — Engineering Foundation
**Master-plan mapping:** Phase 1 — Engineering Foundation
**Validation date:** 2026-08-01
**Status:** **Passed and deployed**
**Author:** Manus AI

## Completion Decision

The NEXORA engineering foundation is complete, published to the user-owned [GitHub repository][1], and operating as a hardened production baseline at `https://46-250-242-20.sslip.io`. The implementation preserved all 35 original files and added the deterministic workspace, API, web application, authentication, role-based authorization, database migrations, observability, testing, CI, deployment, backup, and operations foundations authorized by the Phase 0 scope.[2]

> **Decision:** Phase 0 is closed. The repository, GitHub `main` branch, and VPS checkout are aligned; the public foundation is healthy; administrator access has been validated and delivered outside Git; and the project is ready for a separately approved Phase 1 data-collection vertical slice. No live connector, marketplace automation, payment action, or intelligence claim is implied by this checkpoint.

| Completion surface | Final state | Evidence |
| --- | --- | --- |
| Validated source | Passed | Linux and Windows quality gates passed; all original files were preserved. |
| GitHub publication | Passed | Repository published at `https://github.com/hunteralex1201/nexora`; deployment baseline commit `762d452349fa31b1e38debf9c36649843cd4ce38` added explicit Caddy health monitoring. |
| Production runtime | Passed | Seven core services are running and Docker-healthy behind Caddy HTTPS. |
| Administrator access | Passed | Token issuance, profile, `admin` role membership, admin authorization, web login, protected overview, logout, and negative authentication cases passed. |
| Recoverability | Passed | Daily PostgreSQL timer active; latest archive checksum passed; archive catalog passed; isolated restore created six public tables and was removed after verification. |
| Security baseline | Passed | UFW, fail2ban, key-only SSH, restricted public ports, HTTPS headers, bounded Docker logs, live restore, restricted environment-file mode, and secret staging cleanup passed. |

## Canonical Engineering Validation Gate

The complete Linux gate was executed from the repository root with the sandbox-required Docker build-network override. The override changed only Docker build networking in the restricted validation environment; it did not change image contents, application networking, or normal repository defaults.

```bash
NEXORA_DOCKER_BUILD_NETWORK=host ./scripts/validate.sh
```

The command ended with `All selected engineering-foundation validation gates passed.` The Windows non-container gate subsequently repeated the applicable audit, formatting, lint, typing, test, coverage, build, API smoke, and migration checks from the transferred working copy.

| Engineering gate | Result | Evidence |
| --- | --- | --- |
| JavaScript dependency audit | Passed | `pnpm audit --audit-level=low` reported no known vulnerabilities after the documented dependency remediation.[3] |
| Repository formatting | Passed | Prettier completed with the documented generated and preserved-prose exclusions. |
| TypeScript lint and typing | Passed | Next.js and both shared packages completed strict checks with zero errors. |
| Web and shared tests | Passed | Web **11/11**; configuration package **4/4**; logger package **2/2**. |
| Web coverage | Passed | **99.29% statements**, **85.29% branches**, **85.71% functions**, and **99.29% lines**. |
| Workspace builds | Passed | Next.js production build generated all eight routes; both shared packages compiled. |
| Python formatting, lint, and typing | Passed | Black left all checked files unchanged; Ruff passed; Mypy reported no issues. |
| API tests and coverage | Passed | **15/15** tests; **84.11%** total coverage against an 80% requirement. |
| Alembic reversibility | Passed | Clean upgrade, full downgrade, and repeat upgrade passed against an isolated database. |
| Compose topology | Passed | `core`, `automation`, `ai`, `monitoring`, and `full` profiles rendered successfully; the production override also passed Docker Compose validation. |
| Production images | Passed | API and standalone Next.js images built successfully and ran as non-root users. |

The successful full Linux gate log remained an execution artifact in the validation environment. It contains no required source and was intentionally not committed.

## Application Runtime and Session Validation

Fresh API and web containers were originally recreated from the final Phase 0 images. The public production deployment was then tested through Caddy rather than only through loopback service ports. The session design uses a server-side token exchange and a secure HTTP-only cookie, while API role enforcement remains a reusable dependency.[4]

| Runtime assertion | Final result |
| --- | --- |
| API liveness | `GET /api/v1/health` returned HTTP 200 with `status=healthy` and `service=nexora-api`. |
| API readiness | `GET /api/v1/ready` returned HTTP 200 with healthy PostgreSQL and Redis dependencies. |
| Safe dependency diagnostics | `GET /api/v1/deps` returned healthy status and latency fields without hosts, URLs, or credentials. |
| Administrator token | OAuth2 form login returned a bearer token for the delivered administrator credential. |
| Administrator profile | `/api/v1/auth/me` returned the active administrator and a role-object list containing `name=admin`. |
| RBAC enforcement | `/api/v1/auth/authorize/admin` returned `authorized=true` and `required_role=admin`. |
| Negative authentication | Missing bearer authentication and a known-invalid password each returned HTTP 401. |
| Web session | `/api/auth/login` returned HTTP 303 to `/overview`; the cookie was `HttpOnly`, `Secure`, and `SameSite=Lax`. |
| Protected dashboard | Authenticated `/overview` returned HTTP 200. |
| Logout | `/api/auth/logout` expired the cookie, redirected to `/login`, and protected `/overview` again redirected after logout. |
| Security headers | HSTS, `nosniff`, frame denial, strict-origin referrer policy, and restrictive camera, microphone, and geolocation policy were present; the `Server` header was removed. |
| HTTPS redirect | Plain HTTP returned a permanent redirect to the HTTPS hostname. |

The production administrator email is `admin@46-250-242-20.sslip.io`. Its random one-time password is stored only in the user-restricted local file `D:\Reasearch\nexora-intelligence-admin.credentials`. The password is not recorded in this checkpoint, source control, command history, or the VPS staging path. The remote staging copy was securely removed after transfer.

## Production Topology and HTTPS

The production override exposes only Caddy on TCP 80 and TCP/UDP 443; application and data services remain on the private Docker network or loopback bindings. Caddy routes web authentication endpoints to Next.js before routing `/api/*` to FastAPI, supplies the security-header policy, and manages HTTPS for the temporary sslip.io hostname.[2] [5]

| Service | Production role | Final Docker state |
| --- | --- | --- |
| `web` | Next.js application and HTTP-only session bridge | Running, healthy |
| `api` | FastAPI application, authentication, RBAC, health, and metrics | Running, healthy |
| `postgres` | Primary relational persistence | Running, healthy |
| `redis` | Core cache and dependency service | Running, healthy |
| `minio` | Object-storage foundation | Running, healthy |
| `qdrant` | Vector-storage foundation | Running, healthy |
| `caddy` | HTTPS ingress and reverse proxy | Running, healthy through the local Caddy admin endpoint |

The explicit Caddy health check was added after final verification identified that the process was running and serving valid HTTPS but lacked a Docker health state. The health check uses the container-local Caddy admin endpoint, passed Compose validation, was published to GitHub, deployed with a Caddy-only recreation, and then passed the seven-service health gate.

## VPS Security and Operations Baseline

The VPS at `46.250.242.20` is operated through the non-root `nexora` account with key-based SSH. The final effective OpenSSH configuration disables password and keyboard-interactive authentication, permits public-key authentication, and disallows root password login. UFW is active, fail2ban monitors SSH, and the only publicly listening TCP ports are 22, 80, and 443.

| Control | Final result | Operational meaning |
| --- | --- | --- |
| SSH | Passed | Key-only authentication effective; root password login unavailable. |
| UFW | Passed | Active firewall policy with only required public services. |
| fail2ban | Passed | Service active and the `sshd` jail query succeeded. |
| Public TCP surface | Passed | Only 22, 80, and 443 detected. |
| Docker live restore | Passed | Enabled in configuration and confirmed by the running daemon. |
| Docker log retention | Passed | JSON logs bounded to 10 MB per file and five files. |
| Production environment file | Passed | `/opt/nexora/app/.env` mode is `0600`; values were not printed or committed. |
| Repository state | Passed | VPS worktree clean and aligned with GitHub at the deployed validation point. |

The operator runbook documents initial deployment, updates, backup installation, log retention, verification, and the temporary-hostname boundary.[2]

## Backup, Integrity, and Restore Evidence

The PostgreSQL backup service runs as the restricted `nexora` user under a sandboxed systemd unit. Its timer is enabled and active, with daily scheduling, persistence across downtime, restricted output permissions, SHA-256 integrity files, and seven-day local retention.[2]

| Recovery assertion | Final result |
| --- | --- |
| Timer state | `nexora-postgres-backup.timer` enabled and active. |
| Last service result | `success`. |
| Latest archive | `nexora-postgres-20260731T233750Z.dump`, non-empty and mode `0600`. |
| Checksum | Associated `.sha256` file present, mode `0600`, and verified successfully. |
| Archive readability | `pg_restore --list` completed successfully. |
| Isolated restore drill | Temporary database created, archive restored, **six** public tables detected, and temporary database dropped. |

The backup is intentionally local at this stage. Encrypted off-site replication, retention expansion, and full disaster-recovery automation remain future operations work rather than being overstated as complete.[6]

## TLS Validation

Caddy obtained and served a certificate for `46-250-242-20.sslip.io`. The final OpenSSL check confirmed that the certificate would remain valid for more than seven days and reported a `notAfter` value of **2026-10-29 22:19:13 GMT**. The public root and health endpoints remained reachable after the Caddy-only recreation.[5]

| TLS assertion | Final result |
| --- | --- |
| Public HTTPS | Passed |
| HTTP-to-HTTPS redirect | Passed |
| Certificate hostname | `46-250-242-20.sslip.io` |
| Certificate validity buffer | Greater than seven days |
| HSTS | `max-age=31536000; includeSubDomains` |

The sslip.io hostname is a temporary, no-purchase deployment boundary. A user-owned domain can replace it later through a separately approved DNS change without redesigning the application topology.[5]

## Visual and Responsive Validation

The production web image was examined in a real browser at desktop width. The landing page, sign-in page, protected application shell, overview, system, and settings routes were verified. A blank desktop content-panel defect was identified, fixed narrowly in `components/app-shell.tsx`, covered by a regression assertion, rebuilt, and visually rechecked.[4]

Automated accessibility validation reported no detectable violations for the application shell. Keyboard-visible focus styling, semantic headings, navigation state, mobile controls, reduced-motion handling, empty, partial, error, and restricted states, and same-origin login/logout behavior are covered by implementation or automated tests.[4]

## Windows Transfer and Cross-Platform Validation

The validated working copy was synchronized to `D:\Reasearch\nexora-intelligence` after creating the reversible backup `D:\Reasearch\nexora-intelligence-pre-phase0-20260801.zip`. The transfer preserved the original source and did not delete unknown paths.

| Windows validation | Result |
| --- | --- |
| PowerShell parser checks | Passed for bootstrap and validation scripts. |
| Deterministic bootstrap | Passed without creating `.env` or starting services. |
| Non-container quality gate | Passed audit, formatting, lint, typing, tests, coverage, builds, API smoke, and migrations. |
| Git repository | Initialized on `main`, reconciled with GitHub history, and published. |
| Docker Desktop | Not installed; Compose and image validation were completed on Linux and the actual VPS using the same source. |
| Administrator credential | Delivered outside the repository with Windows ACL inheritance disabled. |

Two genuine portability defects found by the Windows run—native-command quote stripping in the Python version probe and an unserialized `URLSearchParams` request body—were fixed narrowly and revalidated on both platforms.

## Credential Handling and First-Use Boundary

The delivered password is a one-time operations credential. The current Phase 0 interface intentionally does not claim a self-service password-change screen. After confirming the first login, the administrator password must be rotated through a secret-safe server-side procedure that prompts for or securely stages the replacement value; it must never be typed into chat, embedded in Git, placed in a command argument, or copied into a ticket.

> **First-use instruction:** Open `D:\Reasearch\nexora-intelligence-admin.credentials`, sign in at the recorded URL with the recorded email and password, then request or perform a second server-side rotation before treating the account as long-lived. Keep the credential file outside the repository and delete it after the replacement credential has been stored in the user's password manager.

## Known Boundaries and Next Phase

Phase 0 validates a production **foundation**, not a complete commerce-intelligence product. It does not claim live marketplace data, social ingestion, CAPTCHA handling, proxy rotation, paid services, browser automation, external notifications, payments, autonomous external actions, encrypted off-site backups, or intelligence accuracy. Future connectors must pass `CONNECTOR_STANDARD.md`, and future metrics must comply with `DATA_TRUST_STANDARD.md` so verified, derived, estimated, AI-generated, stale, and unavailable information remain distinct.[6]

| Next unit | Readiness | Entry condition |
| --- | --- | --- |
| Phase 1 — Data Collection Core | Ready, not started | Approve one fixture-backed connector vertical slice and create its pre-implementation checkpoint. |
| Live Bangladesh connector | Not authorized | Define source terms, access method, rate limits, provenance, and failure policy first. |
| Off-site disaster recovery | Not started | Select encrypted destination, key management, retention, and restore objectives. |
| Custom domain migration | Optional later | Supply a user-owned domain and approve DNS changes. |

## Final Closeout

The final end-to-end verification passed administrator API authentication and RBAC, browserless web login and logout, secure cookie flags, negative authentication cases, public health contracts, all seven Docker health states, UFW, fail2ban, effective key-only SSH, public-port restriction, Docker live restore, bounded logs, restricted environment permissions, backup checksum, archive catalog, isolated restore, TLS validity, Git alignment, and removal of the remote credential staging file.

> **Final result:** `FINAL_VPS_VALIDATION=PASS` and Phase 0 is ready to hand off.

## References

[1]: https://github.com/hunteralex1201/nexora "NEXORA Intelligence GitHub repository"
[2]: ../../deploy/production/README.md "NEXORA production operations runbook"
[3]: DEPENDENCY_SECURITY_2026-08-01.md "Dependency security remediation checkpoint"
[4]: PHASE_0_VISUAL_VALIDATION.md "Phase 0 visual and authenticated-session validation"
[5]: VPS_TLS_DECISION_2026-08-01.md "VPS TLS and hostname decision"
[6]: ../REQUIREMENTS_ADDENDUM_2026-08-01.md "Requirements addendum and future-phase boundaries"
