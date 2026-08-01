from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai import (
    AIApprovalRequest,
    AIExecution,
    ManusDelegation,
    ManusWebhookReceipt,
)
from app.services.manus import ManusWebhookVerificationError


async def _delegated_execution(db_session: AsyncSession, *, task_id: str) -> AIExecution:
    execution = AIExecution(
        correlation_id=f"test-{uuid.uuid4()}",
        idempotency_key=f"test-manus-{uuid.uuid4()}",
        task_class="strategic_research",
        data_class="public",
        execution_mode="async_external",
        status="delegated",
        policy_version="ai-routing-v1",
        requested_provider="manus",
        selected_provider="manus",
        selected_model="manus-1.6",
        input_fingerprint="a" * 64,
        routing={"selected": "manus/manus-1.6"},
        budget={},
        result={"task_id": task_id, "status": "created"},
        requires_human_approval=False,
        started_at=datetime.now(UTC),
    )
    db_session.add(execution)
    await db_session.flush()
    db_session.add(
        ManusDelegation(
            ai_execution_id=execution.id,
            task_id=task_id,
            task_url=f"https://manus.im/app/{task_id}",
            agent_profile="manus-1.6",
            status="created",
            structured_result={},
        )
    )
    await db_session.commit()
    return execution


@pytest.mark.asyncio
async def test_manus_webhook_reconciles_structured_result_and_replay(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    execution = await _delegated_execution(db_session, task_id="task-webhook-001")

    async def accept_signature(**_: Any) -> None:
        return None

    monkeypatch.setattr("app.api.webhooks._verifier.verify", accept_signature)
    payload = {
        "event_id": "task_stopped_task-webhook-001_1",
        "event_type": "task_stopped",
        "task_detail": {
            "task_id": "task-webhook-001",
            "task_title": "Research",
            "task_url": "https://manus.im/app/task-webhook-001",
            "message": "Research completed.",
            "stop_reason": "finish",
            "attachments": [],
            "structured_output": {
                "success": True,
                "value": {
                    "summary": "Evidence-backed result.",
                    "findings": [
                        {
                            "claim": "Verified claim",
                            "evidence": "Primary-source evidence",
                            "source_url": "https://example.com/source",
                            "confidence": "high",
                        }
                    ],
                    "recommended_next_step": "Review before any external action.",
                    "requires_human_approval": True,
                },
                "error": None,
            },
        },
    }
    headers = {
        "X-Webhook-Signature": "test-signature",
        "X-Webhook-Timestamp": "1704067200",
    }
    first = await client.post("/api/v1/webhooks/manus", json=payload, headers=headers)
    assert first.status_code == 200, first.text
    assert first.json()["status"] == "processed"
    assert first.json()["idempotent_replay"] is False

    replay = await client.post("/api/v1/webhooks/manus", json=payload, headers=headers)
    assert replay.status_code == 200, replay.text
    assert replay.json()["idempotent_replay"] is True

    await db_session.refresh(execution)
    delegation = await db_session.scalar(
        select(ManusDelegation).where(ManusDelegation.ai_execution_id == execution.id)
    )
    assert delegation is not None
    assert execution.status == "succeeded"
    assert execution.requires_human_approval is True
    assert delegation.status == "completed"
    assert delegation.structured_result["summary"] == "Evidence-backed result."
    assert await db_session.scalar(select(func.count(ManusWebhookReceipt.id))) == 1
    approval = await db_session.scalar(
        select(AIApprovalRequest).where(AIApprovalRequest.ai_execution_id == execution.id)
    )
    assert approval is not None
    assert approval.status == "pending"
    assert approval.action_type == "manus_recommended_next_step"
    receipt = await db_session.scalar(select(ManusWebhookReceipt))
    assert receipt is not None
    assert "message" not in receipt.normalized_event
    assert "structured_output" not in receipt.normalized_event


@pytest.mark.asyncio
async def test_manus_webhook_rejects_invalid_signature(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def reject_signature(**_: Any) -> None:
        raise ManusWebhookVerificationError("invalid")

    monkeypatch.setattr("app.api.webhooks._verifier.verify", reject_signature)
    response = await client.post(
        "/api/v1/webhooks/manus",
        json={
            "event_id": "evt-invalid-signature",
            "event_type": "task_created",
            "task_detail": {
                "task_id": "task-invalid",
                "task_title": "Invalid",
                "task_url": "https://manus.im/app/task-invalid",
            },
        },
        headers={
            "X-Webhook-Signature": "bad",
            "X-Webhook-Timestamp": "1704067200",
        },
    )
    assert response.status_code == 401
    assert response.json()["error"]["message"] == "Invalid Manus webhook signature"


@pytest.mark.asyncio
async def test_manus_webhook_marks_invalid_structured_output_failed(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    execution = await _delegated_execution(db_session, task_id="task-webhook-invalid")

    async def accept_signature(**_: Any) -> None:
        return None

    monkeypatch.setattr("app.api.webhooks._verifier.verify", accept_signature)
    response = await client.post(
        "/api/v1/webhooks/manus",
        json={
            "event_id": "task_stopped_task-webhook-invalid_1",
            "event_type": "task_stopped",
            "task_detail": {
                "task_id": "task-webhook-invalid",
                "task_title": "Invalid result",
                "task_url": "https://manus.im/app/task-webhook-invalid",
                "message": "Finished",
                "stop_reason": "finish",
                "structured_output": {
                    "success": True,
                    "value": {"summary": "Missing required fields"},
                    "error": None,
                },
            },
        },
        headers={
            "X-Webhook-Signature": "test-signature",
            "X-Webhook-Timestamp": "1704067200",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "processed_with_validation_failure"
    await db_session.refresh(execution)
    assert execution.status == "failed"
    assert execution.error_type == "StructuredOutputValidationError"
