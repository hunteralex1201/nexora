"""NEXORA agent-role catalog and configuration preview.

This module does not run background workers. It exposes planned agent roles for
operator review while production execution remains under the authenticated AI
job gateway and workflow worker.
"""

from datetime import UTC, datetime
from enum import Enum
from typing import Any


class AgentCategory(str, Enum):
    ORCHESTRATION = "Orchestration"
    DISCOVERY = "Discovery"
    PRICING_MARKET = "Pricing & Market"
    SOURCING_SUPPLY = "Sourcing & Supply"
    LEADS_SEO = "Leads & SEO"
    REPORTING_SYSTEM = "Reporting & System"


LEGACY_AGENT_ALIASES = {"agent_orchestrator": "agent_01"}


FULL_25_AGENT_ROSTER: list[dict[str, Any]] = [
    {
        "id": "agent_01",
        "name": "Chief Orchestrator Agent",
        "category": AgentCategory.ORCHESTRATION,
        "schedule": "Continuous",
        "confidence": 0.99,
        "memory": 2450,
    },
    {
        "id": "agent_02",
        "name": "Website Discovery Agent",
        "category": AgentCategory.DISCOVERY,
        "schedule": "Every 15 mins",
        "confidence": 0.96,
        "memory": 1280,
    },
    {
        "id": "agent_03",
        "name": "Marketplace Discovery Agent",
        "category": AgentCategory.DISCOVERY,
        "schedule": "Every 30 mins",
        "confidence": 0.94,
        "memory": 940,
    },
    {
        "id": "agent_04",
        "name": "New Website Launch Agent",
        "category": AgentCategory.DISCOVERY,
        "schedule": "Hourly",
        "confidence": 0.92,
        "memory": 610,
    },
    {
        "id": "agent_05",
        "name": "Product Discovery Agent",
        "category": AgentCategory.DISCOVERY,
        "schedule": "Every 10 mins",
        "confidence": 0.97,
        "memory": 3120,
    },
    {
        "id": "agent_06",
        "name": "Product Verification Agent",
        "category": AgentCategory.DISCOVERY,
        "schedule": "Real-time",
        "confidence": 0.98,
        "memory": 1850,
    },
    {
        "id": "agent_07",
        "name": "Product Matching Agent",
        "category": AgentCategory.PRICING_MARKET,
        "schedule": "Every 20 mins",
        "confidence": 0.95,
        "memory": 1420,
    },
    {
        "id": "agent_08",
        "name": "Price Intelligence Agent",
        "category": AgentCategory.PRICING_MARKET,
        "schedule": "Every 15 mins",
        "confidence": 0.97,
        "memory": 2180,
    },
    {
        "id": "agent_09",
        "name": "Review Intelligence Agent",
        "category": AgentCategory.PRICING_MARKET,
        "schedule": "Hourly",
        "confidence": 0.93,
        "memory": 890,
    },
    {
        "id": "agent_10",
        "name": "Customer Intelligence Agent",
        "category": AgentCategory.PRICING_MARKET,
        "schedule": "Every 2 hours",
        "confidence": 0.91,
        "memory": 560,
    },
    {
        "id": "agent_11",
        "name": "Competitor Monitoring Agent",
        "category": AgentCategory.PRICING_MARKET,
        "schedule": "Every 30 mins",
        "confidence": 0.96,
        "memory": 1740,
    },
    {
        "id": "agent_12",
        "name": "SEO Intelligence Agent",
        "category": AgentCategory.LEADS_SEO,
        "schedule": "Daily",
        "confidence": 0.95,
        "memory": 430,
    },
    {
        "id": "agent_13",
        "name": "Trend Intelligence Agent",
        "category": AgentCategory.PRICING_MARKET,
        "schedule": "Every 3 hours",
        "confidence": 0.94,
        "memory": 1150,
    },
    {
        "id": "agent_14",
        "name": "Supplier Discovery Agent",
        "category": AgentCategory.SOURCING_SUPPLY,
        "schedule": "Hourly",
        "confidence": 0.96,
        "memory": 980,
    },
    {
        "id": "agent_15",
        "name": "Lead Discovery Agent",
        "category": AgentCategory.LEADS_SEO,
        "schedule": "Every 2 hours",
        "confidence": 0.95,
        "memory": 1340,
    },
    {
        "id": "agent_16",
        "name": "Technology Detection Agent",
        "category": AgentCategory.DISCOVERY,
        "schedule": "On Store Scan",
        "confidence": 0.98,
        "memory": 720,
    },
    {
        "id": "agent_17",
        "name": "Advertisement Intelligence Agent",
        "category": AgentCategory.LEADS_SEO,
        "schedule": "Daily",
        "confidence": 0.90,
        "memory": 380,
    },
    {
        "id": "agent_18",
        "name": "Inventory Intelligence Agent",
        "category": AgentCategory.SOURCING_SUPPLY,
        "schedule": "Every 30 mins",
        "confidence": 0.97,
        "memory": 1100,
    },
    {
        "id": "agent_19",
        "name": "Financial Intelligence Agent",
        "category": AgentCategory.SOURCING_SUPPLY,
        "schedule": "Real-time",
        "confidence": 0.99,
        "memory": 1950,
    },
    {
        "id": "agent_20",
        "name": "Dropshipping Intelligence Agent",
        "category": AgentCategory.SOURCING_SUPPLY,
        "schedule": "Every 15 mins",
        "confidence": 0.96,
        "memory": 1680,
    },
    {
        "id": "agent_21",
        "name": "China Sourcing Intelligence Agent",
        "category": AgentCategory.SOURCING_SUPPLY,
        "schedule": "Hourly",
        "confidence": 0.95,
        "memory": 1490,
    },
    {
        "id": "agent_22",
        "name": "Shipping & Import Agent",
        "category": AgentCategory.SOURCING_SUPPLY,
        "schedule": "Daily",
        "confidence": 0.94,
        "memory": 510,
    },
    {
        "id": "agent_23",
        "name": "Critic & Quality Control Agent",
        "category": AgentCategory.ORCHESTRATION,
        "schedule": "Real-time",
        "confidence": 0.99,
        "memory": 2210,
    },
    {
        "id": "agent_24",
        "name": "Telegram Executive Reporter Agent",
        "category": AgentCategory.REPORTING_SYSTEM,
        "schedule": "Daily / On-demand",
        "confidence": 1.0,
        "memory": 480,
    },
    {
        "id": "agent_25",
        "name": "Recovery & Auto-Heal Agent",
        "category": AgentCategory.REPORTING_SYSTEM,
        "schedule": "Continuous (30s)",
        "confidence": 1.0,
        "memory": 3200,
    },
]


