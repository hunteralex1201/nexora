'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Bot,
  Braces,
  CheckCircle2,
  CircleAlert,
  Code2,
  DatabaseZap,
  ExternalLink,
  FileJson2,
  GitBranch,
  KeyRound,
  RadioTower,
  Search,
  ServerCog,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { EmptyState, ErrorState, LoadingState } from '@/components/commerce/primitives';
import { PageHeader } from '@/components/page-header';
import {
  commerceRequest,
  formatDate,
  type AIReadiness,
  type ConnectorMetadata,
  type ConnectorRegistry,
  type Job,
  type Source,
} from '@/lib/commerce-client';

function connectorLabel(value: string) {
  if (value === 'jsonld') return 'JSON-LD Commerce';
  if (value === 'structured_html') return 'Structured HTML';
  if (value === 'fixture' || value === 'fixture_only') return 'Fixture / Test Data';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function ConnectorCard({ connectorId, metadata, assignments }: { connectorId: string; metadata: ConnectorMetadata; assignments: Source[] }) {
  const icon = connectorId === 'jsonld' ? FileJson2 : connectorId.includes('fixture') ? Braces : Code2;
  const Icon = icon;
  return (
    <article className="nx-panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] p-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--blue)]/18 bg-[var(--blue)]/[0.06] text-[var(--blue)]"><Icon className="size-[18px]" aria-hidden="true" /></span><div><p className="nx-kicker">Source connector</p><h2 className="mt-1.5 text-[13px] font-semibold text-[var(--text)]">{connectorLabel(connectorId)}</h2><p className="mt-1 text-[8px] text-[var(--faint)]">Owned by {metadata.owner} · {metadata.country}</p></div></div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--emerald)]/20 bg-[var(--emerald)]/[0.065] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.09em] text-[#8ce9c3]"><span className="size-1.5 rounded-full bg-[var(--emerald)]" />Registered</span>
      </div>
      <div className="grid grid-cols-3 gap-px border-b border-white/[0.07] bg-white/[0.06]">
        {[
          ['Connector', metadata.connector_version],
          ['Parser', metadata.parser_version],
          ['Assignments', String(assignments.length)],
        ].map(([term, value]) => <dl key={term} className="min-w-0 bg-[var(--surface-1)] p-3.5"><dt className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]">{term}</dt><dd className="mt-1.5 truncate text-[10px] font-semibold text-[var(--text)]">{value}</dd></dl>)}
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:px-5">
        <div><p className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]">Capabilities</p><div className="mt-2 flex flex-wrap gap-1.5">{metadata.capability_states.map((capability) => <span key={capability} className="rounded-md border border-white/[0.08] bg-white/[0.025] px-2 py-1 text-[8px] text-[var(--muted)]">{capability.replaceAll('_', ' ')}</span>)}</div></div>
        <div><p className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]">Supported fields</p><p className="mt-2 text-[9px] leading-4 text-[var(--muted)]">{metadata.supported_fields.join(', ') || 'No fields advertised'}</p></div>
      </div>
      <div className="flex items-center justify-between border-t border-white/[0.07] px-4 py-3 sm:px-5"><p className="text-[8px] text-[var(--faint)]">{assignments.length ? `${assignments.length} active source assignment${assignments.length === 1 ? '' : 's'}` : 'No active source assignment'}</p><Link href="/sources" className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-[var(--blue-strong)] hover:text-white">Manage sources <ArrowRight className="size-3" aria-hidden="true" /></Link></div>
    </article>
  );
}

