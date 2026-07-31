import { AlertTriangle, DatabaseZap, LoaderCircle, LockKeyhole, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

const variants = {
  empty: {
    icon: DatabaseZap,
    color: 'text-cyan-300',
    surface: 'border-cyan-400/15 bg-cyan-400/[0.035]',
  },
  error: {
    icon: TriangleAlert,
    color: 'text-rose-300',
    surface: 'border-rose-400/15 bg-rose-400/[0.035]',
  },
  partial: {
    icon: AlertTriangle,
    color: 'text-amber-300',
    surface: 'border-amber-400/15 bg-amber-400/[0.035]',
  },
  restricted: {
    icon: LockKeyhole,
    color: 'text-violet-300',
    surface: 'border-violet-400/15 bg-violet-400/[0.035]',
  },
} as const;

export function StatePanel({
  variant,
  title,
  description,
  action,
}: {
  variant: keyof typeof variants;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const state = variants[variant];
  const Icon = state.icon;

  return (
    <section className={`rounded-2xl border p-5 ${state.surface}`}>
      <Icon className={`size-5 ${state.color}`} aria-hidden="true" />
      <h2 className="mt-4 text-sm font-semibold text-slate-100">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
}

export function LoadingPanel({ label = 'Loading workspace' }: { label?: string }) {
  return (
    <section
      className="rounded-2xl border border-white/8 bg-white/[0.025] p-5"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
        <LoaderCircle className="size-4 animate-spin text-violet-300" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-24 animate-pulse rounded-xl border border-white/5 bg-white/[0.035]"
          />
        ))}
      </div>
    </section>
  );
}
