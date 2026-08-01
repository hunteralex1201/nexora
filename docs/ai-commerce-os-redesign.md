# NEXORA AI Commerce OS — frontend redesign architecture

## Product principle

The redesign will treat the supplied dashboard as a benchmark for **density, hierarchy, and operational confidence**, not as a layout to clone. NEXORA will remain an evidence-driven commerce intelligence workspace whose UI only claims capabilities supported by the existing FastAPI, PostgreSQL, Redis, worker, n8n, Ollama, source connectors, and product-observation data.

> Every visible metric, status, chart, workflow, agent, and integration must resolve to a live endpoint, a persisted record, a bundled workflow definition, or an explicitly labeled unavailable/configuration state.

## Visual language

The interface will use a near-black navy canvas with a slightly lighter navigation rail, matte layered panels, crisp one-pixel borders, restrained spectral highlights, and compact editorial typography. Accent color is assigned semantically rather than decoratively: blue for primary navigation and information, violet for local AI, orange for collection/source activity, emerald for healthy/successful states, amber for warnings, and red only for destructive or failed states.

| Token | Planned value | Purpose |
| --- | --- | --- |
| `--canvas` | `#060912` | Application background |
| `--sidebar` | `#080d18` | Navigation surface |
| `--surface-1` | `#0b1120` | Primary panels |
| `--surface-2` | `#0e1628` | Raised/interactive panels |
| `--surface-3` | `#121d32` | Selected and focused surfaces |
| `--border` | `rgba(148, 163, 184, 0.14)` | Default micro-border |
| `--border-strong` | `rgba(148, 163, 184, 0.25)` | Hover/focus divider |
| `--text` | `#f5f7fb` | Primary copy |
| `--muted` | `#9aa8bd` | Secondary copy |
| `--faint` | `#64748b` | Metadata and tertiary labels |
| `--blue` | `#5b8cff` | Primary and navigation |
| `--violet` | `#9b7bff` | AI states |
| `--orange` | `#f59e5b` | Source/collection activity |
| `--emerald` | `#34d399` | Success and healthy states |
| `--amber` | `#fbbf24` | Warning/queued states |
| `--red` | `#fb7185` | Failure/destructive states |

Panels will default to 14–16 px radii, but tables, list rows, and nested sections will use smaller radii or square dividers to avoid the “rounded card everywhere” problem. Shadows will be limited to floating overlays, the mobile drawer, the command palette, and important active controls. Ambient gradients will be low-opacity and confined to the overview hero and AI workspace.

## Typography and density

The current system font stack will remain to avoid external font loading and preserve deployment reliability. Headings will use tight tracking and calibrated weights, while labels and metadata will use 11–13 px sizes with generous contrast. The default application density will prioritize professional information throughput: 56 px desktop topbar, 244 px expanded sidebar, 76 px collapsed sidebar, 44 px controls, and 12–20 px internal spacing depending on hierarchy.

## Application shell

The shell will be rebuilt around four functional zones: a collapsible desktop navigation rail, a mobile drawer, a sticky global command/search bar, and a responsive content viewport. The rail state will persist locally and will never affect server data. Navigation groups will expose only implemented routes.

| Group | Route | Grounded purpose |
| --- | --- | --- |
| Core | `/overview` | Real executive metrics and operational activity |
| Core | `/ai` | Live local Qwen Copilot chat |
| Intelligence | `/sources` | Source connector management and imports |
| Intelligence | `/products` | Product catalogue and observation history |
| Intelligence | `/market` | Evidence-bound market signals and AI insights |
| Operations | `/agents` | Worker-backed collection and analysis agents |
| Operations | `/jobs` | Job queue, retries, and run diagnostics |
| Operations | `/workflows` | Two bundled n8n schedules and run-now actions |
| Control | `/alerts` | Alert rules and event acknowledgement |
| Control | `/reports` | Real exportable operational and insight summaries |
| Platform | `/integrations` | Actual connector registry and local platform services |
| Platform | `/system` | Live safe health and model readiness |
| Platform | `/settings` | Local workspace presentation preferences |

The topbar search will be functional. Pressing `Ctrl/⌘ + K` opens a command palette containing navigation, quick actions, and product search. Submitting a free-text query routes to `/products?q=<query>`. The bell routes to real alerts; the AI action routes to Copilot; the health indicator routes to System. No account menu or login affordance will be displayed because the workspace intentionally has no user login requirement.

## Shared component architecture

The redesign will centralize primitives instead of repeating long Tailwind color strings. `globals.css` will own semantic tokens and interaction classes. React primitives will cover status badges, metric cards, panels, empty/loading/error states, data rows, segmented filters, drawers/dialogs, sparklines, and charts. The existing tested components will be refactored progressively so their state and mutations remain intact.

