"""NEXORA demonstration SEO and lead-preview API endpoints."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import require_roles
from app.models.user import User
from app.services.lead_gen import list_b2b_leads
from app.services.seo import audit_store_seo

router = APIRouter(prefix="/seo-leads", tags=["seo-leads"])
AdminUser = Annotated[User, Depends(require_roles("admin"))]


@router.get("/seo/audit")
async def get_seo_audit(
    _: AdminUser,
    domain: str = Query(default="https://store.example.com"),
) -> dict[str, Any]:
    """Return a synthetic SEO layout fixture; the domain is not fetched."""
    return audit_store_seo(domain)


@router.get("/leads")
async def get_b2b_leads(_: AdminUser) -> list[dict[str, Any]]:
    """List non-actionable synthetic lead fixtures with explicit provenance."""
    return list_b2b_leads()
