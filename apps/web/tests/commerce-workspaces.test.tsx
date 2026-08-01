import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import type { AnchorHTMLAttributes, ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentWorkspace } from '@/components/commerce/agent-workspace';
import { AIWorkspace } from '@/components/commerce/ai-workspace';
import { AlertWorkspace } from '@/components/commerce/alert-workspace';
import { IntegrationWorkspace } from '@/components/commerce/integration-workspace';
import { JobWorkspace } from '@/components/commerce/job-workspace';
import { MarketWorkspace } from '@/components/commerce/market-workspace';
import { OverviewDashboard } from '@/components/commerce/overview-dashboard';
import { ProductWorkspace } from '@/components/commerce/product-workspace';
import { ReportWorkspace } from '@/components/commerce/report-workspace';
import { SettingsWorkspace } from '@/components/commerce/settings-workspace';
import { SourceWorkspace } from '@/components/commerce/source-workspace';
import { WorkflowWorkspace } from '@/components/commerce/workflow-workspace';
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

const insight = {
  id: 'insight-1',
  product_id: product.id,
  product_name: product.name,
  source_id: source.id,
  source_name: source.name,
  observation_id: observation.id,
  crawl_job_id: job.id,
  kind: 'product_summary',
  model: 'qwen3:8b',
  prompt_version: 'v1',
  content: 'The observed desk price is below the previous recorded price.',
  confidence: '0.88',
  evidence: {
    recommended_action: 'Verify the current listing before updating a campaign.',
    rationale: ['The latest persisted observation is BDT 75.00.'],
    observation_ids: [observation.id],
    facts: { current_price: '75.00', previous_price: '80.00' },
  },
  idempotency_key: 'insight-key-1',
  generated_at: now,
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
  if (path.startsWith('ai/insights?')) return [insight];
  if (path === 'ai/readiness') {
    return {
      status: 'ready',
      expected_chat_model: 'qwen3:8b',
      expected_embedding_model: 'qwen3-embedding:0.6b',
      installed_models: ['qwen3:8b', 'qwen3-embedding:0.6b'],
      missing_models: [],
    };
  }
  if (path === 'connectors') {
    return {
      jsonld: {
        connector_id: 'jsonld',
        connector_version: '1.0.0',
        parser_version: '1.0.0',
        capability_states: ['collect'],
        supported_fields: ['name', 'price', 'availability'],
        country: 'global',
        owner: 'NEXORA',
      },
      structured_html: {
        connector_id: 'structured_html',
        connector_version: '1.0.0',
        parser_version: '1.0.0',
        capability_states: ['collect'],
        supported_fields: ['name', 'price'],
        country: 'global',
        owner: 'NEXORA',
      },
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

  it('renders persisted market intelligence with evidence and Copilot handoff', async () => {
    const user = userEvent.setup();
    renderWorkspace(<MarketWorkspace />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Market Intelligence' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('88%')).toHaveLength(2);
    expect(
      screen.getByText('Verify the current listing before updating a campaign.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore with Copilot/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/ai?prompt='),
    );

    const search = screen.getByRole('textbox', { name: 'Search insights' });
    await user.type(search, 'desk');
    expect(search).toHaveValue('desk');
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

  it('maps implemented workflow recipes to the persisted job ledger', async () => {
    renderWorkspace(<WorkflowWorkspace />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Workflows' })).toBeInTheDocument();
    expect(screen.getAllByText('Product evidence collection').length).toBeGreaterThan(0);
    expect(screen.getByText('Local AI insight generation')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Run automation/i })).toHaveAttribute('href', '/jobs');
  });

  it('derives agent capability readiness from sources and the local model', async () => {
    renderWorkspace(<AgentWorkspace />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Agent Operations' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Collection Worker').length).toBeGreaterThan(0);
    expect(screen.getByText('Local Intelligence Worker')).toBeInTheDocument();
    expect(screen.getAllByText('Capability ready')).toHaveLength(2);
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

  it('previews persisted operational reports and switches export datasets', async () => {
    const user = userEvent.setup();
    renderWorkspace(<ReportWorkspace />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Reports' })).toBeInTheDocument();
    expect(screen.getAllByText('Product evidence').length).toBeGreaterThan(0);
    expect(screen.getByText('Premium Writing Desk')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download CSV/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /Automation ledger/i }));
    expect(screen.getByText('job-1')).toBeInTheDocument();
    expect(screen.getAllByText('failed').length).toBeGreaterThan(0);
  });

  it('renders only registered integrations and observed runtime state', async () => {
    const user = userEvent.setup();
    renderWorkspace(<IntegrationWorkspace />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Integrations' })).toBeInTheDocument();
    expect(screen.getByText('JSON-LD Commerce')).toBeInTheDocument();
    expect(screen.getByText('Structured HTML')).toBeInTheDocument();
    expect(screen.getByText('Ollama / Qwen runtime')).toBeInTheDocument();
    expect(screen.getByText('n8n automation API')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Search connectors' }), 'json');
    expect(screen.getByText('JSON-LD Commerce')).toBeInTheDocument();
    expect(screen.queryByText('Structured HTML')).not.toBeInTheDocument();
  });

  it('shows the no-login deployment policy and resets local interface preferences', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('nexora-sidebar-collapsed', 'true');
    window.localStorage.setItem('nexora-last-product-search', 'desk');
    renderWorkspace(<SettingsWorkspace />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('Open workspace access')).toBeInTheDocument();
    expect(await screen.findByText('qwen3:8b')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset interface preferences' }));
    expect(window.localStorage.getItem('nexora-sidebar-collapsed')).toBeNull();
    expect(window.localStorage.getItem('nexora-last-product-search')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Preferences reset');
  });

  it.each([
    ['Overview', <OverviewDashboard key="overview-accessibility" />],
    ['AI chat', <AIWorkspace key="ai-accessibility" />],
    ['Products', <ProductWorkspace key="products-accessibility" />],
    ['Alerts', <AlertWorkspace key="alerts-accessibility" />],
    ['Reports', <ReportWorkspace key="reports-accessibility" />],
    ['Integrations', <IntegrationWorkspace key="integrations-accessibility" />],
  ] as const)('has no automatically detectable accessibility violations in %s', async (heading, workspace) => {
    const mounted = renderWorkspace(workspace);
    await screen.findByRole('heading', { level: 1, name: heading });
    if (heading === 'AI chat') await screen.findByText('qwen3:8b ready');
    if (heading === 'Products') await screen.findByText('Current price');
    const result = await axe.run(mounted.container);
    expect(result.violations).toEqual([]);
    mounted.unmount();
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
