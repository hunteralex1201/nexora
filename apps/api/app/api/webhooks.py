from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import DatabaseSession
from app.config import settings
from app.models.ai import (
    AIApprovalRequest,
    AIExecution,
    ManusDelegation,
    ManusWebhookReceipt,
)
from app.services.manus import ManusWebhookVerificationError, ManusWebhookVerifier

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
_verifier = ManusWebhookVerifier()
_ALLOWED_EVENT_TYPES = {"task_created", "task_stopped"}


class ManusFinding(BaseModel):
    model_config = ConfigDict(extra="forbid")

    claim: str = Field(min_length=1)
    evidence: str = Field(min_length=1)
    source_url: str | None
    confidence: Literal["low", "medium", "high"]


class ManusResearchResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(min_length=1)
    findings: list[ManusFinding]
    recommended_next_step: str = Field(min_length=1)
    requires_human_approval: bool


def _text(value: Any, *, field: str, max_length: int) -> str:
    if not isinstance(value, str) or not value or len(value) > max_length:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Manus webhook {field}",
        )
    return value


def _normalize_event(payload: Any) -> tuple[str, str, str, dict[str, Any], dict[str, Any]]:
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Manus webhook envelope",
        )
    event_id = _text(payload.get("event_id"), field="event_id", max_length=255)
    event_type = _text(payload.get("event_type"), field="event_type", max_length=100)
    if event_type not in _ALLOWED_EVENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported Manus webhook event type",
        )
    task_detail = payload.get("task_detail")
    if not isinstance(task_detail, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Manus webhook task_detail",
        )
    task_id = _text(task_detail.get("task_id"), field="task_id", max_length=255)
    normalized: dict[str, Any] = {"task_id": task_id}
    if event_type == "task_stopped":
        stop_reason = _text(task_detail.get("stop_reason"), field="stop_reason", max_length=50)
        if stop_reason not in {"finish", "ask"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Manus webhook stop_reason",
            )
        structured = task_detail.get("structured_output")
        normalized.update(
            {
                "stop_reason": stop_reason,
                "has_attachments": bool(task_detail.get("attachments")),
                "structured_output_present": isinstance(structured, dict),
                "structured_output_success": (
                    structured.get("success") if isinstance(structured, dict) else None
                ),
            }
        )
    return event_id, event_type, task_id, task_detail, normalized


def _approval_for_ask(
    *,
    execution: AIExecution,
    event_id: str,
    task_id: str,
    message: Any,
) -> AIApprovalRequest:
    safe_message = message[:2000] if isinstance(message, str) else "Manus needs user input."
    return AIApprovalRequest(
        ai_execution_id=execution.id,
        action_type="manus_user_input",
        status="pending",
        summary=safe_message,
        details={"task_id": task_id, "event_id": event_id},
    )


def _approval_for_result(
    *,
    execution: AIExecution,
    event_id: str,
    task_id: str,
    result: ManusResearchResult,
) -> AIApprovalRequest:
    return AIApprovalRequest(
        ai_execution_id=execution.id,
        action_type="manus_recommended_next_step",
        status="pending",
        summary=result.recommended_next_step[:2000],
        details={"task_id": task_id, "event_id": event_id},
    )


def _apply_stopped_event(
    *,
    receipt: ManusWebhookReceipt,
    delegation: ManusDelegation,
    execution: AIExecution,
    event_id: str,
    task_id: str,
    task_detail: dict[str, Any],
) -> AIApprovalRequest | None:
    now = datetime.now(UTC)
    stop_reason = task_detail["stop_reason"]
    if stop_reason == "ask":
        delegation.status = "waiting_for_human"
        delegation.last_reconciled_at = now
        execution.status = "waiting_for_human"
        execution.requires_human_approval = True
        receipt.status = "processed"
        receipt.processed_at = now
        return _approval_for_ask(
            execution=execution,
            event_id=event_id,
            task_id=task_id,
            message=task_detail.get("message"),
        )

    structured = task_detail.get("structured_output")
    try:
        if not isinstance(structured, dict) or structured.get("success") is not True:
            raise ValueError("Structured output was not successful")
        result = ManusResearchResult.model_validate(structured.get("value"))
    except (ValidationError, ValueError, TypeError):
        delegation.status = "failed_validation"
        delegation.last_reconciled_at = now
        delegation.terminal_at = now
        execution.status = "failed"
        execution.error_type = "StructuredOutputValidationError"
        execution.error_message = "Manus structured output failed validation"
        execution.completed_at = now
        receipt.status = "processed_with_validation_failure"
        receipt.processed_at = now
        return None

    validated = result.model_dump(mode="json")
    delegation.status = "completed"
    delegation.structured_result = validated
    delegation.last_reconciled_at = now
    delegation.terminal_at = now
    execution.status = "succeeded"
    execution.result = {
        "task_id": task_id,
        "status": "completed",
        "requires_human_approval": result.requires_human_approval,
    }
    execution.requires_human_approval = result.requires_human_approval
    execution.completed_at = now
    receipt.status = "processed"
    receipt.processed_at = now
    if result.requires_human_approval:
        return _approval_for_result(
            execution=execution,
            event_id=event_id,
            task_id=task_id,
            result=result,
        )
    return None


