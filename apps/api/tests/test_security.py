import uuid

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.services.security import (
    InvalidTokenError,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_password_hashing_round_trip() -> None:
    digest = hash_password("FoundationPass123!")

    assert digest != "FoundationPass123!"
    assert verify_password("FoundationPass123!", digest)
    assert not verify_password("WrongFoundationPass123!", digest)


def test_short_password_is_rejected() -> None:
    with pytest.raises(ValueError, match="at least 12"):
        hash_password("too-short")


def test_access_token_round_trip() -> None:
    user_id = uuid.uuid4()
    token, expires_in = create_access_token(user_id, {"analyst", "admin"})

    payload = decode_access_token(token)

    assert payload.sub == user_id
    assert payload.roles == ["admin", "analyst"]
    assert expires_in == 1800


def test_tampered_access_token_is_rejected() -> None:
    token, _ = create_access_token(uuid.uuid4(), {"analyst"})

    with pytest.raises(InvalidTokenError):
        decode_access_token(f"{token}tampered")


def test_production_rejects_placeholder_secret() -> None:
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        Settings(
            ENVIRONMENT="production",
            DATABASE_URL="sqlite+aiosqlite:///./production.sqlite3",
            SECRET_KEY="development-only-secret-change-before-deployment",
        )
