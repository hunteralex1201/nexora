'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  DatabaseZap,
  FileSearch,
  Filter,
  Gauge,
  Lightbulb,
  RadioTower,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { EmptyState, ErrorState, LoadingState } from '@/components/commerce/primitives';
import { PageHeader } from '@/components/page-header';
import { commerceRequest, formatDate, type AIInsight } from '@/lib/commerce-client';

function label(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function confidenceScore(value: string | null) {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, parsed <= 1 ? parsed * 100 : parsed));
}

function confidenceTone(score: number | null) {
  if (score === null) return { text: 'Not scored', color: 'var(--faint)', bar: 'rgba(148,163,184,.34)' };
  if (score >= 80) return { text: `${score.toFixed(0)}%`, color: '#8ce9c3', bar: 'var(--emerald)' };
  if (score >= 60) return { text: `${score.toFixed(0)}%`, color: '#f7c889', bar: 'var(--amber)' };
  return { text: `${score.toFixed(0)}%`, color: '#ff9aad', bar: 'var(--red)' };
}

function InsightCard({ insight }: { insight: AIInsight }) {
  const score = confidenceScore(insight.confidence);
  const confidence = confidenceTone(score);
  const rationale = Array.isArray(insight.evidence.rationale) ? insight.evidence.rationale : [];
  const facts = insight.evidence.facts ? Object.entries(insight.evidence.facts).slice(0, 4) : [];
  const prompt = encodeURIComponent(
    `Review this saved ${label(insight.kind)} insight for ${insight.product_name}. Explain the operational implications and what evidence I should verify next. Saved insight: ${insight.content}`,
  );

  return (
    <article className="nx-panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] p-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--violet)]/20 bg-[var(--violet)]/[0.08] text-[var(--violet)]">
            <BrainCircuit className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[12px] font-semibold text-[var(--text)]">{insight.product_name}</h2>
              <span className="rounded-full border border-[var(--blue)]/16 bg-[var(--blue)]/[0.065] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.09em] text-[#a8c1ff]">{label(insight.kind)}</span>
            </div>
            <p className="mt-1 text-[9px] text-[var(--faint)]">{insight.source_name} · {formatDate(insight.generated_at)}</p>
          </div>
        </div>
        <div className="w-24">
          <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]"><span>Confidence</span><span style={{ color: confidence.color }}>{confidence.text}</span></div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: `${score ?? 0}%`, background: confidence.bar }} /></div>
        </div>
      </div>

      <div className="p-4 sm:px-5">
        <p className="whitespace-pre-wrap text-[11px] leading-6 text-[#d5deeb]">{insight.content}</p>

        {insight.evidence.recommended_action ? (
          <div className="mt-4 rounded-xl border border-[var(--emerald)]/16 bg-[var(--emerald)]/[0.055] p-3.5">
            <p className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-[0.12em] text-[#8ce9c3]"><Lightbulb className="size-3.5" aria-hidden="true" />Recommended action</p>
            <p className="mt-2 text-[10px] leading-5 text-[var(--text)]">{insight.evidence.recommended_action}</p>
          </div>
        ) : null}

        {rationale.length || facts.length ? (
          <details className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.018] px-3.5 py-3 open:bg-white/[0.025]">
            <summary className="cursor-pointer text-[9px] font-semibold text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/60">Inspect supporting evidence</summary>
            {rationale.length ? (
              <ul className="mt-3 space-y-2 text-[9px] leading-4 text-[var(--muted)]">
                {rationale.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--blue)]" />{item}</li>)}
              </ul>
            ) : null}
            {facts.length ? (
              <dl className="mt-3 grid gap-px overflow-hidden rounded-lg bg-white/[0.07] sm:grid-cols-2">
                {facts.map(([key, value]) => (
                  <div key={key} className="min-w-0 bg-[var(--surface-1)] p-2.5"><dt className="text-[7px] font-bold uppercase tracking-[0.11em] text-[var(--faint)]">{label(key)}</dt><dd className="mt-1 truncate text-[9px] text-[var(--muted)]" title={String(value)}>{String(value)}</dd></div>
                ))}
              </dl>
            ) : null}
          </details>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] px-4 py-3 sm:px-5">
        <span className="text-[8px] text-[var(--faint)]">{insight.model} · prompt {insight.prompt_version}</span>
        <Link href={`/ai?prompt=${prompt}`} className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-[var(--blue-strong)] hover:text-white">
          Explore with Copilot <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

export function MarketWorkspace() {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');

  const insights = useQuery({
    queryKey: ['commerce', 'ai-insights'],
    queryFn: () => commerceRequest<AIInsight[]>('ai/insights?limit=200'),
  });

  const items = useMemo(() => insights.data ?? [], [insights.data]);
  const sources = useMemo(() => [...new Set(items.map((item) => item.source_name))].sort(), [items]);
  const kinds = useMemo(() => [...new Set(items.map((item) => item.kind))].sort(), [items]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (sourceFilter !== 'all' && item.source_name !== sourceFilter) return false;
      if (kindFilter !== 'all' && item.kind !== kindFilter) return false;
      if (!query) return true;
      return `${item.product_name} ${item.source_name} ${item.kind} ${item.content} ${item.evidence.recommended_action ?? ''}`.toLowerCase().includes(query);
    });
  }, [items, kindFilter, search, sourceFilter]);

  const productsCovered = new Set(items.map((item) => item.product_id)).size;
  const scored = items.map((item) => confidenceScore(item.confidence)).filter((value): value is number => value !== null);
  const averageConfidence = scored.length ? Math.round(scored.reduce((sum, value) => sum + value, 0) / scored.length) : null;
  const evidenceLinks = items.reduce((sum, item) => sum + (item.evidence.observation_ids?.length ?? 0), 0);

  if (insights.isLoading) return <LoadingState label="Loading market intelligence" />;
  if (insights.error) return <ErrorState message={insights.error.message} />;

  return (
    <div>
      <PageHeader
        eyebrow="Evidence-backed analysis"
        title="Market Intelligence"
        description="Review persisted local-model insights with confidence, rationale, and source provenance—never invented market metrics."
        actions={
          <Link href="/jobs" className="nx-button">
            <Sparkles className="size-4" aria-hidden="true" /> Run AI analysis
          </Link>
        }
      />

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Market intelligence metrics">
        {[
          { label: 'Saved insights', value: items.length.toLocaleString(), icon: BrainCircuit, tone: 'text-[var(--violet)]' },
          { label: 'Products covered', value: productsCovered.toLocaleString(), icon: FileSearch, tone: 'text-[var(--blue)]' },
          { label: 'Evidence links', value: evidenceLinks.toLocaleString(), icon: ShieldCheck, tone: 'text-[var(--emerald)]' },
          { label: 'Avg confidence', value: averageConfidence === null ? '—' : `${averageConfidence}%`, icon: Gauge, tone: 'text-[var(--amber)]' },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className="nx-panel flex items-center gap-3 p-3.5 sm:p-4">
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] ${metric.tone}`}><Icon className="size-4" aria-hidden="true" /></span>
              <div><p className="text-[9px] font-bold uppercase tracking-[0.11em] text-[var(--faint)]">{metric.label}</p><p className="mt-1 text-[18px] font-semibold tracking-[-0.04em] text-[var(--text)]">{metric.value}</p></div>
            </article>
          );
        })}
      </section>

      <section className="nx-panel mt-4 overflow-hidden">
        <div className="border-b border-white/[0.07] p-3.5 sm:p-4">
          <div className="flex flex-col gap-2.5 md:flex-row">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--faint)]" aria-hidden="true" />
              <span className="sr-only">Search insights</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="nx-input pl-10" placeholder="Search products, analysis, or recommended actions" />
            </label>
            <div className="grid grid-cols-2 gap-2 md:flex">
              <label className="sr-only" htmlFor="insight-source-filter">Filter insight source</label>
              <select id="insight-source-filter" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="nx-input min-w-0 md:w-40"><option value="all">All sources</option>{sources.map((source) => <option key={source} value={source}>{source}</option>)}</select>
              <label className="sr-only" htmlFor="insight-kind-filter">Filter insight type</label>
              <select id="insight-kind-filter" value={kindFilter} onChange={(event) => setKindFilter(event.target.value)} className="nx-input min-w-0 md:w-40"><option value="all">All insight types</option>{kinds.map((kind) => <option key={kind} value={kind}>{label(kind)}</option>)}</select>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between px-1 text-[9px] text-[var(--faint)]"><span>{filtered.length} shown · {items.length} saved</span><span className="inline-flex items-center gap-1"><Filter className="size-3" aria-hidden="true" />Persisted model output</span></div>
        </div>
      </section>

      {filtered.length ? (
        <div className="mt-4 grid gap-4 2xl:grid-cols-2">{filtered.map((insight) => <InsightCard key={insight.id} insight={insight} />)}</div>
      ) : (
        <div className="nx-panel mt-4 p-5">
          <EmptyState
            title={items.length ? 'No matching insights' : 'No market insights yet'}
            description={items.length ? 'Try a broader search or clear the current filters.' : 'Queue an AI analysis job from Automation. Saved output will appear here with its model, confidence, and evidence.'}
            action={!items.length ? <Link href="/jobs" className="nx-button"><Bot className="size-4" aria-hidden="true" /> Open Automation</Link> : undefined}
          />
        </div>
      )}

      {items.length ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <article className="nx-panel p-4"><RadioTower className="size-4 text-[var(--blue)]" aria-hidden="true" /><p className="mt-3 text-[9px] font-bold uppercase tracking-[0.11em] text-[var(--faint)]">Sources represented</p><p className="mt-1 text-[18px] font-semibold text-[var(--text)]">{sources.length}</p></article>
          <article className="nx-panel p-4"><DatabaseZap className="size-4 text-[var(--emerald)]" aria-hidden="true" /><p className="mt-3 text-[9px] font-bold uppercase tracking-[0.11em] text-[var(--faint)]">Evidence principle</p><p className="mt-1 text-[10px] leading-5 text-[var(--muted)]">Only persisted analysis is displayed; absence remains visible as absence.</p></article>
          <article className="nx-panel p-4"><ShieldCheck className="size-4 text-[var(--amber)]" aria-hidden="true" /><p className="mt-3 text-[9px] font-bold uppercase tracking-[0.11em] text-[var(--faint)]">Review policy</p><p className="mt-1 text-[10px] leading-5 text-[var(--muted)]">Confidence is model-supplied context, not a guarantee. Verify facts before execution.</p></article>
        </div>
      ) : null}
    </div>
  );
}
