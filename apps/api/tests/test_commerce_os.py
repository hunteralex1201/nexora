from app.services.agent_brain import global_agent_brain
from app.services.dropshipping import (
    calculate_dropshipping_opportunity,
    list_top_bd_dropshipping_opportunities,
)
from app.services.lead_gen import list_b2b_leads
from app.services.seo import audit_store_seo
from app.services.sourcing import calculate_landed_cost, get_supplier_comparison_matrix


def test_china_sourcing_landed_cost_calculator():
    res = calculate_landed_cost(unit_price_rmb=28.50, weight_kg=0.22, quantity=50)
    assert res["unit_product_cost_bdt"] > 0
    assert res["landed_cost_per_unit_bdt"] > res["unit_product_cost_bdt"]
    assert res["suitability_score"] > 50.0


def test_china_sourcing_supplier_matrix():
    suppliers = get_supplier_comparison_matrix()
    assert len(suppliers) >= 3
    assert suppliers[0]["platform"] == "1688"
    assert "MagSafe" in suppliers[0]["product_title"]
    assert suppliers[0]["demo_data"] is True
    assert suppliers[0]["factory_verified"] is False
    assert suppliers[0]["verification_status"] == "DEMO_UNVERIFIED"
    assert suppliers[0]["trust_classification"] == "SYNTHETIC_SAMPLE"


def test_dropshipping_opportunity_calculator():
    metrics = calculate_dropshipping_opportunity(
        selling_price_bdt=2450.0, sourcing_cost_bdt=620.0, ad_cac_bdt=320.0
    )
    assert metrics["net_profit_bdt"] > 0
    assert metrics["opportunity_score"] > 50.0

    opps = list_top_bd_dropshipping_opportunities()
    assert len(opps) >= 3
    assert "Wireless" in opps[0]["product_name"]
    assert opps[0]["demo_data"] is True
    assert opps[0]["trust_classification"] == "SYNTHETIC_SAMPLE"


def test_seo_audit_engine():
    seo = audit_store_seo("https://gadgetsbd.com")
    assert seo["overall_seo_score"] > 80.0
    assert seo["technical"]["https_enabled"] is None
    assert len(seo["keyword_gaps"]) >= 3
    assert seo["demo_data"] is True
    assert seo["trust_classification"] == "SYNTHETIC_SAMPLE"


def test_b2b_lead_gen_engine():
    leads = list_b2b_leads()
    assert len(leads) >= 3
    assert leads[0]["company"] == "Example Electronics Retailer"
    assert leads[0]["lead_score"] > 80.0
    assert leads[0]["public_phone"] is None
    assert leads[0]["verification_status"] == "DEMO_UNVERIFIED"
    assert leads[0]["trust_classification"] == "SYNTHETIC_SAMPLE"
    assert leads[0]["demo_data"] is True


def test_agent_brain_service():
    agents = global_agent_brain.list_agents()
    assert len(agents) == 25
    assert all(agent["status"] == "CONFIGURATION_ONLY" for agent in agents)
    assert all(agent["runtime_connected"] is False for agent in agents)
    assert all(agent["evidence_verified"] is False for agent in agents)

    orchestration_agents = global_agent_brain.list_agents("Orchestration")
    assert orchestration_agents
    assert all(agent["category"] == "Orchestration" for agent in orchestration_agents)

    trig = global_agent_brain.trigger_agent("agent_orchestrator")
    assert trig["status"] == "NOT_EXECUTED"
    assert trig["agent"]["id"] == "agent_01"

    missing = global_agent_brain.trigger_agent("unknown-agent")
    assert missing == {"status": "ERROR", "message": "Agent unknown-agent not found"}

    memory_count = len(global_agent_brain.get_memory_logs())
    dispatch = global_agent_brain.trigger_all_agents()
    assert dispatch["status"] == "NOT_EXECUTED"
    assert dispatch["triggered_agents"] == 0
    assert len(global_agent_brain.get_memory_logs()) == memory_count

    report = global_agent_brain.generate_telegram_report()
    assert report["status"] == "PREVIEW_ONLY"
    assert report["summary"]["active_agents"] == 0
    assert report["demo_data"] is True
