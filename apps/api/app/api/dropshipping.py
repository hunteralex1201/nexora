"""NEXORA dropshipping estimator and demonstration opportunity endpoints."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.dependencies import require_roles
from app.models.user import User
from app.services.dropshipping import (
    calculate_dropshipping_opportunity,
    list_top_bd_dropshipping_opportunities,
)

router = APIRouter(prefix="/dropshipping", tags=["dropshipping"])
AdminUser = Annotated[User, Depends(require_roles("admin"))]


class DropshippingCalculationRequest(BaseModel):
    selling_price_bdt: float = Field(gt=0.0)
    sourcing_cost_bdt: float = Field(gt=0.0)
    ad_cac_bdt: float = Field(default=350.0, ge=0.0)
    courier_fee_bdt: float = Field(default=80.0, ge=0.0)
    rto_rate_pct: float = Field(default=12.0, ge=0.0, le=100.0)
    payment_fee_pct: float = Field(default=1.5, ge=0.0, le=10.0)


@router.get("/opportunities")
async def get_opportunities(_: AdminUser) -> list[dict[str, Any]]:
    """List synthetic opportunity examples; no live market measurement occurs."""
    return list_top_bd_dropshipping_opportunities()


@router.post("/calculator")
async def compute_dropshipping_roi(
    payload: DropshippingCalculationRequest, _: AdminUser
) -> dict[str, Any]:
    """Compute deterministic ROI estimates from operator-supplied inputs."""
    return calculate_dropshipping_opportunity(
        selling_price_bdt=payload.selling_price_bdt,
        sourcing_cost_bdt=payload.sourcing_cost_bdt,
        ad_cac_bdt=payload.ad_cac_bdt,
        courier_fee_bdt=payload.courier_fee_bdt,
        rto_rate_pct=payload.rto_rate_pct,
        payment_fee_pct=payload.payment_fee_pct,
    )
