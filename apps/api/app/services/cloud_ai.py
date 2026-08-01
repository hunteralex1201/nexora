from __future__ import annotations

import json
from typing import Any

import httpx
from pydantic import ValidationError

from app.config import Settings, settings
from app.models.commerce import Product, ProductObservation
from app.services.ai import (
    PROMPT_VERSION,
    AIServiceError,
    GeneratedInsight,
    StructuredInsight,
    TransientAIServiceError,
    build_price_facts,
)
from app.services.ai_routing import enforce_prompt_budget

_CLOUD_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "recommended_action": {
            "type": "string",
            "enum": [
                "monitor",
                "review_price",
                "check_availability",
                "investigate_source",
            ],
        },
        "confidence": {"type": "number"},
        "rationale": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["summary", "recommended_action", "confidence", "rationale"],
    "additionalProperties": False,
}

_SYSTEM_PROMPT = (
    "You are NEXORA's evidence-grounded commerce analyst. "
    "Use only the JSON facts supplied by the user. Never invent competitors, causes, demand, "
    "market share, forecasts, or missing values. Explicitly say when one observation is "
    "insufficient for a trend. Keep the summary concise and make the recommended action "
    "proportional to the evidence. Return only the requested JSON object."
)


def _cloud_key(config: Settings) -> str:
    if not config.CLOUD_LLM_ENABLED or config.CLOUD_LLM_API_KEY is None:
        raise AIServiceError("Cloud model provider is disabled")
    key = config.CLOUD_LLM_API_KEY.get_secret_value()
    if not key:
        raise AIServiceError("Cloud model provider is not configured")
    return key


def _extract_content(payload: dict[str, Any]) -> str | dict[str, Any]:
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise AIServiceError("Cloud model returned an invalid response envelope") from exc
    if not isinstance(content, str | dict):
        raise AIServiceError("Cloud model returned an invalid structured insight")
    return content


async def generate_cloud_price_insight(
    product: Product,
    observations: list[ProductObservation],
    *,
    model: str,
    config: Settings | None = None,
) -> GeneratedInsight:
    """Generate a structured price insight through an allowlisted cloud model."""
    active = config or settings
    if model not in active.cloud_llm_allowed_models:
        raise AIServiceError("Cloud model is not allowlisted")
    api_key = _cloud_key(active)
    facts = build_price_facts(product, observations)
    user_content = json.dumps(facts, sort_keys=True, separators=(",", ":"))
    enforce_prompt_budget(_SYSTEM_PROMPT + user_content, active)

    request = {
        "model": model,
        "temperature": 0.1,
        "max_tokens": 400,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "nexora_price_insight",
                "strict": True,
                "schema": _CLOUD_OUTPUT_SCHEMA,
            },
        },
    }

    try:
        async with httpx.AsyncClient(
            base_url=active.CLOUD_LLM_BASE_URL.rstrip("/"),
            timeout=active.CLOUD_LLM_TIMEOUT_SECONDS,
        ) as client:
            response = await client.post(
                "/chat/completions",
                json=request,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
    except (httpx.TimeoutException, httpx.NetworkError) as exc:
        raise TransientAIServiceError("Cloud model provider is unavailable or timed out") from exc

    if response.status_code >= 500 or response.status_code in {408, 409, 429}:
        raise TransientAIServiceError(
            f"Cloud model provider returned retryable status {response.status_code}"
        )
    if response.status_code != 200:
        raise AIServiceError(f"Cloud model provider returned status {response.status_code}")

    try:
        outer = response.json()
        content = _extract_content(outer)
        parsed = json.loads(content) if isinstance(content, str) else content
        output = StructuredInsight.model_validate(parsed)
    except (TypeError, ValueError, json.JSONDecodeError, ValidationError) as exc:
        raise AIServiceError("Cloud model returned an invalid structured insight") from exc

    return GeneratedInsight(
        output=output,
        facts=facts,
        model=model,
        prompt_version=PROMPT_VERSION,
    )
