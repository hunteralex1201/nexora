'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Boxes,
  CheckCircle2,
  CircleGauge,
  Clock3,
  DatabaseZap,
  PackageSearch,
  Plus,
  RadioTower,
  Sparkles,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
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
  type Job,
  type Overview,
  type OverviewActivityPoint,
} from '@/lib/commerce-client';

const numberFormatter = new Intl.NumberFormat('en-BD');
const dayFormatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

function ratio(value: number | null | undefined, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round(((value ?? 0) / total) * 100)));
}

function dateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function activitySeries(data: Overview) {
  const received = data.activity ?? [];
  if (received.length) {
    return received.map((point) => ({
      ...point,
      label: dayFormatter.format(new Date(`${point.day}T00:00:00Z`)),
    }));
  }

  const generatedAt = new Date(data.generated_at);
  const anchor = Number.isNaN(generatedAt.getTime()) ? new Date() : generatedAt;
  const points = new Map<string, OverviewActivityPoint>();

  for (let daysAgo = 13; daysAgo >= 0; daysAgo -= 1) {
    const day = new Date(anchor);
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - daysAgo);
    const key = day.toISOString().slice(0, 10);
    points.set(key, { day: key, observations: 0, jobs: 0, alerts: 0 });
  }

  data.recent_jobs.forEach((job) => {
    const key = dateKey(job.created_at);
    const point = key ? points.get(key) : undefined;
    if (point) point.jobs += 1;
  });
  data.recent_alerts.forEach((alert) => {
    const key = dateKey(alert.triggered_at);
    const point = key ? points.get(key) : undefined;
    if (point) point.alerts += 1;
  });

  return [...points.values()].map((point) => ({
    ...point,
    label: dayFormatter.format(new Date(`${point.day}T00:00:00Z`)),
  }));
}

function latestJob(jobs: Job[], type: string) {
  return jobs.find((job) => job.job_type === type);
}

function jobLabel(type: string) {
  const labels: Record<string, string> = {
    collect: 'Product collection',
    ai_analyze: 'Evidence AI analysis',
    alert_evaluate: 'Alert evaluation',
    import: 'Product import',
  };
  return labels[type] ?? type.replaceAll('_', ' ');
}

function MetricTile({
  label,
  value,
  detail,
  progress,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  progress: number;
  icon: typeof RadioTower;
  accent: 'blue' | 'violet' | 'orange' | 'red' | 'emerald';
}) {
  const tones = {
    blue: {
      icon: 'border-[var(--blue)]/18 bg-[var(--blue)]/[0.08] text-[var(--blue)]',
      bar: 'bg-[var(--blue)]',
    },
    violet: {
      icon: 'border-[var(--violet)]/18 bg-[var(--violet)]/[0.08] text-[var(--violet)]',
      bar: 'bg-[var(--violet)]',
    },
    orange: {
      icon: 'border-[var(--orange)]/18 bg-[var(--orange)]/[0.08] text-[var(--orange)]',
      bar: 'bg-[var(--orange)]',
    },
    red: {
      icon: 'border-[var(--red)]/18 bg-[var(--red)]/[0.08] text-[var(--red)]',
      bar: 'bg-[var(--red)]',
    },
    emerald: {
      icon: 'border-[var(--emerald)]/18 bg-[var(--emerald)]/[0.08] text-[var(--emerald)]',
      bar: 'bg-[var(--emerald)]',
    },
  }[accent];

  return (
    <article className="nx-panel relative overflow-hidden p-4 sm:p-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--faint)]">
            {label}
          </p>
          <p className="mt-2.5 text-[27px] font-semibold tracking-[-0.05em] text-[var(--text)]">
            {value}
          </p>
        </div>
        <span className={`grid size-9 place-items-center rounded-xl border ${tones.icon}`}>
          <Icon className="size-[17px]" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-1 text-[10px] leading-4 text-[var(--muted)]">{detail}</p>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
        <div className={`h-full rounded-full ${tones.bar}`} style={{ width: `${progress}%` }} />
      </div>
    </article>
  );
}

function AgentRow({
  title,
  description,
  job,
  icon: Icon,
}: {
  title: string;
  description: string;
  job?: Job;
  icon: typeof Bot;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.065] px-4 py-3.5 last:border-b-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-[var(--muted)]">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-[var(--text)]">{title}</p>
        <p className="mt-0.5 truncate text-[10px] text-[var(--faint)]">
          {job ? `${description} · ${formatDate(job.updated_at)}` : 'No run recorded yet'}
        </p>
      </div>
      {job ? <StatusBadge status={job.status} /> : <span className="text-[9px] text-[var(--faint)]">Idle</span>}
    </div>
  );
}

