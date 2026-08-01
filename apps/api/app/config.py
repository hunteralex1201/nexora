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

    WORKER_POLL_SECONDS: float = Field(default=2.0, ge=0.25, le=60)
    WORKER_LOCK_SECONDS: int = Field(default=300, ge=30, le=3600)
    WORKER_HEARTBEAT_SECONDS: int = Field(default=10, ge=2, le=60)
    WORKER_HEALTH_FILE: str = "/tmp/nexora-worker-heartbeat"  # noqa: S108
    CONNECTOR_TIMEOUT_SECONDS: float = Field(default=30.0, ge=3, le=120)
    EVENT_STREAM_KEY: str = "nexora:events"
    EVENT_STREAM_MAXLEN: int = Field(default=10000, ge=100, le=1000000)

    OLLAMA_BASE_URL: str = "http://ollama:11434"
    OLLAMA_CHAT_MODEL: str = "qwen3:8b"
    OLLAMA_EMBEDDING_MODEL: str = "qwen3-embedding:0.6b"
    OLLAMA_TIMEOUT_SECONDS: float = Field(default=180.0, ge=10, le=600)

    AI_POLICY_VERSION: str = Field(default="ai-routing-v1", min_length=1, max_length=100)
    AI_ALLOW_ROUTE_HINTS: bool = False
    AI_MAX_PROMPT_BYTES: int = Field(default=65536, ge=1024, le=1048576)

    CLOUD_LLM_ENABLED: bool = False
    CLOUD_LLM_BASE_URL: str = "https://api.openai.com/v1"
    CLOUD_LLM_API_KEY: SecretStr | None = None
    CLOUD_LLM_ALLOWED_MODELS: str = ""
    CLOUD_LLM_DEFAULT_MODEL: str = ""
    CLOUD_LLM_TIMEOUT_SECONDS: float = Field(default=120.0, ge=5, le=600)

    MANUS_ENABLED: bool = False
    MANUS_API_BASE_URL: str = "https://api.manus.ai"
    MANUS_API_KEY: SecretStr | None = None
    MANUS_PROJECT_ID: str = ""
    MANUS_ALLOWED_AGENT_PROFILES: str = "manus-1.6-lite,manus-1.6"
    MANUS_DEFAULT_AGENT_PROFILE: str = "manus-1.6"
    MANUS_ALLOWED_CONNECTOR_IDS: str = ""
    MANUS_ALLOWED_SKILL_IDS: str = ""
    MANUS_ALLOW_ACCOUNT_DEFAULT_SKILLS: bool = False
    MANUS_TIMEOUT_SECONDS: float = Field(default=30.0, ge=3, le=120)
    MANUS_WEBHOOK_PUBLIC_URL: str = ""
    MANUS_WEBHOOK_MAX_AGE_SECONDS: int = Field(default=300, ge=30, le=300)
    MANUS_WEBHOOK_MAX_BODY_BYTES: int = Field(default=1048576, ge=1024, le=10485760)
    MANUS_PUBLIC_KEY_TTL_SECONDS: int = Field(default=3600, ge=300, le=86400)
    MANUS_DAILY_TASK_LIMIT: int = Field(default=5, ge=0, le=1000)
    MANUS_CONCURRENCY_LIMIT: int = Field(default=1, ge=1, le=20)

    CORS_ORIGINS: str = "http://localhost:3000"

    SECRET_KEY: SecretStr = SecretStr("development-only-secret-change-before-deployment")
    AUTOMATION_API_KEY: SecretStr = SecretStr(
        "development-only-automation-key-change-before-deployment"
    )
    WORKSPACE_API_KEY: SecretStr = SecretStr(
        "development-only-workspace-key-change-before-deployment"
    )
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

    @staticmethod
    def _csv(value: str) -> tuple[str, ...]:
        return tuple(dict.fromkeys(item.strip() for item in value.split(",") if item.strip()))

    @property
    def cors_origins(self) -> list[str]:
        """Return normalized, non-empty CORS origins."""
        return list(self._csv(self.CORS_ORIGINS))

    @property
    def cloud_llm_allowed_models(self) -> tuple[str, ...]:
        """Return the server-controlled cloud model allowlist."""
        return self._csv(self.CLOUD_LLM_ALLOWED_MODELS)

    @property
    def manus_allowed_agent_profiles(self) -> tuple[str, ...]:
        """Return the server-controlled Manus profile allowlist."""
        return self._csv(self.MANUS_ALLOWED_AGENT_PROFILES)

    @property
    def manus_allowed_connector_ids(self) -> tuple[str, ...]:
        """Return the explicitly approved Manus connector identifiers."""
        return self._csv(self.MANUS_ALLOWED_CONNECTOR_IDS)

    @property
    def manus_allowed_skill_ids(self) -> tuple[str, ...]:
        """Return the explicitly approved Manus skill identifiers."""
        return self._csv(self.MANUS_ALLOWED_SKILL_IDS)

    @model_validator(mode="after")
    def validate_secret_for_deployment(self) -> Self:
        """Reject incomplete providers and development credentials in deployed environments."""
        secret = self.SECRET_KEY.get_secret_value()
        automation_key = self.AUTOMATION_API_KEY.get_secret_value()
        workspace_key = self.WORKSPACE_API_KEY.get_secret_value()

        if self.CLOUD_LLM_ENABLED:
            cloud_key = self.CLOUD_LLM_API_KEY.get_secret_value() if self.CLOUD_LLM_API_KEY else ""
            if not cloud_key or not self.cloud_llm_allowed_models:
                raise ValueError(
                    "CLOUD_LLM_ENABLED requires CLOUD_LLM_API_KEY and CLOUD_LLM_ALLOWED_MODELS"
                )
            if self.CLOUD_LLM_DEFAULT_MODEL not in self.cloud_llm_allowed_models:
                raise ValueError("CLOUD_LLM_DEFAULT_MODEL must be in CLOUD_LLM_ALLOWED_MODELS")

        if self.MANUS_ENABLED:
            manus_key = self.MANUS_API_KEY.get_secret_value() if self.MANUS_API_KEY else ""
            if not manus_key or not self.MANUS_PROJECT_ID:
                raise ValueError("MANUS_ENABLED requires MANUS_API_KEY and MANUS_PROJECT_ID")
            if self.MANUS_DEFAULT_AGENT_PROFILE not in self.manus_allowed_agent_profiles:
                raise ValueError(
                    "MANUS_DEFAULT_AGENT_PROFILE must be in MANUS_ALLOWED_AGENT_PROFILES"
                )
            if not self.MANUS_ALLOW_ACCOUNT_DEFAULT_SKILLS and not self.manus_allowed_skill_ids:
                raise ValueError(
                    "MANUS_ENABLED requires MANUS_ALLOWED_SKILL_IDS unless "
                    "MANUS_ALLOW_ACCOUNT_DEFAULT_SKILLS is explicitly enabled"
                )

        if self.ENVIRONMENT in {"staging", "production"}:
            if len(secret) < 32 or "development" in secret.lower() or "change" in secret.lower():
                raise ValueError(
                    "SECRET_KEY must be at least 32 characters and "
                    "non-placeholder outside development"
                )
            if (
                len(automation_key) < 32
                or "development" in automation_key.lower()
                or "change" in automation_key.lower()
            ):
                raise ValueError(
                    "AUTOMATION_API_KEY must be at least 32 characters and "
                    "non-placeholder outside development"
                )
            if (
                len(workspace_key) < 32
                or "development" in workspace_key.lower()
                or "change" in workspace_key.lower()
            ):
                raise ValueError(
                    "WORKSPACE_API_KEY must be at least 32 characters and "
                    "non-placeholder outside development"
                )
        return self


@lru_cache
def get_settings() -> Settings:
    """Return a cached settings instance for dependency injection."""
    return Settings()


settings = get_settings()
