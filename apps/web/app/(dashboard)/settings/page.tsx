import { BellRing, Bot, KeyRound, LockKeyhole, Save, Workflow } from 'lucide-react';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { StatePanel } from '@/components/state-panel';

export const metadata: Metadata = {
  title: 'Settings',
};

const integrations = [
  {
    name: 'AI providers',
    description: 'OpenAI-compatible and optional external providers',
    status: 'Not configured',
    icon: Bot,
  },
  {
    name: 'Automation',
    description: 'n8n workflows and approval-controlled actions',
    status: 'Disabled',
    icon: Workflow,
  },
  {
    name: 'Notifications',
    description: 'Email, Slack, Discord, or Telegram delivery',
    status: 'Not configured',
    icon: BellRing,
  },
] as const;

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Platform settings"
        title="Configuration with safe defaults."
        description="Phase 0 exposes boundaries and expected configuration surfaces without displaying secrets or enabling external actions. Runtime credentials remain in environment variables or a future secret manager."
      />

      <div className="mt-7 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-white/8 bg-[#0a101c]/80 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-violet-400/20 bg-violet-500/10 text-violet-300">
              <KeyRound className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-white">Security baseline</h2>
              <p className="mt-1 text-xs text-slate-600">
                Read-only summary of current foundation behavior
              </p>
            </div>
          </div>

          <dl className="mt-6 divide-y divide-white/[0.06] rounded-xl border border-white/[0.07] bg-white/[0.02] px-4">
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="text-sm text-slate-400">Session storage</dt>
              <dd className="text-right text-sm font-medium text-emerald-300">HTTP-only cookie</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="text-sm text-slate-400">API authentication</dt>
              <dd className="text-right text-sm font-medium text-slate-200">Short-lived JWT</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="text-sm text-slate-400">Authorization</dt>
              <dd className="text-right text-sm font-medium text-slate-200">Role-based access</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="text-sm text-slate-400">Production secrets</dt>
              <dd className="text-right text-sm font-medium text-amber-300">
                Required before deploy
              </dd>
            </div>
          </dl>

          <div className="mt-6 rounded-xl border border-white/[0.07] bg-slate-950/30 p-4">
            <label htmlFor="session-duration" className="text-sm font-medium text-slate-300">
              Access-token lifetime
            </label>
            <select
              id="session-duration"
              disabled
              defaultValue="30"
              className="mt-2 min-h-11 w-full cursor-not-allowed rounded-xl border border-white/8 bg-slate-950/60 px-3 text-sm text-slate-500 opacity-80"
            >
              <option value="30">30 minutes — configured by backend environment</option>
            </select>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              This control is disabled because browser settings must never override the server
              security policy.
            </p>
          </div>

          <button
            type="button"
            disabled
            className="mt-5 inline-flex min-h-11 cursor-not-allowed items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-600"
          >
            <Save className="size-4" aria-hidden="true" />
            No editable settings in Phase 0
          </button>
        </section>

        <section className="rounded-2xl border border-white/8 bg-[#0a101c]/80 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-300">
              <LockKeyhole className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-white">External integrations</h2>
              <p className="mt-1 text-xs text-slate-600">No live credential checks</p>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {integrations.map((integration) => {
              const Icon = integration.icon;
              return (
                <article
                  key={integration.name}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
                >
                  <Icon className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-slate-300">{integration.name}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      {integration.description}
                    </p>
                  </div>
                  <span className="ml-auto shrink-0 rounded-full border border-white/8 px-2.5 py-1 text-[10px] text-slate-500">
                    {integration.status}
                  </span>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <div className="mt-6">
        <StatePanel
          variant="restricted"
          title="Secrets are never rendered in the dashboard"
          description="Configure local values through the root .env file. Shared staging and production environments must use managed secrets, rotated credentials, least privilege, and explicit operator approval."
        />
      </div>
    </div>
  );
}
