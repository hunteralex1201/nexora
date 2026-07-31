import { NextResponse } from 'next/server';

import { sameOriginRedirect } from '@/lib/same-origin-redirect';

export async function POST(): Promise<NextResponse> {
  const response = sameOriginRedirect('/login');
  response.cookies.set('nexora_access_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}
