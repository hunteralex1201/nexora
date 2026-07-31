# NEXORA Intelligence AI Agents Design

## 1. Introduction

This document outlines the design philosophy, architecture, and planned capabilities of AI agents within the NEXORA Intelligence platform. AI agents are central to transforming raw commerce data into actionable insights, automating research, and providing intelligent recommendations.

## 2. AI Agent Principles

NEXORA Intelligence AI agents will adhere to the following core principles:

*   **Evidence-Based Insights:** All AI-generated insights must be traceable to their evidence and source, with a clear confidence score, freshness, calculation version, and generated timestamp.
*   **Human-in-the-Loop:** Risky AI actions, particularly those with significant business implications, will require human approval to ensure accuracy, ethical considerations, and alignment with user intent.
*   **Modularity and Specialization:** Agents will be designed as modular, specialized units, each focusing on a specific task (e.g., extraction, classification, sentiment analysis).
*   **Scalability:** Agents should be designed to scale horizontally to handle increasing data volumes and analytical demands.
*   **Deterministic Output (where applicable):** For metrics and scoring, AI agents will strive for deterministic code to ensure consistent and verifiable results.
*   **AI for Augmentation:** AI will be primarily used for extraction, classification, explanation, research synthesis, and recommendations, augmenting human intelligence rather than fully replacing it.

## 3. AI Agent Architecture

AI agents will reside in the `agents/` directory within the monorepo and will leverage a combination of local and cloud-based LLMs.

### 3.1. Technology Stack

*   **Orchestration:** LangGraph for building robust, stateful multi-agent workflows.
*   **Local LLMs:** Ollama for appropriate local tasks, enabling cost-effective and privacy-preserving processing of certain data types.
*   **Cloud Model Gateway:** For complex reasoning tasks, leveraging advanced cloud-based LLMs through a secure and managed gateway.
*   **Vector Database:** Qdrant for efficient storage and retrieval of embeddings, crucial for similarity searches and contextual understanding.
*   **Python:** The primary programming language for agent development.

### 3.2. Agent Types and Responsibilities (Future Phases)

While Phase 0 focuses on foundational elements, future phases will introduce specialized AI agents:

#### 3.2.1. Product Intelligence Agents

*   **New Product Detection Agent:** Identifies newly launched products across various marketplaces.
*   **Product Feature Extraction Agent:** Extracts key features and specifications from product descriptions and reviews.
*   **Product Similarity Agent:** Identifies similar products for competitive analysis and recommendation engines.

#### 3.2.2. Category and Trend Intelligence Agents

*   **Category Classification Agent:** Automatically categorizes products based on their descriptions and attributes.
*   **Trend Detection Agent:** Analyzes market data to identify emerging product categories, consumer preferences, and market shifts.

#### 3.2.3. Competitor Monitoring Agents

*   **Competitor Change Detection Agent:** Monitors competitor websites and product listings for changes in pricing, features, or promotions.
*   **Competitor Strategy Analysis Agent:** Analyzes competitor actions to infer strategic moves and market positioning.

#### 3.2.4. Review and Customer Sentiment Analysis Agents

*   **Sentiment Analysis Agent:** Determines the sentiment (positive, negative, neutral) of customer reviews and feedback.
*   **Key Opinion Extraction Agent:** Identifies common themes, pain points, and praises from customer reviews.

#### 3.2.5. Business Lead Discovery Agents

*   **Lead Identification Agent:** Scans public sources (directories, news) to identify potential business leads.
*   **Lead Qualification Agent:** Assesses the relevance and potential value of discovered leads.

#### 3.2.6. Research Automation Agents

*   **Information Synthesis Agent:** Gathers and synthesizes information from multiple sources to answer specific research questions.
*   **Report Generation Agent:** Automates the creation of evidence-based reports based on analyzed data and insights.

## 4. Integration with the System

AI agents will integrate seamlessly with other components of the NEXORA Intelligence platform:

*   **`apps/worker`:** AI agents will typically run within the `apps/worker` environment, processing tasks dispatched via the queue system.
*   **`packages/queue`:** Agents will consume tasks from and publish results to the message queue.
*   **`packages/database`:** Agents will read from and write to the PostgreSQL database for structured data, and Qdrant for vector embeddings.
*   **`packages/storage`:** Agents may store intermediate or final outputs (e.g., generated reports, extracted data) in MinIO.
*   **Event System:** Agents will publish events (e.g., `insight_generated`) to notify other services of new findings.
*   **`apps/api`:** The API will expose endpoints for interacting with AI agents, such as triggering analysis or retrieving AI-generated insights.

## 5. Phase 0 Implementation

During Phase 0, the focus will be on establishing the foundational infrastructure for AI agents, rather than developing specific agents. This includes:

*   Setting up the `agents/` directory structure.
*   Integrating LangGraph into the development environment.
*   Configuring Ollama for local LLM execution (if feasible within the initial Docker setup).
*   Ensuring Qdrant is integrated and accessible for future embedding storage.
*   Defining the interfaces and contracts for agent interaction with the rest of the system.
