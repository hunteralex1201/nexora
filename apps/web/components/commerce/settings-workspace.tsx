'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  Boxes,
  CheckCircle2,
  Command,
  Database,
  KeyRound,
  LockKeyhole,
  MonitorCog,
  RefreshCcw,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { PageHeader } from '@/components/page-header';
import { commerceRequest, type AIReadiness } from '@/lib/commerce-client';

const policies = [
  {
    title: 'Open workspace access',
    eyebrow: 'Access mode',
    description: 'The browser workspace does not require interactive login. Internal API access remains mediated by the server-side workspace boundary.',
    icon: LockKeyhole,
    tone: 'var(--blue)',
    status: 'Enabled',
    href: '/system',
    link: 'Inspect system boundary',
  },
  {
    title: 'Persisted commerce evidence',
    eyebrow: 'Data plane',
    description: 'Sources, products, observations, jobs, alerts, and AI insights are stored in the deployment database; Redis coordinates queued work.',
    icon: Database,
    tone: 'var(--emerald)',
    status: 'Configured',
    href: '/sources',
    link: 'Manage data sources',
  },
  {
    title: 'Supported automation only',
    eyebrow: 'Execution policy',
    description: 'The workspace exposes product collection and local AI analysis through manual controls and authenticated n8n endpoints.',
    icon: Workflow,
    tone: 'var(--amber)',
    status: '2 recipes',
    href: '/workflows',
    link: 'Review workflows',
  },
] as const;

