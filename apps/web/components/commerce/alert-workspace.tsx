'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCheck, Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import {
  EmptyState,
  ErrorState,
  LoadingState,
  StatusBadge,
} from '@/components/commerce/primitives';
import { PageHeader } from '@/components/page-header';
import {
  commerceRequest,
  formatDate,
  type AlertEvent,
  type AlertRule,
  type ProductPage,
  type Source,
} from '@/lib/commerce-client';

function conditionLabel(rule: AlertRule): string {
  if (rule.rule_type === 'out_of_stock') return 'When a product goes out of stock';
  if (rule.rule_type === 'price_below') return `When price falls below ${rule.threshold ?? '—'}`;
  return `When price drops ${rule.threshold ?? '—'}%`;
}

export function AlertWorkspace() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [ruleType, setRuleType] = useState('price_drop_percent');
  const [threshold, setThreshold] = useState('10');
  const [sourceId, setSourceId] = useState('');
  const [productId, setProductId] = useState('');
  const [eventStatus, setEventStatus] = useState('open');
  const [showRuleForm, setShowRuleForm] = useState(false);

  const rules = useQuery({
    queryKey: ['commerce', 'alert-rules'],
    queryFn: () => commerceRequest<AlertRule[]>('alerts/rules'),
  });
  const events = useQuery({
    queryKey: ['commerce', 'alert-events', eventStatus],
    queryFn: () =>
      commerceRequest<AlertEvent[]>(
        `alerts/events?limit=100${eventStatus ? `&status=${eventStatus}` : ''}`,
      ),
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
      setShowRuleForm(false);
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

  if (rules.isLoading || events.isLoading || sources.isLoading || products.isLoading)
    return <LoadingState label="Loading alerts" />;
  const firstError = rules.error ?? events.error ?? sources.error ?? products.error;
  if (firstError) return <ErrorState message={firstError.message} />;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Alerts"
        description="Get notified when a price or availability changes."
        actions={
          <button
            type="button"
            className="nx-button"
            onClick={() => setShowRuleForm(!showRuleForm)}
          >
            <Plus className="size-4" aria-hidden="true" /> New alert
          </button>
        }
      />

      {showRuleForm ? (
        <form onSubmit={submit} className="nx-panel mt-6 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#3b3933]">Create alert</h2>
            <button
              type="button"
              className="nx-button-quiet !min-h-9 !px-2.5"
              aria-label="Close"
              onClick={() => setShowRuleForm(false)}
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="nx-label">
              Name
              <input
                required
                minLength={2}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Price dropped 10%"
                className="nx-input"
              />
            </label>
            <label className="nx-label">
              Condition
              <select
                value={ruleType}
                onChange={(event) => setRuleType(event.target.value)}
                className="nx-input"
              >
                <option value="price_drop_percent">Price drops by percentage</option>
                <option value="price_below">Price falls below amount</option>
                <option value="out_of_stock">Product goes out of stock</option>
              </select>
            </label>
            {ruleType !== 'out_of_stock' ? (
              <label className="nx-label">
                {ruleType === 'price_drop_percent' ? 'Percentage' : 'Amount'}
                <input
                  required
                  type="number"
                  min="0"
                  max={ruleType === 'price_drop_percent' ? '100' : undefined}
                  step="0.01"
                  value={threshold}
                  onChange={(event) => setThreshold(event.target.value)}
                  className="nx-input"
                />
              </label>
            ) : null}
            <label className="nx-label">
              Source
              <select
                value={sourceId}
                onChange={(event) => setSourceId(event.target.value)}
                className="nx-input"
              >
                <option value="">All sources</option>
                {(sources.data ?? []).map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="nx-label">
              Product
              <select
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                className="nx-input"
              >
                <option value="">All products</option>
                {(products.data?.items ?? []).map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {createRule.error ? (
            <p className="mt-4 text-[13px] text-[#a5463c]">{createRule.error.message}</p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="nx-button-secondary"
              onClick={() => setShowRuleForm(false)}
            >
              Cancel
            </button>
            <button type="submit" disabled={createRule.isPending} className="nx-button">
              {createRule.isPending ? 'Creating…' : 'Create alert'}
            </button>
          </div>
        </form>
      ) : null}

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="nx-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e1d9] px-5 py-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-[#a5463c]" aria-hidden="true" />
              <h2 className="text-[13px] font-semibold text-[#3b3933]">Events</h2>
            </div>
            <select
              value={eventStatus}
              onChange={(event) => setEventStatus(event.target.value)}
              aria-label="Filter alerts"
              className="nx-input !min-h-9 !w-auto !py-1.5 !text-xs"
            >
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="">All</option>
            </select>
          </div>
          {acknowledge.error ? (
            <p className="border-b border-[#eccbc6] bg-[#f9eae7] px-5 py-3 text-[13px] text-[#96534b]">
              {acknowledge.error.message}
            </p>
          ) : null}
          {events.data?.length ? (
            <div className="divide-y divide-[#ece9e2]">
              {events.data.map((item) => (
                <article
                  key={item.id}
                  className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={item.status} />
                      <time className="text-[11px] text-[#9d998f]">
                        {formatDate(item.triggered_at)}
                      </time>
                    </div>
                    <p className="mt-2.5 text-[13px] leading-5 text-[#4b4943]">{item.message}</p>
                  </div>
                  {item.status === 'open' ? (
                    <button
                      type="button"
                      disabled={acknowledge.isPending}
                      onClick={() => acknowledge.mutate(item.id)}
                      className="nx-button-secondary !min-h-9 !px-3 !text-xs"
                    >
                      <CheckCheck className="size-3.5" aria-hidden="true" /> Mark reviewed
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                title="No alerts here"
                description="New price and stock events will appear automatically."
              />
            </div>
          )}
        </article>

        <aside className="nx-panel h-fit overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#e4e1d9] px-5 py-4">
            <h2 className="text-[13px] font-semibold text-[#3b3933]">Rules</h2>
            <span className="text-xs text-[#8f8b81]">{rules.data?.length ?? 0}</span>
          </div>
          {rules.data?.length ? (
            <div className="divide-y divide-[#ece9e2]">
              {rules.data.map((rule) => (
                <div key={rule.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-semibold text-[#3b3933]">{rule.name}</p>
                      <p className="mt-1 text-xs leading-5 text-[#858178]">
                        {conditionLabel(rule)}
                      </p>
                    </div>
                    <StatusBadge status={rule.is_active ? 'active' : 'inactive'} />
                  </div>
                  {rule.last_triggered_at ? (
                    <p className="mt-2 text-[11px] text-[#9d998f]">
                      Last triggered {formatDate(rule.last_triggered_at)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5">
              <EmptyState title="No alert rules" />
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
