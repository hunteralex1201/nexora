# NEXORA Intelligence Data Trust Standard

**Status:** Approved foundation standard
**Applies from:** Master-plan Phase 1 / repository-roadmap Phase 0
**Owner:** NEXORA Intelligence engineering

## Purpose

NEXORA Intelligence must make the origin and reliability of every metric, chart, finding, recommendation, forecast, and AI statement visible. This standard defines the mandatory classification, provenance, confidence, freshness, evidence, versioning, and presentation rules. It applies to ingestion, normalized records, intelligence engines, reports, alerts, APIs, exports, and user interfaces.

> Evidence is a prerequisite for a claim, not a decoration added after generation. AI output must never manufacture, conceal, or substitute for source evidence.

The engineering-foundation phase establishes this contract without presenting fabricated commerce data. Foundation dashboard cards therefore display configuration or availability states rather than invented marketplace metrics.

## Trust Classifications

Every value or statement must have exactly one primary classification. Applications must preserve the uppercase enum values across storage, APIs, reports, and events.

| Classification | Meaning | Minimum evidence | Presentation rule |
| --- | --- | --- | --- |
| `VERIFIED` | Directly observed from an approved source and retained in an immutable source artifact. | Source reference, artifact hash or storage key, collection time, field location, parser version | May be presented as observed; include source and freshness. |
| `DERIVED` | Deterministically calculated from one or more verified or otherwise classified inputs. | Input references, formula or transformation version, calculation time | Label as derived and expose the calculation explanation. |
| `ESTIMATED` | Inferred statistically or heuristically where direct observation is unavailable. | Input references, method version, assumptions, uncertainty, confidence | Visually separate from verified values and disclose assumptions. |
| `AI_GENERATED` | Produced or materially transformed by a model. | Evidence references, provider and model, prompt version, generation time, result status | Label as AI-generated; show uncertainty and prohibit unsupported claims. |
| `STALE` | Previously classified information that has exceeded its freshness policy. | Original provenance, last successful observation, expiry or freshness rule | Preserve the prior classification as metadata but visibly warn that the value is stale. |
| `UNAVAILABLE` | A required value or claim cannot be supported. | Reason code and last attempted observation where applicable | Show unavailable; never replace it with zero, a guess, or demo data. |

A record may retain secondary metadata such as `original_classification=VERIFIED` after becoming `STALE`, but its current primary classification must be `STALE`. An intelligence output cannot have a stronger trust state than its evidence and method support.

## Mandatory Provenance Envelope

Every intelligence-bearing record must include the fields below or an explicit not-applicable reason defined by its versioned contract.

| Dimension | Required fields |
| --- | --- |
| Identity | Record ID, entity type, entity ID, organization or public scope, country, marketplace where relevant |
| Evidence | Source references, source count, evidence references, evidence count, source artifact hashes or storage keys |
| Trust | Classification, confidence score, explanation or reason, data-availability warnings |
| Freshness | Source timestamps, collected timestamp, generated timestamp, freshness timestamp, expiry timestamp where applicable |
| Reproducibility | Calculation version, parser version, connector version, schema version, input hash |
| AI metadata | Provider, model, prompt version, output hash, latency, token use and estimated cost when AI is used |
| Traceability | Request ID, correlation ID, job ID, connector ID, source ID, agent run ID or workflow run ID where applicable |

Counts must reflect distinct retained references rather than repeated mentions. Provenance identifiers must remain stable enough to retrieve the supporting record subject to access control and retention policy.

## Evidence Rules

Evidence must be attributable, immutable, and relevant to the claim. A source URL alone is insufficient when the referenced content can change; the collection system must retain the raw artifact or a permitted immutable representation with an integrity hash. Evidence snippets must not remove qualifying context, and inaccessible or deleted evidence changes dependent outputs to stale or unavailable according to policy.

A claim may aggregate multiple sources, but the system must record which evidence supports which part of the claim. Contradictory evidence is not silently discarded. The result must identify the conflict, lower confidence where appropriate, and explain why a deterministic rule or analyst decision selected an outcome.

Exact sales, revenue, order, customer, or market-share values may be marked verified only when the approved public source directly exposes that exact value. Rankings, review volume, stock labels, advertising badges, or page position are signals and must not be converted into exact sales claims.

## Confidence

