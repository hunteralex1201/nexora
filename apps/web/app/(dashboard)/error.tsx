'use client';

import { RotateCcw, TriangleAlert } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-rose-400/15 bg-rose-500/[0.035] p-6">
      <TriangleAlert className="size-6 text-rose-300" aria-hidden="true" />
      <h1 className="mt-4 text-xl font-semibold text-white">The workspace could not be rendered</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Retry the request. If the issue continues, review the API and web logs using the request
        context rather than exposing implementation details in the browser.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-xs text-slate-600">Reference: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-100 hover:bg-rose-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
      >
        <RotateCcw className="size-4" aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}
