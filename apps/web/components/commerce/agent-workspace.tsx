'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  CircleAlert,
  Clock3,
  DatabaseZap,
  Gauge,
  Play,
  RadioTower,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/commerce/primitives';
import { PageHeader } from '@/components/page-header';
import {
  commerceRequest,
  formatDate,
  type AIReadiness,
  type Job,
  type Source,
} from '@/lib/commerce-client';

interface AgentCardProps {
  title: string;
  role: string;
  description: string;
  ready: boolean;
  prerequisite: string;
  icon: typeof Bot;
  tone: string;
  jobs: Job[];
}

function AgentCard({ title, role, description, ready, prerequisite, icon: Icon, tone, jobs }: AgentCardProps) {
  const latest = jobs[0] ?? null;
  const running = jobs.find((job) => job.status === 'running') ?? null;
  const succeeded = jobs.filter((job) => job.status === 'succeeded').length;
  const failures = jobs.filter((job) => ['failed', 'dead_letter'].includes(job.status)).length;
  const state = running ? 'Executing persisted job' : ready ? 'Capability ready' : 'Prerequisite missing';
  const stateColor = running ? 'var(--violet)' : ready ? 'var(--emerald)' : 'var(--amber)';

  return (
    <article className="nx-panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.07] p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-white/[0.09] bg-white/[0.025]" style={{ color: tone }}><Icon className="size-5" aria-hidden="true" /></span>
          <div>
            <p className="nx-kicker">{role}</p>
            <h2 className="mt-1.5 text-[14px] font-semibold text-[var(--text)]">{title}</h2>
            <p className="mt-1 max-w-xl text-[9px] leading-4 text-[var(--muted)]">{description}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.09em]" style={{ color: stateColor, borderColor: `color-mix(in srgb, ${stateColor} 25%, transparent)`, background: `color-mix(in srgb, ${stateColor} 7%, transparent)` }}>
          <span className={`size-1.5 rounded-full ${running ? 'animate-pulse' : ''}`} style={{ background: stateColor }} />{state}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-white/[0.07] bg-white/[0.06] sm:grid-cols-4">
        {[
          ['Persisted runs', String(jobs.length)],
          ['Succeeded', String(succeeded)],
          ['Failed', String(failures)],
          ['Last run', latest ? formatDate(latest.queued_at) : 'No run'],
        ].map(([term, value]) => <dl key={term} className="bg-[var(--surface-1)] p-3.5"><dt className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]">{term}</dt><dd className="mt-1.5 truncate text-[10px] font-semibold text-[var(--text)]">{value}</dd></dl>)}
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5">
        <div className="flex items-start gap-2.5">
          {ready ? <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--emerald)]" aria-hidden="true" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-[var(--amber)]" aria-hidden="true" />}
          <div><p className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]">Execution prerequisite</p><p className="mt-1 text-[9px] leading-4 text-[var(--muted)]">{prerequisite}</p></div>
        </div>
        <Link href="/jobs" className="nx-button-secondary !min-h-9 !px-3 !text-[10px]"><Play className="size-3.5" aria-hidden="true" /> Queue work</Link>
      </div>
    </article>
  );
}

