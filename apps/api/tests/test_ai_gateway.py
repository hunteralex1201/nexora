from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from app.services.ai import (
    AIServiceError,
    GeneratedInsight,
    StructuredInsight,
    TransientAIServiceError,
)
from app.services.ai_gateway import (
    RoutedPermanentAIServiceError,
    RoutedTransientAIServiceError,
    generate_routed_price_insight,
)
from app.services.ai_routing import (
    AIDataClass,
    AIExecutionMode,
    AIProvider,
    AITaskClass,
    ModelDescriptor,
    RoutingDecision,
)


def _descriptor(
    provider: AIProvider,
    model: str,
    *,
    mode: AIExecutionMode = AIExecutionMode.SYNCHRONOUS,
) -> ModelDescriptor:
    return ModelDescriptor(
        provider=provider,
        model=model,
        execution_mode=mode,
        task_classes=frozenset({AITaskClass.PRICE_INTELLIGENCE}),
        enabled=True,
        configured=True,
        external=provider is not AIProvider.OLLAMA,
    )


def _decision(*candidates: ModelDescriptor) -> RoutingDecision:
    return RoutingDecision(
        task_class=AITaskClass.PRICE_INTELLIGENCE,
        data_class=AIDataClass.INTERNAL,
        selected=candidates[0],
        fallbacks=tuple(candidates[1:]),
        policy_version="test-policy-v1",
        route_hint_applied=False,
        reason="test route",
    )


def _generated(model: str) -> GeneratedInsight:
    return GeneratedInsight(
        output=StructuredInsight(
            summary="Evidence-backed test insight.",
            recommended_action="monitor",
            confidence=0.8,
            rationale=["Persisted observations support this statement."],
        ),
        facts={"source": "persisted-evidence"},
        model=model,
    )


@pytest.mark.asyncio
async def test_gateway_falls_back_only_after_retryable_local_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    decision = _decision(
        _descriptor(AIProvider.OLLAMA, "qwen3:8b"),
        _descriptor(AIProvider.CLOUD, "gpt-test"),
    )
    calls: list[str] = []

    def fake_route(*_: Any, **__: Any) -> RoutingDecision:
        return decision

    async def fake_local(*_: Any, **__: Any) -> GeneratedInsight:
        calls.append("ollama")
        raise TransientAIServiceError("local timeout")

    async def fake_cloud(*_: Any, **__: Any) -> GeneratedInsight:
        calls.append("cloud")
        return _generated("gpt-test")

    monkeypatch.setattr("app.services.ai_gateway.route_ai_task", fake_route)
    monkeypatch.setattr("app.services.ai_gateway.generate_price_insight", fake_local)
    monkeypatch.setattr("app.services.ai_gateway.generate_cloud_price_insight", fake_cloud)

    result = await generate_routed_price_insight(SimpleNamespace(), [])

    assert calls == ["ollama", "cloud"]
    assert result.generated.model == "gpt-test"
    assert [attempt.status for attempt in result.attempts] == [
        "retryable_failure",
        "succeeded",
    ]
    assert result.attempts[0].error_type == "TransientAIServiceError"
    audit = result.attempts[1].audit_dict()
    assert audit["provider"] == "cloud"
    assert audit["status"] == "succeeded"
    assert isinstance(audit["latency_ms"], int)


@pytest.mark.asyncio
async def test_gateway_aborts_fallback_on_permanent_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    decision = _decision(
        _descriptor(AIProvider.OLLAMA, "qwen3:8b"),
        _descriptor(AIProvider.CLOUD, "gpt-test"),
    )
    cloud_called = False

    async def fake_local(*_: Any, **__: Any) -> GeneratedInsight:
        raise AIServiceError("invalid local output")

    async def fake_cloud(*_: Any, **__: Any) -> GeneratedInsight:
        nonlocal cloud_called
        cloud_called = True
        return _generated("gpt-test")

    monkeypatch.setattr("app.services.ai_gateway.route_ai_task", lambda *_args, **_kwargs: decision)
    monkeypatch.setattr("app.services.ai_gateway.generate_price_insight", fake_local)
    monkeypatch.setattr("app.services.ai_gateway.generate_cloud_price_insight", fake_cloud)

    with pytest.raises(RoutedPermanentAIServiceError, match="invalid local output") as raised:
        await generate_routed_price_insight(SimpleNamespace(), [])

    assert cloud_called is False
    assert raised.value.decision is decision
    assert len(raised.value.attempts) == 1
    assert raised.value.attempts[0].status == "permanent_failure"
    assert raised.value.attempts[0].error_type == "AIServiceError"


@pytest.mark.asyncio
async def test_gateway_retains_all_attempts_when_transient_chain_is_exhausted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    decision = _decision(
        _descriptor(AIProvider.OLLAMA, "qwen3:8b"),
        _descriptor(AIProvider.CLOUD, "gpt-test"),
    )

    async def fake_local(*_: Any, **__: Any) -> GeneratedInsight:
        raise TransientAIServiceError("local unavailable")

    async def fake_cloud(*_: Any, **__: Any) -> GeneratedInsight:
        raise TransientAIServiceError("cloud unavailable")

    monkeypatch.setattr("app.services.ai_gateway.route_ai_task", lambda *_args, **_kwargs: decision)
    monkeypatch.setattr("app.services.ai_gateway.generate_price_insight", fake_local)
    monkeypatch.setattr("app.services.ai_gateway.generate_cloud_price_insight", fake_cloud)

    with pytest.raises(RoutedTransientAIServiceError, match="cloud unavailable") as raised:
        await generate_routed_price_insight(SimpleNamespace(), [])

    assert raised.value.decision is decision
    assert [attempt.provider for attempt in raised.value.attempts] == [
        AIProvider.OLLAMA,
        AIProvider.CLOUD,
    ]
    assert all(attempt.status == "retryable_failure" for attempt in raised.value.attempts)


@pytest.mark.asyncio
async def test_gateway_rejects_route_without_synchronous_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    decision = _decision(
        _descriptor(
            AIProvider.MANUS,
            "manus-1.6",
            mode=AIExecutionMode.ASYNCHRONOUS,
        )
    )
    monkeypatch.setattr("app.services.ai_gateway.route_ai_task", lambda *_args, **_kwargs: decision)

    with pytest.raises(RoutedPermanentAIServiceError, match="No synchronous provider") as raised:
        await generate_routed_price_insight(SimpleNamespace(), [])

    assert raised.value.decision is decision
    assert raised.value.attempts == ()
