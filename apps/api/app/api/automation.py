import hashlib
import uuid

from fastapi import APIRouter
from sqlalchemy import select

from app.api.dependencies import AutomationService, DatabaseSession
from app.connectors import ConnectorError, connector_for
from app.models.source import CrawlJob, Source
from app.schemas.commerce import AutomationRunRequest, AutomationRunResponse

router = APIRouter(prefix="/commerce/automation", tags=["automation"])


def _idempotency_key(job_type: str, run_id: str, source_id: uuid.UUID) -> str:
    digest = hashlib.sha256(f"{run_id}:{source_id}".encode()).hexdigest()[:48]
    return f"n8n:{job_type}:{digest}"


async def _queue_automation_run(
    db: DatabaseSession,
    request: AutomationRunRequest,
    *,
    job_type: str,
) -> AutomationRunResponse:
    statement = select(Source).where(Source.is_active.is_(True)).order_by(Source.name.asc())
    if request.source_ids:
        statement = statement.where(Source.id.in_(request.source_ids))
    sources = list((await db.scalars(statement)).all())

    queued_job_ids: list[uuid.UUID] = []
    skipped_source_ids: list[uuid.UUID] = []
    for source in sources:
        if job_type == "collect":
            try:
                connector_for(source.type)
            except ConnectorError:
                skipped_source_ids.append(source.id)
                continue

        idempotency_key = _idempotency_key(job_type, request.run_id, source.id)
        existing = await db.scalar(
            select(CrawlJob).where(CrawlJob.idempotency_key == idempotency_key)
        )
        if existing is not None:
            skipped_source_ids.append(source.id)
            continue

        payload: dict[str, str | int] = {"automation_run_id": request.run_id}
        if job_type == "ai_analyze":
            payload["max_products"] = request.max_products

        job = CrawlJob(
            source_id=source.id,
            requested_by_id=None,
            job_type=job_type,
            trigger="n8n",
            status="queued",
            payload=payload,
            idempotency_key=idempotency_key,
            max_attempts=3,
        )
        db.add(job)
        await db.flush()
        queued_job_ids.append(job.id)

    await db.commit()
    return AutomationRunResponse(
        run_id=request.run_id,
        job_type=job_type,
        queued_job_ids=queued_job_ids,
        skipped_source_ids=skipped_source_ids,
        active_source_count=len(sources),
    )


@router.post("/collect", response_model=AutomationRunResponse)
async def schedule_collection(
    request: AutomationRunRequest,
    db: DatabaseSession,
    _: AutomationService,
) -> AutomationRunResponse:
    """Queue one idempotent collection job per active reviewed source."""
    return await _queue_automation_run(db, request, job_type="collect")


@router.post("/ai", response_model=AutomationRunResponse)
async def schedule_ai_analysis(
    request: AutomationRunRequest,
    db: DatabaseSession,
    _: AutomationService,
) -> AutomationRunResponse:
    """Queue one evidence-grounded AI analysis job per active source."""
    return await _queue_automation_run(db, request, job_type="ai_analyze")