export function AgentWorkspace() {
  const jobs = useQuery({
    queryKey: ['commerce', 'jobs', 'agent-view'],
    queryFn: () => commerceRequest<Job[]>('jobs?limit=100'),
    refetchInterval: 5_000,
  });
  const sources = useQuery({
    queryKey: ['commerce', 'sources', 'agent-view'],
    queryFn: () => commerceRequest<Source[]>('sources?active=true'),
    refetchInterval: 30_000,
  });
  const readiness = useQuery({
    queryKey: ['commerce', 'ai-readiness'],
    queryFn: () => commerceRequest<AIReadiness>('ai/readiness'),
    refetchInterval: 30_000,
  });

  const jobItems = useMemo(() => jobs.data ?? [], [jobs.data]);
  const sourceItems = useMemo(() => sources.data ?? [], [sources.data]);

  if (jobs.isLoading || sources.isLoading || readiness.isLoading) return <LoadingState label="Loading agent operations" />;
  if (jobs.error) return <ErrorState message={jobs.error.message} />;
  if (sources.error) return <ErrorState message={sources.error.message} />;
  if (readiness.error) return <ErrorState message={readiness.error.message} />;

  const collectionSources = sourceItems.filter((source) => ['jsonld', 'structured_html'].includes(source.type));
  const collectionJobs = jobItems.filter((job) => job.job_type === 'collect');
  const analysisJobs = jobItems.filter((job) => job.job_type === 'ai_analyze');
  const collectionReady = collectionSources.length > 0;
  const analysisReady = readiness.data?.status === 'ready';
  const runningJobs = jobItems.filter((job) => job.status === 'running');
  const recentFailures = jobItems.filter((job) => ['failed', 'dead_letter'].includes(job.status)).length;

  return (
    <div>
      <PageHeader
        eyebrow="Worker capabilities"
        title="Agent Operations"
        description="Monitor the two implemented execution capabilities. Readiness means prerequisites are available—not that a fictional autonomous agent is continuously running."
        actions={
          <>
            <Link href="/workflows" className="nx-button-quiet"><Workflow className="size-4" aria-hidden="true" /> Workflows</Link>
            <Link href="/jobs" className="nx-button"><Play className="size-4" aria-hidden="true" /> Queue work</Link>
          </>
        }
      />

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Agent operations metrics">
        {[
          { label: 'Ready capabilities', value: Number(collectionReady) + Number(analysisReady), icon: ServerCog, tone: 'text-[var(--blue)]' },
          { label: 'Executing jobs', value: runningJobs.length, icon: Gauge, tone: 'text-[var(--violet)]' },
          { label: 'Collectible sources', value: collectionSources.length, icon: RadioTower, tone: 'text-[var(--emerald)]' },
          { label: 'Recent failures', value: recentFailures, icon: CircleAlert, tone: 'text-[var(--amber)]' },
        ].map((metric) => {
          const Icon = metric.icon;
          return <article key={metric.label} className="nx-panel flex items-center gap-3 p-3.5 sm:p-4"><span className={`grid size-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] ${metric.tone}`}><Icon className="size-4" aria-hidden="true" /></span><div><p className="text-[9px] font-bold uppercase tracking-[0.11em] text-[var(--faint)]">{metric.label}</p><p className="mt-1 text-[18px] font-semibold tracking-[-0.04em] text-[var(--text)]">{metric.value}</p></div></article>;
        })}
      </section>

      <div className="mt-4 grid gap-4">
        <AgentCard
          title="Collection Worker"
          role="Evidence acquisition"
          description="Executes approved JSON-LD and structured-page collection jobs, then persists normalized observations and evaluates alert rules."
          ready={collectionReady}
          prerequisite={collectionReady ? `${collectionSources.length} active supported source${collectionSources.length === 1 ? '' : 's'} available.` : 'Add and activate a JSON-LD or structured HTML source before queuing collection.'}
          icon={DatabaseZap}
          tone="var(--blue)"
          jobs={collectionJobs}
        />
        <AgentCard
          title="Local Intelligence Worker"
          role="Product analysis"
          description="Executes AI analysis jobs against persisted product evidence using the configured local Ollama chat model."
          ready={analysisReady}
          prerequisite={analysisReady ? `${readiness.data?.expected_chat_model ?? 'Configured chat model'} is reported ready by the local runtime.` : `${readiness.data?.missing_models.join(', ') || 'The configured local chat model'} must be available before analysis can run.`}
          icon={BrainCircuit}
          tone="var(--violet)"
          jobs={analysisJobs}
        />
      </div>

      <section className="nx-panel mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5 sm:px-5"><div><h2 className="text-[12px] font-semibold text-[var(--text)]">Execution ledger</h2><p className="mt-1 text-[9px] text-[var(--faint)]">Latest jobs processed by implemented worker capabilities</p></div><span className="inline-flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-[var(--faint)]"><span className="size-1.5 animate-pulse rounded-full bg-[var(--emerald)]" />5s refresh</span></div>
        {jobItems.length ? (
          <div className="divide-y divide-white/[0.065]">
            {jobItems.slice(0, 8).map((job) => (
              <div key={job.id} className="grid gap-2.5 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-5">
                <div className="flex min-w-0 items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.025] text-[var(--muted)]">{job.job_type === 'ai_analyze' ? <Bot className="size-3.5" aria-hidden="true" /> : <DatabaseZap className="size-3.5" aria-hidden="true" />}</span><div className="min-w-0"><p className="text-[10px] font-semibold text-[var(--text)]">{job.job_type === 'ai_analyze' ? 'Local Intelligence Worker' : job.job_type === 'collect' ? 'Collection Worker' : job.job_type.replaceAll('_', ' ')}</p><p className="mt-1 truncate text-[8px] text-[var(--faint)]">{job.id}</p></div></div><StatusBadge status={job.status} /><time className="inline-flex items-center gap-1 text-[9px] text-[var(--muted)]"><Clock3 className="size-3" aria-hidden="true" />{formatDate(job.queued_at)}</time>
              </div>
            ))}
          </div>
        ) : <div className="p-5"><EmptyState title="No agent jobs yet" description="Queue collection or AI analysis work; persisted execution will appear here." /></div>}
        <Link href="/jobs" className="flex items-center justify-between border-t border-white/[0.07] px-4 py-3 text-[9px] font-semibold text-[var(--blue-strong)] hover:bg-white/[0.025] hover:text-white sm:px-5">Open the complete automation ledger <ArrowRight className="size-3" aria-hidden="true" /></Link>
      </section>

      <div className="mt-4 rounded-xl border border-[var(--amber)]/16 bg-[var(--amber)]/[0.05] px-4 py-3 text-[9px] leading-4 text-[var(--muted)]"><Sparkles className="mr-2 inline size-3.5 text-[var(--amber)]" aria-hidden="true" /><strong className="text-[var(--text)]">Interpretation note:</strong> this page reports configured capabilities and persisted executions. It does not infer unobserved worker uptime.</div>
    </div>
  );
}
