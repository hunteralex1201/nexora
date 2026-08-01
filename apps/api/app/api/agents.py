"""NEXORA agent-role catalog API.

The catalog is configuration-only. Production execution remains under the
governed AI job gateway and approved workflow worker.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies import require_roles
from app.models.user import User
from app.services.agent_brain import global_agent_brain

router = APIRouter(prefix="/agents", tags=["agents"])
AdminUser = Annotated[User, Depends(require_roles("admin"))]


@router.get("/status")
@router.get("/roster")
async def list_agent_statuses(
    _: AdminUser,
    category: str | None = Query(default=None),
) -> list[dict[str, Any]]:
    """List planned agent roles and measured runtime-connection state."""
    return global_agent_brain.list_agents(category=category)


@router.get("/memory-logs")
async def get_agent_memory_logs(_: AdminUser) -> list[dict[str, Any]]:
    """Return measured agent execution logs; empty until a runtime is connected."""
    return global_agent_brain.get_memory_logs()


@router.post("/trigger-all")
async def trigger_all_agent_executions(_: AdminUser) -> dict[str, Any]:
    """Return a non-executed response while catalog roles have no runtime."""
    return global_agent_brain.trigger_all_agents()


@router.post("/{agent_id}/run")
async def trigger_agent_execution(agent_id: str, _: AdminUser) -> dict[str, Any]:
    """Return a non-executed response for a catalog role without a runtime."""
    result = global_agent_brain.trigger_agent(agent_id)
    if result.get("status") == "ERROR":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["message"])
    return result


@router.get("/telegram-report")
async def get_telegram_report(_: AdminUser) -> dict[str, Any]:
    """Return a preview-only executive report layout without dispatching it."""
    return global_agent_brain.generate_telegram_report()
