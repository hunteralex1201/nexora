from dataclasses import dataclass, field
from typing import Any, Protocol

from app.models.source import Source
from app.schemas.commerce import ProductImportItem


class ConnectorError(RuntimeError):
    """Base typed connector failure."""

    retryable = False


class TransientConnectorError(ConnectorError):
    """Temporary network or upstream failure that may be retried."""

    retryable = True


class ConnectorBlockedError(ConnectorError):
    """Access denial, authentication challenge, or compliance block."""


class UnsupportedConnectorError(ConnectorError):
    """Source capability is unsupported or not enabled."""


class ConnectorSafetyError(ConnectorError):
    """A target violates protocol, domain, redirect, or network safety rules."""


@dataclass(frozen=True, slots=True)
class ConnectorMetadata:
    connector_id: str
    connector_version: str
    parser_version: str
    capability_states: tuple[str, ...]
    supported_fields: tuple[str, ...]
    country: str = "BD"
    owner: str = "NEXORA Intelligence"


@dataclass(slots=True)
class CollectionResult:
    items: list[ProductImportItem]
    artifacts: list[dict[str, Any]] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)


class Connector(Protocol):
    metadata: ConnectorMetadata

    async def collect(self, source: Source, payload: dict[str, Any]) -> CollectionResult:
        """Collect normalized records while retaining a provenance artifact envelope."""
        ...
