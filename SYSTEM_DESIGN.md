# NEXORA Intelligence System Design

## 1. Introduction

This document outlines the detailed system design for NEXORA Intelligence, an AI Commerce Intelligence Platform. It elaborates on the architectural components, their interactions, and the underlying technologies that will drive the platform's capabilities.

## 2. Monorepo Structure and Application Design

The project will adopt a modular monorepo structure to facilitate independent development, deployment, and scaling of various services. Each application within the `apps/` directory will be a self-contained unit with specific responsibilities.

### 2.1. `apps/web` (Frontend)

*   **Purpose:** User interface for the NEXORA Intelligence executive dashboard.
*   **Technology Stack:** Next.js, TypeScript, React, Tailwind CSS, TanStack Query, TanStack Table, ECharts/Recharts.
*   **Key Features:**
    *   Interactive dashboards with real-time updates (SSE/WebSocket).
    *   User authentication and authorization flows.
    *   Data visualization and reporting.
    *   Responsive design for various devices.
    *   Premium, enterprise-grade UI/UX.
*   **Interaction:** Communicates with `apps/api` for data retrieval and submission.

### 2.2. `apps/api` (Backend API)

*   **Purpose:** Provides a unified API endpoint for frontend, internal services, and external integrations.
*   **Technology Stack:** Python, FastAPI, Pydantic, SQLAlchemy.
*   **Key Features:**
    *   RESTful API endpoints.
    *   Data validation and serialization.
    *   Business logic execution.
    *   Authentication and authorization middleware.
    *   Integration with PostgreSQL, Redis, MinIO, Qdrant.
*   **Interaction:** Serves `apps/web`, interacts with `packages/database`, `packages/queue`, `packages/storage`, and potentially `apps/worker` and `apps/scheduler`.

### 2.3. `apps/scheduler`

*   **Purpose:** Manages and orchestrates scheduled tasks, such as data collection jobs and report generation.
*   **Technology Stack:** Python, Redis (for task queuing and scheduling).
*   **Key Features:**
    *   Cron-based and interval-based job scheduling.
    *   Job persistence and retry mechanisms.
    *   Integration with `packages/queue` to dispatch tasks to workers.
*   **Interaction:** Dispatches jobs to `apps/worker` and `apps/browser-worker` via the queue system.

### 2.4. `apps/worker`

*   **Purpose:** Executes general-purpose background tasks that do not require browser automation.
*   **Technology Stack:** Python, Redis (for job processing).
*   **Key Features:**
    *   Asynchronous task processing.
    *   Data normalization, transformation, and analysis.
    *   Interaction with AI models (Ollama, Cloud model gateway).
    *   Integration with `packages/database`, `packages/storage`.
*   **Interaction:** Consumes tasks from the queue, processes data, and updates the database/storage.

### 2.5. `apps/browser-worker`

*   **Purpose:** Executes tasks requiring browser automation, primarily for data collection from e-commerce platforms.
*   **Technology Stack:** Python, Playwright, Redis (for job processing).
*   **Key Features:**
    *   Headless browser automation for web scraping.
    *   Rate limiting, retries, and concurrency controls per source.
    *   Sandboxed execution environment for security.
*   **Interaction:** Consumes tasks from the queue, performs browser actions, and sends collected data to `apps/worker` or directly to storage/database.

## 3. Shared Packages Design

The `packages/` directory will house reusable modules to promote code consistency and reduce duplication.

### 3.1. `packages/database`

*   **Purpose:** Centralized database access layer.
*   **Technology Stack:** SQLAlchemy, Alembic, PostgreSQL.
*   **Key Features:**
    *   ORM for interacting with PostgreSQL.
    *   Database migrations management (Alembic).
    *   Connection pooling and transaction management.
    *   Defines all database models and relationships.

### 3.2. `packages/contracts`

*   **Purpose:** Defines API contracts, data models, and interface definitions across the monorepo.
*   **Technology Stack:** Pydantic, TypeScript interfaces.
*   **Key Features:**
    *   Shared data schemas for API requests/responses.
    *   Type definitions for inter-service communication.
    *   Ensures consistency between frontend and backend.

### 3.3. `packages/config`

*   **Purpose:** Manages application configurations and environment variables.
*   **Technology Stack:** Python (e.g., Pydantic Settings), environment variables.
*   **Key Features:**
    *   Centralized configuration loading and validation.
    *   Environment-specific settings management.
    *   Secure handling of sensitive configurations.

### 3.4. `packages/logger`

*   **Purpose:** Provides structured logging capabilities across all applications.
*   **Technology Stack:** Python `logging` module, potentially a logging library like `loguru`.
*   **Key Features:**
    *   Structured log output (JSON format).
    *   Configurable log levels.
    *   Integration with Loki for centralized log aggregation.
    *   Includes request IDs and correlation IDs for traceability.

### 3.5. `packages/queue`

