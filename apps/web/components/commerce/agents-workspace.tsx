'use client';

import { useQuery } from '@tanstack/react-query';
import { History, Play, Send, ShieldCheck, Zap } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/page-header';
import { ErrorState, LoadingState, StatusBadge } from '@/components/commerce/primitives';
import { commerceRequest } from '@/lib/commerce-client';

interface Agent {
  id: string;
  name: string;
  category: string;
  status: string;
  schedule: string;
  last_run_at: string | null;
  evidence_verified: boolean;
  confidence_score: number | null;
  memory_items: number;
  runtime_connected: boolean;
  demo_data: boolean;
}

interface MemoryLog {
  id: string;
  agent: string;
  action: string;
  status: string;
  timestamp: string;
  trust: string;
}

interface TelegramReport {
  title: string;
  date: string;
  summary: {
    active_agents: number;
    active_sources: number;
    monitored_products: number;
    top_opportunity: string;
    china_sourcing_alert: string;
    b2b_lead_alert: string;
    seo_alert: string;
  };
  status: string;
  demo_data: boolean;
  disclaimer: string;
}

const categories = [
  'All',
  'Orchestration',
  'Discovery',
  'Pricing & Market',
  'Sourcing & Supply',
  'Leads & SEO',
  'Reporting & System',
] as const;

export function AgentsWorkspace() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const agents = useQuery({
    queryKey: ['commerce', 'agents', 'roster'],
    queryFn: () => commerceRequest<Agent[]>('agents/roster'),
  });

  const memory = useQuery({
    queryKey: ['commerce', 'agents', 'memory-logs'],
    queryFn: () => commerceRequest<MemoryLog[]>('agents/memory-logs'),
  });

  const telegram = useQuery({
    queryKey: ['commerce', 'agents', 'telegram-report'],
    queryFn: () => commerceRequest<TelegramReport>('agents/telegram-report'),
  });

  const allAgents = agents.data ?? [];
  const connectedAgentCount = allAgents.filter((agent) => agent.runtime_connected).length;
  const filteredAgents = allAgents.filter(
    (agent) =>
      selectedCategory === 'All' || agent.category.toLowerCase() === selectedCategory.toLowerCase(),
  );

  if (agents.isLoading || memory.isLoading)
    return <LoadingState label="Loading agent role catalog" />;
  if (agents.error) return <ErrorState message={agents.error.message} />;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Agent Role Catalog"
        description="Configuration preview for 25 planned roles. Production work runs only through governed AI jobs and approved workflows."
        actions={
          <button
            type="button"
            disabled
            className="nx-button flex items-center gap-2 opacity-60"
            title="No agent runtime is connected"
          >
            <Zap className="size-4" /> Runtime not connected
          </button>
        }
      />

      {/* Measured runtime status */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#d8cdaa] bg-[#fbf7ea] p-4">
        <div className="flex items-center gap-3">
          <span className="size-3 rounded-full bg-[#b08a2f]" />
          <div>
            <h2 className="text-sm font-bold text-[#5f5438]">Configuration-only catalog</h2>
            <p className="text-xs text-[#6e6248]">
              No background agent daemon, auto-healing loop, or external report dispatch is active.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold text-[#5f5438]">
          <span className="rounded bg-white/75 px-2.5 py-1">{allAgents.length} planned roles</span>
          <span className="rounded bg-white/75 px-2.5 py-1">
            {connectedAgentCount} connected runtimes
          </span>
        </div>
      </section>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-1.5 border-b border-[#e4e1d9] pb-3">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              selectedCategory === cat
                ? 'bg-[#3b3933] text-white'
                : 'bg-[#eeece6] text-[#6b675e] hover:bg-[#e4e1d9]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 25 Agent Cards Grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredAgents.map((ag) => (
          <article
            key={ag.id}
            className="rounded-xl border border-[#e8e6df] bg-[#f8f7f4] p-4 flex flex-col justify-between space-y-3"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#858178] uppercase">
                  {ag.category}
                </span>
                <StatusBadge status={ag.runtime_connected ? 'active' : 'configuration-only'} />
              </div>
              <h3 className="mt-1 text-sm font-bold text-[#3b3933]">{ag.name}</h3>
              <p className="text-xs text-[#8f8b81] mt-0.5">Planned cadence: {ag.schedule}</p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-white/60 p-2.5 rounded-lg border border-[#ece9e2]">
                <div>
                  <span className="block text-[10px] text-[#858178]">Runtime memory</span>
                  <strong className="text-[#3b3933]">
                    {ag.runtime_connected ? ag.memory_items : 'Not connected'}
                  </strong>
                </div>
                <div>
                  <span className="block text-[10px] text-[#858178]">Measured confidence</span>
                  <strong className="text-[#3b3933]">
                    {ag.confidence_score === null
                      ? 'Not measured'
                      : `${(ag.confidence_score * 100).toFixed(0)}%`}
                  </strong>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#e8e6df] flex items-center justify-between">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[#8a7040]">
                <ShieldCheck className="size-3" /> No evidence produced
              </span>
              <button
                type="button"
                disabled
                className="nx-button-secondary !min-h-7 !px-2.5 !text-xs flex items-center gap-1 opacity-60"
                title="No runtime is connected for this catalog entry"
              >
                <Play className="size-3" /> Not connected
              </button>
            </div>
          </article>
        ))}
      </section>

      {/* Telegram Executive Briefing Card */}
      {telegram.data ? (
        <section className="nx-panel p-5 sm:p-6 bg-[#f3f7f4] border-[#d2e5d8]">
          <div className="flex items-center gap-2 border-b border-[#c2dcd2] pb-3">
            <Send className="size-4 text-[#287a55]" />
            <h2 className="text-sm font-semibold text-[#287a55]">
              Executive Report Layout Preview
            </h2>
          </div>
          <div className="mt-3 space-y-1.5 text-xs text-[#2b543e]">
            <h3 className="font-bold text-sm text-[#1e4030]">{telegram.data.title}</h3>
            <p>
              <strong>Connected runtimes:</strong> {telegram.data.summary.active_agents}
            </p>
            <p>
              <strong>Top Opportunity:</strong> {telegram.data.summary.top_opportunity}
            </p>
            <p>
              <strong>Sourcing Alert:</strong> {telegram.data.summary.china_sourcing_alert}
            </p>
            <p>
              <strong>Lead Alert:</strong> {telegram.data.summary.b2b_lead_alert}
            </p>
          </div>
        </section>
      ) : null}

      {/* Real-time Agent Reasoning Memory Log */}
      <section className="nx-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#e4e1d9] px-5 py-4">
          <div className="flex items-center gap-2">
            <History className="size-4 text-[#8f8b81]" />
            <h2 className="text-[13px] font-semibold text-[#3b3933]">
              Measured Agent Execution Log
            </h2>
          </div>
          <span className="text-xs text-[#8f8b81]">{memory.data?.length ?? 0} Logs</span>
        </div>

        <div className="divide-y divide-[#ece9e2]">
          {memory.data?.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[#8f8b81]">
              No agent runtime executions have been recorded.
            </p>
          ) : null}
          {memory.data?.map((mem) => (
            <article key={mem.id} className="px-5 py-3 flex items-center justify-between text-xs">
              <div>
                <strong className="text-[#3b3933]">{mem.agent}: </strong>
                <span className="text-[#4b4943]">{mem.action}</span>
              </div>
              <div className="flex items-center gap-3 text-[#8f8b81]">
                <span className="rounded bg-[#eaf4ee] px-2 py-0.5 font-semibold text-[#287a55]">
                  {mem.trust}
                </span>
                <span>
                  {new Date(mem.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
