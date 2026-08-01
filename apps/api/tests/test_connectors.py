from __future__ import annotations

import socket
from typing import Any

import httpx
import pytest

from app.connectors.base import ConnectorSafetyError, TransientConnectorError
from app.connectors.jsonld import JsonLdProductConnector
from app.connectors.safety import _stream_limited, validate_public_url
from app.models.source import Source


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("url", "allowed_domains", "message"),
    [
        (
            "http://127.0.0.1/admin",
            {"127.0.0.1"},
            "non-public network address",
        ),
        (
            "http://user:secret@example.com/product",
            {"example.com"},
            "Credential-bearing URLs",
        ),
        (
            "https://evil-example.com/product",
            {"example.com"},
            "outside the source allowlist",
        ),
        (
            "file:///etc/passwd",
            {"example.com"},
            "Only HTTP and HTTPS",
        ),
    ],
)
async def test_url_safety_rejects_ssrf_and_allowlist_bypasses(
    url: str,
    allowed_domains: set[str],
    message: str,
) -> None:
    with pytest.raises(ConnectorSafetyError, match=message):
        await validate_public_url(url, allowed_domains)


@pytest.mark.asyncio
async def test_url_safety_accepts_allowlisted_public_subdomain(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def public_dns(*_: Any, **__: Any) -> list[tuple[Any, ...]]:
        return [
            (
                socket.AF_INET,
                socket.SOCK_STREAM,
                socket.IPPROTO_TCP,
                "",
                ("93.184.216.34", 443),
            )
        ]

    monkeypatch.setattr(socket, "getaddrinfo", public_dns)
    await validate_public_url("https://shop.example.com/item", {"example.com"})


@pytest.mark.asyncio
async def test_streaming_limit_rejects_oversized_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.connectors.safety.MAX_RESPONSE_BYTES", 8)
    transport = httpx.MockTransport(
        lambda request: httpx.Response(
            200,
            headers={"content-type": "text/html"},
            content=b"123456789",
            request=request,
        )
    )
    async with httpx.AsyncClient(transport=transport) as client:
        with pytest.raises(ConnectorSafetyError, match="2 MB safety limit"):
            await _stream_limited(client, "https://example.com/oversized")


@pytest.mark.asyncio
async def test_jsonld_connector_extracts_only_evidenced_product(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    html = """
    <html><head>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Product",
        "sku": "sku-100",
        "name": "Verified Rice 5 kg",
        "url": "https://shop.example.com/products/rice-5kg",
        "brand": {"@type": "Brand", "name": "Example Foods"},
        "category": "Groceries",
        "offers": {
          "@type": "Offer",
          "price": "625.00",
          "priceCurrency": "BDT",
          "availability": "https://schema.org/InStock",
          "seller": {"@type": "Organization", "name": "Example Shop"}
        },
        "aggregateRating": {"ratingValue": "4.5", "reviewCount": "12"}
      }
      </script>
    </head></html>
    """

    async def fake_fetch(**_: Any) -> tuple[str, dict[str, object]]:
        return html, {
            "original_url": "https://shop.example.com/products/rice-5kg",
            "final_url": "https://shop.example.com/products/rice-5kg",
            "http_status": 200,
            "content_type": "text/html",
            "response_size": len(html.encode()),
            "redirects": 0,
        }

    monkeypatch.setattr("app.connectors.jsonld.fetch_public_text", fake_fetch)
    source = Source(
        name="Example JSON-LD",
        type="generic_jsonld",
        base_url="https://shop.example.com",
        config={"allowed_domains": ["shop.example.com"]},
        is_active=True,
    )
    result = await JsonLdProductConnector().collect(
        source,
        {"targets": ["https://shop.example.com/products/rice-5kg"]},
    )

    assert result.metrics == {"targets": 1, "records": 1}
    assert len(result.items) == 1
    item = result.items[0]
    assert item.external_id == "sku-100"
    assert item.name == "Verified Rice 5 kg"
    assert str(item.price) == "625.00"
    assert item.currency == "BDT"
    assert item.availability == "in_stock"
    assert item.brand == "Example Foods"
    assert item.seller_name == "Example Shop"
    assert str(item.rating) == "4.5"
    assert item.review_count == 12
    assert item.evidence["classification"] == "VERIFIED"
    assert item.evidence["connector_id"] == "generic-jsonld-product"
    assert item.evidence["content_hash"] == result.artifacts[0]["content_hash"]


@pytest.mark.asyncio
async def test_fetch_public_text_follows_validated_redirect_and_returns_metadata(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.connectors import safety

    validated: list[str] = []

    async def accept_public_url(url: str, _allowed_domains: set[str]) -> None:
        validated.append(url)

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/start":
            return httpx.Response(302, headers={"location": "/final"}, request=request)
        return httpx.Response(
            200,
            headers={"content-type": "text/html; charset=utf-8"},
            content=b"<html>evidence</html>",
            request=request,
        )

    transport = httpx.MockTransport(handler)
    original_client = httpx.AsyncClient
    monkeypatch.setattr(safety, "validate_public_url", accept_public_url)
    monkeypatch.setattr(
        safety.httpx,
        "AsyncClient",
        lambda **kwargs: original_client(transport=transport, **kwargs),
    )

    body, metadata = await safety.fetch_public_text(
        url="https://example.com/start",
        allowed_domains={"example.com"},
        timeout_seconds=5,
        user_agent="NEXORA-Test/1.0",
    )
    assert body == "<html>evidence</html>"
    assert metadata == {
        "original_url": "https://example.com/start",
        "final_url": "https://example.com/final",
        "http_status": 200,
        "content_type": "text/html; charset=utf-8",
        "response_size": 21,
        "redirects": 1,
    }
    assert validated == ["https://example.com/start", "https://example.com/final"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("status_code", "content_type", "expected_exception", "message"),
    [
        (403, "text/html", ConnectorSafetyError, "denied collection"),
        (503, "text/html", TransientConnectorError, "returned HTTP 503"),
        (404, "text/html", ConnectorSafetyError, "returned HTTP 404"),
        (200, "image/png", ConnectorSafetyError, "not HTML or JSON"),
    ],
)
async def test_fetch_public_text_classifies_remote_failures(
    monkeypatch: pytest.MonkeyPatch,
    status_code: int,
    content_type: str,
    expected_exception: type[Exception],
    message: str,
) -> None:
    from app.connectors import safety

    async def accept_public_url(_url: str, _allowed_domains: set[str]) -> None:
        return None

    transport = httpx.MockTransport(
        lambda request: httpx.Response(
            status_code,
            headers={"content-type": content_type},
            content=b"response",
            request=request,
        )
    )
    original_client = httpx.AsyncClient
    monkeypatch.setattr(safety, "validate_public_url", accept_public_url)
    monkeypatch.setattr(
        safety.httpx,
        "AsyncClient",
        lambda **kwargs: original_client(transport=transport, **kwargs),
    )
    with pytest.raises(expected_exception, match=message):
        await safety.fetch_public_text(
            url="https://example.com/product",
            allowed_domains={"example.com"},
            timeout_seconds=5,
            user_agent="NEXORA-Test/1.0",
        )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("with_location", "message"),
    [
        (False, "Redirect omitted its destination"),
        (True, "Redirect limit exceeded"),
    ],
)
async def test_fetch_public_text_rejects_unsafe_redirect_sequences(
    monkeypatch: pytest.MonkeyPatch,
    with_location: bool,
    message: str,
) -> None:
    from app.connectors import safety

    async def accept_public_url(_url: str, _allowed_domains: set[str]) -> None:
        return None

    def handler(request: httpx.Request) -> httpx.Response:
        headers = {"location": "/again"} if with_location else {}
        return httpx.Response(302, headers=headers, request=request)

    transport = httpx.MockTransport(handler)
    original_client = httpx.AsyncClient
    monkeypatch.setattr(safety, "validate_public_url", accept_public_url)
    monkeypatch.setattr(
        safety.httpx,
        "AsyncClient",
        lambda **kwargs: original_client(transport=transport, **kwargs),
    )
    with pytest.raises(ConnectorSafetyError, match=message):
        await safety.fetch_public_text(
            url="https://example.com/start",
            allowed_domains={"example.com"},
            timeout_seconds=5,
            user_agent="NEXORA-Test/1.0",
        )


@pytest.mark.asyncio
async def test_url_safety_accepts_allowlisted_public_literal_ip() -> None:
    await validate_public_url("https://8.8.8.8/product", {"8.8.8.8"})


@pytest.mark.asyncio
async def test_url_safety_classifies_dns_failure_as_transient(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def failed_dns(*_: Any, **__: Any) -> list[tuple[Any, ...]]:
        raise socket.gaierror("temporary DNS failure")

    monkeypatch.setattr(socket, "getaddrinfo", failed_dns)
    with pytest.raises(TransientConnectorError, match="could not be resolved"):
        await validate_public_url("https://example.com/product", {"example.com"})
