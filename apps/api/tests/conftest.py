import os
from collections.abc import AsyncIterator
from pathlib import Path

os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./nexora_test.sqlite3"
os.environ["REDIS_URL"] = "redis://localhost:6379/15"
os.environ["SECRET_KEY"] = (
    "test-only-secret-key-with-at-least-32-characters"  # noqa: S105 - test only
)
os.environ["AUTOMATION_API_KEY"] = (
    "test-only-automation-key-with-at-least-32-characters"  # noqa: S105 - test only
)
os.environ["LOG_LEVEL"] = "CRITICAL"

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, engine
from app.models import Base, Role, User
from app.services.security import hash_password
from main import app

TEST_DATABASE = Path(__file__).parents[1] / "nexora_test.sqlite3"


@pytest_asyncio.fixture(scope="session", autouse=True)
async def database_schema() -> AsyncIterator[None]:
    """Create and remove an isolated schema for the test session."""
    if TEST_DATABASE.exists():
        TEST_DATABASE.unlink()
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
    await engine.dispose()
    if TEST_DATABASE.exists():
        TEST_DATABASE.unlink()


@pytest_asyncio.fixture(autouse=True)
async def clean_database() -> AsyncIterator[None]:
    """Keep tests independent by clearing every table in dependency-safe order."""
    async with AsyncSessionLocal() as session:
        for table in reversed(Base.metadata.sorted_tables):
            await session.execute(table.delete())
        await session.commit()
    yield


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as test_client:
        yield test_client


async def create_user(
    session: AsyncSession,
    *,
    email: str = "admin@nexora.io",
    password: str = "FoundationPass123!",  # noqa: S107 - isolated test fixture
    role_name: str | None = "admin",
    is_active: bool = True,
) -> User:
    """Persist a test user with an optional role."""
    user = User(
        email=email,
        password_hash=hash_password(password),
        first_name="NEXORA",
        last_name="Operator",
        is_active=is_active,
    )
    if role_name:
        user.roles.append(Role(name=role_name, description=f"{role_name.title()} role"))
    session.add(user)
    await session.commit()
    await session.refresh(user, attribute_names=["roles"])
    return user
