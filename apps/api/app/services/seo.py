"""NEXORA demonstration-only SEO audit fixture."""

from typing import Any

SEO_DEMO_DISCLAIMER = (
    "Synthetic SEO layout fixture. The domain was not fetched and no live technical, "
    "PageSpeed, schema, keyword-volume, or ranking measurement was performed."
)


def audit_store_seo(domain_url: str) -> dict[str, Any]:
    """Return a non-actionable SEO preview with explicit synthetic provenance."""
    return {
        "domain": domain_url,
        "overall_seo_score": 88.5,
        "technical": {
            "https_enabled": None,
            "mobile_friendly": None,
            "page_speed_index": 92.0,
            "robots_txt_present": None,
            "sitemap_xml_present": None,
        },
        "schema_org": {
            "product_schema_valid": None,
            "organization_schema_valid": None,
            "aggregate_rating_schema": None,
            "offers_schema_valid": None,
        },
        "keyword_gaps": [
            {
                "keyword": "example product category bangladesh",
                "search_volume": 12_000,
                "difficulty": 32,
            },
            {
                "keyword": "example ecommerce query bd",
                "search_volume": 45_000,
                "difficulty": 48,
            },
            {
                "keyword": "example import cost query bd",
                "search_volume": 8_500,
                "difficulty": 18,
            },
        ],
        "analysis_mode": "DEMO_FIXTURE",
        "trust_classification": "SYNTHETIC_SAMPLE",
        "demo_data": True,
        "disclaimer": SEO_DEMO_DISCLAIMER,
    }
