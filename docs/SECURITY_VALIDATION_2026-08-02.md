# NEXORA Security and Release Validation — 2026-08-02

## Scope

This record covers the multi-model router, cloud-provider adapter, Manus delegation and signed webhook path, AI execution ledger, n8n controls, premium frontend, and review-only OpenClaw package. It records pre-deployment validation evidence; it does **not** by itself authorize live DNS, deployment, credential changes, or publication.

## Measured evidence

| Gate | Result |
|---|---|
| Backend full regression | **84 tests passed** after upstream reconciliation and dependency/JWT-library remediation; the complete suite also passed with warnings promoted to errors |
| Backend coverage | **80.16%**, repository threshold satisfied |
| Backend formatting | **Passed**, 64 mutable release files checked by Black; applied historical migrations excluded and left byte-identical to HEAD |

| Backend lint | **Passed**, full application, tests, entrypoint, and migrations checked by Ruff |
| Backend strict typing | **Passed**, 47 source files checked by MyPy |
| Frontend full lint | **Passed** |
| Frontend type checking | **Passed** |
| Frontend regression suite | **Passed**, 28 tests |
| Frontend production build | **Passed**; 20 app-path manifest entries generated |

| Frontend production dependency audit | **No known vulnerabilities found** |
| Python locked production dependency audit | **No known vulnerabilities found** across 39 exported locked main-group dependencies |

| Release-candidate credential scan | **all 253 files in the exact staged Git tree scanned by Gitleaks with redaction; 0 findings**; the two historical acceptance/handover artifacts were not part of the pre-deployment commit |
| Production Compose parsing | **Passed** for the base plus production override; no containers started |
| Production Caddy parsing | **Passed** with the exact production Caddy 2.11.4 image; candidate file mounted read-only and no live reload performed |
| PostgreSQL migration chain | **Single head `20260801_0004`**; full upgrade SQL and `0004 -> 0002` downgrade SQL generated successfully offline |
| Git changed-path whitespace/conflict check | **Passed** |
| Live DNS/VPS/deployment mutation | **Not performed during this validation record** |

## Python dependency remediation

The first production-only audit identified remediable advisories in the locked FastAPI/Starlette and multipart stack, plus an unfixed transitive `ecdsa` advisory installed by `python-jose`. The release candidate was changed rather than accepting those risks.

| Component | Previous state | Validated release state | Security disposition |
|---|---|---|---|
| FastAPI | `0.116.1` | `0.141.1` | Current stable release at validation time; permits the fixed Starlette line.[1] |
| Starlette | `0.48.0` | `1.3.1` | Removes the audited Host-header/path-confusion and multipart/range/form-parser advisory exposure in the old lock.[2][3] |
| `python-multipart` | `0.0.20` | `0.0.32` | Newer than the `0.0.22` and `0.0.30` fixed-version thresholds for the audited path-traversal and quadratic parsing advisories.[4][5] |
| Prometheus FastAPI instrumentator | `7.1.0` | `8.1.0` | Its Starlette constraint now supports `>=1.0.0,<2.0.0`, allowing Starlette `1.3.1`.[6] |
| JWT library | `python-jose 3.5.0` plus transitive `ecdsa 0.19.2` | `PyJWT 2.13.0`; `python-jose` and `ecdsa` absent | Eliminates the unfixed transitive ECDSA implementation rather than relying on a reachability exception.[7] |
| RSA webhook verification | `cryptography` was available only incidentally through the old dependency graph | Direct `cryptography 50.0.0` production dependency | Makes clean installs reproducible for the Manus RSA signature verifier; this does not activate Manus or broaden provider access.[9] |

NEXORA still accepts only the server-configured HMAC algorithms `HS256`, `HS384`, or `HS512`. Token decoding passes a fixed allowlist derived from trusted server configuration and requires `exp` and `sub`; it never derives the accepted algorithm from attacker-controlled token headers, consistent with PyJWT's documented guidance.[8]

The final lockfile was exported with Poetry's main dependency group only and audited independently. All **39 exported locked runtime dependencies** reported **No known vulnerabilities found**. Development/bootstrap tools are not included in this runtime statement and remain governed by their separate maintenance cadence.

## Migration note

A disposable SQLite upgrade exposed a pre-existing limitation in historical revision `20260801_0002`: it adds a foreign-key constraint through direct `ALTER TABLE`, which SQLite cannot execute. Production uses PostgreSQL. The PostgreSQL chain and the new AI-orchestration upgrade/downgrade SQL generated successfully offline. Historical migration `0002` was not rewritten, avoiding changes to an already-applied production revision.

## Approval boundary

Before production rollout, a human must approve the exact DNS records, Caddy routes, container/image versions, environment-variable names, database backup and migration commands, rollback steps, and external Manus/provider enablement. Secrets must enter only through the existing server-side secret mechanism and must never be committed, logged, returned by the model registry, or sent to n8n/Manus payloads.

## Sources

[1]: [FastAPI 0.141.1 official PyPI metadata](https://pypi.org/pypi/fastapi/0.141.1/json)
[2]: [Starlette official release notes](https://starlette.dev/release-notes/)
[3]: [OSV — PYSEC-2026-161 / CVE-2026-48710](https://osv.dev/vulnerability/PYSEC-2026-161)
[4]: [OSV — PYSEC-2026-1852 / CVE-2026-24486](https://osv.dev/vulnerability/PYSEC-2026-1852)
[5]: [OSV — PYSEC-2026-3036 / CVE-2026-53539](https://osv.dev/vulnerability/PYSEC-2026-3036)
[6]: [Prometheus FastAPI instrumentator official PyPI metadata](https://pypi.org/pypi/prometheus-fastapi-instrumentator/json)
[7]: [PyJWT 2.13.0 official PyPI page](https://pypi.org/project/PyJWT/)
[8]: [PyJWT official API reference](https://pyjwt.readthedocs.io/en/stable/api.html)
[9]: [cryptography 50.0.0 official PyPI metadata](https://pypi.org/pypi/cryptography/50.0.0/json)
