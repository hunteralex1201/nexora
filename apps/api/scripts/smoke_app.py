"""Validate that the FastAPI application imports and exposes its foundation routes."""

from __future__ import annotations

import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from main import app  # noqa: E402

REQUIRED_PATHS = {
    "/api/v1/auth/token",
    "/api/v1/auth/me",
    "/api/v1/health",
    "/api/v1/ready",
    "/metrics",
}


def main() -> None:
    """Fail when a required foundation route is missing."""
    available_paths = {route.path for route in app.routes}
    missing_paths = sorted(REQUIRED_PATHS - available_paths)
    if missing_paths:
        missing = ", ".join(missing_paths)
        raise SystemExit(f"API smoke validation failed; missing routes: {missing}")

    print(f"API import smoke passed with {len(available_paths)} registered routes.")


if __name__ == "__main__":
    main()
