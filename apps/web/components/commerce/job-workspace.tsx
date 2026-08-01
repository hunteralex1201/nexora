'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  CheckCircle2,
  Clock3,
  DatabaseZap,
  Gauge,
  Play,
  RadioTower,
  RefreshCw,
  RotateCcw,
  Sparkles,
  TimerReset,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type FormEvent } from 'react';

import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/commerce/primitives';
import { PageHeader } from '@/components/page-header';
import { commerceRequest, formatDate, type Job, type Source } from '@/lib/commerce-client';

const statuses = ['', 'queued', 'running', 'succeeded', 'failed'] as const;
const supportedJobTypes = [
  { value: 'collect', label: 'Collect products', description: 'Capture fresh product evidence from a supported source.', icon: DatabaseZap },
  { value: 'ai_analyze', label: 'Generate AI insights', description: 'Create local-model analysis from persisted product observations.', icon: Sparkles },
] as const;

type SupportedJobType = (typeof supportedJobTypes)[number]['value'];

function duration(job: Job): string {
  if (!job.started_at) return 'Not started';
  const end = job.completed_at ? new Date(job.completed_at).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - new Date(job.started_at).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function jobLabel(value: string): string {
  return supportedJobTypes.find((item) => item.value === value)?.label ?? value.replaceAll('_', ' ');
}

function triggerLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

export function JobWorkspace() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<(typeof statuses)[number]>('');
  const [sourceId, setSourceId] = useState('');
  const [jobType, setJobType] = useState<SupportedJobType>('collect');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sources = useQuery({
    queryKey: ['commerce', 'sources'],
    queryFn: () => commerceRequest<Source[]>('sources?active=true'),
    refetchInterval: 10_000,
  });
  const jobs = useQuery({
    queryKey: ['commerce', 'jobs', status],
    queryFn: () => commerceRequest<Job[]>(`jobs?limit=100${status ? `&status=${status}` : ''}`),
    refetchInterval: 5_000,
  });

  const createJob = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      commerceRequest<Job>('jobs', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: (job) => {
      setSelectedId(job.id);
      void queryClient.invalidateQueries({ queryKey: ['commerce'] });
    },
  });

  const jobItems = useMemo(() => jobs.data ?? [], [jobs.data]);
  const sourceItems = useMemo(() => sources.data ?? [], [sources.data]);
  const sourceNames = useMemo(() => new Map(sourceItems.map((source) => [source.id, source.name])), [sourceItems]);
  const selected = useMemo(() => jobItems.find((job) => job.id === selectedId) ?? jobItems[0] ?? null, [jobItems, selectedId]);
  const activeSourceIds = useMemo(() => new Set(sourceItems.map((source) => source.id)), [sourceItems]);
  const canRun = Boolean(sourceId && activeSourceIds.has(sourceId));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canRun) return;
    createJob.mutate({
      source_id: sourceId,
      job_type: jobType,
      trigger: 'manual',
      payload: jobType === 'ai_analyze' ? { max_products: 20 } : {},
      idempotency_key: `ui-${jobType}-${sourceId}-${Date.now()}`,
    });
  }

  function retry(job: Job) {
    if (job.job_type !== 'collect' && job.job_type !== 'ai_analyze') return;
    createJob.mutate({
      source_id: job.source_id,
      job_type: job.job_type,
      trigger: 'manual',
      payload: job.payload,
      idempotency_key: `retry-${job.id}-${Date.now()}`,
    });
  }

  if (sources.isLoading || jobs.isLoading) return <LoadingState label="Loading automations" />;
  if (sources.error) return <ErrorState message={sources.error.message} />;
  if (jobs.error) return <ErrorState message={jobs.error.message} />;

  const counts = jobItems.reduce<Record<string, number>>((accumulator, job) => {
    accumulator[job.status] = (accumulator[job.status] ?? 0) + 1;
    return accumulator;
  }, {});
  const selectedType = supportedJobTypes.find((item) => item.value === jobType) ?? supportedJobTypes[0];
  const SelectedTypeIcon = selectedType.icon;

  return (
    <div>
      <PageHeader
        eyebrow="Execution control"
        title="Automation"
        description="Queue supported collection and local-AI jobs, inspect persisted results, and retry failed runs without duplicate hidden actions."
        actions={
          <>
            <Link href="/workflows" className="nx-button-quiet"><Workflow className="size-4" aria-hidden="true" /> Workflows</Link>
            <button type="button" onClick={() => void jobs.refetch()} className="nx-button-secondary">
              <RefreshCw className={`size-4 ${jobs.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
            </button>
          </>
        }
      />

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Automation metrics">
        {[
          { label: 'Active sources', value: sourceItems.length, icon: RadioTower, tone: 'text-[var(--blue)]' },
          { label: 'Queued', value: counts.queued ?? 0, icon: TimerReset, tone: 'text-[var(--amber)]' },
          { label: 'Running', value: counts.running ?? 0, icon: Gauge, tone: 'text-[var(--violet)]' },
          { label: 'Succeeded', value: counts.succeeded ?? 0, icon: CheckCircle2, tone: 'text-[var(--emerald)]' },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className="nx-panel flex items-center gap-3 p-3.5 sm:p-4">
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] ${metric.tone}`}><Icon className="size-4" aria-hidden="true" /></span>
              <div><p className="text-[9px] font-bold uppercase tracking-[0.11em] text-[var(--faint)]">{metric.label}</p><p className="mt-1 text-[18px] font-semibold tracking-[-0.04em] text-[var(--text)]">{metric.value}</p></div>
            </article>
          );
        })}
      </section>

      <form onSubmit={submit} className="nx-panel mt-4 overflow-hidden">
        <div className="border-b border-white/[0.07] px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2"><Play className="size-4 text-[var(--blue)]" aria-hidden="true" /><h2 className="text-[12px] font-semibold text-[var(--text)]">Start a supported run</h2></div>
          <p className="mt-1 text-[9px] text-[var(--faint)]">Each request receives a unique idempotency key and is recorded in the job ledger.</p>
        </div>
        <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[1fr_0.95fr_minmax(200px,0.65fr)_auto] lg:items-end">
          <label className="nx-label">Source<select required value={canRun ? sourceId : ''} onChange={(event) => setSourceId(event.target.value)} className="nx-input"><option value="">Choose a source</option>{sourceItems.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
          <label className="nx-label">Action<select value={jobType} onChange={(event) => setJobType(event.target.value as SupportedJobType)} className="nx-input">{supportedJobTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <div className="flex min-h-[39px] items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.018] px-3 py-2 text-[9px] leading-4 text-[var(--muted)]"><SelectedTypeIcon className="size-4 shrink-0 text-[var(--violet)]" aria-hidden="true" />{selectedType.description}</div>
          <button type="submit" disabled={!canRun || createJob.isPending} className="nx-button lg:min-w-28"><Play className="size-4" aria-hidden="true" /> {createJob.isPending ? 'Starting…' : 'Run'}</button>
        </div>
        {createJob.error ? <p role="alert" className="mx-4 mb-3 text-[11px] text-[#ff9aad] sm:mx-5">{createJob.error.message}</p> : null}
        {createJob.isSuccess ? <p role="status" className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-[var(--emerald)]/18 bg-[var(--emerald)]/[0.07] px-3 py-2.5 text-[11px] text-[#8ce9c3] sm:mx-5"><CheckCircle2 className="size-4" aria-hidden="true" /> Automation started.</p> : null}
      </form>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Filter automations">
        {statuses.map((value) => (
          <button
            key={value || 'all'}
            type="button"
            onClick={() => setStatus(value)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[9px] font-semibold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/60 ${status === value ? 'border-[var(--blue)]/32 bg-[var(--blue)]/[0.11] text-[#c4d4ff]' : 'border-white/[0.09] bg-white/[0.02] text-[var(--muted)] hover:bg-white/[0.045]'}`}
          >
            {value ? value.replaceAll('_', ' ') : 'All runs'}{value && counts[value] ? ` · ${counts[value]}` : ''}
          </button>
        ))}
      </div>

      <section className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.65fr)]">
        <div className="nx-panel min-w-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5 sm:px-5">
            <div><h2 className="text-[12px] font-semibold text-[var(--text)]">Run ledger</h2><p className="mt-1 text-[9px] text-[var(--faint)]">{jobItems.length} persisted run{jobItems.length === 1 ? '' : 's'} in this view</p></div>
            <span className="inline-flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-[var(--faint)]"><span className="size-1.5 animate-pulse rounded-full bg-[var(--emerald)]" />5s refresh</span>
          </div>
          {jobItems.length ? (
            <div className="divide-y divide-white/[0.065]">
              {jobItems.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedId(job.id)}
                  className={`grid w-full gap-2.5 px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--blue)]/60 sm:grid-cols-[minmax(0,1fr)_minmax(110px,0.4fr)_auto] sm:items-center sm:px-5 ${selected?.id === job.id ? 'bg-[linear-gradient(90deg,rgba(91,140,255,0.11),rgba(91,140,255,0.02))] shadow-[inset_3px_0_0_var(--blue)]' : 'hover:bg-white/[0.027]'}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.025] text-[var(--violet)]">{job.job_type === 'ai_analyze' ? <Bot className="size-3.5" aria-hidden="true" /> : <DatabaseZap className="size-3.5" aria-hidden="true" />}</span>
                    <div className="min-w-0"><p className="text-[11px] font-semibold text-[var(--text)]">{jobLabel(job.job_type)}</p><p className="mt-1 truncate text-[8px] text-[var(--faint)]">{sourceNames.get(job.source_id) ?? job.source_id} · {job.id}</p></div>
                  </div>
                  <div className="flex items-center gap-2 sm:block"><StatusBadge status={job.status} /><p className="mt-1 hidden text-[8px] text-[var(--faint)] sm:block">{triggerLabel(job.trigger)}</p></div>
                  <time className="text-[9px] text-[var(--muted)]">{formatDate(job.queued_at)}</time>
                </button>
              ))}
            </div>
          ) : <div className="p-5"><EmptyState title="No automations found" description="Choose an active source and supported action to create the first run." /></div>}
        </div>

        <aside className="nx-panel h-fit overflow-hidden xl:sticky xl:top-20">
          <div className="border-b border-white/[0.07] px-4 py-3.5 sm:px-5"><p className="nx-kicker">Inspector</p><h2 className="mt-1.5 text-[12px] font-semibold text-[var(--text)]">Run details</h2></div>
          {selected ? (
            <div>
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] p-4 sm:px-5"><div><p className="text-[12px] font-semibold text-[var(--text)]">{jobLabel(selected.job_type)}</p><p className="mt-1 text-[8px] text-[var(--faint)]">{sourceNames.get(selected.source_id) ?? selected.source_id}</p></div><StatusBadge status={selected.status} /></div>
              <dl className="grid grid-cols-2 gap-px border-b border-white/[0.07] bg-white/[0.06]">
                {[
                  ['Started', formatDate(selected.started_at)],
                  ['Duration', duration(selected)],
                  ['Attempt', `${selected.attempt} of ${selected.max_attempts}`],
                  ['Finished', formatDate(selected.completed_at)],
                ].map(([term, value]) => <div key={term} className="bg-[var(--surface-1)] p-3.5"><dt className="text-[8px] font-bold uppercase tracking-[0.11em] text-[var(--faint)]">{term}</dt><dd className="mt-1.5 text-[10px] font-semibold text-[var(--text)]">{value}</dd></div>)}
              </dl>
              <div className="p-4 sm:px-5">
                {Object.keys(selected.metrics ?? {}).length ? (
                  <div><p className="text-[8px] font-bold uppercase tracking-[0.11em] text-[var(--faint)]">Persisted results</p><dl className="mt-3 space-y-2">{Object.entries(selected.metrics).slice(0, 8).map(([key, value]) => <div key={key} className="flex items-start justify-between gap-4 text-[9px]"><dt className="capitalize text-[var(--muted)]">{key.replaceAll('_', ' ')}</dt><dd className="max-w-[55%] break-words text-right font-semibold text-[var(--text)]">{typeof value === 'object' ? 'Saved' : String(value)}</dd></div>)}</dl></div>
                ) : <p className="text-[9px] text-[var(--faint)]">No result metrics were persisted for this run.</p>}
                {selected.error_message ? <div role="alert" className="mt-4 rounded-lg border border-[var(--red)]/16 bg-[var(--red)]/[0.06] p-3 text-[9px] leading-4 text-[#ff9aad]">{selected.error_message}</div> : <p className="mt-4 flex items-center gap-2 text-[9px] text-[var(--muted)]"><Clock3 className="size-3.5 text-[var(--emerald)]" aria-hidden="true" />No error recorded</p>}
                {['failed', 'dead_letter'].includes(selected.status) && ['collect', 'ai_analyze'].includes(selected.job_type) && activeSourceIds.has(selected.source_id) ? (
                  <button type="button" onClick={() => retry(selected)} disabled={createJob.isPending} className="nx-button-secondary mt-4 w-full"><RotateCcw className="size-3.5" aria-hidden="true" /> Retry</button>
                ) : null}
              </div>
            </div>
          ) : <div className="px-5 py-12 text-center text-[10px] text-[var(--faint)]">Select a run</div>}
        </aside>
      </section>
    </div>
  );
}
