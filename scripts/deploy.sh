#!/usr/bin/env bash
set -euo pipefail

# Prosty deployer dla single-host. Uruchamiaj na serwerze.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$APP_ROOT/deploy"

export IMAGE_TAG="${IMAGE_TAG:-}"           # opcjonalnie nadpisz tag w locie
export IMAGE_REF="${IMAGE_REF:-}"           # lub pełny ref (ghcr.io/org/repo:tag)
export PROXY_NETWORK="${PROXY_NETWORK:-traefik-proxy}" # zewnętrzna sieć współdzielona z innymi usługami (np. n8n)

if [ -n "${IMAGE_TAG:-}" ] && [ -z "${IMAGE_REF:-}" ]; then
  # jeżeli podano tylko IMAGE_TAG, spróbuj zbudować IMAGE_REF na bazie obecnego
  # wpisu w compose (zastępując tag po dwukropku)
  default_ref=$(grep -E "image: .*" docker-compose.prod.yml | head -1 | awk '{print $2}')
  base_ref="${default_ref%%:*}"
  export IMAGE_REF="${base_ref}:${IMAGE_TAG}"
  echo "Using IMAGE_REF=${IMAGE_REF}"
fi

echo "==> Ensuring external network '$PROXY_NETWORK' exists"
docker network inspect "$PROXY_NETWORK" >/dev/null 2>&1 || docker network create "$PROXY_NETWORK"

echo "==> Pulling images"
docker compose -f docker-compose.prod.yml pull

echo "==> Starting/Updating stack"
docker compose -f docker-compose.prod.yml up -d

echo "==> Pruning old images (optional)"
docker image prune -f >/dev/null 2>&1 || true

echo "==> Done"
