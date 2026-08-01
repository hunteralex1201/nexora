'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Play, RefreshCw, RotateCcw } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

import {
  EmptyState,
  ErrorState,
  LoadingState,
  StatusBadge,
} from '@/components/commerce/primitives';
import { PageHeader } from '@/components/page-header';
import { commerceRequest, formatDate, type Job, type Source } from '@/lib/commerce-client';

const statuses = ['', 'queued', 'running', 'succeeded', 'failed'] as const;
const supportedJobTypes = [
  { value: 'collect', label: 'Collect products' },
  { value: 'ai_analyze', label: 'Generate AI insights' },
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
  return (
    supportedJobTypes.find((item) => item.value === value)?.label ?? value.replaceAll('_', ' ')
  );
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

  const selected = useMemo(
    () => jobs.data?.find((job) => job.id === selectedId) ?? jobs.data?.[0] ?? null,
    [jobs.data, selectedId],
  );
  const activeSourceIds = useMemo(
    () => new Set((sources.data ?? []).map((source) => source.id)),
    [sources.data],
  );
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

  const counts = (jobs.data ?? []).reduce<Record<string, number>>((accumulator, job) => {
    accumulator[job.status] = (accumulator[job.status] ?? 0) + 1;
    return accumulator;
  }, {});

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Automation"
        description="Run product collection or local AI analysis."
        actions={
          <button type="button" onClick={() => void jobs.refetch()} className="nx-button-secondary">
            <RefreshCw
              className={`size-4 ${jobs.isFetching ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />{' '}
            Refresh
          </button>
        }
      />

      <form onSubmit={submit} className="nx-panel mt-6 p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_0.8fr_auto] md:items-end">
          <label className="nx-label">
            Source
            <select
              required
              value={canRun ? sourceId : ''}
              onChange={(event) => setSourceId(event.target.value)}
              className="nx-input"
            >
              <option value="">Choose a source</option>
              {(sources.data ?? []).map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>
          <label className="nx-label">
            Action
            <select
              value={jobType}
              onChange={(event) => setJobType(event.target.value as SupportedJobType)}
              className="nx-input"
            >
              {supportedJobTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={!canRun || createJob.isPending}
            className="nx-button md:min-w-32"
          >
            <Play className="size-4" aria-hidden="true" />{' '}
            {createJob.isPending ? 'Starting…' : 'Run'}
          </button>
        </div>
        {createJob.error ? (
          <p className="mt-3 text-[13px] text-[#a5463c]">{createJob.error.message}</p>
        ) : null}
        {createJob.isSuccess ? (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-[#287a55]">
            <CheckCircle2 className="size-4" /> Automation started.
          </p>
        ) : null}
      </form>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="Filter automations">
        {statuses.map((value) => (
          <button
            key={value || 'all'}
            type="button"
            onClick={() => setStatus(value)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
              status === value
                ? 'border-[#b85c3d] bg-[#f4e6df] text-[#8d402b]'
                : 'border-[#dedbd2] bg-[#fbfaf7] text-[#747168] hover:border-[#c9c5ba]'
            }`}
          >
            {value ? value.replaceAll('_', ' ') : 'All'}
            {value && counts[value] ? ` · ${counts[value]}` : ''}
          </button>
        ))}
      </div>

      <section className="mt-3 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="nx-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#e4e1d9] px-5 py-4">
            <h2 className="text-[13px] font-semibold text-[#3b3933]">Recent runs</h2>
            <span className="text-[11px] text-[#9d998f]">Updates automatically</span>
          </div>
          {jobs.data?.length ? (
            <div className="divide-y divide-[#ece9e2]">
              {jobs.data.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedId(job.id)}
                  className={`grid w-full gap-2 px-5 py-3.5 text-left sm:grid-cols-[1fr_auto_auto] sm:items-center ${
                    selected?.id === job.id ? 'bg-[#f4f1eb]' : 'hover:bg-[#faf9f6]'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#3b3933]">
                      {jobLabel(job.job_type)}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-[#9d998f]">{job.id}</p>
                  </div>
                  <StatusBadge status={job.status} />
                  <time className="text-[11px] text-[#8f8b81]">{formatDate(job.queued_at)}</time>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-5">
              <EmptyState title="No automations found" />
            </div>
          )}
        </div>

        <aside className="nx-panel h-fit overflow-hidden">
          <div className="border-b border-[#e4e1d9] px-5 py-4">
            <h2 className="text-[13px] font-semibold text-[#3b3933]">Run details</h2>
          </div>
          {selected ? (
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#3b3933]">
                  {jobLabel(selected.job_type)}
                </p>
                <StatusBadge status={selected.status} />
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-xs">
                <div>
                  <dt className="text-[#9d998f]">Started</dt>
                  <dd className="mt-1 text-[#4b4943]">{formatDate(selected.started_at)}</dd>
                </div>
                <div>
                  <dt className="text-[#9d998f]">Duration</dt>
                  <dd className="mt-1 text-[#4b4943]">{duration(selected)}</dd>
                </div>
                <div>
                  <dt className="text-[#9d998f]">Attempt</dt>
                  <dd className="mt-1 text-[#4b4943]">
                    {selected.attempt} of {selected.max_attempts}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#9d998f]">Finished</dt>
                  <dd className="mt-1 text-[#4b4943]">{formatDate(selected.completed_at)}</dd>
                </div>
              </dl>
              {Object.keys(selected.metrics ?? {}).length ? (
                <div className="mt-5 border-t border-[#ece9e2] pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9d998f]">
                    Results
                  </p>
                  <dl className="mt-3 space-y-2">
                    {Object.entries(selected.metrics)
                      .slice(0, 6)
                      .map(([key, value]) => (
                        <div key={key} className="flex items-start justify-between gap-4 text-xs">
                          <dt className="capitalize text-[#747168]">{key.replaceAll('_', ' ')}</dt>
                          <dd className="max-w-[55%] break-words text-right font-medium text-[#4b4943]">
                            {typeof value === 'object' ? 'Saved' : String(value)}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </div>
              ) : null}
              {selected.error_message ? (
                <div className="mt-5 rounded-lg bg-[#f9eae7] p-3 text-xs leading-5 text-[#96534b]">
                  {selected.error_message}
                </div>
              ) : (
                <p className="mt-5 flex items-center gap-2 text-xs text-[#8f8b81]">
                  <Clock3 className="size-3.5" /> No errors
                </p>
              )}
              {['failed', 'dead_letter'].includes(selected.status) &&
              ['collect', 'ai_analyze'].includes(selected.job_type) &&
              activeSourceIds.has(selected.source_id) ? (
                <button
                  type="button"
                  onClick={() => retry(selected)}
                  disabled={createJob.isPending}
                  className="nx-button-secondary mt-5 w-full"
                >
                  <RotateCcw className="size-3.5" /> Retry
                </button>
              ) : null}
            </div>
          ) : (
            <div className="px-5 py-10 text-center text-[13px] text-[#8f8b81]">Select a run</div>
          )}
        </aside>
      </section>
    </div>
  );
}
