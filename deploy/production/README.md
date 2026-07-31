# NEXORA Production Deployment

This directory contains the **production-only Compose override** for the engineering-foundation release. It publishes only Caddy on ports 80 and 443. PostgreSQL, Redis, MinIO, Qdrant, the API, and the Next.js server retain their loopback or private Compose-network bindings.

| File | Purpose |
| --- | --- |
| `compose.production.yml` | Applies production API and web settings and adds the pinned Caddy TLS proxy. |
| `Caddyfile` | Terminates HTTPS, routes `/api/*` to FastAPI, routes all other requests to Next.js, and adds baseline response headers. |
| `.env.example` | Documents required production variables without containing deployable credentials. |

## First deployment

Run the following commands from a clean clone. Generate every secret independently; do not reuse development, VPS, GitHub, or personal credentials.

```bash
cp deploy/production/.env.example .env
chmod 600 .env
# Replace every CHANGE_ME value before continuing.
docker compose \
  --env-file .env \
  --profile core \
  -f docker-compose.yml \
  -f deploy/production/compose.production.yml \
  config --quiet

docker compose \
  --env-file .env \
  --profile core \
  -f docker-compose.yml \
  -f deploy/production/compose.production.yml \
  up -d --build
```

## Validation and updates

Inspect container state and service logs after every deployment. Updates must be a fast-forward pull from the validated `main` branch followed by the same configuration check and Compose command.

```bash
docker compose \
  --env-file .env \
  --profile core \
  -f docker-compose.yml \
  -f deploy/production/compose.production.yml \
  ps

docker compose \
  --env-file .env \
  --profile core \
  -f docker-compose.yml \
  -f deploy/production/compose.production.yml \
  logs --tail=100 api web caddy
```

The temporary `sslip.io` hostname and automatic-TLS rationale are recorded in `docs/checkpoints/VPS_TLS_DECISION_2026-08-01.md`. Replacing it with a user-owned domain requires a separate DNS change, updated environment values, and a redeployment.
