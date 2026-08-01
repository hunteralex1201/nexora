import { ArrowLeft, LockKeyhole } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Brand } from '@/components/brand';

export const metadata: Metadata = { title: 'Sign in' };

const errorMessages: Record<string, string> = {
  credentials: 'The email or password is incorrect.',
  unavailable: 'NEXORA is temporarily unavailable. Please try again shortly.',
  session: 'Your session expired. Sign in again to continue.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? errorMessages[error] : undefined;

  return (
    <main
      id="main-content"
      className="surface-grid grid min-h-screen place-items-center px-4 py-10 sm:px-6"
    >
      <div className="w-full max-w-[420px]">
        <div className="mb-7 flex items-center justify-between px-1">
          <Brand />
          <Link href="/" className="nx-button-quiet !min-h-9 !px-2.5">
            <ArrowLeft className="size-4" aria-hidden="true" /> Home
          </Link>
        </div>

        <section className="rounded-[1.25rem] border border-[#dedbd2] bg-white p-6 shadow-[0_24px_70px_rgba(44,40,32,0.10)] sm:p-8">
          <h1 className="text-2xl font-semibold tracking-[-0.035em] text-[#272622]">
            Welcome back
          </h1>
          <p className="mt-2 text-[13px] text-[#747168]">Sign in to your NEXORA workspace.</p>

          {message ? (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-[#eccbc6] bg-[#f9eae7] px-3.5 py-3 text-[13px] text-[#96534b]"
            >
              {message}
            </div>
          ) : null}

          <form action="/api/auth/login" method="post" className="mt-7 space-y-4">
            <label htmlFor="email" className="nx-label">
              Email
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                inputMode="email"
                className="nx-input"
                placeholder="you@company.com"
              />
            </label>
            <label htmlFor="password" className="nx-label">
              Password
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={12}
                className="nx-input"
                placeholder="Enter your password"
              />
            </label>
            <button type="submit" className="nx-button mt-2 w-full !min-h-11">
              <LockKeyhole className="size-4" aria-hidden="true" /> Sign in
            </button>
          </form>
        </section>
        <p className="mt-5 text-center text-[11px] text-[#9d998f]">
          Private workspace · Authorized access only
        </p>
      </div>
    </main>
  );
}
