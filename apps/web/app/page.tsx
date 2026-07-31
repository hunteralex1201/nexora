import {
  ArrowRight,
  BarChart3,
  Bot,
  Database,
  Globe2,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';

import { Brand } from '@/components/brand';

const capabilities = [
  {
    icon: Database,
    title: 'Evidence-first data layer',
    description:
      'Source-aware records, provenance, validation, and immutable raw evidence are designed into the platform foundation.',
  },
  {
    icon: BarChart3,
    title: 'Commerce intelligence',
    description:
      'A modular path from products and prices to market, competitor, demand, and sentiment intelligence.',
  },
  {
    icon: Bot,
    title: 'Grounded AI assistance',
    description:
      'Future AI outputs must cite retrieved evidence, expose uncertainty, and decline unsupported conclusions.',
  },
  {
    icon: Workflow,
    title: 'Controlled automation',
    description:
      'Human approval gates, audit trails, and strict operational boundaries precede any external action.',
  },
];

const architecture = [
  'Public commerce sources',
  'Validated collection services',
  'PostgreSQL, object and vector storage',
  'Deterministic intelligence engines',
  'Evidence-grounded agents',
  'Premium decision workspace',
];

export default function Home() {
  return (
    <main id="main-content" className="min-h-screen overflow-hidden bg-[#070b14] text-white">
      <div className="surface-grid border-b border-white/8">
        <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <Brand />
          <nav aria-label="Primary" className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 sm:px-4"
            >
              Sign in
            </Link>
            <Link
              href="/overview"
              className="inline-flex items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/15 px-3 py-2 text-sm font-semibold text-violet-100 shadow-[0_0_30px_rgba(124,58,237,0.12)] hover:bg-violet-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 sm:px-4"
            >
              Open workspace
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </nav>
        </header>

        <section className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.12fr_0.88fr] lg:px-8 lg:pb-28 lg:pt-24">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Phase 0 engineering foundation
            </div>
            <h1 className="mt-7 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl lg:leading-[1.04]">
              The operating system for{' '}
              <span className="bg-gradient-to-r from-violet-300 via-blue-300 to-cyan-300 bg-clip-text text-transparent">
                commerce intelligence
              </span>
              .
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
              NEXORA is being built as a Bangladesh-first, globally extensible platform that turns
              defensible public evidence into research, signals, reports, alerts, and controlled
              workflows.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/overview"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(79,70,229,0.24)] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              >
                Explore foundation shell
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/system"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-5 py-3 text-sm font-semibold text-slate-200 hover:border-white/20 hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                Review system readiness
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-400" aria-hidden="true" />
                RBAC foundation
              </span>
              <span className="inline-flex items-center gap-2">
                <Globe2 className="size-4 text-cyan-400" aria-hidden="true" />
                Bangladesh-first
              </span>
              <span className="inline-flex items-center gap-2">
                <Database className="size-4 text-violet-400" aria-hidden="true" />
                Evidence provenance
              </span>
            </div>
          </div>

          <div className="relative min-h-[30rem] lg:min-h-0">
            <div className="absolute inset-0 rounded-full bg-violet-600/10 blur-3xl" />
            <div className="relative h-full rounded-[2rem] border border-white/10 bg-[#0a101c]/90 p-4 shadow-2xl backdrop-blur sm:p-6">
              <div className="flex items-center justify-between border-b border-white/8 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    System blueprint
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-200">Evidence to decision</p>
                </div>
                <span className="rounded-full border border-amber-400/20 bg-amber-400/[0.07] px-2.5 py-1 text-[11px] font-medium text-amber-200">
                  Foundation only
                </span>
              </div>
              <ol className="mt-5 space-y-3">
                {architecture.map((item, index) => (
                  <li
                    key={item}
                    className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-violet-400/20 bg-violet-500/10 text-xs font-bold text-violet-200">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="text-sm text-slate-300">{item}</span>
                    <ArrowRight className="ml-auto size-4 text-slate-700" aria-hidden="true" />
                  </li>
                ))}
              </ol>
              <p className="mt-5 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.045] p-3.5 text-xs leading-5 text-cyan-100/75">
                No live marketplace data is shown. Operational metrics remain unavailable until
                validated collection phases are implemented.
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
            Deliberate by design
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Strong foundations before automation at scale.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-400">
            The first implementation phase establishes repeatable environments, authentication,
            observability, migrations, tests, and a responsive workspace. Data collection begins
            only after this foundation is validated.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map((capability) => {
            const Icon = capability.icon;
            return (
              <article
                key={capability.title}
                className="rounded-2xl border border-white/8 bg-white/[0.025] p-5 hover:border-violet-400/20 hover:bg-white/[0.035]"
              >
                <span className="grid size-10 place-items-center rounded-xl border border-violet-400/20 bg-violet-500/10 text-violet-300">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-base font-semibold text-white">{capability.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{capability.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-white/8 px-4 py-8 text-center text-sm text-slate-600 sm:px-6">
        NEXORA Intelligence — collect, understand, predict, automate, scale.
      </footer>
    </main>
  );
}
