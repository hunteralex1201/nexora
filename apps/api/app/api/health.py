import asyncio
from time import perf_counter
from typing import Any

from fastapi import APIRouter, Request, Response, status
from redis.asyncio import Redis

from app.config import settings
from app.database import check_database
from app.logger import setup_logger

logger = setup_logger(__name__)
router = APIRouter()


async def _timed_probe(name: str, probe: Any) -> dict[str, Any]:
    """Run a dependency probe with a strict timeout and safe diagnostics."""
    started = perf_counter()
    try:
        await asyncio.wait_for(probe(), timeout=settings.DEPENDENCY_TIMEOUT_SECONDS)
        return {
            "name": name,
            "status": "healthy",
            "latency_ms": round((perf_counter() - started) * 1000, 2),
        }
    except Exception as exc:  # readiness must convert dependency failures into status
        logger.warning(
            "Dependency health check failed",
            extra={"dependency": name, "error_type": type(exc).__name__},
        )
        return {
            "name": name,
            "status": "unhealthy",
            "latency_ms": round((perf_counter() - started) * 1000, 2),
        }


async def _check_redis() -> None:
    client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        await client.ping()
    finally:
        await client.aclose()


async def _dependency_results() -> list[dict[str, Any]]:
    results = await asyncio.gather(
        _timed_probe("database", check_database),
        _timed_probe("redis", _check_redis),
    )
    return list(results)


@router.get("/health", tags=["health"])
async def health_check(request: Request) -> dict[str, Any]:
    """Liveness check that does not depend on external services."""
    return {
        "status": "healthy",
        "service": "nexora-api",
        "version": "0.1.0",
        "request_id": getattr(request.state, "request_id", "unknown"),
    }


@router.get("/ready", tags=["health"])
async def readiness_check(request: Request, response: Response) -> dict[str, Any]:
    """Report whether the API can serve requests that require core dependencies."""
    dependencies = await _dependency_results()
    ready = all(item["status"] == "healthy" for item in dependencies)
    if not ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {
        "status": "ready" if ready else "not_ready",
        "request_id": getattr(request.state, "request_id", "unknown"),
        "dependencies": {item["name"]: item["status"] for item in dependencies},
    }


@router.get("/deps", tags=["health"])
async def dependency_check(request: Request, response: Response) -> dict[str, Any]:
    """Return safe dependency diagnostics without hosts, URLs, or credentials."""
    dependencies = await _dependency_results()
    healthy = all(item["status"] == "healthy" for item in dependencies)
    if not healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {
        "status": "healthy" if healthy else "degraded",
        "request_id": getattr(request.state, "request_id", "unknown"),
        "dependencies": {
            item["name"]: {
                "required": True,
                "status": item["status"],
                "latency_ms": item["latency_ms"],
            }
            for item in dependencies
        },
    }
