import hashlib
import json
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, cast

from sqlalchemy import Select, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.commerce import (
    AlertEvent,
    AlertRule,
    ImportBatch,
    Product,
    ProductObservation,
)
from app.models.source import Source
from app.models.user import User
from app.schemas.commerce import ObservationResponse, ProductImportItem, ProductListItem


def stable_hash(payload: dict[str, Any]) -> str:
    """Return a deterministic SHA-256 digest for structured evidence."""
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _as_utc(value: datetime) -> datetime:
    """Normalize timezone-aware and SQLite-returned naive UTC values."""
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _observation_key(*, source_id: uuid.UUID, item: ProductImportItem, evidence_hash: str) -> str:
    payload = {
        "source_id": str(source_id),
        "external_id": item.external_id,
        "observed_at": item.observed_at.astimezone(UTC).isoformat(),
        "price": str(item.price),
        "currency": item.currency,
        "availability": item.availability,
        "evidence_hash": evidence_hash,
    }
    return stable_hash(payload)


def _evidence_payload(
    *, item: ProductImportItem, collector: str, filename: str | None
) -> dict[str, Any]:
    supplied = dict(item.evidence)
    supplied["provenance"] = {
        "kind": "operator_import",
        "collector": collector,
        "filename": filename,
        "observed_at": item.observed_at.astimezone(UTC).isoformat(),
    }
    supplied["fact_class"] = "public_observation"
    return supplied


async def _upsert_product(db: AsyncSession, source: Source, item: ProductImportItem) -> Product:
    statement = select(Product).where(
        Product.source_id == source.id,
        Product.external_id == item.external_id,
    )
    product = await db.scalar(statement)
    if product is None:
        product = Product(
            source_id=source.id,
            external_id=item.external_id,
            name=item.name,
            canonical_url=str(item.canonical_url),
            brand=item.brand,
            category=item.category,
            currency=item.currency,
            image_url=str(item.image_url) if item.image_url else None,
            attributes=item.attributes,
            first_seen_at=item.observed_at,
            last_seen_at=item.observed_at,
        )
        db.add(product)
        await db.flush()
        return product

    product.name = item.name
    product.canonical_url = str(item.canonical_url)
    product.brand = item.brand
    product.category = item.category
    product.currency = item.currency
    product.image_url = str(item.image_url) if item.image_url else None
    product.attributes = item.attributes
    product.is_active = True
    if _as_utc(item.observed_at) > _as_utc(product.last_seen_at):
        product.last_seen_at = item.observed_at
    await db.flush()
    return product


async def _previous_observation(
    db: AsyncSession,
    *,
    product_id: uuid.UUID,
    current_observation_id: uuid.UUID | None = None,
) -> ProductObservation | None:
    statement: Select[tuple[ProductObservation]] = select(ProductObservation).where(
        ProductObservation.product_id == product_id
    )
    if current_observation_id is not None:
        statement = statement.where(ProductObservation.id != current_observation_id)
    statement = statement.order_by(
        ProductObservation.observed_at.desc(), ProductObservation.created_at.desc()
    ).limit(1)
    return cast(ProductObservation | None, await db.scalar(statement))


async def evaluate_alerts(
    db: AsyncSession,
    *,
    product: Product,
    observation: ProductObservation,
) -> list[AlertEvent]:
    """Evaluate deterministic active rules and persist idempotent alert events."""
    rules_statement = select(AlertRule).where(
        AlertRule.is_active.is_(True),
        or_(AlertRule.source_id.is_(None), AlertRule.source_id == product.source_id),
        or_(AlertRule.product_id.is_(None), AlertRule.product_id == product.id),
    )
    rules = list((await db.scalars(rules_statement)).all())
    if not rules:
        return []

    previous = await _previous_observation(
        db, product_id=product.id, current_observation_id=observation.id
    )
    created: list[AlertEvent] = []
    for rule in rules:
        triggered = False
        payload: dict[str, Any] = {
            "current_price": str(observation.price),
            "currency": observation.currency,
            "availability": observation.availability,
        }
        message = ""

        if rule.rule_type == "price_below" and rule.threshold is not None:
            triggered = observation.price <= rule.threshold
            message = (
                f"{product.name} is {observation.currency} {observation.price}, "
                f"at or below {rule.threshold}."
            )
        elif rule.rule_type == "price_drop_percent" and rule.threshold is not None:
            if previous is not None and previous.price > 0:
                drop_percent = ((previous.price - observation.price) / previous.price) * 100
                payload["previous_price"] = str(previous.price)
                payload["drop_percent"] = str(drop_percent.quantize(Decimal("0.01")))
                triggered = drop_percent >= rule.threshold
                message = (
                    f"{product.name} dropped {drop_percent.quantize(Decimal('0.01'))}% "
                    f"from {previous.price} to {observation.price} {observation.currency}."
                )
        elif rule.rule_type == "out_of_stock":
            triggered = observation.availability == "out_of_stock"
            message = f"{product.name} is out of stock."

        if not triggered:
            continue

        existing_statement = select(AlertEvent.id).where(
            AlertEvent.rule_id == rule.id,
            AlertEvent.observation_id == observation.id,
        )
        if await db.scalar(existing_statement) is not None:
            continue

        event = AlertEvent(
            rule_id=rule.id,
            product_id=product.id,
            observation_id=observation.id,
            message=message,
            payload=payload,
        )
        db.add(event)
        rule.last_triggered_at = observation.observed_at
        created.append(event)

    if created:
        await db.flush()
    return created