*   **Purpose:** Abstraction layer for interacting with the message queue system.
*   **Technology Stack:** Redis (as a message broker).
*   **Key Features:**
    *   Enqueueing and dequeuing tasks.
    *   Support for different queue types (e.g., priority queues).
    *   Retry mechanisms and dead-letter queues.

### 3.6. `packages/storage`

*   **Purpose:** Provides an interface for object storage operations.
*   **Technology Stack:** MinIO (S3-compatible object storage).
*   **Key Features:**
    *   Storing raw collected data.
    *   Storing generated reports and assets.
    *   Secure access control to stored objects.

### 3.7. `packages/security`

*   **Purpose:** Encapsulates security-related functionalities.
*   **Technology Stack:** Python (e.g., `passlib` for hashing, JWT libraries).
*   **Key Features:**
    *   Password hashing and verification.
    *   JWT token generation and validation.
    *   RBAC implementation helpers.
    *   SSRF protection utilities.

### 3.8. `packages/observability`

*   **Purpose:** Provides tools and utilities for monitoring and alerting.
*   **Technology Stack:** Prometheus client libraries, Grafana dashboards.
*   **Key Features:**
    *   Application metrics collection.
    *   Health check endpoints.
    *   Integration with Prometheus and Grafana for visualization and alerting.

### 3.9. `packages/ui`

*   **Purpose:** Reusable UI components for the frontend application.
*   **Technology Stack:** React, Tailwind CSS.
*   **Key Features:**
    *   Consistent design system.
    *   Accessibility considerations.
    *   Shared components like buttons, forms, tables, charts.

## 4. Connector Modules Design

The `connectors/` directory will contain modules responsible for interacting with specific data sources. Each connector will adhere to a common interface defined in `CONNECTOR_STANDARD.md`.

### 4.1. `connectors/bangladesh`

*   **Purpose:** Connectors for Bangladesh-specific e-commerce platforms (e.g., Daraz Bangladesh, Rokomari, Chaldal).
*   **Key Features:**
    *   Source-specific data extraction logic.
    *   Rate limiting and error handling tailored to each platform.
    *   Data mapping to a common internal schema.

### 4.2. `connectors/global`

*   **Purpose:** Connectors for global e-commerce platforms (e.g., generic Shopify/WooCommerce stores).
*   **Key Features:** Similar to `connectors/bangladesh` but for international sources.

### 4.3. `connectors/social`

*   **Purpose:** Connectors for social media and trend sources.
*   **Key Features:** Data extraction from social platforms, news feeds, RSS, forums, etc.

## 5. AI Agents Design

The `agents/` directory will house AI agents responsible for various intelligence tasks.

*   **Purpose:** Leverage AI for extraction, classification, explanation, research synthesis, and recommendations.
*   **Technology Stack:** LangGraph, Ollama (local tasks), Cloud model gateway (complex reasoning).
*   **Key Features:**
    *   Modular AI agent design.
    *   Human approval for risky actions.
    *   Integration with `apps/worker` for execution.

## 6. Database Design

PostgreSQL will be the primary relational database, managed by SQLAlchemy and Alembic. Qdrant will be used for vector similarity search.

### 6.1. PostgreSQL

*   **Purpose:** Stores structured data, including product information, market data, user data, job configurations, and analytical results.
*   **Key Tables (Initial Phase 0):**
    *   `users`: User authentication and profile information.
    *   `roles`: Role-based access control definitions.
    *   `sources`: Configuration for data sources (e.g., marketplace URLs, scraping rules).
    *   `crawl_jobs`: Records of scheduled and executed data collection jobs.

### 6.2. Qdrant

*   **Purpose:** Vector database for storing and querying embeddings, primarily for AI-driven tasks like product similarity, sentiment analysis, and lead discovery.

## 7. Event System Design

An event-driven architecture will be implemented using Redis as a message broker.

*   **Purpose:** Facilitate asynchronous communication between services and real-time updates to the frontend.
*   **Technology Stack:** Redis Pub/Sub, Redis Streams.
*   **Key Events:**
    *   `data_collected`: Triggered when new data is collected by a connector.
    *   `data_normalized`: Triggered after data normalization.
    *   `insight_generated`: Triggered when a new insight is derived.
    *   `dashboard_update`: For real-time dashboard updates via SSE/WebSocket.

## 8. Queue System Design

Redis will serve as the backbone for the queue system, managing tasks for workers.

*   **Purpose:** Decouple task producers (scheduler, API) from task consumers (workers).
*   **Technology Stack:** Redis lists/streams.
*   **Key Features:**
    *   Task queues for `apps/worker` and `apps/browser-worker`.
    *   Priority queues for critical tasks.
    *   Delayed task execution.
    *   Error handling and retry mechanisms.

## 9. Browser Worker System Design

The browser worker system will be built using Playwright within a sandboxed environment.

