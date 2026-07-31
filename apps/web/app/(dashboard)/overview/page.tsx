import { ArrowRight, CheckCircle2, Database, FileSearch, Network, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader } from '@/components/page-header';
import { StatePanel } from '@/components/state-panel';

export const metadata: Metadata = {
  title: 'Overview',
};

const statusCards = [
  {
    label: 'Current phase',
    value: 'Engineering foundation',
    detail: 'Phase 0 implementation',
    tone: 'text-violet-300',
  },
  {
    label: 'Identity layer',
    value: 'JWT and RBAC',
    detail: 'Backend foundation available',
    tone: 'text-emerald-300',
  },
  {
    label: 'Collection sources',
    value: 'Not connected',
    detail: 'Begins after validation',
    tone: 'text-amber-300',
  },
  {
    label: 'Live evidence records',
    value: 'Unavailable',
    detail: 'No fabricated metrics',
    tone: 'text-cyan-300',
  },
] as const;

const flow = [
  {
    icon: FileSearch,
    title: 'Collect',
    description: 'Public, permitted evidence with source metadata.',
  },
  {
    icon: ShieldCheck,
    title: 'Validate',
    description: 'Schema, freshness, provenance, and quality checks.',
  },
  {
    icon: Database,
    title: 'Preserve',
    description: 'Structured records and immutable raw evidence.',
  },
  {
    icon: Network,
    title: 'Understand',
    description: 'Deterministic intelligence before AI synthesis.',
  },
] as const;

export default function OverviewPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Workspace overview"
        title="A trusted foundation for commerce intelligence."
        description="This workspace shows implemented platform foundations only. Live collection, market signals, and AI insights remain intentionally unavailable until their evidence pipelines pass later phase gates."
        actions={
          <Link
            href="/system"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-100 hover:bg-violet-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            System readiness
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        }
      />

      <section aria-labelledby="foundation-status" className="mt-7">
        <div className="flex items-center justify-between">
          <h2 id="foundation-status" className="text-sm font-semibold text-slate-200">
            Foundation snapshot
          </h2>
          <span className="rounded-full border border-white/8 bg-white/[0.025] px-2.5 py-1 text-[11px] text-slate-500">
            Repository state, not live telemetry
          </span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statusCards.map((card) => (
            <article
              key={card.label}
              className="rounded-2xl border border-white/8 bg-white/[0.025] p-5"
            >
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-600">
                {card.label}
              </p>
              <p className={`mt-4 text-xl font-semibold tracking-[-0.02em] ${card.tone}`}>
                {card.value}
              </p>
              <p className="mt-2 text-xs text-slate-600">{card.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <article className="rounded-2xl border border-white/8 bg-[#0a101c]/80 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
                Evidence pathway
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">
                Designed for traceable decisions
              </h2>
            </div>
            <CheckCircle2 className="size-5 text-emerald-400" aria-hidden="true" />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {flow.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className="relative rounded-xl border border-white/[0.07] bg-white/[0.022] p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-lg border border-violet-400/20 bg-violet-500/10 text-violet-300">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                        Step {index + 1}
                      </span>
                      <h3 className="text-sm font-semibold text-slate-200">{step.title}</h3>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">{step.description}</p>
                </div>
              );
            })}
          </div>
        </article>

        <StatePanel
          variant="partial"
          title="Partial system state"
          description="The application shell, API contract, database schema, authentication, and local service topology are being validated. Collection and intelligence modules are not active."
          action={
            <Link
              href="/settings"
              className="text-sm font-semibold text-amber-200 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              Review configuration boundaries
            </Link>
          }
        />
      </section>

      <section className="mt-8">
        <StatePanel
          variant="empty"
          title="No commerce evidence has been collected"
          description="This is the expected Phase 0 state. Marketplace connectors, crawl jobs, product records, and derived signals begin only after the engineering foundation is validated and checkpointed."
        />
      </section>
    </div>
  );
}
