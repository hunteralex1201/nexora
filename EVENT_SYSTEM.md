# NEXORA Intelligence Event System Design

## 1. Introduction

This document outlines the design and implementation of the event system for NEXORA Intelligence. The event system is a critical component for enabling asynchronous communication between various services, facilitating real-time updates, and ensuring a decoupled and scalable architecture.

## 2. Event System Principles

The NEXORA Intelligence event system will adhere to the following principles:

*   **Asynchronous Communication:** Services will communicate primarily through events, reducing direct dependencies and improving system resilience.
*   **Decoupling:** Producers and consumers of events will be decoupled, allowing independent development and deployment of services.
*   **Real-time Capabilities:** The system will support real-time data flow for dashboard updates and immediate notifications.
*   **Reliability:** Events should be delivered reliably, with mechanisms for retries and handling of transient failures.
*   **Observability:** All events will be traceable and auditable, with comprehensive logging and monitoring.

## 3. Technology Stack

Redis will serve as the core technology for the event system, leveraging its Pub/Sub and Streams capabilities.

*   **Redis Pub/Sub:** For simple, fire-and-forget event broadcasting where consumers do not need to persist events or guarantee delivery.
*   **Redis Streams:** For more robust event logging and processing, where events need to be persisted, and multiple consumers can read from the stream independently, maintaining their own consumer groups and offsets.

## 4. Event Structure

Each event will follow a standardized structure to ensure consistency and ease of processing across the system. A typical event payload will include:

*   `event_id`: A unique identifier for the event (UUID).
*   `event_type`: A string indicating the type of event (e.g., `data_collected`, `insight_generated`).
*   `timestamp`: The UTC timestamp when the event was generated.
*   `source_service`: The service that produced the event.
*   `correlation_id`: An identifier to link related events across different services or operations.
*   `payload`: A JSON object containing event-specific data.

## 5. Key Event Types (Phase 0 Focus)

During Phase 0, the event system will support foundational events related to job tracking, data collection, and user authentication. These events will be crucial for establishing basic system functionality and observability.

### 5.1. Core Events

*   **`crawl_job_started`**
    *   **Description:** Signifies the initiation of a data collection job.
    *   **Payload:**
        *   `job_id`: ID of the crawl job.
        *   `source_id`: ID of the data source being crawled.
        *   `scheduled_time`: The time the job was scheduled.

*   **`crawl_job_completed`**
    *   **Description:** Indicates the completion (success or failure) of a data collection job.
    *   **Payload:**
        *   `job_id`: ID of the crawl job.
        *   `source_id`: ID of the data source.
        *   `status`: `success` or `failed`.
        *   `duration_seconds`: Time taken for the job.
        *   `records_processed`: Number of records processed.
        *   `error_message`: (Optional) Details if the job failed.

*   **`data_collected`**
    *   **Description:** Triggered when raw data has been successfully collected from a source and stored.
    *   **Payload:**
        *   `job_id`: ID of the crawl job that collected the data.
        *   `source_id`: ID of the data source.
        *   `data_path`: Path to the raw data in storage (e.g., MinIO).
        *   `record_count`: Number of data records collected.

*   **`auth_user_created`**
    *   **Description:** Fired when a new user account is successfully created.
    *   **Payload:**
        *   `user_id`: ID of the newly created user.
        *   `email`: User's email address.
        *   `roles`: List of roles assigned to the user.

*   **`dashboard_update`**
    *   **Description:** Used to push real-time updates to the frontend dashboard via SSE/WebSocket.
    *   **Payload:**
        *   `widget_id`: Identifier for the dashboard widget to update.
        *   `data`: The updated data for the widget.
        *   `update_type`: (e.g., `partial`, `full_refresh`).

### 5.2. Future Event Types

As the platform evolves, more specialized events will be introduced:

*   **`data_normalized`:** After raw data is processed and normalized.
*   **`product_detected`:** When a new product is identified.
*   **`price_change_detected`:** When a significant price change is observed.
*   **`sentiment_analyzed`:** After customer sentiment analysis is performed.
*   **`insight_generated`:** When an AI agent generates a new insight.
*   **`report_generated`:** When an automated report is created.
*   **`alert_triggered`:** When a user-defined alert condition is met.

## 6. Event Producers and Consumers

### 6.1. Producers

Services that generate and publish events:

*   `apps/scheduler`: `crawl_job_started`
*   `apps/worker`: `crawl_job_completed`, `data_collected`, `data_normalized`, `product_detected`, `sentiment_analyzed`, `insight_generated`, `report_generated`
*   `apps/browser-worker`: `crawl_job_completed`, `data_collected`
*   `apps/api`: `auth_user_created`, `alert_triggered`

### 6.2. Consumers

Services that subscribe to and process events:

*   `apps/api`: Listens for various events to update internal state or trigger notifications.
*   `apps/web`: Subscribes to `dashboard_update` events via SSE/WebSocket for real-time UI updates.
*   `apps/worker`: Listens for `data_collected` to initiate normalization, `data_normalized` to trigger analysis, etc.
*   `apps/scheduler`: May listen for `crawl_job_completed` to schedule follow-up tasks.
*   `packages/logger`: Consumes all events for audit logging and traceability.

## 7. Integration with Other Systems

*   **Logging (`packages/logger`):** All events will be logged with their `event_id` and `correlation_id` for comprehensive traceability and debugging.
*   **Monitoring (`packages/observability`):** Metrics related to event publishing and consumption (e.g., event rates, processing latency, error rates) will be collected and monitored.
*   **Queue System (`packages/queue`):** The event system heavily relies on Redis, which also powers the queue system, ensuring a unified message infrastructure.

## 8. Phase 0 Implementation Focus

Phase 0 will establish the core Redis infrastructure for the event system and implement the basic event types required for initial job tracking and user authentication. This includes:

*   Setting up Redis in the Docker environment.
*   Implementing event publishing and subscription mechanisms using Redis Pub/Sub and Streams.
*   Defining and implementing the `crawl_job_started`, `crawl_job_completed`, `data_collected`, `auth_user_created`, and `dashboard_update` events.
*   Ensuring that `packages/logger` can capture event details for audit purposes.
