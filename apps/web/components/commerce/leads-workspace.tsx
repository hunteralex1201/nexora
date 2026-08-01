'use client';

import { useQuery } from '@tanstack/react-query';
import { BadgeInfo, Building2, Code2, Globe, Mail, Phone, SearchCheck } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/page-header';
import { ErrorState, LoadingState, StatusBadge } from '@/components/commerce/primitives';
import { commerceRequest } from '@/lib/commerce-client';

interface Lead {
  id: string;
  company: string;
  website: string;
  public_email: string | null;
  public_phone: string | null;
  industry: string;
  tech_stack: string[];
  lead_score: number;
  verification_status: string;
  trust_classification: string;
  demo_data: boolean;
  disclaimer: string;
}

interface SeoAudit {
  domain: string;
  overall_seo_score: number;
  technical: {
    https_enabled: boolean | null;
    mobile_friendly: boolean | null;
    page_speed_index: number;
  };
  keyword_gaps: Array<{ keyword: string; search_volume: number; difficulty: number }>;
  analysis_mode: string;
  trust_classification: string;
  demo_data: boolean;
  disclaimer: string;
}

export function LeadsWorkspace() {
  const [domainInput, setDomainInput] = useState('https://store.example.com');

  const leads = useQuery({
    queryKey: ['commerce', 'seo-leads', 'leads'],
    queryFn: () => commerceRequest<Lead[]>('seo-leads/leads'),
  });

  const seo = useQuery({
    queryKey: ['commerce', 'seo-leads', 'seo', domainInput],
    queryFn: () =>
      commerceRequest<SeoAudit>(`seo-leads/seo/audit?domain=${encodeURIComponent(domainInput)}`),
  });

  if (leads.isLoading || seo.isLoading)
    return <LoadingState label="Loading leads & SEO intelligence" />;
  if (leads.error) return <ErrorState message={leads.error.message} />;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="B2B Leads & SEO Intelligence"
        description="Preview lead-scoring and SEO analysis layouts before source-attributed production connectors are enabled."
      />

      <section className="flex gap-3 rounded-xl border border-[#d8cdaa] bg-[#fbf7ea] p-4 text-[#5f5438]">
        <BadgeInfo className="mt-0.5 size-4 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold">Demonstration data</h2>
          <p className="mt-0.5 text-xs leading-5">
            Lead records and SEO metrics on this page are synthetic fixtures. No live discovery,
            contact verification, or outreach has run.
          </p>
        </div>
      </section>

      {/* SEO Audit Panel */}
      <section className="nx-panel p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e4e1d9] pb-4">
          <div className="flex items-center gap-2">
            <SearchCheck className="size-5 text-[#9d4b32]" />
            <h2 className="text-sm font-semibold text-[#3b3933]">
              SEO Scoring Preview (Synthetic Fixture)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              className="nx-input !py-1.5 !text-xs w-64"
              placeholder="https://store.example.com"
            />
          </div>
        </div>

        {seo.data ? (
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-[#e8e6df] bg-[#f8f7f4] p-4 text-center">
              <span className="text-xs text-[#858178]">Illustrative SEO Score</span>
              <p className="mt-1 text-3xl font-extrabold text-[#287a55]">
                {seo.data.overall_seo_score}/100
              </p>
            </div>
            <div className="rounded-xl border border-[#e8e6df] bg-[#f8f7f4] p-4 text-center">
              <span className="text-xs text-[#858178]">Illustrative PageSpeed Index</span>
              <p className="mt-1 text-3xl font-extrabold text-[#3b3933]">
                {seo.data.technical.page_speed_index}/100
              </p>
            </div>
            <div className="rounded-xl border border-[#e8e6df] bg-[#f8f7f4] p-4">
              <span className="text-xs text-[#858178]">Illustrative Keyword Gaps</span>
              <ul className="mt-2 space-y-1 text-xs text-[#4b4943]">
                {seo.data.keyword_gaps.map((kw, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="truncate">{kw.keyword}</span>
                    <strong className="text-[#9d4b32]">
                      {kw.search_volume.toLocaleString()} searches
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </section>

      {/* Leads Table */}
      <section className="nx-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#e4e1d9] px-5 py-4">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-[#8f8b81]" />
            <h2 className="text-[13px] font-semibold text-[#3b3933]">
              Demonstration B2B Lead Fixtures
            </h2>
          </div>
          <span className="text-xs text-[#8f8b81]">{leads.data?.length ?? 0} Leads</span>
        </div>

        <div className="divide-y divide-[#ece9e2]">
          {leads.data?.map((lead) => (
            <article
              key={lead.id}
              className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[13px] font-semibold text-[#3b3933]">{lead.company}</h3>
                  <StatusBadge
                    status={lead.demo_data ? 'demo-unverified' : lead.verification_status}
                  />
                  <span className="text-xs text-[#8f8b81]">({lead.industry})</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8f8b81]">
                  {lead.demo_data ? (
                    <span className="flex items-center gap-1">
                      <Globe className="size-3" /> {lead.website}
                    </span>
                  ) : (
                    <a
                      href={lead.website}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-[#9d4b32]"
                    >
                      <Globe className="size-3" /> {lead.website}
                    </a>
                  )}
                  <span className="flex items-center gap-1">
                    <Mail className="size-3" /> {lead.public_email ?? 'No verified email'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="size-3" /> {lead.public_phone ?? 'No verified phone'}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px]">
                  <Code2 className="size-3 text-[#8f8b81]" />
                  {lead.tech_stack.map((tech, idx) => (
                    <span key={idx} className="rounded bg-[#f0eee8] px-1.5 py-0.5 text-[#4b4943]">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-[#eaf4ee] px-4 py-2 text-center">
                <span className="block text-[10px] text-[#287a55] font-semibold uppercase">
                  Illustrative Score
                </span>
                <span className="text-lg font-bold text-[#287a55]">{lead.lead_score}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