export function IntegrationWorkspace() {
  const [search, setSearch] = useState('');
  const connectors = useQuery({ queryKey: ['commerce', 'connectors'], queryFn: () => commerceRequest<ConnectorRegistry>('connectors') });
  const sources = useQuery({ queryKey: ['commerce', 'sources', 'integrations'], queryFn: () => commerceRequest<Source[]>('sources?active=true') });
  const readiness = useQuery({ queryKey: ['commerce', 'ai-readiness'], queryFn: () => commerceRequest<AIReadiness>('ai/readiness') });
  const jobs = useQuery({ queryKey: ['commerce', 'jobs', 'integrations'], queryFn: () => commerceRequest<Job[]>('jobs?limit=100') });

  const entries = useMemo(() => Object.entries(connectors.data ?? {}), [connectors.data]);
  const sourceItems = useMemo(() => sources.data ?? [], [sources.data]);
  const jobItems = useMemo(() => jobs.data ?? [], [jobs.data]);
  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter(([id, metadata]) => `${id} ${connectorLabel(id)} ${metadata.owner} ${metadata.supported_fields.join(' ')} ${metadata.capability_states.join(' ')}`.toLowerCase().includes(query));
  }, [entries, search]);

  if (connectors.isLoading || sources.isLoading || readiness.isLoading || jobs.isLoading) return <LoadingState label="Loading integrations" />;
  const error = connectors.error ?? sources.error ?? readiness.error ?? jobs.error;
  if (error) return <ErrorState message={error.message} />;

  const n8nJobs = jobItems.filter((job) => job.trigger === 'n8n');
  const latestN8n = n8nJobs[0] ?? null;
  const aiReady = readiness.data?.status === 'ready';

  return (
    <div>
      <PageHeader
        eyebrow="Runtime registry"
        title="Integrations"
        description="Inspect the connectors and automation surfaces actually implemented by this deployment. Credentials and unsupported providers are never fabricated."
        actions={<Link href="/sources" className="nx-button"><DatabaseZap className="size-4" aria-hidden="true" /> Add source</Link>}
      />

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Integration metrics">
        {[
          { label: 'Registered connectors', value: entries.length, icon: GitBranch, tone: 'text-[var(--blue)]' },
          { label: 'Active assignments', value: sourceItems.length, icon: RadioTower, tone: 'text-[var(--emerald)]' },
          { label: 'Installed AI models', value: readiness.data?.installed_models.length ?? 0, icon: Bot, tone: 'text-[var(--violet)]' },
          { label: 'Observed n8n runs', value: n8nJobs.length, icon: Workflow, tone: 'text-[var(--amber)]' },
        ].map((metric) => {
          const Icon = metric.icon;
          return <article key={metric.label} className="nx-panel flex items-center gap-3 p-3.5 sm:p-4"><span className={`grid size-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] ${metric.tone}`}><Icon className="size-4" aria-hidden="true" /></span><div><p className="text-[9px] font-bold uppercase tracking-[0.11em] text-[var(--faint)]">{metric.label}</p><p className="mt-1 text-[18px] font-semibold tracking-[-0.04em] text-[var(--text)]">{metric.value}</p></div></article>;
        })}
      </section>

      <section className="nx-panel mt-4 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-white/[0.07] p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4"><div><p className="nx-kicker">Ingestion</p><h2 className="mt-1.5 text-[12px] font-semibold text-[var(--text)]">Source connector registry</h2></div><label className="relative sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--faint)]" aria-hidden="true" /><span className="sr-only">Search connectors</span><input value={search} onChange={(event) => setSearch(event.target.value)} className="nx-input !min-h-9 pl-9 !text-[10px]" placeholder="Search connectors or fields" /></label></div>
      </section>

      {filteredEntries.length ? <div className="mt-4 grid gap-4 2xl:grid-cols-2">{filteredEntries.map(([id, metadata]) => <ConnectorCard key={id} connectorId={id} metadata={metadata} assignments={sourceItems.filter((source) => source.type === id)} />)}</div> : <div className="nx-panel mt-4 p-5"><EmptyState title={entries.length ? 'No matching connectors' : 'No connectors registered'} description={entries.length ? 'Try a broader connector search.' : 'The backend connector registry returned no installed source integrations.'} /></div>}

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <article className="nx-panel overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] p-4 sm:px-5"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl border border-[var(--violet)]/18 bg-[var(--violet)]/[0.06] text-[var(--violet)]"><Bot className="size-[18px]" aria-hidden="true" /></span><div><p className="nx-kicker">Local inference</p><h2 className="mt-1.5 text-[13px] font-semibold text-[var(--text)]">Ollama / Qwen runtime</h2></div></div><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.09em] ${aiReady ? 'border-[var(--emerald)]/20 bg-[var(--emerald)]/[0.065] text-[#8ce9c3]' : 'border-[var(--amber)]/20 bg-[var(--amber)]/[0.065] text-[#f7c889]'}`}>{aiReady ? <CheckCircle2 className="size-3" aria-hidden="true" /> : <CircleAlert className="size-3" aria-hidden="true" />}{aiReady ? 'Ready' : 'Degraded'}</span></div>
          <dl className="grid grid-cols-2 gap-px bg-white/[0.06]"><div className="bg-[var(--surface-1)] p-3.5"><dt className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]">Chat model</dt><dd className="mt-1.5 truncate text-[10px] font-semibold text-[var(--text)]">{readiness.data?.expected_chat_model}</dd></div><div className="bg-[var(--surface-1)] p-3.5"><dt className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]">Embedding model</dt><dd className="mt-1.5 truncate text-[10px] font-semibold text-[var(--text)]">{readiness.data?.expected_embedding_model}</dd></div></dl>
          <div className="p-4 sm:px-5"><p className="text-[9px] leading-4 text-[var(--muted)]">{aiReady ? `${readiness.data?.installed_models.length ?? 0} model entries reported by the local runtime.` : `Missing: ${readiness.data?.missing_models.join(', ') || 'runtime availability'}.`}</p><Link href="/ai" className="mt-3 inline-flex items-center gap-1.5 text-[9px] font-semibold text-[var(--blue-strong)] hover:text-white">Open AI Copilot <ExternalLink className="size-3" aria-hidden="true" /></Link></div>
        </article>

        <article className="nx-panel overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] p-4 sm:px-5"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl border border-[var(--amber)]/18 bg-[var(--amber)]/[0.06] text-[var(--amber)]"><Workflow className="size-[18px]" aria-hidden="true" /></span><div><p className="nx-kicker">External orchestration</p><h2 className="mt-1.5 text-[13px] font-semibold text-[var(--text)]">n8n automation API</h2></div></div><span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--blue)]/20 bg-[var(--blue)]/[0.065] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.09em] text-[#a8c1ff]"><ServerCog className="size-3" aria-hidden="true" />API contract</span></div>
          <div className="grid grid-cols-2 gap-px bg-white/[0.06]"><dl className="bg-[var(--surface-1)] p-3.5"><dt className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]">Observed runs</dt><dd className="mt-1.5 text-[10px] font-semibold text-[var(--text)]">{n8nJobs.length}</dd></dl><dl className="bg-[var(--surface-1)] p-3.5"><dt className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]">Last observed</dt><dd className="mt-1.5 truncate text-[10px] font-semibold text-[var(--text)]">{latestN8n ? formatDate(latestN8n.queued_at) : 'No run'}</dd></dl></div>
          <div className="p-4 sm:px-5"><div className="space-y-2 rounded-lg border border-white/[0.07] bg-white/[0.018] p-3 font-mono text-[8px] text-[var(--muted)]"><p>POST /commerce/automation/collect</p><p>POST /commerce/automation/ai</p></div><p className="mt-3 flex items-start gap-2 text-[8px] leading-4 text-[var(--faint)]"><KeyRound className="mt-0.5 size-3 shrink-0" aria-hidden="true" />Requests require the configured automation key. This screen intentionally never reveals credential values.</p><Link href="/jobs" className="mt-3 inline-flex items-center gap-1.5 text-[9px] font-semibold text-[var(--blue-strong)] hover:text-white">Inspect automation ledger <ArrowRight className="size-3" aria-hidden="true" /></Link></div>
        </article>
      </section>

      <div className="mt-4 rounded-xl border border-[var(--emerald)]/16 bg-[var(--emerald)]/[0.045] px-4 py-3 text-[9px] leading-4 text-[var(--muted)]"><ShieldCheck className="mr-2 inline size-3.5 text-[var(--emerald)]" aria-hidden="true" /><strong className="text-[var(--text)]">Security boundary:</strong> this page exposes safe registry metadata and observed activity only—never environment URLs, tokens, or secrets.</div>
    </div>
  );
}
