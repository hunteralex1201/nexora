from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import settings
from app.logger import setup_logger

logger = setup_logger(__name__)


def _engine_options(database_url: str) -> dict[str, Any]:
    """Build engine options that work for PostgreSQL and isolated SQLite tests."""
    options: dict[str, Any] = {
        "echo": settings.DEBUG,
        "pool_pre_ping": True,
    }
    if database_url.startswith("postgresql+"):
        options.update(pool_size=10, max_overflow=20, pool_recycle=1800)
    return options


engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    **_engine_options(settings.DATABASE_URL),
)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session and always close it after the request."""
    async with AsyncSessionLocal() as session:
        yield session


async def check_database() -> None:
    """Execute a minimal database probe for readiness checks."""
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))


async def init_db() -> None:
    """Create tables for isolated development only; production uses Alembic."""
    from app.models import Base

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    logger.info("Database tables initialized")


async def close_database() -> None:
    """Dispose pooled connections during application shutdown."""
    await engine.dispose()
