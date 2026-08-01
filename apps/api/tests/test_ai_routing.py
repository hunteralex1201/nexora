from __future__ import annotations

import pytest
from pydantic import SecretStr

from app.config import Settings
from app.services.ai_routing import (
    AIDataClass,
    AIProvider,
    AIRoutingError,
    AITaskClass,
    build_model_registry,
    enforce_prompt_budget,
    route_ai_task,
)


def _settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "ENVIRONMENT": "test",
        "DATABASE_URL": "sqlite+aiosqlite:///./test.db",
        "AI_POLICY_VERSION": "test-policy-v1",
    }
    values.update(overrides)
    return Settings(**values)


def test_private_ollama_is_default_for_price_intelligence() -> None:
    decision = route_ai_task(
        AITaskClass.PRICE_INTELLIGENCE,
        AIDataClass.INTERNAL,
        config=_settings(),
    )

    assert decision.selected.provider is AIProvider.OLLAMA
    assert decision.selected.model == "qwen3:8b"
    assert decision.policy_version == "test-policy-v1"
    assert decision.route_hint_applied is False


def test_restricted_data_never_routes_to_external_providers() -> None:
    config = _settings(
        CLOUD_LLM_ENABLED=True,
        CLOUD_LLM_API_KEY=SecretStr("cloud-secret"),
        CLOUD_LLM_ALLOWED_MODELS="model-a",
        CLOUD_LLM_DEFAULT_MODEL="model-a",
    )

    price = route_ai_task(
        AITaskClass.PRICE_INTELLIGENCE,
        AIDataClass.RESTRICTED,
        config=config,
    )
    assert [item.provider for item in price.candidates] == [AIProvider.OLLAMA]

    with pytest.raises(AIRoutingError, match="No configured model is eligible"):
        route_ai_task(
            AITaskClass.STRATEGIC_RESEARCH,
            AIDataClass.RESTRICTED,
            config=config,
        )


def test_route_hints_are_ignored_until_server_policy_enables_them() -> None:
    base = {
        "CLOUD_LLM_ENABLED": True,
        "CLOUD_LLM_API_KEY": SecretStr("cloud-secret"),
        "CLOUD_LLM_ALLOWED_MODELS": "model-a,model-b",
        "CLOUD_LLM_DEFAULT_MODEL": "model-a",
    }
    ignored = route_ai_task(
        AITaskClass.SUMMARIZATION,
        AIDataClass.INTERNAL,
        requested_provider=AIProvider.CLOUD,
        requested_model="model-b",
        config=_settings(**base),
    )
    assert ignored.selected.provider is AIProvider.OLLAMA
    assert ignored.route_hint_applied is False

    applied = route_ai_task(
        AITaskClass.SUMMARIZATION,
        AIDataClass.INTERNAL,
        requested_provider=AIProvider.CLOUD,
        requested_model="model-b",
        config=_settings(AI_ALLOW_ROUTE_HINTS=True, **base),
    )
    assert applied.selected.provider is AIProvider.CLOUD
    assert applied.selected.model == "model-b"
    assert applied.route_hint_applied is True


def test_unallowlisted_model_hint_is_rejected() -> None:
    config = _settings(
        AI_ALLOW_ROUTE_HINTS=True,
        CLOUD_LLM_ENABLED=True,
        CLOUD_LLM_API_KEY=SecretStr("cloud-secret"),
        CLOUD_LLM_ALLOWED_MODELS="model-a",
        CLOUD_LLM_DEFAULT_MODEL="model-a",
    )
    with pytest.raises(AIRoutingError, match="not allowlisted and eligible"):
        route_ai_task(
            AITaskClass.SUMMARIZATION,
            AIDataClass.INTERNAL,
            requested_provider=AIProvider.CLOUD,
            requested_model="model-x",
            config=config,
        )


def test_public_registry_contains_no_credentials_or_provider_urls() -> None:
    config = _settings(
        CLOUD_LLM_ENABLED=True,
        CLOUD_LLM_API_KEY=SecretStr("never-return-this"),
        CLOUD_LLM_ALLOWED_MODELS="model-a",
        CLOUD_LLM_DEFAULT_MODEL="model-a",
    )
    serialized = [item.public_dict() for item in build_model_registry(config)]
    text = repr(serialized)

    assert "never-return-this" not in text
    assert "api.openai.com" not in text
    assert any(item["identifier"] == "cloud/model-a" for item in serialized)


def test_prompt_budget_is_enforced_in_utf8_bytes() -> None:
    config = _settings(AI_MAX_PROMPT_BYTES=1024)
    enforce_prompt_budget("a" * 1024, config)
    with pytest.raises(AIRoutingError, match="byte budget"):
        enforce_prompt_budget("é" * 1024, config)
