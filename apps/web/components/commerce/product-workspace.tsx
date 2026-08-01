'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowUpRight,
  DatabaseZap,
  ExternalLink,
  Filter,
  Hash,
  PackageSearch,
  RadioTower,
  Search,
  ShieldCheck,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
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
  if (value === null) return <span className="text-[10px] text-[var(--faint)]">New</span>;
  const number = Number(value);
  if (number === 0) return <span className="text-[10px] text-[var(--muted)]">No change</span>;
  const down = number < 0;
  const Icon = down ? ArrowDownRight : ArrowUpRight;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${down ? 'text-[#8ce9c3]' : 'text-[#ff9aad]'}`}>
      <Icon className="size-3.5" aria-hidden="true" /> {Math.abs(number).toFixed(2)}%
    </span>
  );
}

function ProductRow({
  product,
  selected,
  onSelect,
}: {
  product: Product;
  selected: boolean;
  onSelect: () => void;
}) {
  const observation = product.latest_observation;
  const initial = product.name.trim().charAt(0).toUpperCase() || 'P';
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group grid w-full gap-3 px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--blue)]/60 sm:grid-cols-[minmax(230px,1.45fr)_minmax(115px,0.62fr)_minmax(92px,0.42fr)_minmax(92px,auto)] sm:items-center sm:px-5 ${
        selected
          ? 'bg-[linear-gradient(90deg,rgba(91,140,255,0.12),rgba(91,140,255,0.025))] shadow-[inset_3px_0_0_var(--blue)]'
          : 'hover:bg-white/[0.028]'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl border text-[12px] font-bold ${selected ? 'border-[var(--blue)]/25 bg-[var(--blue)]/[0.1] text-[var(--blue-strong)]' : 'border-white/[0.08] bg-white/[0.03] text-[var(--faint)] group-hover:text-[var(--muted)]'}`}>
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-[var(--text)]">{product.name}</p>
          <p className="mt-1 truncate text-[9px] text-[var(--faint)]">
            {[product.brand, product.category, product.source_name].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      <div>
        <p className="text-[12px] font-semibold text-[var(--text)]">
          {formatMoney(observation?.price, observation?.currency ?? product.currency)}
        </p>
        <p className="mt-1 text-[9px] text-[var(--faint)]">{observation ? formatDate(observation.observed_at) : 'No evidence'}</p>
      </div>
      <div>
        <PriceChange value={product.price_change_percent} />
        {product.previous_price ? (
          <p className="mt-1 text-[9px] text-[var(--faint)]">was {formatMoney(product.previous_price, product.currency)}</p>
        ) : null}
      </div>
      <div className="sm:justify-self-end">
        <StatusBadge status={observation?.availability ?? 'unknown'} />
      </div>
    </button>
  );
}

