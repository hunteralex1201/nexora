from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import httpx
import pytest

from app.models.commerce import Product, ProductObservation
from app.services.ai import AIServiceError, generate_price_insight, list_installed_models


def _product_and_observations() -> tuple[Product, list[ProductObservation]]:
    now = datetime(2026, 8, 1, 7, 0, tzinfo=UTC)
    product_id = uuid.uuid4()
    product = Product(
        id=product_id,
        source_id=uuid.uuid4(),
        external_id="sku-ai-1",
        name="Evidence Product",
        canonical_url="https://shop.example.com/evidence-product",
        brand="Example",
        category="Groceries",
        currency="BDT",
        image_url=None,
        attributes={},
        is_active=True,
        first_seen_at=now,
        last_seen_at=now,
    )
    latest = ProductObservation(
        id=uuid.uuid4(),
        product_id=product_id,
        crawl_job_id=None,
        import_batch_id=None,
        observed_at=now,
        price=Decimal("90.00"),
        original_price=Decimal("100.00"),
        currency="BDT",
        availability="in_stock",
        seller_name="Example Shop",
        rating=Decimal("4.50"),
        review_count=12,
        source_url="https://shop.example.com/evidence-product",
        collector="fixture-product",
        evidence={"classification": "VERIFIED"},
        evidence_hash="a" * 64,
        idempotency_key="latest-observation",
        raw_object_key=None,
        created_at=now,
    )
    previous = ProductObservation(
        id=uuid.uuid4(),
        product_id=product_id,
        crawl_job_id=None,
        import_batch_id=None,
        observed_at=datetime(2026, 7, 31, 7, 0, tzinfo=UTC),
        price=Decimal("100.00"),
        original_price=None,
        currency="BDT",
        availability="in_stock",
        seller_name="Example Shop",
        rating=None,
        review_count=None,
        source_url="https://shop.example.com/evidence-product",
        collector="fixture-product",
        evidence={"classification": "VERIFIED"},
        evidence_hash="b" * 64,
        idempotency_key="previous-observation",
        raw_object_key=None,
        created_at=now,
    )
    return product, [latest, previous]


@pytest.mark.asyncio
async def test_ollama_chat_request_is_structured_and_evidence_grounded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    class FakeClient:
        def __init__(self, **kwargs: Any) -> None:
            captured["client"] = kwargs

        async def __aenter__(self) -> FakeClient:
            return self

        async def __aexit__(self, *_: Any) -> None:
            return None

        async def post(self, path: str, json: dict[str, Any]) -> httpx.Response:
            captured["path"] = path
            captured["payload"] = json
            content = {
                "summary": "Verified price decreased by BDT 10.00 across two observations.",
                "recommended_action": "review_price",
                "confidence": 0.91,
                "rationale": ["The latest verified price is lower than the previous price."],
            }
            return httpx.Response(
                200,
                json={"message": {"content": json_module.dumps(content)}},
                request=httpx.Request("POST", "http://ollama:11434/api/chat"),
            )

    json_module = json
    monkeypatch.setattr("app.services.ai.httpx.AsyncClient", FakeClient)
    product, observations = _product_and_observations()
    generated = await generate_price_insight(product, observations)

    assert captured["path"] == "/api/chat"
    payload = captured["payload"]
    assert payload["stream"] is False
    assert payload["think"] is False
    assert payload["options"]["temperature"] == 0.1
    assert payload["format"]["additionalProperties"] is False
    facts = json.loads(payload["messages"][1]["content"])
    assert facts["latest"]["price"] == "90.00"
    assert facts["previous"]["price"] == "100.00"
    assert facts["computed"]["absolute_price_change"] == "-10.00"
    assert facts["computed"]["percent_price_change"] == "-10.00"
    assert generated.output.recommended_action == "review_price"
    assert generated.output.confidence == 0.91
    assert generated.facts == facts


@pytest.mark.asyncio
async def test_ollama_rejects_unstructured_output(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeClient:
        def __init__(self, **_: Any) -> None:
            return None

        async def __aenter__(self) -> FakeClient:
            return self

        async def __aexit__(self, *_: Any) -> None:
            return None

        async def post(self, *_: Any, **__: Any) -> httpx.Response:
            return httpx.Response(
                200,
                json={"message": {"content": "not-json"}},
                request=httpx.Request("POST", "http://ollama:11434/api/chat"),
            )

    monkeypatch.setattr("app.services.ai.httpx.AsyncClient", FakeClient)
    product, observations = _product_and_observations()
    with pytest.raises(AIServiceError, match="invalid structured insight"):
        await generate_price_insight(product, observations)


@pytest.mark.asyncio
async def test_ollama_model_readiness_lists_installed_models(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeClient:
        def __init__(self, **_: Any) -> None:
            return None

        async def __aenter__(self) -> FakeClient:
            return self

        async def __aexit__(self, *_: Any) -> None:
            return None

        async def get(self, path: str) -> httpx.Response:
            assert path == "/api/tags"
            return httpx.Response(
                200,
                json={"models": [{"name": "qwen3:8b"}, {"name": "qwen3-embedding:0.6b"}]},
                request=httpx.Request("GET", "http://ollama:11434/api/tags"),
            )

    monkeypatch.setattr("app.services.ai.httpx.AsyncClient", FakeClient)
    assert await list_installed_models() == ["qwen3:8b", "qwen3-embedding:0.6b"]
