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

function safePath(segments: string[]): string | null {
  if (!segments.length) return null;
  return segments.every((segment) => /^[a-zA-Z0-9_-]+$/.test(segment))
    ? segments.join('/')
    : null;
}

async function forward(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const token = request.cookies.get('nexora_access_token')?.value;
  if (!token) {
    return NextResponse.json({ detail: 'Authentication required' }, { status: 401 });
  }

  const { path } = await context.params;
  const targetPath = safePath(path);
  if (!targetPath) {
    return NextResponse.json({ detail: 'Invalid commerce path' }, { status: 400 });
  }

  const url = new URL(`${apiBaseUrl()}/commerce/${targetPath}`);
  request.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));

  const headers = new Headers({ Authorization: `Bearer ${token}` });
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);

  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(60_000),
    });
    const responseBody = await response.arrayBuffer();
    const responseHeaders = new Headers();
    const responseType = response.headers.get('content-type');
    if (responseType) responseHeaders.set('Content-Type', responseType);
    responseHeaders.set('Cache-Control', 'no-store');
    return new NextResponse(responseBody, {
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
