#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_IMAGES=true
DOCKER_BUILD_NETWORK="${NEXORA_DOCKER_BUILD_NETWORK:-}"

usage() {
  cat <<'EOF'
Usage: ./scripts/validate.sh [--skip-images]

Runs the complete deterministic NEXORA engineering-foundation validation gate.
Compose profiles are always rendered. Container images are built by default and
may be skipped only when a Docker daemon is unavailable; record that limitation.

Options:
  --skip-images  Skip API and web image builds, but still validate Compose.
  -h, --help     Show this help text.

Set NEXORA_DOCKER_BUILD_NETWORK only when the Docker daemon requires an explicit
build network, such as `host` in a restricted local validation environment.
EOF
}

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

run_step() {
  local title="$1"
  shift
  printf '\n==> %s\n' "$title"
  "$@"
}

for argument in "$@"; do
  case "$argument" in
    --skip-images) BUILD_IMAGES=false ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown argument: $argument" ;;
  esac
done

command -v pnpm >/dev/null 2>&1 || fail "pnpm is required. Run ./scripts/bootstrap.sh first."
command -v poetry >/dev/null 2>&1 || fail "Poetry is required. Run ./scripts/bootstrap.sh first."
command -v docker >/dev/null 2>&1 || fail "Docker with the Compose plugin is required for topology validation."
docker compose version >/dev/null 2>&1 || fail "The Docker Compose v2 plugin is required."

cd "$ROOT_DIR"

run_step "JavaScript dependency audit" pnpm run audit:dependencies
run_step "JavaScript formatting" pnpm run format:check
run_step "Workspace lint" pnpm run lint
run_step "Workspace strict type checking" pnpm run typecheck
run_step "Workspace tests and coverage" pnpm run test
run_step "Workspace production builds" pnpm run build
run_step "Backend formatting, lint, typing, tests, and coverage" pnpm run validate:api
run_step "API import and required-route smoke" poetry --directory apps/api run python scripts/smoke_app.py
run_step "Alembic upgrade/downgrade/re-upgrade" poetry --directory apps/api run python scripts/validate_migrations.py

compose_environment=".env"
if [[ ! -f "$compose_environment" ]]; then
  compose_environment=".env.example"
  printf '\nUsing .env.example for non-runtime Compose rendering.\n'
fi

for profile in core automation ai monitoring full; do
  run_step "Compose profile: $profile" \
    docker compose --env-file "$compose_environment" --profile "$profile" config --quiet
done

if [[ "$BUILD_IMAGES" == true ]]; then
  docker info >/dev/null 2>&1 || fail "Docker daemon is unavailable. Start it or rerun with --skip-images and document the limitation."
  build_network_arguments=()
  if [[ -n "$DOCKER_BUILD_NETWORK" ]]; then
    build_network_arguments=(--network "$DOCKER_BUILD_NETWORK")
    printf '\nUsing Docker build network: %s\n' "$DOCKER_BUILD_NETWORK"
  fi
  run_step "API production image" docker build "${build_network_arguments[@]}" --pull=false -t nexora-api:validation apps/api
  run_step "Web production image" docker build "${build_network_arguments[@]}" --pull=false -f apps/web/Dockerfile -t nexora-web:validation .
else
  printf '\nContainer image builds skipped by explicit request.\n'
fi

printf '\nAll selected engineering-foundation validation gates passed.\n'
