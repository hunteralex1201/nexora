import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes, ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AIWorkspace } from '@/components/commerce/ai-workspace';
import { AlertWorkspace } from '@/components/commerce/alert-workspace';
import { JobWorkspace } from '@/components/commerce/job-workspace';
import { OverviewDashboard } from '@/components/commerce/overview-dashboard';
import { ProductWorkspace } from '@/components/commerce/product-workspace';
import { SourceWorkspace } from '@/components/commerce/source-workspace';
import { commerceRequest, streamAIChat } from '@/lib/commerce-client';

vi.mock('next/link', () => ({
  default: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));

vi.mock('@/lib/commerce-client', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/commerce-client')>('@/lib/commerce-client');
  return { ...actual, commerceRequest: vi.fn(), streamAIChat: vi.fn() };
});

const now = '2026-08-01T10:00:00.000Z';
const earlier = '2026-07-31T10:00:00.000Z';

const source = {
  id: 'source-1',
  name: 'Main Store',
  type: 'jsonld',
  base_url: 'https://store.example.com',
  config: { seed_urls: ['https://store.example.com/products/desk'] },
  is_active: true,
  created_at: earlier,
  updated_at: now,
};

const observation = {
  id: 'observation-1',
  observed_at: now,
  price: '75.00',
  original_price: '80.00',
  currency: 'BDT',
  availability: 'in_stock',
  seller_name: 'Main Store',
  rating: '4.60',
  review_count: 42,
  source_url: 'https://store.example.com/products/desk',
  collector: 'jsonld',
  evidence: {},
  evidence_hash: 'hash-1',
  created_at: now,
};

const product = {
  id: 'product-1',
  source_id: source.id,
  source_name: source.name,
  external_id: 'desk-1',
  name: 'Premium Writing Desk',
  canonical_url: 'https://store.example.com/products/desk',
  brand: 'NEXORA Home',
  category: 'Furniture',
  currency: 'BDT',
  image_url: null,
  is_active: true,
  last_seen_at: now,
  latest_observation: observation,
  previous_price: '80.00',
  price_change_percent: '-6.25',
};

const productDetail = {
  ...product,
  attributes: { material: 'Oak' },
  first_seen_at: earlier,
  history: [observation],
};

const job = {
  id: 'job-1',
  source_id: source.id,
  status: 'failed',
  job_type: 'collect',
  trigger: 'manual',
  requested_by_id: 'user-1',
  payload: {},
  attempt: 1,
  max_attempts: 3,
  idempotency_key: 'test-job-1',
  queued_at: earlier,
  started_at: earlier,
  last_heartbeat_at: now,
  completed_at: now,
  error_message: 'Store was temporarily unavailable.',
  metrics: { products_seen: 1 },
  created_at: earlier,
  updated_at: now,
};

const alertRule = {
  id: 'rule-1',
  owner_id: 'user-1',
  source_id: source.id,
  product_id: product.id,
  name: 'Important price drop',
  rule_type: 'price_drop_percent',
  threshold: '5',
  config: {},
  is_active: true,
  last_triggered_at: now,
  created_at: earlier,
  updated_at: now,
};

const alertEvent = {
  id: 'event-1',
  rule_id: alertRule.id,
  product_id: product.id,
  observation_id: observation.id,
  status: 'open',
  message: 'Premium Writing Desk dropped by 6.25%.',
  payload: {},
  triggered_at: now,
  acknowledged_at: null,
};

function responseFor(path: string, init?: RequestInit): unknown {
  const method = init?.method ?? 'GET';
  if (path === 'overview') {
    return {
      generated_at: now,
      sources: { total: 1, active: 1 },
      products: { total: 1, active: 1 },
      observations: { total: 2, active: null },
      jobs: { failed: 1, running: 1 },
      alerts: { open: 1 },
      latest_observation_at: now,
      recent_jobs: [job],
      recent_alerts: [alertEvent],
    };
  }
  if (path === 'sources' && method === 'POST') return source;
  if (path === 'sources' || path === 'sources?active=true') return [source];
  if (path.startsWith('sources/') && method === 'PATCH') return { ...source, is_active: false };
  if (path.startsWith('products?')) return { items: [product], total: 1, limit: 100, offset: 0 };
  if (path === `products/${product.id}`) return productDetail;
  if (path.startsWith('jobs?')) return [job];
  if (path === 'jobs' && method === 'POST')
    return { ...job, status: 'queued', error_message: null };
  if (path === 'alerts/rules' && method === 'POST') return alertRule;
  if (path === 'alerts/rules') return [alertRule];
  if (path.startsWith('alerts/events?')) return [alertEvent];
  if (path.includes('/acknowledge'))
    return { ...alertEvent, status: 'acknowledged', acknowledged_at: now };
  if (path === 'ai/readiness') {
    return {
      status: 'ready',
      expected_chat_model: 'qwen3:8b',
      expected_embedding_model: 'qwen3-embedding:0.6b',
      installed_models: ['qwen3:8b', 'qwen3-embedding:0.6b'],
      missing_models: [],
    };
  }
  if (path === 'imports/json' || path === 'imports/csv') {
    return {
      id: 'import-1',
      source_id: source.id,
      filename: 'products.json',
      status: 'completed',
      rows_received: 1,
      rows_accepted: 1,
      rows_rejected: 0,
      errors: [],
    };
  }
  throw new Error(`Unexpected commerce request: ${method} ${path}`);
}

