import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import httpx
from pydantic import BaseModel, Field, ValidationError

from app.config import settings
from app.models.commerce import Product, ProductObservation
from app.schemas.commerce import AIChatRequest

PROMPT_VERSION = "price-intelligence-v1"


class AIServiceError(RuntimeError):
    """Permanent local-model or response-contract failure."""


class TransientAIServiceError(AIServiceError):
    """Retryable local-model availability or timeout failure."""


CHAT_SYSTEM_PROMPT = """You are NEXORA AI, a clear and practical assistant.
Answer in the same language as the user's latest message unless they ask for another language.
Be concise by default, use plain language, and give actionable steps when useful.
Do not pretend to have live data, browser access, or private business context that was not provided.
When uncertain, say what is uncertain instead of inventing facts.
"""


class StructuredInsight(BaseModel):
    summary: str = Field(min_length=1, max_length=1200)
    recommended_action: str = Field(
        pattern="^(monitor|review_price|check_availability|investigate_source)$"
    )
    confidence: float = Field(ge=0, le=1)
    rationale: list[str] = Field(min_length=1, max_length=5)


@dataclass(frozen=True)
class GeneratedInsight:
    output: StructuredInsight
    facts: dict[str, Any]
    model: str
    prompt_version: str = PROMPT_VERSION


def _money(value: Decimal | None) -> str | None:
    return format(value, ".2f") if value is not None else None


def build_price_facts(
    product: Product,
    observations: list[ProductObservation],
) -> dict[str, Any]:
    """Build the only facts the model may reference, newest observation first."""
    if not observations:
        raise AIServiceError("At least one observation is required for AI analysis")

    latest = observations[0]
    previous = observations[1] if len(observations) > 1 else None
    absolute_change: Decimal | None = None
    percent_change: Decimal | None = None
    if previous is not None:
        absolute_change = latest.price - previous.price
        if previous.price != 0:
            percent_change = (absolute_change / previous.price) * Decimal("100")

    return {
        "product": {
            "id": str(product.id),
            "external_id": product.external_id,
            "name": product.name,
            "brand": product.brand,
            "category": product.category,
            "currency": product.currency,
            "canonical_url": product.canonical_url,
        },
        "latest": {
            "observation_id": str(latest.id),
            "observed_at": latest.observed_at.isoformat(),
            "price": _money(latest.price),
            "original_price": _money(latest.original_price),
            "availability": latest.availability,
            "seller_name": latest.seller_name,
            "rating": _money(latest.rating),
            "review_count": latest.review_count,
            "source_url": latest.source_url,
            "evidence_hash": latest.evidence_hash,
        },
        "previous": (
            {
                "observation_id": str(previous.id),
                "observed_at": previous.observed_at.isoformat(),
                "price": _money(previous.price),
                "availability": previous.availability,
                "evidence_hash": previous.evidence_hash,
            }
            if previous is not None
            else None
        ),
        "computed": {
            "absolute_price_change": _money(absolute_change),
            "percent_price_change": _money(percent_change),
            "history_points_supplied": len(observations),
        },
    }


_OUTPUT_SCHEMA: dict[str, Any] = {
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
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "rationale": {
            "type": "array",
            "minItems": 1,
            "maxItems": 5,
            "items": {"type": "string"},
        },
    },
    "required": ["summary", "recommended_action", "confidence", "rationale"],
    "additionalProperties": False,
}


