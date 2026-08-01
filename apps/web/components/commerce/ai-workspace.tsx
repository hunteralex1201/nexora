'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Play, RefreshCw, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import {
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  StatusBadge,
} from '@/components/commerce/primitives';
import { PageHeader } from '@/components/page-header';
import {
  commerceRequest,
  formatDate,
  type AIInsight,
  type AIReadiness,
  type Job,
  type Source,
} from '@/lib/commerce-client';

function actionLabel(action: string | undefined): string {
  if (!action) return 'Review';
  return action.replaceAll('_', ' ');
}

export function AIWorkspace() {
  const queryClient = useQueryClient();
  const [sourceId, setSourceId] = useState('');
  const [maxProducts, setMaxProducts] = useState(20);

  const readiness = useQuery({
    queryKey: ['commerce', 'ai-readiness'],
    queryFn: () => commerceRequest<AIReadiness>('ai/readiness'),
    refetchInterval: 30_000,
  });
  const insights = useQuery({
    queryKey: ['commerce', 'ai-insights'],
    queryFn: () => commerceRequest<AIInsight[]>('ai/insights?limit=100'),
    refetchInterval: 10_000,
  });
  const sources = useQuery({
    queryKey: ['commerce', 'sources'],
    queryFn: () => commerceRequest<Source[]>('sources?active=true'),
    refetchInterval: 10_000,
  });

  const ready = readiness.data?.status === 'ready';
  const selectedSource = (sources.data ?? []).find((source) => source.id === sourceId);
  const canAnalyze = ready && Boolean(selectedSource?.is_active);

  const queueAnalysis = useMutation({
    mutationFn: () =>
      commerceRequest<Job>('jobs', {
        method: 'POST',
        body: JSON.stringify({
          source_id: sourceId,
          job_type: 'ai_analyze',
          trigger: 'manual',
          payload: { max_products: maxProducts },
          idempotency_key: `ui-ai-${sourceId}-${Date.now()}`,
        }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['commerce'] }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canAnalyze) queueAnalysis.mutate();
  }

  if (readiness.isLoading || insights.isLoading || sources.isLoading)
    return <LoadingState label="Loading AI insights" />;
  if (readiness.error) return <ErrorState message={readiness.error.message} />;
  if (insights.error) return <ErrorState message={insights.error.message} />;
  if (sources.error) return <ErrorState message={sources.error.message} />;

  const insightRows = insights.data ?? [];
  const averageConfidence = insightRows.length
    ? insightRows.reduce((sum, item) => sum + Number(item.confidence ?? 0), 0) / insightRows.length
    : 0;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="AI insights"
        description="Analyze recent product and price changes with your local model."
        actions={
          <button
            type="button"
            onClick={() => {
              void readiness.refetch();
              void insights.refetch();
            }}
            className="nx-button-secondary"
          >
            <RefreshCw
              className={`size-4 ${readiness.isFetching ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />{' '}
            Refresh
          </button>
        }
      />

      <div className="mt-6 flex items-center gap-2 text-xs text-[#747168]">
        <span
          className={`size-2 rounded-full ${ready ? 'status-pulse bg-[#287a55]' : 'bg-[#a5463c]'}`}
          aria-hidden="true"
        />
        {ready
          ? `${readiness.data?.expected_chat_model ?? 'Local model'} is ready`
          : `Model unavailable${readiness.data?.missing_models.length ? ` · Missing ${readiness.data.missing_models.join(', ')}` : ''}`}
      </div>

      <section className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="AI summary">
        <MetricCard label="Model" value={readiness.data?.expected_chat_model ?? '—'} />
        <MetricCard label="Saved insights" value={insightRows.length} />
        <MetricCard
          label="Average confidence"
          value={insightRows.length ? `${Math.round(averageConfidence * 100)}%` : '—'}
        />
      </section>

      <form onSubmit={submit} className="nx-panel mt-5 p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end">
          <label className="nx-label">
            Source
            <select
              required
              value={selectedSource ? sourceId : ''}
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
            Products
            <input
              type="number"
              min={1}
              max={100}
              value={maxProducts}
              onChange={(event) =>
                setMaxProducts(Math.max(1, Math.min(100, Number(event.target.value))))
              }
              className="nx-input"
            />
          </label>
          <button
            type="submit"
            disabled={!canAnalyze || queueAnalysis.isPending}
            className="nx-button md:min-w-40"
          >
            <Play className="size-4" aria-hidden="true" />{' '}
            {queueAnalysis.isPending ? 'Starting…' : 'Analyze'}
          </button>
        </div>
        {queueAnalysis.error ? (
          <p className="mt-3 text-[13px] text-[#a5463c]">{queueAnalysis.error.message}</p>
        ) : null}
        {queueAnalysis.isSuccess ? (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-[#287a55]">
            <CheckCircle2 className="size-4" aria-hidden="true" /> Analysis started. Results will
            appear here.
          </p>
        ) : null}
      </form>

      <section className="nx-panel mt-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#e4e1d9] px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[#b85c3d]" aria-hidden="true" />
            <h2 className="text-[13px] font-semibold text-[#3b3933]">Latest insights</h2>
          </div>
          <span className="text-[11px] text-[#9d998f]">Updates automatically</span>
        </div>
        {insightRows.length ? (
          <div className="divide-y divide-[#ece9e2]">
            {insightRows.map((insight) => (
              <article key={insight.id} className="px-5 py-5 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#3b3933]">{insight.product_name}</p>
                    <p className="mt-1 text-xs text-[#8f8b81]">
                      {insight.source_name} · {formatDate(insight.generated_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={actionLabel(insight.evidence.recommended_action)} />
                    <span className="text-xs font-semibold text-[#9d4b32]">
                      {insight.confidence
                        ? `${Math.round(Number(insight.confidence) * 100)}%`
                        : '—'}
                    </span>
                  </div>
                </div>
                <p className="mt-4 max-w-4xl text-[13px] leading-6 text-[#4b4943]">
                  {insight.content}
                </p>
                {insight.evidence.rationale?.length ? (
                  <ul className="mt-3 grid gap-1 text-xs leading-5 text-[#858178]">
                    {insight.evidence.rationale.slice(0, 3).map((reason) => (
                      <li key={reason}>— {reason}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              title="No insights yet"
              description="Choose a source and run an analysis."
            />
          </div>
        )}
      </section>
    </div>
  );
}