async def import_products(
    db: AsyncSession,
    *,
    source: Source,
    user: User | None,
    items: list[ProductImportItem],
    filename: str | None,
    collector: str,
    rows_received: int | None = None,
    row_errors: list[dict[str, Any]] | None = None,
) -> ImportBatch:
    """Upsert products and append immutable observations in one audited transaction."""
    errors = list(row_errors or [])
    batch = ImportBatch(
        source_id=source.id,
        uploaded_by_id=user.id if user is not None else None,
        filename=filename,
        status="processing",
        rows_received=rows_received if rows_received is not None else len(items),
        rows_rejected=len(errors),
        errors=errors,
    )
    db.add(batch)
    await db.flush()

    accepted = 0
    for item in items:
        product = await _upsert_product(db, source, item)
        evidence = _evidence_payload(item=item, collector=collector, filename=filename)
        evidence_hash = stable_hash(evidence)
        idempotency_key = _observation_key(
            source_id=source.id,
            item=item,
            evidence_hash=evidence_hash,
        )
        existing_statement = select(ProductObservation).where(
            ProductObservation.idempotency_key == idempotency_key
        )
        observation = await db.scalar(existing_statement)
        if observation is None:
            observation = ProductObservation(
                product_id=product.id,
                import_batch_id=batch.id,
                observed_at=item.observed_at,
                price=item.price,
                original_price=item.original_price,
                currency=item.currency,
                availability=item.availability,
                seller_name=item.seller_name,
                rating=item.rating,
                review_count=item.review_count,
                source_url=str(item.canonical_url),
                collector=collector,
                evidence=evidence,
                evidence_hash=evidence_hash,
                idempotency_key=idempotency_key,
            )
            db.add(observation)
            await db.flush()
            await evaluate_alerts(db, product=product, observation=observation)
        accepted += 1

    batch.status = "completed" if not errors else "completed_with_errors"
    batch.rows_accepted = accepted
    batch.rows_rejected = len(errors)
    batch.completed_at = datetime.now(UTC)
    await db.flush()
    return batch


async def latest_observations(
    db: AsyncSession, product_id: uuid.UUID, *, limit: int = 2
) -> list[ProductObservation]:
    statement = (
        select(ProductObservation)
        .where(ProductObservation.product_id == product_id)
        .order_by(ProductObservation.observed_at.desc(), ProductObservation.created_at.desc())
        .limit(limit)
    )
    return list((await db.scalars(statement)).all())


def product_list_item(
    product: Product,
    source_name: str,
    observations: list[ProductObservation],
) -> ProductListItem:
    latest = observations[0] if observations else None
    previous_price = observations[1].price if len(observations) > 1 else None
    change: Decimal | None = None
    if latest is not None and previous_price is not None and previous_price > 0:
        change = ((latest.price - previous_price) / previous_price * 100).quantize(Decimal("0.01"))

    return ProductListItem(
        id=product.id,
        source_id=product.source_id,
        source_name=source_name,
        external_id=product.external_id,
        name=product.name,
        canonical_url=product.canonical_url,
        brand=product.brand,
        category=product.category,
        currency=product.currency,
        image_url=product.image_url,
        is_active=product.is_active,
        last_seen_at=product.last_seen_at,
        latest_observation=(
            ObservationResponse.model_validate(latest) if latest is not None else None
        ),
        previous_price=previous_price,
        price_change_percent=change,
    )
