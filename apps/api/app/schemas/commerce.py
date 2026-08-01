import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

Availability = Literal["in_stock", "out_of_stock", "preorder", "unknown"]
JobType = Literal["collect", "import", "ai_analyze", "alert_evaluate"]
JobTrigger = Literal["manual", "schedule", "n8n", "api"]
AlertRuleType = Literal["price_below", "price_drop_percent", "out_of_stock"]


class SourceCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    type: str = Field(min_length=2, max_length=50)
    base_url: HttpUrl
    config: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True

    @field_validator("name", "type")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class SourceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    type: str | None = Field(default=None, min_length=2, max_length=50)
    base_url: HttpUrl | None = None
    config: dict[str, Any] | None = None
    is_active: bool | None = None


class SourceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    type: str
    base_url: str
    config: dict[str, Any]
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ProductImportItem(BaseModel):
    external_id: str = Field(min_length=1, max_length=255)
    name: str = Field(min_length=1, max_length=500)
    canonical_url: HttpUrl
    price: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    original_price: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    currency: str = Field(default="BDT", min_length=3, max_length=3)
    availability: Availability = "unknown"
    brand: str | None = Field(default=None, max_length=255)
    category: str | None = Field(default=None, max_length=255)
    image_url: HttpUrl | None = None
    seller_name: str | None = Field(default=None, max_length=255)
    rating: Decimal | None = Field(default=None, ge=0, le=5, max_digits=4, decimal_places=2)
    review_count: int | None = Field(default=None, ge=0)
    observed_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    attributes: dict[str, Any] = Field(default_factory=dict)
    evidence: dict[str, Any] = Field(default_factory=dict)

    @field_validator("external_id", "name")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        normalized = value.strip().upper()
        if len(normalized) != 3 or not normalized.isalpha():
            raise ValueError("must be a three-letter currency code")
        return normalized

    @field_validator("observed_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("must include a timezone")
        return value


class ProductImportRequest(BaseModel):
    source_id: uuid.UUID
    items: list[ProductImportItem] = Field(min_length=1, max_length=5000)
    filename: str | None = Field(default=None, max_length=500)


class ImportBatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_id: uuid.UUID
    filename: str | None
    status: str
    rows_received: int
    rows_accepted: int
    rows_rejected: int
    errors: list[dict[str, Any]]
    completed_at: datetime | None
    created_at: datetime


class ObservationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    observed_at: datetime
    price: Decimal
    original_price: Decimal | None
    currency: str
    availability: str
    seller_name: str | None
    rating: Decimal | None
    review_count: int | None
    source_url: str
    collector: str
    evidence: dict[str, Any]
    evidence_hash: str
    created_at: datetime


class ProductListItem(BaseModel):
    id: uuid.UUID
    source_id: uuid.UUID
    source_name: str
    external_id: str
    name: str
    canonical_url: str
    brand: str | None
    category: str | None
    currency: str
    image_url: str | None
    is_active: bool
    last_seen_at: datetime
    latest_observation: ObservationResponse | None
    previous_price: Decimal | None = None
    price_change_percent: Decimal | None = None


class ProductDetail(ProductListItem):
    attributes: dict[str, Any]
    first_seen_at: datetime
    history: list[ObservationResponse]


class ProductPage(BaseModel):
    items: list[ProductListItem]
    total: int
    limit: int
    offset: int


class JobCreate(BaseModel):
    source_id: uuid.UUID
    job_type: JobType = "collect"
    trigger: JobTrigger = "manual"
    payload: dict[str, Any] = Field(default_factory=dict)
    max_attempts: int = Field(default=3, ge=1, le=10)
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=128)


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_id: uuid.UUID
    status: str
    job_type: str
    trigger: str
    requested_by_id: uuid.UUID | None
    payload: dict[str, Any]
    attempt: int
    max_attempts: int
    idempotency_key: str | None
    queued_at: datetime
    started_at: datetime | None
    last_heartbeat_at: datetime | None
    completed_at: datetime | None
    error_message: str | None
    metrics: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class AlertRuleCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    rule_type: AlertRuleType
    threshold: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    source_id: uuid.UUID | None = None
    product_id: uuid.UUID | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True

    @model_validator(mode="after")
    def validate_threshold(self) -> "AlertRuleCreate":
        if self.rule_type in {"price_below", "price_drop_percent"} and self.threshold is None:
            raise ValueError("threshold is required for this rule type")
        if self.rule_type == "price_drop_percent" and self.threshold is not None:
            if self.threshold > 100:
                raise ValueError("price drop threshold cannot exceed 100 percent")
        return self


class AlertRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID | None
    source_id: uuid.UUID | None
    product_id: uuid.UUID | None
    name: str
    rule_type: str
    threshold: Decimal | None
    config: dict[str, Any]
    is_active: bool
    last_triggered_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AlertEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    rule_id: uuid.UUID
    product_id: uuid.UUID
    observation_id: uuid.UUID
    status: str
    message: str
    payload: dict[str, Any]
    triggered_at: datetime
    acknowledged_at: datetime | None


class CountMetric(BaseModel):
    total: int
    active: int | None = None


class OverviewActivityPoint(BaseModel):
    day: date
    observations: int = 0
    jobs: int = 0
    alerts: int = 0


class OverviewResponse(BaseModel):
    generated_at: datetime
    sources: CountMetric
    products: CountMetric
    observations: CountMetric
    jobs: dict[str, int]
    alerts: dict[str, int]
    latest_observation_at: datetime | None
    activity: list[OverviewActivityPoint] = Field(default_factory=list)
    recent_jobs: list[JobResponse]
    recent_alerts: list[AlertEventResponse]


class AutomationRunRequest(BaseModel):
    run_id: str = Field(min_length=1, max_length=128)
    source_ids: list[uuid.UUID] | None = None
    max_products: int = Field(default=20, ge=1, le=100)


class AutomationRunResponse(BaseModel):
    run_id: str
    job_type: str
    queued_job_ids: list[uuid.UUID]
    skipped_source_ids: list[uuid.UUID]
    active_source_count: int


class AIInsightResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    source_id: uuid.UUID
    source_name: str
    observation_id: uuid.UUID | None
    crawl_job_id: uuid.UUID | None
    kind: str
    model: str
    prompt_version: str
    content: str
    confidence: Decimal | None
    evidence: dict[str, Any]
    idempotency_key: str
    generated_at: datetime


class AIReadinessResponse(BaseModel):
    status: Literal["ready", "degraded"]
    expected_chat_model: str
    expected_embedding_model: str
    installed_models: list[str]
    missing_models: list[str]


class AIChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)

    @field_validator("content")
    @classmethod
    def strip_chat_content(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("message must not be blank")
        return stripped


class AIChatRequest(BaseModel):
    messages: list[AIChatMessage] = Field(min_length=1, max_length=20)
    temperature: float = Field(default=0.3, ge=0, le=1)
    max_tokens: int = Field(default=512, ge=64, le=768)

    @model_validator(mode="after")
    def validate_conversation(self) -> "AIChatRequest":
        if self.messages[-1].role != "user":
            raise ValueError("the final message must be from the user")
        if sum(len(message.content) for message in self.messages) > 24_000:
            raise ValueError("conversation is too long; start a new chat")
        return self


class AIChatStreamEvent(BaseModel):
    type: Literal["start", "token", "done", "error"]
    content: str | None = None
    model: str | None = None
    total_duration_ms: int | None = None
