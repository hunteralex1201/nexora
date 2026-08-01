import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  Gauge,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = { title: 'System Health' };
export const dynamic = 'force-dynamic';

interface LivenessResponse {
  status: 'healthy';
  service: string;
  version: string;
  request_id: string;
}

interface DependencyResult {
  required: boolean;
  status: 'healthy' | 'unhealthy';
  latency_ms: number;
}

interface DependencyResponse {
  status: 'healthy' | 'degraded';
  request_id: string;
  dependencies: Record<string, DependencyResult>;
}

function apiBase() {
  return (
    process.env.INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:8000/api/v1'
  ).replace(/\/$/, '');
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${apiBase()}${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4_000),
    });
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

const dependencyPresentation: Record<string, { label: string; description: string; icon: typeof Database }> = {
  database: { label: 'PostgreSQL database', description: 'Persists sources, products, observations, jobs, alerts, and AI insights.', icon: Database },
  redis: { label: 'Redis job queue', description: 'Coordinates queued automation work and worker execution.', icon: Activity },
};

export default async function SystemPage() {
  const [liveness, dependencies] = await Promise.all([
    getJson<LivenessResponse>('/health'),
    getJson<DependencyResponse>('/deps'),
  ]);
  const dependencyEntries = Object.entries(dependencies?.dependencies ?? {});
  const healthyDependencies = dependencyEntries.filter(([, item]) => item.status === 'healthy').length;
  const overallHealthy = liveness?.status === 'healthy' && dependencies?.status === 'healthy';
  const slowestLatency = dependencyEntries.length
    ? Math.max(...dependencyEntries.map(([, item]) => item.latency_ms))
    : null;

  return (
    <div>
      <PageHeader
        eyebrow="Live safe diagnostics"
        title="System Health"
        description="Inspect API liveness and required dependency probes. NEXORA intentionally does not invent uptime, CPU, memory, or storage telemetry."
        actions={
          <a href="/system" className="nx-button-secondary">
            <RefreshCw className="size-4" aria-hidden="true" /> Run check
          </a>
        }
      />

      <div className={`mt-5 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${overallHealthy ? 'border-[var(--emerald)]/20 bg-[var(--emerald)]/[0.055]' : 'border-[var(--amber)]/20 bg-[var(--amber)]/[0.055]'}`}>
        <div className="flex items-start gap-3">
          <span className={`grid size-10 shrink-0 place-items-center rounded-xl border ${overallHealthy ? 'border-[var(--emerald)]/20 bg-[var(--emerald)]/[0.08] text-[var(--emerald)]' : 'border-[var(--amber)]/20 bg-[var(--amber)]/[0.08] text-[var(--amber)]'}`}>
            {overallHealthy ? <CheckCircle2 className="size-[18px]" aria-hidden="true" /> : <CircleAlert className="size-[18px]" aria-hidden="true" />}
          </span>
          <div><p className="text-[12px] font-semibold text-[var(--text)]">{overallHealthy ? 'Core services operational' : 'Service check needs attention'}</p><p className="mt-1 text-[9px] leading-4 text-[var(--muted)]">{overallHealthy ? 'The API and every required dependency passed this live probe.' : 'At least one required response was unavailable or reported degraded.'}</p></div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]"><span className={`size-1.5 rounded-full ${overallHealthy ? 'status-pulse bg-[var(--emerald)]' : 'bg-[var(--amber)]'}`} />Live request</span>
      </div>

      <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="System health metrics">
        {[
          { label: 'API liveness', value: liveness ? 'Healthy' : 'Unavailable', icon: ServerCog, tone: liveness ? 'text-[var(--emerald)]' : 'text-[var(--red)]' },
          { label: 'Dependencies', value: `${healthyDependencies}/${dependencyEntries.length}`, icon: ShieldCheck, tone: 'text-[var(--blue)]' },
          { label: 'Slowest probe', value: slowestLatency === null ? '—' : `${slowestLatency.toFixed(2)} ms`, icon: Gauge, tone: 'text-[var(--amber)]' },
          { label: 'API version', value: liveness?.version ?? '—', icon: Clock3, tone: 'text-[var(--violet)]' },
        ].map((metric) => {
          const Icon = metric.icon;
          return <article key={metric.label} className="nx-panel flex items-center gap-3 p-3.5 sm:p-4"><span className={`grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] ${metric.tone}`}><Icon className="size-4" aria-hidden="true" /></span><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[0.11em] text-[var(--faint)]">{metric.label}</p><p className="mt-1 truncate text-[16px] font-semibold tracking-[-0.03em] text-[var(--text)]">{metric.value}</p></div></article>;
        })}
      </section>

      <section className="nx-panel mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5 sm:px-5"><div><p className="nx-kicker">Core runtime</p><h2 className="mt-1.5 text-[12px] font-semibold text-[var(--text)]">Required service probes</h2></div><span className="text-[8px] text-[var(--faint)]">Safe diagnostics only</span></div>
        <div className="divide-y divide-white/[0.065]">
          <article className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-5">
            <div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-[var(--blue)]"><ServerCog className="size-4" aria-hidden="true" /></span><div><h3 className="text-[11px] font-semibold text-[var(--text)]">NEXORA API</h3><p className="mt-1 text-[8px] text-[var(--faint)]">Liveness endpoint · {liveness?.service ?? 'No response'}</p></div></div><span className={`inline-flex items-center gap-1.5 text-[9px] font-semibold ${liveness ? 'text-[#8ce9c3]' : 'text-[#ff9aad]'}`}><span className={`size-1.5 rounded-full ${liveness ? 'bg-[var(--emerald)]' : 'bg-[var(--red)]'}`} />{liveness ? 'Operational' : 'Unavailable'}</span><code className="text-[8px] text-[var(--faint)]">{liveness?.request_id ? liveness.request_id.slice(0, 8) : 'no request'}</code>
          </article>
          {dependencyEntries.map(([key, result]) => {
            const presentation = dependencyPresentation[key] ?? { label: key.replaceAll('_', ' '), description: 'Required runtime dependency.', icon: Activity };
            const Icon = presentation.icon;
            const healthy = result.status === 'healthy';
            return (
              <article key={key} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-5">
                <div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-[var(--violet)]"><Icon className="size-4" aria-hidden="true" /></span><div><h3 className="text-[11px] font-semibold capitalize text-[var(--text)]">{presentation.label}</h3><p className="mt-1 text-[8px] leading-3.5 text-[var(--faint)]">{presentation.description}</p></div></div><span className={`inline-flex items-center gap-1.5 text-[9px] font-semibold ${healthy ? 'text-[#8ce9c3]' : 'text-[#ff9aad]'}`}><span className={`size-1.5 rounded-full ${healthy ? 'bg-[var(--emerald)]' : 'bg-[var(--red)]'}`} />{healthy ? 'Operational' : 'Unavailable'}</span><span className="text-right text-[9px] font-semibold tabular-nums text-[var(--muted)]">{result.latency_ms.toFixed(2)} ms</span>
              </article>
            );
          })}
        </div>
        {!dependencyEntries.length ? <div className="border-t border-white/[0.07] px-5 py-6 text-center text-[9px] text-[var(--faint)]">The dependency diagnostics endpoint could not be reached.</div> : null}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <article className="nx-panel p-4 sm:p-5"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--violet)]/18 bg-[var(--violet)]/[0.06] text-[var(--violet)]"><Bot className="size-4" aria-hidden="true" /></span><div><p className="nx-kicker">Capability status</p><h2 className="mt-1.5 text-[12px] font-semibold text-[var(--text)]">Local AI runtime</h2><p className="mt-2 text-[9px] leading-4 text-[var(--muted)]">Model readiness is reported separately because Ollama is not a required API dependency.</p><Link href="/integrations" className="mt-3 inline-flex items-center gap-1.5 text-[9px] font-semibold text-[var(--blue-strong)] hover:text-white">View AI readiness <ArrowRight className="size-3" aria-hidden="true" /></Link></div></div></article>
        <article className="nx-panel p-4 sm:p-5"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--amber)]/18 bg-[var(--amber)]/[0.06] text-[var(--amber)]"><Workflow className="size-4" aria-hidden="true" /></span><div><p className="nx-kicker">Execution status</p><h2 className="mt-1.5 text-[12px] font-semibold text-[var(--text)]">Worker activity</h2><p className="mt-2 text-[9px] leading-4 text-[var(--muted)]">Worker executions are observable through persisted jobs and heartbeats, not inferred from container presence.</p><Link href="/agents" className="mt-3 inline-flex items-center gap-1.5 text-[9px] font-semibold text-[var(--blue-strong)] hover:text-white">View agent operations <ArrowRight className="size-3" aria-hidden="true" /></Link></div></div></article>
      </section>

      <div className="mt-4 rounded-xl border border-[var(--emerald)]/16 bg-[var(--emerald)]/[0.045] px-4 py-3 text-[9px] leading-4 text-[var(--muted)]"><ShieldCheck className="mr-2 inline size-3.5 text-[var(--emerald)]" aria-hidden="true" /><strong className="text-[var(--text)]">Safe output:</strong> probes return status, required flags, latency, and request IDs only. Hosts, URLs, tokens, and credentials are not exposed.</div>
    </div>
  );
}
