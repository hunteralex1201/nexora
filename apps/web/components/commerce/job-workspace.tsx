'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Clock3, Play, RefreshCw, RotateCcw, TerminalSquare } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/commerce/primitives';
import { PageHeader } from '@/components/page-header';
import { commerceRequest, formatDate, type Job, type Source } from '@/lib/commerce-client';

const statuses = ['', 'queued', 'running', 'succeeded', 'failed', 'dead_letter'] as const;

function duration(job: Job): string {
  if (!job.started_at) return 'Not started';
  const end = job.completed_at ? new Date(job.completed_at).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - new Date(job.started_at).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function JobWorkspace() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<(typeof statuses)[number]>('');
  const [sourceId, setSourceId] = useState('');
  const [jobType, setJobType] = useState('collect');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sources = useQuery({
    queryKey: ['commerce', 'sources'],
    queryFn: () => commerceRequest<Source[]>('sources?active=true'),
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

  const selected = useMemo(
    () => jobs.data?.find((job) => job.id === selectedId) ?? jobs.data?.[0] ?? null,
    [jobs.data, selectedId],
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sourceId) return;
    createJob.mutate({
      source_id: sourceId,
      job_type: jobType,
      trigger: 'manual',
      payload: {},
      idempotency_key: `ui-${jobType}-${sourceId}-${Date.now()}`,
    });
  }

  function retry(job: Job) {
    createJob.mutate({
      source_id: job.source_id,
      job_type: job.job_type,
      trigger: 'manual',
      payload: job.payload,
      idempotency_key: `retry-${job.id}-${Date.now()}`,
    });
  }

  if (sources.isLoading || jobs.isLoading) return <LoadingState label="Loading background jobs" />;
  if (sources.error) return <ErrorState message={sources.error.message} />;
  if (jobs.error) return <ErrorState message={jobs.error.message} />;

  const counts = (jobs.data ?? []).reduce<Record<string, number>>((accumulator, job) => {
    accumulator[job.status] = (accumulator[job.status] ?? 0) + 1;
    return accumulator;
  }, {});

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        eyebrow="Automation control"
        title="Queue, monitor, and diagnose background work."
        description="The persistent worker claims durable database jobs, emits lifecycle events to Redis Streams, applies bounded retries, and records execution metrics without hiding failures."
        actions={
          <button
            type="button"
            onClick={() => void jobs.refetch()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-slate-200 hover:bg-white/[0.06]"
          >
            <RefreshCw className={`size-4 ${jobs.isFetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
        }
      />

      <section className="mt-7 grid gap-5 xl:grid-cols-[0.55fr_1.45fr]">
        <form onSubmit={submit} className="rounded-2xl border border-white/8 bg-[#0a101c]/80 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Play className="size-4 text-violet-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Queue a job</h2>
          </div>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-xs font-medium text-slate-400">
              Active source
              <select
                required
                value={sourceId}
                onChange={(event) => setSourceId(event.target.value)}
                className="min-h-11 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white outline-none focus:border-violet-400/40"
              >
                <option value="">Choose source</option>
                {(sources.data ?? []).map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name} ({source.type})
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-xs font-medium text-slate-400">
              Job purpose
              <select
                value={jobType}
                onChange={(event) => setJobType(event.target.value)}
                className="min-h-11 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white outline-none focus:border-violet-400/40"
              >
                <option value="collect">Collect approved source</option>
                <option value="alert_evaluate">Evaluate alerts</option>
                <option value="ai_analyze">Generate AI insight</option>
              </select>
            </label>
          </div>
          {createJob.error ? <p className="mt-4 text-sm text-rose-300">{createJob.error.message}</p> : null}
          <button
            type="submit"
            disabled={!sourceId || createJob.isPending}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-40"
          >
            <Play className="size-4" /> {createJob.isPending ? 'Queueing…' : 'Queue job'}
          </button>
          <div className="mt-6 rounded-xl border border-white/[0.07] bg-slate-950/30 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">Visible queue snapshot</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {['queued', 'running', 'failed'].map((key) => (
                <div key={key}>
                  <p className="text-lg font-semibold text-slate-200">{counts[key] ?? 0}</p>
                  <p className="text-[10px] capitalize text-slate-600">{key}</p>
                </div>
              ))}
            </div>
          </div>
        </form>

        <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#0a101c]/80">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Execution queue</h2>
              <p className="mt-1 text-xs text-slate-500">Auto-refreshes every 5 seconds</p>
            </div>
            <select
              aria-label="Filter job status"
              value={status}
              onChange={(event) => setStatus(event.target.value as (typeof statuses)[number])}
              className="min-h-10 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-xs text-slate-300 outline-none"
            >
              {statuses.map((value) => (
                <option key={value || 'all'} value={value}>
                  {value ? value.replaceAll('_', ' ') : 'All statuses'}
                </option>
              ))}
            </select>
          </div>
          {jobs.data?.length ? (
            <div className="divide-y divide-white/[0.06]">
              {jobs.data.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedId(job.id)}
                  className={`grid w-full gap-3 px-5 py-4 text-left sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-6 ${selected?.id === job.id ? 'bg-violet-500/[0.07]' : 'hover:bg-white/[0.025]'}`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-slate-300">{job.id}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {job.job_type.replaceAll('_', ' ')} · {job.trigger} · attempt {job.attempt}/{job.max_attempts}
                    </p>
                  </div>
                  <StatusBadge status={job.status} />
                  <time className="text-xs text-slate-500">{formatDate(job.queued_at)}</time>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-5 sm:p-6">
              <EmptyState title="No jobs in this view" description="Queue a collection job or change the status filter." />
            </div>
          )}
        </div>
      </section>

      {selected ? (
        <section className="mt-6 grid gap-5 rounded-2xl border border-white/8 bg-white/[0.02] p-5 lg:grid-cols-[1fr_1fr] sm:p-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <TerminalSquare className="size-5 text-cyan-300" aria-hidden="true" />
              <h2 className="font-mono text-sm text-slate-200">{selected.id}</h2>
              <StatusBadge status={selected.status} />
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-xs">
              <div><dt className="text-slate-600">Queued</dt><dd className="mt-1 text-slate-300">{formatDate(selected.queued_at)}</dd></div>
              <div><dt className="text-slate-600">Duration</dt><dd className="mt-1 text-slate-300">{duration(selected)}</dd></div>
              <div><dt className="text-slate-600">Last heartbeat</dt><dd className="mt-1 text-slate-300">{formatDate(selected.last_heartbeat_at)}</dd></div>
              <div><dt className="text-slate-600">Completed</dt><dd className="mt-1 text-slate-300">{formatDate(selected.completed_at)}</dd></div>
            </dl>
            {['failed', 'dead_letter'].includes(selected.status) ? (
              <button
                type="button"
                onClick={() => retry(selected)}
                disabled={createJob.isPending}
                className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.07] px-3 text-xs font-semibold text-amber-200 hover:bg-amber-500/10"
              >
                <RotateCcw className="size-3.5" /> Retry as new job
              </button>
            ) : null}
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.07] bg-slate-950/35 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300"><Activity className="size-4 text-violet-300" /> Metrics</div>
              <pre className="mt-3 max-h-36 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-slate-500">{JSON.stringify(selected.metrics, null, 2)}</pre>
            </div>
            {selected.error_message ? (
              <div className="rounded-xl border border-rose-400/15 bg-rose-500/[0.05] p-4">
                <p className="text-xs font-semibold text-rose-200">Execution error</p>
                <p className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-rose-200/65">{selected.error_message}</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-600"><Clock3 className="size-4" /> No execution error recorded.</div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
