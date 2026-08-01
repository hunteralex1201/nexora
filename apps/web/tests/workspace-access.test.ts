import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST as forwardCommerce } from '@/app/api/commerce/[...path]/route';
import LoginPage from '@/app/login/page';
import Home from '@/app/page';
import { streamAIChat, type AIChatStreamEvent } from '@/lib/commerce-client';

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ redirect: redirectMock }));

function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
}

describe('direct workspace access', () => {
  beforeEach(() => {
    redirectMock.mockReset();
    vi.stubEnv('INTERNAL_API_URL', 'http://api:8000/api/v1');
    vi.stubEnv('WORKSPACE_API_KEY', 'server-only-workspace-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sends both the public root and old login bookmark straight to overview', () => {
    Home();
    LoginPage();

    expect(redirectMock).toHaveBeenNthCalledWith(1, '/overview');
    expect(redirectMock).toHaveBeenNthCalledWith(2, '/overview');
  });

  it('uses the server-only workspace key and streams upstream chat events unchanged', async () => {
    const upstream = streamFrom([
      '{"type":"start","model":"qwen3:8b"}\n',
      '{"type":"token","content":"Hello"}\n',
      '{"type":"done","total_duration_ms":42}\n',
    ]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(upstream, {
        status: 200,
        headers: {
          'Content-Type': 'application/x-ndjson',
          'X-Accel-Buffering': 'no',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const request = new NextRequest('http://localhost:3000/api/commerce/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] }),
    });
    const response = await forwardCommerce(request, {
      params: Promise.resolve({ path: ['ai', 'chat'] }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/x-ndjson');
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    expect(await response.text()).toContain('{"type":"token","content":"Hello"}');

    const [target, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(target.toString()).toBe('http://api:8000/api/v1/commerce/ai/chat');
    const headers = init.headers as Headers;
    expect(headers.get('X-Workspace-Key')).toBe('server-only-workspace-key');
    expect(headers.get('Authorization')).toBeNull();
  });

  it('fails closed when the server-only workspace credential is missing', async () => {
    vi.stubEnv('WORKSPACE_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await forwardCommerce(
      new NextRequest('http://localhost:3000/api/commerce/overview'),
      { params: Promise.resolve({ path: ['overview'] }) },
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      detail: 'Workspace service credential is not configured',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('streaming chat client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses NDJSON events even when network chunks split a token event', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          streamFrom([
            '{"type":"start","model":"qwen3:8b"}\n{"type":"tok',
            'en","content":"Bangla response"}\n{"type":"done","total_duration_ms":25}\n',
          ]),
          { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const events: AIChatStreamEvent[] = [];

    await streamAIChat([{ role: 'user', content: 'Banglay bolo' }], (event) => events.push(event));

    expect(events).toEqual([
      { type: 'start', model: 'qwen3:8b' },
      { type: 'token', content: 'Bangla response' },
      { type: 'done', total_duration_ms: 25 },
    ]);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      messages: [{ role: 'user', content: 'Banglay bolo' }],
      max_tokens: 512,
    });
  });
});
