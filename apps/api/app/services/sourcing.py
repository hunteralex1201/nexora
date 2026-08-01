"""
NEXORA Intelligence — China Sourcing & Landed Cost Service
Calculates Freight, Duty/Tax, MOQ, Risk Score & Bangladesh Market Suitability
"""

from typing import Any

DEMO_SUPPLIER_DISCLAIMER = (
    "Synthetic supplier example for interface and calculator demonstration only. "
    "No marketplace lookup, factory verification, price check, or availability check was performed."
)


def calculate_landed_cost(
    unit_price_rmb: float = 0.0,
    unit_price_usd: float = 0.0,
    weight_kg: float = 0.5,
    quantity: int = 100,
    shipping_method: str = "air",  # "air" or "sea"
    customs_duty_rate: float = 0.35,  # 35% duty + VAT + AIT default for consumer electronics/goods
    rmb_to_bdt: float = 16.5,
    usd_to_bdt: float = 120.0,
) -> dict[str, Any]:
    """Calculate total landed cost per unit in BDT for Bangladesh imports."""
    if unit_price_rmb > 0:
        product_cost_bdt = unit_price_rmb * rmb_to_bdt
    else:
        product_cost_bdt = unit_price_usd * usd_to_bdt

    # Freight cost per kg
    freight_rate_per_kg = 850.0 if shipping_method.lower() == "air" else 280.0
    freight_cost_bdt = weight_kg * freight_rate_per_kg

    # Customs Duty & Assessment Tax
    assessable_value = product_cost_bdt + freight_cost_bdt
    duty_bdt = assessable_value * customs_duty_rate

    # Local port clearance & handling fee estimate per unit
    local_handling_bdt = 35.0

    landed_cost_per_unit = product_cost_bdt + freight_cost_bdt + duty_bdt + local_handling_bdt
    total_batch_cost_bdt = landed_cost_per_unit * quantity

    # Calculate Bangladesh Market Suitability Score (0 - 100)
    # Higher margin potential, manageable MOQ, low weight per value = higher score
    moq_penalty = max(0, (quantity - 50) * 0.1) if quantity > 500 else 0
    weight_penalty = (weight_kg / max(product_cost_bdt, 1.0)) * 500
    suitability_score = min(100.0, max(10.0, round(95.0 - moq_penalty - weight_penalty, 1)))

    return {
        "unit_product_cost_bdt": round(product_cost_bdt, 2),
        "unit_freight_cost_bdt": round(freight_cost_bdt, 2),
        "unit_customs_duty_bdt": round(duty_bdt, 2),
        "unit_local_handling_bdt": round(local_handling_bdt, 2),
        "landed_cost_per_unit_bdt": round(landed_cost_per_unit, 2),
        "total_batch_cost_bdt": round(total_batch_cost_bdt, 2),
        "quantity": quantity,
        "shipping_method": shipping_method,
        "suitability_score": suitability_score,
        "trust_classification": "DERIVED",
    }


def get_supplier_comparison_matrix() -> list[dict[str, Any]]:
    """Return non-actionable supplier examples with explicit synthetic provenance."""
    return [
        {
            "id": "sup-1688-01",
            "platform": "1688",
            "supplier_name": "Example Shenzhen Electronics Supplier",
            "product_title": "MagSafe Wireless Magnetic Power Bank 10000mAh",
            "moq": 50,
            "unit_price_rmb": 28.50,
            "unit_price_usd": 4.00,
            "weight_kg": 0.22,
            "estimated_lead_days": 12,
            "factory_verified": False,
            "verification_status": "DEMO_UNVERIFIED",
            "trust_classification": "SYNTHETIC_SAMPLE",
            "demo_data": True,
            "disclaimer": DEMO_SUPPLIER_DISCLAIMER,
            "risk_score": 0.10,
            "landed_cost_bdt": calculate_landed_cost(
                unit_price_rmb=28.50, weight_kg=0.22, quantity=50
            )["landed_cost_per_unit_bdt"],
            "bangladesh_suitability": 94.0,
        },
        {
            "id": "sup-ali-02",
            "platform": "Alibaba",
            "supplier_name": "Example Guangzhou Electronics Supplier",
            "product_title": "TWS Noise Cancelling Bluetooth Earbuds ANC",
            "moq": 100,
            "unit_price_rmb": 35.00,
            "unit_price_usd": 4.90,
            "weight_kg": 0.15,
            "estimated_lead_days": 15,
            "factory_verified": False,
            "verification_status": "DEMO_UNVERIFIED",
            "trust_classification": "SYNTHETIC_SAMPLE",
            "demo_data": True,
            "disclaimer": DEMO_SUPPLIER_DISCLAIMER,
            "risk_score": 0.12,
            "landed_cost_bdt": calculate_landed_cost(
                unit_price_rmb=35.00, weight_kg=0.15, quantity=100
            )["landed_cost_per_unit_bdt"],
            "bangladesh_suitability": 91.5,
        },
        {
            "id": "sup-cj-03",
            "platform": "CJ Dropshipping",
            "supplier_name": "Example Yiwu Fulfilment Supplier",
            "product_title": "RGB Desk Ambient LED Light Bar",
            "moq": 10,
            "unit_price_rmb": 18.00,
            "unit_price_usd": 2.50,
            "weight_kg": 0.30,
            "estimated_lead_days": 10,
            "factory_verified": False,
            "verification_status": "DEMO_UNVERIFIED",
            "trust_classification": "SYNTHETIC_SAMPLE",
            "demo_data": True,
            "disclaimer": DEMO_SUPPLIER_DISCLAIMER,
            "risk_score": 0.22,
            "landed_cost_bdt": calculate_landed_cost(
                unit_price_rmb=18.00, weight_kg=0.30, quantity=10
            )["landed_cost_per_unit_bdt"],
            "bangladesh_suitability": 88.0,
        },
    ]
