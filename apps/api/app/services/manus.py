from __future__ import annotations

import asyncio
import base64
import hashlib
import time
from dataclasses import dataclass
from typing import Any

import httpx
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey

from app.config import Settings, settings
from app.services.ai_routing import AIRoutingError, enforce_prompt_budget


class ManusServiceError(RuntimeError):
    """Permanent Manus policy, request, or response-contract failure."""


class TransientManusServiceError(ManusServiceError):
    """Retryable Manus control-plane availability or throttling failure."""


class ManusWebhookVerificationError(ManusServiceError):
    """Raised when a Manus webhook fails freshness or signature verification."""


@dataclass(frozen=True)
class CreatedManusTask:
    task_id: str
    title: str
    task_url: str
    request_id: str | None
    profile: str


MANUS_RESEARCH_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "claim": {"type": "string"},
                    "evidence": {"type": "string"},
                    "source_url": {"type": ["string", "null"]},
                    "confidence": {
                        "type": "string",
                        "enum": ["low", "medium", "high"],
                    },
                },
                "required": ["claim", "evidence", "source_url", "confidence"],
                "additionalProperties": False,
            },
        },
        "recommended_next_step": {"type": "string"},
        "requires_human_approval": {"type": "boolean"},
    },
    "required": [
        "summary",
        "findings",
        "recommended_next_step",
        "requires_human_approval",
    ],
    "additionalProperties": False,
}


class ManusClient:
    """Minimal first-party Manus v2 adapter with no implicit connector access."""

    def __init__(self, config: Settings | None = None) -> None:
        self.config = config or settings

    def _api_key(self) -> str:
        if not self.config.MANUS_ENABLED or self.config.MANUS_API_KEY is None:
            raise ManusServiceError("Manus provider is disabled")
        key = self.config.MANUS_API_KEY.get_secret_value()
        if not key:
            raise ManusServiceError("Manus provider is not configured")
        return key

    def _headers(self) -> dict[str, str]:
        return {
            "x-manus-api-key": self._api_key(),
            "Content-Type": "application/json",
        }

    def _validate_scope(
        self,
        *,
        profile: str,
        connector_ids: tuple[str, ...],
        skill_ids: tuple[str, ...],
    ) -> None:
        if profile not in self.config.manus_allowed_agent_profiles:
            raise ManusServiceError("Manus agent profile is not allowlisted")
        if not set(connector_ids).issubset(self.config.manus_allowed_connector_ids):
            raise ManusServiceError("One or more Manus connectors are not allowlisted")
        if not set(skill_ids).issubset(self.config.manus_allowed_skill_ids):
            raise ManusServiceError("One or more Manus skills are not allowlisted")
        if not skill_ids and not self.config.MANUS_ALLOW_ACCOUNT_DEFAULT_SKILLS:
            raise ManusServiceError("Explicit Manus skill selection is required")

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json_payload: dict[str, Any] | None = None,
        params: dict[str, str | int] | None = None,
    ) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(
                base_url=self.config.MANUS_API_BASE_URL.rstrip("/"),
                timeout=self.config.MANUS_TIMEOUT_SECONDS,
            ) as client:
                response = await client.request(
                    method,
                    path,
                    headers=self._headers(),
                    json=json_payload,
                    params=params,
                )
        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            raise TransientManusServiceError("Manus API is unavailable or timed out") from exc

        if response.status_code >= 500 or response.status_code in {408, 409, 429}:
            raise TransientManusServiceError(
                f"Manus API returned retryable status {response.status_code}"
            )
        if response.status_code != 200:
            raise ManusServiceError(f"Manus API returned status {response.status_code}")
        try:
            payload = response.json()
        except ValueError as exc:
            raise ManusServiceError("Manus API returned invalid JSON") from exc
        if not isinstance(payload, dict) or payload.get("ok") is not True:
            raise ManusServiceError("Manus API returned an unsuccessful response")
        return payload

    async def create_task(
        self,
        *,
        prompt: str,
        title: str,
        profile: str | None = None,
        connector_ids: tuple[str, ...] = (),
        skill_ids: tuple[str, ...] | None = None,
        structured_output_schema: dict[str, Any] | None = None,
        interactive_mode: bool = False,
    ) -> CreatedManusTask:
        """Create one private, project-bound, policy-scoped Manus task."""
        selected_profile = profile or self.config.MANUS_DEFAULT_AGENT_PROFILE
        selected_skills = (
            skill_ids if skill_ids is not None else self.config.manus_allowed_skill_ids
        )
        self._validate_scope(
            profile=selected_profile,
            connector_ids=connector_ids,
            skill_ids=selected_skills,
        )
        try:
            enforce_prompt_budget(prompt, self.config)
        except AIRoutingError as exc:
            raise ManusServiceError(str(exc)) from exc
        if not self.config.MANUS_PROJECT_ID:
            raise ManusServiceError("Manus project is not configured")

        message: dict[str, Any] = {
            "content": prompt,
            "connectors": list(connector_ids),
        }
        if selected_skills:
            message["enable_skills"] = list(selected_skills)

        payload: dict[str, Any] = {
            "message": message,
            "project_id": self.config.MANUS_PROJECT_ID,
            "locale": "en",
            "interactive_mode": interactive_mode,
            "hide_in_task_list": False,
            "share_visibility": "private",
            "agent_profile": selected_profile,
            "title": title[:255],
            "structured_output_schema": (structured_output_schema or MANUS_RESEARCH_OUTPUT_SCHEMA),
        }
        result = await self._request("POST", "/v2/task.create", json_payload=payload)
        task_id = result.get("task_id")
        task_url = result.get("task_url")
        task_title = result.get("task_title")
        if (
            not isinstance(task_id, str)
            or not task_id
            or not isinstance(task_url, str)
            or not task_url
            or not isinstance(task_title, str)
            or not task_title
        ):
            raise ManusServiceError("Manus API returned an invalid task envelope")
        if result.get("share_visibility", "private") != "private":
            raise ManusServiceError("Manus task visibility is not private")
        request_id = result.get("request_id")
        return CreatedManusTask(
            task_id=task_id,
            title=task_title,
            task_url=task_url,
            request_id=request_id if isinstance(request_id, str) else None,
            profile=selected_profile,
        )

    async def list_messages(
        self,
        task_id: str,
        *,
        order: str = "asc",
        limit: int = 100,
    ) -> dict[str, Any]:
        if order not in {"asc", "desc"}:
            raise ManusServiceError("Invalid Manus message order")
        if not 1 <= limit <= 100:
            raise ManusServiceError("Invalid Manus message limit")
        return await self._request(
            "GET",
            "/v2/task.listMessages",
            params={"task_id": task_id, "order": order, "limit": limit},
        )

    async def get_webhook_public_key(self) -> str:
        payload = await self._request("GET", "/v2/webhook.publicKey")
        public_key = payload.get("public_key")
        if payload.get("algorithm") != "RSA-SHA256":
            raise ManusServiceError("Unsupported Manus webhook signature algorithm")
        if not isinstance(public_key, str) or "BEGIN PUBLIC KEY" not in public_key:
            raise ManusServiceError("Manus API returned an invalid webhook public key")
        return public_key


