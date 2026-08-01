import Link from 'next/link';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="group inline-flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/60"
      aria-label="NEXORA Intelligence home"
    >
      <span
        aria-hidden="true"
        className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-[11px] border border-[var(--blue)]/30 bg-[linear-gradient(145deg,rgba(91,140,255,0.22),rgba(155,123,255,0.08))] text-[15px] font-black tracking-[-0.08em] text-white shadow-[0_0_28px_rgba(91,140,255,0.14)]"
      >
        <span className="absolute inset-x-1.5 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
        N
      </span>
      {!compact && (
        <span className="nx-brand-copy min-w-0">
          <span className="block truncate text-[13px] font-bold tracking-[0.16em] text-white">
            NEXORA
          </span>
          <span className="mt-0.5 block truncate text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--faint)]">
            Intelligence OS
          </span>
        </span>
      )}
    </Link>
  );
}
