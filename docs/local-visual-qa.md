# NEXORA Redesign Visual QA

| Field | Value |
| --- | --- |
| Date | 2026-08-01 |
| Scope | Original dark AI Commerce OS redesign |
| Data source | Existing production workspace through the authenticated server-side proxy |
| Viewports | Desktop 892 × 768; mobile 390 × 844 |

## Acceptance summary

The redesigned application was exercised with real production-backed data rather than static presentation fixtures. Desktop verification covered the executive Overview, live local-Qwen Copilot, and the dense Products evidence workspace. A controlled Chromium harness then loaded every dashboard route at 390 × 844, waited for each route-specific loading state to resolve, measured document width, and captured both viewport and full-page evidence.

All thirteen dashboard routes reached a settled real-data view or an explicit truthful empty/degraded state. The mobile matrix reported a `390 px` document width with **no horizontal overflow** on every route. The open drawer also fits all primary destinations—including Integrations—inside the initial mobile viewport after the final rail-density correction.

| Workspace | Desktop | Mobile settled | Horizontal overflow | Principal acceptance result |
| --- | --- | --- | --- | --- |
| Overview | Passed | Passed | None | Real counts, 14-day evidence flow, execution pulse, runs, alerts, and Copilot handoff remain contained. |
| AI Copilot | Passed | Passed | None | Real Qwen readiness, token streaming, partial-output rendering, Stop, and composer recovery work without sign-in. |
| Sources | Covered by interaction suite | Passed | None | Search, status filtering, add/import, collect, and pause controls preserve truthful source state. |
| Products | Passed | Passed | None | Filters, product record, price trend, provenance, seller, rating, and inspector preserve reading order. |
| Market Intelligence | Covered by interaction suite | Passed | None | Persisted insight, confidence, rationale, evidence, and Copilot handoff remain distinct from verified facts. |
| Agent Operations | Covered by interaction suite | Passed | None | Capability readiness is derived from real prerequisites and jobs, not simulated autonomous activity. |
| Automation | Covered by interaction suite | Passed | None | Source-aware run controls, status filters, persisted run ledger, inspector, and retry behavior remain usable. |
| Workflows | Covered by interaction suite | Passed | None | The two implemented recipes and their real run telemetry remain clear without implying a fictional builder. |
| Alerts | Covered by interaction suite | Passed | None | Rule creation, condition display, event filtering, acknowledgment, and empty inbox states remain operable. |
| Reports | Covered by interaction suite | Passed | None | Persisted summaries, honest no-series fallback, preview, and client-side CSV export remain accessible. |
| Integrations | Covered by interaction suite | Passed | None | Connector registry, source assignments, local model status, and observed n8n evidence remain truthful. |
| System Health | Covered by interaction suite | Passed | None | Liveness, safe dependency diagnostics, measured latency, and degraded states remain legible. |
| Settings | Covered by interaction suite | Passed | None | No-login policy, local model policy, preferences, deterministic reset, and read-only boundaries remain clear. |

## Desktop findings

The executive Overview uses the available desktop width without collisions between its four operational metrics, real activity chart, worker pulse, private-AI surface, recent runs, and latest alerts. Long identifiers and alert text remain constrained, while the fixed rail and sticky command bar remain stable during vertical scrolling.

The three-pane Copilot resolves from its labelled readiness state to the configured Qwen runtime. A suggested Bangla prompt started a real stream, rendered partial model output, exposed a working Stop action, and restored the composer without corrupting the conversation. Full-response production streaming had already been validated before the redesign; the redesign checkpoint specifically reconfirmed the cancellable path.

Products settles into a balanced evidence list and inspector. Search and source/category/availability filters, current and previous price, three-point trend chart, collector, evidence hash, seller, rating, and product link all remain visible and actionable without page overflow.

## Mobile findings

The mobile shell replaces the desktop rail with a compact top bar and accessible drawer. The final 390 × 844 drawer shows Overview, AI Copilot, Sources, Products, Market Intelligence, Agents, Automation, Workflows, Alerts, Reports, Integrations, System Health, and Settings in the initial viewport, while preserving grouped navigation, active state, close control, backdrop, and the local-first/no-sign-in status.

Long workspaces—including Integrations, Agent Operations, Automation, Workflows, Market Intelligence, and Settings—stack their cards and controls in coherent reading order. Desktop tables become touch-friendly records where needed, filters wrap within the viewport, identifiers remain bounded, and action controls remain reachable. The Reports and final Overview targeted captures both recorded `settled: true`, `scroll_width: 390`, and `horizontal_overflow: false`.

## Functional and accessibility evidence

The visual pass is backed by automated interaction contracts for navigation, command search, modal focus containment, Escape focus restoration, Enter-to-product-search routing, source management, product filtering, Qwen streaming, automation, workflows, agents, alerts, reports, integrations, and settings. Automated axe scans cover representative executive, intelligence, operations, monitoring, reporting, integration, and AI workspaces.

The final release gate passed strict ESLint, TypeScript, all frontend Vitest coverage tests, a production Next.js build, Ruff, strict MyPy, and all backend tests with the repository coverage threshold. The mobile drawer correction separately passed the six shell/keyboard/accessibility component tests before recapture.

## Evidence

The reusable capture harness is `scripts/capture_mobile_qa.py`. Settled route metrics are stored in `docs/qa-screenshots/mobile-settled/metrics.json`, with corrected targeted evidence in `metrics-reports.json` and `metrics-overview.json`.

Principal visual artifacts include:

| Evidence | Path |
| --- | --- |
| Final mobile Overview | `docs/qa-screenshots/mobile-settled/overview-full.png` |
| Final mobile drawer | `docs/qa-screenshots/mobile-settled/navigation-drawer.png` |
| Products | `docs/qa-screenshots/mobile-settled/products-full.png` |
| Automation | `docs/qa-screenshots/mobile-settled/jobs-full.png` |
| Integrations | `docs/qa-screenshots/mobile-settled/integrations-full.png` |
| Reports | `docs/qa-screenshots/mobile-settled/reports-full.png` |
| System Health | `docs/qa-screenshots/mobile-settled/system-full.png` |

## Post-deployment checks

The pre-rollout production API does not yet expose the new fourteen-day Overview activity extension or the safe dependency-diagnostics route used by the redesigned System Health workspace. Both changes are included in this release. Production acceptance must therefore reconfirm the activity chart and `/deps` diagnostics after the API container is rebuilt.

> **Decision:** No local visual, responsive, interaction, accessibility, type, lint, test, or build blocker remains for production deployment.
