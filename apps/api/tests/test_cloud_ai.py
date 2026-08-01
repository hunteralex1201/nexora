from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from typing import Any

import httpx
import pytest
from pydantic import SecretStr

from app.config import settings
from app.services.ai import AIServiceError, TransientAIServiceError
from app.services.cloud_ai import generate_cloud_price_insight


def _evidence() -> tuple[SimpleNamespace, list[SimpleNamespace]]:
    now = datetime(2026, 8, 1, 7, 0, tzinfo=UTC)
    product = SimpleNamespace(
        id=uuid.uuid4(),
        external_id="cloud-sku-1",
        name="Cloud Evidence Product",
        brand="NEXORA Test",
        category="Groceries",
        currency="BDT",
        canonical_url="https://shop.example.com/cloud-evidence",
    )
    latest = SimpleNamespace(
        id=uuid.uuid4(),
        observed_at=now,
        price=Decimal("90.00"),
        original_price=Decimal("100.00"),
        availability="in_stock",
        seller_name="Example Shop",
        rating=Decimal("4.50"),
        review_count=12,
        source_url="https://shop.example.com/cloud-evidence",
        evidence_hash="a" * 64,
    )
    previous = SimpleNamespace(
        id=uuid.uuid4(),
        observed_at=datetime(2026, 7, 31, 7, 0, tzinfo=UTC),
        price=Decimal("100.00"),
        original_price=None,
        availability="in_stock",
        seller_name="Example Shop",
        rating=None,
        review_count=None,
        source_url="https://shop.example.com/cloud-evidence",
        evidence_hash="b" * 64,
    )
    return product, [latest, previous]


def _cloud_config(**updates: Any):
    values: dict[str, Any] = {
        "CLOUD_LLM_ENABLED": True,
        "CLOUD_LLM_API_KEY": SecretStr("test-cloud-key"),
        "CLOUD_LLM_ALLOWED_MODELS": "gpt-test",
        "CLOUD_LLM_DEFAULT_MODEL": "gpt-test",
        "CLOUD_LLM_BASE_URL": "https://cloud.example.test/v1/",
        "CLOUD_LLM_TIMEOUT_SECONDS": 15.0,
    }
    values.update(updates)
    return settings.model_copy(update=values)


@pytest.mark.asyncio
async def test_cloud_provider_requires_server_allowlist_and_enabled_secret() -> None:
    product, observations = _evidence()

    with pytest.raises(AIServiceError, match="not allowlisted"):
        await generate_cloud_price_insight(
            product,
            observations,
            model="unapproved-model",
            config=_cloud_config(),
        )

    disabled = _cloud_config(CLOUD_LLM_ENABLED=False)
    with pytest.raises(AIServiceError, match="disabled"):
        await generate_cloud_price_insight(
            product,
            observations,
            model="gpt-test",
            config=disabled,
        )

    missing_key = _cloud_config(CLOUD_LLM_API_KEY=SecretStr(""))
    with pytest.raises(AIServiceError, match="not configured"):
        await generate_cloud_price_insight(
            product,
            observations,
            model="gpt-test",
            config=missing_key,
        )


