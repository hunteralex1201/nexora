# NEXORA Intelligence Requirements Addendum — 2026-08-01

**Status:** Accepted for roadmap reconciliation
**Author:** Manus AI
**Source artifacts:** `/home/ubuntu/upload/pasted_content_2.txt`, `/home/ubuntu/upload/pasted_content_3.txt`, `/home/ubuntu/upload/pasted_content_4.txt`, `/home/ubuntu/upload/pasted_content_5.txt`

## Purpose

This addendum preserves the four supplemental requirement sets supplied during completion of the engineering foundation. It separates requirements that constrain the current phase from substantial future capabilities that must not be rushed into the validated foundation.

> The added material expands NEXORA’s long-term target, but it does not authorize paid services, third-party data access, production deployment, DNS changes, VPS changes, autonomous external actions, or self-modifying production code.

## Current-Phase Constraints

The current Phase 0/Phase 1 completion must remain fully self-hostable and avoid mandatory paid SaaS dependencies. PostgreSQL, Redis, MinIO, Qdrant, n8n, Prometheus, Grafana, Next.js, and FastAPI remain locally deployable through Docker Compose. Optional external integrations must be disabled by default, environment-driven, replaceable behind internal adapters, documented, and introduced only after explicit approval.

The current foundation must continue to separate public observations, verified values, deterministic derivations, estimates, AI-generated output, stale data, and unavailable information. It must not fabricate marketplace sales, customers, revenue, private analytics, credentials, or source access. Local fixtures and isolated test data are the default when external credentials or lawful access are unavailable.

Repository and environment design must treat code, configuration, migrations, dashboards, workflow exports without secrets, scripts, and runbooks as version-controlled assets. Secrets, database dumps, raw collected data, customer or lead data, credential exports, encryption keys, and private backups must remain outside Git.

## Future Operations and Disaster Recovery

A later operations phase must implement reproducible infrastructure, encrypted off-site backups, secret recovery, one-command deployment and restoration, idempotent host bootstrap, safe rollback, and isolated restore drills. The repository alone restores application definitions, not operational data. Recovery requires the repository, a valid encrypted off-site backup, securely supplied secrets, and tested restore automation.

| Future capability | Required direction |
| --- | --- |
| Reproducible host | Ubuntu preparation, Docker and Compose installation, users, directories, firewall, reverse proxy, TLS readiness, health checks, and secure permissions |
| Operational interface | Safe commands for bootstrap, deploy, backup, restore, verify, rollback, and disaster recovery; destructive steps require explicit confirmation |
| Backup domains | PostgreSQL, MinIO, Qdrant, n8n state and encryption key, configured application state, and required secret inventory |
| Backup safety | Encryption, checksums, manifests, retention, off-site storage adapters, failure alerts, and no secrets in source control |
| Restore safety | Isolated validation, compatibility and migration checks, integrity checks, representative data checks, health gates, and no overwrite of live production during drills |
| Recovery targets | Initial configurable targets of one-hour critical-database RPO and approximately sixty-minute normal single-VPS RTO, treated as goals pending measured drills |
| Validation | Shell and Ansible lint, Compose validation, fixture backup, complete isolated restore drill, missing-secret and corrupted-backup failures, and idempotent bootstrap tests |

No production backup provider, VPS, DNS, storage purchase, production deployment, or destructive restore is approved by this addendum.

## Future Native Agent Organization

NEXORA’s long-term agent architecture is a vendor-independent native commerce intelligence organization rather than a dependency on a single external agent framework. One governed brain contract should support multiple agent runtimes, model adapters, tools, skills, and workflow engines while NEXORA retains control of permissions, evidence, memory, scheduling, audit, health, and approvals.

The supplemental requirements identify a chief orchestrator and specialized agents for website discovery, new-store launch detection, marketplace mapping, product discovery, product verification, product matching, pricing, reviews, customer sentiment, competitors, SEO, technology detection, trends, public advertising signals, suppliers, public leads, data quality, source health, criticism, verification, and a final Telegram executive reporter. These agents must run through schedules and queues rather than continuously at maximum capacity.

