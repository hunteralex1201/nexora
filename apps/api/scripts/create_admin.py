import argparse
import asyncio
import getpass
import os
import sys

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal, close_database
from app.models.user import Role, User
from app.services.security import hash_password


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create the initial NEXORA administrator")
    parser.add_argument("--email", help="Administrator email address")
    parser.add_argument("--first-name", default="NEXORA")
    parser.add_argument("--last-name", default="Administrator")
    return parser.parse_args()


async def create_admin(email: str, password: str, first_name: str, last_name: str) -> None:
    normalized_email = email.strip().lower()
    if "@" not in normalized_email:
        raise ValueError("A valid administrator email is required")

    async with AsyncSessionLocal() as session:
        existing = await session.scalar(
            select(User)
            .options(selectinload(User.roles))
            .where(func.lower(User.email) == normalized_email)
        )
        if existing is not None:
            raise ValueError(f"User already exists: {normalized_email}")

        role = await session.scalar(select(Role).where(Role.name == "admin"))
        if role is None:
            role = Role(
                name="admin",
                description="Platform administrator with full foundation access",
            )

        user = User(
            email=normalized_email,
            password_hash=hash_password(password),
            first_name=first_name.strip() or None,
            last_name=last_name.strip() or None,
            is_active=True,
            is_superuser=False,
            roles=[role],
        )
        session.add(user)
        await session.commit()
        print(f"Created administrator: {normalized_email}")


async def main() -> int:
    args = parse_args()
    email = args.email or input("Administrator email: ").strip()
    password = os.environ.get("NEXORA_BOOTSTRAP_PASSWORD") or getpass.getpass(
        "Administrator password (minimum 12 characters): "
    )
    try:
        await create_admin(email, password, args.first_name, args.last_name)
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    finally:
        await close_database()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