function EvidenceRow({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Hash }) {
  return (
    <div className="flex items-start gap-2.5 border-b border-white/[0.06] py-2.5 last:border-b-0">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-[var(--faint)]" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--faint)]">{label}</p>
        <p className="mt-1 truncate text-[9px] text-[var(--muted)]" title={value}>{value}</p>
      </div>
    </div>
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
        })),
    [detail.data],
  );

  if (detail.isLoading) return <LoadingState label="Loading product evidence" />;
  if (detail.error) return <ErrorState message={detail.error.message} />;
  if (!detail.data)
    return (
      <aside className="nx-panel p-5 xl:sticky xl:top-20 xl:self-start">
        <EmptyState
          title="Product evidence unavailable"
          description="The selected product returned no detail record. Choose another product or refresh the workspace."
        />
      </aside>
    );

  const product = detail.data;
  const latest = product.latest_observation;

  return (
    <aside className="nx-panel overflow-hidden xl:sticky xl:top-20 xl:self-start">
      <div className="border-b border-white/[0.07] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="nx-kicker">Evidence inspector</p>
            <h2 className="mt-2 text-[16px] font-semibold leading-6 tracking-[-0.025em] text-[var(--text)]">{product.name}</h2>
            <p className="mt-1 text-[9px] text-[var(--faint)]">{product.source_name} · {product.external_id}</p>
          </div>
          <a href={product.canonical_url} target="_blank" rel="noreferrer" aria-label="Open product page" className="nx-icon-button">
            <ExternalLink className="size-4" aria-hidden="true" />
          </a>
        </div>

        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">Current price</p>
            <p className="mt-1 text-[25px] font-semibold tracking-[-0.05em] text-[var(--text)]">
              {formatMoney(latest?.price, latest?.currency ?? product.currency)}
            </p>
          </div>
          <PriceChange value={product.price_change_percent} />
        </div>
      </div>

      <div className="h-52 border-b border-white/[0.07] px-2 pb-3 pt-4">
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="product-price-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5b8cff" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#5b8cff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(148,163,184,0.08)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#0b1120', border: '1px solid rgba(148,163,184,.16)', borderRadius: 10, fontSize: 10, boxShadow: '0 14px 40px rgba(0,0,0,.45)' }}
                labelStyle={{ color: '#9aa8bd' }}
                formatter={(value) => [formatMoney(String(value), product.currency), 'Price']}
              />
              <Area type="monotone" dataKey="price" stroke="#5b8cff" strokeWidth={2} fill="url(#product-price-fill)" activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center rounded-xl border border-dashed border-white/[0.1] bg-white/[0.018] text-[10px] text-[var(--faint)]">
            More price history will appear here
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-px border-b border-white/[0.07] bg-white/[0.06]">
        <div className="bg-[var(--surface-1)] p-3.5">
          <dt className="text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--faint)]">Availability</dt>
          <dd className="mt-1.5 capitalize text-[10px] font-semibold text-[var(--text)]">{latest?.availability ?? 'Unknown'}</dd>
        </div>
        <div className="bg-[var(--surface-1)] p-3.5">
          <dt className="text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--faint)]">Price records</dt>
          <dd className="mt-1.5 text-[10px] font-semibold text-[var(--text)]">{product.history.length}</dd>
        </div>
        <div className="bg-[var(--surface-1)] p-3.5">
          <dt className="text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--faint)]">Last checked</dt>
          <dd className="mt-1.5 text-[10px] font-semibold text-[var(--text)]">{formatDate(latest?.observed_at)}</dd>
        </div>
        <div className="bg-[var(--surface-1)] p-3.5">
          <dt className="text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--faint)]">Collector</dt>
          <dd className="mt-1.5 capitalize text-[10px] font-semibold text-[var(--text)]">{latest?.collector ?? '—'}</dd>
        </div>
      </dl>

      <div className="p-4 sm:px-5">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--faint)]">Evidence provenance</p>
          {latest?.evidence_hash ? <ShieldCheck className="size-3.5 text-[var(--emerald)]" aria-label="Evidence hash available" /> : null}
        </div>
        <div className="mt-2">
          <EvidenceRow label="Evidence hash" value={latest?.evidence_hash ?? 'Not recorded'} icon={Hash} />
          <EvidenceRow label="Seller" value={latest?.seller_name ?? 'Not recorded'} icon={RadioTower} />
          <EvidenceRow label="Rating" value={latest?.rating ? `${latest.rating} · ${latest.review_count ?? 0} reviews` : 'Not recorded'} icon={Star} />
        </div>
      </div>
    </aside>
  );
}

