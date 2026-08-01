from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.commerce import _daily_count_map
from app.models.source import CrawlJob
from tests.conftest import create_user
from tests.test_auth import login

AUTOMATION_KEY = "test-only-automation-key-with-at-least-32-characters"


async def _admin_headers(
    client: AsyncClient,
    db_session: AsyncSession,
) -> dict[str, str]:
    await create_user(db_session)
    token = await login(
        client,
        email="admin@nexora.io",
        password="FoundationPass123!",
    )
    return {"Authorization": f"Bearer {token}"}


async def _create_source(
    client: AsyncClient,
    headers: dict[str, str],
    *,
    name: str = "Fixture Commerce",
    source_type: str = "fixture",
    active: bool = True,
) -> dict[str, Any]:
    response = await client.post(
        "/api/v1/commerce/sources",
        headers=headers,
        json={
            "name": name,
            "type": source_type,
            "base_url": "https://fixture.example",
            "config": {},
            "is_active": active,
        },
    )
    assert response.status_code == 201, response.text
    return dict(response.json())


def _item(*, price: str, observed_at: str, evidence: str) -> dict[str, Any]:
    return {
        "external_id": "sku-rice-5kg",
        "name": "Premium Rice 5 kg",
        "canonical_url": "https://fixture.example/products/rice-5kg",
        "price": price,
        "original_price": "120.00",
        "currency": "bdt",
        "availability": "in_stock",
        "brand": "NEXORA Fixture",
        "category": "Grocery",
        "seller_name": "Fixture Seller",
        "rating": "4.50",
        "review_count": 42,
        "observed_at": observed_at,
        "attributes": {"weight": "5 kg"},
        "evidence": {"fixture": evidence},
    }


@pytest.mark.asyncio
async def test_daily_activity_aggregation_handles_an_empty_job_ledger(
    db_session: AsyncSession,
) -> None:
    activity = await _daily_count_map(
        db_session,
        CrawlJob.created_at,
        datetime(2026, 8, 1, tzinfo=UTC),
    )

    assert activity == {}


