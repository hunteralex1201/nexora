# NEXORA Intelligence Database Design

## 1. Introduction

This document details the database design for NEXORA Intelligence, focusing on the primary relational database (PostgreSQL) and the vector database (Qdrant). It outlines the core entities, their relationships, and the rationale behind their structure, particularly for Phase 0 implementation.

## 2. Database Technologies

NEXORA Intelligence will utilize a combination of database technologies to support its diverse data storage and retrieval needs:

*   **PostgreSQL:** The primary relational database for structured data, including user information, system configurations, collected market data, and analytical results. It offers robust ACID compliance, extensibility, and a rich feature set suitable for complex business logic.
*   **Qdrant:** A vector database specifically chosen for storing and querying high-dimensional vectors (embeddings). This will be crucial for AI-driven tasks such as product similarity analysis, sentiment analysis, and business lead discovery.
*   **Redis:** While primarily used as a caching layer and message broker, Redis will also serve as a temporary data store for transient data, session management, and rate limiting counters.

## 3. PostgreSQL Database Design (Phase 0 Focus)

During Phase 0, the focus will be on establishing the foundational tables required for user management, system configuration, and initial data collection job tracking. The database schema will be managed using SQLAlchemy ORM and Alembic for migrations.

### 3.1. Core Entities and Tables

#### 3.1.1. `users` Table

This table will store user authentication and profile information. It forms the basis of the authentication system.

| Column Name    | Data Type          | Constraints            | Description                               |
| :------------- | :----------------- | :--------------------- | :---------------------------------------- |
| `id`           | `UUID`             | `PRIMARY KEY`, `NOT NULL` | Unique identifier for the user.           |
| `email`        | `VARCHAR(255)`     | `UNIQUE`, `NOT NULL`   | User's email address, used for login.     |
| `password_hash`| `VARCHAR(255)`     | `NOT NULL`             | Hashed password for secure authentication. |
| `first_name`   | `VARCHAR(100)`     |                        | User's first name.                        |
| `last_name`    | `VARCHAR(100)`     |                        | User's last name.                         |
| `is_active`    | `BOOLEAN`          | `DEFAULT TRUE`         | Account status.                           |
| `is_superuser` | `BOOLEAN`          | `DEFAULT FALSE`        | Indicates if the user has superuser privileges. |
| `created_at`   | `TIMESTAMP`        | `DEFAULT NOW()`        | Timestamp of user creation.               |
| `updated_at`   | `TIMESTAMP`        | `DEFAULT NOW()`        | Last update timestamp.                    |

#### 3.1.2. `roles` Table

This table defines the roles within the system, supporting Role-Based Access Control (RBAC).

| Column Name    | Data Type          | Constraints            | Description                               |
| :------------- | :----------------- | :--------------------- | :---------------------------------------- |
| `id`           | `UUID`             | `PRIMARY KEY`, `NOT NULL` | Unique identifier for the role.           |
| `name`         | `VARCHAR(50)`      | `UNIQUE`, `NOT NULL`   | Name of the role (e.g., 'admin', 'analyst'). |
| `description`  | `TEXT`             |                        | Description of the role's permissions.    |

#### 3.1.3. `user_roles` Junction Table

This table links users to roles, allowing a many-to-many relationship.

| Column Name    | Data Type          | Constraints            | Description                               |
| :------------- | :----------------- | :--------------------- | :---------------------------------------- |
| `user_id`      | `UUID`             | `FOREIGN KEY (users.id)`, `NOT NULL` | Reference to the user.                    |
| `role_id`      | `UUID`             | `FOREIGN KEY (roles.id)`, `NOT NULL` | Reference to the role.                    |
| `PRIMARY KEY`  | (`user_id`, `role_id`) |                        | Composite primary key.                    |

#### 3.1.4. `sources` Table

This table will store configurations for various data sources that NEXORA Intelligence will monitor. This includes marketplace URLs, API keys (if applicable), and scraping rules.

