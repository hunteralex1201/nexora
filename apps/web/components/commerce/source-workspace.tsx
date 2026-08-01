'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  CirclePause,
  DatabaseZap,
  FileUp,
  Filter,
  Globe2,
  Link2,
  Play,
  Plus,
  Power,
  RadioTower,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/commerce/primitives';
import { PageHeader } from '@/components/page-header';
import { commerceRequest, formatDate, type Job, type Source } from '@/lib/commerce-client';

interface ImportBatch {
  id: string;
  source_id: string;
  filename: string | null;
  status: string;
  rows_received: number;
  rows_accepted: number;
  rows_rejected: number;
  errors: Array<Record<string, unknown>>;
}

function mutationMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

function sourceTypeLabel(type: string) {
  const labels: Record<string, string> = {
    manual_import: 'File import',
    jsonld: 'JSON-LD pages',
    structured_html: 'Structured HTML',
  };
  return labels[type] ?? type.replaceAll('_', ' ');
}

export function SourceWorkspace() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState('manual_import');
  const [baseUrl, setBaseUrl] = useState('');
  const [seedUrls, setSeedUrls] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [lastImport, setLastImport] = useState<ImportBatch | null>(null);
  const [panel, setPanel] = useState<'source' | 'import' | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');

  const sources = useQuery({
    queryKey: ['commerce', 'sources'],
    queryFn: () => commerceRequest<Source[]>('sources'),
  });

  const visibleSources = useMemo(
    () => (sources.data ?? []).filter((source) => !['fixture', 'fixture_only'].includes(source.type)),
    [sources.data],
  );
  const enabledSources = useMemo(() => visibleSources.filter((source) => source.is_active), [visibleSources]);
  const filteredSources = useMemo(() => {
    const query = search.trim().toLowerCase();
    return visibleSources.filter((source) => {
      if (statusFilter === 'active' && !source.is_active) return false;
      if (statusFilter === 'paused' && source.is_active) return false;
      if (!query) return true;
      return `${source.name} ${source.type} ${source.base_url}`.toLowerCase().includes(query);
    });
  }, [search, statusFilter, visibleSources]);

  const createSource = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      commerceRequest<Source>('sources', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: (created) => {
      setName('');
      setBaseUrl('');
      setSeedUrls('');
      setSelectedSource(created.id);
      setPanel(null);
      void queryClient.invalidateQueries({ queryKey: ['commerce'] });
    },
  });

  const toggleSource = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      commerceRequest<Source>(`sources/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: active }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['commerce'] }),
  });

  const queueJob = useMutation({
    mutationFn: (sourceId: string) =>
      commerceRequest<Job>('jobs', {
        method: 'POST',
        body: JSON.stringify({
          source_id: sourceId,
          job_type: 'collect',
          trigger: 'manual',
          payload: {},
          idempotency_key: `manual-${sourceId}-${Date.now()}`,
        }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['commerce'] }),
  });

  const importProducts = useMutation({
    mutationFn: async ({ sourceId, file }: { sourceId: string; file: File }) => {
      if (file.name.toLowerCase().endsWith('.csv')) {
        const form = new FormData();
        form.append('source_id', sourceId);
        form.append('file', file);
        return commerceRequest<ImportBatch>('imports/csv', { method: 'POST', body: form });
      }
      let raw: unknown;
      try {
        raw = JSON.parse(await file.text()) as unknown;
      } catch {
        throw new Error('This JSON file is not valid. Check the file and try again.');
      }
      const items = Array.isArray(raw)
        ? raw
        : typeof raw === 'object' && raw && 'items' in raw
          ? (raw as { items: unknown[] }).items
          : null;
      if (!Array.isArray(items) || !items.length) {
        throw new Error('Choose a JSON file containing a non-empty product list.');
      }
      return commerceRequest<ImportBatch>('imports/json', {
        method: 'POST',
        body: JSON.stringify({ source_id: sourceId, filename: file.name, items }),
      });
    },
    onSuccess: (batch) => {
      setLastImport(batch);
      setImportFile(null);
      void queryClient.invalidateQueries({ queryKey: ['commerce'] });
    },
  });

  function submitSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const seeds = seedUrls.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    let hostname = '';
    try {
      hostname = new URL(baseUrl).hostname;
    } catch {
      hostname = '';
    }
    createSource.mutate({
      name,
      type,
      base_url: baseUrl,
      config: type === 'jsonld' ? { allowed_domains: hostname ? [hostname] : [], seed_urls: seeds } : {},
      is_active: true,
    });
  }

  function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedSource && importFile) importProducts.mutate({ sourceId: selectedSource, file: importFile });
  }

  if (sources.isLoading) return <LoadingState label="Loading sources" />;
  if (sources.error) return <ErrorState message={sources.error.message} />;

  const activeCount = enabledSources.length;
  const hiddenSystemSourceCount = Math.max((sources.data?.length ?? 0) - visibleSources.length, 0);
  const collectibleCount = visibleSources.filter((source) => ['jsonld', 'structured_html'].includes(source.type)).length;
  const importCount = visibleSources.filter((source) => source.type === 'manual_import').length;

  return (
    <div>
      <PageHeader
        eyebrow="Data acquisition"
        title="Sources"
        description="Connect approved product pages or import structured files, then control collection from one operational surface."
        actions={
          <>
            <button type="button" className="nx-button-secondary" onClick={() => setPanel(panel === 'import' ? null : 'import')}>
              <FileUp className="size-4" aria-hidden="true" /> Import
            </button>
            <button type="button" className="nx-button" onClick={() => setPanel(panel === 'source' ? null : 'source')}>
              <Plus className="size-4" aria-hidden="true" /> Add source
            </button>
          </>
        }
      />

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Source metrics">
        {[
          { label: 'Operational', value: visibleSources.length, icon: Link2, tone: 'text-[var(--blue)]' },
          { label: 'Active', value: activeCount, icon: RadioTower, tone: 'text-[var(--emerald)]' },
          { label: 'Collectible', value: collectibleCount, icon: Globe2, tone: 'text-[var(--violet)]' },
          { label: 'Import feeds', value: importCount, icon: FileUp, tone: 'text-[var(--orange)]' },
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

      {panel === 'source' ? (
        <form onSubmit={submitSource} className="nx-panel mt-4 overflow-hidden">
          <div className="flex items-start justify-between border-b border-white/[0.07] px-4 py-4 sm:px-5">
            <div>
              <p className="nx-kicker">New connector</p>
              <h2 className="mt-1.5 text-[14px] font-semibold text-[var(--text)]">Add source</h2>
              <p className="mt-1 text-[10px] text-[var(--muted)]">Use a file destination or approved product pages.</p>
            </div>
            <button type="button" className="nx-icon-button" aria-label="Close" onClick={() => setPanel(null)}><X className="size-4" aria-hidden="true" /></button>
          </div>
          <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2">
            <label className="nx-label">Name<input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} className="nx-input" placeholder="My store" /></label>
            <label className="nx-label">Source type<select value={type} onChange={(event) => setType(event.target.value)} className="nx-input"><option value="manual_import">File import</option><option value="jsonld">Website product pages</option></select></label>
            <label className="nx-label md:col-span-2">Website URL<input required type="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} className="nx-input" placeholder="https://store.example.com" /></label>
            {type === 'jsonld' ? (
              <label className="nx-label md:col-span-2">Product URLs, one per line<textarea required rows={4} value={seedUrls} onChange={(event) => setSeedUrls(event.target.value)} className="nx-input resize-y" placeholder="https://store.example.com/products/item" /></label>
            ) : null}
          </div>
          {mutationMessage(createSource.error) ? <p role="alert" className="mx-4 mb-3 text-[11px] text-[#ff9aad] sm:mx-5">{mutationMessage(createSource.error)}</p> : null}
          <div className="flex justify-end gap-2 border-t border-white/[0.07] px-4 py-3 sm:px-5">
            <button type="button" className="nx-button-secondary" onClick={() => setPanel(null)}>Cancel</button>
            <button type="submit" disabled={createSource.isPending} className="nx-button"><Globe2 className="size-4" aria-hidden="true" /> {createSource.isPending ? 'Adding…' : 'Add source'}</button>
          </div>
        </form>
      ) : null}

      {panel === 'import' ? (
        <form onSubmit={submitImport} className="nx-panel mt-4 overflow-hidden">
          <div className="flex items-start justify-between border-b border-white/[0.07] px-4 py-4 sm:px-5">
            <div>
              <p className="nx-kicker">Structured ingest</p>
              <h2 className="mt-1.5 text-[14px] font-semibold text-[var(--text)]">Import products</h2>
              <p className="mt-1 text-[10px] text-[var(--muted)]">Upload CSV or JSON with product name, canonical URL, and price.</p>
            </div>
            <button type="button" className="nx-icon-button" aria-label="Close" onClick={() => setPanel(null)}><X className="size-4" aria-hidden="true" /></button>
          </div>
          <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2">
            <label className="nx-label">Destination<select required value={selectedSource} onChange={(event) => setSelectedSource(event.target.value)} className="nx-input"><option value="">Choose a source</option>{enabledSources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
            <label className="nx-label">CSV or JSON file<input required type="file" accept=".csv,.json,text/csv,application/json" onChange={(event) => setImportFile(event.target.files?.[0] ?? null)} className="nx-input py-2 file:mr-3 file:rounded-md file:border-0 file:bg-white/[0.08] file:px-3 file:py-1 file:text-[10px] file:font-semibold file:text-[var(--text)]" /></label>
          </div>
          {mutationMessage(importProducts.error) ? <p role="alert" className="mx-4 mb-3 text-[11px] text-[#ff9aad] sm:mx-5">{mutationMessage(importProducts.error)}</p> : null}
          {lastImport ? (
            <div role="status" className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-[var(--emerald)]/18 bg-[var(--emerald)]/[0.07] px-3 py-2.5 text-[11px] text-[#8ce9c3] sm:mx-5"><CheckCircle2 className="size-4" aria-hidden="true" /> Imported {lastImport.rows_accepted} of {lastImport.rows_received} rows.</div>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-white/[0.07] px-4 py-3 sm:px-5">
            <button type="button" className="nx-button-secondary" onClick={() => setPanel(null)}>Cancel</button>
            <button type="submit" disabled={!selectedSource || !importFile || importProducts.isPending} className="nx-button"><FileUp className="size-4" aria-hidden="true" /> {importProducts.isPending ? 'Importing…' : 'Import products'}</button>
          </div>
        </form>
      ) : null}

      {queueJob.isSuccess ? <div role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--emerald)]/18 bg-[var(--emerald)]/[0.07] px-3 py-2.5 text-[11px] text-[#8ce9c3]"><CheckCircle2 className="size-4" aria-hidden="true" /> Collection queued.</div> : null}
      {mutationMessage(queueJob.error) ? <div className="mt-4"><ErrorState message={mutationMessage(queueJob.error) ?? 'Collection could not be queued.'} /></div> : null}
      {mutationMessage(toggleSource.error) ? <div className="mt-4"><ErrorState message={mutationMessage(toggleSource.error) ?? 'Source status could not be changed.'} /></div> : null}

      <section className="nx-panel mt-4 overflow-hidden">
        <div className="border-b border-white/[0.07] p-3.5 sm:p-4">
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--faint)]" aria-hidden="true" />
              <span className="sr-only">Search sources</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="nx-input pl-10" placeholder="Search sources by name, type, or URL" />
            </label>
            <label className="sr-only" htmlFor="source-status-filter">Filter source status</label>
            <select id="source-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'paused')} className="nx-input sm:w-36"><option value="all">All status</option><option value="active">Active</option><option value="paused">Paused</option></select>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1 px-1 text-[9px] text-[var(--faint)]"><span>{filteredSources.length} shown · {visibleSources.length} operational{hiddenSystemSourceCount ? ` · ${hiddenSystemSourceCount} internal fixture excluded` : ''}</span><span className="inline-flex items-center gap-1"><Filter className="size-3" aria-hidden="true" />Live filters</span></div>
        </div>

        {filteredSources.length ? (
          <div className="divide-y divide-white/[0.065]">
            {filteredSources.map((source) => {
              const canCollect = ['jsonld', 'structured_html'].includes(source.type);
              const hostname = (() => { try { return new URL(source.base_url).hostname; } catch { return source.base_url; } })();
              return (
                <article key={source.id} className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl border ${source.is_active ? 'border-[var(--emerald)]/18 bg-[var(--emerald)]/[0.07] text-[var(--emerald)]' : 'border-white/[0.08] bg-white/[0.025] text-[var(--faint)]'}`}>
                      {source.type === 'manual_import' ? <DatabaseZap className="size-[17px]" aria-hidden="true" /> : <Globe2 className="size-[17px]" aria-hidden="true" />}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="text-[12px] font-semibold text-[var(--text)]">{source.name}</h3><StatusBadge status={source.is_active ? 'active' : 'inactive'} /></div>
                      <a href={source.base_url} target="_blank" rel="noreferrer" className="mt-1.5 block max-w-xl truncate text-[9px] text-[var(--faint)] hover:text-[var(--blue-strong)]">{hostname}</a>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-[var(--muted)]"><span>{sourceTypeLabel(source.type)}</span><span>Updated {formatDate(source.updated_at)}</span>{canCollect ? <span className="inline-flex items-center gap-1 text-[#a8c1ff]"><ShieldCheck className="size-3" aria-hidden="true" />Collection supported</span> : null}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {canCollect ? <button type="button" onClick={() => queueJob.mutate(source.id)} disabled={!source.is_active || queueJob.isPending} className="nx-button-secondary !min-h-9 !px-3 !text-[10px]"><Play className="size-3.5" aria-hidden="true" /> Collect</button> : null}
                    <button type="button" onClick={() => toggleSource.mutate({ id: source.id, active: !source.is_active })} disabled={toggleSource.isPending} className="nx-button-quiet !min-h-9 !px-3 !text-[10px]">
                      {source.is_active ? <CirclePause className="size-3.5" aria-hidden="true" /> : <Power className="size-3.5" aria-hidden="true" />} {source.is_active ? 'Pause' : 'Activate'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="p-5"><EmptyState title={search || statusFilter !== 'all' ? 'No matching sources' : 'No operational sources yet'} description={search ? 'Try a broader search or clear the status filter.' : hiddenSystemSourceCount ? `${hiddenSystemSourceCount} internal acceptance fixture is excluded from this control surface. Add an operational source to start tracking products.` : 'Add a source to start tracking products.'} /></div>
        )}
      </section>
    </div>
  );
}
