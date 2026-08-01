'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, ArrowRight, Database, PackageSearch, RadioTower } from 'lucide-react';
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

  if (overview.isLoading) return <LoadingState label="Loading operational overview" />;
  if (overview.error) return <ErrorState message={overview.error.message} />;
  if (!overview.data) return null;

  const data = overview.data;
  const openAlerts = data.alerts.open ?? 0;
  const queuedJobs = (data.jobs.queued ?? 0) + (data.jobs.running ?? 0);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Live workspace"
        title="Commerce operations at a glance."
        description="Every value below comes from persisted sources, immutable price observations, background jobs, and evaluated alert rules. The workspace refreshes automatically."
        actions={
          <Link
            href="/sources"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/25 transition hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          >
            Add data source
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        }
      />

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Generated {formatDate(data.generated_at)} · refreshes every 15 seconds
        </p>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-xs font-medium text-emerald-200">
          <span className="status-pulse size-2 rounded-full bg-emerald-400" aria-hidden="true" />
          Live API data
        </span>
      </div>

      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Commerce metrics">
        <MetricCard
          label="Active sources"
          value={`${data.sources.active ?? 0}/${data.sources.total}`}
          detail="Operator-managed data origins"
          tone="text-cyan-200"
        />
        <MetricCard
          label="Products"
          value={data.products.total.toLocaleString()}
          detail="Canonical products with source identity"
          tone="text-violet-200"
        />
        <MetricCard
          label="Price observations"
          value={data.observations.total.toLocaleString()}
          detail={`Latest ${formatDate(data.latest_observation_at)}`}
          tone="text-emerald-200"
        />
        <MetricCard
          label="Open alerts"
          value={openAlerts.toLocaleString()}
          detail={`${queuedJobs} jobs queued or running`}
          tone={openAlerts > 0 ? 'text-rose-200' : 'text-amber-200'}
        />
      </section>

      {data.sources.total === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Connect the first evidence source"
            description="Create a fixture or approved JSON-LD source, then import products or queue a collection job. NEXORA will preserve every price observation and evaluate active alerts."
            action={
              <Link
                href="/sources"
                className="inline-flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-100 hover:bg-violet-500/15"
              >
                Configure sources <ArrowRight className="size-4" />
              </Link>
            }
          />
        </div>
      ) : null}

      <section className="mt-7 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="overflow-hidden rounded-2xl border border-white/8 bg-[#0a101c]/80">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4 sm:px-6">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Activity className="size-4 text-cyan-300" aria-hidden="true" />
                Recent jobs
              </div>
              <p className="mt-1 text-xs text-slate-500">Worker execution and retry state</p>
            </div>
            <Link href="/jobs" className="text-xs font-semibold text-violet-300 hover:text-violet-200">
              View all
            </Link>
          </div>
          {data.recent_jobs.length ? (
            <div className="divide-y divide-white/[0.06]">
              {data.recent_jobs.map((job) => (
                <div key={job.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:px-6">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-slate-300">{job.id}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {job.job_type.replaceAll('_', ' ')} · {job.trigger} · attempt {job.attempt}/{job.max_attempts}
                    </p>
                  </div>
                  <StatusBadge status={job.status} />
                  <time className="text-xs text-slate-500">{formatDate(job.created_at)}</time>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-sm text-slate-500">No background jobs have been queued.</div>
          )}
        </article>

        <article className="overflow-hidden rounded-2xl border border-white/8 bg-[#0a101c]/80">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <AlertTriangle className="size-4 text-amber-300" aria-hidden="true" />
                Recent alerts
              </div>
              <p className="mt-1 text-xs text-slate-500">Evidence-triggered rules</p>
            </div>
            <Link href="/alerts" className="text-xs font-semibold text-violet-300 hover:text-violet-200">
              Manage
            </Link>
          </div>
          {data.recent_alerts.length ? (
            <div className="divide-y divide-white/[0.06]">
              {data.recent_alerts.map((alert) => (
                <div key={alert.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm leading-5 text-slate-300">{alert.message}</p>
                    <StatusBadge status={alert.status} />
                  </div>
                  <p className="mt-2 text-xs text-slate-600">{formatDate(alert.triggered_at)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-sm text-slate-500">No alert rule has fired.</div>
          )}
        </article>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          { href: '/sources', label: 'Sources & imports', detail: 'Register origins and ingest operator data', icon: RadioTower },
          { href: '/products', label: 'Products & prices', detail: 'Inspect history and evidence hashes', icon: PackageSearch },
          { href: '/jobs', label: 'Collection jobs', detail: 'Queue, monitor, and diagnose execution', icon: Database },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-2xl border border-white/8 bg-white/[0.022] p-5 transition hover:-translate-y-0.5 hover:border-violet-400/20 hover:bg-violet-500/[0.04]"
            >
              <Icon className="size-5 text-violet-300" aria-hidden="true" />
              <h2 className="mt-4 text-sm font-semibold text-slate-200 group-hover:text-white">{item.label}</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