class AgentBrainService:

    def __init__(self) -> None:
        self._agents: dict[str, dict[str, Any]] = {}

        for item in FULL_25_AGENT_ROSTER:
            self._agents[item["id"]] = {
                "id": item["id"],
                "name": item["name"],
                "category": item["category"].value,
                "status": "CONFIGURATION_ONLY",
                "schedule": item["schedule"],
                "last_run_at": None,
                "evidence_verified": False,
                "confidence_score": None,
                "memory_items": 0,
                "runtime_connected": False,
                "demo_data": True,
            }

        self._memory_logs: list[dict[str, Any]] = []

    def list_agents(self, category: str | None = None) -> list[dict[str, Any]]:
        agents = list(self._agents.values())
        if category:
            return [a for a in agents if a["category"].lower() == category.lower()]
        return agents

    def get_memory_logs(self) -> list[dict[str, Any]]:
        return self._memory_logs

    def trigger_agent(self, agent_id: str) -> dict[str, Any]:
        canonical_agent_id = LEGACY_AGENT_ALIASES.get(agent_id, agent_id)
        agent = self._agents.get(canonical_agent_id)
        if not agent:
            return {"status": "ERROR", "message": f"Agent {agent_id} not found"}

        return {
            "status": "NOT_EXECUTED",
            "agent": agent,
            "message": (
                "This catalog entry has no connected runtime. Submit production work through "
                "the governed AI job gateway instead."
            ),
        }

    def trigger_all_agents(self) -> dict[str, Any]:
        return {
            "status": "NOT_EXECUTED",
            "triggered_agents": 0,
            "message": (
                "No catalog entry has a connected runtime. Submit production work through "
                "the governed AI job gateway instead."
            ),
        }

    def generate_telegram_report(self) -> dict[str, Any]:
        return {
            "title": "NEXORA Executive Report Layout Preview",
            "date": datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC"),
            "summary": {
                "active_agents": 0,
                "active_sources": 0,
                "monitored_products": 0,
                "top_opportunity": "Unavailable until measured source data exists",
                "china_sourcing_alert": "Unavailable until a sourcing connector is enabled",
                "b2b_lead_alert": "Unavailable until a source-attributed lead connector is enabled",
                "seo_alert": "Unavailable until a measured SEO provider is enabled",
            },
            "status": "PREVIEW_ONLY",
            "demo_data": True,
            "disclaimer": "No report was dispatched and no external metrics were measured.",
        }


global_agent_brain = AgentBrainService()