Confidence is a bounded decimal from `0.00` to `1.00` and represents support quality for the specific result, not a generic model score. The calculation must be versioned and explainable. At minimum, it considers source reliability, source agreement, evidence coverage, parser validation, freshness, and method uncertainty.

| Confidence band | Interpretation | Required behavior |
| --- | --- | --- |
| `0.90–1.00` | Strong support under the declared method | Still display classification, evidence, and freshness; do not imply certainty. |
| `0.70–0.89` | Useful support with identifiable limitations | Display the leading limitation alongside the result. |
| `0.40–0.69` | Material uncertainty | Prominently warn and restrict automated recommendations. |
| `0.00–0.39` | Weak or insufficient support | Do not present as a decision-ready finding; prefer unavailable where the claim cannot be defended. |

Confidence must not be inflated because multiple records repeat the same upstream source. Missing coverage, stale evidence, parser failures, contradictory sources, and estimated inputs must apply explicit penalties.

## Freshness and Staleness

Each source and result type must declare a versioned freshness policy. The policy includes expected observation interval, maximum acceptable age, expiry behavior, and the action taken after failed refresh attempts. A failed collection does not erase the last successful observation; it records a new failure and may cause the prior value to become stale.

User interfaces and exports must show the relevant source or generation timestamp and must distinguish “last observed,” “last checked,” and “generated.” Relative labels such as “recent” cannot replace a timestamp. Real-time labels are permitted only for official streams or webhooks with monitored delivery health.

## Deterministic and AI Processing

Deterministic calculation precedes AI explanation wherever practical. AI may summarize or explain retained evidence, but it cannot upgrade an estimated or unavailable fact to verified. Retrieval must filter by organization, access scope, entity, classification, and freshness before evidence is supplied to a model.

AI-generated records must preserve model and prompt metadata, input and output hashes, latency, result status, and evidence links. Model text that lacks sufficient evidence is rejected or returned with an unavailable classification and a clear reason. Human approval remains mandatory before any externally consequential future action.

## Storage and Historical Integrity

Raw artifacts and marketplace observations are immutable. New collections create new snapshots, and corrections create versioned records with links to superseded data. Normalization must not overwrite the original source representation. Retention, deletion, and legal-hold behavior must be recorded separately from analytical state.

Database constraints and application validation should enforce enum values, bounded confidence, nonnegative evidence counts, timestamps, and version identifiers. Event payloads and exports must preserve the trust envelope rather than flattening away provenance.

## API and User-Interface Presentation

Verified and estimated information must never be visually merged without explicit labels. Charts must identify gaps, stale periods, and mixed classifications. Tooltips, detail drawers, reports, and exports must expose classification, confidence, freshness, calculation version, and evidence access. A dashboard card with unavailable data displays an unavailable state rather than a fabricated number.

| State | Required user-facing treatment |
| --- | --- |
| Live verified data | Classification, source count, timestamp, and evidence access |
| Derived metric | Derived label, formula version, inputs, timestamp, and confidence |
| Estimate or forecast | Estimate label, interval or uncertainty, assumptions, and method version |
| AI explanation | AI-generated label, supporting evidence, model metadata at an appropriate detail level, and uncertainty |
| Stale data | Prominent stale warning, last successful observation, and refresh status |
| Unavailable data | Neutral unavailable state and a safe reason without invented replacement data |
| Demo or fixture data | Persistent demo label and strict isolation from production records and exports |

## Validation and Audit Gate

Automated tests must cover classification enums, provenance completeness, confidence bounds, staleness transitions, version stamping, evidence linkage, and the separation of demo fixtures from live records. Intelligence-engine tests must reproduce deterministic outputs from fixed inputs. AI evaluations must include unsupported-claim and missing-evidence cases.

Auditable changes include parser upgrades, formula changes, confidence-policy changes, model or prompt changes, analyst overrides, and classification changes. Logs and audit records must identify the actor or process, previous and new states, timestamp, reason, and correlation ID without exposing secrets or restricted source content.

## Governance

Changes to this standard require architecture, data, security, and product review because they affect how claims are interpreted throughout NEXORA. New classifications or confidence methods must be versioned and accompanied by migration, compatibility, test, and presentation plans. Product pressure must never justify hiding weak coverage or relabeling unsupported information.
