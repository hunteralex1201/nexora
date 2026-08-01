import { AlertTriangle, LoaderCircle, PackageOpen } from 'lucide-react';
import type { ReactNode } from 'react';

export function MetricCard({
  label,
  value,
  detail,
  tone = 'text-white',
}: {
  label: string;
  value: ReactNode;
  detail: string;
  tone?: string;
}) {
  return (
    <article className="rounded-2xl border border-white/8 bg-white/[0.025] p-5 shadow-[0_18px_50px_rgba(2,6,23,0.16)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-3 text-2xl font-semibold tracking-[-0.03em] ${tone}`}>{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

const statusTone: Record<string, string> = {
  active: 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200',
  succeeded: 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200',
  acknowledged: 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200',
  running: 'border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-200',
  queued: 'border-amber-400/20 bg-amber-400/[0.08] text-amber-200',
  open: 'border-rose-400/20 bg-rose-400/[0.08] text-rose-200',
  failed: 'border-rose-400/20 bg-rose-400/[0.08] text-rose-200',
  inactive: 'border-slate-400/15 bg-slate-400/[0.06] text-slate-400',
};

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${statusTone[normalized] ?? 'border-violet-400/20 bg-violet-400/[0.08] text-violet-200'}`}
    >
      {status.replaceAll('_', ' ')}
    </span>
  );
}

export function LoadingState({ label = 'Loading live data' }: { label?: string }) {
  return (
    <div className="grid min-h-48 place-items-center rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center">
      <div>
        <LoaderCircle className="mx-auto size-6 animate-spin text-violet-300" aria-hidden="true" />
        <p className="mt-3 text-sm text-slate-400">{label}</p>
      </div>
    </div>
  );
}

export function ErrorState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-rose-400/15 bg-rose-500/[0.05] p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-300" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold text-rose-100">Live data request failed</h2>
          <p className="mt-1 text-sm leading-6 text-rose-200/65">{message}</p>
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.018] p-8 text-center">
      <PackageOpen className="mx-auto size-7 text-slate-600" aria-hidden="true" />
      <h2 className="mt-4 text-sm font-semibold text-slate-200">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
