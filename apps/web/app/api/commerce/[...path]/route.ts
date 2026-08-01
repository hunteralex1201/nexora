import { NextRequest, NextResponse } from 'next/server';

function apiBaseUrl(): string {
  return (
    process.env.INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:8000/api/v1'
  ).replace(/\/$/, '');
}

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

interface RateWindow {
  count: number;
  resetAt: number;
}

const rateWindows = new Map<string, RateWindow>();

function rateLimit(request: NextRequest, bucket: 'chat' | 'write'): number | null {
  const forwarded = request.headers.get('x-forwarded-for');
  const client = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local';
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const limit = bucket === 'chat' ? 12 : 60;
  const key = `${bucket}:${client}`;
  const current = rateWindows.get(key);

  if (!current || current.resetAt <= now) {
    rateWindows.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  if (current.count >= limit) return Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  current.count += 1;
  return null;
}

function safePath(segments: string[]): string | null {
  if (!segments.length) return null;
  return segments.every((segment) => /^[a-zA-Z0-9_-]+$/.test(segment)) ? segments.join('/') : null;
}

async function forward(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const token = request.cookies.get('nexora_access_token')?.value;
  const workspaceKey = process.env.WORKSPACE_API_KEY?.trim();
  if (!token && !workspaceKey) {
    return NextResponse.json(
      { detail: 'Workspace service credential is not configured' },
      { status: 503 },
    );
  }

  const { path } = await context.params;
  const targetPath = safePath(path);
  if (!targetPath) {
    return NextResponse.json({ detail: 'Invalid commerce path' }, { status: 400 });
  }

  const method = request.method.toUpperCase();
  if (targetPath === 'ai/chat' || !['GET', 'HEAD'].includes(method)) {
    const retryAfter = rateLimit(request, targetPath === 'ai/chat' ? 'chat' : 'write');
    if (retryAfter !== null) {
      return NextResponse.json(
        { detail: 'Too many requests. Wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      );
    }
  }

  const url = new URL(`${apiBaseUrl()}/commerce/${targetPath}`);
  request.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));

  const headers = new Headers();
  if (workspaceKey) headers.set('X-Workspace-Key', workspaceKey);
  else if (token) headers.set('Authorization', `Bearer ${token}`);
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  const accept = request.headers.get('accept');
  if (accept) headers.set('Accept', accept);

  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(targetPath === 'ai/chat' ? 300_000 : 60_000),
    });
    const responseHeaders = new Headers();
    const responseType = response.headers.get('content-type');
    if (responseType) responseHeaders.set('Content-Type', responseType);
    const buffering = response.headers.get('x-accel-buffering');
    if (buffering) responseHeaders.set('X-Accel-Buffering', buffering);
    responseHeaders.set('Cache-Control', 'no-store');
    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json({ detail: 'Commerce API unavailable' }, { status: 503 });
  }
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: RouteContext) {
  return forward(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return forward(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return forward(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return forward(request, context);
}
