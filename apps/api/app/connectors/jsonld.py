import hashlib
import json
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
from typing import Any

from app.config import settings
from app.connectors.base import (
    CollectionResult,
    ConnectorMetadata,
    UnsupportedConnectorError,
)
from app.connectors.safety import fetch_public_text, normalized_domains
from app.models.source import Source
from app.schemas.commerce import ProductImportItem


class _JsonLdScriptParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._capture = False
        self._buffer: list[str] = []
        self.scripts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "script":
            return
        attributes = {name.lower(): (value or "") for name, value in attrs}
        if attributes.get("type", "").lower().split(";", 1)[0].strip() == "application/ld+json":
            self._capture = True
            self._buffer = []

    def handle_data(self, data: str) -> None:
        if self._capture:
            self._buffer.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "script" and self._capture:
            self.scripts.append("".join(self._buffer).strip())
            self._capture = False
            self._buffer = []


def _nodes(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        flattened: list[dict[str, Any]] = []
        for item in value:
            flattened.extend(_nodes(item))
        return flattened
    if not isinstance(value, dict):
        return []
    output = [value]
    graph = value.get("@graph")
    if graph is not None:
        output.extend(_nodes(graph))
    return output


def _is_product(node: dict[str, Any]) -> bool:
    raw_type = node.get("@type")
    types = raw_type if isinstance(raw_type, list) else [raw_type]
    return any(str(value).lower() == "product" for value in types if value)


def _first_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, list):
        return next((item for item in value if isinstance(item, dict)), {})
    return {}


def _first_text(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    if isinstance(value, list):
        for item in value:
            resolved = _first_text(item)
            if resolved:
                return resolved
    if isinstance(value, dict):
        return _first_text(value.get("url"))
    return None


def _decimal(value: Any) -> Decimal | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return Decimal(str(value).replace(",", "").strip())
    except (InvalidOperation, ValueError):
        return None


def _availability(value: Any) -> str:
    normalized = str(value or "").lower()
    if "instock" in normalized:
        return "in_stock"
    if "outofstock" in normalized or "soldout" in normalized:
        return "out_of_stock"
    if "preorder" in normalized or "presale" in normalized:
        return "preorder"
    return "unknown"


def _external_id(node: dict[str, Any], canonical_url: str) -> str:
    for field in ("sku", "productID", "mpn", "gtin13", "gtin12", "gtin"):
        value = node.get(field)
        if value is not None and str(value).strip():
            return str(value).strip()[:255]
    return hashlib.sha256(canonical_url.encode("utf-8")).hexdigest()[:32]


class JsonLdProductConnector:
    metadata = ConnectorMetadata(
        connector_id="generic-jsonld-product",
        connector_version="1.0.0",
        parser_version="1.0.0",
        capability_states=("STRUCTURED_HTML",),
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
        targets = payload.get("targets") or source.config.get("seed_urls") or []
        if isinstance(targets, str):
            targets = [targets]
        if not isinstance(targets, list) or not targets:
            raise UnsupportedConnectorError("JSON-LD collection requires one or more target URLs")
        if len(targets) > 100:
            raise UnsupportedConnectorError("A single JSON-LD job cannot exceed 100 targets")

        allowed_domains = normalized_domains(source.config.get("allowed_domains"), source.base_url)
        items: list[ProductImportItem] = []
        artifacts: list[dict[str, Any]] = []
        for target in targets:
            text, origin = await fetch_public_text(
                url=str(target),
                allowed_domains=allowed_domains,
                timeout_seconds=settings.CONNECTOR_TIMEOUT_SECONDS,
                user_agent=str(
                    source.config.get(
                        "user_agent",
                        "NEXORA-Intelligence/1.0 " "(+operator-managed public data collection)",
                    )
                ),
            )
            content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
            parser = _JsonLdScriptParser()
            parser.feed(text)
            parsed_product = False
            for script_index, script in enumerate(parser.scripts):
                if not script:
                    continue
                try:
                    document = json.loads(script)
                except json.JSONDecodeError:
                    continue
                for node in _nodes(document):
                    if not _is_product(node):
                        continue
                    offer = _first_dict(node.get("offers"))
                    price = _decimal(offer.get("price") or offer.get("lowPrice"))
                    name = _first_text(node.get("name"))
                    if price is None or not name:
                        continue
                    canonical_url = _first_text(node.get("url")) or str(origin["final_url"])
                    aggregate = _first_dict(node.get("aggregateRating"))
                    brand_value = node.get("brand")
                    brand = (
                        _first_text(brand_value.get("name"))
                        if isinstance(brand_value, dict)
                        else _first_text(brand_value)
                    )
                    seller = _first_dict(offer.get("seller"))
                    currency = str(offer.get("priceCurrency") or "BDT").upper()[:3]
                    evidence = {
                        "classification": "VERIFIED",
                        "connector_id": self.metadata.connector_id,
                        "connector_version": self.metadata.connector_version,
                        "parser_version": self.metadata.parser_version,
                        "content_hash": content_hash,
                        "jsonld_script_index": script_index,
                        "origin": origin,
                    }
                    items.append(
                        ProductImportItem(
                            external_id=_external_id(node, canonical_url),
                            name=name,
                            canonical_url=canonical_url,
                            price=price,
                            original_price=_decimal(offer.get("highPrice")),
                            currency=currency,
                            availability=_availability(offer.get("availability")),
                            brand=brand,
                            category=_first_text(node.get("category")),
                            image_url=_first_text(node.get("image")),
                            seller_name=_first_text(seller.get("name")),
                            rating=_decimal(aggregate.get("ratingValue")),
                            review_count=(
                                int(aggregate["reviewCount"])
                                if str(aggregate.get("reviewCount", "")).isdigit()
                                else None
                            ),
                            observed_at=datetime.now(UTC),
                            attributes={"jsonld_type": node.get("@type")},
                            evidence=evidence,
                        )
                    )
                    parsed_product = True
            artifacts.append(
                {
                    **origin,
                    "content_hash": content_hash,
                    "classification": "VERIFIED" if parsed_product else "UNAVAILABLE",
                }
            )

        if not items:
            raise UnsupportedConnectorError("No valid Product JSON-LD records were found")
        return CollectionResult(
            items=items,
            artifacts=artifacts,
            metrics={"targets": len(targets), "records": len(items)},
        )