Every future agent must have typed input and output contracts, explicit permissions, tool and domain allowlists, evidence requirements, memory scope, schedule, health metrics, fixtures, tests, and evaluations. Telegram remains disabled until `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are explicitly configured. Agents must not elevate their own permissions, read unrelated secrets, publish connectors, send bulk outreach, make payments, purchase infrastructure, delete production data, or issue unsupported public claims.

Self-improvement is limited to proposals evaluated offline against versioned datasets. A candidate prompt, rule, skill, or parser must be compared with the current version, reviewed, explicitly approved, versioned, deployed through normal controls, monitored, and reversible. Production code must never be silently rewritten by an agent.

## Long-Term Intelligence and Autonomy

The strategic progression is reliable data and dashboards, deterministic intelligence engines, native multi-agent orchestration, durable and recoverable automation, a governed commerce knowledge model, a commerce digital twin, simulation and causal analysis, and finally narrowly controlled autonomous operations. Simulation output is decision support and must not be marketed as exact prediction.

Future capabilities include a commerce ontology or digital twin, causal hypotheses with confounder and evidence checks, multi-agent market simulation, durable workflow checkpoints, self-healing infrastructure after demonstrated multi-node need, controlled connector repair proposals, experiment preparation with human approval, unified data and AI governance, and outcome measurement. Temporal, Kubernetes, a knowledge graph, and similar complex infrastructure remain deferred until demonstrated workload and reliability requirements justify them.

Autonomy levels remain risk-based: observe, explain, recommend, prepare an action, execute a reversible approved action, and only then consider limited autonomous operation. Payments, bulk outreach, public claims, infrastructure purchases, security changes, and production deletion always require human control.

## Future Product Modules

The long-term modular product vision includes commerce intelligence, a dropshipping operating system, automated sourcing, product opportunity analysis, public lead intelligence, SEO intelligence, marketing planning, AI content preparation, supplier intelligence, inventory intelligence, financial intelligence, a commerce-specific workflow builder, a marketplace connector hub, notifications, a knowledge hub, and an AI studio for governed agents, skills, workflows, and tools.

Each module must reuse shared identity, evidence, trust, source, permission, audit, event, and versioning contracts. External marketplaces, sourcing platforms, advertising networks, messaging channels, payment providers, customs data, and private analytics require source-specific lawful access and cannot be assumed available.

## Phase Mapping

| Requirement group | Earliest appropriate phase | Current disposition |
| --- | --- | --- |
| Self-hosted engineering foundation and optional integrations | Current Phase 0/Phase 1 | Enforced in Compose, environment templates, standards, and operations documentation |
| Connector SDK, registry, queue, workers, fixtures, raw storage | Data-collection core | Deferred until foundation checkpoint passes |
| Generic and Bangladesh connectors | Ingestion and connector phases | Deferred; no source support is claimed |
| Deterministic commerce intelligence and indices | Intelligence phase | Deferred until sufficient trusted historical data exists |
| Native agents, model gateway, skills, governed memory | AI phase | Deferred; current phase implements no agent runtime |
| Scheduled reports, Telegram, approvals, notifications | Automation phase | Deferred and disabled until credentials and approvals exist |
| Full module routes, live SSE, Copilot, advanced product modules | Premium-dashboard and product phases | Deferred; current dashboard is a truthful foundation shell |
| Backup, restore, deployment, reverse proxy, Loki, Uptime Kuma | Operations phase | Requirements recorded; no production action authorized |
| Digital twin, causal analysis, simulation, durable workflow runtime, multi-node self-healing | Post-foundation strategic roadmap | Deferred pending data quality, measured workload, and explicit architecture approval |

## Non-Negotiable Governance

All later implementation must preserve evidence lineage, organization isolation, least privilege, immutable observations, approval boundaries, idempotency, failure containment, reversibility, and truthful unavailable states. New tools or frameworks are adapters, not sources of authority. Untrusted community agents, tools, skills, and packages require static review, permission review, sandboxed evaluation, explicit approval, and version pinning before use.