export function ProductWorkspace() {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const deferredSearch = useDeferredValue(search);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const query = new URLSearchParams(window.location.search).get('q')?.trim();
      if (query) {
        setSearch(query.slice(0, 200));
        searchRef.current?.focus();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const products = useQuery({
    queryKey: ['commerce', 'products', deferredSearch],
    queryFn: () => commerceRequest<ProductPage>(`products?limit=100&search=${encodeURIComponent(deferredSearch.trim())}`),
    placeholderData: keepPreviousData,
  });

  const items = useMemo(() => products.data?.items ?? [], [products.data?.items]);
  const sources = useMemo(() => [...new Set(items.map((item) => item.source_name))].sort(), [items]);
  const categories = useMemo(() => [...new Set(items.map((item) => item.category).filter((value): value is string => Boolean(value)))].sort(), [items]);
  const visibleItems = useMemo(
    () =>
      items.filter((item) => {
        if (sourceFilter !== 'all' && item.source_name !== sourceFilter) return false;
        if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
        if (availabilityFilter !== 'all' && item.latest_observation?.availability !== availabilityFilter) return false;
        return true;
      }),
    [availabilityFilter, categoryFilter, items, sourceFilter],
  );

  if (products.isLoading) return <LoadingState label="Loading products" />;
  if (products.error) return <ErrorState message={products.error.message} />;

  const selected =
    visibleItems.find((item) => item.id === selectedProductId)?.id ?? visibleItems[0]?.id ?? null;
  const activeCount = items.filter((item) => item.is_active).length;
  const changedCount = items.filter((item) => Number(item.price_change_percent ?? 0) !== 0).length;

  return (
    <div>
      <PageHeader
        eyebrow="Product intelligence"
        title="Products"
        description="Search tracked products, compare current evidence, and inspect price provenance from connected sources."
        actions={
          <Link href="/sources" className="nx-button-secondary">
            <RadioTower className="size-4" aria-hidden="true" /> Manage sources
          </Link>
        }
      />

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Product workspace metrics">
        {[
          { label: 'Total products', value: products.data?.total ?? 0, icon: PackageSearch, tone: 'text-[var(--blue)]' },
          { label: 'Loaded records', value: items.length, icon: DatabaseZap, tone: 'text-[var(--violet)]' },
          { label: 'Active loaded', value: activeCount, icon: ShieldCheck, tone: 'text-[var(--emerald)]' },
          { label: 'Price changes', value: changedCount, icon: ArrowDownRight, tone: 'text-[var(--orange)]' },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className="nx-panel flex items-center gap-3 p-3.5 sm:p-4">
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] ${metric.tone}`}><Icon className="size-4" aria-hidden="true" /></span>
              <div><p className="text-[9px] font-bold uppercase tracking-[0.11em] text-[var(--faint)]">{metric.label}</p><p className="mt-1 text-[18px] font-semibold tracking-[-0.04em] text-[var(--text)]">{metric.value.toLocaleString()}</p></div>
            </article>
          );
        })}
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(350px,0.65fr)]">
        <section className="nx-panel min-w-0 overflow-hidden">
          <div className="border-b border-white/[0.07] p-3.5 sm:p-4">
            <div className="flex flex-col gap-2.5 md:flex-row">
              <label className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--faint)]" aria-hidden="true" />
                <span className="sr-only">Search products</span>
                <input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} className="nx-input pl-10" placeholder="Search products, brand, category, or external ID" />
              </label>
              <div className="grid grid-cols-3 gap-2 md:flex">
                <label className="sr-only" htmlFor="product-source-filter">Filter by source</label>
                <select id="product-source-filter" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="nx-input min-w-0 md:w-36">
                  <option value="all">All sources</option>{sources.map((source) => <option key={source} value={source}>{source}</option>)}
                </select>
                <label className="sr-only" htmlFor="product-category-filter">Filter by category</label>
                <select id="product-category-filter" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="nx-input min-w-0 md:w-36">
                  <option value="all">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                <label className="sr-only" htmlFor="product-stock-filter">Filter by availability</label>
                <select id="product-stock-filter" value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)} className="nx-input min-w-0 md:w-32">
                  <option value="all">All status</option><option value="in_stock">In stock</option><option value="out_of_stock">Out of stock</option><option value="preorder">Preorder</option><option value="unknown">Unknown</option>
                </select>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between px-1 text-[9px] text-[var(--faint)]">
              <span>{visibleItems.length} shown · {products.data?.total ?? 0} total</span>
              <span className="inline-flex items-center gap-1"><Filter className="size-3" aria-hidden="true" />Live filters</span>
            </div>
          </div>
          {visibleItems.length ? (
            <div className="divide-y divide-white/[0.065]">
              {visibleItems.map((product) => (
                <ProductRow key={product.id} product={product} selected={selected === product.id} onSelect={() => setSelectedProductId(product.id)} />
              ))}
            </div>
          ) : (
            <div className="p-5">
              <EmptyState title={deferredSearch || sourceFilter !== 'all' || categoryFilter !== 'all' || availabilityFilter !== 'all' ? 'No matching products' : 'No products yet'} description={deferredSearch ? 'Try a broader search or clear a filter.' : 'Add a source or import a product file.'} />
            </div>
          )}
        </section>
        {selected ? <ProductInspector productId={selected} /> : <EmptyState title="Select a product" />}
      </div>
    </div>
  );
}
