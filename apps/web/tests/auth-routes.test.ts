import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { POST as login } from '@/app/api/auth/login/route';
import { POST as logout } from '@/app/api/auth/logout/route';
import { proxy } from '@/proxy';

afterEach(() => {
  vi.unstubAllGlobals();
});

function loginRequest(email: string, password: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, password }).toString(),
  });
}

describe('web authentication routes', () => {
  it('stores a successful API token in an HTTP-only cookie', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'signed-token',
          token_type: 'bearer',
          expires_in: 1800,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await login(loginRequest('Operator@Example.com', 'FoundationPass123!'));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/overview');
    const cookie = response.headers.get('set-cookie');
    expect(cookie).toContain('nexora_access_token=signed-token');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=lax');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('keeps successful redirects relative when the runtime request host is internal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: 'signed-token',
            token_type: 'bearer',
            expires_in: 1800,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    const request = new NextRequest('http://0.0.0.0:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Host: 'workspace.example.com',
      },
      body: new URLSearchParams({
        email: 'operator@example.com',
        password: 'FoundationPass123!',
      }).toString(),
    });

    const response = await login(request);

    expect(response.headers.get('location')).toBe('/overview');
    expect(response.headers.get('location')).not.toContain('0.0.0.0');
  });

  it('redirects invalid form input without calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await login(loginRequest('operator@example.com', 'short'));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('/login?error=credentials');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('redirects failed API authentication back to login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));

    const response = await login(loginRequest('operator@example.com', 'FoundationPass123!'));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('/login?error=credentials');
  });

  it('clears the cookie during logout', async () => {
    const response = await logout();

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/login');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('requires a session cookie for protected routes', () => {
    const denied = proxy(new NextRequest('http://localhost:3000/overview'));
    expect(denied.headers.get('location')).toContain('/login?error=session');

    const allowedRequest = new NextRequest('http://localhost:3000/overview', {
      headers: { cookie: 'nexora_access_token=signed-token' },
    });
    const allowed = proxy(allowedRequest);
    expect(allowed.headers.get('x-middleware-next')).toBe('1');
  });
});
