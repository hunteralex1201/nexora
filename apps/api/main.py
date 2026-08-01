import re
import time
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.auth import router as auth_router
from app.api.automation import router as automation_router
from app.api.commerce import router as commerce_router
from app.api.health import router as health_router
from app.config import settings
from app.database import close_database
from app.logger import setup_logger

logger = setup_logger(__name__)
SAFE_CORRELATION_ID = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Manage startup and shutdown resources without creating schema implicitly."""
    logger.info("NEXORA Intelligence API starting")
    try:
        yield
    finally:
        await close_database()
        logger.info("NEXORA Intelligence API stopped")


app = FastAPI(
    title="NEXORA Intelligence API",
    description="Evidence-driven commerce intelligence API for Bangladesh-first research",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None if settings.ENVIRONMENT == "production" else "/docs",
    redoc_url=None if settings.ENVIRONMENT == "production" else "/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Correlation-ID", "X-Request-ID"],
    expose_headers=["X-Correlation-ID", "X-Request-ID"],
)


def _correlation_id(request: Request, request_id: str) -> str:
    candidate = request.headers.get("X-Correlation-ID", "")
    return candidate if SAFE_CORRELATION_ID.fullmatch(candidate) else request_id


@app.middleware("http")
async def add_request_context(request: Request, call_next: Any) -> Any:
    """Attach trace identifiers and emit one structured completion record per request."""
    request_id = str(uuid.uuid4())
    correlation_id = _correlation_id(request, request_id)
    request.state.request_id = request_id
    request.state.correlation_id = correlation_id
    started = time.perf_counter()

    logger.info(
        "Incoming request",
        extra={
            "request_id": request_id,
            "correlation_id": correlation_id,
            "method": request.method,
            "path": request.url.path,
        },
    )

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Correlation-ID"] = correlation_id

    logger.info(
        "Request completed",
        extra={
            "request_id": request_id,
            "correlation_id": correlation_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": round((time.perf_counter() - started) * 1000, 2),
        },
    )
    return response


app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(commerce_router, prefix="/api/v1")
app.include_router(automation_router, prefix="/api/v1")

Instrumentator(
    excluded_handlers=["/metrics", "/api/v1/health"],
).instrument(
    app
).expose(app, include_in_schema=False)


def _error_payload(
    request: Request,
    *,
    code: str,
    message: str,
    details: Any | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
        },
        "request_id": getattr(request.state, "request_id", "unknown"),
        "correlation_id": getattr(request.state, "correlation_id", "unknown"),
    }
    if details is not None:
        payload["error"]["details"] = details
    return payload


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    message = exc.detail if isinstance(exc.detail, str) else "Request failed"
    response = JSONResponse(
        status_code=exc.status_code,
        content=_error_payload(
            request,
            code=f"http_{exc.status_code}",
            message=message,
            details=None if isinstance(exc.detail, str) else exc.detail,
        ),
    )
    if exc.headers:
        response.headers.update(exc.headers)
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_error_payload(
            request,
            code="validation_error",
            message="Request validation failed",
            details=exc.errors(),
        ),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "Unhandled exception",
        extra={
            "request_id": getattr(request.state, "request_id", "unknown"),
            "correlation_id": getattr(request.state, "correlation_id", "unknown"),
        },
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_error_payload(
            request,
            code="internal_error",
            message="Internal server error",
        ),
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG,
    )
