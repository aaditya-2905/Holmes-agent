#!/usr/bin/env bash
# Optional helper for the repo-root docker-compose.yaml. Safe to re-run.
# - creates .env from .env.example and fills in this host's docker / systemd-journal group IDs
# - copies ~/.kube/config to local-sre/.kube/config so the agent (user 'nobody') can read it
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$HERE")"
ENV_FILE="$ROOT/.env"

[ -f "$ENV_FILE" ] || { (umask 077; cp "$ROOT/.env.example" "$ENV_FILE"); echo "Created .env from .env.example"; }

set_var() {  # set_var KEY VALUE  - replace or append KEY=VALUE in .env
  if grep -q "^$1=" "$ENV_FILE"; then sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"; else echo "$1=$2" >> "$ENV_FILE"; fi
}

DOCKER_GID=$(getent group docker | cut -d: -f3 || true)
JOURNAL_GID=$(getent group systemd-journal | cut -d: -f3 || true)
[ -n "$DOCKER_GID" ] || { echo "No 'docker' group found on this host"; exit 1; }
[ -n "$JOURNAL_GID" ] || { echo "No 'systemd-journal' group found on this host"; exit 1; }
set_var DOCKER_GID "$DOCKER_GID"
set_var JOURNAL_GID "$JOURNAL_GID"
echo "DOCKER_GID=$DOCKER_GID JOURNAL_GID=$JOURNAL_GID"

# The agent runs as 'nobody' with the docker group, so it can only read a kubeconfig
# that the docker group can read. Members of that group are already root-equivalent
# via docker.sock, so this grants nothing new. Re-run after your kubeconfig changes.
mkdir -p "$HERE/.kube"
if [ -f "${KUBECONFIG_SRC:=$HOME/.kube/config}" ]; then
  install -m 640 -g "$DOCKER_GID" "$KUBECONFIG_SRC" "$HERE/.kube/config"
  echo "Copied $KUBECONFIG_SRC -> local-sre/.kube/config (mode 640, group docker)"
else
  echo "No kubeconfig at $KUBECONFIG_SRC - Kubernetes tools will report it as missing"
fi

grep -Eq '^(OPENROUTER|OPENAI|ANTHROPIC|GEMINI)_API_KEY=.+' "$ENV_FILE" || echo "Next: put your API key and MODEL in .env"
echo "Then, from the repo root: docker compose up -d --build"