@router.post("/manus")
async def receive_manus_webhook(
    request: Request,
    db: DatabaseSession,
    x_webhook_signature: str | None = Header(default=None, alias="X-Webhook-Signature"),
    x_webhook_timestamp: str | None = Header(default=None, alias="X-Webhook-Timestamp"),
) -> dict[str, Any]:
    """Verify and reconcile one Manus lifecycle callback without trusting its body."""
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > settings.MANUS_WEBHOOK_MAX_BODY_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                    detail="Manus webhook body is too large",
                )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid content length",
            ) from exc

    body = await request.body()
    if not body or len(body) > settings.MANUS_WEBHOOK_MAX_BODY_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="Manus webhook body is empty or too large",
        )
    try:
        await _verifier.verify(
            body=body,
            signature_b64=x_webhook_signature,
            timestamp=x_webhook_timestamp,
        )
    except ManusWebhookVerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Manus webhook signature",
        ) from exc

    try:
        payload = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Manus webhook JSON",
        ) from exc
    event_id, event_type, task_id, task_detail, normalized = _normalize_event(payload)
    payload_hash = hashlib.sha256(body).hexdigest()
    signature_hash = hashlib.sha256((x_webhook_signature or "").encode()).hexdigest()

    existing = await db.scalar(
        select(ManusWebhookReceipt).where(ManusWebhookReceipt.event_id == event_id)
    )
    if existing is not None:
        if existing.payload_hash != payload_hash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Manus webhook event identifier collision",
            )
        return {
            "ok": True,
            "event_id": event_id,
            "status": existing.status,
            "idempotent_replay": True,
        }

    receipt = ManusWebhookReceipt(
        event_id=event_id,
        event_type=event_type,
        task_id=task_id,
        payload_hash=payload_hash,
        signature_hash=signature_hash,
        normalized_event=normalized,
        status="received",
    )
    db.add(receipt)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        existing = await db.scalar(
            select(ManusWebhookReceipt).where(ManusWebhookReceipt.event_id == event_id)
        )
        if existing is None or existing.payload_hash != payload_hash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Manus webhook event identifier collision",
            ) from exc
        return {
            "ok": True,
            "event_id": event_id,
            "status": existing.status,
            "idempotent_replay": True,
        }

    delegation = await db.scalar(select(ManusDelegation).where(ManusDelegation.task_id == task_id))
    if delegation is None:
        receipt.status = "unmatched"
        receipt.processed_at = datetime.now(UTC)
        await db.commit()
        return {
            "ok": True,
            "event_id": event_id,
            "status": "unmatched",
            "idempotent_replay": False,
        }

    execution = await db.get(AIExecution, delegation.ai_execution_id)
    if execution is None:
        receipt.status = "orphaned"
        receipt.processed_at = datetime.now(UTC)
        await db.commit()
        return {
            "ok": True,
            "event_id": event_id,
            "status": "orphaned",
            "idempotent_replay": False,
        }

    approval: AIApprovalRequest | None = None
    if event_type == "task_created":
        delegation.status = "created"
        delegation.last_reconciled_at = datetime.now(UTC)
        receipt.status = "processed"
        receipt.processed_at = datetime.now(UTC)
    else:
        approval = _apply_stopped_event(
            receipt=receipt,
            delegation=delegation,
            execution=execution,
            event_id=event_id,
            task_id=task_id,
            task_detail=task_detail,
        )
    if approval is not None:
        db.add(approval)
    await db.commit()
    return {
        "ok": True,
        "event_id": event_id,
        "status": receipt.status,
        "idempotent_replay": False,
    }
