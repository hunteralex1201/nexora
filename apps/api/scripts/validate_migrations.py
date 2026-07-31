"""Validate the full Alembic upgrade, downgrade, and repeat-upgrade path."""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
ALEMBIC_CONFIG = API_ROOT / "alembic.ini"


def run_alembic(environment: dict[str, str], *arguments: str) -> None:
    """Run Alembic from the API root with a checked exit status."""
    subprocess.run(  # noqa: S603
        [sys.executable, "-m", "alembic", "-c", str(ALEMBIC_CONFIG), *arguments],
        cwd=API_ROOT,
        env=environment,
        check=True,
    )


def main() -> None:
    """Exercise migrations against a disposable SQLite database."""
    with tempfile.TemporaryDirectory(prefix="nexora-migration-") as temporary_directory:
        database_path = Path(temporary_directory) / "migration-validation.db"
        environment = os.environ.copy()
        environment.update(
            {
                "ENVIRONMENT": "test",
                "DATABASE_URL": f"sqlite+aiosqlite:///{database_path.as_posix()}",
                "REDIS_URL": "redis://localhost:6379/15",
                "SECRET_KEY": "migration-validation-secret-key-32-characters",  # noqa: S105
            }
        )

        run_alembic(environment, "upgrade", "head")
        run_alembic(environment, "downgrade", "base")
        run_alembic(environment, "upgrade", "head")

    print("Alembic upgrade, downgrade, and repeat-upgrade validation passed.")


if __name__ == "__main__":
    main()
