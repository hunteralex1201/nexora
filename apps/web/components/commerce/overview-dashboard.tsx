'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowUpRight, Plus } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/page-header';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  StatusBadge,
} from '@/components/commerce/primitives';
import { commerceRequest, formatDate, type Overview } from '@/lib/commerce-client';

export function OverviewDashboard() {
  const overview = useQuery({
    queryKey: ['commerce', 'overview'],
    queryFn: () => commerceRequest<Overview>('overview'),
    refetchInterval: 15_000,
  });

  if (overview.isLoading) return <LoadingState label="Loading overview" />;
  if (overview.error) return <ErrorState message={overview.error.message} />;
  if (!overview.data) return null;

  const data = overview.data;
  const openAlerts = data.alerts.open ?? 0;
  const activeJobs = (data.jobs.queued ?? 0) + (data.jobs.running ?? 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Overview"
        description="Your products, prices, and automations in one place."
        actions={
          <Link href="/sources" className="nx-button">
            <Plus className="size-4" aria-hidden="true" />
            Add source
          </Link>
        }
      />

      <div className="mt-6 flex items-center gap-2 text-xs text-[#747168]">
        <span className="status-pulse size-2 rounded-full bg-[#287a55]" aria-hidden="true" />
        Live · Updated {formatDate(data.generated_at)}
      </div>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key metrics">
        <MetricCard
          label="Active sources"
          value={`${data.sources.active ?? 0}`}
          detail={`${data.sources.total} total`}
        />
        <MetricCard label="Products" value={data.products.total.toLocaleString()} />
        <MetricCard label="Price records" value={data.observations.total.toLocaleString()} />
        <MetricCard
          label="Needs attention"
          value={openAlerts.toLocaleString()}
          detail={`${activeJobs} jobs in progress`}
          tone={openAlerts > 0 ? 'text-[#a5463c]' : 'text-[#272622]'}
        />
      </section>

      {data.sources.total === 0 ? (
        <div className="mt-5">
          <EmptyState
            title="Add your first source"
            description="Connect a supported storefront or import product data to begin tracking prices."
            action={
              <Link href="/sources" className="nx-button">
                Add source
              </Link>
            }
          />
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="nx-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#e4e1d9] px-5 py-4">
            <h2 className="text-[13px] font-semibold text-[#3b3933]">Recent activity</h2>
            <Link
              href="/jobs"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#9d4b32] hover:text-[#783925]"
            >
              View all <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          {data.recent_jobs.length ? (
            <div className="divide-y divide-[#ece9e2]">
              {data.recent_jobs.slice(0, 6).map((job) => (
                <div
                  key={job.id}
                  className="grid gap-2 px-5 py-3.5 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium capitalize text-[#3b3933]">
                      {job.job_type.replaceAll('_', ' ')}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-[#9d998f]">{job.id}</p>
                  </div>
                  <StatusBadge status={job.status} />
                  <time className="text-[11px] text-[#8f8b81]">{formatDate(job.created_at)}</time>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center text-[13px] text-[#858178]">No recent jobs</div>
          )}
        </article>

        <article className="nx-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#e4e1d9] px-5 py-4">
            <h2 className="text-[13px] font-semibold text-[#3b3933]">Alerts</h2>
            <Link
              href="/alerts"
              className="text-xs font-semibold text-[#9d4b32] hover:text-[#783925]"
            >
              Manage
            </Link>
          </div>
          {data.recent_alerts.length ? (
            <div className="divide-y divide-[#ece9e2]">
              {data.recent_alerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="px-5 py-4">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle
                      className="mt-0.5 size-4 shrink-0 text-[#a5463c]"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] leading-5 text-[#4b4943]">{alert.message}</p>
                      <p className="mt-1.5 text-[11px] text-[#9d998f]">
                        {formatDate(alert.triggered_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-[13px] font-medium text-[#4b4943]">All clear</p>
              <p className="mt-1 text-xs text-[#9d998f]">No open alerts</p>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
