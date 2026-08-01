'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BellRing,
  Bot,
  CheckCircle2,
  Download,
  FileBarChart,
  Gauge,
  PackageSearch,
  RefreshCw,
  Rows3,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/commerce/primitives';
import { PageHeader } from '@/components/page-header';
import {
  commerceRequest,
  formatDate,
  type AIInsight,
  type AlertEvent,
  type Job,
  type Overview,
  type ProductPage,
} from '@/lib/commerce-client';

type ReportType = 'products' | 'automation' | 'alerts' | 'insights';
type ExportCell = string | number | boolean | null | undefined;

const reportDefinitions = [
  { type: 'products' as const, title: 'Product evidence', description: 'Latest normalized product observation, availability, and source.', icon: PackageSearch },
  { type: 'automation' as const, title: 'Automation ledger', description: 'Persisted job status, trigger, attempts, and timestamps.', icon: Activity },
  { type: 'alerts' as const, title: 'Alert events', description: 'Triggered monitoring events and review state.', icon: BellRing },
  { type: 'insights' as const, title: 'AI insights', description: 'Saved local-model output with confidence and provenance.', icon: Sparkles },
];

function csvCell(value: ExportCell) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function saveCsv(filename: string, rows: Record<string, ExportCell>[]) {
  const [firstRow] = rows;
  if (!firstRow) return;
  const headers = Object.keys(firstRow);
  const content = [headers.map(csvCell).join(','), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function reportRows(
  type: ReportType,
  products: ProductPage,
  jobs: Job[],
  alerts: AlertEvent[],
  insights: AIInsight[],
): Record<string, ExportCell>[] {
  if (type === 'products') {
    return products.items.map((item) => ({
      product_id: item.id,
      product_name: item.name,
      source: item.source_name,
      brand: item.brand,
      category: item.category,
      price: item.latest_observation?.price,
      currency: item.currency,
      availability: item.latest_observation?.availability,
      observed_at: item.latest_observation?.observed_at,
      evidence_url: item.latest_observation?.source_url,
    }));
  }
  if (type === 'automation') {
    return jobs.map((job) => ({
      job_id: job.id,
      source_id: job.source_id,
      job_type: job.job_type,
      status: job.status,
      trigger: job.trigger,
      attempt: job.attempt,
      max_attempts: job.max_attempts,
      queued_at: job.queued_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
      error: job.error_message,
    }));
  }
  if (type === 'alerts') {
    return alerts.map((event) => ({
      event_id: event.id,
      rule_id: event.rule_id,
      product_id: event.product_id,
      observation_id: event.observation_id,
      status: event.status,
      message: event.message,
      triggered_at: event.triggered_at,
      acknowledged_at: event.acknowledged_at,
    }));
  }
  return insights.map((insight) => ({
    insight_id: insight.id,
    product_name: insight.product_name,
    source: insight.source_name,
    kind: insight.kind,
    model: insight.model,
    confidence: insight.confidence,
    content: insight.content,
    recommended_action: insight.evidence.recommended_action,
    generated_at: insight.generated_at,
  }));
}

export function ReportWorkspace() {
  const [reportType, setReportType] = useState<ReportType>('products');
  const [exportedAt, setExportedAt] = useState<Date | null>(null);

  const overview = useQuery({ queryKey: ['commerce', 'overview', 'reports'], queryFn: () => commerceRequest<Overview>('overview') });
  const products = useQuery({ queryKey: ['commerce', 'products', 'reports'], queryFn: () => commerceRequest<ProductPage>('products?limit=100') });
  const jobs = useQuery({ queryKey: ['commerce', 'jobs', 'reports'], queryFn: () => commerceRequest<Job[]>('jobs?limit=100') });
  const alerts = useQuery({ queryKey: ['commerce', 'alert-events', 'reports'], queryFn: () => commerceRequest<AlertEvent[]>('alerts/events?limit=100') });
  const insights = useQuery({ queryKey: ['commerce', 'ai-insights', 'reports'], queryFn: () => commerceRequest<AIInsight[]>('ai/insights?limit=200') });

  const loading = overview.isLoading || products.isLoading || jobs.isLoading || alerts.isLoading || insights.isLoading;
  const error = overview.error ?? products.error ?? jobs.error ?? alerts.error ?? insights.error;
  const productData = useMemo(
    () => products.data ?? { items: [], total: 0, limit: 100, offset: 0 },
    [products.data],
  );
  const jobData = useMemo(() => jobs.data ?? [], [jobs.data]);
  const alertData = useMemo(() => alerts.data ?? [], [alerts.data]);
  const insightData = useMemo(() => insights.data ?? [], [insights.data]);
  const rows = useMemo(() => reportRows(reportType, productData, jobData, alertData, insightData), [alertData, insightData, jobData, productData, reportType]);

  if (loading) return <LoadingState label="Preparing reports" />;
  if (error) return <ErrorState message={error.message} />;

  const runningJobs = jobData.filter((job) => ['queued', 'running'].includes(job.status)).length;
  const openAlerts = alertData.filter((event) => event.status === 'open').length;
  const activity = overview.data?.activity ?? [];
  const selectedDefinition = reportDefinitions.find((item) => item.type === reportType) ?? reportDefinitions[0]!;
  const previewHeaders = rows[0] ? Object.keys(rows[0]).slice(0, 6) : [];

  function downloadReport() {
    if (!rows.length) return;
    const day = new Date().toISOString().slice(0, 10);
    saveCsv(`nexora-${reportType}-${day}.csv`, rows);
    setExportedAt(new Date());
  }

  return (
    <div>
      <PageHeader
        eyebrow="Operational reporting"
        title="Reports"
        description="Review and export only the evidence, runs, events, and model output already persisted by NEXORA."
        actions={<button type="button" className="nx-button-secondary" onClick={() => void Promise.all([overview.refetch(), products.refetch(), jobs.refetch(), alerts.refetch(), insights.refetch()])}><RefreshCw className={`size-4 ${overview.isFetching || products.isFetching || jobs.isFetching || alerts.isFetching || insights.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh</button>}
      />

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Report metrics">
        {[
          { label: 'Products', value: overview.data?.products.total ?? productData.total, icon: PackageSearch, tone: 'text-[var(--blue)]' },
          { label: 'Observations', value: overview.data?.observations.total ?? 0, icon: Rows3, tone: 'text-[var(--violet)]' },
          { label: 'Jobs in flight', value: runningJobs, icon: Gauge, tone: 'text-[var(--amber)]' },
          { label: 'Open alerts', value: openAlerts, icon: BellRing, tone: 'text-[var(--red)]' },
        ].map((metric) => {
          const Icon = metric.icon;
          return <article key={metric.label} className="nx-panel flex items-center gap-3 p-3.5 sm:p-4"><span className={`grid size-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] ${metric.tone}`}><Icon className="size-4" aria-hidden="true" /></span><div><p className="text-[9px] font-bold uppercase tracking-[0.11em] text-[var(--faint)]">{metric.label}</p><p className="mt-1 text-[18px] font-semibold tracking-[-0.04em] text-[var(--text)]">{metric.value.toLocaleString()}</p></div></article>;
        })}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="nx-panel min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3.5 sm:px-5"><div><h2 className="text-[12px] font-semibold text-[var(--text)]">Fourteen-day activity</h2><p className="mt-1 text-[9px] text-[var(--faint)]">Real observations, jobs, and alert events by persisted date</p></div><time className="text-[8px] text-[var(--faint)]">Generated {formatDate(overview.data?.generated_at)}</time></div>
          {activity.length ? (
            <div className="h-[260px] p-3 sm:p-4" aria-label="Fourteen-day operational activity chart">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={activity} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><XAxis dataKey="day" tickFormatter={(value: string) => value.slice(5)} tick={{ fill: '#758097', fontSize: 8 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: '#758097', fontSize: 8 }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: 'rgba(255,255,255,.025)' }} contentStyle={{ background: '#0c1422', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, fontSize: 10 }} /><Bar dataKey="observations" fill="#5b8cff" radius={[3, 3, 0, 0]} /><Bar dataKey="jobs" fill="#9b6dff" radius={[3, 3, 0, 0]} /><Bar dataKey="alerts" fill="#f3b563" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer>
            </div>
          ) : <div className="p-5"><EmptyState title="No activity series yet" description="The report will chart persisted operational activity as it accumulates." /></div>}
        </article>

        <aside className="nx-panel h-fit overflow-hidden">
          <div className="border-b border-white/[0.07] px-4 py-3.5 sm:px-5"><p className="nx-kicker">Export center</p><h2 className="mt-1.5 text-[12px] font-semibold text-[var(--text)]">Build a CSV report</h2></div>
          <div className="grid gap-2 p-3">
            {reportDefinitions.map((definition) => {
              const Icon = definition.icon;
              const selected = definition.type === reportType;
              return <button key={definition.type} type="button" onClick={() => setReportType(definition.type)} className={`flex items-start gap-3 rounded-xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/60 ${selected ? 'border-[var(--blue)]/30 bg-[var(--blue)]/[0.09]' : 'border-white/[0.07] bg-white/[0.018] hover:bg-white/[0.035]'}`}><Icon className={`mt-0.5 size-4 shrink-0 ${selected ? 'text-[var(--blue)]' : 'text-[var(--faint)]'}`} aria-hidden="true" /><span><span className="block text-[10px] font-semibold text-[var(--text)]">{definition.title}</span><span className="mt-1 block text-[8px] leading-3.5 text-[var(--faint)]">{definition.description}</span></span></button>;
            })}
          </div>
          <div className="border-t border-white/[0.07] p-4 sm:px-5"><p className="text-[9px] text-[var(--muted)]"><strong className="text-[var(--text)]">{rows.length}</strong> row{rows.length === 1 ? '' : 's'} ready from {selectedDefinition.title.toLowerCase()}.</p><button type="button" disabled={!rows.length} onClick={downloadReport} className="nx-button mt-3 w-full"><Download className="size-4" aria-hidden="true" /> Download CSV</button>{exportedAt ? <p role="status" className="mt-2 flex items-center gap-1.5 text-[8px] text-[#8ce9c3]"><CheckCircle2 className="size-3" aria-hidden="true" />Export prepared at {exportedAt.toLocaleTimeString()}</p> : null}</div>
        </aside>
      </section>

      <section className="nx-panel mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5 sm:px-5"><div><p className="nx-kicker">Preview</p><h2 className="mt-1.5 text-[12px] font-semibold text-[var(--text)]">{selectedDefinition.title}</h2></div><FileBarChart className="size-4 text-[var(--faint)]" aria-hidden="true" /></div>
        {rows.length ? (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-white/[0.07] bg-white/[0.018]">{previewHeaders.map((header) => <th key={header} className="px-4 py-2.5 text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]">{header.replaceAll('_', ' ')}</th>)}</tr></thead><tbody className="divide-y divide-white/[0.06]">{rows.slice(0, 8).map((row, index) => <tr key={`${reportType}-${index}`} className="hover:bg-white/[0.02]">{previewHeaders.map((header) => <td key={header} className="max-w-[240px] truncate px-4 py-3 text-[9px] text-[var(--muted)]" title={String(row[header] ?? '')}>{header === 'status' ? <StatusBadge status={String(row[header] ?? 'unknown')} /> : String(row[header] ?? '—')}</td>)}</tr>)}</tbody></table></div>
        ) : <div className="p-5"><EmptyState title={`No ${selectedDefinition.title.toLowerCase()} to report`} description="NEXORA will keep this honest empty state until persisted data exists." /></div>}
        {rows.length > 8 ? <p className="border-t border-white/[0.07] px-4 py-3 text-[8px] text-[var(--faint)] sm:px-5">Previewing 8 of {rows.length} rows. The CSV includes every row in the current report.</p> : null}
      </section>

      <div className="mt-4 rounded-xl border border-[var(--blue)]/16 bg-[var(--blue)]/[0.045] px-4 py-3 text-[9px] leading-4 text-[var(--muted)]"><Bot className="mr-2 inline size-3.5 text-[var(--blue)]" aria-hidden="true" /><strong className="text-[var(--text)]">Data policy:</strong> exports are generated locally in your browser from current API responses; no fabricated values are added.</div>
    </div>
  );
}
