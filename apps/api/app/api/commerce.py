import csv
import io
import json
import uuid
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import ValidationError
from sqlalchemy import func, or_, select

from app.api.dependencies import DatabaseSession, require_roles
from app.config import settings
from app.connectors import connector_registry
from app.models.commerce import (
    AIInsight,
    AlertEvent,
    AlertRule,
    Product,
    ProductObservation,
)
from app.models.source import CrawlJob, Source
from app.models.user import User
from app.schemas.commerce import (
    AIInsightResponse,
    AIReadinessResponse,
    AlertEventResponse,
    AlertRuleCreate,
    AlertRuleResponse,
    ImportBatchResponse,
    JobCreate,
    JobResponse,
    ObservationResponse,
    OverviewResponse,
    ProductDetail,
    ProductImportItem,
    ProductImportRequest,
    ProductPage,
    SourceCreate,
    SourceResponse,
    SourceUpdate,
)
from app.services.ai import TransientAIServiceError, list_installed_models
from app.services.commerce import import_products, latest_observations, product_list_item

router = APIRouter(prefix="/commerce", tags=["commerce"])
AdminUser = Annotated[User, Depends(require_roles("admin"))]
MAX_IMPORT_BYTES = 5_000_000
MAX_IMPORT_ROWS = 5000


def _not_found(resource: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{resource} not found")


async def _source_or_404(db: DatabaseSession, source_id: uuid.UUID) -> Source:
    source = await db.get(Source, source_id)
    if source is None:
        raise _not_found("Source")
    return source


@router.get("/connectors")
async def list_connectors(_: AdminUser) -> dict[str, dict[str, object]]:
    return connector_registry()


@router.get("/sources", response_model=list[SourceResponse])
async def list_sources(
    db: DatabaseSession,
    _: AdminUser,
    active: bool | None = None,
) -> list[Source]:
    statement = select(Source).order_by(Source.name.asc())
    if active is not None:
        statement = statement.where(Source.is_active.is_(active))
    return list((await db.scalars(statement)).all())


@router.post("/sources", response_model=SourceResponse, status_code=status.HTTP_201_CREATED)
async def create_source(
    payload: SourceCreate,
    db: DatabaseSession,
    _: AdminUser,
) -> Source:
    existing = await db.scalar(
        select(Source.id).where(func.lower(Source.name) == payload.name.lower())
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Source name already exists",
        )

    source = Source(
        name=payload.name,
        type=payload.type,
        base_url=str(payload.base_url),
        config=payload.config,
        is_active=payload.is_active,
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)
    return source


@router.patch("/sources/{source_id}", response_model=SourceResponse)
async def update_source(
    source_id: uuid.UUID,
    payload: SourceUpdate,
    db: DatabaseSession,
    _: AdminUser,
) -> Source:
    source = await _source_or_404(db, source_id)
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes:
        duplicate = await db.scalar(
            select(Source.id).where(
                func.lower(Source.name) == changes["name"].lower(), Source.id != source.id
            )
        )
        if duplicate is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Source name already exists"
            )
    if "base_url" in changes:
        changes["base_url"] = str(changes["base_url"])
    for key, value in changes.items():
        setattr(source, key, value)
    await db.commit()
    await db.refresh(source)
    return source


@router.post(
    "/imports/products",
    response_model=ImportBatchResponse,
    status_code=status.HTTP_201_CREATED,
)
async def import_product_json(
    payload: ProductImportRequest,
    db: DatabaseSession,
    user: AdminUser,
) -> Any:
    source = await _source_or_404(db, payload.source_id)
    if not source.is_active:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Source is inactive")
    batch = await import_products(
        db,
        source=source,
        user=user,
        items=payload.items,
        filename=payload.filename,
        collector="api_json_import",
    )
    await db.commit()
    await db.refresh(batch)
    return batch


def _json_cell(raw: str | None, field_name: str) -> dict[str, Any]:
    if raw is None or not raw.strip():
        return {}
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError(f"{field_name} must contain a JSON object")
    return value


