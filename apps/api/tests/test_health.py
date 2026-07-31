from typing import Any

import pytest
from httpx import AsyncClient

from app.api import health


@pytest.mark.asyncio
async def test_health_is_live_and_returns_trace_headers(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health", headers={"X-Correlation-ID": "test-flow-1"})

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert response.headers["X-Correlation-ID"] == "test-flow-1"
    assert response.headers["X-Request-ID"]


@pytest.mark.asyncio
async def test_invalid_correlation_id_is_replaced(client: AsyncClient) -> None:
    response = await client.get(
        "/api/v1/health",
        headers={"X-Correlation-ID": "invalid correlation id with spaces"},
    )

    assert response.status_code == 200
    assert response.headers["X-Correlation-ID"] == response.headers["X-Request-ID"]


@pytest.mark.asyncio
async def test_readiness_returns_503_without_exposing_urls(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def degraded_results() -> list[dict[str, Any]]:
        return [
            {"name": "database", "status": "healthy", "latency_ms": 1.2},
            {"name": "redis", "status": "unhealthy", "latency_ms": 2.3},
        ]

    monkeypatch.setattr(health, "_dependency_results", degraded_results)
    response = await client.get("/api/v1/deps")

    assert response.status_code == 503
    payload = response.json()
    assert payload["status"] == "degraded"
    assert payload["dependencies"]["redis"]["status"] == "unhealthy"
    assert "url" not in str(payload).lower()
    assert "redis://" not in str(payload)


@pytest.mark.asyncio
async def test_readiness_returns_200_when_dependencies_are_healthy(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def healthy_results() -> list[dict[str, Any]]:
        return [
            {"name": "database", "status": "healthy", "latency_ms": 1.0},
            {"name": "redis", "status": "healthy", "latency_ms": 1.0},
        ]

    monkeypatch.setattr(health, "_dependency_results", healthy_results)
    response = await client.get("/api/v1/ready")

    assert response.status_code == 200
    assert response.json()["status"] == "ready"


@pytest.mark.asyncio
async def test_framework_404_uses_structured_error_envelope(client: AsyncClient) -> None:
    response = await client.get("/api/v1/not-a-route")

    assert response.status_code == 404
    payload = response.json()
    assert payload["error"] == {"code": "http_404", "message": "Not Found"}
    assert payload["request_id"] == response.headers["X-Request-ID"]
    assert payload["correlation_id"] == response.headers["X-Correlation-ID"]
