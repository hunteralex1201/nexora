import { LoadingPanel } from '@/components/state-panel';

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="h-4 w-36 animate-pulse rounded bg-white/[0.05]" />
      <div className="mt-4 h-10 max-w-xl animate-pulse rounded-xl bg-white/[0.05]" />
      <div className="mt-7">
        <LoadingPanel label="Loading workspace status" />
      </div>
    </div>
  );
}
