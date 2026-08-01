import { AlertCircle, LoaderCircle, PackageOpen } from 'lucide-react';
import type { ReactNode } from 'react';

export function MetricCard({
  label,
  value,
  detail,
  tone = 'text-[var(--text)]',
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  tone?: string;
}) {
  return (
    <article className="nx-panel p-4 sm:p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">
        {label}
      </p>
      <p className={`mt-2.5 text-[26px] font-semibold tracking-[-0.045em] ${tone}`}>{value}</p>
      {detail ? <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">{detail}</p> : null}
    </article>
  );
}

const statusTone: Record<string, string> = {
  active: 'border-[var(--emerald)]/20 bg-[var(--emerald)]/[0.08] text-[#8ce9c3]',
  ready: 'border-[var(--emerald)]/20 bg-[var(--emerald)]/[0.08] text-[#8ce9c3]',
  healthy: 'border-[var(--emerald)]/20 bg-[var(--emerald)]/[0.08] text-[#8ce9c3]',
  succeeded: 'border-[var(--emerald)]/20 bg-[var(--emerald)]/[0.08] text-[#8ce9c3]',
  completed: 'border-[var(--emerald)]/20 bg-[var(--emerald)]/[0.08] text-[#8ce9c3]',
  acknowledged: 'border-[var(--emerald)]/20 bg-[var(--emerald)]/[0.08] text-[#8ce9c3]',
  running: 'border-[var(--blue)]/20 bg-[var(--blue)]/[0.08] text-[#a8c1ff]',
  queued: 'border-[var(--amber)]/20 bg-[var(--amber)]/[0.08] text-[#f9d97e]',
  open: 'border-[var(--red)]/20 bg-[var(--red)]/[0.08] text-[#ff9aad]',
  failed: 'border-[var(--red)]/20 bg-[var(--red)]/[0.08] text-[#ff9aad]',
  dead: 'border-[var(--red)]/20 bg-[var(--red)]/[0.08] text-[#ff9aad]',
  degraded: 'border-[var(--amber)]/20 bg-[var(--amber)]/[0.08] text-[#f9d97e]',
  paused: 'border-white/[0.1] bg-white/[0.04] text-[var(--muted)]',
  inactive: 'border-white/[0.1] bg-white/[0.04] text-[var(--muted)]',
};

const statusDot: Record<string, string> = {
  active: 'bg-[var(--emerald)]',
  ready: 'bg-[var(--emerald)]',
  healthy: 'bg-[var(--emerald)]',
  succeeded: 'bg-[var(--emerald)]',
  completed: 'bg-[var(--emerald)]',
  acknowledged: 'bg-[var(--emerald)]',
  running: 'bg-[var(--blue)]',
  queued: 'bg-[var(--amber)]',
  open: 'bg-[var(--red)]',
  failed: 'bg-[var(--red)]',
  dead: 'bg-[var(--red)]',
  degraded: 'bg-[var(--amber)]',
  paused: 'bg-[var(--faint)]',
  inactive: 'bg-[var(--faint)]',
};

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold capitalize tracking-[0.04em] ${
        statusTone[normalized] ??
        'border-[var(--violet)]/20 bg-[var(--violet)]/[0.08] text-[#c8b9ff]'
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${statusDot[normalized] ?? 'bg-[var(--violet)]'}`}
        aria-hidden="true"
      />
      {status.replaceAll('_', ' ')}
    </span>
  );
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <section aria-busy="true" aria-live="polite" className="grid min-h-64 place-items-center">
      <div className="text-center">
        <span className="mx-auto grid size-10 place-items-center rounded-xl border border-[var(--blue)]/15 bg-[var(--blue)]/[0.06]">
          <LoaderCircle className="size-5 animate-spin text-[var(--blue)]" aria-hidden="true" />
        </span>
        <p className="mt-3 text-[12px] text-[var(--muted)]">{label}</p>
      </div>
    </section>
  );
}

export function ErrorState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <section role="alert" className="rounded-2xl border border-[var(--red)]/20 bg-[var(--red)]/[0.055] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--red)]/10">
          <AlertCircle className="size-[18px] text-[var(--red)]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-[#ffc0cb]">Couldn’t complete this request</h2>
          <p className="mt-1 text-[12px] leading-5 text-[#d998a4]">{message}</p>
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-dashed border-white/[0.13] bg-white/[0.018] px-6 py-10 text-center sm:py-12">
      <span className="mx-auto grid size-11 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.035]">
        <PackageOpen className="size-5 text-[var(--faint)]" aria-hidden="true" />
      </span>
      <h2 className="mt-3.5 text-[13px] font-semibold text-[var(--text)]">{title}</h2>
      {description ? (
        <p className="mx-auto mt-1.5 max-w-lg text-[11px] leading-5 text-[var(--muted)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}
