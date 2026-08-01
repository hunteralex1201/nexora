"""Add policy-controlled AI orchestration and Manus delegation ledger.

Revision ID: 20260801_0004
Revises: 20260801_0002
Create Date: 2026-08-01
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260801_0004"
down_revision: str | None = "20260801_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _timestamps() -> tuple[sa.Column, sa.Column]:
    return (
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def upgrade() -> None:
    created_at, updated_at = _timestamps()
    op.create_table(
        "ai_executions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("crawl_job_id", sa.Uuid(), nullable=True),
        sa.Column("requested_by_id", sa.Uuid(), nullable=True),
        sa.Column("correlation_id", sa.String(length=128), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("task_class", sa.String(length=100), nullable=False),
        sa.Column("data_class", sa.String(length=50), nullable=False),
        sa.Column("execution_mode", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="queued"),
        sa.Column("policy_version", sa.String(length=100), nullable=False),
        sa.Column("requested_provider", sa.String(length=50), nullable=True),
        sa.Column("requested_model", sa.String(length=255), nullable=True),
        sa.Column("selected_provider", sa.String(length=50), nullable=True),
        sa.Column("selected_model", sa.String(length=255), nullable=True),
        sa.Column("input_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("routing", sa.JSON(), nullable=False),
        sa.Column("budget", sa.JSON(), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column(
            "requires_human_approval", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("error_type", sa.String(length=255), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        created_at,
        updated_at,
        sa.ForeignKeyConstraint(["crawl_job_id"], ["crawl_jobs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["requested_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key", name="uq_ai_executions_idempotency_key"),
    )
    op.create_index("ix_ai_executions_crawl_job_id", "ai_executions", ["crawl_job_id"])
    op.create_index("ix_ai_executions_requested_by_id", "ai_executions", ["requested_by_id"])
    op.create_index("ix_ai_executions_correlation_id", "ai_executions", ["correlation_id"])
    op.create_index("ix_ai_executions_task_class", "ai_executions", ["task_class"])
    op.create_index("ix_ai_executions_data_class", "ai_executions", ["data_class"])
    op.create_index("ix_ai_executions_execution_mode", "ai_executions", ["execution_mode"])
    op.create_index("ix_ai_executions_status", "ai_executions", ["status"])
    op.create_index("ix_ai_executions_selected_provider", "ai_executions", ["selected_provider"])
    op.create_index("ix_ai_executions_input_fingerprint", "ai_executions", ["input_fingerprint"])

    op.create_table(
        "ai_provider_attempts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("ai_execution_id", sa.Uuid(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("model", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("external_request_id", sa.String(length=255), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("estimated_cost_usd", sa.Numeric(12, 6), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("error_type", sa.String(length=255), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["ai_execution_id"], ["ai_executions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "ai_execution_id", "sequence", name="uq_ai_attempts_execution_sequence"
        ),
    )
    op.create_index(
        "ix_ai_provider_attempts_ai_execution_id",
        "ai_provider_attempts",
        ["ai_execution_id"],
    )
    op.create_index("ix_ai_provider_attempts_provider", "ai_provider_attempts", ["provider"])
    op.create_index("ix_ai_provider_attempts_status", "ai_provider_attempts", ["status"])
    op.create_index(
        "ix_ai_provider_attempts_external_request_id",
        "ai_provider_attempts",
        ["external_request_id"],
    )

    created_at, updated_at = _timestamps()
    op.create_table(
        "manus_delegations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("ai_execution_id", sa.Uuid(), nullable=False),
        sa.Column("task_id", sa.String(length=255), nullable=False),
        sa.Column("task_url", sa.String(length=2000), nullable=False),
        sa.Column("request_id", sa.String(length=255), nullable=True),
        sa.Column("agent_profile", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="created"),
        sa.Column("structured_result", sa.JSON(), nullable=False),
        sa.Column("last_message_cursor", sa.String(length=255), nullable=True),
        sa.Column("last_reconciled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("terminal_at", sa.DateTime(timezone=True), nullable=True),
        created_at,
        updated_at,
        sa.ForeignKeyConstraint(["ai_execution_id"], ["ai_executions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ai_execution_id", name="uq_manus_delegations_ai_execution_id"),
        sa.UniqueConstraint("task_id", name="uq_manus_delegations_task_id"),
    )
    op.create_index(
        "ix_manus_delegations_ai_execution_id",
        "manus_delegations",
        ["ai_execution_id"],
    )
    op.create_index("ix_manus_delegations_request_id", "manus_delegations", ["request_id"])
    op.create_index("ix_manus_delegations_status", "manus_delegations", ["status"])

    op.create_table(
        "manus_webhook_receipts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("event_id", sa.String(length=255), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("task_id", sa.String(length=255), nullable=True),
        sa.Column("payload_hash", sa.String(length=64), nullable=False),
        sa.Column("signature_hash", sa.String(length=64), nullable=False),
        sa.Column("normalized_event", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="received"),
        sa.Column(
            "received_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", name="uq_manus_webhook_receipts_event_id"),
    )
    op.create_index(
        "ix_manus_webhook_receipts_event_type",
        "manus_webhook_receipts",
        ["event_type"],
    )
    op.create_index("ix_manus_webhook_receipts_task_id", "manus_webhook_receipts", ["task_id"])
    op.create_index(
        "ix_manus_webhook_receipts_payload_hash",
        "manus_webhook_receipts",
        ["payload_hash"],
    )
    op.create_index("ix_manus_webhook_receipts_status", "manus_webhook_receipts", ["status"])
    op.create_index(
        "ix_manus_webhook_receipts_received_at",
        "manus_webhook_receipts",
        ["received_at"],
    )

    created_at, updated_at = _timestamps()
    op.create_table(
        "ai_approval_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("ai_execution_id", sa.Uuid(), nullable=False),
        sa.Column("action_type", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("decided_by_id", sa.Uuid(), nullable=True),
        sa.Column("decision_reason", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        created_at,
        updated_at,
        sa.ForeignKeyConstraint(["ai_execution_id"], ["ai_executions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["decided_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ai_approval_requests_ai_execution_id",
        "ai_approval_requests",
        ["ai_execution_id"],
    )
    op.create_index("ix_ai_approval_requests_action_type", "ai_approval_requests", ["action_type"])
    op.create_index("ix_ai_approval_requests_status", "ai_approval_requests", ["status"])
    op.create_index(
        "ix_ai_approval_requests_decided_by_id",
        "ai_approval_requests",
        ["decided_by_id"],
    )

    with op.batch_alter_table("ai_insights") as batch_op:
        batch_op.add_column(sa.Column("ai_execution_id", sa.Uuid(), nullable=True))
        batch_op.create_foreign_key(
            "fk_ai_insights_ai_execution_id_ai_executions",
            "ai_executions",
            ["ai_execution_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_ai_insights_ai_execution_id", ["ai_execution_id"])


def downgrade() -> None:
    with op.batch_alter_table("ai_insights") as batch_op:
        batch_op.drop_index("ix_ai_insights_ai_execution_id")
        batch_op.drop_constraint("fk_ai_insights_ai_execution_id_ai_executions", type_="foreignkey")
        batch_op.drop_column("ai_execution_id")

    op.drop_index("ix_ai_approval_requests_decided_by_id", table_name="ai_approval_requests")
    op.drop_index("ix_ai_approval_requests_status", table_name="ai_approval_requests")
    op.drop_index("ix_ai_approval_requests_action_type", table_name="ai_approval_requests")
    op.drop_index("ix_ai_approval_requests_ai_execution_id", table_name="ai_approval_requests")
    op.drop_table("ai_approval_requests")

    op.drop_index("ix_manus_webhook_receipts_received_at", table_name="manus_webhook_receipts")
    op.drop_index("ix_manus_webhook_receipts_status", table_name="manus_webhook_receipts")
    op.drop_index("ix_manus_webhook_receipts_payload_hash", table_name="manus_webhook_receipts")
    op.drop_index("ix_manus_webhook_receipts_task_id", table_name="manus_webhook_receipts")
    op.drop_index("ix_manus_webhook_receipts_event_type", table_name="manus_webhook_receipts")
    op.drop_table("manus_webhook_receipts")

    op.drop_index("ix_manus_delegations_status", table_name="manus_delegations")
    op.drop_index("ix_manus_delegations_request_id", table_name="manus_delegations")
    op.drop_index("ix_manus_delegations_ai_execution_id", table_name="manus_delegations")
    op.drop_table("manus_delegations")

    op.drop_index("ix_ai_provider_attempts_external_request_id", table_name="ai_provider_attempts")
    op.drop_index("ix_ai_provider_attempts_status", table_name="ai_provider_attempts")
    op.drop_index("ix_ai_provider_attempts_provider", table_name="ai_provider_attempts")
    op.drop_index("ix_ai_provider_attempts_ai_execution_id", table_name="ai_provider_attempts")
    op.drop_table("ai_provider_attempts")

    op.drop_index("ix_ai_executions_input_fingerprint", table_name="ai_executions")
    op.drop_index("ix_ai_executions_selected_provider", table_name="ai_executions")
    op.drop_index("ix_ai_executions_status", table_name="ai_executions")
    op.drop_index("ix_ai_executions_execution_mode", table_name="ai_executions")
    op.drop_index("ix_ai_executions_data_class", table_name="ai_executions")
    op.drop_index("ix_ai_executions_task_class", table_name="ai_executions")
    op.drop_index("ix_ai_executions_correlation_id", table_name="ai_executions")
    op.drop_index("ix_ai_executions_requested_by_id", table_name="ai_executions")
    op.drop_index("ix_ai_executions_crawl_job_id", table_name="ai_executions")
    op.drop_table("ai_executions")
