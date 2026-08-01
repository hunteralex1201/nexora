'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  Fingerprint,
  History,
  Search,
} from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/commerce/primitives';
import { PageHeader } from '@/components/page-header';
import {
  commerceRequest,
  formatDate,
  formatMoney,
  type Product,
  type ProductDetail,
  type ProductPage,
} from '@/lib/commerce-client';

function PriceChange({ value }: { value: string | null }) {
  if (value === null) return <span className="text-xs text-slate-600">No prior price</span>;
  const number = Number(value);
  if (number === 0) return <span className="text-xs text-slate-400">No change</span>;
  const down = number < 0;
  const Icon = down ? ArrowDownRight : ArrowUpRight;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${down ? 'text-emerald-300' : 'text-rose-300'}`}>
      <Icon className="size-3.5" aria-hidden="true" />
      {Math.abs(number).toFixed(2)}%
    </span>
  );
}

function ProductRow({ product, selected, onSelect }: { product: Product; selected: boolean; onSelect: () => void }) {
  const observation = product.latest_observation;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`grid w-full gap-3 px-5 py-4 text-left transition sm:grid-cols-[minmax(0,1.6fr)_0.7fr_0.65fr_0.5fr] sm:items-center sm:px-6 ${
        selected ? 'bg-violet-500/[0.08]' : 'hover:bg-white/[0.025]'
      }`}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-200">{product.name}</p>
        <p className="mt-1 truncate text-xs text-slate-600">
          {product.source_name} · {product.external_id}
        </p>
      </div>
      <div>
        <p className="text-sm font-semibold text-white">
          {formatMoney(observation?.price, observation?.currency ?? product.currency)}
        </p>
        <p className="mt-1 text-xs text-slate-600">{observation ? formatDate(observation.observed_at) : 'No observation'}</p>
      </div>
      <div>
        <PriceChange value={product.price_change_percent} />
        <p className="mt-1 text-xs text-slate-600">Prev. {formatMoney(product.previous_price, product.currency)}</p>
      </div>
      <div className="sm:text-right">
        <StatusBadge status={observation?.availability ?? 'unknown'} />
      </div>
    </button>
  );
}

function ProductInspector({ productId }: { productId: string }) {
  const detail = useQuery({
    queryKey: ['commerce', 'product', productId],
    queryFn: () => commerceRequest<ProductDetail>(`products/${productId}`),
  });

  const chartData = useMemo(
    () =>
      (detail.data?.history ?? [])
        .slice()
        .reverse()
        .map((item) => ({
          label: new Date(item.observed_at).toLocaleDateString('en-BD', { month: 'short', day: 'numeric' }),
          price: Number(item.price),
          observedAt: item.observed_at,
        })),
    [detail.data],
  );

  if (detail.isLoading) return <LoadingState label="Loading product evidence" />;
  if (detail.error) return <ErrorState message={detail.error.message} />;
  if (!detail.data) return null;

  const product = detail.data;
  const latest = product.latest_observation;

  return (
    <aside className="rounded-2xl border border-white/8 bg-[#0a101c]/90 p-5 xl:sticky xl:top-24 xl:self-start sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-violet-300">Product evidence</p>
          <h2 className="mt-2 text-lg font-semibold leading-6 text-white">{product.name}</h2>
          <p className="mt-1 text-xs text-slate-500">{product.source_name} · {product.external_id}</p>
        </div>
        <a
          href={product.canonical_url}
          target="_blank"
          rel="noreferrer"
          aria-label="Open source product page"
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-cyan-400/15 bg-cyan-500/[0.06] text-cyan-300 hover:bg-cyan-500/10"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
          <p className="text-[10px] uppercase tracking-[0.13em] text-slate-600">Latest price</p>
          <p className="mt-2 text-lg font-semibold text-emerald-200">
            {formatMoney(latest?.price, latest?.currency ?? product.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
          <p className="text-[10px] uppercase tracking-[0.13em] text-slate-600">Observations</p>
          <p className="mt-2 text-lg font-semibold text-cyan-200">{product.history.length}</p>
        </div>
      </div>

      <div className="mt-5 h-56 rounded-xl border border-white/[0.07] bg-slate-950/30 p-3">
        {chartData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="rgba(148,163,184,0.08)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(value) => [formatMoney(String(value), product.currency), 'Price']}
              />
              <Line type="monotone" dataKey="price" stroke="#8b5cf6" strokeWidth={2.2} dot={{ fill: '#22d3ee', r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center text-xs text-slate-600">No price history</div>
        )}
      </div>

      {latest ? (
        <div className="mt-5 space-y-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Fingerprint className="size-4 text-violet-300" aria-hidden="true" />
            Immutable evidence
          </div>
          <dl className="grid gap-3 text-xs">
            <div>
              <dt className="text-slate-600">Evidence hash</dt>
              <dd className="mt-1 break-all font-mono text-[10px] leading-4 text-slate-400">{latest.evidence_hash}</dd>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-slate-600">Collector</dt>
                <dd className="mt-1 text-slate-300">{latest.collector}</dd>
              </div>
              <div>
                <dt className="text-slate-600">Observed</dt>
                <dd className="mt-1 text-slate-300">{formatDate(latest.observed_at)}</dd>
              </div>
            </div>
          </dl>
        </div>
      ) : null}
    </aside>
  );
}

export function ProductWorkspace() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const products = useQuery({
    queryKey: ['commerce', 'products', deferredSearch],
    queryFn: () =>
      commerceRequest<ProductPage>(
        `products?limit=100&search=${encodeURIComponent(deferredSearch.trim())}`,
      ),
  });

  if (products.isLoading) return <LoadingState label="Loading products and prices" />;
  if (products.error) return <ErrorState message={products.error.message} />;

  const items = products.data?.items ?? [];
  const selected = selectedProductId ?? items[0]?.id ?? null;

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        eyebrow="Market evidence"
        title="Products, prices, and immutable observations."
        description="Search canonical products, compare the latest and previous prices, and inspect the exact evidence record used for every displayed value."
      />

      <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.65fr)]">
        <section className="overflow-hidden rounded-2xl border border-white/8 bg-[#0a101c]/80">
          <div className="border-b border-white/8 p-4 sm:p-5">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-600" aria-hidden="true" />
              <span className="sr-only">Search products</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/45 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-violet-400/40 focus:ring-2 focus:ring-violet-400/15"
                placeholder="Search product, brand, category, or external ID"
              />
            </label>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
              <span>{products.data?.total ?? 0} matching products</span>
              <span className="inline-flex items-center gap-1.5"><History className="size-3.5" /> Latest persisted evidence</span>
            </div>
          </div>
          {items.length ? (
            <div className="divide-y divide-white/[0.06]">
              {items.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  selected={selected === product.id}
                  onSelect={() => setSelectedProductId(product.id)}
                />
              ))}
            </div>
          ) : (
            <div className="p-5 sm:p-6">
              <EmptyState
                title={deferredSearch ? 'No products match this search' : 'No product observations yet'}
                description={deferredSearch ? 'Try a broader search term.' : 'Import an authorized CSV or JSON catalog from the Sources page, or run an approved collection job.'}
              />
            </div>
          )}
        </section>
        {selected ? (
          <ProductInspector productId={selected} />
        ) : (
          <EmptyState title="Select a product" description="Choose a product to inspect its price history and evidence record." />
        )}
      </div>
    </div>
  );
}
