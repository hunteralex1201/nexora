# NEXORA Intelligence Product Roadmap

## 1. Introduction

This document outlines the strategic product roadmap for NEXORA Intelligence, an AI Commerce Intelligence Platform. The roadmap is structured to prioritize a Bangladesh-first approach, followed by expansion into South Asia and global markets. It details the key phases of development, focusing on foundational engineering in Phase 0 and progressively introducing advanced features and market coverage.

## 2. Core Product Vision

To build the operating system for Bangladesh commerce intelligence first, then expand to South Asia and global markets.

## 3. Phase 0: Engineering Foundation (Current Focus)

**Goal:** Establish a robust, scalable, and secure engineering foundation for the NEXORA Intelligence platform.

**Key Deliverables:**

*   **Monorepo Foundation:** Set up the modular monorepo structure with `apps/`, `packages/`, `connectors/`, `agents/`, `workflows/`, `infrastructure/`, `docs/`, and `tests/` directories.
*   **Docker Development Environment:** Implement a comprehensive Docker Compose setup for local development, including all core services (web, api, postgres, redis, minio, qdrant, monitoring stack).
*   **Next.js Dashboard Shell (`apps/web`):** Develop a basic, premium-styled dashboard shell with initial routes (`/login`, `/overview`, `/system`, `/settings`) and responsive layout. Implement loading, empty, error, demo, and live states.
*   **FastAPI API (`apps/api`):** Implement the core API with health, readiness, and dependency endpoints. Establish structured logging with request and correlation IDs.
*   **PostgreSQL Connection and Migrations:** Set up PostgreSQL with SQLAlchemy ORM and Alembic for database migrations. Implement initial models for `users`, `roles`, `sources`, and `crawl_jobs`.
*   **Redis Connection:** Integrate Redis for caching, session management, and as a message broker for the event and queue systems.
*   **Environment Validation:** Implement mechanisms for validating environment configurations.
*   **Authentication and RBAC Foundation:** Implement JWT-based authentication and Role-Based Access Control (RBAC) for user management.
*   **Structured Logging:** Integrate `packages/logger` for structured, traceable logging across all services.
*   **CI Pipeline:** Set up Continuous Integration for linting, type checking, testing, and building all applications.
*   **Initial Documentation:** Create `README.md`, `ARCHITECTURE.md`, `ROADMAP.md` (this document), `SECURITY.md`, `CONNECTOR_STANDARD.md`, and `DATA_TRUST_STANDARD.md`.

**Exclusions for Phase 0:**

*   No actual scraping or autonomous agent functionality will be implemented.
*   Focus is purely on infrastructure and foundational components.

## 4. Phase 1: Bangladesh Marketplace Monitoring (Short-term)

**Goal:** Implement core data collection and basic intelligence features for key Bangladesh marketplaces.

**Key Deliverables:**

*   **Bangladesh Connectors:** Develop initial connectors for Daraz Bangladesh, Rokomari, and Chaldal, adhering to `CONNECTOR_STANDARD.md`.
*   **Data Collection Workflows:** Implement n8n workflows for orchestrating data collection jobs via `apps/scheduler` and `apps/browser-worker`.
*   **Raw Data Storage:** Ensure raw collected data is stored in MinIO.
*   **Data Normalization:** Develop `apps/worker` components for normalizing collected data into a common schema.
*   **Basic Product Intelligence:** Implement initial features for product detection and basic attribute extraction.
*   **Dashboard Integration:** Display initial data and metrics on the `/marketplaces` and `/products` dashboard routes.
*   **Alerts and Notifications Foundation:** Set up the basic framework for alerts.

## 5. Phase 2: Advanced Bangladesh Intelligence & Initial South Asia Expansion (Mid-term)

**Goal:** Enhance intelligence capabilities for Bangladesh markets and begin expansion into other South Asian countries.

**Key Deliverables:**

*   **Expanded Bangladesh Connectors:** Add connectors for Star Tech, Ryans Computers, Pickaboo, Gadget & Gear, Shajgoj, Arogga, Othoba, PriyoShop, BDShop, and relevant parts of Bikroy.
*   **Product Opportunity Score:** Implement the Product Opportunity Score feature.
*   **Category and Trend Intelligence:** Develop agents for category classification and trend detection.
*   **Competitor Monitoring:** Implement basic competitor tracking and the Competitor Change Feed.
*   **Review and Customer Sentiment Analysis:** Develop AI agents for sentiment analysis of customer reviews.
*   **Bangladesh Commerce Pulse, Product Momentum, Price Pressure Index, Marketplace Activity Index, Consumer Sentiment Index, Digital Demand Index:** Implement these signature dashboard features.
*   **Initial South Asia Connectors:** Begin developing connectors for key marketplaces in one or two other South Asian countries (e.g., India, Pakistan).
*   **NEXORA Copilot (Basic):** Introduce a basic AI assistant for querying data.

## 6. Phase 3: Global Expansion & AI Automation (Long-term)

**Goal:** Expand market coverage globally and significantly enhance AI-driven automation and insights.

**Key Deliverables:**

*   **Global Connectors:** Develop connectors for generic Shopify/WooCommerce stores and other major global e-commerce platforms.
*   **Public Business Lead Discovery:** Implement agents for identifying and qualifying business leads.
*   **Supplier Research:** Develop capabilities for supplier identification and analysis.
*   **Research Automation:** Automate report generation and evidence-based insights.
*   **Advanced AI Agents:** Further develop NEXORA Copilot and other AI agents for deeper analysis, predictive modeling, and recommendations.
*   **Real-time Dashboard Updates:** Full implementation of real-time updates via SSE/WebSocket for all relevant dashboard routes.
*   **Contabo Worker Auto-scaling:** Implement auto-scaling for workers to handle fluctuating loads.
*   **Full Dashboard Routes:** Implement all planned dashboard routes (`/market-pulse`, `/products`, `/categories`, `/marketplaces`, `/competitors`, `/pricing`, `/trends`, `/reviews`, `/leads`, `/suppliers`, `/sources`, `/jobs`, `/automations`, `/agents`, `/alerts`, `/reports`).

## 7. Continuous Improvement

Throughout all phases, continuous improvement will be a focus, including:

*   **Performance Optimization:** Regularly optimize data processing pipelines, database queries, and API performance.
*   **Security Enhancements:** Continuously review and enhance security measures.
*   **Scalability Improvements:** Adapt infrastructure and architecture to meet growing demands.
*   **User Feedback Integration:** Incorporate user feedback to refine features and user experience.
*   **Technology Updates:** Keep the technology stack updated with the latest stable and performant versions.

## 8. Data Trust Standard Integration

All metrics and intelligence results will be classified according to the `DATA_TRUST_STANDARD.md` (to be created), ensuring transparency and confidence in the data presented. This includes attributes like Evidence, Source, Confidence score, Freshness, Calculation version, and Generated timestamp.
