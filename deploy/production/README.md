# NEXORA Production Deployment

This directory contains the **production-only deployment controls** for the engineering-foundation release. Only Caddy is published on ports 80 and 443. PostgreSQL, Redis, MinIO, Qdrant, the API, and the Next.js server remain on loopback or the private Compose network.

| File | Purpose |
| --- | --- |
| `compose.production.yml` | Applies production API and web settings and adds the pinned Caddy TLS proxy. |
| `Caddyfile` | Terminates HTTPS, sends `/api/auth/*` to the Next.js session bridge, sends other `/api/*` requests to FastAPI, and proxies remaining routes to Next.js. |
| `.env.example` | Documents required production variables without deployable credentials. |
| `backup-postgres.sh` | Creates an atomic custom-format PostgreSQL backup, verifies its catalog, writes a SHA-256 checksum, and removes expired local backups. |
| `nexora-postgres-backup.service` | Runs the backup as the non-root `nexora` operator with a restricted systemd sandbox. |
| `nexora-postgres-backup.timer` | Runs the backup daily at 02:15 UTC with a bounded randomized delay and missed-run persistence. |
| `docker-daemon.json.example` | Bounds Docker JSON logs to five 10 MB files per container. |

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

## Daily PostgreSQL backups

Install the versioned service and timer after the application is deployed. The backup directory is local to the VPS and is readable only by the `nexora` account.

```bash
sudo install -d -o nexora -g nexora -m 0700 /var/backups/nexora/postgres
sudo install -o root -g root -m 0644 \
  deploy/production/nexora-postgres-backup.service \
  /etc/systemd/system/nexora-postgres-backup.service
sudo install -o root -g root -m 0644 \
  deploy/production/nexora-postgres-backup.timer \
  /etc/systemd/system/nexora-postgres-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now nexora-postgres-backup.timer
sudo systemctl start nexora-postgres-backup.service
sudo systemctl status --no-pager nexora-postgres-backup.service
sudo systemctl list-timers --all --no-pager | grep nexora-postgres-backup
```

Verify the newest dump and checksum before using it for recovery:

```bash
latest=$(sudo -u nexora find /var/backups/nexora/postgres -maxdepth 1 \
  -type f -name 'nexora-postgres-*.dump' -printf '%T@ %p\n' \
  | sort -n | tail -1 | cut -d' ' -f2-)
sudo -u nexora sha256sum --check "${latest}.sha256"
```

A complete recovery test must restore the dump into a temporary database, verify expected tables and records, and then drop only that temporary database. Never test restore commands against the live `nexora` database.

## Docker log retention

Install the versioned daemon policy only after reviewing any existing `/etc/docker/daemon.json`. Restarting Docker briefly interrupts public traffic; all production services use `restart: unless-stopped` and must be revalidated afterward.

```bash
sudo install -o root -g root -m 0600 \
  deploy/production/docker-daemon.json.example \
  /etc/docker/daemon.json
sudo systemctl restart docker

docker compose \
  --env-file .env \
  --profile core \
  -f docker-compose.yml \
  -f deploy/production/compose.production.yml \
  up -d --force-recreate
```

## Validation and updates

Updates must be a fast-forward pull from the validated `main` branch. Recreate any container that bind-mounts a changed single file so the container receives the new file inode.

```bash
git status --short
git pull --ff-only origin main

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

docker compose \
  --env-file .env \
  --profile core \
  -f docker-compose.yml \
  -f deploy/production/compose.production.yml \
  ps
```

Inspect service logs without printing `.env` or bearer tokens:

```bash
docker compose \
  --env-file .env \
  --profile core \
  -f docker-compose.yml \
  -f deploy/production/compose.production.yml \
  logs --tail=100 api web caddy
```

The temporary `sslip.io` hostname and automatic-TLS rationale are recorded in `docs/checkpoints/VPS_TLS_DECISION_2026-08-01.md`. Replacing it with a user-owned domain requires a separate DNS change, updated environment values, and a redeployment.

> **Recovery boundary:** local daily dumps protect against accidental database changes and container-volume faults. They do not protect against complete VPS loss. Production disaster recovery still requires an approved encrypted off-host destination, retention policy, and restore drill.