| Component | Responsibility |
| --- | --- |
| `AppShell` | Responsive rail, topbar, route hierarchy, keyboard navigation |
| `CommandPalette` | `Ctrl/⌘K`, route actions, product-search handoff, focus trap, Escape close |
| `WorkspaceStatus` | Real overview/AI health indicators without fabricated uptime |
| `PageHeader` | Eyebrow, title, description, contextual actions, compact responsive wrapping |
| Commerce primitives | Panels, badges, buttons, inputs, metrics, state surfaces, list/table shells |
| Chart primitives | Recharts wrappers using only live endpoint data and accessible summaries |
| `QuickAIComposer` | Overview prompt handoff into `/ai` without claiming persistence |

## Real-data architecture

Existing endpoint contracts will be preserved. The overview endpoint may be extended in a backward-compatible way with calculated operational series needed for charts. New fields will be derived from persisted records rather than seeded demonstration values.

| UI module | Source of truth | Allowed derivation |
| --- | --- | --- |
| Source health | `Source` records | Active/paused counts and latest update |
| Product intelligence | `Product` and latest two observations | Price-up/down/stable counts, availability split |
| Activity chart | `ProductObservation`, `CrawlJob`, `AlertEvent` timestamps | Daily counts for a fixed recent window |
| Agent operations | `CrawlJob.job_type/status/metrics` | Running/queued/success/failure mix and latest heartbeat |
| AI status | `/commerce/ai/readiness` | Ready/degraded and installed expected model names |
| AI insight feed | `/commerce/ai/insights` | Evidence-bound latest recommendations |
| Workflows | Bundled n8n workflow definitions plus job records | Schedule labels, supported job mapping, run history |
| Platform health | Existing readiness plus safe short-timeout probes | Healthy/degraded/unavailable only; no host or secret disclosure |
| Reports | Live product/job/alert/insight responses | Browser-generated CSV or JSON download with timestamp |

Revenue, lead totals, opportunity totals, website traffic, social messaging channels, OpenClaw status, external model quotas, and third-party API keys will not appear as active metrics because the application has no such source of truth.

## Route-level interaction plan

### Overview

The page will use a compact hero header, live-state indicator, four evidence-backed metric cards, a real activity chart, an operational-status panel, recent jobs, open alerts, recent AI insight, and a compact Copilot prompt. It will adapt naturally when the dataset is sparse and will show explanatory empty states instead of empty decorative charts.

### AI Copilot

The current streaming state machine will remain unchanged. The redesign will add a compact model-status rail, better message typography, context suggestions grounded in supported tasks, visible privacy/non-persistence language, improved Stop and New chat controls, and resilient mobile composer behavior.

### Sources, Products, and Market Intelligence

Sources will keep create/import/collect/pause operations and present connector capability details more clearly. Products will use a responsive master-detail structure with retained search, readable price signals, and an accessible history chart. Market Intelligence will combine current products and evidence-bound AI insights, with source/product filters and direct links back to the underlying evidence.

### Agents, Automation, and Workflows

“Agents” will represent the two real execution roles: Product Collection and Evidence AI Analysis. Agent state will be derived from jobs, worker heartbeat timestamps, source activity, and AI readiness. Automation will remain the detailed job queue. Workflows will represent only the two imported n8n schedules, allow safe run-now actions through the existing job endpoint, and show real recent runs.

### Alerts, Reports, Integrations, and System

Alerts will preserve rule creation and acknowledgement. Reports will support real client-side exports and concise data summaries. Integrations will show implemented connectors from `/commerce/connectors`, connected sources, Ollama readiness, and n8n/workflow availability; unsupported external providers will not be listed as connected. System will combine core dependency readiness, local-model readiness, job/worker freshness, and safe infrastructure status.

## Responsive behavior

Desktop widths at and above 1280 px use the expanded rail and dense two- or three-column dashboard. Tablet widths use a collapsed rail and two-column content. Mobile widths use a drawer, single-column content, horizontally scrollable segmented controls where unavoidable, sticky primary actions, and list-first detail drilldowns. Charts will reduce annotation density rather than overflow. All controls will maintain at least a 40–44 px interactive target where feasible.

## Accessibility and keyboard rules

The existing skip link will remain. Every icon-only action will have an accessible name. Dialogs and the command palette will restore focus and close on Escape. Active navigation will use `aria-current`. Loading and mutation results will use appropriate live regions. Color will never be the sole status indicator. Focus rings will use the blue accent at a contrast visible on every surface. Motion will honor `prefers-reduced-motion`, and no continuously animated decorative element will be required to understand status.

## Implementation sequence

The code will be changed in vertical slices: first global tokens and the shell, then overview, AI, intelligence workspaces, operations workspaces, control/platform screens, and finally cross-cutting state/accessibility polish. Existing tests will be updated only where labels or structure intentionally change, while preserving behavioral assertions. Additional tests will cover the command palette, query handoff, new routes, exports, and truthful data fallbacks. Production deployment will occur only after lint, typecheck, unit/component tests, build, local visual inspection, and regression verification succeed.
