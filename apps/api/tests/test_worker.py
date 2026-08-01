from __future__ import annotations

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors import TransientConnectorError
from app.models.commerce import Product, ProductObservation
from app.services.ai import GeneratedInsight, StructuredInsight, build_price_facts
from app.services.worker import claim_job, process_claimed_job
from tests.test_commerce import _admin_headers, _create_source, _item


async def _ignore_event(**_: Any) -> None:
    return None


@pytest.mark.asyncio
async def test_worker_executes_fixture_collection_and_persists_evidence(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    headers = await _admin_headers(client, db_session)
    source = await _create_source(client, headers)
    response = await client.post(
        "/api/v1/commerce/jobs",
        headers=headers,
        json={
            "source_id": source["id"],
            "job_type": "collect",
            "trigger": "manual",
            "payload": {
                "items": [
                    _item(
                        price="74.50",
                        observed_at="2026-08-01T04:00:00Z",
                        evidence="worker-collection",
                    )
                ]
            },
            "idempotency_key": "worker-fixture-success-0001",
        },
    )
    assert response.status_code == 201, response.text

    monkeypatch.setattr("app.services.worker.publish_event", _ignore_event)
    claimed = await claim_job()
    assert str(claimed) == response.json()["id"]
    assert claimed is not None
    await process_claimed_job(claimed)

    jobs = await client.get(
        "/api/v1/commerce/jobs?status=succeeded",
        headers=headers,
    )
    assert jobs.status_code == 200
    assert len(jobs.json()) == 1
    metrics = jobs.json()[0]["metrics"]
    assert metrics["records"] == 1
    assert metrics["connector_id"] == "fixture-product"
    assert metrics["connector_version"] == "1.0.0"
    assert metrics["import_batch_id"]

    products = await client.get("/api/v1/commerce/products", headers=headers)
    assert products.status_code == 200
    assert products.json()["total"] == 1
    observation = products.json()["items"][0]["latest_observation"]
    assert observation["price"] == "74.50"
    assert observation["collector"] == "fixture-product"
    assert observation["evidence"]["connector_version"] == "1.0.0"
    assert observation["evidence"]["classification"] == "VERIFIED"


@pytest.mark.asyncio
async def test_worker_persists_evidence_grounded_ai_insight(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    headers = await _admin_headers(client, db_session)
    source = await _create_source(client, headers)
    initial_import = await client.post(
        "/api/v1/commerce/imports/products",
        headers=headers,
        json={
            "source_id": source["id"],
            "filename": "ai-input.json",
            "items": [
                _item(
                    price="88.00",
                    observed_at="2026-08-01T05:00:00Z",
                    evidence="ai-input",
                )
            ],
        },
    )
    assert initial_import.status_code == 201, initial_import.text

    response = await client.post(
        "/api/v1/commerce/jobs",
        headers=headers,
        json={
            "source_id": source["id"],
            "job_type": "ai_analyze",
            "trigger": "manual",
            "payload": {"max_products": 5},
            "idempotency_key": "worker-ai-success-0001",
        },
    )
    assert response.status_code == 201, response.text

    async def fake_generate(
        product: Product,
        observations: list[ProductObservation],
    ) -> GeneratedInsight:
        return GeneratedInsight(
            output=StructuredInsight(
                summary="One verified BDT 88.00 observation is available; trend is unknown.",
                recommended_action="monitor",
                confidence=0.76,
                rationale=["Only one verified observation is available."],
            ),
            facts=build_price_facts(product, observations),
            model="qwen3:8b-test",
        )

    monkeypatch.setattr("app.services.worker.publish_event", _ignore_event)
    monkeypatch.setattr("app.services.worker.generate_price_insight", fake_generate)
    claimed = await claim_job()
    assert str(claimed) == response.json()["id"]
    assert claimed is not None
    await process_claimed_job(claimed)

    insights = await client.get("/api/v1/commerce/ai/insights", headers=headers)
    assert insights.status_code == 200
    assert len(insights.json()) == 1
    insight = insights.json()[0]
    assert insight["model"] == "qwen3:8b-test"
    assert insight["prompt_version"] == "price-intelligence-v1"
    assert insight["confidence"] == "0.7600"
    assert insight["evidence"]["recommended_action"] == "monitor"
    assert insight["evidence"]["facts"]["latest"]["price"] == "88.00"
    assert insight["observation_id"] is not None
    assert insight["crawl_job_id"] == response.json()["id"]


@pytest.mark.asyncio
async def test_worker_requeues_transient_connector_failure(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    headers = await _admin_headers(client, db_session)
    source = await _create_source(client, headers)
    response = await client.post(
        "/api/v1/commerce/jobs",
        headers=headers,
        json={
            "source_id": source["id"],
            "job_type": "collect",
            "trigger": "manual",
            "payload": {"items": [_item(
                price="50.00",
                observed_at="2026-08-01T06:00:00Z",
                evidence="retry-input",
            )]},
            "idempotency_key": "worker-transient-retry-0001",
            "max_attempts": 3,
        },
    )
    assert response.status_code == 201, response.text

    class FailingConnector:
        async def collect(self, *_: Any, **__: Any) -> Any:
            raise TransientConnectorError("temporary upstream timeout")

    monkeypatch.setattr("app.services.worker.publish_event", _ignore_event)
    monkeypatch.setattr("app.services.worker.connector_for", lambda _: FailingConnector())
    claimed = await claim_job()
    assert claimed is not None
    await process_claimed_job(claimed)

    jobs = await client.get("/api/v1/commerce/jobs?status=queued", headers=headers)
    assert jobs.status_code == 200
    assert len(jobs.json()) == 1
    job = jobs.json()[0]
    assert job["attempt"] == 1
    assert job["metrics"]["retry_delay_seconds"] == 5
    assert "TransientConnectorError" in job["error_message"]
