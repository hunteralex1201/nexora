import Link from 'next/link';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b85c3d]/30"
      aria-label="NEXORA Intelligence home"
    >
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-[10px] bg-[#292823] text-[13px] font-semibold tracking-[-0.04em] text-[#f8f6f0] shadow-sm"
      >
        N
      </span>
      {!compact && (
        <span className="text-[13px] font-semibold tracking-[0.16em] text-[#2f2d28]">NEXORA</span>
      )}
    </Link>
  );
}
