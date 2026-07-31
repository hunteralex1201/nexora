# NEXORA Intelligence Connectors Design

## 1. Introduction

This document outlines the design principles, structure, and initial targets for the data connectors within the NEXORA Intelligence platform. Connectors are crucial for ingesting public e-commerce and market data from various sources, prioritizing Bangladesh-first platforms.

## 2. Connector Principles

All connectors within NEXORA Intelligence will adhere to the following engineering principles and data rules:

*   **Common Contract:** Every connector must implement a common connector contract, ensuring consistency and ease of integration into the broader system. This contract will be detailed in `CONNECTOR_STANDARD.md`.
*   **Source-Specific Handling:** Connectors must apply source-specific rate limits, retries, timeouts, and concurrency controls to respect platform policies and prevent IP blocking.
*   **Data Integrity:** Connectors are responsible for collecting raw source data. This raw data must be stored before normalization, and historical raw data must never be overwritten.
*   **Duplicate Prevention:** Mechanisms must be in place to prevent duplicate jobs and duplicate records during data ingestion.
*   **Ethical Data Collection:** All data collection activities must respect public access rules, applicable law, robots policies, and platform terms.
*   **Sandboxed Execution:** Browser-based connectors will operate within sandboxed browser workers to enhance security and isolation.

## 3. Connector Architecture

Connectors will reside in the `connectors/` directory within the monorepo, organized by geographical or functional categories.

### 3.1. `connectors/bangladesh`

This directory will house connectors specifically designed for e-commerce platforms and data sources relevant to Bangladesh.

*   **Purpose:** To collect market data from Bangladesh-specific online marketplaces, retailers, and public websites.
*   **Initial Targets:**
    *   Daraz Bangladesh
    *   Rokomari
    *   Chaldal
    *   Star Tech
    *   Ryans Computers
    *   Pickaboo
    *   Gadget & Gear
    *   Shajgoj
    *   Arogga
    *   Othoba
    *   PriyoShop
    *   BDShop
    *   Bikroy (where relevant)

### 3.2. `connectors/global`

This directory will contain connectors for generic e-commerce platforms that are not region-specific but are widely used, such as:

*   **Purpose:** To collect data from broader e-commerce ecosystems.
*   **Initial Targets:**
    *   Generic Shopify stores
    *   Generic WooCommerce stores
    *   Public company and supplier directories

### 3.3. `connectors/social`

This directory will include connectors for social media, news, and other trend sources that provide commerce signals.

*   **Purpose:** To gather qualitative data, sentiment, and trend information from public social and news platforms.
*   **Initial Targets:**
    *   Search engines (for news, reviews)
    *   News websites
    *   RSS feeds
    *   Review platforms
    *   Forums
    *   Social trend sources

## 4. Connector Standard (CONNECTOR_STANDARD.md)

The `CONNECTOR_STANDARD.md` document will define the interface and expected behavior for all connectors. This will include:

*   **Input Parameters:** Standardized inputs for initiating data collection (e.g., source ID, job configuration).
*   **Output Format:** A common schema for raw data output, ensuring consistency before normalization.
*   **Error Handling:** Standardized error reporting and retry mechanisms.
*   **Metadata:** Requirements for metadata associated with collected data, such as `source_id`, `collection_timestamp`, and `crawl_job_id`.
*   **Rate Limiting Configuration:** Guidelines for configuring and respecting rate limits.

## 5. Data Classification by Connectors

Connectors will be responsible for providing initial classifications for metrics where applicable, adhering to the `DATA_TRUST_STANDARD.md`.

*   **Metric Classification:** Connectors should, where possible, indicate if a metric is `Verified`, `Derived`, `Estimated`, `AI-generated`, `Stale`, or `Unavailable`.
*   **Intelligence Result Attributes:** For any intelligence results generated directly by a connector (e.g., through an API that provides pre-analyzed data), the connector should provide `Evidence`, `Source`, `Confidence score`, `Freshness`, `Calculation version`, and `Generated timestamp`.

## 6. Integration with the System

Connectors will integrate with the broader NEXORA Intelligence system as follows:

*   **Scheduler (`apps/scheduler`):** Initiates data collection jobs based on predefined schedules and priorities.
*   **Queue System (`packages/queue`):** Connectors will enqueue tasks for `apps/worker` or `apps/browser-worker`.
*   **Browser Worker (`apps/browser-worker`):** Executes browser automation tasks for web scraping.
*   **Storage (`packages/storage`):** Stores raw collected data (e.g., in MinIO).
*   **Database (`packages/database`):** Updates `sources` and `crawl_jobs` tables with job status and metadata.
*   **Event System (`EVENT_SYSTEM.md`):** Publishes events (e.g., `data_collected`) upon successful data ingestion.

## 7. Phase 0 Implementation

During Phase 0, the focus will be on establishing the connector framework and integrating with the core system components. While specific data collection logic for all initial targets will not be fully implemented, the foundational structure for `connectors/bangladesh`, `connectors/global`, and `connectors/social` will be laid out, along with the definition of `CONNECTOR_STANDARD.md`.
