import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class TokenPayload(BaseModel):
    """Validated claims extracted from an access token."""

    sub: uuid.UUID
    roles: list[str] = Field(default_factory=list)
    exp: datetime


class TokenResponse(BaseModel):
    """OAuth2-compatible bearer token response."""

    access_token: str
    token_type: str = "bearer"  # noqa: S105 - OAuth 2 token type, not a credential
    expires_in: int


class RoleResponse(BaseModel):
    """Public role representation."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None


class UserResponse(BaseModel):
    """Safe authenticated-user representation."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    first_name: str | None
    last_name: str | None
    is_active: bool
    is_superuser: bool
    roles: list[RoleResponse]


class AuthorizationCheckResponse(BaseModel):
    """Evidence that role enforcement succeeded."""

    authorized: bool = True
    required_role: str
    user_id: uuid.UUID
