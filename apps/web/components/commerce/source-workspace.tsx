'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp, Globe2, Play, Plus, Power, ShieldCheck } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/commerce/primitives';
import {
  commerceRequest,
  formatDate,
  type ConnectorRegistry,
  type Job,
  type Source,
} from '@/lib/commerce-client';

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

export function SourceWorkspace() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState('manual_import');
  const [baseUrl, setBaseUrl] = useState('');
  const [seedUrls, setSeedUrls] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [lastImport, setLastImport] = useState<ImportBatch | null>(null);

  const sources = useQuery({
    queryKey: ['commerce', 'sources'],
    queryFn: () => commerceRequest<Source[]>('sources'),
  });
  const connectors = useQuery({
    queryKey: ['commerce', 'connectors'],
    queryFn: () => commerceRequest<ConnectorRegistry>('connectors'),
  });

  const enabledSources = useMemo(
    () => (sources.data ?? []).filter((source) => source.is_active),
    [sources.data],
  );

  const createSource = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      commerceRequest<Source>('sources', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: (created) => {
      setName('');
      setBaseUrl('');
      setSeedUrls('');
      setSelectedSource(created.id);
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
      const raw = JSON.parse(await file.text()) as unknown;
      const items = Array.isArray(raw)
        ? raw
        : typeof raw === 'object' && raw && 'items' in raw
          ? (raw as { items: unknown[] }).items
          : null;
      if (!Array.isArray(items) || !items.length) {
        throw new Error('JSON file must contain a non-empty array or an {"items": [...]} object');
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
    const seeds = seedUrls
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
    const hostname = (() => {
      try {
        return new URL(baseUrl).hostname;
      } catch {
        return '';
      }
    })();
    createSource.mutate({
      name,
      type,
      base_url: baseUrl,
      config:
        type === 'jsonld'
          ? { allowed_domains: hostname ? [hostname] : [], seed_urls: seeds }
          : {},
      is_active: true,
    });
  }

  function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedSource && importFile) {
      importProducts.mutate({ sourceId: selectedSource, file: importFile });
    }
  }

  if (sources.isLoading || connectors.isLoading) return <LoadingState label="Loading sources" />;
  if (sources.error) return <ErrorState message={sources.error.message} />;
  if (connectors.error) return <ErrorState message={connectors.error.message} />;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Evidence intake"
        title="Sources, connectors, and operator imports."
        description="Register only approved public origins or authorized operator files. Live collection is limited to the reviewed generic JSON-LD connector; unsupported marketplace scraping remains disabled."
      />

      <section className="mt-7 grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <form onSubmit={submitSource} className="rounded-2xl border border-white/8 bg-[#0a101c]/80 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Plus className="size-4 text-violet-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Register source</h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">A source defines ownership, domain policy, and collection mode.</p>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-xs font-medium text-slate-400">
              Source name
              <input
                required
                minLength={2}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="min-h-11 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white outline-none transition focus:border-violet-400/40 focus:ring-2 focus:ring-violet-400/15"
                placeholder="My authorized catalog"
              />
            </label>
            <label className="grid gap-2 text-xs font-medium text-slate-400">
              Collection mode
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
                className="min-h-11 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white outline-none focus:border-violet-400/40"
              >
                <option value="manual_import">Manual CSV / JSON import</option>
                <option value="jsonld">Approved public Product JSON-LD</option>
                <option value="fixture">Fixture-only acceptance testing</option>
              </select>
            </label>
            <label className="grid gap-2 text-xs font-medium text-slate-400">
              Base URL
              <input
                required
                type="url"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                className="min-h-11 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white outline-none transition focus:border-violet-400/40 focus:ring-2 focus:ring-violet-400/15"
                placeholder="https://catalog.example.com"
              />
            </label>
            {type === 'jsonld' ? (
              <label className="grid gap-2 text-xs font-medium text-slate-400">
                Approved product URLs (one per line)
                <textarea
                  required
                  rows={4}
                  value={seedUrls}
                  onChange={(event) => setSeedUrls(event.target.value)}
                  className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 font-mono text-xs text-white outline-none transition focus:border-violet-400/40 focus:ring-2 focus:ring-violet-400/15"
                  placeholder="https://catalog.example.com/products/item"
                />
              </label>
            ) : null}
          </div>
          {mutationMessage(createSource.error) ? (
            <p className="mt-4 text-sm text-rose-300">{mutationMessage(createSource.error)}</p>
          ) : null}
          <button
            type="submit"
            disabled={createSource.isPending}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Globe2 className="size-4" aria-hidden="true" />
            {createSource.isPending ? 'Registering…' : 'Register source'}
          </button>
        </form>

        <form onSubmit={submitImport} className="rounded-2xl border border-white/8 bg-[#0a101c]/80 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <FileUp className="size-4 text-cyan-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Import real product observations</h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Upload CSV or JSON. Required fields: external_id, name, canonical_url, and price. Evidence hashes and alert evaluation are created server-side.
          </p>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-xs font-medium text-slate-400">
              Destination source
              <select
                required
                value={selectedSource}
                onChange={(event) => setSelectedSource(event.target.value)}
                className="min-h-11 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white outline-none focus:border-cyan-400/40"
              >
                <option value="">Choose an active source</option>
                {enabledSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name} ({source.type})
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-xs font-medium text-slate-400">
              CSV or JSON file
              <input
                required
                type="file"
                accept=".csv,.json,text/csv,application/json"
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                className="min-h-11 rounded-xl border border-dashed border-white/15 bg-slate-950/40 px-3 py-2.5 text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500/10 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-cyan-200"
              />
            </label>
          </div>
          {mutationMessage(importProducts.error) ? (
            <p className="mt-4 text-sm text-rose-300">{mutationMessage(importProducts.error)}</p>
          ) : null}
          {lastImport ? (
            <div className="mt-4 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] p-4 text-sm text-emerald-100">
              Accepted {lastImport.rows_accepted} of {lastImport.rows_received} rows; rejected {lastImport.rows_rejected}.
            </div>
          ) : null}
          <button
            type="submit"
            disabled={!selectedSource || !importFile || importProducts.isPending}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FileUp className="size-4" aria-hidden="true" />
            {importProducts.isPending ? 'Importing…' : 'Validate and import'}
          </button>
        </form>
      </section>

      <section className="mt-7 overflow-hidden rounded-2xl border border-white/8 bg-[#0a101c]/80">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Registered sources</h2>
            <p className="mt-1 text-xs text-slate-500">{sources.data?.length ?? 0} source records</p>
          </div>
        </div>
        {sources.data?.length ? (
          <div className="divide-y divide-white/[0.06]">
            {sources.data.map((source) => {
              const canCollect = ['jsonld', 'structured_html', 'fixture', 'fixture_only'].includes(source.type);
              return (
                <article key={source.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[1.5fr_1fr_auto] lg:items-center sm:px-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-200">{source.name}</h3>
                      <StatusBadge status={source.is_active ? 'active' : 'inactive'} />
                    </div>
                    <a href={source.base_url} target="_blank" rel="noreferrer" className="mt-2 block truncate text-xs text-cyan-300 hover:text-cyan-200">
                      {source.base_url}
                    </a>
                    <p className="mt-1 font-mono text-[11px] text-slate-600">{source.id}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-300">{source.type.replaceAll('_', ' ')}</p>
                    <p className="mt-1 text-xs text-slate-600">Updated {formatDate(source.updated_at)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {canCollect ? (
                      <button
                        type="button"
                        onClick={() => queueJob.mutate(source.id)}
                        disabled={!source.is_active || queueJob.isPending}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-400/15 bg-cyan-500/[0.07] px-3 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-40"
                      >
                        <Play className="size-3.5" /> Queue collection
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => toggleSource.mutate({ id: source.id, active: !source.is_active })}
                      disabled={toggleSource.isPending}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3 text-xs font-semibold text-slate-300 hover:bg-white/[0.05] disabled:opacity-40"
                    >
                      <Power className="size-3.5" /> {source.is_active ? 'Pause' : 'Activate'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            <EmptyState title="No sources registered" description="Use the source form above to create the first authorized data origin." />
          </div>
        )}
      </section>

      <section className="mt-7 rounded-2xl border border-white/8 bg-white/[0.02] p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-300" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-200">Enabled connector registry</h2>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {Object.entries(connectors.data ?? {}).map(([sourceType, connector]) => (
            <article key={sourceType} className="rounded-xl border border-white/[0.07] bg-slate-950/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-violet-200">{connector.connector_id}</p>
                  <p className="mt-1 text-xs text-slate-500">Source type: {sourceType}</p>
                </div>
                <span className="text-[11px] font-medium text-slate-500">v{connector.connector_version}</span>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                {connector.capability_states.join(', ')} · {connector.supported_fields.length} supported fields
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