export function OverviewDashboard() {
  const overview = useQuery({
    queryKey: ['commerce', 'overview'],
    queryFn: () => commerceRequest<Overview>('overview'),
    refetchInterval: 15_000,
  });

  if (overview.isLoading) return <LoadingState label="Loading live workspace" />;
  if (overview.error) return <ErrorState message={overview.error.message} />;
  if (!overview.data)
    return (
      <EmptyState
        title="No overview data returned"
        description="The workspace responded without a summary. Refresh the page or check System Health."
        action={<Link href="/system" className="nx-button-secondary">Check system health</Link>}
      />
    );

  const data = overview.data;
  const openAlerts = data.alerts.open ?? 0;
  const activeJobs = (data.jobs.queued ?? 0) + (data.jobs.running ?? 0);
  const failedJobs = (data.jobs.failed ?? 0) + (data.jobs.dead ?? 0);
  const completeJobs = (data.jobs.succeeded ?? 0) + (data.jobs.completed ?? 0);
  const jobTotal = Object.values(data.jobs).reduce((sum, count) => sum + count, 0);
  const chartData = activitySeries(data);
  const collectJob = latestJob(data.recent_jobs, 'collect');
  const analysisJob = latestJob(data.recent_jobs, 'ai_analyze');
  const alertJob = latestJob(data.recent_jobs, 'alert_evaluate');

  return (
    <div>
      <PageHeader
        eyebrow="Commerce command center"
        title="Overview"
        description="Live product evidence, automation health, and risk signals across your NEXORA workspace."
        actions={
          <>
            <Link href="/jobs" className="nx-button-secondary">
              <Workflow className="size-4" aria-hidden="true" />
              Run automation
            </Link>
            <Link href="/sources" className="nx-button">
              <Plus className="size-4" aria-hidden="true" />
              Add source
            </Link>
          </>
        }
      />

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-white/[0.065] py-2.5 text-[10px] text-[var(--muted)]">
        <span className="inline-flex items-center gap-2 font-semibold text-[#99edcd]">
          <span className="status-pulse size-2 rounded-full bg-[var(--emerald)]" aria-hidden="true" />
          Live workspace
        </span>
        <span>Updated {formatDate(data.generated_at)}</span>
        <span>Latest evidence {formatDate(data.latest_observation_at)}</span>
        <Link href="/system" className="ml-auto inline-flex items-center gap-1.5 font-semibold text-[var(--blue-strong)] hover:text-white">
          View system health <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </div>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4" aria-label="Key metrics">
        <MetricTile
          label="Active sources"
          value={numberFormatter.format(data.sources.active ?? 0)}
          detail={`${numberFormatter.format(data.sources.total)} connected in total`}
          progress={ratio(data.sources.active, data.sources.total)}
          icon={RadioTower}
          accent="blue"
        />
        <MetricTile
          label="Tracked products"
          value={numberFormatter.format(data.products.total)}
          detail={`${numberFormatter.format(data.products.active ?? 0)} currently active`}
          progress={ratio(data.products.active, data.products.total)}
          icon={PackageSearch}
          accent="violet"
        />
        <MetricTile
          label="Evidence records"
          value={numberFormatter.format(data.observations.total)}
          detail={`Most recent ${formatDate(data.latest_observation_at)}`}
          progress={data.observations.total ? 100 : 0}
          icon={DatabaseZap}
          accent="orange"
        />
        <MetricTile
          label="Needs attention"
          value={numberFormatter.format(openAlerts + failedJobs)}
          detail={`${openAlerts} open alerts · ${activeJobs} runs in progress`}
          progress={openAlerts + failedJobs ? 100 : 8}
          icon={openAlerts + failedJobs ? AlertTriangle : CheckCircle2}
          accent={openAlerts + failedJobs ? 'red' : 'emerald'}
        />
      </section>

      {data.sources.total === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Add your first source"
            description="Connect a supported storefront or import product evidence to begin tracking prices and automation runs."
            action={
              <Link href="/sources" className="nx-button">
                Add source
              </Link>
            }
          />
        </div>
      ) : null}

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)] 2xl:grid-cols-[minmax(0,1.4fr)_minmax(250px,0.72fr)_minmax(300px,0.82fr)]">
        <article className="nx-panel min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] px-4 py-4 sm:px-5">
            <div>
              <p className="nx-kicker">Evidence flow</p>
              <h2 className="mt-1.5 text-[14px] font-semibold text-[var(--text)]">14-day activity</h2>
              <p className="mt-1 text-[10px] text-[var(--muted)]">Persisted observations, jobs, and alert events</p>
            </div>
            <div className="flex flex-wrap gap-3 text-[9px] font-medium text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[var(--blue)]" />Observations</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[var(--violet)]" />Jobs</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[var(--orange)]" />Alerts</span>
            </div>
          </div>
          <div className="h-[252px] px-1 pb-3 pt-4 sm:px-3" role="img" aria-label="Activity chart for the last fourteen days">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="observations-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5b8cff" stopOpacity={0.34} />
                    <stop offset="100%" stopColor="#5b8cff" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="jobs-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9b7bff" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#9b7bff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                  tick={{ fill: '#64748b', fontSize: 9 }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  width={34}
                  tick={{ fill: '#64748b', fontSize: 9 }}
                />
                <Tooltip
                  cursor={{ stroke: 'rgba(148,163,184,0.18)', strokeDasharray: '4 4' }}
                  contentStyle={{
                    border: '1px solid rgba(148,163,184,0.16)',
                    borderRadius: '12px',
                    background: '#0b1120',
                    boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
                    color: '#f5f7fb',
                    fontSize: '11px',
                  }}
                  labelStyle={{ color: '#9aa8bd', marginBottom: '4px' }}
                />
                <Area
                  type="monotone"
                  dataKey="observations"
                  stroke="#5b8cff"
                  strokeWidth={2}
                  fill="url(#observations-fill)"
                  activeDot={{ r: 3 }}
                />
                <Area
                  type="monotone"
                  dataKey="jobs"
                  stroke="#9b7bff"
                  strokeWidth={1.7}
                  fill="url(#jobs-fill)"
                  activeDot={{ r: 3 }}
                />
                <Area
                  type="monotone"
                  dataKey="alerts"
                  stroke="#f59e5b"
                  strokeWidth={1.6}
                  fill="transparent"
                  activeDot={{ r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="nx-panel overflow-hidden">
          <div className="flex items-start justify-between border-b border-white/[0.07] px-4 py-4">
            <div>
              <p className="nx-kicker">Agent operations</p>
              <h2 className="mt-1.5 text-[14px] font-semibold text-[var(--text)]">Execution pulse</h2>
            </div>
            <Link href="/agents" className="text-[10px] font-semibold text-[var(--blue-strong)] hover:text-white">
              Inspect
            </Link>
          </div>
          <div>
            <AgentRow title="Collection agent" description="Product evidence collection" job={collectJob} icon={RadioTower} />
            <AgentRow title="Intelligence agent" description="Evidence-bound AI analysis" job={analysisJob} icon={Sparkles} />
            <AgentRow title="Alert evaluator" description="Rule and event processing" job={alertJob} icon={CircleGauge} />
          </div>
          <div className="grid grid-cols-3 gap-px border-t border-white/[0.07] bg-white/[0.06]">
            <div className="bg-[var(--surface-1)] px-3 py-3 text-center">
              <p className="text-[16px] font-semibold text-[var(--text)]">{activeJobs}</p>
              <p className="mt-0.5 text-[8px] uppercase tracking-[0.12em] text-[var(--faint)]">Active</p>
            </div>
            <div className="bg-[var(--surface-1)] px-3 py-3 text-center">
              <p className="text-[16px] font-semibold text-[#8ce9c3]">{completeJobs}</p>
              <p className="mt-0.5 text-[8px] uppercase tracking-[0.12em] text-[var(--faint)]">Complete</p>
            </div>
            <div className="bg-[var(--surface-1)] px-3 py-3 text-center">
              <p className={`text-[16px] font-semibold ${failedJobs ? 'text-[#ff9aad]' : 'text-[var(--text)]'}`}>{failedJobs}</p>
              <p className="mt-0.5 text-[8px] uppercase tracking-[0.12em] text-[var(--faint)]">Failed</p>
            </div>
          </div>
        </article>

        <article className="nx-panel relative overflow-hidden xl:col-span-2 2xl:col-span-1">
          <div className="absolute -right-20 -top-20 size-52 rounded-full bg-[var(--violet)]/[0.08] blur-3xl" />
          <div className="relative border-b border-white/[0.07] px-4 py-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl border border-[var(--violet)]/20 bg-[var(--violet)]/[0.08] text-[var(--violet)]">
                <Sparkles className="size-[17px]" aria-hidden="true" />
              </span>
              <div>
                <p className="nx-kicker !text-[#bcaaff]">AI Copilot</p>
                <h2 className="mt-1 text-[14px] font-semibold text-[var(--text)]">Ask your workspace</h2>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-[var(--muted)]">
              Use the private local model to reason about product evidence, alerts, and operations.
            </p>
          </div>
          <form action="/ai" method="get" className="relative p-4">
            <label htmlFor="overview-ai-prompt" className="sr-only">Ask NEXORA AI</label>
            <textarea
              id="overview-ai-prompt"
              name="prompt"
              rows={3}
              placeholder="Ask about your commerce evidence…"
              className="nx-input min-h-[88px] resize-none pr-12"
            />
            <button
              type="submit"
              aria-label="Open AI Copilot with this prompt"
              className="absolute bottom-7 right-7 grid size-8 place-items-center rounded-lg bg-[var(--violet)] text-white shadow-[0_8px_24px_rgba(155,123,255,0.3)] hover:bg-[#aa8fff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--violet)]/60"
            >
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </form>
          <div className="border-t border-white/[0.07] px-4 py-3">
            <Link href="/ai?prompt=Summarize%20recent%20operations" className="flex items-center justify-between gap-3 py-1.5 text-[10px] text-[var(--muted)] hover:text-white">
              Summarize recent operations <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
            <Link href="/ai?prompt=Explain%20my%20latest%20alerts" className="flex items-center justify-between gap-3 py-1.5 text-[10px] text-[var(--muted)] hover:text-white">
              Explain my latest alerts <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          </div>
        </article>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <article className="nx-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-4 sm:px-5">
            <div>
              <p className="nx-kicker">Automation</p>
              <h2 className="mt-1.5 text-[14px] font-semibold text-[var(--text)]">Recent runs</h2>
            </div>
            <Link href="/jobs" className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[var(--blue-strong)] hover:text-white">
              View all <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          </div>
          {data.recent_jobs.length ? (
            <div className="divide-y divide-white/[0.065]">
              {data.recent_jobs.slice(0, 5).map((job) => (
                <div key={job.id} className="grid gap-2 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.025] text-[var(--faint)]">
                      <Boxes className="size-3.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-semibold text-[var(--text)]">{jobLabel(job.job_type)}</p>
                      <p className="mt-0.5 truncate text-[9px] text-[var(--faint)]">{job.id}</p>
                    </div>
                  </div>
                  <StatusBadge status={job.status} />
                  <time className="inline-flex items-center gap-1.5 text-[9px] text-[var(--faint)]">
                    <Clock3 className="size-3" aria-hidden="true" />
                    {formatDate(job.created_at)}
                  </time>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-[12px] font-medium text-[var(--text)]">No automation runs yet</p>
              <p className="mt-1 text-[10px] text-[var(--muted)]">Start a collection or analysis run when a source is ready.</p>
            </div>
          )}
          <div className="border-t border-white/[0.07] px-4 py-2.5 text-[9px] text-[var(--faint)] sm:px-5">
            {numberFormatter.format(jobTotal)} total recorded runs
          </div>
        </article>

        <article className="nx-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-4">
            <div>
              <p className="nx-kicker !text-[#f7c889]">Risk monitor</p>
              <h2 className="mt-1.5 text-[14px] font-semibold text-[var(--text)]">Latest alerts</h2>
            </div>
            <Link href="/alerts" className="text-[10px] font-semibold text-[var(--blue-strong)] hover:text-white">Manage</Link>
          </div>
          {data.recent_alerts.length ? (
            <div className="divide-y divide-white/[0.065]">
              {data.recent_alerts.slice(0, 4).map((alert) => (
                <div key={alert.id} className="px-4 py-3.5">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--red)]/[0.08] text-[var(--red)]">
                      <AlertTriangle className="size-3.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] leading-4.5 text-[var(--text)]">{alert.message}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <StatusBadge status={alert.status} />
                        <time className="text-[9px] text-[var(--faint)]">{formatDate(alert.triggered_at)}</time>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid min-h-48 place-items-center px-5 py-10 text-center">
              <div>
                <span className="mx-auto grid size-10 place-items-center rounded-xl bg-[var(--emerald)]/[0.08] text-[var(--emerald)]">
                  <CheckCircle2 className="size-[18px]" aria-hidden="true" />
                </span>
                <p className="mt-3 text-[12px] font-semibold text-[var(--text)]">All clear</p>
                <p className="mt-1 text-[10px] text-[var(--muted)]">No alert events are recorded.</p>
              </div>
            </div>
          )}
        </article>
      </section>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.065] pt-3 text-[9px] text-[var(--faint)]">
        <span className="inline-flex items-center gap-1.5"><Activity className="size-3" aria-hidden="true" />Data refreshes every 15 seconds</span>
        <span>No revenue, lead, or third-party metrics are inferred</span>
      </footer>
    </div>
  );
}
