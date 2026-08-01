'use client';

export interface Source {
  id: string;
  name: string;
  type: string;
  base_url: string;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Observation {
  id: string;
  observed_at: string;
  price: string;
  original_price: string | null;
  currency: string;
  availability: string;
  seller_name: string | null;
  rating: string | null;
  review_count: number | null;
  source_url: string;
  collector: string;
  evidence: Record<string, unknown>;
  evidence_hash: string;
  created_at: string;
}

export interface Product {
  id: string;
  source_id: string;
  source_name: string;
  external_id: string;
  name: string;
  canonical_url: string;
  brand: string | null;
  category: string | null;
  currency: string;
  image_url: string | null;
  is_active: boolean;
  last_seen_at: string;
  latest_observation: Observation | null;
  previous_price: string | null;
  price_change_percent: string | null;
}

export interface ProductDetail extends Product {
  attributes: Record<string, unknown>;
  first_seen_at: string;
  history: Observation[];
}

export interface ProductPage {
  items: Product[];
  total: number;
  limit: number;
  offset: number;
}

export interface Job {
  id: string;
  source_id: string;
  status: string;
  job_type: string;
  trigger: string;
  requested_by_id: string | null;
  payload: Record<string, unknown>;
  attempt: number;
  max_attempts: number;
  idempotency_key: string | null;
  queued_at: string;
  started_at: string | null;
  last_heartbeat_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  metrics: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AlertRule {
  id: string;
  owner_id: string | null;
  source_id: string | null;
  product_id: string | null;
  name: string;
  rule_type: string;
  threshold: string | null;
  config: Record<string, unknown>;
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertEvent {
  id: string;
  rule_id: string;
  product_id: string;
  observation_id: string;
  status: string;
  message: string;
  payload: Record<string, unknown>;
  triggered_at: string;
  acknowledged_at: string | null;
}

export interface OverviewActivityPoint {
  day: string;
  observations: number;
  jobs: number;
  alerts: number;
}

export interface Overview {
  generated_at: string;
  sources: { total: number; active: number | null };
  products: { total: number; active: number | null };
  observations: { total: number; active: number | null };
  jobs: Record<string, number>;
  alerts: Record<string, number>;
  latest_observation_at: string | null;
  activity?: OverviewActivityPoint[];
  recent_jobs: Job[];
  recent_alerts: AlertEvent[];
}

export interface AIInsight {
  id: string;
  product_id: string;
  product_name: string;
  source_id: string;
  source_name: string;
  observation_id: string | null;
  crawl_job_id: string | null;
  kind: string;
  model: string;
  prompt_version: string;
  content: string;
  confidence: string | null;
  evidence: {
    recommended_action?: string;
    rationale?: string[];
    observation_ids?: string[];
    facts?: Record<string, unknown>;
  };
  idempotency_key: string;
  generated_at: string;
}

export interface AIReadiness {
  status: 'ready' | 'degraded';
  expected_chat_model: string;
  expected_embedding_model: string;
  installed_models: string[];
  missing_models: string[];
}

export interface ConnectorMetadata {
  connector_id: string;
  connector_version: string;
  parser_version: string;
  capability_states: string[];
  supported_fields: string[];
  country: string;
  owner: string;
}

export type ConnectorRegistry = Record<string, ConnectorMetadata>;

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIChatStreamEvent {
  type: 'start' | 'token' | 'done' | 'error';
  content?: string;
  model?: string;
  total_duration_ms?: number;
}

async function errorMessage(response: Response): Promise<string> {
  let detail = '';
  try {
    const payload = (await response.json()) as { detail?: string | Array<{ msg?: string }> };
    if (typeof payload.detail === 'string') detail = payload.detail;
    if (Array.isArray(payload.detail))
      detail = payload.detail.map((item) => item.msg ?? 'Check this field').join('; ');
  } catch {
    // Some upstream failures have no JSON body. Use a human-readable status fallback below.
  }

  if (/source is inactive/i.test(detail))
    return 'This source is paused. Activate it from Sources and try again.';
  if (/not found/i.test(detail))
    return 'This item no longer exists. Refresh the page and try again.';
  if (detail) return detail;
  if (response.status === 409)
    return 'This action conflicts with the current state. Refresh and try again.';
  if (response.status === 422) return 'Check the form fields and try again.';
  if (response.status === 429) return 'Too many requests. Wait a moment and try again.';
  if (response.status >= 500) return 'NEXORA could not complete this action. Try again shortly.';
  return response.statusText || 'The request could not be completed.';
}

export async function commerceRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/commerce/${path.replace(/^\//, '')}`, {
    ...init,
    cache: 'no-store',
    headers:
      init?.body instanceof FormData
        ? init.headers
        : { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function streamAIChat(
  messages: AIChatMessage[],
  onEvent: (event: AIChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch('/api/commerce/ai/chat', {
    method: 'POST',
    cache: 'no-store',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
    body: JSON.stringify({ messages, temperature: 0.3, max_tokens: 512 }),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  if (!response.body) throw new Error('The local model returned no response.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split('\n');
    buffer = done ? '' : (lines.pop() ?? '');

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as AIChatStreamEvent;
      onEvent(event);
      if (event.type === 'error') throw new Error(event.content ?? 'Local AI could not respond.');
    }
    if (done) break;
  }
}

export function formatMoney(value: string | number | null | undefined, currency = 'BDT'): string {
  if (value === null || value === undefined || value === '') return '—';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
