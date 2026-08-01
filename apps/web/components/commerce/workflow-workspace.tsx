'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BellRing,
  Bot,
  CheckCircle2,
  DatabaseZap,
  FileSearch,
  Gauge,
  GitBranch,
  Play,
  RadioTower,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/commerce/primitives';
import { PageHeader } from '@/components/page-header';
import { commerceRequest, formatDate, type Job, type Source } from '@/lib/commerce-client';

const recipes = [
  {
    type: 'collect',
    title: 'Product evidence collection',
    description: 'Capture approved page data, persist normalized observations, and evaluate saved alert rules.',
    icon: DatabaseZap,
    tone: 'var(--blue)',
    stages: [
      { label: 'Manual or n8n trigger', icon: Play },
      { label: 'Idempotent job queue', icon: TimerReset },
      { label: 'Source collector', icon: RadioTower },
      { label: 'Evidence persistence', icon: ShieldCheck },
      { label: 'Alert evaluation', icon: BellRing },
    ],
  },
  {
    type: 'ai_analyze',
    title: 'Local AI insight generation',
    description: 'Read persisted product observations, run the configured local model, and save evidence-linked analysis.',
    icon: Sparkles,
    tone: 'var(--violet)',
    stages: [
      { label: 'Manual or n8n trigger', icon: Play },
      { label: 'Idempotent job queue', icon: TimerReset },
      { label: 'Observation context', icon: FileSearch },
      { label: 'Local Qwen model', icon: Bot },
      { label: 'Saved AI insight', icon: CheckCircle2 },
    ],
  },
] as const;

