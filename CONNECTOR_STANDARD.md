# NEXORA Intelligence Connector Standard

**Status:** Approved foundation standard
**Applies from:** Master-plan Phase 1 / repository-roadmap Phase 0
**Owner:** NEXORA Intelligence engineering

## Purpose and Scope

This standard defines the contract, safety boundaries, lifecycle, evidence requirements, and test gates for every NEXORA data connector. It complements the architectural intent in `CONNECTORS.md`; it does not authorize collection from any named source. A connector may run only after its target is classified, its public-access basis is documented, and its implementation passes the tests required here.

> A connector is a versioned adapter for a specifically approved public data source. It is not permission to bypass authentication, CAPTCHA, rate limits, robots restrictions, paywalls, access controls, or source terms.

No live connector is implemented in the engineering-foundation phase. The first future implementations must follow the approved order: generic sitemap discovery, generic JSON-LD, generic Shopify, generic WooCommerce, Bangladesh fixtures, and then individually reviewed Bangladesh sources.

## Capability and Access States

Every registered target must expose one primary capability state. A change in access conditions must update the state before further jobs are scheduled.

| State | Meaning | Scheduler behavior |
| --- | --- | --- |
| `API` | An approved public or credentialed API is available. | Use only the documented API contract and configured credentials. |
| `FEED` | A public feed such as RSS, Atom, CSV, or XML is available. | Poll according to the declared freshness and rate policy. |
| `STRUCTURED_HTML` | Public HTML exposes stable structured data. | Prefer deterministic HTTP collection and structured parsing. |
| `BROWSER_RENDERED` | Public content requires browser rendering. | Route only through the isolated browser worker and its security policy. |
| `MANUAL_IMPORT` | Data is supplied by an authorized operator. | Disable automated collection and validate the imported artifact. |
| `UNSUPPORTED` | The source cannot be collected reliably or safely. | Do not schedule jobs. |
| `TEMPORARILY_BLOCKED` | A previously supported method is currently failing or restricted. | Pause automatically and require a health review. |
| `PERMISSION_REQUIRED` | Access requires explicit source or legal approval. | Do not schedule until approval evidence is recorded. |

## Required Connector Contract

Each connector package must provide immutable metadata and deterministic behavior. Language-specific interfaces may differ, but the following contract is mandatory.

| Contract area | Required behavior |
| --- | --- |
| Metadata | Provide connector ID, source type, country, marketplace, owner, semantic version, parser version, status, and supported capability states. |
| Domain policy | Declare exact allowed domains and subdomains; reject every destination outside that set. |
| Discovery | Produce normalized target references without fetching unapproved domains. |
| Parsing | Implement category, listing, product, and pagination parsing only where supported; unsupported fields remain explicit. |
| Validation | Validate source identity, required fields, data types, bounds, currency, timestamps, and trust classification. |
| Fingerprinting | Produce a stable content or entity fingerprint for duplicate prevention and idempotency. |
| Normalization | Map source fields into versioned internal contracts without discarding the raw artifact. |
| Health | Expose deterministic success, degraded, blocked, unsupported, and permission-required outcomes. |
| Rate policy | Declare request rate, concurrency, crawl delay, timeout, response-size limit, and freshness target per domain. |
| Retry policy | Retry only transient failures with bounded exponential backoff and jitter; never retry access denials aggressively. |
| Versioning | Increment parser or connector versions when output behavior changes and retain the version on every artifact. |

## Collection Artifact Envelope

Raw source material must be stored before normalization when future storage integration is active. Every collected artifact and normalized record must preserve the following provenance fields.

| Field group | Required fields |
| --- | --- |
| Identity | `job_id`, `attempt_id`, `connector_id`, `connector_version`, `parser_version`, `source_id`, `target_id` |
| Origin | Original URL, final approved URL, country, marketplace, HTTP status, content type |
| Time | Collection timestamp, source timestamp when present, generated timestamp, expiry timestamp where applicable |
| Integrity | Content hash, fingerprint, response size, storage key, retention class, access classification |
| Traceability | Request ID, correlation ID, worker ID, parent job ID where applicable |
| Trust | Classification, evidence count, source count, confidence, validation result, and reason |

The raw artifact is immutable. Reprocessing creates a new normalized version; it does not alter historical source observations.

## Data Trust Rules

Connector output must use exactly one classification from `VERIFIED`, `DERIVED`, `ESTIMATED`, `AI_GENERATED`, `STALE`, or `UNAVAILABLE`. A connector may mark a directly observed public value as `VERIFIED` only when the raw artifact and field location are preserved. Transformations are `DERIVED`; inferred values are `ESTIMATED`; model output is `AI_GENERATED`. Missing fields remain `UNAVAILABLE`, and expired observations become `STALE` without deleting history.

Connectors must not convert rankings, review counts, stock labels, badges, or other indirect signals into exact sales figures. Any later intelligence must retain links to the source artifacts used in its calculation.

## Safety and Failure Containment

HTTP and browser connectors must reject non-HTTP protocols, localhost, private and link-local IP ranges, credential-bearing URLs, redirects outside the domain allowlist, oversized responses, and navigation beyond the configured timeout. Browser contexts must be isolated between unrelated jobs, downloads must be restricted, and cookies must be cleared. CAPTCHA or authentication challenges produce a blocked or permission-required outcome; they are never bypassed.

A connector failure must remain isolated to its job and source. The worker records a typed failure, preserves safe diagnostics, applies the bounded retry policy, and routes exhausted work to a dead-letter path. One broken connector must never stop unrelated workers or corrupt previously stored records.

## Test and Review Gate

A connector cannot enter an enabled registry state until every required gate passes.

| Gate | Required evidence |
| --- | --- |
| Fixtures | Recorded, sanitized fixtures for normal, missing-field, malformed, empty, and changed-layout cases; no normal CI test depends on a live website. |
| Parser tests | Deterministic assertions for supported fields, unsupported fields, normalization, classification, and version stamping. |
| Safety tests | Domain allowlist, redirect rejection, SSRF ranges, timeout, response-size, and protocol validation. |
| Reliability tests | Duplicate prevention, idempotency, retry boundaries, cancellation, and failure isolation. |
| Compliance review | Public-access basis, terms/robots review date, rate policy, contact or approval evidence where required, and prohibited behavior. |
| Operational review | Health behavior, metrics, logs, freshness policy, rollback path, owner, and support status. |

## Registry Lifecycle

Registry status moves through `DRAFT`, `REVIEW`, `FIXTURE_ONLY`, `ENABLED`, `DEGRADED`, `PAUSED`, `BLOCKED`, and `RETIRED`. Promotion requires evidence from the test and review gate. Automatic health logic may demote an enabled connector to degraded or paused, but re-enablement after an access or compliance failure requires operator review.

The registry must expose connector version, parser version, capability state, supported and unsupported fields, freshness policy, last fixture-test result, last health result, and compliance review date. Credentials, session cookies, and private source information must never appear in registry responses or logs.

## Foundation-Phase Boundary

This phase establishes the standard only. It does not create marketplace parsers, run browser automation, collect third-party content, or claim source support. The next approved data-collection phase must create the connector SDK and registry against this standard before any source-specific connector is enabled.
