from collections.abc import Awaitable, Callable
from secrets import compare_digest
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.services.security import InvalidTokenError, decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]
AccessToken = Annotated[str, Depends(oauth2_scheme)]
AutomationHeader = Annotated[str | None, Header(alias="X-Automation-Key")]


def _authentication_error(detail: str = "Could not validate credentials") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(token: AccessToken, db: DatabaseSession) -> User:
    """Resolve the current active user from a verified bearer token."""
    try:
        payload = decode_access_token(token)
    except InvalidTokenError as exc:
        raise _authentication_error() from exc

    statement = select(User).options(selectinload(User.roles)).where(User.id == payload.sub)
    user = await db.scalar(statement)
    if user is None:
        raise _authentication_error()
    if not user.is_active:
        raise _authentication_error("Inactive user")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def verify_automation_key(automation_key: AutomationHeader = None) -> None:
    """Authenticate a trusted service without exposing a human bearer token."""
    expected = settings.AUTOMATION_API_KEY.get_secret_value()
    if automation_key is None or not compare_digest(automation_key, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid automation credentials",
        )


AutomationService = Annotated[None, Depends(verify_automation_key)]


def require_roles(*required_roles: str) -> Callable[[CurrentUser], Awaitable[User]]:
    """Create a dependency that requires any one of the supplied roles."""
    normalized = {role.strip().lower() for role in required_roles if role.strip()}
    if not normalized:
        raise ValueError("At least one role must be required")

    async def dependency(user: CurrentUser) -> User:
        user_roles = {role.lower() for role in user.role_names}
        if not user.is_superuser and user_roles.isdisjoint(normalized):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return dependency
