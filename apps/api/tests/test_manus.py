from __future__ import annotations

import base64
import hashlib
import json
from typing import Any

import httpx
import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from pydantic import SecretStr

from app.config import Settings
from app.services.manus import (
    ManusClient,
    ManusServiceError,
    ManusWebhookVerificationError,
    ManusWebhookVerifier,
)


def _settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "ENVIRONMENT": "test",
        "DATABASE_URL": "sqlite+aiosqlite:///./test.db",
        "MANUS_ENABLED": True,
        "MANUS_API_KEY": SecretStr("manus-secret"),
        "MANUS_PROJECT_ID": "project-nexora",
        "MANUS_ALLOWED_AGENT_PROFILES": "manus-1.6-lite,manus-1.6",
        "MANUS_DEFAULT_AGENT_PROFILE": "manus-1.6",
        "MANUS_ALLOWED_CONNECTOR_IDS": "connector-approved",
        "MANUS_ALLOWED_SKILL_IDS": "skill-research",
        "MANUS_WEBHOOK_PUBLIC_URL": "https://api.example.com/api/v1/webhooks/manus",
    }
    values.update(overrides)
    return Settings(**values)


@pytest.mark.asyncio
async def test_manus_task_is_private_project_bound_and_explicitly_scoped(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    class FakeClient:
        def __init__(self, **kwargs: Any) -> None:
            captured["client"] = kwargs

        async def __aenter__(self) -> FakeClient:
            return self

        async def __aexit__(self, *_: Any) -> None:
            return None

        async def request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
            captured["method"] = method
            captured["path"] = path
            captured["request"] = kwargs
            return httpx.Response(
                200,
                json={
                    "ok": True,
                    "request_id": "request-1",
                    "task_id": "task-1",
                    "task_title": "NEXORA research",
                    "task_url": "https://manus.im/app/task-1",
                    "share_visibility": "private",
                },
                request=httpx.Request("POST", "https://api.manus.ai/v2/task.create"),
            )

    monkeypatch.setattr("app.services.manus.httpx.AsyncClient", FakeClient)
    created = await ManusClient(_settings()).create_task(
        prompt="Research this approved public topic and return sourced findings.",
        title="NEXORA research",
        connector_ids=("connector-approved",),
    )

    assert created.task_id == "task-1"
    assert captured["path"] == "/v2/task.create"
    payload = captured["request"]["json"]
    assert payload["project_id"] == "project-nexora"
    assert payload["share_visibility"] == "private"
    assert payload["interactive_mode"] is False
    assert payload["message"]["connectors"] == ["connector-approved"]
    assert payload["message"]["enable_skills"] == ["skill-research"]
    assert payload["structured_output_schema"]["additionalProperties"] is False
    assert captured["request"]["headers"]["x-manus-api-key"] == "manus-secret"


@pytest.mark.asyncio
async def test_manus_rejects_unapproved_connector_before_network_call() -> None:
    with pytest.raises(ManusServiceError, match="connectors are not allowlisted"):
        await ManusClient(_settings()).create_task(
            prompt="Research a topic.",
            title="Blocked task",
            connector_ids=("connector-unapproved",),
        )


@pytest.mark.asyncio
async def test_manus_webhook_signature_verification_and_key_cache() -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_pem = (
        private_key.public_key()
        .public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode()
    )

    class FakeManusClient:
        def __init__(self) -> None:
            self.calls = 0

        async def get_webhook_public_key(self) -> str:
            self.calls += 1
            return public_pem

    config = _settings(MANUS_WEBHOOK_MAX_AGE_SECONDS=300)
    fake = FakeManusClient()
    verifier = ManusWebhookVerifier(client=fake, config=config)  # type: ignore[arg-type]
    body = json.dumps({"event_id": "evt-1", "event_type": "task.completed"}).encode()
    timestamp = "1704067200"
    digest = hashlib.sha256(body).hexdigest()
    signed = f"{timestamp}.{config.MANUS_WEBHOOK_PUBLIC_URL}.{digest}".encode()
    signature = base64.b64encode(
        private_key.sign(signed, padding.PKCS1v15(), hashes.SHA256())
    ).decode()

    await verifier.verify(
        body=body,
        signature_b64=signature,
        timestamp=timestamp,
        now_seconds=1704067200,
    )
    await verifier.verify(
        body=body,
        signature_b64=signature,
        timestamp=timestamp,
        now_seconds=1704067201,
    )
    assert fake.calls == 1


@pytest.mark.asyncio
async def test_manus_webhook_rejects_expired_timestamp_without_fetching_key() -> None:
    class FakeManusClient:
        def __init__(self) -> None:
            self.calls = 0

        async def get_webhook_public_key(self) -> str:
            self.calls += 1
            return "unused"

    fake = FakeManusClient()
    verifier = ManusWebhookVerifier(client=fake, config=_settings())  # type: ignore[arg-type]
    with pytest.raises(ManusWebhookVerificationError, match="Expired"):
        await verifier.verify(
            body=b"{}",
            signature_b64="not-used",
            timestamp="100",
            now_seconds=1000,
        )
    assert fake.calls == 0
