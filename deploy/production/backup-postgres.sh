#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

APP_DIR=${NEXORA_APP_DIR:-/opt/nexora/app}
BACKUP_ROOT=${NEXORA_BACKUP_ROOT:-/var/backups/nexora/postgres}
RETENTION_DAYS=${NEXORA_BACKUP_RETENTION_DAYS:-7}
DOCKER_CONFIG=${DOCKER_CONFIG:-/tmp/nexora-backup-docker}
LOCK_FILE="$BACKUP_ROOT/.backup.lock"

mkdir -p "$DOCKER_CONFIG"
chmod 0700 "$DOCKER_CONFIG"
export DOCKER_CONFIG

if ! [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
  printf 'NEXORA_BACKUP_RETENTION_DAYS must be a non-negative integer.\n' >&2
  exit 2
fi

mkdir -p "$BACKUP_ROOT"
cd "$APP_DIR"

if [[ ! -f .env ]]; then
  printf 'Production environment file is missing: %s/.env\n' "$APP_DIR" >&2
  exit 1
fi

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  printf 'A NEXORA PostgreSQL backup is already running.\n' >&2
  exit 0
fi

compose=(
  docker compose
  --env-file .env
  --profile core
  -f docker-compose.yml
  -f deploy/production/compose.production.yml
)

postgres_id=$("${compose[@]}" ps -q postgres)
if [[ -z "$postgres_id" ]] || [[ "$(docker inspect --format '{{.State.Status}}' "$postgres_id")" != 'running' ]]; then
  printf 'The production PostgreSQL container is not running.\n' >&2
  exit 1
fi

timestamp=$(date -u +'%Y%m%dT%H%M%SZ')
filename="nexora-postgres-${timestamp}.dump"
temporary="$BACKUP_ROOT/.${filename}.tmp"
final="$BACKUP_ROOT/$filename"
checksum="$final.sha256"

cleanup() {
  rm -f "$temporary"
}
trap cleanup EXIT

"${compose[@]}" exec -T postgres sh -c \
  'pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom --compress=9 --no-owner --no-acl' \
  >"$temporary"

if [[ ! -s "$temporary" ]]; then
  printf 'PostgreSQL produced an empty backup.\n' >&2
  exit 1
fi

"${compose[@]}" exec -T postgres pg_restore --list <"$temporary" >/dev/null
mv "$temporary" "$final"
sha256sum "$final" >"$checksum"

find "$BACKUP_ROOT" -maxdepth 1 -type f \
  \( -name 'nexora-postgres-*.dump' -o -name 'nexora-postgres-*.dump.sha256' \) \
  -mtime "+$RETENTION_DAYS" -delete

printf 'NEXORA_POSTGRES_BACKUP=PASS file=%s bytes=%s\n' \
  "$final" "$(stat -c '%s' "$final")"
