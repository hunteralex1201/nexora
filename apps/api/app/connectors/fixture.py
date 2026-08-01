from typing import Any

from pydantic import ValidationError

from app.connectors.base import (
    CollectionResult,
    ConnectorMetadata,
    UnsupportedConnectorError,
)
from app.models.source import Source
from app.schemas.commerce import ProductImportItem


class FixtureProductConnector:
    metadata = ConnectorMetadata(
        connector_id="fixture-product",
        connector_version="1.0.0",
        parser_version="1.0.0",
        capability_states=("FIXTURE_ONLY",),
        supported_fields=(
            "external_id",
            "name",
            "canonical_url",
            "price",
            "original_price",
            "currency",
            "availability",
            "brand",
            "category",
            "image_url",
            "seller_name",
            "rating",
            "review_count",
        ),
    )

    async def collect(self, source: Source, payload: dict[str, Any]) -> CollectionResult:
        raw_items = payload.get("items")
        if not isinstance(raw_items, list) or not raw_items:
            raise UnsupportedConnectorError("Fixture collection requires a non-empty items array")
        if len(raw_items) > 5000:
            raise UnsupportedConnectorError("Fixture collection cannot exceed 5000 records")

        items: list[ProductImportItem] = []
        for index, raw_item in enumerate(raw_items):
            if not isinstance(raw_item, dict):
                raise UnsupportedConnectorError(f"Fixture item {index} must be an object")
            evidence = dict(raw_item.get("evidence") or {})
            evidence.update(
                {
                    "classification": "VERIFIED",
                    "connector_id": self.metadata.connector_id,
                    "connector_version": self.metadata.connector_version,
                    "parser_version": self.metadata.parser_version,
                    "fixture_index": index,
                }
            )
            candidate = {**raw_item, "evidence": evidence}
            try:
                items.append(ProductImportItem.model_validate(candidate))
            except ValidationError as exc:
                raise UnsupportedConnectorError(
                    f"Fixture item {index} failed validation: {exc}"
                ) from exc

        return CollectionResult(
            items=items,
            artifacts=[
                {
                    "classification": "VERIFIED",
                    "kind": "operator_supplied_fixture",
                    "record_count": len(items),
                }
            ],
            metrics={"records": len(items), "targets": 0},
        )
