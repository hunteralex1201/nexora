'use client';

import { useQuery } from '@tanstack/react-query';
import { BadgeInfo, Calculator, Globe } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/page-header';
import { ErrorState, LoadingState, StatusBadge } from '@/components/commerce/primitives';
import { commerceRequest } from '@/lib/commerce-client';

interface SupplierOffer {
  id: string;
  platform: string;
  supplier_name: string;
  product_title: string;
  moq: number;
  unit_price_rmb: number;
  unit_price_usd: number;
  weight_kg: number;
  estimated_lead_days: number;
  factory_verified: boolean;
  verification_status: string;
  trust_classification: string;
  demo_data: boolean;
  disclaimer: string;
  risk_score: number;
  landed_cost_bdt: number;
  bangladesh_suitability: number;
}

export function SourcingWorkspace() {
  const [sellingPrice, setSellingPrice] = useState('2450');
  const [sourcingCost, setSourcingCost] = useState('620');
  const [adCac, setAdCac] = useState('320');
  const [courierFee, setCourierFee] = useState('80');

  const suppliers = useQuery({
    queryKey: ['commerce', 'sourcing', 'suppliers'],
    queryFn: () => commerceRequest<SupplierOffer[]>('sourcing/suppliers'),
  });

  const priceNum = parseFloat(sellingPrice) || 0;
  const costNum = parseFloat(sourcingCost) || 0;
  const cacNum = parseFloat(adCac) || 0;
  const courierNum = parseFloat(courierFee) || 0;

  const totalCost = costNum + cacNum + courierNum + priceNum * 0.015 + courierNum * 0.18;
  const netProfit = Math.max(0, priceNum - totalCost);
  const marginPct = priceNum > 0 ? ((netProfit / priceNum) * 100).toFixed(1) : '0';
  const roiPct = totalCost > 0 ? ((netProfit / totalCost) * 100).toFixed(1) : '0';

  if (suppliers.isLoading) return <LoadingState label="Loading sourcing matrix" />;
  if (suppliers.error) return <ErrorState message={suppliers.error.message} />;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="China Sourcing & BD Dropshipping"
        description="Estimate Bangladesh landed cost and review clearly labeled supplier-interface examples."
      />

      <section className="flex gap-3 rounded-xl border border-[#d8cdaa] bg-[#fbf7ea] p-4 text-[#5f5438]">
        <BadgeInfo className="mt-0.5 size-4 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold">Supplier rows are demonstrations</h2>
          <p className="mt-0.5 text-xs leading-5">
            The calculator is deterministic. Supplier names, prices, availability, verification, and
            suitability rows below are synthetic fixtures, not live marketplace evidence.
          </p>
        </div>
      </section>

      {/* Financial ROI Calculator Panel */}
      <section className="nx-panel p-5 sm:p-6">
        <div className="flex items-center gap-2 border-b border-[#e4e1d9] pb-4">
          <Calculator className="size-5 text-[#9d4b32]" />
          <h2 className="text-sm font-semibold text-[#3b3933]">
            Bangladesh Dropshipping Calculator
          </h2>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <label className="nx-label">
            Selling Price (BDT)
            <input
              type="number"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              className="nx-input"
            />
          </label>
          <label className="nx-label">
            Sourcing / Landed Cost (BDT)
            <input
              type="number"
              value={sourcingCost}
              onChange={(e) => setSourcingCost(e.target.value)}
              className="nx-input"
            />
          </label>
          <label className="nx-label">
            Ad CAC (BDT)
            <input
              type="number"
              value={adCac}
              onChange={(e) => setAdCac(e.target.value)}
              className="nx-input"
            />
          </label>
          <label className="nx-label">
            Courier Fee (Steadfast/Pathao BDT)
            <input
              type="number"
              value={courierFee}
              onChange={(e) => setCourierFee(e.target.value)}
              className="nx-input"
            />
          </label>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-4 bg-[#f8f7f4] p-4 rounded-xl border border-[#e8e6df]">
          <div>
            <span className="text-xs text-[#858178]">Total Order Cost</span>
            <p className="text-lg font-bold text-[#3b3933]">৳{totalCost.toFixed(0)}</p>
          </div>
          <div>
            <span className="text-xs text-[#858178]">Net Profit / Order</span>
            <p className="text-lg font-bold text-[#287a55]">৳{netProfit.toFixed(0)}</p>
          </div>
          <div>
            <span className="text-xs text-[#858178]">Net Margin</span>
            <p className="text-lg font-bold text-[#287a55]">{marginPct}%</p>
          </div>
          <div>
            <span className="text-xs text-[#858178]">Return on Ad/Inventory (ROI)</span>
            <p className="text-lg font-bold text-[#9d4b32]">{roiPct}%</p>
          </div>
        </div>
      </section>

      {/* Supplier Matrix */}
      <section className="nx-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#e4e1d9] px-5 py-4">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-[#8f8b81]" />
            <h2 className="text-[13px] font-semibold text-[#3b3933]">
              Demonstration Supplier Matrix (1688 / Alibaba / CJ Layout)
            </h2>
          </div>
          <span className="rounded bg-[#f5ecce] px-2.5 py-1 text-xs font-semibold text-[#6e5b27]">
            Demo data
          </span>
        </div>

        <div className="divide-y divide-[#ece9e2]">
          {suppliers.data?.map((sup) => (
            <article
              key={sup.id}
              className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-[#f0eee8] px-2 py-0.5 text-xs font-semibold text-[#4b4943]">
                    {sup.platform}
                  </span>
                  <h3 className="text-[13px] font-semibold text-[#3b3933]">{sup.product_title}</h3>
                  <StatusBadge
                    status={sup.demo_data ? 'demo-unverified' : sup.verification_status}
                  />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8f8b81]">
                  <span>
                    Supplier: <strong>{sup.supplier_name}</strong>
                  </span>
                  <span>
                    MOQ: <strong>{sup.moq} pcs</strong>
                  </span>
                  <span>
                    RMB Unit: <strong>¥{sup.unit_price_rmb.toFixed(2)}</strong>
                  </span>
                  <span>
                    Lead Time: <strong>{sup.estimated_lead_days} days</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-right">
                <div>
                  <span className="text-xs text-[#858178]">Illustrative Landed Cost</span>
                  <p className="text-sm font-bold text-[#3b3933]">
                    ৳{sup.landed_cost_bdt.toFixed(0)}
                  </p>
                </div>
                <div className="rounded-lg bg-[#eaf4ee] px-3 py-1.5 text-center">
                  <span className="block text-[10px] text-[#287a55] font-semibold uppercase">
                    Demo Score
                  </span>
                  <span className="text-sm font-bold text-[#287a55]">
                    {sup.bangladesh_suitability}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
