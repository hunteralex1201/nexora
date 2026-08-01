from __future__ import annotations

import hashlib
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.ai import AIExecution, AIProviderAttempt
from app.models.commerce import AIInsight, Product, ProductObservation
from app.models.source import CrawlJob, Source
from app.services.ai import PROMPT_VERSION, AIServiceError
from app.services.ai_gateway import (
    ProviderAttempt,
    RoutedPermanentAIServiceError,
    RoutedTransientAIServiceError,
    generate_routed_price_insight,
)
from app.services.ai_routing import (
    AIDataClass,
    AIProvider,
    AIRoutingError,
    AITaskClass,
    RoutingDecision,
    route_ai_task,
)


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _parse_route(job: CrawlJob) -> tuple[AIDataClass, AIProvider | None, str | None]:
    try:
        data_class = AIDataClass(str(job.payload.get("data_class", AIDataClass.INTERNAL.value)))
    except ValueError as exc:
        raise AIServiceError("Invalid AI data classification") from exc

    provider_value = job.payload.get("requested_provider")
    requested_provider: AIProvider | None = None
    if provider_value is not None:
        try:
            requested_provider = AIProvider(str(provider_value))
        except ValueError as exc:
            raise AIServiceError("Invalid AI provider hint") from exc
    requested_model_value = job.payload.get("requested_model")
    requested_model = str(requested_model_value) if requested_model_value is not None else None
    return data_class, requested_provider, requested_model


def _insight_idempotency_key(
    product: Product,
    observation: ProductObservation,
    decision: RoutingDecision,
) -> str:
    material = (
        f"{product.id}:{observation.evidence_hash}:{AITaskClass.PRICE_INTELLIGENCE.value}:"
        f"{decision.selected.identifier}:{decision.policy_version}:{PROMPT_VERSION}"
    )
    return f"ai:{uuid.uuid5(uuid.NAMESPACE_URL, material).hex}"


def _execution_idempotency_key(
    job: CrawlJob,
    product: Product,
    observation: ProductObservation,
) -> str:
    material = f"{job.id}:{job.attempt}:{product.id}:{observation.evidence_hash}"
    return f"ai-run:{uuid.uuid5(uuid.NAMESPACE_URL, material).hex}"


async def _start_execution(
    *,
    job: CrawlJob,
    product: Product,
    observation: ProductObservation,
    decision: RoutingDecision,
    data_class: AIDataClass,
    requested_provider: AIProvider | None,
    requested_model: str | None,
) -> uuid.UUID:
    idempotency_key = _execution_idempotency_key(job, product, observation)
    fingerprint_material = f"{product.id}:{observation.evidence_hash}:{PROMPT_VERSION}"
    execution = AIExecution(
        crawl_job_id=job.id,
        requested_by_id=job.requested_by_id,
        correlation_id=str(job.id),
        idempotency_key=idempotency_key,
        task_class=AITaskClass.PRICE_INTELLIGENCE.value,
        data_class=data_class.value,
        execution_mode=decision.selected.execution_mode.value,
        status="running",
        policy_version=decision.policy_version,
        requested_provider=requested_provider.value if requested_provider else None,
        requested_model=requested_model,
        selected_provider=decision.selected.provider.value,
        selected_model=decision.selected.model,
        input_fingerprint=hashlib.sha256(fingerprint_material.encode()).hexdigest(),
        routing=decision.audit_dict(),
        budget={"max_prompt_bytes": settings.AI_MAX_PROMPT_BYTES},
        result={},
        requires_human_approval=False,
        started_at=_utc_now(),
    )
    try:
        async with AsyncSessionLocal() as db, db.begin():
            db.add(execution)
            await db.flush()
            execution_id = execution.id
    except IntegrityError:
        async with AsyncSessionLocal() as db:
            existing = await db.scalar(
                select(AIExecution).where(AIExecution.idempotency_key == idempotency_key)
            )
            if existing is None:
                raise
            execution_id = existing.id
    return execution_id


def _attempt_row(execution_id: uuid.UUID, attempt: ProviderAttempt) -> AIProviderAttempt:
    return AIProviderAttempt(
        ai_execution_id=execution_id,
        sequence=attempt.sequence,
        provider=attempt.provider.value,
        model=attempt.model,
        status=attempt.status,
        latency_ms=attempt.latency_ms,
        error_type=attempt.error_type,
        completed_at=_utc_now(),
    )


async def _persist_routed_failure(
    *,
    execution_id: uuid.UUID,
    exc: RoutedTransientAIServiceError | RoutedPermanentAIServiceError,
) -> None:
    async with AsyncSessionLocal() as db, db.begin():
        execution = await db.get(AIExecution, execution_id)
        if execution is None:
            return
        execution.status = (
            "retryable_failure" if isinstance(exc, RoutedTransientAIServiceError) else "failed"
        )
        execution.error_type = type(exc).__name__
        execution.error_message = str(exc)[:2000]
        execution.completed_at = _utc_now()
        for attempt in exc.attempts:
            db.add(_attempt_row(execution_id, attempt))


