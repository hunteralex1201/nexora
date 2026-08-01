'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, BellRing, CheckCheck, Plus, ShieldAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/commerce/primitives';
import { PageHeader } from '@/components/page-header';
import {
  commerceRequest,
  formatDate,
  type AlertEvent,
  type AlertRule,
  type ProductPage,
  type Source,
} from '@/lib/commerce-client';

export function AlertWorkspace() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [ruleType, setRuleType] = useState('price_drop_percent');
  const [threshold, setThreshold] = useState('10');
  const [sourceId, setSourceId] = useState('');
  const [productId, setProductId] = useState('');
  const [eventStatus, setEventStatus] = useState('open');

  const rules = useQuery({
    queryKey: ['commerce', 'alert-rules'],
    queryFn: () => commerceRequest<AlertRule[]>('alerts/rules'),
  });
  const events = useQuery({
    queryKey: ['commerce', 'alert-events', eventStatus],
    queryFn: () => commerceRequest<AlertEvent[]>(`alerts/events?limit=100${eventStatus ? `&status=${eventStatus}` : ''}`),
    refetchInterval: 10_000,
  });
  const sources = useQuery({
    queryKey: ['commerce', 'sources'],
    queryFn: () => commerceRequest<Source[]>('sources?active=true'),
  });
  const products = useQuery({
    queryKey: ['commerce', 'products', 'alert-picker'],
    queryFn: () => commerceRequest<ProductPage>('products?limit=100'),
  });

  const createRule = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      commerceRequest<AlertRule>('alerts/rules', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      setName('');
      void queryClient.invalidateQueries({ queryKey: ['commerce'] });
    },
  });

  const acknowledge = useMutation({
    mutationFn: (eventId: string) =>
      commerceRequest<AlertEvent>(`alerts/events/${eventId}/acknowledge`, { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['commerce'] }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createRule.mutate({
      name,
      rule_type: ruleType,
      threshold: ruleType === 'out_of_stock' ? null : Number(threshold),
      source_id: sourceId || null,
      product_id: productId || null,
      config: {},
      is_active: true,
    });
  }

  if (rules.isLoading || events.isLoading || sources.isLoading || products.isLoading) {
    return <LoadingState label="Loading alert rules and events" />;
  }
  const firstError = rules.error ?? events.error ?? sources.error ?? products.error;
  if (firstError) return <ErrorState message={firstError.message} />;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Signal monitoring"
        title="Evidence-triggered price and availability alerts."
        description="Rules are evaluated whenever a new immutable observation is persisted. Every event links back to its rule, product, and exact observation instead of relying on inferred or fabricated signals."
      />

      <section className="mt-7 grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <form onSubmit={submit} className="rounded-2xl border border-white/8 bg-[#0a101c]/80 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Plus className="size-4 text-violet-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Create alert rule</h2>
          </div>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-xs font-medium text-slate-400">
              Rule name
              <input
                required
                minLength={2}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Price dropped by 10%"
                className="min-h-11 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white outline-none focus:border-violet-400/40"
              />
            </label>
            <label className="grid gap-2 text-xs font-medium text-slate-400">
              Condition
              <select
                value={ruleType}
                onChange={(event) => setRuleType(event.target.value)}
                className="min-h-11 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white outline-none focus:border-violet-400/40"
              >
                <option value="price_drop_percent">Price drop percentage</option>
                <option value="price_below">Price below amount</option>
                <option value="out_of_stock">Product out of stock</option>
              </select>
            </label>
            {ruleType !== 'out_of_stock' ? (
              <label className="grid gap-2 text-xs font-medium text-slate-400">
                {ruleType === 'price_drop_percent' ? 'Drop threshold (%)' : 'Price threshold'}
                <input
                  required
                  type="number"
                  min="0"
                  max={ruleType === 'price_drop_percent' ? '100' : undefined}
                  step="0.01"
                  value={threshold}
                  onChange={(event) => setThreshold(event.target.value)}
                  className="min-h-11 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white outline-none focus:border-violet-400/40"
                />
              </label>
            ) : null}
            <label className="grid gap-2 text-xs font-medium text-slate-400">
              Scope to source (optional)
              <select
                value={sourceId}
                onChange={(event) => setSourceId(event.target.value)}
                className="min-h-11 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white outline-none"
              >
                <option value="">All sources</option>
                {(sources.data ?? []).map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-xs font-medium text-slate-400">
              Scope to product (optional)
              <select
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                className="min-h-11 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white outline-none"
              >
                <option value="">All products</option>
                {(products.data?.items ?? []).map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </label>
          </div>
          {createRule.error ? <p className="mt-4 text-sm text-rose-300">{createRule.error.message}</p> : null}
          <button
            type="submit"
            disabled={createRule.isPending}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-40"
          >
            <BellRing className="size-4" /> {createRule.isPending ? 'Creating…' : 'Create active rule'}
          </button>
        </form>

        <article className="overflow-hidden rounded-2xl border border-white/8 bg-[#0a101c]/80">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Active rule library</h2>
              <p className="mt-1 text-xs text-slate-500">{rules.data?.length ?? 0} persisted rules</p>
            </div>
            <ShieldAlert className="size-5 text-amber-300" aria-hidden="true" />
          </div>
          {rules.data?.length ? (
            <div className="divide-y divide-white/[0.06]">
              {rules.data.map((rule) => (
                <div key={rule.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-200">{rule.name}</h3>
                      <StatusBadge status={rule.is_active ? 'active' : 'inactive'} />
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {rule.rule_type.replaceAll('_', ' ')}
                      {rule.threshold !== null ? ` · threshold ${rule.threshold}` : ''}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs text-slate-500">Last triggered</p>
                    <p className="mt-1 text-xs text-slate-300">{formatDate(rule.last_triggered_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 sm:p-6">
              <EmptyState title="No alert rules" description="Create a rule to evaluate new product observations automatically." />
            </div>
          )}
        </article>
      </section>

      <section className="mt-7 overflow-hidden rounded-2xl border border-white/8 bg-[#0a101c]/80">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-rose-300" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-200">Triggered events</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">Auto-refreshes every 10 seconds</p>
          </div>
          <select
            value={eventStatus}
            onChange={(event) => setEventStatus(event.target.value)}
            aria-label="Filter alert events"
            className="min-h-10 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-xs text-slate-300 outline-none"
          >
            <option value="open">Open events</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="">All events</option>
          </select>
        </div>
        {events.data?.length ? (
          <div className="divide-y divide-white/[0.06]">
            {events.data.map((item) => (
              <article key={item.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[1fr_auto] lg:items-center sm:px-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={item.status} />
                    <time className="text-xs text-slate-600">{formatDate(item.triggered_at)}</time>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{item.message}</p>
                  <p className="mt-2 font-mono text-[10px] text-slate-700">Observation {item.observation_id}</p>
                </div>
                {item.status === 'open' ? (
                  <button
                    type="button"
                    disabled={acknowledge.isPending}
                    onClick={() => acknowledge.mutate(item.id)}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.07] px-3 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-40"
                  >
                    <CheckCheck className="size-4" /> Acknowledge
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            <EmptyState title="No alert events in this view" description="Events appear after new observations satisfy active rules." />
          </div>
        )}
      </section>
    </div>
  );
}
