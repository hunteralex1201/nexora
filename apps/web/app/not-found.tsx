import { ArrowLeft, SearchX } from 'lucide-react';
import Link from 'next/link';

import { Brand } from '@/components/brand';

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="surface-grid grid min-h-screen place-items-center px-4 py-10 text-center"
    >
      <div className="max-w-lg">
        <div className="flex justify-center">
          <Brand />
        </div>
        <SearchX className="mx-auto mt-12 size-10 text-violet-300" aria-hidden="true" />
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
          404 — Route not found
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">
          This workspace route does not exist.
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-500">
          Return to the foundation overview. Future module routes will appear only after their
          implementation and validation phases are complete.
        </p>
        <Link
          href="/overview"
          className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-100 hover:bg-violet-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Return to overview
        </Link>
      </div>
    </main>
  );
}
