# Holmes Local SRE

A web UI plus the Holmes agent, both in Docker, that investigates **this machine**:
processes, CPU/memory/IO pressure, disks, systemd services, the system journal, the network
path (interfaces, DNS, gateway, traceroute, TLS, HTTP) and Docker containers. It uses
read-only tools, and anything outside the allow list needs your approval in the UI.

## Quick start

Everything is in the repo-root `docker-compose.yaml`, configured by the repo-root `.env`.
From the repo root:

```bash
cp .env.example .env            # first time only: set OPENROUTER_API_KEY (or another key) and MODEL
docker compose up -d --build    # later: just `docker compose up -d`
```

Open **http://127.0.0.1:8088** (agent API on 5050). Both bind to `127.0.0.1` only. Port 8080
is taken by Jenkins on this machine, which is why the UI defaults to 8088.

`local-sre/setup.sh` is optional. On another machine it fills `DOCKER_GID` and `JOURNAL_GID`
in `.env`, and it copies `~/.kube/config` to `local-sre/.kube/config` so the Kubernetes tools
can read it. Re-run it after your kubeconfig changes.

### Changing the model

Edit `MODEL` (and the matching API key) in `.env`, then `docker compose up -d`. You don't need
to rebuild. Any LiteLLM model id works, for example `openrouter/anthropic/claude-sonnet-4.5`,
`anthropic/claude-sonnet-4-5-20250929` with `ANTHROPIC_API_KEY`, or `gpt-4.1` with `OPENAI_API_KEY`.
OpenRouter's `thinkingmachines/inkling*:free` models refuse requests from anything that isn't one
of their listed apps (HTTP 403), so use the paid `thinkingmachines/inkling` if you want Inkling.

## Layout

| Path | What it is |
|---|---|
| `../docker-compose.yaml` | `agent` and `ui` services, the only compose file |
| `../.env.example` → `../.env` | API key, model, ports, host group IDs (`.env` is gitignored) |
| `setup.sh` | Optional. Fills group IDs in `.env` and copies `~/.kube/config` to `.kube/config` |
| `agent.Dockerfile` | Debian image with Holmes, kubectl, docker CLI, iproute2, dig, mtr, systemctl/journalctl |
| `config.yaml` | Enabled toolsets and the bash allow/deny list |
| `toolsets/local_machine.yaml` | `local/system`, `local/services`, `local/network`, `local/docker` tools |
| `ui/` | Preact + Vite app, served by unprivileged nginx, which also proxies `/api` to the agent |
| `run.sh` | Runs the agent natively instead (no Docker), using `config.yaml` |

Edits to `config.yaml` or `toolsets/` take effect on `docker compose restart agent` from the repo root (they are mounted).
UI or agent code changes need `docker compose up -d --build`.

## How the agent sees the host

| Need | How |
|---|---|
| Real interfaces, routes, sockets | `network_mode: host` |
| Host processes | `pid: host` |
| Disk usage, OS identity | host `/` mounted read-only at `/host` |
| Service status | host D-Bus socket. Writes are refused by the host's polkit |
| Full system journal | `/var/log/journal` read-only and the `systemd-journal` group |
| Containers | `/var/run/docker.sock` and the `docker` group |
| ping / mtr | `NET_RAW` capability only |

The agent runs as `nobody` (the host D-Bus only accepts users that exist on the host; very
large domain UIDs are also rejected by Docker), with all other capabilities dropped and a
read-only root filesystem. It runs with `apparmor=unconfined` because Docker's default profile
blocks D-Bus. **The docker socket is root-equivalent**: the tools only read through it,
but any bash command you approve in the UI runs with that access, so read approvals carefully.

## Performance

- About 22 KB gzipped on the critical path (16.8 KB JS + 4.7 KB CSS). The Markdown renderer and
  sanitizer (24 KB) load when the browser is idle.
- Assets are pre-gzipped at build time and cached as immutable. `index.html` is revalidated.
- Responses stream over SSE with nginx buffering off, so each tool call appears as it happens.
- Tool output is only added to the page when you expand it. Past turns use
  `content-visibility: auto`. History lives in IndexedDB (async, no 5 MB localStorage limit).

## Known limits

- User-session systemd units (`systemctl --user`) aren't visible from the container. Run
  `./run.sh` natively if you need them.
- Socket owner process names (`ss -p`) only show for processes the agent's user owns.
- Kubernetes tools use the copied `.kube/config`. Re-run `./setup.sh` after it changes.
- Holmes forwards request headers to tools and refuses script tools if any header contains a
  shell metacharacter. nginx forwards only `Content-Type`, and the agent blocks the common headers
  for direct API calls.
