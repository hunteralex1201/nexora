from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter

from app.config import Settings, settings
from app.models.commerce import Product, ProductObservation
from app.services.ai import (
    AIServiceError,
    GeneratedInsight,
    TransientAIServiceError,
    generate_price_insight,
)
from app.services.ai_routing import (
    AIDataClass,
    AIExecutionMode,
    AIProvider,
    AITaskClass,
    RoutingDecision,
    route_ai_task,
)
from app.services.cloud_ai import generate_cloud_price_insight


@dataclass(frozen=True)
class ProviderAttempt:
    sequence: int
    provider: AIProvider
    model: str
    status: str
    error_type: str | None = None
    latency_ms: int | None = None

    def audit_dict(self) -> dict[str, str | int | None]:
        return {
            "sequence": self.sequence,
            "provider": self.provider.value,
            "model": self.model,
            "status": self.status,
            "error_type": self.error_type,
            "latency_ms": self.latency_ms,
        }


@dataclass(frozen=True)
class RoutedInsight:
    generated: GeneratedInsight
    decision: RoutingDecision
    attempts: tuple[ProviderAttempt, ...]


class RoutedTransientAIServiceError(TransientAIServiceError):
    """Retryable routed failure retaining safe policy and provider-attempt metadata."""

    def __init__(
        self,
        message: str,
        *,
        decision: RoutingDecision,
        attempts: tuple[ProviderAttempt, ...],
    ) -> None:
        super().__init__(message)
        self.decision = decision
        self.attempts = attempts


class RoutedPermanentAIServiceError(AIServiceError):
    """Permanent routed failure retaining safe policy and provider-attempt metadata."""

    def __init__(
        self,
        message: str,
        *,
        decision: RoutingDecision,
        attempts: tuple[ProviderAttempt, ...],
    ) -> None:
        super().__init__(message)
        self.decision = decision
        self.attempts = attempts


def _elapsed_ms(started: float) -> int:
    return max(0, round((perf_counter() - started) * 1000))


async def generate_routed_price_insight(
    product: Product,
    observations: list[ProductObservation],
    *,
    data_class: AIDataClass = AIDataClass.INTERNAL,
    requested_provider: AIProvider | None = None,
    requested_model: str | None = None,
    config: Settings | None = None,
) -> RoutedInsight:
    """Generate a price insight through the policy-selected synchronous provider chain."""
    active = config or settings
    decision = route_ai_task(
        AITaskClass.PRICE_INTELLIGENCE,
        data_class,
        requested_provider=requested_provider,
        requested_model=requested_model,
        config=active,
    )
    attempts: list[ProviderAttempt] = []
    last_transient: TransientAIServiceError | None = None

    for sequence, candidate in enumerate(decision.candidates, start=1):
        if candidate.execution_mode is not AIExecutionMode.SYNCHRONOUS:
            continue
        started = perf_counter()
        try:
            if candidate.provider is AIProvider.OLLAMA:
                generated = await generate_price_insight(product, observations)
            elif candidate.provider is AIProvider.CLOUD:
                generated = await generate_cloud_price_insight(
                    product,
                    observations,
                    model=candidate.model,
                    config=active,
                )
            else:
                continue
        except TransientAIServiceError as exc:
            attempts.append(
                ProviderAttempt(
                    sequence=sequence,
                    provider=candidate.provider,
                    model=candidate.model,
                    status="retryable_failure",
                    error_type=type(exc).__name__,
                    latency_ms=_elapsed_ms(started),
                )
            )
            last_transient = exc
            continue
        except AIServiceError as exc:
            attempts.append(
                ProviderAttempt(
                    sequence=sequence,
                    provider=candidate.provider,
                    model=candidate.model,
                    status="permanent_failure",
                    error_type=type(exc).__name__,
                    latency_ms=_elapsed_ms(started),
                )
            )
            raise RoutedPermanentAIServiceError(
                str(exc), decision=decision, attempts=tuple(attempts)
            ) from exc

        attempts.append(
            ProviderAttempt(
                sequence=sequence,
                provider=candidate.provider,
                model=candidate.model,
                status="succeeded",
                latency_ms=_elapsed_ms(started),
            )
        )
        return RoutedInsight(
            generated=generated,
            decision=decision,
            attempts=tuple(attempts),
        )

    if last_transient is not None:
        raise RoutedTransientAIServiceError(
            str(last_transient),
            decision=decision,
            attempts=tuple(attempts),
        ) from last_transient
    raise RoutedPermanentAIServiceError(
        "No synchronous provider was available for price intelligence",
        decision=decision,
        attempts=tuple(attempts),
    )
