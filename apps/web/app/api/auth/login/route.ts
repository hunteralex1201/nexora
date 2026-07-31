import { NextRequest, NextResponse } from 'next/server';

import { sameOriginRedirect } from '@/lib/same-origin-redirect';

interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
}

function apiBaseUrl(): string {
  return (
    process.env.INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:8000/api/v1'
  ).replace(/\/$/, '');
}

function loginRedirect(error: string): NextResponse {
  return sameOriginRedirect(`/login?error=${error}`);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const form = await request.formData();
  const email = String(form.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(form.get('password') ?? '');

  if (!email || password.length < 12) {
    return loginRedirect('credentials');
  }

  const body = new URLSearchParams({ username: email, password });

  try {
    const apiResponse = await fetch(`${apiBaseUrl()}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });

    if (!apiResponse.ok) {
      return loginRedirect('credentials');
    }

    const token = (await apiResponse.json()) as TokenResponse;
    const response = sameOriginRedirect('/overview');
    response.cookies.set('nexora_access_token', token.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: token.expires_in,
      path: '/',
    });
    return response;
  } catch {
    return loginRedirect('unavailable');
  }
}
