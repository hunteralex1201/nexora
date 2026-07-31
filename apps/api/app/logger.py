import json
import logging
import sys
from datetime import UTC, datetime
from typing import Any

from app.config import settings


class JSONFormatter(logging.Formatter):
    """Serialize application logs as stable JSON records."""

    standard_fields = {
        "name",
        "msg",
        "args",
        "levelname",
        "levelno",
        "pathname",
        "filename",
        "module",
        "exc_info",
        "exc_text",
        "stack_info",
        "lineno",
        "funcName",
        "created",
        "msecs",
        "relativeCreated",
        "thread",
        "threadName",
        "processName",
        "process",
    }

    def format(self, record: logging.LogRecord) -> str:
        """Format a log record without leaking arbitrary non-serializable values."""
        log_data: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        for field in ("request_id", "correlation_id", "method", "path", "status_code"):
            value = getattr(record, field, None)
            if value is not None:
                log_data[field] = value

        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data, default=str, ensure_ascii=False)


def setup_logger(name: str) -> logging.Logger:
    """Return an idempotently configured structured logger."""
    logger = logging.getLogger(name)
    level = getattr(logging, settings.LOG_LEVEL)
    logger.setLevel(level)
    logger.propagate = False

    if not any(getattr(handler, "_nexora_handler", False) for handler in logger.handlers):
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(level)
        handler.setFormatter(JSONFormatter())
        handler._nexora_handler = True  # type: ignore[attr-defined]
        logger.addHandler(handler)

    return logger