*   **Purpose:** Safely and efficiently perform web scraping and browser automation tasks.
*   **Technology Stack:** Playwright, Docker (for sandboxing).
*   **Key Features:**
    *   Isolated browser instances per task.
    *   Dynamic IP rotation (future consideration).
    *   Robust error handling for network issues and website changes.
    *   Resource limits to prevent abuse.

## 10. Authentication and Permission System Design

Authentication and Role-Based Access Control (RBAC) will be foundational elements of the security architecture.

### 10.1. Authentication

*   **Mechanism:** JWT-based authentication.
*   **Flow:** Users log in via `apps/web`, `apps/api` issues JWT tokens.
*   **Security:** API key hashing, secure token storage.

### 10.2. Permission System (RBAC)

*   **Mechanism:** Role-Based Access Control.
*   **Implementation:** `users` and `roles` tables in PostgreSQL, middleware in `apps/api`.
*   **Key Features:**
    *   Granular permissions for different user roles.
    *   Enforcement of access policies at the API level.

## 11. Logging System Design

A structured logging system will be implemented across all services.

*   **Purpose:** Provide comprehensive and traceable logs for debugging, auditing, and monitoring.
*   **Technology Stack:** `packages/logger`, Loki.
*   **Key Features:**
    *   JSON-formatted logs.
    *   Inclusion of request IDs and correlation IDs.
    *   Centralized log aggregation with Loki.
    *   Configurable log levels (DEBUG, INFO, WARNING, ERROR, CRITICAL).

## 12. Monitoring System Design

Comprehensive monitoring will be established using Prometheus, Grafana, and Uptime Kuma.

*   **Purpose:** Observe system health, performance, and resource utilization.
*   **Technology Stack:** Prometheus, Grafana, Uptime Kuma.
*   **Key Features:**
    *   Metrics collection from all services (CPU, memory, network, custom application metrics).
    *   Dashboards for real-time visualization in Grafana.
    *   Alerting based on predefined thresholds.
    *   External uptime monitoring with Uptime Kuma.

## 13. Docker Architecture

Docker and Docker Compose will be used for local development and deployment.

*   **Purpose:** Provide a consistent and isolated development and production environment.
*   **Key Components:**
    *   `docker-compose.yml`: Defines all services (web, api, scheduler, workers, database, redis, minio, qdrant, prometheus, grafana, loki, traefik).
    *   `Dockerfile`s: For each application and service.
    *   Custom Dockerfiles for `web-db-user` scaffold to include extra language runtimes/system binaries.

## 14. Deployment and Scaling Strategy

### 14.1. Deployment

*   **Mechanism:** Containerized deployment using Docker. Orchestration will be handled by Docker Compose for smaller deployments, and potentially Kubernetes for larger-scale production environments (future).
*   **CI/CD:** Automated CI/CD pipelines for linting, type checking, testing, building, and deploying.

### 14.2. Scaling

*   **Horizontal Scaling:** Most services (API, scheduler, workers) are designed to be stateless and can be scaled horizontally by adding more instances.
*   **Database Scaling:** PostgreSQL can be scaled vertically initially, with options for read replicas and sharding for future growth.
*   **Queue Scaling:** Redis can be scaled with clustering solutions.
*   **Browser Workers:** Auto-scaling of browser workers based on queue depth and task load.

## 15. Bangladesh-First Roadmap (Phase 0 Focus)

Phase 0 focuses on building the foundational elements:

*   Monorepo setup with initial `apps/`, `packages/`, `connectors/` directories.
*   Docker development environment with `docker-compose.yml`.
*   Basic Next.js dashboard shell (`apps/web`).
*   FastAPI API (`apps/api`) with health/readiness endpoints.
*   PostgreSQL and Redis integration.
*   Initial `users`, `roles`, `sources`, `crawl_jobs` database models.
*   Authentication and RBAC foundation.
*   Structured logging with request/correlation IDs.
*   CI pipeline for linting, type checking, testing, and builds.
*   Initial documentation: `README.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `SECURITY.md`, `CONNECTOR_STANDARD.md`, `DATA_TRUST_STANDARD.md`.

## 16. Global Expansion Roadmap (Future Phases)

Future phases will involve expanding the platform's capabilities and reach:

*   **South Asia Expansion:** Onboarding connectors for other South Asian markets.
*   **Global Market Integration:** Developing connectors for major global e-commerce platforms.
*   **Advanced AI Agents:** Implementing more sophisticated AI agents for deeper insights and automation.
*   **Enhanced Real-time Features:** Further development of real-time data processing and dashboard capabilities.
*   **Scalability Improvements:** Optimizing infrastructure for larger data volumes and user bases.
*   **New Product Features:** Introducing modular commerce products such as supplier, inventory, financial, marketing, sourcing, and governed workflow intelligence after their shared data, evidence, and permission contracts are validated.
