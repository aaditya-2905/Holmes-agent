# Holmes Agent: local SRE assistant

A web UI plus an AI troubleshooting agent that investigates the machine it runs on:
processes, CPU/memory/IO pressure, disks, systemd services, the system journal, the
network path (interfaces, DNS, gateway, traceroute, TLS, HTTP) and Docker containers.
The agent only has read-only tools. Anything outside its allow list needs your approval in the UI.

It's built on [HolmesGPT](https://github.com/HolmesGPT/holmesgpt) (Apache-2.0, see `LICENSE`):
`holmes/`, `server.py`, `pyproject.toml` and `poetry.lock` come from that project. The
local-machine toolsets, container setup and UI are in `local-sre/`.

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

Then open **http://127.0.0.1:8088** (or the `UI_PORT` you set in `.env`).

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
Free OpenRouter models are capped at 50 requests a day, and each investigation uses 3–6.

## More

`local-sre/README.md` covers the layout, how the agent sees the host, the security model
(it runs as `nobody` with a read-only filesystem, but has the Docker socket, which is
root-equivalent), performance details and known limits.
