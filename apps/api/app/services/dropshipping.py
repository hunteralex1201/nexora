"""
NEXORA Intelligence — Bangladesh Dropshipping Financial & Opportunity Engine
Calculates Courier COD, RTO Risk, Ad CAC, Net Margin, ROI % & Opportunity Score
"""

from typing import Any

DEMO_OPPORTUNITY_DISCLAIMER = (
    "Synthetic opportunity example for interface and calculator demonstration only. "
    "Demand, competition, prices, and availability were not measured from live sources."
)


def calculate_dropshipping_opportunity(
    selling_price_bdt: float,
    sourcing_cost_bdt: float,
    ad_cac_bdt: float = 350.0,
    courier_fee_bdt: float = 80.0,
    rto_rate_pct: float = 12.0,  # 12% Return-to-origin rate average in BD e-commerce
    payment_fee_pct: float = 1.5,
    monthly_search_demand: int = 4500,
    competitor_count: int = 15,
) -> dict[str, Any]:
    """Calculate full financial metrics & opportunity score for BD dropshipping products."""
    rto_cost_per_order = (rto_rate_pct / 100.0) * (courier_fee_bdt * 1.5)
    payment_gateway_fee = (payment_fee_pct / 100.0) * selling_price_bdt

    total_cost_per_order = (
        sourcing_cost_bdt + ad_cac_bdt + courier_fee_bdt + rto_cost_per_order + payment_gateway_fee
    )

    net_profit_bdt = selling_price_bdt - total_cost_per_order
    net_margin_pct = (net_profit_bdt / selling_price_bdt) * 100.0 if selling_price_bdt > 0 else 0.0
    roi_pct = (net_profit_bdt / total_cost_per_order) * 100.0 if total_cost_per_order > 0 else 0.0

    # Calculate Opportunity Score (0 - 100)
    # Higher margin %, strong demand, low competition, manageable RTO = top score
    margin_subscore = min(40.0, max(0.0, net_margin_pct * 0.8))
    demand_subscore = min(30.0, (monthly_search_demand / 10000.0) * 30.0)
    competition_penalty = min(20.0, (competitor_count / 50.0) * 20.0)
    rto_penalty = min(10.0, (rto_rate_pct / 20.0) * 10.0)

    opportunity_score = min(
        100.0,
        max(
            5.0,
            round(margin_subscore + demand_subscore - competition_penalty - rto_penalty + 20.0, 1),
        ),
    )

    return {
        "selling_price_bdt": round(selling_price_bdt, 2),
        "sourcing_cost_bdt": round(sourcing_cost_bdt, 2),
        "ad_cac_bdt": round(ad_cac_bdt, 2),
        "courier_fee_bdt": round(courier_fee_bdt, 2),
        "rto_risk_cost_bdt": round(rto_cost_per_order, 2),
        "payment_fee_bdt": round(payment_gateway_fee, 2),
        "total_cost_per_order_bdt": round(total_cost_per_order, 2),
        "net_profit_bdt": round(net_profit_bdt, 2),
        "net_margin_pct": round(net_margin_pct, 1),
        "roi_pct": round(roi_pct, 1),
        "opportunity_score": opportunity_score,
        "trust_classification": "DERIVED",
    }


def list_top_bd_dropshipping_opportunities() -> list[dict[str, Any]]:
    """Return non-actionable opportunity examples with explicit synthetic provenance."""
    return [
        {
            "id": "opp-bd-01",
            "product_name": "Magnetic Wireless MagSafe Power Bank 10,000mAh",
            "category": "Gadgets & Accessories",
            "selling_price_bdt": 2450.0,
            "sourcing_cost_bdt": 620.0,
            "metrics": calculate_dropshipping_opportunity(
                selling_price_bdt=2450.0, sourcing_cost_bdt=620.0, ad_cac_bdt=320.0
            ),
            "demand_trend": "Illustrative: high (+45% over 30 days)",
            "competition": "Illustrative: medium (12 sellers)",
            "trust_classification": "SYNTHETIC_SAMPLE",
            "demo_data": True,
            "disclaimer": DEMO_OPPORTUNITY_DISCLAIMER,
        },
        {
            "id": "opp-bd-02",
            "product_name": "TWS Noise Cancelling Waterproof Earbuds",
            "category": "Audio",
            "selling_price_bdt": 1850.0,
            "sourcing_cost_bdt": 510.0,
            "metrics": calculate_dropshipping_opportunity(
                selling_price_bdt=1850.0, sourcing_cost_bdt=510.0, ad_cac_bdt=280.0
            ),
            "demand_trend": "Illustrative: high (+60% over 30 days)",
            "competition": "Illustrative: high (28 sellers)",
            "trust_classification": "SYNTHETIC_SAMPLE",
            "demo_data": True,
            "disclaimer": DEMO_OPPORTUNITY_DISCLAIMER,
        },
        {
            "id": "opp-bd-03",
            "product_name": "RGB Desktop Ambience Atmosphere Light Bar",
            "category": "Home Tech",
            "selling_price_bdt": 1490.0,
            "sourcing_cost_bdt": 380.0,
            "metrics": calculate_dropshipping_opportunity(
                selling_price_bdt=1490.0, sourcing_cost_bdt=380.0, ad_cac_bdt=250.0
            ),
            "demand_trend": "Illustrative: surging (+85% over 30 days)",
            "competition": "Illustrative: low (6 sellers)",
            "trust_classification": "SYNTHETIC_SAMPLE",
            "demo_data": True,
            "disclaimer": DEMO_OPPORTUNITY_DISCLAIMER,
        },
    ]