| Column Name    | Data Type          | Constraints            | Description                               |
| :------------- | :----------------- | :--------------------- | :---------------------------------------- |\n| `id`           | `UUID`             | `PRIMARY KEY`, `NOT NULL` | Unique identifier for the data source.    |
| `name`         | `VARCHAR(100)`     | `UNIQUE`, `NOT NULL`   | Human-readable name of the source (e.g., 'Daraz BD'). |
| `type`         | `VARCHAR(50)`      | `NOT NULL`             | Type of source (e.g., 'marketplace', 'api', 'news'). |
| `base_url`     | `TEXT`             | `NOT NULL`             | Base URL for web scraping or API endpoint. |
| `config`       | `JSONB`            | `DEFAULT '{}'`         | JSON configuration for the source (e.g., scraping rules, API credentials). |
| `is_active`    | `BOOLEAN`          | `DEFAULT TRUE`         | Indicates if the source is actively monitored. |
| `created_at`   | `TIMESTAMP`        | `DEFAULT NOW()`        | Timestamp of source creation.             |
| `updated_at`   | `TIMESTAMP`        | `DEFAULT NOW()`        | Last update timestamp.                    |

#### 3.1.5. `crawl_jobs` Table

This table tracks the execution of data collection jobs for each source.

| Column Name    | Data Type          | Constraints            | Description                               |
| :------------- | :----------------- | :--------------------- | :---------------------------------------- |
| `id`           | `UUID`             | `PRIMARY KEY`, `NOT NULL` | Unique identifier for the crawl job.      |
| `source_id`    | `UUID`             | `FOREIGN KEY (sources.id)`, `NOT NULL` | Reference to the data source.             |
| `status`       | `VARCHAR(50)`      | `NOT NULL`             | Current status of the job (e.g., 'pending', 'running', 'completed', 'failed'). |
| `started_at`   | `TIMESTAMP`        |                        | Timestamp when the job started.           |
| `completed_at` | `TIMESTAMP`        |                        | Timestamp when the job completed.         |
| `error_message`| `TEXT`             |                        | Error details if the job failed.          |
| `metrics`      | `JSONB`            | `DEFAULT '{}'`         | JSON object for job-specific metrics (e.g., items processed, duration). |

## 4. Qdrant Database Design

Qdrant will be used for vector storage and similarity search. The design will involve creating collections for different types of embeddings.

### 4.1. Collections (Future Phases)

*   **`product_embeddings`:** Stores vector representations of products for similarity search, new product detection, and category intelligence.
*   **`review_sentiment_embeddings`:** Stores embeddings of customer reviews for sentiment analysis and trend detection.
*   **`lead_embeddings`:** Stores embeddings of business leads for discovery and matching.

## 5. Redis Usage

Redis will be utilized for several purposes:

*   **Caching:** Frequently accessed data to reduce database load.
*   **Message Broker:** For the event system and queue system.
*   **Rate Limiting:** To enforce source-specific rate limits during data collection.
*   **Session Management:** For user sessions.

## 6. Data Trust Standard Integration

Every metric and intelligence result will be classified according to the `DATA_TRUST_STANDARD.md` (to be created). This classification will be stored alongside the data where applicable.

*   **Metric Classification:** Verified, Derived, Estimated, AI-generated, Stale, Unavailable.
*   **Intelligence Result Attributes:** Evidence, Source, Confidence score, Freshness, Calculation version, Generated timestamp.

## 7. Future Database Considerations

As the platform evolves, additional tables and database features will be considered:

*   **Product Catalog:** Detailed product information, attributes, and historical data.
*   **Price History:** Tracking price changes over time for various products.
*   **Competitor Data:** Information about competitor products and strategies.
*   **Alerts and Notifications:** Configuration for user-defined alerts.
*   **Audit Logs:** Comprehensive logs of user actions and system events.
*   **Sharding and Replication:** For scaling PostgreSQL to handle larger data volumes and higher traffic.

## 8. Migrations

Alembic will be used to manage database schema migrations, ensuring that changes are applied consistently and safely across environments. All schema changes will be version-controlled.
