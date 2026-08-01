import hashlib
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import AutomationService, DatabaseSession
from app.config import settings
from app.connectors import ConnectorError, connector_for
from app.models.ai import AIExecution, AIProviderAttempt, ManusDelegation
from app.models.source import CrawlJob, Source
from app.schemas.commerce import (
    AutomationResearchRequest,
    AutomationResearchResponse,
    AutomationRunRequest,
    AutomationRunResponse,
)
from app.services.ai_routing import (
    AIDataClass,
    AIProvider,
    AIRoutingError,
    AITaskClass,
    route_ai_task,
)
from app.services.manus import ManusClient, ManusServiceError, TransientManusServiceError

router = APIRouter(prefix="/commerce/automation", tags=["automation"])


def _idempotency_key(job_type: str, run_id: str, source_id: uuid.UUID) -> str:
    digest = hashlib.sha256(f"{run_id}:{source_id}".encode()).hexdigest()[:48]
    return f"n8n:{job_type}:{digest}"


def _manus_idempotency_key(run_id: str) -> str:
    digest = hashlib.sha256(run_id.encode()).hexdigest()[:48]
    return f"n8n:manus:{digest}"


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
            payload["data_class"] = request.data_class
            if request.requested_provider is not None:
                payload["requested_provider"] = request.requested_provider
            if request.requested_model is not None:
                payload["requested_model"] = request.requested_model

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


async def _existing_manus_response(
    db: DatabaseSession,
    *,
    run_id: str,
    execution: AIExecution,
) -> AutomationResearchResponse:
    delegation = await db.scalar(
        select(ManusDelegation).where(ManusDelegation.ai_execution_id == execution.id)
    )
    if delegation is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Research run already exists and is still being reconciled",
        )
    return AutomationResearchResponse(
        run_id=run_id,
        ai_execution_id=execution.id,
        task_id=delegation.task_id,
        task_url=delegation.task_url,
        status=delegation.status,
        idempotent_replay=True,
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
    """Queue one evidence-grounded, policy-routed AI analysis job per active source."""
    return await _queue_automation_run(db, request, job_type="ai_analyze")


@router.post("/research", response_model=AutomationResearchResponse)
async def schedule_manus_research(
    request: AutomationResearchRequest,
    db: DatabaseSession,
    _: AutomationService,
) -> AutomationResearchResponse:
    """Create one idempotent, private, policy-scoped asynchronous Manus research task."""
    idempotency_key = _manus_idempotency_key(request.run_id)
    existing = await db.scalar(
        select(AIExecution).where(AIExecution.idempotency_key == idempotency_key)
    )
    if existing is not None:
        return await _existing_manus_response(db, run_id=request.run_id, execution=existing)

    requested_profile = request.agent_profile if settings.AI_ALLOW_ROUTE_HINTS else None
    try:
        decision = route_ai_task(
            AITaskClass.STRATEGIC_RESEARCH,
            AIDataClass(request.data_class),
            requested_provider=AIProvider.MANUS,
            requested_model=requested_profile,
        )
    except (AIRoutingError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if decision.selected.provider is not AIProvider.MANUS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Current server policy does not select Manus for strategic research",
        )

    now = datetime.now(UTC)
    execution = AIExecution(
        correlation_id=request.run_id,
        idempotency_key=idempotency_key,
        task_class=AITaskClass.STRATEGIC_RESEARCH.value,
        data_class=request.data_class,
        execution_mode=decision.selected.execution_mode.value,
        status="creating",
        policy_version=decision.policy_version,
        requested_provider=AIProvider.MANUS.value,
        requested_model=request.agent_profile,
        selected_provider=decision.selected.provider.value,
        selected_model=decision.selected.model,
        input_fingerprint=hashlib.sha256(request.prompt.encode()).hexdigest(),
        routing=decision.audit_dict(),
        budget={"max_prompt_bytes": settings.AI_MAX_PROMPT_BYTES},
        result={},
        requires_human_approval=False,
        started_at=now,
    )
    db.add(execution)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        existing = await db.scalar(
            select(AIExecution).where(AIExecution.idempotency_key == idempotency_key)
        )
        if existing is None:
            raise
        return await _existing_manus_response(db, run_id=request.run_id, execution=existing)
    await db.refresh(execution)

    profile = request.agent_profile if settings.AI_ALLOW_ROUTE_HINTS else None
    try:
        created = await ManusClient().create_task(
            prompt=request.prompt,
            title=request.title,
            profile=profile,
            connector_ids=tuple(request.connector_ids),
            skill_ids=tuple(request.skill_ids) if request.skill_ids else None,
        )
    except ManusServiceError as exc:
        failed_at = datetime.now(UTC)
        execution.status = (
            "retryable_failure" if isinstance(exc, TransientManusServiceError) else "failed"
        )
        execution.error_type = type(exc).__name__
        execution.error_message = str(exc)[:2000]
        execution.completed_at = failed_at
        db.add(
            AIProviderAttempt(
                ai_execution_id=execution.id,
                sequence=1,
                provider=AIProvider.MANUS.value,
                model=decision.selected.model,
                status=execution.status,
                error_type=type(exc).__name__,
                started_at=now,
                completed_at=failed_at,
            )
        )
        await db.commit()
        failure_status = (
            status.HTTP_503_SERVICE_UNAVAILABLE
            if isinstance(exc, TransientManusServiceError)
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=failure_status, detail=str(exc)) from exc

    delegated_at = datetime.now(UTC)
    delegation = ManusDelegation(
        ai_execution_id=execution.id,
        task_id=created.task_id,
        task_url=created.task_url,
        request_id=created.request_id,
        agent_profile=created.profile,
        status="created",
        structured_result={},
    )
    execution.status = "delegated"
    execution.selected_model = created.profile
    execution.result = {"task_id": created.task_id, "status": "created"}
    db.add(delegation)
    db.add(
        AIProviderAttempt(
            ai_execution_id=execution.id,
            sequence=1,
            provider=AIProvider.MANUS.value,
            model=created.profile,
            status="created",
            external_request_id=created.request_id,
            started_at=now,
            completed_at=delegated_at,
        )
    )
    await db.commit()
    return AutomationResearchResponse(
        run_id=request.run_id,
        ai_execution_id=execution.id,
        task_id=created.task_id,
        task_url=created.task_url,
        status="created",
        idempotent_replay=False,
    )