export function SettingsWorkspace() {
  const [resetComplete, setResetComplete] = useState(false);
  const readiness = useQuery({
    queryKey: ['commerce', 'ai-readiness', 'settings'],
    queryFn: () => commerceRequest<AIReadiness>('ai/readiness'),
    retry: false,
  });

  function resetInterface() {
    window.localStorage.removeItem('nexora-sidebar-collapsed');
    window.localStorage.removeItem('nexora-last-product-search');
    setResetComplete(true);
  }

  const aiReady = readiness.data?.status === 'ready';

  return (
    <div>
      <PageHeader
        eyebrow="Deployment profile"
        title="Settings"
        description="Review the policies this deployment actually supports and manage local interface preferences without exposing secrets or fictional toggles."
      />

      <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="grid gap-4">
          {policies.map((policy) => {
            const Icon = policy.icon;
            return (
              <article key={policy.title} className="nx-panel overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
                  <div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/[0.09] bg-white/[0.025]" style={{ color: policy.tone }}><Icon className="size-[18px]" aria-hidden="true" /></span><div><p className="nx-kicker">{policy.eyebrow}</p><h2 className="mt-1.5 text-[13px] font-semibold text-[var(--text)]">{policy.title}</h2><p className="mt-1 max-w-2xl text-[9px] leading-4 text-[var(--muted)]">{policy.description}</p></div></div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.025] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.09em] text-[var(--muted)]"><CheckCircle2 className="size-3 text-[var(--emerald)]" aria-hidden="true" />{policy.status}</span>
                </div>
                <Link href={policy.href} className="flex items-center justify-between border-t border-white/[0.07] px-4 py-3 text-[9px] font-semibold text-[var(--blue-strong)] hover:bg-white/[0.025] hover:text-white sm:px-5">{policy.link}<span aria-hidden="true">→</span></Link>
              </article>
            );
          })}
        </div>

        <div className="grid content-start gap-4">
          <article className="nx-panel overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] p-4 sm:px-5"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl border border-[var(--violet)]/18 bg-[var(--violet)]/[0.06] text-[var(--violet)]"><Bot className="size-[18px]" aria-hidden="true" /></span><div><p className="nx-kicker">Private intelligence</p><h2 className="mt-1.5 text-[13px] font-semibold text-[var(--text)]">Local AI runtime</h2></div></div><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.09em] ${aiReady ? 'border-[var(--emerald)]/20 bg-[var(--emerald)]/[0.065] text-[#8ce9c3]' : 'border-[var(--amber)]/20 bg-[var(--amber)]/[0.065] text-[#f7c889]'}`}><span className={`size-1.5 rounded-full ${aiReady ? 'bg-[var(--emerald)]' : 'bg-[var(--amber)]'}`} />{readiness.isLoading ? 'Checking' : aiReady ? 'Ready' : 'Needs attention'}</span></div>
            <dl className="grid grid-cols-2 gap-px bg-white/[0.06]"><div className="min-w-0 bg-[var(--surface-1)] p-3.5"><dt className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]">Chat model</dt><dd className="mt-1.5 truncate text-[10px] font-semibold text-[var(--text)]">{readiness.data?.expected_chat_model ?? 'Unavailable'}</dd></div><div className="min-w-0 bg-[var(--surface-1)] p-3.5"><dt className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]">Data path</dt><dd className="mt-1.5 truncate text-[10px] font-semibold text-[var(--text)]">Local Ollama</dd></div></dl>
            <div className="p-4 sm:px-5"><p className="text-[9px] leading-4 text-[var(--muted)]">Chat and saved analysis use the configured local runtime. Model readiness is verified live; no remote provider status is invented.</p><Link href="/integrations" className="mt-3 inline-flex items-center gap-1.5 text-[9px] font-semibold text-[var(--blue-strong)] hover:text-white"><Sparkles className="size-3" aria-hidden="true" />Inspect AI integration</Link></div>
          </article>

          <article className="nx-panel overflow-hidden">
            <div className="border-b border-white/[0.07] px-4 py-3.5 sm:px-5"><p className="nx-kicker">Local preferences</p><h2 className="mt-1.5 text-[12px] font-semibold text-[var(--text)]">Interface behavior</h2></div>
            <div className="divide-y divide-white/[0.065]">
              <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5"><MonitorCog className="size-4 text-[var(--blue)]" aria-hidden="true" /><div className="flex-1"><p className="text-[10px] font-semibold text-[var(--text)]">Theme</p><p className="mt-1 text-[8px] text-[var(--faint)]">Dark AI Commerce OS</p></div><span className="text-[9px] font-semibold text-[var(--muted)]">Fixed</span></div>
              <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5"><Command className="size-4 text-[var(--violet)]" aria-hidden="true" /><div className="flex-1"><p className="text-[10px] font-semibold text-[var(--text)]">Command palette</p><p className="mt-1 text-[8px] text-[var(--faint)]">Global navigation and product search</p></div><kbd className="rounded border border-white/[0.1] bg-white/[0.025] px-2 py-1 text-[8px] text-[var(--muted)]">Ctrl/⌘ K</kbd></div>
            </div>
            <div className="border-t border-white/[0.07] p-4 sm:px-5"><button type="button" onClick={resetInterface} className="nx-button-secondary w-full"><RefreshCcw className="size-4" aria-hidden="true" /> Reset interface preferences</button>{resetComplete ? <p role="status" className="mt-2 text-center text-[8px] text-[#8ce9c3]">Preferences reset. Defaults apply on the next page load.</p> : null}</div>
          </article>
        </div>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Workspace access', value: 'No login', icon: ShieldCheck },
          { label: 'Internal API', value: 'Server mediated', icon: ServerCog },
          { label: 'Automation', value: 'Key protected', icon: KeyRound },
          { label: 'Execution', value: 'Persisted jobs', icon: Boxes },
        ].map((item) => { const Icon = item.icon; return <article key={item.label} className="nx-panel flex items-center gap-3 p-3.5"><Icon className="size-4 text-[var(--faint)]" aria-hidden="true" /><div><p className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]">{item.label}</p><p className="mt-1 text-[10px] font-semibold text-[var(--text)]">{item.value}</p></div></article>; })}
      </section>

      <div className="mt-4 rounded-xl border border-[var(--amber)]/16 bg-[var(--amber)]/[0.05] px-4 py-3 text-[9px] leading-4 text-[var(--muted)]"><ShieldCheck className="mr-2 inline size-3.5 text-[var(--amber)]" aria-hidden="true" /><strong className="text-[var(--text)]">Read-only by design:</strong> server configuration, credentials, and connector secrets are managed outside the browser. This screen exposes only safe policy state and local interface controls.</div>
    </div>
  );
}