async def stream_chat_completion(request: AIChatRequest) -> AsyncIterator[dict[str, Any]]:
    """Stream one private, non-persisted conversation from the configured Ollama model."""
    payload = {
        "model": settings.OLLAMA_CHAT_MODEL,
        "messages": [
            {"role": "system", "content": CHAT_SYSTEM_PROMPT},
            *[message.model_dump() for message in request.messages],
        ],
        "stream": True,
        "think": False,
        "keep_alive": "10m",
        "options": {
            "temperature": request.temperature,
            "num_predict": request.max_tokens,
            "num_ctx": 4096,
        },
    }

    timeout = httpx.Timeout(settings.OLLAMA_TIMEOUT_SECONDS, connect=5.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST", f"{settings.OLLAMA_BASE_URL}/api/chat", json=payload
            ) as response:
                if response.status_code >= 500 or response.status_code in {408, 429}:
                    raise TransientAIServiceError(
                        f"Ollama returned retryable status {response.status_code}"
                    )
                if response.status_code != 200:
                    raise AIServiceError(f"Ollama returned status {response.status_code}")

                yield {"type": "start", "model": settings.OLLAMA_CHAT_MODEL}
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    event = json.loads(line)
                    content = event.get("message", {}).get("content")
                    if isinstance(content, str) and content:
                        yield {"type": "token", "content": content}
                    if event.get("done") is True:
                        duration = event.get("total_duration")
                        duration_ms = (
                            round(duration / 1_000_000) if isinstance(duration, int) else None
                        )
                        yield {
                            "type": "done",
                            "model": event.get("model", settings.OLLAMA_CHAT_MODEL),
                            "total_duration_ms": duration_ms,
                        }
                        return
    except (httpx.TimeoutException, httpx.NetworkError, json.JSONDecodeError) as exc:
        raise TransientAIServiceError("Local AI is temporarily unavailable") from exc

    raise TransientAIServiceError("Local AI returned an incomplete response")


async def generate_price_insight(
    product: Product,
    observations: list[ProductObservation],
) -> GeneratedInsight:
    """Generate one structured insight using only persisted product evidence."""
    facts = build_price_facts(product, observations)
    request = {
        "model": settings.OLLAMA_CHAT_MODEL,
        "stream": False,
        "think": False,
        "format": _OUTPUT_SCHEMA,
        "options": {
            "temperature": 0.1,
            "num_predict": 400,
            "num_ctx": 4096,
        },
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are NEXORA's evidence-grounded commerce analyst. "
                    "Use only the JSON facts supplied by the user. Never invent competitors, "
                    "causes, demand, market share, forecasts, or missing values. Explicitly say "
                    "when one observation is insufficient for a trend. Keep the summary concise "
                    "and make the recommended action proportional to the evidence."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(facts, sort_keys=True, separators=(",", ":")),
            },
        ],
    }

    try:
        async with httpx.AsyncClient(
            base_url=settings.OLLAMA_BASE_URL,
            timeout=settings.OLLAMA_TIMEOUT_SECONDS,
        ) as client:
            response = await client.post("/api/chat", json=request)
    except (httpx.TimeoutException, httpx.NetworkError) as exc:
        raise TransientAIServiceError("Ollama is unavailable or timed out") from exc

    if response.status_code >= 500 or response.status_code in {408, 429}:
        raise TransientAIServiceError(f"Ollama returned retryable status {response.status_code}")
    if response.status_code != 200:
        raise AIServiceError(f"Ollama returned status {response.status_code}")

    try:
        outer = response.json()
        content = outer["message"]["content"]
        parsed = json.loads(content)
        output = StructuredInsight.model_validate(parsed)
    except (KeyError, TypeError, ValueError, json.JSONDecodeError, ValidationError) as exc:
        raise AIServiceError("Ollama returned an invalid structured insight") from exc

    return GeneratedInsight(
        output=output,
        facts=facts,
        model=settings.OLLAMA_CHAT_MODEL,
    )


async def list_installed_models() -> list[str]:
    """Return installed Ollama model names for readiness and operator diagnostics."""
    try:
        async with httpx.AsyncClient(
            base_url=settings.OLLAMA_BASE_URL,
            timeout=min(settings.OLLAMA_TIMEOUT_SECONDS, 10),
        ) as client:
            response = await client.get("/api/tags")
    except (httpx.TimeoutException, httpx.NetworkError) as exc:
        raise TransientAIServiceError("Ollama model registry is unavailable") from exc
    if response.status_code != 200:
        raise TransientAIServiceError(
            f"Ollama model registry returned status {response.status_code}"
        )
    payload = response.json()
    return [str(item.get("name")) for item in payload.get("models", []) if item.get("name")]
