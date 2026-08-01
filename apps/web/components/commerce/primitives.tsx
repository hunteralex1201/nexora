import { AlertCircle, LoaderCircle, PackageOpen } from 'lucide-react';
import type { ReactNode } from 'react';

export function MetricCard({
  label,
  value,
  detail,
  tone = 'text-[#272622]',
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  tone?: string;
}) {
  return (
    <article className="nx-panel p-4 sm:p-5">
      <p className="text-[11px] font-medium text-[#747168]">{label}</p>
      <p className={`mt-2 text-[25px] font-semibold tracking-[-0.04em] ${tone}`}>{value}</p>
      {detail ? <p className="mt-1 text-xs leading-5 text-[#9d998f]">{detail}</p> : null}
    </article>
  );
}

const statusTone: Record<string, string> = {
  active: 'border-[#cce3d5] bg-[#eaf4ee] text-[#287a55]',
  ready: 'border-[#cce3d5] bg-[#eaf4ee] text-[#287a55]',
  healthy: 'border-[#cce3d5] bg-[#eaf4ee] text-[#287a55]',
  succeeded: 'border-[#cce3d5] bg-[#eaf4ee] text-[#287a55]',
  acknowledged: 'border-[#cce3d5] bg-[#eaf4ee] text-[#287a55]',
  running: 'border-[#cfdfdf] bg-[#edf4f4] text-[#376d70]',
  queued: 'border-[#eadbb9] bg-[#f8f0df] text-[#986817]',
  open: 'border-[#eccbc6] bg-[#f9eae7] text-[#a5463c]',
  failed: 'border-[#eccbc6] bg-[#f9eae7] text-[#a5463c]',
  inactive: 'border-[#dedbd2] bg-[#f0eee8] text-[#747168]',
};

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize ${statusTone[normalized] ?? 'border-[#decfc7] bg-[#f4e6df] text-[#9d4b32]'}`}
    >
      {status.replaceAll('_', ' ')}
    </span>
  );
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="grid min-h-48 place-items-center">
      <div className="text-center">
        <LoaderCircle className="mx-auto size-5 animate-spin text-[#b85c3d]" aria-hidden="true" />
        <p className="mt-3 text-[13px] text-[#747168]">{label}</p>
      </div>
    </div>
  );
}

export function ErrorState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#eccbc6] bg-[#f9eae7] p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-[18px] shrink-0 text-[#a5463c]" aria-hidden="true" />
        <div>
          <h2 className="text-[13px] font-semibold text-[#80372f]">
            Couldn’t complete this request
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-[#96534b]">{message}</p>
          {action ? <div className="mt-3">{action}</div> : null}
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
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[#d6d2c8] bg-[#faf9f6] px-6 py-10 text-center">
      <PackageOpen className="mx-auto size-6 text-[#aaa69c]" aria-hidden="true" />
      <h2 className="mt-3 text-[13px] font-semibold text-[#3b3933]">{title}</h2>
      {description ? (
        <p className="mx-auto mt-1.5 max-w-lg text-xs leading-5 text-[#858178]">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