def _csv_item(row: dict[str, str | None]) -> ProductImportItem:
    payload: dict[str, Any] = {key: value for key, value in row.items() if value not in {None, ""}}
    payload["attributes"] = _json_cell(row.get("attributes"), "attributes")
    payload["evidence"] = _json_cell(row.get("evidence"), "evidence")
    return ProductImportItem.model_validate(payload)


@router.post(
    "/imports/products/csv",
    response_model=ImportBatchResponse,
    status_code=status.HTTP_201_CREATED,
)
async def import_product_csv(
    db: DatabaseSession,
    user: AdminUser,
    source_id: Annotated[uuid.UUID, Form()],
    file: Annotated[UploadFile, File()],
) -> Any:
    source = await _source_or_404(db, source_id)
    if not source.is_active:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Source is inactive")

    content = await file.read(MAX_IMPORT_BYTES + 1)
    if len(content) > MAX_IMPORT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="CSV file exceeds 5 MB",
        )
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="CSV file must be UTF-8 encoded",
        ) from exc

    reader = csv.DictReader(io.StringIO(decoded))
    required = {"external_id", "name", "canonical_url", "price"}
    if reader.fieldnames is None or not required.issubset(set(reader.fieldnames)):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="CSV requires external_id, name, canonical_url, and price columns",
        )

    items: list[ProductImportItem] = []
    errors: list[dict[str, Any]] = []
    rows_received = 0
    for row_number, row in enumerate(reader, start=2):
        rows_received += 1
        if rows_received > MAX_IMPORT_ROWS:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"CSV cannot contain more than {MAX_IMPORT_ROWS} data rows",
            )
        try:
            items.append(_csv_item(row))
        except (ValidationError, ValueError, json.JSONDecodeError) as exc:
            errors.append({"row": row_number, "error": str(exc)[:1000]})

    if rows_received == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="CSV contains no data rows",
        )

    batch = await import_products(
        db,
        source=source,
        user=user,
        items=items,
        filename=file.filename,
        collector="api_csv_import",
        rows_received=rows_received,
        row_errors=errors,
    )
    await db.commit()
    await db.refresh(batch)
    return batch


