"""NEXORA sourcing estimator and demonstration supplier endpoints."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.dependencies import require_roles
from app.models.user import User
from app.services.sourcing import calculate_landed_cost, get_supplier_comparison_matrix

router = APIRouter(prefix="/sourcing", tags=["sourcing"])
AdminUser = Annotated[User, Depends(require_roles("admin"))]


class LandedCostRequest(BaseModel):
    unit_price_rmb: float = Field(default=0.0, ge=0.0)
    unit_price_usd: float = Field(default=0.0, ge=0.0)
    weight_kg: float = Field(default=0.5, gt=0.0)
    quantity: int = Field(default=100, ge=1)
    shipping_method: str = Field(default="air")
    customs_duty_rate: float = Field(default=0.35, ge=0.0, le=2.0)


@router.get("/suppliers")
async def list_supplier_offers(_: AdminUser) -> list[dict[str, Any]]:
    """List synthetic supplier examples; no live marketplace lookup occurs."""
    return get_supplier_comparison_matrix()


@router.post("/calculate-landed-cost")
async def compute_landed_cost(payload: LandedCostRequest, _: AdminUser) -> dict[str, Any]:
    """Compute deterministic landed-cost estimates from operator-supplied inputs."""
    return calculate_landed_cost(
        unit_price_rmb=payload.unit_price_rmb,
        unit_price_usd=payload.unit_price_usd,
        weight_kg=payload.weight_kg,
        quantity=payload.quantity,
        shipping_method=payload.shipping_method,
        customs_duty_rate=payload.customs_duty_rate,
    )
