import { NextResponse } from 'next/server';

export function sameOriginRedirect(
  location: string,
  status: 302 | 303 | 307 | 308 = 303,
): NextResponse {
  if (!location.startsWith('/') || location.startsWith('//')) {
    throw new Error('Same-origin redirects require an absolute path');
  }

  return new NextResponse(null, {
    status,
    headers: { Location: location },
  });
}
