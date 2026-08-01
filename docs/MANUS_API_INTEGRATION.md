# Manus API v2 Integration Runbook

**Status:** Prepared; disabled until a user-owned Manus API key is provisioned
**Date:** 2026-08-01
**Owner:** NEXORA platform administration

## 1. Purpose and boundary

Manus is integrated as an **asynchronous high-level reasoning service** for tasks such as deep research, strategic planning, and complex judgment. It is not a replacement for Ollama, the NEXORA worker, n8n, or deterministic application code. NEXORA remains responsible for identity, policy, budgets, approvals, validation, persistence, and execution.

| Responsibility | NEXORA | Manus |
| --- | --- | --- |
| Decide whether delegation is permitted | Yes | No |
| Select project, profile, connectors, and skills | Yes, from server allowlists | Executes the submitted task |
| Read or write NEXORA databases | Yes, through application code | No direct access |
| Produce complex analysis | May delegate | Yes |
| Confirm email, deploy, purchase, delete, or credential action | Human approval through NEXORA | Must wait |
| Validate and persist structured result | Yes | Produces structured-output envelope |

The integration uses Manus API **v2**, `https://api.manus.ai`, and the `x-manus-api-key` header for the first-party NEXORA server.[1] The key is stored only in the VPS secret environment and never in Git, n8n workflow JSON, browser bundles, logs, prompts, or job payloads.

## 2. Provisioning prerequisites

The adapter can be deployed in disabled mode before credentials are available. Enabling it requires the following values, supplied by the platform owner through the production secret process.

| Variable | Secret | Purpose |
| --- | --- | --- |
| `MANUS_ENABLED` | No | Global kill switch; default `false` |
| `MANUS_API_BASE_URL` | No | Fixed allowlisted origin; default `https://api.manus.ai` |
| `MANUS_API_KEY` | **Yes** | First-party API authentication |
| `MANUS_PROJECT_ID` | No | Dedicated NEXORA Manus project |
| `MANUS_WEBHOOK_PUBLIC_URL` | No | Exact public callback URL used in signature verification |
| `MANUS_ALLOWED_AGENT_PROFILES` | No | Server allowlist, initially `manus-1.6-lite,manus-1.6` |
| `MANUS_DEFAULT_AGENT_PROFILE` | No | Initially `manus-1.6` |
| `MANUS_ALLOWED_CONNECTOR_IDS` | No | Explicit connector allowlist; initially empty |
| `MANUS_ALLOWED_SKILL_IDS` | No | Explicit safe skill allowlist discovered after authentication |
| `MANUS_TIMEOUT_SECONDS` | No | Request timeout for API control-plane calls |
| `MANUS_PUBLIC_KEY_TTL_SECONDS` | No | Public-key cache TTL; initially `3600` |
| `MANUS_WEBHOOK_MAX_AGE_SECONDS` | No | Replay window; fixed at or below `300` |

The current Manus project brain has already been populated with NEXORA's durable policy, architecture, integration audit, and agent-security research. Before a VPS integration is enabled, the API key must be used to verify that `MANUS_PROJECT_ID` resolves to the intended project and that the account can create a private test task.

## 3. Dedicated-project policy

A Manus task must always be associated with the dedicated NEXORA project. The project's instructions define evidence discipline, security boundaries, Roman Bangla communication, and confirmation gates. Project IDs supplied by browsers, n8n, or ordinary API callers are ignored.

| Project control | Required behavior |
| --- | --- |
| Visibility | `private` |
| Default connectors | None unless deliberately reviewed |
| Project instructions | Versioned NEXORA brain policy |
| Shared files | Architecture, integration audit, and security research only; no secrets |
| Task title | Correlation-friendly, non-sensitive title |
| Locale | Server policy; normally `en` for machine output |

The task request supports a project ID, private visibility, an agent profile, and a structured-output schema.[2] NEXORA stores the exact non-secret request policy and a request hash, but not the API key or unrestricted confidential prompt.

## 4. Task creation contract

The router creates a Manus task only after a persisted `ai_run` exists and all policy checks pass. The initial request uses a policy-built prompt, explicit profile, private sharing, the dedicated project, and a strict structured schema.

