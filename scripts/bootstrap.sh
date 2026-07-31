#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKIP_INSTALL=false
CREATE_ENV=true

usage() {
  cat <<'EOF'
Usage: ./scripts/bootstrap.sh [--skip-install] [--no-env]

Initializes a local NEXORA development checkout without starting services or
changing the host. The script is safe to run repeatedly.

Options:
  --skip-install  Check prerequisites and environment only.
  --no-env        Do not create .env from .env.example.
  -h, --help      Show this help text.
EOF
}

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required but was not found in PATH. $2"
}

for argument in "$@"; do
  case "$argument" in
    --skip-install) SKIP_INSTALL=true ;;
    --no-env) CREATE_ENV=false ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown argument: $argument" ;;
  esac
done

require_command node "Install Node.js 20.9 or newer."
require_command pnpm "Install pnpm 10 or enable the packageManager release through Corepack."
require_command poetry "Install Poetry 2.x for the API environment."
require_command python3 "Install Python 3.11 or newer."

node_major="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
python_version="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
python_major="${python_version%%.*}"
python_minor="${python_version##*.}"

[[ "$node_major" -ge 20 ]] || fail "Node.js 20.9 or newer is required; found $(node --version)."
[[ "$python_major" -gt 3 || ( "$python_major" -eq 3 && "$python_minor" -ge 11 ) ]] \
  || fail "Python 3.11 or newer is required; found $python_version."

cd "$ROOT_DIR"

if [[ "$CREATE_ENV" == true && ! -f .env ]]; then
  cp .env.example .env
  chmod 600 .env 2>/dev/null || true
  printf '%s\n' 'Created .env from .env.example.'
  printf '%s\n' 'Replace every CHANGE_ME value before starting shared or persistent services.'
elif [[ -f .env ]]; then
  printf '%s\n' 'Preserved existing .env.'
fi

if [[ "$SKIP_INSTALL" == false ]]; then
  pnpm install --frozen-lockfile
  poetry --directory apps/api install --with dev --no-interaction --no-ansi
else
  printf '%s\n' 'Dependency installation skipped by request.'
fi

printf '%s\n' 'Bootstrap complete. No services were started and no external systems were modified.'
printf '%s\n' 'Run ./scripts/validate.sh for the complete local foundation validation gate.'