async def _persist_success(
    *,
    execution_id: uuid.UUID,
    job: CrawlJob,
    product: Product,
    observations: list[ProductObservation],
    idempotency_key: str,
    routed: Any,
) -> tuple[bool, str, str]:
    generated = routed.generated
    output = generated.output
    successful_attempt = next(
        (attempt for attempt in routed.attempts if attempt.status == "succeeded"),
        routed.attempts[-1],
    )
    insight = AIInsight(
        product_id=product.id,
        observation_id=observations[0].id,
        crawl_job_id=job.id,
        ai_execution_id=execution_id,
        kind=AITaskClass.PRICE_INTELLIGENCE.value,
        model=generated.model,
        prompt_version=generated.prompt_version,
        content=output.summary,
        confidence=Decimal(str(output.confidence)),
        evidence={
            "facts": generated.facts,
            "recommended_action": output.recommended_action,
            "rationale": output.rationale,
            "observation_ids": [str(item.id) for item in observations],
        },
        idempotency_key=idempotency_key,
    )
    try:
        async with AsyncSessionLocal() as db, db.begin():
            execution = await db.get(AIExecution, execution_id)
            if execution is None:
                raise RuntimeError("AI execution disappeared before result persistence")
            for attempt in routed.attempts:
                db.add(_attempt_row(execution_id, attempt))
            db.add(insight)
            await db.flush()
            execution.status = "succeeded"
            execution.selected_provider = successful_attempt.provider.value
            execution.selected_model = successful_attempt.model
            execution.result = {"insight_id": str(insight.id)}
            execution.completed_at = _utc_now()
    except IntegrityError:
        async with AsyncSessionLocal() as db, db.begin():
            execution = await db.get(AIExecution, execution_id)
            if execution is not None:
                execution.status = "deduplicated"
                execution.result = {"insight_idempotency_key": idempotency_key}
                execution.completed_at = _utc_now()
        return False, successful_attempt.provider.value, successful_attempt.model
    return True, successful_attempt.provider.value, successful_attempt.model


async def analyze_price_job(job: CrawlJob, source: Source) -> dict[str, Any]:
    """Generate evidence-grounded insights through the server-authoritative route policy."""
    max_products = max(1, min(int(job.payload.get("max_products", 20)), 100))
    data_class, requested_provider, requested_model = _parse_route(job)
    try:
        decision = route_ai_task(
            AITaskClass.PRICE_INTELLIGENCE,
            data_class,
            requested_provider=requested_provider,
            requested_model=requested_model,
        )
    except AIRoutingError as exc:
        raise AIServiceError(str(exc)) from exc

    async with AsyncSessionLocal() as db:
        product_ids = list(
            (
                await db.scalars(
                    select(Product.id)
                    .where(Product.source_id == source.id, Product.is_active.is_(True))
                    .order_by(Product.last_seen_at.desc(), Product.id.asc())
                    .limit(max_products)
                )
            ).all()
        )

    generated_count = 0
    skipped_count = 0
    observation_count = 0
    provider_counts: dict[str, int] = {}
    models: set[str] = set()
    total_provider_attempts = 0

    for product_id in product_ids:
        async with AsyncSessionLocal() as db:
            product = await db.get(Product, product_id)
            observations = list(
                (
                    await db.scalars(
                        select(ProductObservation)
                        .where(ProductObservation.product_id == product_id)
                        .order_by(ProductObservation.observed_at.desc())
                        .limit(3)
                    )
                ).all()
            )
            if product is None or not observations:
                skipped_count += 1
                continue
            insight_idempotency_key = _insight_idempotency_key(product, observations[0], decision)
            existing = await db.scalar(
                select(AIInsight.id).where(AIInsight.idempotency_key == insight_idempotency_key)
            )
            if existing is not None:
                skipped_count += 1
                continue
            db.expunge(product)
            for observation in observations:
                db.expunge(observation)

        execution_id = await _start_execution(
            job=job,
            product=product,
            observation=observations[0],
            decision=decision,
            data_class=data_class,
            requested_provider=requested_provider,
            requested_model=requested_model,
        )
        try:
            routed = await generate_routed_price_insight(
                product,
                observations,
                data_class=data_class,
                requested_provider=requested_provider,
                requested_model=requested_model,
            )
        except (RoutedTransientAIServiceError, RoutedPermanentAIServiceError) as exc:
            await _persist_routed_failure(execution_id=execution_id, exc=exc)
            raise

        persisted, provider, model = await _persist_success(
            execution_id=execution_id,
            job=job,
            product=product,
            observations=observations,
            idempotency_key=insight_idempotency_key,
            routed=routed,
        )
        total_provider_attempts += len(routed.attempts)
        provider_counts[provider] = provider_counts.get(provider, 0) + 1
        models.add(model)
        if not persisted:
            skipped_count += 1
            continue
        generated_count += 1
        observation_count += len(observations)

    return {
        "products_considered": len(product_ids),
        "insights_generated": generated_count,
        "insights_skipped": skipped_count,
        "evidence_observations": observation_count,
        "model": sorted(models)[0] if len(models) == 1 else decision.selected.model,
        "models": sorted(models),
        "providers": provider_counts,
        "provider_attempts": total_provider_attempts,
        "policy_version": decision.policy_version,
        "route_hint_applied": decision.route_hint_applied,
        "data_class": data_class.value,
        "prompt_version": PROMPT_VERSION,
    }