```json
{
  "message": {
    "content": "<policy-generated task containing only approved fields>",
    "connectors": [],
    "enable_skills": ["<explicit-safe-skill-id>"]
  },
  "project_id": "<MANUS_PROJECT_ID>",
  "locale": "en",
  "interactive_mode": false,
  "share_visibility": "private",
  "agent_profile": "manus-1.6",
  "title": "NEXORA research <short-correlation-id>",
  "structured_output_schema": {
    "type": "object",
    "properties": {
      "summary": {"type": "string"},
      "findings": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "claim": {"type": "string"},
            "evidence": {"type": "string"},
            "source_url": {"type": ["string", "null"]},
            "confidence": {"type": "string", "enum": ["low", "medium", "high"]}
          },
          "required": ["claim", "evidence", "source_url", "confidence"],
          "additionalProperties": false
        }
      },
      "recommended_next_step": {"type": "string"},
      "requires_human_approval": {"type": "boolean"}
    },
    "required": ["summary", "findings", "recommended_next_step", "requires_human_approval"],
    "additionalProperties": false
  }
}
```

Manus Structured Output requires an object root, `additionalProperties: false` on every object, and every property to appear in `required`. Constraints such as `pattern`, `minLength`, `maximum`, and `maxItems` are not supported and must instead be enforced by NEXORA after receipt.[3]

## 5. Connector and skill controls

Connector and skill availability must never be inherited accidentally. Task policy resolves explicit IDs from administrator-approved allowlists. The account's currently enabled skill defaults are not used as an authorization mechanism.

| Mode | Connectors | Skills | Suitable tasks |
| --- | --- | --- | --- |
| `research_readonly` | Explicit read-only search/data connectors only | Explicit research skills | Deep market or product research |
| `planning_no_tools` | None | Explicit reasoning/planning skills | Strategy and architecture |
| `document_analysis` | Approved document source only | Explicit document-analysis skills | User-approved private documents |
| `external_action` | Never directly enabled by unattended automation | None until approval | Separate human-confirmed flow only |

The adapter must call `connector.list` and `skill.list` during administrative configuration, not on every task. Approved IDs are stored as non-secret configuration with a review timestamp. A connector's presence in the Manus account does not automatically authorize NEXORA to use it.

## 6. Lifecycle and state mapping

Manus tasks are asynchronous. NEXORA persists the returned task ID before acknowledging successful delegation. Webhooks provide the normal completion path; polling is a reconciliation mechanism, not the primary worker loop.[4]

| Manus state or event | NEXORA state | Required action |
| --- | --- | --- |
| Task accepted | `delegated` | Persist task ID and request hash |
| `running` | `running_external` | Update safe progress metadata |
| `waiting` + `messageAskUser` | `waiting_input` | Present question to authorized user; use `task.sendMessage` only after input |
| `waiting` + any action type | `waiting_approval` | Create NEXORA approval request; never auto-confirm |
| `stopped` + `finish` | `validating` | Check structured-output `success`, then validate value locally |
| Structured-output failure | `failed_validation` | Retain safe error and require review/retry policy |
| Manus error | `failed_external` | Apply bounded reconciliation or operator review |
| Unknown task or event | No state mutation | Reject and security-log safely |

Manus distinguishes a normal question from an action confirmation. A `messageAskUser` response uses `task.sendMessage`; other waiting events use `task.confirmAction` and the event's returned input schema.[4] NEXORA never passes `global_allow`, `always_allow`, or equivalent broad bypass values.

## 7. Webhook verification

The callback route is the only new Manus-facing public API surface. It is routed through Cloudflare and Caddy to the NEXORA API, with a narrow request-size limit, rate limit, and no browser authentication dependency.

> Manus signs webhook requests with RSA-SHA256. The verifier checks `X-Webhook-Signature`, `X-Webhook-Timestamp`, the externally visible URL, and the SHA-256 digest of the raw request body.[5]

| Verification step | Failure response |
| ---: | --- |
| Require signature and timestamp headers | Generic `400` |
| Parse timestamp and reject age greater than 300 seconds | Generic `401` |
| Compute SHA-256 over the untouched raw body | Generic `401` |
| Reconstruct `{timestamp}.{url}.{body_hash}` | Generic `401` |
| Verify RSA-SHA256 with cached Manus public key | Generic `401` |
| Parse JSON only after signature success | Generic `400` |
| Require known event type and bound task ID | Acknowledge or reject according to replay policy; no mutation |
| Insert event ID/payload hash into unique receipt ledger | Duplicate returns idempotent `200` |
| Process state transition transactionally | `2xx` only after durable receipt |

The public key is fetched from `/v2/webhook.publicKey` using the API key and cached for approximately one hour.[5] A key-refresh retry is allowed once after a signature failure caused by rotation; repeated failure is rejected.

## 8. Approval handling

A Manus waiting event is a request, not authorization. NEXORA creates an approval record bound to the task ID, Manus event ID, waiting event type, normalized input schema, action description, payload digest, requesting user or service, expiry, and risk tier.

