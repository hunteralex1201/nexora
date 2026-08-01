import asyncio
import signal
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import and_, or_, select

from app.config import settings
from app.connectors import ConnectorError, TransientConnectorError, connector_for
from app.database import AsyncSessionLocal, close_database
from app.logger import setup_logger
from app.models.source import CrawlJob, Source
from app.models.user import User
from app.schemas.commerce import ProductImportItem
from app.services.ai import TransientAIServiceError
from app.services.ai_jobs import analyze_price_job
from app.services.commerce import import_products
from app.services.events import publish_event

logger = setup_logger("nexora.worker")


def utc_now() -> datetime:
    return datetime.now(UTC)


def write_health_file() -> None:
    path = Path(settings.WORKER_HEALTH_FILE)
    path.write_text(utc_now().isoformat(), encoding="utf-8")


async def claim_job() -> uuid.UUID | None:
    """Atomically claim one queued job or reclaim an abandoned running job."""
    now = utc_now()
    stale_before = now - timedelta(seconds=settings.WORKER_LOCK_SECONDS)
    async with AsyncSessionLocal() as db, db.begin():
        statement = (
            select(CrawlJob)
            .where(
                or_(
                    and_(CrawlJob.status == "queued", CrawlJob.queued_at <= now),
                    and_(
                        CrawlJob.status == "running",
                        CrawlJob.last_heartbeat_at.is_not(None),
                        CrawlJob.last_heartbeat_at < stale_before,
                    ),
                )
            )
            .order_by(CrawlJob.queued_at.asc(), CrawlJob.created_at.asc())
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        job = await db.scalar(statement)
        if job is None:
            return None
        job.status = "running"
        job.attempt += 1
        job.started_at = now
        job.last_heartbeat_at = now
        job.completed_at = None
        job.error_message = None
        return job.id


async def _job_heartbeat(job_id: uuid.UUID, stop: asyncio.Event) -> None:
    while not stop.is_set():
        write_health_file()
        try:
            async with AsyncSessionLocal() as db, db.begin():
                job = await db.get(CrawlJob, job_id)
                if job is not None and job.status == "running":
                    job.last_heartbeat_at = utc_now()
        except Exception:
            logger.warning(
                "Job heartbeat failed",
                extra={"correlation_id": str(job_id)},
                exc_info=True,
            )
        try:
            await asyncio.wait_for(stop.wait(), timeout=settings.WORKER_HEARTBEAT_SECONDS)
        except TimeoutError:
            continue


async def _load_job_context(job_id: uuid.UUID) -> tuple[CrawlJob, Source, User | None]:
    async with AsyncSessionLocal() as db:
        job = await db.get(CrawlJob, job_id)
        if job is None:
            raise RuntimeError("Claimed job no longer exists")
        source = await db.get(Source, job.source_id)
        if source is None:
            raise RuntimeError("Job source no longer exists")
        user = await db.get(User, job.requested_by_id) if job.requested_by_id else None
        db.expunge(job)
        db.expunge(source)
        if user is not None:
            db.expunge(user)
        return job, source, user


async def _collect_job(job: CrawlJob, source: Source, user: User | None) -> dict[str, Any]:
    connector = connector_for(source.type)
    result = await connector.collect(source, dict(job.payload))
    async with AsyncSessionLocal() as db:
        live_source = await db.get(Source, source.id)
        live_user = await db.get(User, user.id) if user is not None else None
        live_job = await db.get(CrawlJob, job.id)
        if live_source is None or live_job is None:
            raise RuntimeError("Job context disappeared during collection")
        batch = await import_products(
            db,
            source=live_source,
            user=live_user,
            items=result.items,
            filename=f"job-{job.id}.json",
            collector=connector.metadata.connector_id,
        )
        await db.commit()
        return {
            **result.metrics,
            "import_batch_id": str(batch.id),
            "connector_id": connector.metadata.connector_id,
            "connector_version": connector.metadata.connector_version,
            "parser_version": connector.metadata.parser_version,
            "artifacts": result.artifacts,
        }


async def _import_job(job: CrawlJob, source: Source, user: User | None) -> dict[str, Any]:
    raw_items = job.payload.get("items")
    if not isinstance(raw_items, list) or not raw_items:
        raise ConnectorError("Import job requires a non-empty items array")
    if len(raw_items) > 5000:
        raise ConnectorError("Import job cannot exceed 5000 records")
    items = [ProductImportItem.model_validate(item) for item in raw_items]
    async with AsyncSessionLocal() as db:
        live_source = await db.get(Source, source.id)
        live_user = await db.get(User, user.id) if user is not None else None
        if live_source is None:
            raise RuntimeError("Job source disappeared during import")
        batch = await import_products(
            db,
            source=live_source,
            user=live_user,
            items=items,
            filename=f"job-{job.id}.json",
            collector="background_import",
        )
        await db.commit()
        return {
            "records": len(items),
            "import_batch_id": str(batch.id),
            "connector_id": "background_import",
        }


async def _analyze_job(job: CrawlJob, source: Source) -> dict[str, Any]:
    return await analyze_price_job(job, source)


async def execute_job(job_id: uuid.UUID) -> dict[str, Any]:
    job, source, user = await _load_job_context(job_id)
    if not source.is_active:
        raise ConnectorError("Source is inactive")
    if job.job_type == "collect":
        return await _collect_job(job, source, user)
    if job.job_type == "import":
        return await _import_job(job, source, user)
    if job.job_type == "ai_analyze":
        return await _analyze_job(job, source)
    raise ConnectorError(f"Unsupported worker job type '{job.job_type}'")


async def _mark_succeeded(job_id: uuid.UUID, metrics: dict[str, Any]) -> None:
    async with AsyncSessionLocal() as db, db.begin():
        job = await db.get(CrawlJob, job_id)
        if job is None:
            return
        job.status = "succeeded"
        job.metrics = metrics
        job.completed_at = utc_now()
        job.last_heartbeat_at = job.completed_at
        job.error_message = None


async def _mark_failed(job_id: uuid.UUID, exc: Exception) -> tuple[str, int]:
    retryable = isinstance(exc, TransientConnectorError | TransientAIServiceError)
    async with AsyncSessionLocal() as db, db.begin():
        job = await db.get(CrawlJob, job_id)
        if job is None:
            return "missing", 0
        safe_message = f"{type(exc).__name__}: {str(exc)}"[:2000]
        if retryable and job.attempt < job.max_attempts:
            delay_seconds = min(300, 5 * (2 ** max(0, job.attempt - 1)))
            job.status = "queued"
            job.queued_at = utc_now() + timedelta(seconds=delay_seconds)
            job.last_heartbeat_at = None
            job.error_message = safe_message
            job.metrics = {**job.metrics, "retry_delay_seconds": delay_seconds}
            return "queued", delay_seconds

        job.status = "failed"
        job.completed_at = utc_now()
        job.last_heartbeat_at = job.completed_at
        job.error_message = safe_message
        job.metrics = {**job.metrics, "dead_letter": True, "retryable": retryable}
        return "failed", 0


async def process_claimed_job(job_id: uuid.UUID) -> None:
    started = utc_now()
    heartbeat_stop = asyncio.Event()
    heartbeat_task = asyncio.create_task(_job_heartbeat(job_id, heartbeat_stop))
    await publish_event(
        event_type="crawl_job_started",
        correlation_id=str(job_id),
        payload={"job_id": str(job_id), "scheduled_time": started.isoformat()},
    )
    try:
        metrics = await execute_job(job_id)
        duration = (utc_now() - started).total_seconds()
        metrics = {**metrics, "duration_seconds": round(duration, 3)}
        await _mark_succeeded(job_id, metrics)
        if metrics.get("import_batch_id") is not None:
            await publish_event(
                event_type="data_collected",
                correlation_id=str(job_id),
                payload={
                    "job_id": str(job_id),
                    "record_count": int(metrics.get("records", 0)),
                    "import_batch_id": metrics.get("import_batch_id"),
                },
            )
        await publish_event(
            event_type="crawl_job_completed",
            correlation_id=str(job_id),
            payload={
                "job_id": str(job_id),
                "status": "success",
                "duration_seconds": round(duration, 3),
                "records_processed": int(metrics.get("records", 0)),
            },
        )
        logger.info("Job completed", extra={"correlation_id": str(job_id)})
    except Exception as exc:
        next_status, retry_delay = await _mark_failed(job_id, exc)
        await publish_event(
            event_type="crawl_job_completed",
            correlation_id=str(job_id),
            payload={
                "job_id": str(job_id),
                "status": next_status,
                "duration_seconds": round((utc_now() - started).total_seconds(), 3),
                "records_processed": 0,
                "error_type": type(exc).__name__,
                "retry_delay_seconds": retry_delay,
            },
        )
        logger.error(
            "Job execution failed",
            extra={"correlation_id": str(job_id)},
            exc_info=True,
        )
    finally:
        heartbeat_stop.set()
        await heartbeat_task
        write_health_file()


async def _idle_wait(stop: asyncio.Event) -> None:
    try:
        await asyncio.wait_for(stop.wait(), timeout=settings.WORKER_POLL_SECONDS)
    except TimeoutError:
        return


async def run_worker(stop: asyncio.Event | None = None) -> None:
    """Run one deterministic worker process until signaled to stop."""
    stop_event = stop or asyncio.Event()
    loop = asyncio.get_running_loop()
    for signum in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(signum, stop_event.set)
        except NotImplementedError:
            pass

    logger.info("Worker started")
    write_health_file()
    try:
        while not stop_event.is_set():
            write_health_file()
            try:
                job_id = await claim_job()
            except Exception:
                logger.error("Job claim failed", exc_info=True)
                await _idle_wait(stop_event)
                continue
            if job_id is None:
                await _idle_wait(stop_event)
                continue
            await process_claimed_job(job_id)
    finally:
        await close_database()
        logger.info("Worker stopped")
