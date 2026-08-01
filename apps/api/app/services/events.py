import json
import uuid
from datetime import UTC, datetime
from typing import Any

import redis.asyncio as redis

from app.config import settings
from app.logger import setup_logger

logger = setup_logger("nexora.events")


async def publish_event(
    *,
    event_type: str,
    correlation_id: str,
    payload: dict[str, Any],
    source_service: str = "worker",
) -> str | None:
    """Append a standardized event to the bounded durable Redis stream."""
    event_id = str(uuid.uuid4())
    envelope = {
        "event_id": event_id,
        "event_type": event_type,
        "timestamp": datetime.now(UTC).isoformat(),
        "source_service": source_service,
        "correlation_id": correlation_id,
        "payload": payload,
    }
    client: redis.Redis = redis.from_url(  # type: ignore[no-untyped-call]
        settings.REDIS_URL,
        decode_responses=True,
    )
    try:
        await client.xadd(
            settings.EVENT_STREAM_KEY,
            {"event": json.dumps(envelope, separators=(",", ":"), default=str)},
            maxlen=settings.EVENT_STREAM_MAXLEN,
            approximate=True,
        )
        return event_id
    except Exception:
        logger.warning(
            "Event publication failed",
            extra={"correlation_id": correlation_id},
            exc_info=True,
        )
        return None
    finally:
        await client.aclose()
