from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.dependencies import CurrentUser, DatabaseSession, require_roles
from app.models.user import User
from app.schemas.auth import AuthorizationCheckResponse, TokenResponse, UserResponse
from app.services.security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/token", response_model=TokenResponse)
async def issue_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: DatabaseSession,
) -> TokenResponse:
    """Authenticate an active user and issue a short-lived bearer token."""
    normalized_email = form_data.username.strip().lower()
    statement = (
        select(User)
        .options(selectinload(User.roles))
        .where(func.lower(User.email) == normalized_email)
    )
    user = await db.scalar(statement)

    password_digest = user.password_hash if user is not None else DUMMY_PASSWORD_HASH
    password_valid = verify_password(form_data.password, password_digest)
    if user is None or not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    token, expires_in = create_access_token(user.id, user.role_names)
    return TokenResponse(access_token=token, expires_in=expires_in)


@router.get("/me", response_model=UserResponse)
async def read_current_user(user: CurrentUser) -> User:
    """Return the authenticated user's non-sensitive profile."""
    return user


AdminUser = Annotated[User, Depends(require_roles("admin"))]


@router.get("/authorize/admin", response_model=AuthorizationCheckResponse)
async def verify_admin_role(user: AdminUser) -> AuthorizationCheckResponse:
    """Exercise the reusable RBAC gate for an administrator role."""
    return AuthorizationCheckResponse(required_role="admin", user_id=user.id)