function renderWorkspace(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const requestMock = vi.mocked(commerceRequest);
const chatMock = vi.mocked(streamAIChat);

describe('commerce workspaces', () => {
  beforeEach(() => {
    requestMock.mockReset();
    requestMock.mockImplementation(((path: string, init?: RequestInit) =>
      Promise.resolve(responseFor(path, init))) as typeof commerceRequest);
    chatMock.mockReset();
    chatMock.mockImplementation(async (_messages, onEvent) => {
      onEvent({ type: 'start', model: 'qwen3:8b' });
      onEvent({ type: 'token', content: 'Bangla ' });
      onEvent({ type: 'token', content: 'response' });
      onEvent({ type: 'done', model: 'qwen3:8b', total_duration_ms: 1250 });
    });
  });

  it('renders overview metrics and recent operational activity', async () => {
    renderWorkspace(<OverviewDashboard />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText('Active sources')).toBeInTheDocument();
    expect(screen.getByText('Premium Writing Desk dropped by 6.25%.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /add source/i })).toHaveAttribute('href', '/sources');
  });

  it('renders searchable products and a readable price inspector', async () => {
    const user = userEvent.setup();
    renderWorkspace(<ProductWorkspace />);

    expect(await screen.findByText('Current price')).toBeInTheDocument();
    expect(screen.getAllByText('Premium Writing Desk').length).toBeGreaterThan(1);
    expect(screen.getByText('More price history will appear here')).toBeInTheDocument();
    const search = screen.getByRole('textbox', { name: 'Search products' });
    await user.type(search, 'desk');
    expect(search).toHaveValue('desk');
  });

  it('creates, imports, collects, and pauses sources through supported controls', async () => {
    const user = userEvent.setup();
    renderWorkspace(<SourceWorkspace />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Sources' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Collect' }));
    expect(await screen.findByText('Collection queued.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith(
        `sources/${source.id}`,
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Add source' }));
    await user.type(screen.getByLabelText('Name'), 'Second Store');
    await user.type(screen.getByLabelText('Website URL'), 'https://second.example.com');
    const addButtons = screen.getAllByRole('button', { name: 'Add source' });
    await user.click(addButtons.at(-1)!);
    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith(
        'sources',
        expect.objectContaining({ method: 'POST' }),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Import' }));
    await user.selectOptions(screen.getByLabelText('Destination'), source.id);
    const file = new File(
      [
        'name,canonical_url,price,currency\nImported Desk,https://store.example.com/imported,70,BDT',
      ],
      'products.csv',
      { type: 'text/csv' },
    );
    await user.upload(screen.getByLabelText('CSV or JSON file'), file);
    const importButton = screen.getByRole('button', { name: 'Import products' });
    expect(importButton).toBeEnabled();
    fireEvent.submit(importButton.closest('form')!);
    expect(await screen.findByText('Imported 1 of 1 rows.')).toBeInTheDocument();
  });

  it('queues only supported automation jobs while presenting useful run state', async () => {
    const user = userEvent.setup();
    const automation = renderWorkspace(<JobWorkspace />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Automation' }),
    ).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Source'), source.id);
    await user.selectOptions(screen.getByLabelText('Action'), 'ai_analyze');
    await user.click(screen.getByRole('button', { name: 'Run' }));
    expect(await screen.findByText('Automation started.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith('jobs', expect.objectContaining({ method: 'POST' })),
    );
    automation.unmount();
  });

  it('streams a local-model conversation and starts a clean new chat', async () => {
    const user = userEvent.setup();
    renderWorkspace(<AIWorkspace />);

    expect(await screen.findByRole('heading', { level: 1, name: 'AI chat' })).toBeInTheDocument();
    expect(await screen.findByText('qwen3:8b ready')).toBeInTheDocument();
    const composer = screen.getByRole('textbox', { name: 'Message NEXORA AI' });
    await user.type(composer, 'Banglay bolo');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText('Bangla response')).toBeInTheDocument();
    expect(chatMock).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Banglay bolo' }],
      expect.any(Function),
      expect.any(AbortSignal),
    );
    expect(screen.getByText(/1\.3s/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New chat' }));
    expect(screen.getByRole('heading', { level: 2, name: 'How can I help?' })).toBeInTheDocument();
    expect(screen.queryByText('Bangla response')).not.toBeInTheDocument();
  });

  it('creates alert rules and acknowledges open events', async () => {
    const user = userEvent.setup();
    renderWorkspace(<AlertWorkspace />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Alerts' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New alert' }));
    await user.type(screen.getByLabelText('Name'), 'Out of stock');
    await user.selectOptions(screen.getByLabelText('Condition'), 'out_of_stock');
    expect(screen.queryByLabelText('Percentage')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create alert' }));
    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith(
        'alerts/rules',
        expect.objectContaining({ method: 'POST' }),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Mark reviewed' }));
    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith(
        `alerts/events/${alertEvent.id}/acknowledge`,
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });
});
