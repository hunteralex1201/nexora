import { Activity, Database, ServerCog } from 'lucide-react';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = { title: 'System health' };
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
    if (!response.ok) return null;
    return (await response.json()) as ReadinessResponse;
  } catch {
    return null;
  }
}

const services = [
  { name: 'API', key: 'api', icon: ServerCog },
  { name: 'Database', key: 'database', icon: Database },
  { name: 'Job queue', key: 'redis', icon: Activity },
] as const;

export default async function SystemPage() {
  const readiness = await getReadiness();
  const systemReady = readiness?.status === 'ready';

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="System health"
        description="Live status for the core NEXORA services."
        actions={
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              systemReady
                ? 'border-[#cce3d5] bg-[#eaf4ee] text-[#287a55]'
                : 'border-[#eadbb9] bg-[#f8f0df] text-[#986817]'
            }`}
          >
            <span
              className={`size-2 rounded-full ${systemReady ? 'status-pulse bg-[#287a55]' : 'bg-[#986817]'}`}
              aria-hidden="true"
            />
            {systemReady ? 'All systems operational' : 'Service check needed'}
          </span>
        }
      />

      <section className="nx-panel mt-6 overflow-hidden">
        <div className="border-b border-[#e4e1d9] px-5 py-4">
          <h2 className="text-[13px] font-semibold text-[#3b3933]">Core services</h2>
        </div>
        <div className="divide-y divide-[#ece9e2]">
          {services.map((service) => {
            const Icon = service.icon;
            const healthy =
              service.key === 'api'
                ? Boolean(readiness)
                : readiness?.dependencies[service.key] === 'healthy';
            return (
              <article key={service.key} className="flex items-center gap-4 px-5 py-4">
                <span className="grid size-9 place-items-center rounded-lg bg-[#f0eee8] text-[#747168]">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <h3 className="flex-1 text-[13px] font-medium text-[#3b3933]">{service.name}</h3>
                <span
                  className={`inline-flex items-center gap-2 text-xs font-medium ${healthy ? 'text-[#287a55]' : 'text-[#a5463c]'}`}
                >
                  <span
                    className={`size-1.5 rounded-full ${healthy ? 'bg-[#287a55]' : 'bg-[#a5463c]'}`}
                    aria-hidden="true"
                  />
                  {healthy ? 'Operational' : 'Unavailable'}
                </span>
              </article>
            );
          })}
        </div>
      </section>

      <p className="mt-4 text-center text-[11px] text-[#9d998f]">
        {readiness
          ? `Last check ${readiness.request_id.slice(0, 8)}`
          : 'The readiness endpoint could not be reached.'}
      </p>
    </div>
  );
}
