#!/usr/bin/env bash
# Run the Holmes API server directly on this machine (no Docker), so its tools see
# the host's network, processes, systemd services and Docker containers.
#
#   export OPENROUTER_API_KEY=...            # or OPENAI_API_KEY / ANTHROPIC_API_KEY ...
#   export MODEL=openrouter/<provider>/<model>
#   ./local-sre/run.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

POETRY_HOME_VENV="${POETRY_HOME_VENV:-$HOME/.local/share/poetry185}"
if [ ! -x .venv/bin/python ]; then
  if [ ! -x "$POETRY_HOME_VENV/bin/poetry" ]; then
    python3 -m venv "$POETRY_HOME_VENV"
    "$POETRY_HOME_VENV/bin/pip" install -q "poetry==1.8.5"
  fi
  POETRY_VIRTUALENVS_IN_PROJECT=true "$POETRY_HOME_VENV/bin/poetry" install --only main --no-interaction
fi

: "${MODEL:?Set MODEL, e.g. export MODEL=openrouter/anthropic/claude-sonnet-4.5}"

# Config, approved bash prefixes etc. live in local-sre/ instead of the root-owned ~/.holmes.
export HOLMES_CONFIGPATH_DIR="$REPO_ROOT/local-sre"
# Loopback only: these tools expose details of this machine, don't serve them to the LAN.
export HOLMES_HOST="${HOLMES_HOST:-127.0.0.1}"
export HOLMES_PORT="${HOLMES_PORT:-5050}"
# Per-tool virtual-memory cap. The 800MB default crashes the Go docker CLI at startup
# (pthread_create failed), so local/docker tools need more address space.
export TOOL_MEMORY_LIMIT_MB="${TOOL_MEMORY_LIMIT_MB:-2048}"
# Request headers are forwarded to tools, and a YAML tool call is refused outright if
# ANY forwarded header contains a shell metacharacter - curl's default "Accept: */*"
# included - so every script tool fails. Don't forward standard client headers.
export HOLMES_PASSTHROUGH_BLOCKED_HEADERS="${HOLMES_PASSTHROUGH_BLOCKED_HEADERS:-authorization,cookie,set-cookie,accept,accept-encoding,accept-language,user-agent,content-type,content-length,connection,host,origin,referer}"

echo "Starting Holmes on http://$HOLMES_HOST:$HOLMES_PORT with model $MODEL"
exec .venv/bin/python -u server.py
