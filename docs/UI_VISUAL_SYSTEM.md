# NEXORA Premium Visual System

**Status:** Implementation specification
**Prepared:** 2026-08-01
**Scope:** Authenticated workspace, login, public foundation shell, AI Model Control Center, automation and evidence surfaces

NEXORA-r UI direction hobe **quiet intelligence**: premium dark navigation/control surfaces, warm paper-like operational canvas, precise violet-cyan signal accents, ebong evidence/AI interpretation-er clear visual separation. Goal holo flashy “AI dashboard” noy; বরং trustworthy enterprise command center jekhane operator taratari bujhbe kon data measured, kon output AI-generated, kon action pending approval, ebong kon provider/policy ekta run execute koreche.

## Brand system

| Layer | Token intent | Value |
|---|---|---|
| Midnight | Primary navigation, hero, model-control surfaces | `#070B14` |
| Midnight raised | Dark cards and overlays | `#0B1220` / translucent white borders |
| Canvas | Main operational workspace | `#F6F5F1` |
| Paper | Cards and forms | `#FFFFFF` |
| Ink | Primary text | `#252520` |
| Slate | Secondary text | `#6E706F` |
| Signal violet | AI policy, controlled intelligence | `#7C3AED` |
| Signal blue | Active automation and routing | `#2563EB` |
| Signal cyan | Live health and data flow | `#06B6D4` |
| Copper | Human action and commerce accent | `#B85C3D` |
| Emerald | Verified/healthy/measured success | `#16835A` |
| Amber | Pending review/approval | `#A66A13` |
| Red | Failure, policy block, destructive warning | `#B4433A` |

Typography Inter-based thakbe jate existing code o loading behavior preserve hoy. Headline tracking compact; metric number tabular; labels uppercase kora hobe sudhu small system metadata-te. Body copy 14–16 px, operational table 12–13 px, minimum interactive target 40 px.

## Surface hierarchy

| Surface | Visual treatment | Use |
|---|---|---|
| Command rail | Midnight gradient, subtle intelligence-field texture, white/blue states | Primary navigation, environment and health context |
| Canvas | Warm neutral with faint radial signal wash | Main page area |
| Hero intelligence panel | Dark glass, generated intelligence visual, violet/cyan border glow | Overview and AI Control Center only |
| Operational card | White paper, 1 px neutral border, restrained shadow | Metrics, lists, forms, tables |
| Evidence card | Neutral/emerald edge and provenance metadata | Measured facts and source records |
| AI interpretation card | Violet edge, explicit “AI interpretation” badge, execution trace link | Generated summaries and recommendations |
| Approval card | Amber edge, owner/action/deadline, explicit confirm or reject | Sensitive operations |
| Failure card | Red edge, retry class and correlation ID | Provider, worker, webhook and automation failures |

## Generated reusable assets

| File | Purpose | Rules |
|---|---|---|
| `/visuals/nexora-intelligence-field.webp` | Overview/authentication hero background and command-rail atmospheric layer | Always place behind a dark overlay; keep left-side text safe area; decorative `aria-hidden` background only. |
| `/visuals/nexora-agent-orb.webp` | AI Model Control Center feature panel | Crop with `object-position: 68% 50%`; never use as factual architecture diagram; no text embedded. |

Dui asset-i source PNG theke optimized WebP-e convert kora; final payload approximately 110 KB and 150 KB. Egulo decorative visual, measured system state noy.

## Reusable component set

| Component | Responsibility |
|---|---|
| `WorkspaceShell` | Responsive rail, mobile drawer, sticky command header, environment indicator |
| `PageHeader` | Eyebrow, title, description, action cluster, optional status context |
| `IntelligenceHero` | Premium dark panel, live state, generated visual, top-level CTA |
| `MetricCard` | Label, value, trend/detail, semantic tone and optional icon |
| `SectionCard` | Standard header/body/footer and density variants |
| `StatusBadge` | Semantic status mapping; never rely on color alone |
| `TraceChip` | Correlation/execution ID, provider, policy version and copy action |
| `EvidenceBadge` | “Measured evidence” versus “AI interpretation” distinction |
| `ProviderCard` | Provider availability, data-class capability, model count and execution mode |
| `RoutingPolicyCard` | Task class, candidate chain, fallback and budget |
| `ApprovalCard` | Human gate with explicit risky action summary |
| `EmptyState` | Specific next action; use visuals only when useful |
| `LoadingState` | Skeletons shaped like final content; avoid large generic spinner |
| `ErrorState` | Actionable recovery, safe diagnostic ID, no secret/internal payload |

## Workspace information architecture

Sidebar-er primary group hobe **Command** (`Overview`, `AI Control`, `Automation`, `Alerts`), tarpor **Intelligence** (`Products`, `Sources`, future Sourcing/Leads route), ebong bottom group **Platform** (`System health`, `Settings`). Existing routes preserve korte hobe; missing/unimplemented route sidebar-e show kora jabe na.

Header-e current page, live/private environment, provider health summary, ebong operator profile thakbe. System health o sign-out bottom rail-e thakbe. Mobile drawer semantics, focus trap/overlay behavior ebong 320 px minimum width preserve korte hobe.

## AI Model Control Center

AI page-ke existing insight form theke broader operator control center-e elevate kora hobe. Top panel-e three execution paths dekhabe:

| Path | Position | Operator meaning |
|---|---|---|
| Ollama | Default / private | Local, low-cost, restricted-data capable |
| Cloud model adapter | Controlled fallback | Disabled by default unless server allowlist, key, budget and data class permit |
| Manus | Asynchronous specialist | Research/planning/judgment; private task, structured output, signed webhook, explicit approval states |

UI sudhu server `/model-registry` response use korbe; client kon provider/model choose ba invent korbe na. Route hint optional holeo final decision server-side. Credentials, base URLs, internal service names, raw prompts, cookies o restricted payload konodin render hobe na.

## Motion and interaction

Motion 150–220 ms-er moddhe; opacity, transform, border o shadow-e limited. Live state-e slow restrained pulse allowed. Charts, counters ba gradients attention-grabbing continuous animation use korbe na. `prefers-reduced-motion` existing global behavior preserve korbe. Hover-e content position shift kora jabe na; active press 1 px translation existing behavior maintain kora jay.

## Accessibility and trust rules

Contrast WCAG AA meet korte hobe. Focus ring visible; keyboard navigation complete; icon-only button-e accessible name mandatory. Status color-er sathe text/icon thakbe. Generated visuals decorative; alt text diye system fact imply kora jabe na. “Measured evidence”, “AI interpretation”, “Estimated”, “Pending approval” ebong “Policy blocked” textually explicit thakbe.

## Acceptance criteria

1. Existing route, form label, button name, request path, authentication and test contract preserve hobe.
2. 320 px theke 1480 px porjonto overflow chara responsive hobe.
3. Core dashboard first view-e system state, AI routing state, pending attention and primary action clear hobe.
4. Provider/model selection always server registry/allowlist theke asbe.
5. No secret, prompt, provider key, internal URL or restricted field UI payload-e expose hobe na.
6. New visual assets total first-load cost bounded thakbe; generated images lazy/priority context onujayi load hobe.
7. Lint, type-check, unit/integration tests and production build pass korte hobe.
