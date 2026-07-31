import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import create_user


async def login(
    client: AsyncClient,
    *,
    email: str,
    password: str,
) -> str:
    response = await client.post(
        "/api/v1/auth/token",
        data={"username": email, "password": password},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["token_type"] == "bearer"  # noqa: S105 - OAuth protocol literal
    assert payload["expires_in"] == 1800
    return str(payload["access_token"])


@pytest.mark.asyncio
async def test_login_me_and_admin_authorization(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    user = await create_user(db_session)
    token = await login(
        client,
        email="ADMIN@nexora.io",
        password="FoundationPass123!",
    )
    headers = {"Authorization": f"Bearer {token}"}

    me_response = await client.get("/api/v1/auth/me", headers=headers)
    assert me_response.status_code == 200
    assert me_response.json()["id"] == str(user.id)
    assert me_response.json()["email"] == "admin@nexora.io"
    assert me_response.json()["roles"][0]["name"] == "admin"

    admin_response = await client.get("/api/v1/auth/authorize/admin", headers=headers)
    assert admin_response.status_code == 200
    assert admin_response.json() == {
        "authorized": True,
        "required_role": "admin",
        "user_id": str(user.id),
    }


@pytest.mark.asyncio
async def test_invalid_password_returns_structured_401(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    await create_user(db_session)

    response = await client.post(
        "/api/v1/auth/token",
        data={"username": "admin@nexora.io", "password": "not-the-password"},
    )

    assert response.status_code == 401
    payload = response.json()
    assert payload["error"]["code"] == "http_401"
    assert payload["request_id"]
    assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.asyncio
async def test_non_admin_user_receives_403(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    await create_user(
        db_session,
        email="analyst@nexora.io",
        role_name="analyst",
    )
    token = await login(
        client,
        email="analyst@nexora.io",
        password="FoundationPass123!",
    )

    response = await client.get(
        "/api/v1/auth/authorize/admin",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert response.json()["error"]["message"] == "Insufficient permissions"


@pytest.mark.asyncio
async def test_inactive_user_cannot_log_in(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    await create_user(
        db_session,
        email="inactive@nexora.io",
        is_active=False,
    )

    response = await client.post(
        "/api/v1/auth/token",
        data={"username": "inactive@nexora.io", "password": "FoundationPass123!"},
    )

    assert response.status_code == 403
    assert response.json()["error"]["message"] == "User account is inactive"


@pytest.mark.asyncio
async def test_missing_bearer_token_is_rejected(client: AsyncClient) -> None:
    response = await client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "http_401"
