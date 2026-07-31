import Link from 'next/link';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      aria-label="NEXORA Intelligence home"
    >
      <span
        aria-hidden="true"
        className="grid size-10 place-items-center rounded-xl border border-violet-400/30 bg-gradient-to-br from-violet-500/25 via-blue-500/20 to-cyan-400/20 shadow-[0_0_30px_rgba(139,92,246,0.18)]"
      >
        <span className="h-5 w-5 rotate-45 rounded-[4px] border-2 border-violet-300 border-r-cyan-300 border-b-blue-400" />
      </span>
      {!compact && (
        <span>
          <span className="block text-sm font-semibold tracking-[0.24em] text-white">NEXORA</span>
          <span className="block text-[10px] uppercase tracking-[0.28em] text-slate-500">
            Intelligence
          </span>
        </span>
      )}
    </Link>
  );
}