@pytest.mark.asyncio
async def test_cloud_provider_sends_strict_evidence_only_request(
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

        async def post(
            self,
            path: str,
            *,
            json: dict[str, Any],
            headers: dict[str, str],
        ) -> httpx.Response:
            captured["path"] = path
            captured["payload"] = json
            captured["headers"] = headers
            content = {
                "summary": "Verified price decreased across two observations.",
                "recommended_action": "review_price",
                "confidence": 0.91,
                "rationale": ["The latest verified price is BDT 10.00 lower."],
            }
            return httpx.Response(
                200,
                json={"choices": [{"message": {"content": content}}]},
                request=httpx.Request("POST", "https://cloud.example.test/v1/chat/completions"),
            )

    monkeypatch.setattr("app.services.cloud_ai.httpx.AsyncClient", FakeClient)
    product, observations = _evidence()
    generated = await generate_cloud_price_insight(
        product,
        observations,
        model="gpt-test",
        config=_cloud_config(),
    )

    assert captured["client"] == {
        "base_url": "https://cloud.example.test/v1",
        "timeout": 15.0,
    }
    assert captured["path"] == "/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer test-cloud-key"
    payload = captured["payload"]
    assert payload["temperature"] == 0.1
    assert payload["response_format"]["json_schema"]["strict"] is True
    assert payload["response_format"]["json_schema"]["schema"]["additionalProperties"] is False
    facts = json.loads(payload["messages"][1]["content"])
    assert facts["computed"]["absolute_price_change"] == "-10.00"
    assert generated.output.recommended_action == "review_price"
    assert generated.model == "gpt-test"
    assert generated.facts == facts


@pytest.mark.asyncio
@pytest.mark.parametrize("status_code", [408, 409, 429, 503])
async def test_cloud_provider_classifies_retryable_statuses(
    monkeypatch: pytest.MonkeyPatch,
    status_code: int,
) -> None:
    class FakeClient:
        def __init__(self, **_: Any) -> None:
            return None

        async def __aenter__(self) -> FakeClient:
            return self

        async def __aexit__(self, *_: Any) -> None:
            return None

        async def post(self, *_: Any, **__: Any) -> httpx.Response:
            return httpx.Response(
                status_code,
                request=httpx.Request("POST", "https://cloud.example.test/v1/chat/completions"),
            )

    monkeypatch.setattr("app.services.cloud_ai.httpx.AsyncClient", FakeClient)
    product, observations = _evidence()
    with pytest.raises(TransientAIServiceError, match="retryable status"):
        await generate_cloud_price_insight(
            product,
            observations,
            model="gpt-test",
            config=_cloud_config(),
        )


@pytest.mark.asyncio
async def test_cloud_provider_classifies_network_and_permanent_failures(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class TimeoutClient:
        def __init__(self, **_: Any) -> None:
            return None

        async def __aenter__(self) -> TimeoutClient:
            return self

        async def __aexit__(self, *_: Any) -> None:
            return None

        async def post(self, *_: Any, **__: Any) -> httpx.Response:
            raise httpx.ReadTimeout("timeout")

    monkeypatch.setattr("app.services.cloud_ai.httpx.AsyncClient", TimeoutClient)
    product, observations = _evidence()
    with pytest.raises(TransientAIServiceError, match="unavailable or timed out"):
        await generate_cloud_price_insight(
            product,
            observations,
            model="gpt-test",
            config=_cloud_config(),
        )

    class RejectedClient(TimeoutClient):
        async def post(self, *_: Any, **__: Any) -> httpx.Response:
            return httpx.Response(
                403,
                request=httpx.Request("POST", "https://cloud.example.test/v1/chat/completions"),
            )

    monkeypatch.setattr("app.services.cloud_ai.httpx.AsyncClient", RejectedClient)
    with pytest.raises(AIServiceError, match="returned status 403"):
        await generate_cloud_price_insight(
            product,
            observations,
            model="gpt-test",
            config=_cloud_config(),
        )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "response_payload, expected_message",
    [
        ({"choices": []}, "invalid response envelope"),
        (
            {"choices": [{"message": {"content": 7}}]},
            "invalid structured insight",
        ),
        (
            {"choices": [{"message": {"content": "not-json"}}]},
            "invalid structured insight",
        ),
        (
            {
                "choices": [
                    {
                        "message": {
                            "content": {
                                "summary": "Missing required fields",
                            }
                        }
                    }
                ]
            },
            "invalid structured insight",
        ),
    ],
)
async def test_cloud_provider_rejects_invalid_response_contracts(
    monkeypatch: pytest.MonkeyPatch,
    response_payload: dict[str, Any],
    expected_message: str,
) -> None:
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
                json=response_payload,
                request=httpx.Request("POST", "https://cloud.example.test/v1/chat/completions"),
            )

    monkeypatch.setattr("app.services.cloud_ai.httpx.AsyncClient", FakeClient)
    product, observations = _evidence()
    with pytest.raises(AIServiceError, match=expected_message):
        await generate_cloud_price_insight(
            product,
            observations,
            model="gpt-test",
            config=_cloud_config(),
        )
