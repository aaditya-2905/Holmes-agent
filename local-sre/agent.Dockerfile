# Holmes agent for the local SRE setup. Build context is the repo root:
#   docker build -f local-sre/agent.Dockerfile .
# Debian (not the upstream Alpine image) because the local toolsets need GNU
# procps, systemctl/journalctl, mtr, dig and iproute2 with the same flags as the host.

FROM python:3.12-slim-bookworm AS builder

ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN pip install "poetry==1.8.5" \
    && python -m venv /venv --upgrade-deps

ENV VIRTUAL_ENV=/venv PATH="/venv/bin:$PATH"
WORKDIR /src
COPY pyproject.toml poetry.lock ./
# Installs into the active /venv because poetry reuses $VIRTUAL_ENV.
RUN poetry install --no-interaction --no-ansi --no-root --only main \
    && find /venv -name '__pycache__' -prune -exec rm -rf {} +

ARG TARGETARCH=amd64
# CVE-patched kubectl shipped in the repo, same as the upstream image.
COPY bin/go-cve-rebuild/${TARGETARCH}/kubectl.gz bin/go-cve-rebuild/${TARGETARCH}/kubectl.gz.sha256 /tmp/
RUN cd /tmp && sha256sum -c kubectl.gz.sha256 && gunzip kubectl.gz && chmod +x kubectl


FROM docker:27.5.1-cli AS dockercli


FROM python:3.12-slim-bookworm

# iputils-ping / mtr-tiny keep their cap_net_raw file capability, so ping and
# mtr work as a non-root user (the compose file keeps NET_RAW in the bounding set).
RUN apt-get update && apt-get install -y --no-install-recommends \
        bash ca-certificates curl jq openssl lsof \
        iputils-ping iputils-tracepath mtr-tiny dnsutils iproute2 \
        procps sysstat systemd libcap2-bin \
    && setcap cap_net_raw+ep /usr/bin/ping \
    && setcap cap_net_raw+ep /usr/bin/mtr-packet \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /venv /venv
COPY --from=builder /tmp/kubectl /usr/local/bin/kubectl
COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker

ENV PATH="/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOME=/tmp \
    HOLMES_CONFIGPATH_DIR=/data \
    HOLMES_HOST=127.0.0.1 \
    HOLMES_PORT=5050 \
    TOOL_MEMORY_LIMIT_MB=2048

WORKDIR /app
COPY holmes ./holmes
COPY server.py ./
COPY local-sre/toolsets ./local-sre/toolsets

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${HOLMES_PORT}/healthz" >/dev/null || exit 1

CMD ["python", "-u", "server.py"]