function WorkflowCard({ recipe, jobs }: { recipe: (typeof recipes)[number]; jobs: Job[] }) {
  const runs = jobs.filter((job) => job.job_type === recipe.type);
  const latest = runs[0] ?? null;
  const succeeded = runs.filter((job) => job.status === 'succeeded').length;
  const failed = runs.filter((job) => ['failed', 'dead_letter'].includes(job.status)).length;
  const Icon = recipe.icon;

  return (
    <article className="nx-panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] p-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/[0.09] bg-white/[0.025]" style={{ color: recipe.tone }}><Icon className="size-[18px]" aria-hidden="true" /></span>
          <div>
            <p className="nx-kicker">Supported recipe</p>
            <h2 className="mt-1.5 text-[13px] font-semibold text-[var(--text)]">{recipe.title}</h2>
            <p className="mt-1 max-w-xl text-[9px] leading-4 text-[var(--muted)]">{recipe.description}</p>
          </div>
        </div>
        <Link href="/jobs" className="nx-button-secondary !min-h-9 !px-3 !text-[10px]"><Play className="size-3.5" aria-hidden="true" /> Open run control</Link>
      </div>

      <div className="overflow-x-auto border-b border-white/[0.07] p-4 sm:p-5">
        <div className="flex min-w-[570px] items-center">
          {recipe.stages.map((stage, index) => {
            const StageIcon = stage.icon;
            return (
              <div key={stage.label} className="contents">
                <div className="flex w-24 shrink-0 flex-col items-center text-center">
                  <span className="grid size-8 place-items-center rounded-lg border border-white/[0.09] bg-white/[0.025] text-[var(--muted)]"><StageIcon className="size-3.5" aria-hidden="true" /></span>
                  <span className="mt-2 text-[8px] leading-3 text-[var(--muted)]">{stage.label}</span>
                </div>
                {index < recipe.stages.length - 1 ? <span className="mx-1 h-px flex-1 bg-gradient-to-r from-white/[0.07] via-[var(--blue)]/30 to-white/[0.07]" /> : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-white/[0.06] sm:grid-cols-4">
        {[
          ['Persisted runs', String(runs.length)],
          ['Succeeded', String(succeeded)],
          ['Failed', String(failed)],
          ['Latest', latest ? formatDate(latest.queued_at) : 'No run'],
        ].map(([term, value]) => (
          <dl key={term} className="bg-[var(--surface-1)] p-3.5"><dt className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]">{term}</dt><dd className="mt-1.5 truncate text-[10px] font-semibold text-[var(--text)]">{value}</dd></dl>
        ))}
      </div>
    </article>
  );
}

export function WorkflowWorkspace() {
  const jobs = useQuery({
    queryKey: ['commerce', 'jobs', 'workflow-view'],
    queryFn: () => commerceRequest<Job[]>('jobs?limit=100'),
    refetchInterval: 10_000,
  });
  const sources = useQuery({
    queryKey: ['commerce', 'sources', 'workflow-view'],
    queryFn: () => commerceRequest<Source[]>('sources?active=true'),
    refetchInterval: 30_000,
  });

  const jobItems = useMemo(() => jobs.data ?? [], [jobs.data]);
  const sourceItems = useMemo(() => sources.data ?? [], [sources.data]);

  if (jobs.isLoading || sources.isLoading) return <LoadingState label="Loading workflows" />;
  if (jobs.error) return <ErrorState message={jobs.error.message} />;
  if (sources.error) return <ErrorState message={sources.error.message} />;

  const running = jobItems.filter((job) => job.status === 'running').length;
  const queued = jobItems.filter((job) => job.status === 'queued').length;
  const succeeded = jobItems.filter((job) => job.status === 'succeeded').length;
  const recentRuns = jobItems.slice(0, 6);

  return (
    <div>
      <PageHeader
        eyebrow="Implemented execution recipes"
        title="Workflows"
        description="Understand how supported jobs move from trigger to persisted evidence. This is an operational map, not a fictional drag-and-drop builder."
        actions={<Link href="/jobs" className="nx-button"><Play className="size-4" aria-hidden="true" /> Run automation</Link>}
      />

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Workflow metrics">
        {[
          { label: 'Supported recipes', value: recipes.length, icon: Workflow, tone: 'text-[var(--blue)]' },
          { label: 'Active sources', value: sourceItems.length, icon: RadioTower, tone: 'text-[var(--emerald)]' },
          { label: 'Queued or running', value: queued + running, icon: Gauge, tone: 'text-[var(--amber)]' },
          { label: 'Succeeded runs', value: succeeded, icon: CheckCircle2, tone: 'text-[var(--violet)]' },
        ].map((metric) => {
          const Icon = metric.icon;
          return <article key={metric.label} className="nx-panel flex items-center gap-3 p-3.5 sm:p-4"><span className={`grid size-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] ${metric.tone}`}><Icon className="size-4" aria-hidden="true" /></span><div><p className="text-[9px] font-bold uppercase tracking-[0.11em] text-[var(--faint)]">{metric.label}</p><p className="mt-1 text-[18px] font-semibold tracking-[-0.04em] text-[var(--text)]">{metric.value}</p></div></article>;
        })}
      </section>

      <div className="mt-4 grid gap-4">{recipes.map((recipe) => <WorkflowCard key={recipe.type} recipe={recipe} jobs={jobItems} />)}</div>

      <section className="nx-panel mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5 sm:px-5"><div><h2 className="text-[12px] font-semibold text-[var(--text)]">Recent workflow runs</h2><p className="mt-1 text-[9px] text-[var(--faint)]">Latest persisted jobs across supported recipes</p></div><GitBranch className="size-4 text-[var(--faint)]" aria-hidden="true" /></div>
        {recentRuns.length ? (
          <div className="divide-y divide-white/[0.065]">
            {recentRuns.map((job) => (
              <div key={job.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-5">
                <div className="min-w-0"><p className="text-[10px] font-semibold text-[var(--text)]">{job.job_type === 'collect' ? 'Product evidence collection' : job.job_type === 'ai_analyze' ? 'Local AI insight generation' : job.job_type.replaceAll('_', ' ')}</p><p className="mt-1 truncate text-[8px] text-[var(--faint)]">{job.id}</p></div><StatusBadge status={job.status} /><time className="text-[9px] text-[var(--muted)]">{formatDate(job.queued_at)}</time>
              </div>
            ))}
          </div>
        ) : <div className="p-5"><EmptyState title="No workflow runs yet" description="Start a supported run from Automation; its persisted status will appear here." /></div>}
        <Link href="/jobs" className="flex items-center justify-between border-t border-white/[0.07] px-4 py-3 text-[9px] font-semibold text-[var(--blue-strong)] hover:bg-white/[0.025] hover:text-white sm:px-5">Inspect the complete run ledger <ArrowRight className="size-3" aria-hidden="true" /></Link>
      </section>
    </div>
  );
}
