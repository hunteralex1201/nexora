import asyncio
import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx

from app.connectors.base import ConnectorSafetyError, TransientConnectorError

MAX_RESPONSE_BYTES = 2_000_000
MAX_REDIRECTS = 3


@dataclass(frozen=True)
class SafeResponse:
    status_code: int
    url: str
    headers: httpx.Headers
    body: bytes
    encoding: str

    @property
    def is_redirect(self) -> bool:
        return 300 <= self.status_code < 400


def normalized_domains(raw_domains: object, base_url: str) -> set[str]:
    configured: list[str] = []
    if isinstance(raw_domains, list):
        configured = [str(value) for value in raw_domains]
    base_hostname = (urlparse(base_url).hostname or "").lower().rstrip(".")
    domains = {domain.lower().strip().rstrip(".") for domain in configured if domain}
    if base_hostname:
        domains.add(base_hostname)
    return domains


def _domain_allowed(hostname: str, allowed_domains: set[str]) -> bool:
    return any(hostname == domain or hostname.endswith(f".{domain}") for domain in allowed_domains)


def _reject_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> None:
    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    ):
        raise ConnectorSafetyError("Target resolves to a non-public network address")


async def validate_public_url(url: str, allowed_domains: set[str]) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise ConnectorSafetyError("Only HTTP and HTTPS targets are supported")
    if parsed.username or parsed.password:
        raise ConnectorSafetyError("Credential-bearing URLs are prohibited")
    hostname = (parsed.hostname or "").lower().rstrip(".")
    if not hostname or not _domain_allowed(hostname, allowed_domains):
        raise ConnectorSafetyError("Target domain is outside the source allowlist")

    try:
        literal = ipaddress.ip_address(hostname)
    except ValueError:
        literal = None
    if literal is not None:
        _reject_ip(literal)
        return

    try:
        results = await asyncio.get_running_loop().run_in_executor(
            None,
            lambda: socket.getaddrinfo(hostname, parsed.port or 443, type=socket.SOCK_STREAM),
        )
    except socket.gaierror as exc:
        raise TransientConnectorError("Target hostname could not be resolved") from exc
    for result in results:
        _reject_ip(ipaddress.ip_address(result[4][0]))


async def _stream_limited(client: httpx.AsyncClient, url: str) -> SafeResponse:
    async with client.stream("GET", url) as response:
        declared_length = response.headers.get("content-length")
        if declared_length:
            try:
                if int(declared_length) > MAX_RESPONSE_BYTES:
                    raise ConnectorSafetyError("Target response exceeded the 2 MB safety limit")
            except ValueError as exc:
                raise ConnectorSafetyError("Target returned an invalid content length") from exc

        body = bytearray()
        async for chunk in response.aiter_bytes():
            body.extend(chunk)
            if len(body) > MAX_RESPONSE_BYTES:
                raise ConnectorSafetyError("Target response exceeded the 2 MB safety limit")

        return SafeResponse(
            status_code=response.status_code,
            url=str(response.url),
            headers=response.headers,
            body=bytes(body),
            encoding=response.encoding or "utf-8",
        )


async def fetch_public_text(
    *,
    url: str,
    allowed_domains: set[str],
    timeout_seconds: float,
    user_agent: str,
) -> tuple[str, dict[str, object]]:
    await validate_public_url(url, allowed_domains)
    headers = {
        "User-Agent": user_agent,
        "Accept": "text/html,application/xhtml+xml,application/ld+json;q=0.9",
    }
    target_url = url
    redirects = 0
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(timeout_seconds),
            follow_redirects=False,
            headers=headers,
        ) as client:
            while True:
                response = await _stream_limited(client, target_url)
                if not response.is_redirect:
                    break
                redirects += 1
                if redirects > MAX_REDIRECTS:
                    raise ConnectorSafetyError("Redirect limit exceeded")
                location = response.headers.get("location")
                if not location:
                    raise ConnectorSafetyError("Redirect omitted its destination")
                redirect_url = str(httpx.URL(response.url).join(location))
                await validate_public_url(redirect_url, allowed_domains)
                target_url = redirect_url
    except httpx.TimeoutException as exc:
        raise TransientConnectorError("Target request timed out") from exc
    except httpx.NetworkError as exc:
        raise TransientConnectorError("Target network request failed") from exc

    if response.status_code in {401, 403, 407, 429}:
        raise ConnectorSafetyError(f"Target denied collection with HTTP {response.status_code}")
    if response.status_code >= 500:
        raise TransientConnectorError(f"Target returned HTTP {response.status_code}")
    if response.status_code >= 400:
        raise ConnectorSafetyError(f"Target returned HTTP {response.status_code}")

    content_type = response.headers.get("content-type", "").lower()
    if "html" not in content_type and "json" not in content_type:
        raise ConnectorSafetyError("Target response is not HTML or JSON")

    return response.body.decode(response.encoding, errors="replace"), {
        "original_url": url,
        "final_url": response.url,
        "http_status": response.status_code,
        "content_type": content_type,
        "response_size": len(response.body),
        "redirects": redirects,
    }
