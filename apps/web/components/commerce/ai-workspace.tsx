'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BrainCircuit, Play, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
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
  if (!action) return 'No action recorded';
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
  });

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
    if (sourceId) queueAnalysis.mutate();
  }

  if (readiness.isLoading || insights.isLoading || sources.isLoading) {
    return <LoadingState label="Loading local AI operations" />;
  }
  if (readiness.error) return <ErrorState message={readiness.error.message} />;
  if (insights.error) return <ErrorState message={insights.error.message} />;
  if (sources.error) return <ErrorState message={sources.error.message} />;

  const ready = readiness.data?.status === 'ready';
  const insightRows = insights.data ?? [];
  const averageConfidence = insightRows.length
    ? insightRows.reduce((sum, item) => sum + Number(item.confidence ?? 0), 0) / insightRows.length
    : 0;

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        eyebrow="Local intelligence"
        title="Run evidence-grounded analysis on your own Ollama models."
        description="NEXORA sends only persisted product facts to the local model, validates structured output, and stores each insight with its observation IDs, model, prompt version, and confidence."
        actions={
          <button
            type="button"
            onClick={() => {
              void readiness.refetch();
              void insights.refetch();
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-slate-200 hover:bg-white/[0.06]"
          >
            <RefreshCw className={`size-4 ${readiness.isFetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
        }
      />

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Ollama runtime"
          value={<StatusBadge status={readiness.data?.status ?? 'degraded'} />}
          detail={ready ? 'Required models are installed locally.' : 'Model bootstrap is incomplete or unavailable.'}
        />
        <MetricCard
          label="Chat model"
          value={readiness.data?.expected_chat_model ?? '—'}
          detail="CPU-bound structured price intelligence"
        />
        <MetricCard label="Stored insights" value={insightRows.length} detail="Latest 100 evidence-linked outputs" />
        <MetricCard
          label="Average confidence"
          value={insightRows.length ? `${Math.round(averageConfidence * 100)}%` : '—'}
          detail="Model confidence, never a measured fact"
        />
      </section>

      {!ready ? (
        <section className="mt-5 rounded-2xl border border-amber-400/15 bg-amber-400/[0.05] p-5">
          <div className="flex items-start gap-3">
            <BrainCircuit className="mt-0.5 size-5 text-amber-300" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-amber-100">Local model is not ready</h2>
              <p className="mt-1 text-sm leading-6 text-amber-100/65">
                Missing: {readiness.data?.missing_models.join(', ') || 'Ollama service'}.
                The model bootstrap container downloads these once and keeps them in the persistent model volume.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mt-5 grid gap-5 xl:grid-cols-[0.55fr_1.45fr]">
        <form onSubmit={submit} className="rounded-2xl border border-white/8 bg-[#0a101c]/80 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-violet-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Queue evidence analysis</h2>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            One durable background job analyzes the newest observations for a bounded number of products.
          </p>
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
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-xs font-medium text-slate-400">
              Maximum products per run
              <input
                type="number"
                min={1}
                max={100}
                value={maxProducts}
                onChange={(event) => setMaxProducts(Math.max(1, Math.min(100, Number(event.target.value))))}
                className="min-h-11 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white outline-none focus:border-violet-400/40"
              />
            </label>
          </div>
          {queueAnalysis.error ? (
            <p className="mt-4 text-sm text-rose-300">{queueAnalysis.error.message}</p>
          ) : null}
          {queueAnalysis.isSuccess ? (
            <p className="mt-4 text-sm text-emerald-300">Analysis job queued. Progress is visible on the Jobs page.</p>
          ) : null}
          <button
            type="submit"
            disabled={!sourceId || !ready || queueAnalysis.isPending}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-40"
          >
            <Play className="size-4" /> {queueAnalysis.isPending ? 'Queueing…' : 'Run local analysis'}
          </button>
          <div className="mt-6 flex gap-3 rounded-xl border border-white/[0.07] bg-slate-950/30 p-4">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden="true" />
            <p className="text-xs leading-5 text-slate-500">
              AI output is labeled separately from measured observations and cannot create price facts.
            </p>
          </div>
        </form>

        <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#0a101c]/80">
          <div className="border-b border-white/8 px-5 py-4 sm:px-6">
            <h2 className="text-sm font-semibold text-slate-200">Evidence-linked insights</h2>
            <p className="mt-1 text-xs text-slate-500">Auto-refreshes every 10 seconds</p>
          </div>
          {insightRows.length ? (
            <div className="divide-y divide-white/[0.06]">
              {insightRows.map((insight) => (
                <article key={insight.id} className="px-5 py-5 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{insight.product_name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {insight.source_name} · {formatDate(insight.generated_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={actionLabel(insight.evidence.recommended_action)} />
                      <span className="text-xs font-semibold text-violet-200">
                        {insight.confidence ? `${Math.round(Number(insight.confidence) * 100)}%` : '—'}
                      </span>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-300">{insight.content}</p>
                  {insight.evidence.rationale?.length ? (
                    <ul className="mt-3 grid gap-1.5 text-xs leading-5 text-slate-500">
                      {insight.evidence.rationale.map((reason) => (
                        <li key={reason}>• {reason}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-slate-600">
                    <span>{insight.model}</span>
                    <span>{insight.prompt_version}</span>
                    <span>{insight.evidence.observation_ids?.length ?? 0} evidence records</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="p-5 sm:p-6">
              <EmptyState
                title="No AI insights yet"
                description="Import or collect product observations, then queue a bounded local analysis run from this page."
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
