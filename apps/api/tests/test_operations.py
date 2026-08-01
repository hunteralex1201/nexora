from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import commerce as commerce_api
from app.api import health as health_api
from app.models.commerce import AIInsight, Product, ProductObservation
from app.services import events
from app.services.ai import TransientAIServiceError
from tests.conftest import create_user
from tests.test_commerce import _admin_headers, _create_source, _item


@pytest.mark.asyncio
async def test_health_probes_report_ready_and_degraded(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def successful_probe() -> None:
        return None

    async def failed_probe() -> None:
        raise RuntimeError("dependency unavailable")

    assert (await health_api._timed_probe("ok", successful_probe))["status"] == "healthy"
    assert (await health_api._timed_probe("bad", failed_probe))["status"] == "unhealthy"

    async def healthy_dependencies() -> list[dict[str, Any]]:
        return [
            {"name": "database", "status": "healthy", "latency_ms": 1.0},
            {"name": "redis", "status": "healthy", "latency_ms": 2.0},
        ]

    monkeypatch.setattr(health_api, "_dependency_results", healthy_dependencies)
    ready = await client.get("/api/v1/ready")
    dependencies = await client.get("/api/v1/deps")
    assert ready.status_code == 200
    assert ready.json()["status"] == "ready"
    assert dependencies.status_code == 200
    assert dependencies.json()["dependencies"]["redis"]["required"] is True

    async def degraded_dependencies() -> list[dict[str, Any]]:
        return [
            {"name": "database", "status": "healthy", "latency_ms": 1.0},
            {"name": "redis", "status": "unhealthy", "latency_ms": 2.0},
        ]

    monkeypatch.setattr(health_api, "_dependency_results", degraded_dependencies)
    not_ready = await client.get("/api/v1/ready")
    degraded = await client.get("/api/v1/deps")
    assert not_ready.status_code == 503
    assert not_ready.json()["status"] == "not_ready"
    assert degraded.status_code == 503
    assert degraded.json()["status"] == "degraded"


@pytest.mark.asyncio
async def test_redis_event_envelope_and_failure_are_safe(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    class FakeRedis:
        def __init__(self, *, fail: bool = False) -> None:
            self.fail = fail
            self.closed = False

        async def xadd(self, stream: str, fields: dict[str, str], **kwargs: Any) -> str:
            captured.update(stream=stream, fields=fields, options=kwargs)
            if self.fail:
                raise RuntimeError("redis unavailable")
            return "1-0"

        async def aclose(self) -> None:
            self.closed = True

    success_client = FakeRedis()
    monkeypatch.setattr(events.redis, "from_url", lambda *_args, **_kwargs: success_client)
    event_id = await events.publish_event(
        event_type="crawl.completed",
        correlation_id="job-123",
        payload={"accepted": 2},
    )
    assert event_id is not None
    envelope = json.loads(captured["fields"]["event"])
    assert envelope["event_id"] == event_id
    assert envelope["correlation_id"] == "job-123"
    assert envelope["payload"] == {"accepted": 2}
    assert success_client.closed is True

    failure_client = FakeRedis(fail=True)
    monkeypatch.setattr(events.redis, "from_url", lambda *_args, **_kwargs: failure_client)
    assert (
        await events.publish_event(
            event_type="crawl.failed",
            correlation_id="job-456",
            payload={},
        )
        is None
    )
    assert failure_client.closed is True


@pytest.mark.asyncio
async def test_operator_secondary_workflows_and_ai_visibility(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    headers = await _admin_headers(client, db_session)
    primary = await _create_source(client, headers, name="Primary Fixture")
    secondary = await _create_source(client, headers, name="Secondary Fixture")

    duplicate = await client.post(
        "/api/v1/commerce/sources",
        headers=headers,
        json={
            "name": "primary fixture",
            "type": "fixture",
            "base_url": "https://fixture.example",
            "config": {},
            "is_active": True,
        },
    )
    assert duplicate.status_code == 409

    updated = await client.patch(
        f"/api/v1/commerce/sources/{primary['id']}",
        headers=headers,
        json={
            "name": "Primary Updated",
            "base_url": "https://updated.example",
            "config": {"mode": "fixture"},
            "is_active": False,
        },
    )
    assert updated.status_code == 200
    assert updated.json()["is_active"] is False
    inactive_sources = await client.get("/api/v1/commerce/sources?active=false", headers=headers)
    assert [source["id"] for source in inactive_sources.json()] == [primary["id"]]

    inactive_import = await client.post(
        "/api/v1/commerce/imports/products",
        headers=headers,
        json={
            "source_id": primary["id"],
            "filename": "blocked.json",
            "items": [
                _item(
                    price="100.00",
                    observed_at="2026-08-01T00:00:00Z",
                    evidence="inactive",
                )
            ],
        },
    )
    assert inactive_import.status_code == 409
    await client.patch(
        f"/api/v1/commerce/sources/{primary['id']}",
        headers=headers,
        json={"is_active": True},
    )

    imported = await client.post(
        "/api/v1/commerce/imports/products",
        headers=headers,
        json={
            "source_id": primary["id"],
            "filename": "secondary-paths.json",
            "items": [
                _item(
                    price="95.00",
                    observed_at="2026-08-01T01:00:00Z",
                    evidence="secondary-paths",
                )
            ],
        },
    )
    assert imported.status_code == 201

    products = await client.get(
        f"/api/v1/commerce/products?source_id={primary['id']}&search=Rice&active=true",
        headers=headers,
    )
    assert products.status_code == 200
    assert products.json()["total"] == 1
    product_id = products.json()["items"][0]["id"]

    observations = await client.get(
        f"/api/v1/commerce/products/{product_id}/observations?limit=1",
        headers=headers,
    )
    assert observations.status_code == 200
    assert len(observations.json()) == 1
    missing_product = await client.get(f"/api/v1/commerce/products/{uuid.uuid4()}", headers=headers)
    assert missing_product.status_code == 404

    queued = await client.post(
        "/api/v1/commerce/jobs",
        headers=headers,
        json={
            "source_id": primary["id"],
            "job_type": "collect",
            "trigger": "manual",
            "payload": {"items": []},
            "max_attempts": 2,
        },
    )
    assert queued.status_code == 201
    job_id = queued.json()["id"]
    jobs = await client.get(
        f"/api/v1/commerce/jobs?source_id={primary['id']}&status=queued",
        headers=headers,
    )
    assert [job["id"] for job in jobs.json()] == [job_id]
    assert (await client.get(f"/api/v1/commerce/jobs/{job_id}", headers=headers)).status_code == 200
    assert (
        await client.get(f"/api/v1/commerce/jobs/{uuid.uuid4()}", headers=headers)
    ).status_code == 404

    mismatch_rule = await client.post(
        "/api/v1/commerce/alerts/rules",
        headers=headers,
        json={
            "name": "Mismatched scope",
            "rule_type": "price_below",
            "threshold": "50.00",
            "source_id": secondary["id"],
            "product_id": product_id,
            "config": {},
        },
    )
    assert mismatch_rule.status_code == 422
    assert (await client.get("/api/v1/commerce/alerts/rules", headers=headers)).status_code == 200
    assert (
        await client.post(
            f"/api/v1/commerce/alerts/events/{uuid.uuid4()}/acknowledge",
            headers=headers,
        )
    ).status_code == 404

    product = await db_session.scalar(select(Product).where(Product.id == uuid.UUID(product_id)))
    assert product is not None
    observation = await db_session.scalar(
        select(ProductObservation).where(ProductObservation.product_id == product.id)
    )
    assert observation is not None
    db_session.add(
        AIInsight(
            product_id=product.id,
            observation_id=observation.id,
            kind="source_summary",
            model="qwen3:8b",
            prompt_version="source-summary-v1",
            content="Evidence-backed summary",
            confidence=Decimal("0.9000"),
            evidence={"observation_ids": [str(observation.id)]},
            idempotency_key="ops-insight-001",
        )
    )
    await db_session.commit()
    insights = await client.get(
        f"/api/v1/commerce/ai/insights?source_id={primary['id']}&product_id={product_id}",
        headers=headers,
    )
    assert insights.status_code == 200
    assert insights.json()[0]["content"] == "Evidence-backed summary"

    async def installed_models() -> list[str]:
        return ["qwen3:8b", "qwen3-embedding:0.6b"]

    monkeypatch.setattr(commerce_api, "list_installed_models", installed_models)
    ready = await client.get("/api/v1/commerce/ai/readiness", headers=headers)
    assert ready.status_code == 200
    assert ready.json()["status"] == "ready"

    async def unavailable_models() -> list[str]:
        raise TransientAIServiceError("ollama unavailable")

    monkeypatch.setattr(commerce_api, "list_installed_models", unavailable_models)
    degraded = await client.get("/api/v1/commerce/ai/readiness", headers=headers)
    assert degraded.status_code == 200
    assert degraded.json()["status"] == "degraded"


@pytest.mark.asyncio
async def test_workspace_key_authorizes_streaming_chat_without_opening_direct_api(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    await create_user(db_session)
    route = "/api/v1/commerce/overview"

    assert (await client.get(route)).status_code == 401
    assert (await client.get(route, headers={"X-Workspace-Key": "wrong-key"})).status_code == 401

    workspace_headers = {"X-Workspace-Key": "test-only-workspace-key-with-at-least-32-characters"}
    assert (await client.get(route, headers=workspace_headers)).status_code == 200

    async def streamed_chat(_payload: Any) -> AsyncIterator[dict[str, object]]:
        yield {"type": "start", "model": "qwen3:8b"}
        yield {"type": "token", "content": "Bangla response"}
        yield {"type": "done", "model": "qwen3:8b", "total_duration_ms": 42}

    monkeypatch.setattr(commerce_api, "stream_chat_completion", streamed_chat)
    response = await client.post(
        "/api/v1/commerce/ai/chat",
        headers=workspace_headers,
        json={"messages": [{"role": "user", "content": "Banglay bolo"}]},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/x-ndjson")
    assert [json.loads(line) for line in response.text.splitlines()] == [
        {"type": "start", "model": "qwen3:8b"},
        {"type": "token", "content": "Bangla response"},
        {"type": "done", "model": "qwen3:8b", "total_duration_ms": 42},
    ]

    invalid = await client.post(
        "/api/v1/commerce/ai/chat",
        headers=workspace_headers,
        json={"messages": [{"role": "assistant", "content": "No user request"}]},
    )
    assert invalid.status_code == 422


@pytest.mark.asyncio
async def test_health_dependency_probes_close_redis_and_aggregate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeRedis:
        def __init__(self) -> None:
            self.pinged = False
            self.closed = False

        async def ping(self) -> bool:
            self.pinged = True
            return True

        async def aclose(self) -> None:
            self.closed = True

    redis_client = FakeRedis()
    monkeypatch.setattr(
        health_api.Redis,
        "from_url",
        lambda *_args, **_kwargs: redis_client,
    )
    await health_api._check_redis()
    assert redis_client.pinged is True
    assert redis_client.closed is True

    async def database_ok() -> None:
        return None

    async def redis_ok() -> None:
        return None

    monkeypatch.setattr(health_api, "check_database", database_ok)
    monkeypatch.setattr(health_api, "_check_redis", redis_ok)
    results = await health_api._dependency_results()
    assert [item["name"] for item in results] == ["database", "redis"]
    assert all(item["status"] == "healthy" for item in results)


def test_settings_reject_unsafe_database_and_production_automation_secrets() -> None:
    from pydantic import ValidationError

    from app.config import Settings

    with pytest.raises(ValidationError, match="DATABASE_URL must use"):
        Settings(
            ENVIRONMENT="test",
            DATABASE_URL="postgresql://nexora:nexora@localhost/nexora",
        )

    with pytest.raises(ValidationError, match="AUTOMATION_API_KEY"):
        Settings(
            ENVIRONMENT="production",
            DATABASE_URL="sqlite+aiosqlite:///./safe.db",
            SECRET_KEY="s" * 40,
            AUTOMATION_API_KEY="change-this-automation-key",
        )

    with pytest.raises(ValidationError, match="WORKSPACE_API_KEY"):
        Settings(
            ENVIRONMENT="production",
            DATABASE_URL="sqlite+aiosqlite:///./safe.db",
            SECRET_KEY="s" * 40,
            AUTOMATION_API_KEY="a" * 40,
            WORKSPACE_API_KEY="change-this-workspace-key",
        )
