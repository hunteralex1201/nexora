import { Activity, Boxes, Database, HardDrive, ServerCog, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { StatePanel } from '@/components/state-panel';

export const metadata: Metadata = {
  title: 'System',
};
export const dynamic = 'force-dynamic';

interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  request_id: string;
  dependencies: Record<string, 'healthy' | 'unhealthy'>;
}

async function getReadiness(): Promise<ReadinessResponse | null> {
  const baseUrl = (
    process.env.INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:8000/api/v1'
  ).replace(/\/$/, '');

  try {
    const response = await fetch(`${baseUrl}/ready`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4_000),
    });
    const payload = (await response.json()) as ReadinessResponse;
    return payload;
  } catch {
    return null;
  }
}

const platformServices = [
  {
    name: 'API gateway',
    description: 'FastAPI contract, tracing, and structured errors',
    icon: ServerCog,
    phase: 'Foundation',
  },
  {
    name: 'PostgreSQL',
    description: 'Transactional models and Alembic migrations',
    icon: Database,
    phase: 'Foundation',
  },
  {
    name: 'Redis',
    description: 'Cache and future queue coordination',
    icon: Activity,
    phase: 'Foundation',
  },
  {
    name: 'MinIO',
    description: 'Immutable raw evidence storage',
    icon: HardDrive,
    phase: 'Configured only',
  },
  {
    name: 'Qdrant',
    description: 'Future evidence retrieval index',
    icon: Boxes,
    phase: 'Configured only',
  },
] as const;

function serviceStatus(
  service: (typeof platformServices)[number],
  readiness: ReadinessResponse | null,
): { label: string; className: string } {
  if (service.name === 'PostgreSQL') {
    const status = readiness?.dependencies.database;
    return status === 'healthy'
      ? { label: 'Healthy', className: 'text-emerald-300' }
      : status === 'unhealthy'
        ? { label: 'Unhealthy', className: 'text-rose-300' }
        : { label: 'Unknown', className: 'text-slate-500' };
  }
  if (service.name === 'Redis') {
    const status = readiness?.dependencies.redis;
    return status === 'healthy'
      ? { label: 'Healthy', className: 'text-emerald-300' }
      : status === 'unhealthy'
        ? { label: 'Unhealthy', className: 'text-rose-300' }
        : { label: 'Unknown', className: 'text-slate-500' };
  }
  if (service.name === 'API gateway') {
    return readiness
      ? { label: 'Reachable', className: 'text-emerald-300' }
      : { label: 'Unknown', className: 'text-slate-500' };
  }
  return { label: 'Not probed', className: 'text-slate-500' };
}

export default async function SystemPage() {
  const readiness = await getReadiness();
  const systemReady = readiness?.status === 'ready';

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="System control"
        title="Readiness without hidden assumptions."
        description="Core dependency status is fetched from the API readiness contract. Optional services remain marked as configured or unprobed until application integrations are implemented."
        actions={
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              systemReady
                ? 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-200'
                : 'border-amber-400/20 bg-amber-400/[0.07] text-amber-200'
            }`}
          >
            <span
              className={`size-2 rounded-full ${systemReady ? 'status-pulse bg-emerald-400' : 'bg-amber-400'}`}
              aria-hidden="true"
            />
            {systemReady ? 'Core ready' : 'Readiness incomplete'}
          </span>
        }
      />

      <section className="mt-7 overflow-hidden rounded-2xl border border-white/8 bg-[#0a101c]/80">
        <div className="border-b border-white/8 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-violet-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-200">Platform services</h2>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Probe values are current only for the API, database, and Redis dependencies.
          </p>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {platformServices.map((service) => {
            const Icon = service.icon;
            const status = serviceStatus(service, readiness);
            return (
              <article
                key={service.name}
                className="grid gap-4 px-5 py-4 sm:grid-cols-[2fr_1fr_1fr] sm:items-center sm:px-6"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/8 bg-white/[0.03] text-slate-400">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-medium text-slate-200">{service.name}</h3>
                    <p className="mt-1 text-xs text-slate-600">{service.description}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-700 sm:hidden">
                    Status
                  </p>
                  <p className={`text-sm font-medium ${status.className}`}>{status.label}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-700 sm:hidden">
                    Scope
                  </p>
                  <p className="text-xs text-slate-500">{service.phase}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {readiness ? (
          <StatePanel
            variant={systemReady ? 'empty' : 'partial'}
            title={
              systemReady
                ? 'Core dependencies are responding'
                : 'One or more core dependencies are unavailable'
            }
            description={`Readiness request ${readiness.request_id}. No connection URL, password, or credential is exposed by this response.`}
          />
        ) : (
          <StatePanel
            variant="error"
            title="API readiness could not be reached"
            description="Start the local API and its core Docker services, then reload this page. The workspace will not infer a healthy state when the probe is unavailable."
          />
        )}
        <StatePanel
          variant="restricted"
          title="Operational actions are intentionally disabled"
          description="Scaling, backups, connector execution, and external automation are future operations that require validated services, configured credentials, explicit controls, and audit evidence."
        />
      </div>
    </div>
  );
}
