"""NEXORA demonstration-only B2B lead fixtures.

These records exist solely to exercise the operator interface until a real,
source-attributed lead connector is configured. They must never be presented as
measured or verified production evidence.
"""

from typing import Any

DEMO_DISCLAIMER = (
    "Synthetic demonstration record. No external discovery or contact verification "
    "was performed; do not use for outreach."
)


def list_b2b_leads() -> list[dict[str, Any]]:
    """Return non-actionable demonstration leads with explicit provenance."""
    return [
        {
            "id": "demo-lead-01",
            "company": "Example Electronics Retailer",
            "website": "https://electronics-retailer.example",
            "public_email": "wholesale@electronics-retailer.example",
            "public_phone": None,
            "industry": "Consumer Electronics Retail",
            "tech_stack": ["Shopify", "Email automation", "Analytics", "Payments"],
            "lead_score": 92.5,
            "verification_status": "DEMO_UNVERIFIED",
            "trust_classification": "SYNTHETIC_SAMPLE",
            "demo_data": True,
            "disclaimer": DEMO_DISCLAIMER,
        },
        {
            "id": "demo-lead-02",
            "company": "Example Health and Beauty Store",
            "website": "https://health-beauty-store.example",
            "public_email": "b2b@health-beauty-store.example",
            "public_phone": None,
            "industry": "Health and Personal Care",
            "tech_stack": ["Web storefront", "API backend", "Analytics", "Payments"],
            "lead_score": 96.0,
            "verification_status": "DEMO_UNVERIFIED",
            "trust_classification": "SYNTHETIC_SAMPLE",
            "demo_data": True,
            "disclaimer": DEMO_DISCLAIMER,
        },
        {
            "id": "demo-lead-03",
            "company": "Example Books and Logistics Store",
            "website": "https://books-logistics.example",
            "public_email": "corporate@books-logistics.example",
            "public_phone": None,
            "industry": "Books and Publishing",
            "tech_stack": ["Custom storefront", "PostgreSQL", "Redis", "Courier integration"],
            "lead_score": 89.0,
            "verification_status": "DEMO_UNVERIFIED",
            "trust_classification": "SYNTHETIC_SAMPLE",
            "demo_data": True,
            "disclaimer": DEMO_DISCLAIMER,
        },
    ]