| Event class | Default NEXORA response |
| --- | --- |
| Email, calendar, post, publication | Require explicit human confirmation |
| Deployment or terminal execution | Require explicit human confirmation and production permission |
| Secret request | Reject; secrets are provisioned out-of-band |
| Purchase, advertising spend, payment | Require explicit human confirmation; no unattended path |
| Browser connection | Require explicit user action; no automatic local-session selection |
| High-credit notice | Stop and require budget-owner review |

Approval acceptance calls `task.confirmAction` with only the validated input fields for that exact event. Rejection remains a NEXORA terminal state; if the upstream API's `accept: false` does not resolve the Manus wait state, the task may be stopped according to operator policy.[4]

## 9. Idempotency and reconciliation

NEXORA prevents duplicate Manus tasks by creating a unique delegation row before the network call. A stable `delegation_key` is derived from the AI run ID, schema version, project ID, profile, approved connector/skill set, and prompt hash.

| Scenario | Required behavior |
| --- | --- |
| Worker retries before a task ID is returned | Reconcile through the stored request/attempt state; do not create in parallel |
| Task ID returned but database commit fails | Mark uncertain and reconcile via controlled task listing or operator review |
| Duplicate webhook event ID | Return idempotent success without applying state again |
| Different event ID with identical payload hash | Record as duplicate/retry and avoid duplicate mutation |
| Webhook missing beyond reconciliation interval | Poll `task.listMessages` by stored task ID |
| Process restart | Resume from persisted delegation and receipt tables |

Provider task creation and database persistence cannot be made one atomic transaction. The adapter therefore uses an outbox-style state machine and a single active creation attempt per delegation key.

## 10. Budget policy

Manus profiles are selected by server policy, never by n8n or a browser. The lite profile is used for bounded synthesis, standard for normal deep research, and max only for explicitly approved high-value work. Free personal accounts may downgrade requested profiles according to the API specification.[2]

| Control | Initial value |
| --- | ---: |
| Unattended delegated tasks per n8n run | `0` until enabled by an administrator |
| Default delegated tasks per day | `5` |
| Concurrent Manus tasks | `1` |
| Maximum task prompt bytes | `64 KiB` after redaction |
| Default profile | `manus-1.6` |
| `manus-1.6-max` | Disabled until a specific budget is approved |
| Automatic retries after accepted task | `0`; reconcile by task ID |

Usage and quota endpoints may be inspected administratively, but NEXORA must not make commitments about account billing. Platform budgets remain conservative application limits.

## 11. Enablement sequence

The following sequence avoids exposing a public callback before validation is ready.

| Order | Change | Gate |
| ---: | --- | --- |
| 1 | Deploy database migration, disabled adapter, and webhook verifier | Automated tests pass |
| 2 | Provision `MANUS_API_KEY` through the production secret process | Owner supplies credential |
| 3 | Verify API authentication, project ID, skill IDs, and connector IDs | Read-only API checks |
| 4 | Run one private synthetic task with no connectors | Owner approves external call |
| 5 | Validate structured result through polling | No public webhook required |
| 6 | Configure `https://fablebd.com/api/v1/webhooks/manus` | Domain/TLS approval |
| 7 | Register webhook and validate a signed synthetic completion | User confirms webhook creation |
| 8 | Enable `strategic_plan` for manual admin requests | Acceptance tests pass |
| 9 | Enable selected n8n delegation policy | Separate explicit approval and budget |

No production task creation, webhook registration, DNS mutation, or connector enablement occurs before the relevant confirmation gate.

## 12. Rollback

Rollback is immediate because Manus is an additive route. Set `MANUS_ENABLED=false`, disable the Manus policy entries, and leave the historical ledgers intact. Local Ollama routes and deterministic n8n workflows continue operating. Webhook receipt may remain enabled for already-running tasks until they are reconciled, then be disabled at Caddy/API policy level.

| Rollback check | Expected result |
| --- | --- |
| Local chat | Continues through Ollama |
| Product insight schedule | Continues through Ollama |
| New Manus task creation | Blocked before network call |
| Existing delegated tasks | Visible for reconciliation; no new actions confirmed |
| Data migrations | Remain in place; no destructive downgrade required |
| Public services | Caddy remains sole ingress; no agent gateway exposed |

## References

[1]: https://open.manus.ai/docs/v2/authentication "Manus API v2 Authentication"
[2]: https://open.manus.ai/docs/v2/task.create "Manus API v2 task.create"
[3]: https://open.manus.ai/docs/v2/structured-output "Manus Structured Output"
[4]: https://open.manus.ai/docs/v2/task-lifecycle "Manus Task Lifecycle"
[5]: https://open.manus.ai/docs/v2/webhooks-security "Manus Webhook Security"