@router.get("/products", response_model=ProductPage)
async def list_products(
    db: DatabaseSession,
    _: AdminUser,
    source_id: uuid.UUID | None = None,
    search: str | None = Query(default=None, max_length=200),
    active: bool | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> ProductPage:
    filters: list[Any] = []
    if source_id is not None:
        filters.append(Product.source_id == source_id)
    if search:
        pattern = f"%{search.strip()}%"
        filters.append(
            or_(
                Product.name.ilike(pattern),
                Product.external_id.ilike(pattern),
                Product.brand.ilike(pattern),
                Product.category.ilike(pattern),
            )
        )
    if active is not None:
        filters.append(Product.is_active.is_(active))

    total_statement = select(func.count(Product.id))
    statement = (
        select(Product, Source.name)
        .join(Source, Source.id == Product.source_id)
        .order_by(Product.last_seen_at.desc(), Product.name.asc())
        .limit(limit)
        .offset(offset)
    )
    if filters:
        total_statement = total_statement.where(*filters)
        statement = statement.where(*filters)

    total = int((await db.scalar(total_statement)) or 0)
    rows = (await db.execute(statement)).all()
    items = []
    for product, source_name in rows:
        observations = await latest_observations(db, product.id, limit=2)
        items.append(product_list_item(product, source_name, observations))
    return ProductPage(items=items, total=total, limit=limit, offset=offset)


@router.get("/products/{product_id}", response_model=ProductDetail)
async def get_product(
    product_id: uuid.UUID,
    db: DatabaseSession,
    _: AdminUser,
) -> ProductDetail:
    row = (
        await db.execute(
            select(Product, Source.name)
            .join(Source, Source.id == Product.source_id)
            .where(Product.id == product_id)
        )
    ).one_or_none()
    if row is None:
        raise _not_found("Product")
    product, source_name = row
    history = await latest_observations(db, product.id, limit=200)
    item = product_list_item(product, source_name, history[:2])
    return ProductDetail(
        **item.model_dump(),
        attributes=product.attributes,
        first_seen_at=product.first_seen_at,
        history=[ObservationResponse.model_validate(observation) for observation in history],
    )


@router.get("/products/{product_id}/observations", response_model=list[ObservationResponse])
async def get_product_observations(
    product_id: uuid.UUID,
    db: DatabaseSession,
    _: AdminUser,
    limit: int = Query(default=200, ge=1, le=1000),
) -> list[ProductObservation]:
    if await db.get(Product, product_id) is None:
        raise _not_found("Product")
    return await latest_observations(db, product_id, limit=limit)


@router.post("/jobs", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    payload: JobCreate,
    db: DatabaseSession,
    user: AdminUser,
) -> CrawlJob:
    source = await _source_or_404(db, payload.source_id)
    if not source.is_active:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Source is inactive")
    if payload.idempotency_key:
        existing = await db.scalar(
            select(CrawlJob).where(CrawlJob.idempotency_key == payload.idempotency_key)
        )
        if existing is not None:
            return existing

    job = CrawlJob(
        source_id=payload.source_id,
        status="queued",
        job_type=payload.job_type,
        trigger=payload.trigger,
        requested_by_id=user.id,
        payload=payload.payload,
        max_attempts=payload.max_attempts,
        idempotency_key=payload.idempotency_key,
        queued_at=datetime.now(UTC),
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


@router.get("/jobs", response_model=list[JobResponse])
async def list_jobs(
    db: DatabaseSession,
    _: AdminUser,
    source_id: uuid.UUID | None = None,
    job_status: str | None = Query(default=None, alias="status", max_length=50),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[CrawlJob]:
    statement = select(CrawlJob).order_by(CrawlJob.created_at.desc()).limit(limit)
    if source_id is not None:
        statement = statement.where(CrawlJob.source_id == source_id)
    if job_status:
        statement = statement.where(CrawlJob.status == job_status)
    return list((await db.scalars(statement)).all())


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: uuid.UUID, db: DatabaseSession, _: AdminUser) -> CrawlJob:
    job = await db.get(CrawlJob, job_id)
    if job is None:
        raise _not_found("Job")
    return job


@router.post("/alerts/rules", response_model=AlertRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_alert_rule(
    payload: AlertRuleCreate,
    db: DatabaseSession,
    user: AdminUser,
) -> AlertRule:
    if payload.source_id is not None and await db.get(Source, payload.source_id) is None:
        raise _not_found("Source")
    if payload.product_id is not None:
        product = await db.get(Product, payload.product_id)
        if product is None:
            raise _not_found("Product")
        if payload.source_id is not None and product.source_id != payload.source_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Product does not belong to the selected source",
            )

    rule = AlertRule(owner_id=user.id, **payload.model_dump())
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.get("/alerts/rules", response_model=list[AlertRuleResponse])
async def list_alert_rules(db: DatabaseSession, _: AdminUser) -> list[AlertRule]:
    statement = select(AlertRule).order_by(AlertRule.created_at.desc())
    return list((await db.scalars(statement)).all())


@router.get("/alerts/events", response_model=list[AlertEventResponse])
async def list_alert_events(
    db: DatabaseSession,
    _: AdminUser,
    event_status: str | None = Query(default=None, alias="status", max_length=50),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[AlertEvent]:
    statement = select(AlertEvent).order_by(AlertEvent.triggered_at.desc()).limit(limit)
    if event_status:
        statement = statement.where(AlertEvent.status == event_status)
    return list((await db.scalars(statement)).all())


@router.post("/alerts/events/{event_id}/acknowledge", response_model=AlertEventResponse)
async def acknowledge_alert(
    event_id: uuid.UUID,
    db: DatabaseSession,
    _: AdminUser,
) -> AlertEvent:
    event = await db.get(AlertEvent, event_id)
    if event is None:
        raise _not_found("Alert event")
    if event.acknowledged_at is None:
        event.acknowledged_at = datetime.now(UTC)
        event.status = "acknowledged"
        await db.commit()
        await db.refresh(event)
    return event


@router.get("/ai/insights", response_model=list[AIInsightResponse])
async def list_ai_insights(
    db: DatabaseSession,
    _: AdminUser,
    source_id: uuid.UUID | None = None,
    product_id: uuid.UUID | None = None,
    limit: int = Query(default=100, ge=1, le=500),
) -> list[AIInsightResponse]:
    statement = (
        select(AIInsight, Product.name, Product.source_id, Source.name)
        .join(Product, Product.id == AIInsight.product_id)
        .join(Source, Source.id == Product.source_id)
        .order_by(AIInsight.generated_at.desc())
        .limit(limit)
    )
    if source_id is not None:
        statement = statement.where(Product.source_id == source_id)
    if product_id is not None:
        statement = statement.where(AIInsight.product_id == product_id)
    rows = (await db.execute(statement)).all()
    return [
        AIInsightResponse(
            **insight.__dict__,
            product_name=product_name,
            source_id=row_source_id,
            source_name=source_name,
        )
        for insight, product_name, row_source_id, source_name in rows
    ]


@router.get("/ai/readiness", response_model=AIReadinessResponse)
async def ai_readiness(_: AdminUser) -> AIReadinessResponse:
    try:
        installed = await list_installed_models()
    except TransientAIServiceError:
        installed = []
    expected = [settings.OLLAMA_CHAT_MODEL, settings.OLLAMA_EMBEDDING_MODEL]
    installed_bases = {name.removesuffix(":latest") for name in installed}
    missing = [
        model
        for model in expected
        if model not in installed and model.removesuffix(":latest") not in installed_bases
    ]
    return AIReadinessResponse(
        status="ready" if not missing else "degraded",
        expected_chat_model=settings.OLLAMA_CHAT_MODEL,
        expected_embedding_model=settings.OLLAMA_EMBEDDING_MODEL,
        installed_models=installed,
        missing_models=missing,
    )


@router.get("/overview", response_model=OverviewResponse)
async def get_overview(db: DatabaseSession, _: AdminUser) -> OverviewResponse:
    source_total = int((await db.scalar(select(func.count(Source.id)))) or 0)
    source_active = int(
        (await db.scalar(select(func.count(Source.id)).where(Source.is_active.is_(True)))) or 0
    )
    product_total = int((await db.scalar(select(func.count(Product.id)))) or 0)
    product_active = int(
        (await db.scalar(select(func.count(Product.id)).where(Product.is_active.is_(True)))) or 0
    )
    observation_total = int((await db.scalar(select(func.count(ProductObservation.id)))) or 0)
    latest_observation_at = await db.scalar(select(func.max(ProductObservation.observed_at)))

    job_rows = (
        await db.execute(select(CrawlJob.status, func.count()).group_by(CrawlJob.status))
    ).all()
    jobs = {str(job_status): int(count) for job_status, count in job_rows}
    alert_total = int((await db.scalar(select(func.count(AlertEvent.id)))) or 0)
    alert_open = int(
        (await db.scalar(select(func.count(AlertEvent.id)).where(AlertEvent.status == "open"))) or 0
    )
    recent_jobs = list(
        (
            await db.scalars(
                select(CrawlJob).order_by(CrawlJob.created_at.desc()).limit(5)
            )
        ).all()
    )
    recent_alerts = list(
        (
            await db.scalars(
                select(AlertEvent).order_by(AlertEvent.triggered_at.desc()).limit(5)
            )
        ).all()
    )
    return OverviewResponse(
        generated_at=datetime.now(UTC),
        sources={"total": source_total, "active": source_active},
        products={"total": product_total, "active": product_active},
        observations={"total": observation_total},
        jobs=jobs,
        alerts={"total": alert_total, "open": alert_open},
        latest_observation_at=latest_observation_at,
        recent_jobs=[JobResponse.model_validate(job) for job in recent_jobs],
        recent_alerts=[AlertEventResponse.model_validate(event) for event in recent_alerts],
    )
