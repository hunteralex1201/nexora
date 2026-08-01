'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, ExternalLink, Search } from 'lucide-react';
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
  formatMoney,
  type Product,
  type ProductDetail,
  type ProductPage,
} from '@/lib/commerce-client';

function PriceChange({ value }: { value: string | null }) {
  if (value === null) return <span className="text-xs text-[#9d998f]">New</span>;
  const number = Number(value);
  if (number === 0) return <span className="text-xs text-[#858178]">No change</span>;
  const down = number < 0;
  const Icon = down ? ArrowDownRight : ArrowUpRight;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${down ? 'text-[#287a55]' : 'text-[#a5463c]'}`}
    >
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
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`grid w-full gap-3 px-5 py-4 text-left sm:grid-cols-[minmax(0,1.5fr)_0.7fr_0.55fr_auto] sm:items-center ${
        selected ? 'bg-[#f4f1eb]' : 'hover:bg-[#faf9f6]'
      }`}
    >
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-[#3b3933]">{product.name}</p>
        <p className="mt-1 truncate text-[11px] text-[#9d998f]">{product.source_name}</p>
      </div>
      <div>
        <p className="text-[13px] font-semibold text-[#272622]">
          {formatMoney(observation?.price, observation?.currency ?? product.currency)}
        </p>
        <p className="mt-1 text-[11px] text-[#9d998f]">
          {observation ? formatDate(observation.observed_at) : 'No price'}
        </p>
      </div>
      <div>
        <PriceChange value={product.price_change_percent} />
        {product.previous_price ? (
          <p className="mt-1 text-[11px] text-[#9d998f]">
            was {formatMoney(product.previous_price, product.currency)}
          </p>
        ) : null}
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
          label: new Date(item.observed_at).toLocaleDateString('en-BD', {
            month: 'short',
            day: 'numeric',
          }),
          price: Number(item.price),
        })),
    [detail.data],
  );

  if (detail.isLoading) return <LoadingState label="Loading product" />;
  if (detail.error) return <ErrorState message={detail.error.message} />;
  if (!detail.data) return null;

  const product = detail.data;
  const latest = product.latest_observation;

  return (
    <aside className="nx-panel p-5 xl:sticky xl:top-20 xl:self-start sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-6 tracking-[-0.02em] text-[#272622]">
            {product.name}
          </h2>
          <p className="mt-1 text-xs text-[#8f8b81]">{product.source_name}</p>
        </div>
        <a
          href={product.canonical_url}
          target="_blank"
          rel="noreferrer"
          aria-label="Open product page"
          className="nx-button-secondary !size-9 !min-h-9 !p-0"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4 border-b border-[#ece9e2] pb-5">
        <div>
          <p className="text-[11px] text-[#9d998f]">Current price</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[#272622]">
            {formatMoney(latest?.price, latest?.currency ?? product.currency)}
          </p>
        </div>
        <PriceChange value={product.price_change_percent} />
      </div>

      <div className="mt-5 h-56">
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="#ece9e2" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#8f8b81', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#8f8b81', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  background: '#ffffff',
                  border: '1px solid #dedbd2',
                  borderRadius: 10,
                  fontSize: 12,
                  boxShadow: '0 12px 30px rgba(44,40,32,.08)',
                }}
                formatter={(value) => [formatMoney(String(value), product.currency), 'Price']}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#b85c3d"
                strokeWidth={2.2}
                dot={{ fill: '#b85c3d', r: 2.5 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center rounded-xl bg-[#faf9f6] text-xs text-[#9d998f]">
            More price history will appear here
          </div>
        )}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[#ece9e2] pt-5 text-xs">
        <div>
          <dt className="text-[#9d998f]">Availability</dt>
          <dd className="mt-1 capitalize text-[#4b4943]">{latest?.availability ?? 'Unknown'}</dd>
        </div>
        <div>
          <dt className="text-[#9d998f]">Price records</dt>
          <dd className="mt-1 text-[#4b4943]">{product.history.length}</dd>
        </div>
        <div>
          <dt className="text-[#9d998f]">Last checked</dt>
          <dd className="mt-1 text-[#4b4943]">{formatDate(latest?.observed_at)}</dd>
        </div>
        <div>
          <dt className="text-[#9d998f]">Collector</dt>
          <dd className="mt-1 capitalize text-[#4b4943]">{latest?.collector ?? '—'}</dd>
        </div>
      </dl>
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
    placeholderData: keepPreviousData,
  });

  if (products.isLoading) return <LoadingState label="Loading products" />;
  if (products.error) return <ErrorState message={products.error.message} />;

  const items = products.data?.items ?? [];
  const selected = selectedProductId ?? items[0]?.id ?? null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Products" description="Search products and review current prices." />
      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.65fr)]">
        <section className="nx-panel overflow-hidden">
          <div className="border-b border-[#e4e1d9] p-4">
            <label className="relative block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9d998f]"
                aria-hidden="true"
              />
              <span className="sr-only">Search products</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="nx-input pl-10"
                placeholder="Search products"
              />
            </label>
            <p className="mt-2 px-1 text-[11px] text-[#9d998f]">
              {products.data?.total ?? 0} products
            </p>
          </div>
          {items.length ? (
            <div className="divide-y divide-[#ece9e2]">
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
            <div className="p-5">
              <EmptyState
                title={deferredSearch ? 'No matching products' : 'No products yet'}
                description={
                  deferredSearch ? 'Try another search.' : 'Add a source or import a product file.'
                }
              />
            </div>
          )}
        </section>
        {selected ? (
          <ProductInspector productId={selected} />
        ) : (
          <EmptyState title="Select a product" />
        )}
      </div>
    </div>
  );
}
