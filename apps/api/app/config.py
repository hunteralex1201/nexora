from functools import lru_cache
from typing import Literal, Self

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Validated runtime settings loaded from environment variables."""

    ENVIRONMENT: Literal["development", "test", "staging", "production"] = "development"
    API_HOST: str = "0.0.0.0"  # noqa: S104 - container listener is intentional
    API_PORT: int = Field(default=8000, ge=1, le=65535)
    DEBUG: bool = False
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    DATABASE_URL: str = "postgresql+asyncpg://nexora:nexora@localhost:5432/nexora"
    REDIS_URL: str = "redis://localhost:6379/0"
    DEPENDENCY_TIMEOUT_SECONDS: float = Field(default=2.0, gt=0, le=10)

    CORS_ORIGINS: str = "http://localhost:3000"

    SECRET_KEY: SecretStr = SecretStr("development-only-secret-change-before-deployment")
    ALGORITHM: Literal["HS256", "HS384", "HS512"] = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, ge=5, le=1440)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_async_database_url(cls, value: str) -> str:
        """Require an async SQLAlchemy driver for application traffic."""
        supported = ("postgresql+asyncpg://", "sqlite+aiosqlite://")
        if not value.startswith(supported):
            raise ValueError("DATABASE_URL must use postgresql+asyncpg or sqlite+aiosqlite")
        return value

    @property
    def cors_origins(self) -> list[str]:
        """Return normalized, non-empty CORS origins."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @model_validator(mode="after")
    def validate_secret_for_deployment(self) -> Self:
        """Reject development credentials outside development and test environments."""
        secret = self.SECRET_KEY.get_secret_value()
        if self.ENVIRONMENT in {"staging", "production"}:
            if len(secret) < 32 or "development" in secret.lower() or "change" in secret.lower():
                raise ValueError(
                    "SECRET_KEY must be at least 32 characters and "
                    "non-placeholder outside development"
                )
        return self


@lru_cache
def get_settings() -> Settings:
    """Return a cached settings instance for dependency injection."""
    return Settings()


settings = get_settings()