@pytest.mark.asyncio
async def test_admin_can_run_evidence_backed_commerce_workflow(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    headers = await _admin_headers(client, db_session)

    connectors = await client.get("/api/v1/commerce/connectors", headers=headers)
    assert connectors.status_code == 200
    assert connectors.json()["fixture"]["capability_states"] == ["FIXTURE_ONLY"]

    source = await _create_source(client, headers)
    source_id = source["id"]

    first_import = await client.post(
        "/api/v1/commerce/imports/products",
        headers=headers,
        json={
            "source_id": source_id,
            "filename": "initial.json",
            "items": [
                _item(
                    price="100.00",
                    observed_at="2026-08-01T00:00:00Z",
                    evidence="initial",
                )
            ],
        },
    )
    assert first_import.status_code == 201, first_import.text
    assert first_import.json()["rows_accepted"] == 1
    assert first_import.json()["rows_rejected"] == 0

    products = await client.get("/api/v1/commerce/products", headers=headers)
    assert products.status_code == 200
    assert products.json()["total"] == 1
    product = products.json()["items"][0]
    product_id = product["id"]
    assert product["latest_observation"]["price"] == "100.00"
    assert product["latest_observation"]["evidence"]["fact_class"] == (
        "public_observation"
    )
    assert len(product["latest_observation"]["evidence_hash"]) == 64

    rule = await client.post(
        "/api/v1/commerce/alerts/rules",
        headers=headers,
        json={
            "name": "Rice below BDT 90",
            "rule_type": "price_below",
            "threshold": "90.00",
            "source_id": source_id,
            "product_id": product_id,
            "config": {},
        },
    )
    assert rule.status_code == 201, rule.text

    second_import = await client.post(
        "/api/v1/commerce/imports/products",
        headers=headers,
        json={
            "source_id": source_id,
            "filename": "price-drop.json",
            "items": [
                _item(
                    price="80.00",
                    observed_at="2026-08-01T02:00:00Z",
                    evidence="price-drop",
                )
            ],
        },
    )
    assert second_import.status_code == 201, second_import.text

    detail = await client.get(
        f"/api/v1/commerce/products/{product_id}", headers=headers
    )
    assert detail.status_code == 200
    payload = detail.json()
    assert len(payload["history"]) == 2
    assert payload["latest_observation"]["price"] == "80.00"
    assert payload["previous_price"] == "100.00"
    assert payload["price_change_percent"] == "-20.00"

    events = await client.get(
        "/api/v1/commerce/alerts/events?status=open", headers=headers
    )
    assert events.status_code == 200
    assert len(events.json()) == 1
    event = events.json()[0]
    assert event["product_id"] == product_id
    assert event["payload"]["current_price"] == "80.00"

    overview = await client.get("/api/v1/commerce/overview", headers=headers)
    assert overview.status_code == 200
    assert overview.json()["sources"] == {"total": 1, "active": 1}
    assert overview.json()["products"] == {"total": 1, "active": 1}
    assert overview.json()["observations"] == {"total": 2, "active": None}
    assert overview.json()["alerts"] == {"total": 1, "open": 1}
    activity = overview.json()["activity"]
    assert len(activity) == 14
    assert activity[-1]["day"] == "2026-08-01"
    assert activity[-1]["observations"] == 2
    assert activity[-1]["alerts"] == 1

    acknowledge = await client.post(
        f"/api/v1/commerce/alerts/events/{event['id']}/acknowledge",
        headers=headers,
    )
    assert acknowledge.status_code == 200
    assert acknowledge.json()["status"] == "acknowledged"
    assert acknowledge.json()["acknowledged_at"] is not None

    job_payload = {
        "source_id": source_id,
        "job_type": "collect",
        "trigger": "manual",
        "payload": {"items": [_item(
            price="75.00",
            observed_at="2026-08-01T03:00:00Z",
            evidence="worker",
        )]},
        "idempotency_key": "manual-fixture-collection-0001",
    }
    first_job = await client.post(
        "/api/v1/commerce/jobs", headers=headers, json=job_payload
    )
    repeated_job = await client.post(
        "/api/v1/commerce/jobs", headers=headers, json=job_payload
    )
    assert first_job.status_code == 201
    assert repeated_job.status_code == 201
    assert repeated_job.json()["id"] == first_job.json()["id"]


@pytest.mark.asyncio
async def test_csv_import_audits_valid_and_invalid_rows(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    headers = await _admin_headers(client, db_session)
    source = await _create_source(client, headers)
    csv_content = (
        "external_id,name,canonical_url,price,currency,availability,attributes,evidence\n"
        'sku-1,Valid Product,https://fixture.example/products/1,25.50,BDT,in_stock,"{}","{\"\"row\"\":1}"\n'
        "sku-2,Invalid Product,not-a-url,abc,BDT,unknown,{},{}\n"
    )

    response = await client.post(
        "/api/v1/commerce/imports/products/csv",
        headers=headers,
        data={"source_id": source["id"]},
        files={"file": ("products.csv", csv_content, "text/csv")},
    )
    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["status"] == "completed_with_errors"
    assert payload["rows_received"] == 2
    assert payload["rows_accepted"] == 1
    assert payload["rows_rejected"] == 1
    assert payload["errors"][0]["row"] == 3


@pytest.mark.asyncio
async def test_n8n_automation_key_and_idempotent_scheduling(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    headers = await _admin_headers(client, db_session)
    supported = await _create_source(client, headers, name="Supported Fixture")
    unsupported = await _create_source(
        client,
        headers,
        name="Unreviewed Marketplace",
        source_type="unreviewed_marketplace",
    )

    denied = await client.post(
        "/api/v1/commerce/automation/collect",
        json={"run_id": "n8n-2026-08-01T09:00:00Z"},
    )
    assert denied.status_code == 401

    automation_headers = {"X-Automation-Key": AUTOMATION_KEY}
    request = {"run_id": "n8n-2026-08-01T09:00:00Z"}
    first = await client.post(
        "/api/v1/commerce/automation/collect",
        headers=automation_headers,
        json=request,
    )
    assert first.status_code == 200, first.text
    first_payload = first.json()
    assert first_payload["active_source_count"] == 2
    assert len(first_payload["queued_job_ids"]) == 1
    assert first_payload["skipped_source_ids"] == [unsupported["id"]]

    repeated = await client.post(
        "/api/v1/commerce/automation/collect",
        headers=automation_headers,
        json=request,
    )
    assert repeated.status_code == 200
    assert repeated.json()["queued_job_ids"] == []
    assert set(repeated.json()["skipped_source_ids"]) == {
        supported["id"],
        unsupported["id"],
    }

    ai_run = await client.post(
        "/api/v1/commerce/automation/ai",
        headers=automation_headers,
        json={"run_id": "n8n-ai-2026-08-01", "max_products": 5},
    )
    assert ai_run.status_code == 200
    assert len(ai_run.json()["queued_job_ids"]) == 2


@pytest.mark.asyncio
async def test_commerce_surface_requires_admin_role(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    await create_user(
        db_session,
        email="analyst@nexora.io",
        role_name="analyst",
    )
    token = await login(
        client,
        email="analyst@nexora.io",
        password="FoundationPass123!",
    )
    response = await client.get(
        "/api/v1/commerce/sources",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
    assert response.json()["error"]["message"] == "Insufficient permissions"
