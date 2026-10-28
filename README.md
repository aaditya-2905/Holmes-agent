# Holmes Agent: local SRE assistant

A web UI plus an AI troubleshooting agent that investigates **the machine it runs on**:
processes, CPU/memory/IO pressure, disks, systemd services, the system journal, the network
path (interfaces, DNS, gateway, traceroute, TLS, HTTP) and Docker containers. Ask it "why is
my machine slow?" or "why can't I reach this host?" and it runs read-only checks, then explains
what it found. Any command outside its allow list needs your approval in the UI.

> **Built on [HolmesGPT](https://github.com/HolmesGPT/holmesgpt).** The agent engine, the
> agentic loop, the LLM integration, the Kubernetes and bash toolsets, and the API server all
> come from HolmesGPT, a [CNCF](https://www.cncf.io/) sandbox project originally created by
> [Robusta.Dev](https://robusta.dev) with major contributions from
> [Microsoft](https://microsoft.com/). This repository packages it as a local, single-machine
> SRE assistant. See [Credits and license](#credits-and-license).

## What this fork changes

This repository is HolmesGPT at upstream commit
[`49804bde`](https://github.com/HolmesGPT/holmesgpt/commit/49804bde) (2026-10-26) plus the
changes below. Every other file, including the rest of `holmes/`, `server.py`, `helm/`,
`docs/` and `tests/`, is the upstream code, unmodified.

| Change | Path | What it does |
|---|---|---|
| Added | `local-sre/toolsets/local_machine.yaml` | Four new toolsets for the host: `local/system`, `local/services`, `local/network`, `local/docker` (21 tools) |
| Added | `local-sre/config.yaml` | Enables the local toolsets plus Kubernetes, connectivity and bash, with a read-only bash allow/deny list |
| Added | `local-sre/ui/` | Chat web UI (Preact + Vite) with streamed tool calls, an approval flow, a toolsets panel and local history, served by unprivileged nginx |
| Added | `local-sre/agent.Dockerfile` | Agent image with kubectl, the docker CLI and host-diagnostics tools (`dig`, `mtr`, `iproute2`, `systemctl`, `journalctl`, `sysstat`) |
| Added | `local-sre/setup.sh`, `local-sre/run.sh` | One-time setup (group IDs, kubeconfig) and a way to run the agent without Docker |
| Added | `.env.example` | API key, model, reasoning effort, ports, host group IDs |
| Changed | `holmes/plugins/toolsets/bash/command_arg_rules.py` | Argument checks for `journalctl` (no `--vacuum-*`, `--rotate`, `--flush`), `ip` (read verbs only, no `-batch`) and `dig` (no `-f`/`-k`), so the bash allow-list can't be used to change the host or read local files |
| Added | `tests/plugins/toolsets/bash/test_local_sre_bash_rules.py` | Tests for those checks and for which commands `local-sre/config.yaml` auto-approves |
| Changed | `docker-compose.yaml` | Replaced upstream's single prebuilt-image service with a hardened `agent` + `ui` stack that can see the host |
| Replaced | `README.md` | This file. Upstream's README is [on GitHub](https://github.com/HolmesGPT/holmesgpt#readme) |

### The local toolsets

| Toolset | Tools |
|---|---|
| `local/system` | system overview, top processes, process details, CPU/memory/IO pressure, disk usage |
| `local/services` | failed services, service status, service logs, journal errors |
| `local/network` | network overview, ping, traceroute, DNS lookup, listening ports, connections, HTTP check, TLS check, interface stats |
| `local/docker` | containers, container details, container logs |

## Requirements

- **Linux with systemd** (for example Ubuntu 22.04+). The agent reads the host's journal,
  D-Bus, processes and network directly, so it does not work under Docker Desktop on macOS
  or Windows.
- Docker Engine with Compose v2 (`docker compose version`), and your user in the `docker` group.
- An LLM API key: Gemini, OpenRouter, Anthropic or OpenAI.

## Setup

```bash
git clone https://github.com/aaditya-2905/Holmes-agent.git
cd Holmes-agent
./local-sre/setup.sh          # creates .env, fills this machine's group IDs, copies ~/.kube/config if present
nano .env                     # set GEMINI_API_KEY (or another key) and MODEL
docker compose up -d --build  # first build takes a few minutes
```

Then open **http://127.0.0.1:8088** (or the `UI_PORT` you set in `.env`). The agent API
listens on `127.0.0.1:5050`. Both bind to localhost only.

If the port is already taken (`bind() ... Address in use` in `docker compose logs ui`),
change `UI_PORT` in `.env` and run `docker compose up -d`.

## Everyday use

```bash
docker compose up -d          # start (also after editing .env)
docker compose down           # stop
docker compose logs -f agent  # watch what the agent is doing
docker compose up -d --build  # after changing code in holmes/ or local-sre/ui/
docker compose restart agent  # after changing local-sre/config.yaml or local-sre/toolsets/
```

## Model and speed

Set these in `.env`:

```
GEMINI_API_KEY=...
MODEL=gemini/gemini-3.5-flash
REASONING_EFFORT=low          # low = fastest; medium/high think more per step
```

With these settings a full "why is my machine slow" investigation takes about 35 seconds.
Any LiteLLM model id works, for example `openrouter/<provider>/<model>` with
`OPENROUTER_API_KEY`, or `anthropic/claude-sonnet-4-5-20250929` with `ANTHROPIC_API_KEY`.
You don't need to rebuild after changing the model. Free OpenRouter models are capped at
50 requests a day, and each investigation uses 3–6.

## Security model

The agent container runs as `nobody` with a read-only root filesystem and every capability
dropped except `NET_RAW` (for ping and mtr). It sees the host through host networking, the
host PID namespace, a read-only mount of `/`, the journal, and the D-Bus socket, where the
host's polkit refuses service start/stop/restart.

**The Docker socket is root-equivalent.** The built-in tools only read through it, but any
bash command you approve in the UI runs with that access, so read approvals carefully.

[`local-sre/README.md`](local-sre/README.md) covers the layout, exactly how the agent sees the
host, UI performance details and known limits.

## Credits and license

Almost all of the code in this repository is
[HolmesGPT](https://github.com/HolmesGPT/holmesgpt), written by the HolmesGPT maintainers and
contributors (see [`MAINTAINERS.md`](MAINTAINERS.md)). HolmesGPT is a Cloud Native Computing
Foundation sandbox project, originally created by Robusta.Dev, with major contributions from
Microsoft. Thank you to everyone who built it.

- HolmesGPT docs: https://holmesgpt.dev/ (also in this repo under `docs/`)
- HolmesGPT source: https://github.com/HolmesGPT/holmesgpt

HolmesGPT is licensed under the Apache License 2.0, and so is this fork. See
[`LICENSE`](LICENSE) and [`NOTICE`](NOTICE). The changes listed in
[What this fork changes](#what-this-fork-changes) are ours; any bugs in them are ours too,
so please report them here rather than upstream.
