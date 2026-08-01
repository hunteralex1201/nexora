from app.connectors.base import Connector, UnsupportedConnectorError
from app.connectors.fixture import FixtureProductConnector
from app.connectors.jsonld import JsonLdProductConnector

_CONNECTORS: dict[str, Connector] = {
    "fixture": FixtureProductConnector(),
    "fixture_only": FixtureProductConnector(),
    "jsonld": JsonLdProductConnector(),
    "structured_html": JsonLdProductConnector(),
}


def connector_for(source_type: str) -> Connector:
    normalized = source_type.strip().lower()
    connector = _CONNECTORS.get(normalized)
    if connector is None:
        raise UnsupportedConnectorError(
            f"No enabled connector is registered for source type '{source_type}'"
        )
    return connector


def connector_registry() -> dict[str, dict[str, object]]:
    return {
        source_type: {
            "connector_id": connector.metadata.connector_id,
            "connector_version": connector.metadata.connector_version,
            "parser_version": connector.metadata.parser_version,
            "capability_states": list(connector.metadata.capability_states),
            "supported_fields": list(connector.metadata.supported_fields),
            "country": connector.metadata.country,
            "owner": connector.metadata.owner,
        }
        for source_type, connector in sorted(_CONNECTORS.items())
    }
