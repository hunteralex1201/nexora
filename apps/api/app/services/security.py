import uuid
from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt
from pwdlib import PasswordHash
from pydantic import ValidationError

from app.config import settings
from app.schemas.auth import TokenPayload

password_hash = PasswordHash.recommended()
DUMMY_PASSWORD_HASH = password_hash.hash("nexora-invalid-password")


class InvalidTokenError(ValueError):
    """Raised when an access token cannot be trusted."""


def hash_password(password: str) -> str:
    """Hash a password using the configured modern password hasher."""
    if len(password) < 12:
        raise ValueError("Password must contain at least 12 characters")
    return password_hash.hash(password)


def verify_password(password: str, password_digest: str) -> bool:
    """Verify a password without exposing password-library errors."""
    try:
        return password_hash.verify(password, password_digest)
    except (ValueError, TypeError):
        return False


def create_access_token(subject: uuid.UUID, roles: set[str]) -> tuple[str, int]:
    """Create a short-lived signed access token and return its lifetime in seconds."""
    issued_at = datetime.now(UTC)
    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    expires_at = issued_at + expires_delta
    claims = {
        "sub": str(subject),
        "roles": sorted(roles),
        "iat": issued_at,
        "exp": expires_at,
        "jti": str(uuid.uuid4()),
    }
    token = jwt.encode(
        claims,
        settings.SECRET_KEY.get_secret_value(),
        algorithm=settings.ALGORITHM,
    )
    return token, int(expires_delta.total_seconds())


def decode_access_token(token: str) -> TokenPayload:
    """Verify an access token and validate all claims consumed by the API."""
    try:
        claims = jwt.decode(
            token,
            settings.SECRET_KEY.get_secret_value(),
            algorithms=[settings.ALGORITHM],
            options={"require_exp": True, "require_sub": True},
        )
        return TokenPayload.model_validate(claims)
    except (JWTError, ValidationError, ValueError) as exc:
        raise InvalidTokenError("Invalid or expired access token") from exc
