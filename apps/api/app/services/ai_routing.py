from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from app.config import Settings, settings


class AIRoutingError(RuntimeError):
    """Raised when no policy-compliant model route is available."""


class AIProvider(StrEnum):
    OLLAMA = "ollama"
    CLOUD = "cloud"
    MANUS = "manus"


class AIExecutionMode(StrEnum):
    SYNCHRONOUS = "synchronous"
    ASYNCHRONOUS = "asynchronous"


class AIDataClass(StrEnum):
    PUBLIC = "public"
    INTERNAL = "internal"
    SENSITIVE = "sensitive"
    RESTRICTED = "restricted"


class AITaskClass(StrEnum):
    CHAT = "chat"
    PRICE_INTELLIGENCE = "price_intelligence"
    EXTRACTION = "extraction"
    CLASSIFICATION = "classification"
    SUMMARIZATION = "summarization"
    STRATEGIC_RESEARCH = "strategic_research"
    PLANNING = "planning"
    DOCUMENT_ANALYSIS = "document_analysis"
    EMBEDDING = "embedding"


@dataclass(frozen=True)
class ModelDescriptor:
    provider: AIProvider
    model: str
    execution_mode: AIExecutionMode
    task_classes: frozenset[AITaskClass]
    enabled: bool
    configured: bool
    external: bool

    @property
    def identifier(self) -> str:
        return f"{self.provider.value}/{self.model}"

    def public_dict(self) -> dict[str, object]:
        """Return an operator-safe descriptor that never includes credentials or origins."""
        return {
            "provider": self.provider.value,
            "model": self.model,
            "identifier": self.identifier,
            "execution_mode": self.execution_mode.value,
            "task_classes": sorted(item.value for item in self.task_classes),
            "enabled": self.enabled,
            "configured": self.configured,
            "external": self.external,
        }


@dataclass(frozen=True)
class RoutingDecision:
    task_class: AITaskClass
    data_class: AIDataClass
    selected: ModelDescriptor
    fallbacks: tuple[ModelDescriptor, ...]
    policy_version: str
    route_hint_applied: bool
    reason: str

    @property
    def candidates(self) -> tuple[ModelDescriptor, ...]:
        return (self.selected, *self.fallbacks)

    def audit_dict(self) -> dict[str, object]:
        return {
            "task_class": self.task_class.value,
            "data_class": self.data_class.value,
            "selected": self.selected.identifier,
            "fallbacks": [item.identifier for item in self.fallbacks],
            "policy_version": self.policy_version,
            "route_hint_applied": self.route_hint_applied,
            "reason": self.reason,
        }


_OLLAMA_CHAT_TASKS = frozenset(
    {
        AITaskClass.CHAT,
        AITaskClass.PRICE_INTELLIGENCE,
        AITaskClass.EXTRACTION,
        AITaskClass.CLASSIFICATION,
        AITaskClass.SUMMARIZATION,
        AITaskClass.PLANNING,
        AITaskClass.DOCUMENT_ANALYSIS,
    }
)
_CLOUD_CHAT_TASKS = frozenset(
    {
        AITaskClass.CHAT,
        AITaskClass.PRICE_INTELLIGENCE,
        AITaskClass.EXTRACTION,
        AITaskClass.CLASSIFICATION,
        AITaskClass.SUMMARIZATION,
        AITaskClass.STRATEGIC_RESEARCH,
        AITaskClass.PLANNING,
        AITaskClass.DOCUMENT_ANALYSIS,
    }
)
_MANUS_TASKS = frozenset(
    {
        AITaskClass.STRATEGIC_RESEARCH,
        AITaskClass.PLANNING,
        AITaskClass.DOCUMENT_ANALYSIS,
        AITaskClass.SUMMARIZATION,
    }
)
_EXTERNAL_DATA_CLASSES = frozenset({AIDataClass.PUBLIC, AIDataClass.INTERNAL})

_PROVIDER_ORDER: dict[AITaskClass, tuple[AIProvider, ...]] = {
    AITaskClass.CHAT: (AIProvider.OLLAMA, AIProvider.CLOUD),
    AITaskClass.PRICE_INTELLIGENCE: (AIProvider.OLLAMA, AIProvider.CLOUD),
    AITaskClass.EXTRACTION: (AIProvider.OLLAMA, AIProvider.CLOUD),
    AITaskClass.CLASSIFICATION: (AIProvider.OLLAMA, AIProvider.CLOUD),
    AITaskClass.SUMMARIZATION: (AIProvider.OLLAMA, AIProvider.CLOUD, AIProvider.MANUS),
    AITaskClass.STRATEGIC_RESEARCH: (AIProvider.MANUS, AIProvider.CLOUD),
    AITaskClass.PLANNING: (AIProvider.MANUS, AIProvider.CLOUD, AIProvider.OLLAMA),
    AITaskClass.DOCUMENT_ANALYSIS: (AIProvider.OLLAMA, AIProvider.CLOUD, AIProvider.MANUS),
    AITaskClass.EMBEDDING: (AIProvider.OLLAMA,),
}


