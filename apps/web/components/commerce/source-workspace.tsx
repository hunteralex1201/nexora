'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileUp, Globe2, Play, Plus, Power, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

import { PageHeader } from '@/components/page-header';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StatusBadge,
} from '@/components/commerce/primitives';
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

  const sources = useQuery({
    queryKey: ['commerce', 'sources'],
    queryFn: () => commerceRequest<Source[]>('sources'),
  });

  const visibleSources = useMemo(
    () =>
      (sources.data ?? []).filter((source) => !['fixture', 'fixture_only'].includes(source.type)),
    [sources.data],
  );
  const enabledSources = useMemo(
    () => visibleSources.filter((source) => source.is_active),
    [visibleSources],
  );

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
    const seeds = seedUrls
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
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
      config:
        type === 'jsonld' ? { allowed_domains: hostname ? [hostname] : [], seed_urls: seeds } : {},
      is_active: true,
    });
  }

  function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedSource && importFile)
      importProducts.mutate({ sourceId: selectedSource, file: importFile });
  }

  if (sources.isLoading) return <LoadingState label="Loading sources" />;
  if (sources.error) return <ErrorState message={sources.error.message} />;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Sources"
        description="Connect a storefront or upload product data."
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              className="nx-button-secondary"
              onClick={() => setPanel(panel === 'import' ? null : 'import')}
            >
              <FileUp className="size-4" aria-hidden="true" /> Import
            </button>
            <button
              type="button"
              className="nx-button"
              onClick={() => setPanel(panel === 'source' ? null : 'source')}
            >
              <Plus className="size-4" aria-hidden="true" /> Add source
            </button>
          </div>
        }
      />

      {panel === 'source' ? (
        <form onSubmit={submitSource} className="nx-panel mt-6 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#3b3933]">Add source</h2>
              <p className="mt-1 text-xs text-[#858178]">
                Use a file source or approved product pages.
              </p>
            </div>
            <button
              type="button"
              className="nx-button-quiet !min-h-9 !px-2.5"
              aria-label="Close"
              onClick={() => setPanel(null)}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="nx-label">
              Name
              <input
                required
                minLength={2}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="nx-input"
                placeholder="My store"
              />
            </label>
            <label className="nx-label">
              Source type
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
                className="nx-input"
              >
                <option value="manual_import">File import</option>
                <option value="jsonld">Website product pages</option>
              </select>
            </label>
            <label className="nx-label md:col-span-2">
              Website URL
              <input
                required
                type="url"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                className="nx-input"
                placeholder="https://store.example.com"
              />
            </label>
            {type === 'jsonld' ? (
              <label className="nx-label md:col-span-2">
                Product URLs, one per line
                <textarea
                  required
                  rows={4}
                  value={seedUrls}
                  onChange={(event) => setSeedUrls(event.target.value)}
                  className="nx-input resize-y"
                  placeholder="https://store.example.com/products/item"
                />
              </label>
            ) : null}
          </div>
          {mutationMessage(createSource.error) ? (
            <p className="mt-4 text-[13px] text-[#a5463c]">{mutationMessage(createSource.error)}</p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="nx-button-secondary" onClick={() => setPanel(null)}>
              Cancel
            </button>
            <button type="submit" disabled={createSource.isPending} className="nx-button">
              <Globe2 className="size-4" aria-hidden="true" />{' '}
              {createSource.isPending ? 'Adding…' : 'Add source'}
            </button>
          </div>
        </form>
      ) : null}

      {panel === 'import' ? (
        <form onSubmit={submitImport} className="nx-panel mt-6 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#3b3933]">Import products</h2>
              <p className="mt-1 text-xs text-[#858178]">
                Upload CSV or JSON with product name, URL, and price.
              </p>
            </div>
            <button
              type="button"
              className="nx-button-quiet !min-h-9 !px-2.5"
              aria-label="Close"
              onClick={() => setPanel(null)}
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="nx-label">
              Destination
              <select
                required
                value={selectedSource}
                onChange={(event) => setSelectedSource(event.target.value)}
                className="nx-input"
              >
                <option value="">Choose a source</option>
                {enabledSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="nx-label">
              CSV or JSON file
              <input
                required
                type="file"
                accept=".csv,.json,text/csv,application/json"
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                className="nx-input py-2 file:mr-3 file:rounded-md file:border-0 file:bg-[#f0eee8] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-[#4b4943]"
              />
            </label>
          </div>
          {mutationMessage(importProducts.error) ? (
            <p className="mt-4 text-[13px] text-[#a5463c]">
              {mutationMessage(importProducts.error)}
            </p>
          ) : null}
          {lastImport ? (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#eaf4ee] px-3 py-2.5 text-[13px] text-[#287a55]">
              <CheckCircle2 className="size-4" aria-hidden="true" /> Imported{' '}
              {lastImport.rows_accepted} of {lastImport.rows_received} rows.
            </div>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="nx-button-secondary" onClick={() => setPanel(null)}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedSource || !importFile || importProducts.isPending}
              className="nx-button"
            >
              <FileUp className="size-4" aria-hidden="true" />{' '}
              {importProducts.isPending ? 'Importing…' : 'Import products'}
            </button>
          </div>
        </form>
      ) : null}

      {queueJob.isSuccess ? (
        <div className="mt-5 flex items-center gap-2 rounded-lg bg-[#eaf4ee] px-3 py-2.5 text-[13px] text-[#287a55]">
          <CheckCircle2 className="size-4" aria-hidden="true" /> Collection queued.
        </div>
      ) : null}
      {mutationMessage(queueJob.error) ? (
        <div className="mt-5">
          <ErrorState
            message={mutationMessage(queueJob.error) ?? 'Collection could not be queued.'}
          />
        </div>
      ) : null}
      {mutationMessage(toggleSource.error) ? (
        <div className="mt-5">
          <ErrorState
            message={mutationMessage(toggleSource.error) ?? 'Source status could not be changed.'}
          />
        </div>
      ) : null}

      <section className="nx-panel mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#e4e1d9] px-5 py-4">
          <h2 className="text-[13px] font-semibold text-[#3b3933]">Connected sources</h2>
          <span className="text-xs text-[#8f8b81]">{visibleSources.length}</span>
        </div>
        {visibleSources.length ? (
          <div className="divide-y divide-[#ece9e2]">
            {visibleSources.map((source) => {
              const canCollect = ['jsonld', 'structured_html'].includes(source.type);
              return (
                <article
                  key={source.id}
                  className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[13px] font-semibold text-[#3b3933]">{source.name}</h3>
                      <StatusBadge status={source.is_active ? 'active' : 'inactive'} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8f8b81]">
                      <a
                        href={source.base_url}
                        target="_blank"
                        rel="noreferrer"
                        className="max-w-lg truncate hover:text-[#9d4b32]"
                      >
                        {source.base_url}
                      </a>
                      <span className="capitalize">{source.type.replaceAll('_', ' ')}</span>
                      <span>Updated {formatDate(source.updated_at)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {canCollect ? (
                      <button
                        type="button"
                        onClick={() => queueJob.mutate(source.id)}
                        disabled={!source.is_active || queueJob.isPending}
                        className="nx-button-secondary !min-h-9 !px-3 !text-xs"
                      >
                        <Play className="size-3.5" aria-hidden="true" /> Collect
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        toggleSource.mutate({ id: source.id, active: !source.is_active })
                      }
                      disabled={toggleSource.isPending}
                      className="nx-button-quiet !min-h-9 !px-3 !text-xs"
                    >
                      <Power className="size-3.5" aria-hidden="true" />{' '}
                      {source.is_active ? 'Pause' : 'Activate'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              title="No sources yet"
              description="Add a source to start tracking products."
            />
          </div>
        )}
      </section>
    </div>
  );
}
