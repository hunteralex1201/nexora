import { ArrowLeft, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Brand } from '@/components/brand';

export const metadata: Metadata = {
  title: 'Sign in',
};

const errorMessages: Record<string, string> = {
  credentials: 'The email or password was not accepted.',
  unavailable: 'The authentication service is not ready. Verify the API and database.',
  session: 'Your protected session is required to open the workspace.',
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
      className="surface-grid grid min-h-screen place-items-center px-4 py-10 text-white sm:px-6"
    >
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Brand />
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Home
          </Link>
        </div>

        <section className="rounded-[1.75rem] border border-white/10 bg-[#0a101c]/95 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.4)] backdrop-blur sm:p-8">
          <span className="grid size-11 place-items-center rounded-xl border border-violet-400/20 bg-violet-500/10 text-violet-300">
            <KeyRound className="size-5" aria-hidden="true" />
          </span>
          <h1 className="mt-6 text-2xl font-semibold tracking-[-0.02em]">Sign in to NEXORA</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Use an administrator or analyst account provisioned through the backend management
            command.
          </p>

          {message && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-rose-400/20 bg-rose-500/[0.07] px-4 py-3 text-sm text-rose-200"
            >
              {message}
            </div>
          )}

          <form action="/api/auth/login" method="post" className="mt-7 space-y-5">
            <div>
              <label htmlFor="email" className="text-sm font-medium text-slate-300">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                inputMode="email"
                className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950/55 px-3.5 text-sm text-white outline-none placeholder:text-slate-700 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/15"
                placeholder="operator@example.com"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-slate-300">
                  Password
                </label>
                <span className="text-xs text-slate-600">Minimum 12 characters</span>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={12}
                className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950/55 px-3.5 text-sm text-white outline-none placeholder:text-slate-700 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/15"
                placeholder="Enter your password"
              />
            </div>
            <button
              type="submit"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_35px_rgba(79,70,229,0.22)] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              <LockKeyhole className="size-4" aria-hidden="true" />
              Continue securely
            </button>
          </form>

          <div className="mt-6 flex gap-3 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] p-3.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-cyan-300" aria-hidden="true" />
            <p className="text-xs leading-5 text-cyan-100/65">
              Access tokens are stored in an HTTP-only cookie by the web server. This foundation
              does not provide self-registration or social sign-in.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