def build_model_registry(config: Settings | None = None) -> tuple[ModelDescriptor, ...]:
    """Build the model registry exclusively from validated server configuration."""
    active = config or settings
    cloud_key_present = bool(
        active.CLOUD_LLM_API_KEY and active.CLOUD_LLM_API_KEY.get_secret_value()
    )
    manus_key_present = bool(active.MANUS_API_KEY and active.MANUS_API_KEY.get_secret_value())

    registry: list[ModelDescriptor] = [
        ModelDescriptor(
            provider=AIProvider.OLLAMA,
            model=active.OLLAMA_CHAT_MODEL,
            execution_mode=AIExecutionMode.SYNCHRONOUS,
            task_classes=_OLLAMA_CHAT_TASKS,
            enabled=True,
            configured=True,
            external=False,
        ),
        ModelDescriptor(
            provider=AIProvider.OLLAMA,
            model=active.OLLAMA_EMBEDDING_MODEL,
            execution_mode=AIExecutionMode.SYNCHRONOUS,
            task_classes=frozenset({AITaskClass.EMBEDDING}),
            enabled=True,
            configured=True,
            external=False,
        ),
    ]
    for model in active.cloud_llm_allowed_models:
        registry.append(
            ModelDescriptor(
                provider=AIProvider.CLOUD,
                model=model,
                execution_mode=AIExecutionMode.SYNCHRONOUS,
                task_classes=_CLOUD_CHAT_TASKS,
                enabled=active.CLOUD_LLM_ENABLED,
                configured=cloud_key_present,
                external=True,
            )
        )
    for profile in active.manus_allowed_agent_profiles:
        registry.append(
            ModelDescriptor(
                provider=AIProvider.MANUS,
                model=profile,
                execution_mode=AIExecutionMode.ASYNCHRONOUS,
                task_classes=_MANUS_TASKS,
                enabled=active.MANUS_ENABLED,
                configured=manus_key_present and bool(active.MANUS_PROJECT_ID),
                external=True,
            )
        )
    return tuple(registry)


def _default_model(provider: AIProvider, task_class: AITaskClass, config: Settings) -> str:
    if provider is AIProvider.OLLAMA:
        if task_class is AITaskClass.EMBEDDING:
            return config.OLLAMA_EMBEDDING_MODEL
        return config.OLLAMA_CHAT_MODEL
    if provider is AIProvider.CLOUD:
        return config.CLOUD_LLM_DEFAULT_MODEL
    return config.MANUS_DEFAULT_AGENT_PROFILE


def _eligible_models(
    *,
    task_class: AITaskClass,
    data_class: AIDataClass,
    config: Settings,
) -> tuple[ModelDescriptor, ...]:
    registry = build_model_registry(config)
    eligible: list[ModelDescriptor] = []
    for item in registry:
        if not item.enabled or not item.configured or task_class not in item.task_classes:
            continue
        if item.external and data_class not in _EXTERNAL_DATA_CLASSES:
            continue
        eligible.append(item)
    return tuple(eligible)


def route_ai_task(
    task_class: AITaskClass,
    data_class: AIDataClass,
    *,
    requested_provider: AIProvider | None = None,
    requested_model: str | None = None,
    config: Settings | None = None,
) -> RoutingDecision:
    """Select a policy-compliant model and ordered fallback chain.

    Caller hints are ignored unless ``AI_ALLOW_ROUTE_HINTS`` is enabled. Even then,
    hints can only reorder already configured and policy-eligible candidates.
    """
    active = config or settings
    eligible = _eligible_models(task_class=task_class, data_class=data_class, config=active)
    if not eligible:
        raise AIRoutingError(
            f"No configured model is eligible for {task_class.value}/{data_class.value}"
        )

    provider_order = list(_PROVIDER_ORDER[task_class])
    route_hint_applied = False
    if active.AI_ALLOW_ROUTE_HINTS and requested_provider is not None:
        if requested_provider not in provider_order:
            raise AIRoutingError(
                f"Provider {requested_provider.value} is not allowed for {task_class.value}"
            )
        provider_order.remove(requested_provider)
        provider_order.insert(0, requested_provider)
        route_hint_applied = True

    ordered: list[ModelDescriptor] = []
    for provider in provider_order:
        provider_models = [item for item in eligible if item.provider is provider]
        if not provider_models:
            continue
        preferred = _default_model(provider, task_class, active)
        if (
            active.AI_ALLOW_ROUTE_HINTS
            and requested_provider is provider
            and requested_model is not None
        ):
            if not any(item.model == requested_model for item in provider_models):
                raise AIRoutingError(
                    f"Model {provider.value}/{requested_model} is not allowlisted and eligible"
                )
            preferred = requested_model
            route_hint_applied = True
        provider_models.sort(key=lambda item: (item.model != preferred, item.model))
        ordered.extend(provider_models)

    if not ordered:
        raise AIRoutingError(
            f"No configured model is routable for {task_class.value}/{data_class.value}"
        )

    reason = "server policy default"
    if route_hint_applied:
        reason = "validated caller hint within server policy"
    elif data_class not in _EXTERNAL_DATA_CLASSES:
        reason = "data class restricted to private local inference"

    return RoutingDecision(
        task_class=task_class,
        data_class=data_class,
        selected=ordered[0],
        fallbacks=tuple(ordered[1:]),
        policy_version=active.AI_POLICY_VERSION,
        route_hint_applied=route_hint_applied,
        reason=reason,
    )


def enforce_prompt_budget(prompt: str, config: Settings | None = None) -> None:
    """Reject oversized prompts before they can be sent to any provider."""
    active = config or settings
    if len(prompt.encode("utf-8")) > active.AI_MAX_PROMPT_BYTES:
        raise AIRoutingError("Prompt exceeds the configured byte budget")
