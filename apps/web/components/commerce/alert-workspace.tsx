'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  BellRing,
  CheckCheck,
  CircleAlert,
  Plus,
  RadioTower,
  Search,
  ShieldCheck,
  Tag,
  X,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

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
  const [eventSearch, setEventSearch] = useState('');
  const [showRuleForm, setShowRuleForm] = useState(false);

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
      setShowRuleForm(false);
      void queryClient.invalidateQueries({ queryKey: ['commerce'] });
    },
  });
  const acknowledge = useMutation({
    mutationFn: (eventId: string) =>
      commerceRequest<AlertEvent>(`alerts/events/${eventId}/acknowledge`, { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['commerce'] }),
  });

  const eventItems = useMemo(() => events.data ?? [], [events.data]);
  const filteredEvents = useMemo(() => {
    const query = eventSearch.trim().toLowerCase();
    if (!query) return eventItems;
    return eventItems.filter((item) => item.message.toLowerCase().includes(query));
  }, [eventItems, eventSearch]);

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

  const ruleItems = rules.data ?? [];
  const activeRules = ruleItems.filter((rule) => rule.is_active).length;
  const sourceItems = sources.data ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Signal monitoring"
        title="Alerts"
        description="Create evidence-based price and availability rules, then review events generated from persisted product observations."
        actions={<button type="button" className="nx-button" onClick={() => setShowRuleForm(!showRuleForm)}><Plus className="size-4" aria-hidden="true" /> New alert</button>}
      />

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Alert metrics">
        {[
          { label: 'Active rules', value: activeRules, icon: ShieldCheck, tone: 'text-[var(--emerald)]' },
          { label: `${eventStatus || 'All'} events`, value: eventItems.length, icon: BellRing, tone: 'text-[var(--amber)]' },
          { label: 'Tracked products', value: products.data?.total ?? 0, icon: Tag, tone: 'text-[var(--violet)]' },
          { label: 'Active sources', value: sourceItems.length, icon: RadioTower, tone: 'text-[var(--blue)]' },
        ].map((metric) => {
          const Icon = metric.icon;
          return <article key={metric.label} className="nx-panel flex items-center gap-3 p-3.5 sm:p-4"><span className={`grid size-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] ${metric.tone}`}><Icon className="size-4" aria-hidden="true" /></span><div><p className="text-[9px] font-bold uppercase tracking-[0.11em] text-[var(--faint)]">{metric.label}</p><p className="mt-1 text-[18px] font-semibold tracking-[-0.04em] text-[var(--text)]">{metric.value}</p></div></article>;
        })}
      </section>

      {showRuleForm ? (
        <form onSubmit={submit} className="nx-panel mt-4 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5 sm:px-5">
            <div><p className="nx-kicker">Monitoring policy</p><h2 className="mt-1.5 text-[12px] font-semibold text-[var(--text)]">Create alert</h2></div>
            <button type="button" className="nx-button-quiet !min-h-9 !px-2.5" aria-label="Close" onClick={() => setShowRuleForm(false)}><X className="size-4" aria-hidden="true" /></button>
          </div>
          <div className="grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-5">
            <label className="nx-label xl:col-span-2">Name<input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder="Price dropped 10%" className="nx-input" /></label>
            <label className="nx-label xl:col-span-2">Condition<select value={ruleType} onChange={(event) => setRuleType(event.target.value)} className="nx-input"><option value="price_drop_percent">Price drops by percentage</option><option value="price_below">Price falls below amount</option><option value="out_of_stock">Product goes out of stock</option></select></label>
            {ruleType !== 'out_of_stock' ? <label className="nx-label">{ruleType === 'price_drop_percent' ? 'Percentage' : 'Amount'}<input required type="number" min="0" max={ruleType === 'price_drop_percent' ? '100' : undefined} step="0.01" value={threshold} onChange={(event) => setThreshold(event.target.value)} className="nx-input" /></label> : <div className="hidden xl:block" />}
            <label className="nx-label xl:col-span-2">Source<select value={sourceId} onChange={(event) => setSourceId(event.target.value)} className="nx-input"><option value="">All sources</option>{sourceItems.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
            <label className="nx-label xl:col-span-2">Product<select value={productId} onChange={(event) => setProductId(event.target.value)} className="nx-input"><option value="">All products</option>{(products.data?.items ?? []).map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          </div>
          {createRule.error ? <p role="alert" className="mx-4 mb-3 text-[11px] text-[#ff9aad] sm:mx-5">{createRule.error.message}</p> : null}
          <div className="flex justify-end gap-2 border-t border-white/[0.07] px-4 py-3 sm:px-5"><button type="button" className="nx-button-secondary" onClick={() => setShowRuleForm(false)}>Cancel</button><button type="submit" disabled={createRule.isPending} className="nx-button">{createRule.isPending ? 'Creating…' : 'Create alert'}</button></div>
        </form>
      ) : null}

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <article className="nx-panel min-w-0 overflow-hidden">
          <div className="border-b border-white/[0.07] p-3.5 sm:p-4">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2"><AlertCircle className="size-4 text-[var(--amber)]" aria-hidden="true" /><div><h2 className="text-[12px] font-semibold text-[var(--text)]">Event inbox</h2><p className="mt-1 text-[8px] text-[var(--faint)]">Updates every 10 seconds</p></div></div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:w-[340px]">
                <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--faint)]" aria-hidden="true" /><span className="sr-only">Search alert events</span><input value={eventSearch} onChange={(event) => setEventSearch(event.target.value)} className="nx-input !min-h-9 pl-9 !text-[10px]" placeholder="Search events" /></label>
                <select value={eventStatus} onChange={(event) => setEventStatus(event.target.value)} aria-label="Filter alerts" className="nx-input !min-h-9 !w-auto !py-1.5 !text-[10px]"><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="">All</option></select>
              </div>
            </div>
          </div>
          {acknowledge.error ? <p role="alert" className="border-b border-[var(--red)]/16 bg-[var(--red)]/[0.06] px-5 py-3 text-[10px] text-[#ff9aad]">{acknowledge.error.message}</p> : null}
          {filteredEvents.length ? (
            <div className="divide-y divide-white/[0.065]">
              {filteredEvents.map((item) => (
                <article key={item.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
                  <div><div className="flex flex-wrap items-center gap-2"><StatusBadge status={item.status} /><time className="text-[8px] text-[var(--faint)]">{formatDate(item.triggered_at)}</time></div><p className="mt-2.5 text-[11px] leading-5 text-[var(--text)]">{item.message}</p><p className="mt-1.5 truncate text-[8px] text-[var(--faint)]">Event {item.id} · Observation {item.observation_id}</p></div>
                  {item.status === 'open' ? <button type="button" disabled={acknowledge.isPending} onClick={() => acknowledge.mutate(item.id)} className="nx-button-secondary !min-h-9 !px-3 !text-[10px]"><CheckCheck className="size-3.5" aria-hidden="true" /> Mark reviewed</button> : <span className="inline-flex items-center gap-1.5 text-[9px] text-[var(--muted)]"><CheckCheck className="size-3.5 text-[var(--emerald)]" aria-hidden="true" />Reviewed</span>}
                </article>
              ))}
            </div>
          ) : <div className="p-5"><EmptyState title={eventSearch ? 'No matching alerts' : 'No alerts here'} description={eventSearch ? 'Try a broader event search.' : 'New price and stock events will appear automatically.'} /></div>}
        </article>

        <aside className="nx-panel h-fit overflow-hidden xl:sticky xl:top-20">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5 sm:px-5"><div><p className="nx-kicker">Policies</p><h2 className="mt-1.5 text-[12px] font-semibold text-[var(--text)]">Rules</h2></div><span className="rounded-full border border-white/[0.09] bg-white/[0.025] px-2 py-1 text-[8px] font-semibold text-[var(--muted)]">{ruleItems.length}</span></div>
          {ruleItems.length ? (
            <div className="divide-y divide-white/[0.065]">
              {ruleItems.map((rule) => (
                <div key={rule.id} className="px-4 py-4 sm:px-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold text-[var(--text)]">{rule.name}</p><p className="mt-1 text-[9px] leading-4 text-[var(--muted)]">{conditionLabel(rule)}</p></div><StatusBadge status={rule.is_active ? 'active' : 'inactive'} /></div>{rule.last_triggered_at ? <p className="mt-2.5 inline-flex items-center gap-1.5 text-[8px] text-[var(--faint)]"><CircleAlert className="size-3 text-[var(--amber)]" aria-hidden="true" />Last triggered {formatDate(rule.last_triggered_at)}</p> : null}</div>
              ))}
            </div>
          ) : <div className="p-5"><EmptyState title="No alert rules" description="Create a price or stock rule to begin monitoring persisted observations." /></div>}
        </aside>
      </section>
    </div>
  );
}
