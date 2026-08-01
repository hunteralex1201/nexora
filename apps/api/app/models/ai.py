import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class AIExecution(Base, TimestampMixin):
    """Policy and lifecycle record for one logical AI task."""

    __tablename__ = "ai_executions"
    __table_args__ = (UniqueConstraint("idempotency_key", name="uq_ai_executions_idempotency_key"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crawl_job_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("crawl_jobs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    requested_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    correlation_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    task_class: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    data_class: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    execution_mode: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), default="queued", nullable=False, index=True)
    policy_version: Mapped[str] = mapped_column(String(100), nullable=False)
    requested_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    requested_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    selected_provider: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    selected_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    input_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    routing: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    budget: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    result: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    requires_human_approval: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    error_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    attempts: Mapped[list["AIProviderAttempt"]] = relationship(
        back_populates="execution",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    delegation: Mapped["ManusDelegation | None"] = relationship(
        back_populates="execution",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )
    approvals: Mapped[list["AIApprovalRequest"]] = relationship(
        back_populates="execution",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class AIProviderAttempt(Base):
    """One provider/model attempt within an AI execution fallback chain."""

    __tablename__ = "ai_provider_attempts"
    __table_args__ = (
        UniqueConstraint("ai_execution_id", "sequence", name="uq_ai_attempts_execution_sequence"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ai_execution_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("ai_executions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    model: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    external_request_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    estimated_cost_usd: Mapped[Decimal | None] = mapped_column(Numeric(12, 6), nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    execution: Mapped[AIExecution] = relationship(back_populates="attempts")


class ManusDelegation(Base, TimestampMixin):
    """External task reference and normalized result for a Manus delegation."""

    __tablename__ = "manus_delegations"
    __table_args__ = (
        UniqueConstraint("ai_execution_id", name="uq_manus_delegations_ai_execution_id"),
        UniqueConstraint("task_id", name="uq_manus_delegations_task_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ai_execution_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("ai_executions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task_id: Mapped[str] = mapped_column(String(255), nullable=False)
    task_url: Mapped[str] = mapped_column(String(2000), nullable=False)
    request_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    agent_profile: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="created", nullable=False, index=True)
    structured_result: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    last_message_cursor: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_reconciled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    terminal_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    execution: Mapped[AIExecution] = relationship(back_populates="delegation")


class ManusWebhookReceipt(Base):
    """Idempotent, minimal receipt for one verified Manus webhook delivery."""

    __tablename__ = "manus_webhook_receipts"
    __table_args__ = (UniqueConstraint("event_id", name="uq_manus_webhook_receipts_event_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[str] = mapped_column(String(255), nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    task_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    signature_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    normalized_event: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="received", nullable=False, index=True)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AIApprovalRequest(Base, TimestampMixin):
    """Explicit human decision gate for one sensitive proposed action."""

    __tablename__ = "ai_approval_requests"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ai_execution_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("ai_executions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False, index=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    decided_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    decision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    execution: Mapped[AIExecution] = relationship(back_populates="approvals")