class ManusWebhookVerifier:
    """Verify Manus RSA-SHA256 callbacks with a bounded public-key cache."""

    def __init__(
        self,
        client: ManusClient | None = None,
        config: Settings | None = None,
    ) -> None:
        self.config = config or settings
        self.client = client or ManusClient(self.config)
        self._public_key: str | None = None
        self._expires_at = 0.0
        self._lock = asyncio.Lock()

    async def _get_public_key(self, *, refresh: bool = False) -> str:
        now = time.monotonic()
        if not refresh and self._public_key is not None and now < self._expires_at:
            return self._public_key
        async with self._lock:
            now = time.monotonic()
            if not refresh and self._public_key is not None and now < self._expires_at:
                return self._public_key
            self._public_key = await self.client.get_webhook_public_key()
            self._expires_at = now + self.config.MANUS_PUBLIC_KEY_TTL_SECONDS
            return self._public_key

    def _verify_with_key(
        self,
        *,
        public_key_pem: str,
        url: str,
        body: bytes,
        signature_b64: str,
        timestamp: str,
    ) -> None:
        body_hash = hashlib.sha256(body).hexdigest()
        signed_content = f"{timestamp}.{url}.{body_hash}".encode()
        try:
            signature = base64.b64decode(signature_b64, validate=True)
            key = serialization.load_pem_public_key(public_key_pem.encode())
            if not isinstance(key, RSAPublicKey):
                raise TypeError("Manus webhook public key must be RSA")
            key.verify(signature, signed_content, padding.PKCS1v15(), hashes.SHA256())
        except (InvalidSignature, TypeError, ValueError) as exc:
            raise ManusWebhookVerificationError("Invalid Manus webhook signature") from exc

    async def verify(
        self,
        *,
        body: bytes,
        signature_b64: str | None,
        timestamp: str | None,
        now_seconds: int | None = None,
    ) -> None:
        """Verify freshness and signature against the configured external callback URL."""
        if not signature_b64 or not timestamp:
            raise ManusWebhookVerificationError("Missing Manus webhook signature headers")
        if len(signature_b64) > 4096 or len(timestamp) > 32:
            raise ManusWebhookVerificationError("Invalid Manus webhook signature headers")
        try:
            signed_at = int(timestamp)
        except ValueError as exc:
            raise ManusWebhookVerificationError("Invalid Manus webhook timestamp") from exc
        current = int(time.time()) if now_seconds is None else now_seconds
        if abs(current - signed_at) > self.config.MANUS_WEBHOOK_MAX_AGE_SECONDS:
            raise ManusWebhookVerificationError("Expired Manus webhook timestamp")
        if not self.config.MANUS_WEBHOOK_PUBLIC_URL:
            raise ManusWebhookVerificationError("Manus webhook public URL is not configured")

        public_key = await self._get_public_key()
        try:
            self._verify_with_key(
                public_key_pem=public_key,
                url=self.config.MANUS_WEBHOOK_PUBLIC_URL,
                body=body,
                signature_b64=signature_b64,
                timestamp=timestamp,
            )
        except ManusWebhookVerificationError:
            refreshed_key = await self._get_public_key(refresh=True)
            self._verify_with_key(
                public_key_pem=refreshed_key,
                url=self.config.MANUS_WEBHOOK_PUBLIC_URL,
                body=body,
                signature_b64=signature_b64,
                timestamp=timestamp,
            )
