"""Create executable commerce intelligence core tables.

Revision ID: 20260801_0002
Revises: 20260801_0001
Create Date: 2026-08-01
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260801_0002"
down_revision: str | None = "20260801_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _timestamps() -> list[sa.Column]:
    return [
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
    ]


def upgrade() -> None:
    op.add_column(
        "crawl_jobs",
        sa.Column("job_type", sa.String(length=50), nullable=False, server_default="collect"),
    )
    op.add_column(
        "crawl_jobs",
        sa.Column("trigger", sa.String(length=50), nullable=False, server_default="manual"),
    )
    op.add_column("crawl_jobs", sa.Column("requested_by_id", sa.Uuid(), nullable=True))
    op.add_column(
        "crawl_jobs",
        sa.Column("payload", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
    )
    op.add_column(
        "crawl_jobs",
        sa.Column("attempt", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "crawl_jobs",
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="3"),
    )
    op.add_column(
        "crawl_jobs",
        sa.Column("idempotency_key", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "crawl_jobs",
        sa.Column(
            "queued_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.add_column(
        "crawl_jobs",
        sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_crawl_jobs_requested_by_id_users",
        "crawl_jobs",
        "users",
        ["requested_by_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_unique_constraint(
        "uq_crawl_jobs_idempotency_key",
        "crawl_jobs",
        ["idempotency_key"],
    )
    op.create_index("ix_crawl_jobs_requested_by_id", "crawl_jobs", ["requested_by_id"])
    op.create_index("ix_crawl_jobs_status", "crawl_jobs", ["status"])

    op.create_table(
        "products",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=500), nullable=False),
        sa.Column("canonical_url", sa.String(length=2000), nullable=False),
        sa.Column("brand", sa.String(length=255), nullable=True),
        sa.Column("category", sa.String(length=255), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="BDT"),
        sa.Column("image_url", sa.String(length=2000), nullable=True),
        sa.Column("attributes", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "first_seen_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        *_timestamps(),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source_id", "external_id", name="uq_products_source_external_id"
        ),
    )
    op.create_index("ix_products_source_id", "products", ["source_id"])
    op.create_index("ix_products_name", "products", ["name"])
    op.create_index("ix_products_brand", "products", ["brand"])
    op.create_index("ix_products_category", "products", ["category"])
    op.create_index("ix_products_is_active", "products", ["is_active"])
    op.create_index("ix_products_last_seen_at", "products", ["last_seen_at"])

    op.create_table(
        "import_batches",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("uploaded_by_id", sa.Uuid(), nullable=True),
        sa.Column("filename", sa.String(length=500), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("rows_received", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rows_accepted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rows_rejected", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("errors", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_import_batches_source_id", "import_batches", ["source_id"])
    op.create_index("ix_import_batches_uploaded_by_id", "import_batches", ["uploaded_by_id"])
    op.create_index("ix_import_batches_status", "import_batches", ["status"])

    op.create_table(
        "product_observations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("crawl_job_id", sa.Uuid(), nullable=True),
        sa.Column("import_batch_id", sa.Uuid(), nullable=True),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("price", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("original_price", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="BDT"),
        sa.Column("availability", sa.String(length=50), nullable=False, server_default="unknown"),
        sa.Column("seller_name", sa.String(length=255), nullable=True),
        sa.Column("rating", sa.Numeric(precision=4, scale=2), nullable=True),
        sa.Column("review_count", sa.Integer(), nullable=True),
        sa.Column("source_url", sa.String(length=2000), nullable=False),
        sa.Column("collector", sa.String(length=100), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("evidence_hash", sa.String(length=64), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("raw_object_key", sa.String(length=1000), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("price >= 0", name="ck_product_observations_price_nonnegative"),
        sa.CheckConstraint(
            "original_price IS NULL OR original_price >= 0",
            name="ck_product_observations_original_price_nonnegative",
        ),
        sa.ForeignKeyConstraint(["crawl_job_id"], ["crawl_jobs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["import_batch_id"], ["import_batches.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key", name="uq_product_observations_idempotency_key"),
    )
    op.create_index("ix_product_observations_product_id", "product_observations", ["product_id"])
    op.create_index("ix_product_observations_crawl_job_id", "product_observations", ["crawl_job_id"])
    op.create_index("ix_product_observations_import_batch_id", "product_observations", ["import_batch_id"])
    op.create_index("ix_product_observations_observed_at", "product_observations", ["observed_at"])
    op.create_index("ix_product_observations_availability", "product_observations", ["availability"])
    op.create_index("ix_product_observations_evidence_hash", "product_observations", ["evidence_hash"])

    op.create_table(
        "alert_rules",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
        sa.Column("source_id", sa.Uuid(), nullable=True),
        sa.Column("product_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("rule_type", sa.String(length=50), nullable=False),
        sa.Column("threshold", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("config", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_triggered_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.CheckConstraint(
            "threshold IS NULL OR threshold >= 0",
            name="ck_alert_rules_threshold_nonnegative",
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_alert_rules_owner_id", "alert_rules", ["owner_id"])
    op.create_index("ix_alert_rules_source_id", "alert_rules", ["source_id"])
    op.create_index("ix_alert_rules_product_id", "alert_rules", ["product_id"])
    op.create_index("ix_alert_rules_rule_type", "alert_rules", ["rule_type"])
    op.create_index("ix_alert_rules_is_active", "alert_rules", ["is_active"])

    op.create_table(
        "alert_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("rule_id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("observation_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="open"),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column(
            "triggered_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["observation_id"], ["product_observations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["rule_id"], ["alert_rules.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "rule_id", "observation_id", name="uq_alert_events_rule_observation"
        ),
    )
    op.create_index("ix_alert_events_rule_id", "alert_events", ["rule_id"])
    op.create_index("ix_alert_events_product_id", "alert_events", ["product_id"])
    op.create_index("ix_alert_events_observation_id", "alert_events", ["observation_id"])
    op.create_index("ix_alert_events_status", "alert_events", ["status"])
    op.create_index("ix_alert_events_triggered_at", "alert_events", ["triggered_at"])

    op.create_table(
        "ai_insights",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("observation_id", sa.Uuid(), nullable=True),
        sa.Column("crawl_job_id", sa.Uuid(), nullable=True),
        sa.Column("kind", sa.String(length=100), nullable=False),
        sa.Column("model", sa.String(length=255), nullable=False),
        sa.Column("prompt_version", sa.String(length=100), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Numeric(precision=5, scale=4), nullable=True),
        sa.Column("evidence", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "confidence IS NULL OR (confidence >= 0 AND confidence <= 1)",
            name="ck_ai_insights_confidence_range",
        ),
        sa.ForeignKeyConstraint(["crawl_job_id"], ["crawl_jobs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["observation_id"], ["product_observations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key", name="uq_ai_insights_idempotency_key"),
    )
    op.create_index("ix_ai_insights_product_id", "ai_insights", ["product_id"])
    op.create_index("ix_ai_insights_observation_id", "ai_insights", ["observation_id"])
    op.create_index("ix_ai_insights_crawl_job_id", "ai_insights", ["crawl_job_id"])
    op.create_index("ix_ai_insights_kind", "ai_insights", ["kind"])
    op.create_index("ix_ai_insights_generated_at", "ai_insights", ["generated_at"])


def downgrade() -> None:
    op.drop_index("ix_ai_insights_generated_at", table_name="ai_insights")
    op.drop_index("ix_ai_insights_kind", table_name="ai_insights")
    op.drop_index("ix_ai_insights_crawl_job_id", table_name="ai_insights")
    op.drop_index("ix_ai_insights_observation_id", table_name="ai_insights")
    op.drop_index("ix_ai_insights_product_id", table_name="ai_insights")
    op.drop_table("ai_insights")

    op.drop_index("ix_alert_events_triggered_at", table_name="alert_events")
    op.drop_index("ix_alert_events_status", table_name="alert_events")
    op.drop_index("ix_alert_events_observation_id", table_name="alert_events")
    op.drop_index("ix_alert_events_product_id", table_name="alert_events")
    op.drop_index("ix_alert_events_rule_id", table_name="alert_events")
    op.drop_table("alert_events")

    op.drop_index("ix_alert_rules_is_active", table_name="alert_rules")
    op.drop_index("ix_alert_rules_rule_type", table_name="alert_rules")
    op.drop_index("ix_alert_rules_product_id", table_name="alert_rules")
    op.drop_index("ix_alert_rules_source_id", table_name="alert_rules")
    op.drop_index("ix_alert_rules_owner_id", table_name="alert_rules")
    op.drop_table("alert_rules")

    op.drop_index("ix_product_observations_evidence_hash", table_name="product_observations")
    op.drop_index("ix_product_observations_availability", table_name="product_observations")
    op.drop_index("ix_product_observations_observed_at", table_name="product_observations")
    op.drop_index("ix_product_observations_import_batch_id", table_name="product_observations")
    op.drop_index("ix_product_observations_crawl_job_id", table_name="product_observations")
    op.drop_index("ix_product_observations_product_id", table_name="product_observations")
    op.drop_table("product_observations")

    op.drop_index("ix_import_batches_status", table_name="import_batches")
    op.drop_index("ix_import_batches_uploaded_by_id", table_name="import_batches")
    op.drop_index("ix_import_batches_source_id", table_name="import_batches")
    op.drop_table("import_batches")

    op.drop_index("ix_products_last_seen_at", table_name="products")
    op.drop_index("ix_products_is_active", table_name="products")
    op.drop_index("ix_products_category", table_name="products")
    op.drop_index("ix_products_brand", table_name="products")
    op.drop_index("ix_products_name", table_name="products")
    op.drop_index("ix_products_source_id", table_name="products")
    op.drop_table("products")

    op.drop_index("ix_crawl_jobs_status", table_name="crawl_jobs")
    op.drop_index("ix_crawl_jobs_requested_by_id", table_name="crawl_jobs")
    op.drop_constraint("uq_crawl_jobs_idempotency_key", "crawl_jobs", type_="unique")
    op.drop_constraint("fk_crawl_jobs_requested_by_id_users", "crawl_jobs", type_="foreignkey")
    op.drop_column("crawl_jobs", "last_heartbeat_at")
    op.drop_column("crawl_jobs", "queued_at")
    op.drop_column("crawl_jobs", "idempotency_key")
    op.drop_column("crawl_jobs", "max_attempts")
    op.drop_column("crawl_jobs", "attempt")
    op.drop_column("crawl_jobs", "payload")
    op.drop_column("crawl_jobs", "requested_by_id")
    op.drop_column("crawl_jobs", "trigger")
    op.drop_column("crawl_jobs", "job_type")
