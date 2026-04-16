# AI Code Editor

A local-first, web-based coding editor with an AI tutor. Write small single- or multi-file projects in the browser, run them in a sandboxed Docker runtime, and get structured, hint-style help from OpenAI using your own API key.

![Stack](https://img.shields.io/badge/stack-React%20%7C%20Vite%20%7C%20Monaco%20%7C%20Express%20%7C%20Docker-0f172a)
![Languages](https://img.shields.io/badge/languages-Python%20%7C%20JS%20%7C%20C%20%7C%20C%2B%2B%20%7C%20Java-38bdf8)
![License](https://img.shields.io/badge/license-MIT-34d399)

## Features

- **Multi-file editor** powered by Monaco with a custom dark theme, bracket-pair colorization, and JetBrains Mono ligatures.
- **One-click Run** (`⌘↵` / `Ctrl+↵`) in a per-session Docker container: network disabled, CPU/memory/PID limits, non-root user, 10s wall-clock cap.
- **Five languages** — Python, JavaScript, C, C++, Java. Each ships with a runnable starter project (stats, word frequency, array ops, palindromes, matrix ops).
- **AI tutor** via the OpenAI Responses API with a strict JSON schema. Turn-aware prompting: a first question gets diagnostic nudges; follow-ups unlock hints; only explicit "stuck" phrasing unlocks a stronger pointer — never the full fix.
- **Bring-your-own key.** Held in-memory on the frontend by default, or in `localStorage` behind an explicit opt-in. Sent server-side via `X-OpenAI-Key` per request; never logged, never written to disk.
- **Resilient sessions.** Silent heartbeat retries, a `Reconnecting…` status, and rebind-to-same-ID recovery when the backend session expires.
- **Keyboard-first UI.** Status bar, color-coded file icons, output panel with copy-to-clipboard, error-type chips, and inline keyboard hints.

## Quick start

```bash
git clone <your-repo-url> ai-code-editor
cd ai-code-editor
./start.sh
```

`start.sh` builds the images, brings up the stack, waits for it to be healthy, and opens the app. On macOS it also opens three Terminal windows that tail backend, frontend, and per-session runner logs; `stop.sh` tears everything down and closes those windows.

If you prefer plain Docker Compose:

```bash
docker compose up --build
# then open http://localhost:5173
```

### Requirements

- Docker Desktop, Colima, or Docker Engine.
- On macOS, Docker Desktop shares `/Users` by default — no extra file-sharing setup needed.
- First build pulls three images and takes ~2–3 minutes. Subsequent runs are cached.
- An OpenAI API key only if you want the tutor; the editor and Run work without one.

## Using it

Open <http://localhost:5173>. The editor seeds with a starter project for the selected language. Edit any file, hit **Run** (or `⌘↵`), and stdout/stderr stream back into the output panel with an exit code, duration, and error classification (`compile`, `runtime`, `timeout`, `system`).

To enable the tutor, click the gear in the right sidebar, paste an OpenAI key, validate, and pick a model. Then ask a question in the tutor panel — Enter sends, Shift+Enter inserts a newline. The first response leans on diagnostic questions; follow-ups add hints; phrases like *"I'm stuck"* or *"just tell me"* unlock a stronger pointer.

Switching the language dropdown replaces the current project with that language's starter (with a confirmation prompt so you don't accidentally nuke work).

## Architecture

```
┌───────────┐   HTTP/JSON   ┌───────────┐   docker.sock   ┌──────────────┐
│  Frontend │ ────────────> │  Backend  │ ──────────────> │ Runner cntr  │
│ (React +  │               │ (Express+ │   (sibling)     │  (one per    │
│  Monaco)  │ <──────────── │  dockerode│ <────────────── │   session)   │
└───────────┘               └───────────┘                 └──────────────┘
     :5173                       :4000                     --network none
```

- **One container per active editor session.** Started lazily on the first Run, reaped 2 minutes after the last heartbeat or immediately on tab close (`pagehide` → `navigator.sendBeacon`).
- **Bind-mounted workspace.** Files live at `./temp/sessions/{sessionId}` on the host and are mounted into the runner at `/workspace`. Each Run wipes and re-writes this directory from the frontend snapshot, so backend restarts don't lose user code.
- **Sandboxing.** Network disabled, CPU/memory/PID caps, non-root user inside the container, `no-new-privileges`, 10s wall-clock on every exec.

### API surface

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/session` | Create a session + runner container |
| `POST` | `/api/session/ping` | Heartbeat |
| `POST` | `/api/session/rebind` | Reuse the same ID after expiry |
| `POST` | `/api/session/end` | Destroy session + container |
| `POST` | `/api/project/snapshot` | Write the full project into the workspace |
| `POST` | `/api/execute` | Compile (if needed) and run |
| `POST` | `/api/ai/validate-key` | Check an OpenAI key |
| `GET`  | `/api/ai/models` | List chat-capable models for the key |
| `POST` | `/api/ai/ask` | Tutor turn (structured JSON response) |

### Docker socket note

The backend mounts `/var/run/docker.sock` so it can spawn sibling runner containers. This gives the backend root-equivalent access to the local Docker daemon — fine for local use, **not** suitable for a publicly hosted deployment without further sandboxing (rootless Docker, a dedicated runner service, or a job queue).

## Project layout

```
ai-code-editor/
├── backend/            Express + TypeScript (sessions, Docker, execution, AI)
├── frontend/           React + Vite + Tailwind + Zustand + Monaco
├── runner-image/       Polyglot Dockerfile (Python, Node, gcc/g++, JDK)
├── shared/             TS types shared across backend + frontend
├── samples/            Starter projects per language
├── scripts/            Helper scripts (watch-sessions.sh, …)
├── temp/sessions/      Runtime per-session workspaces (gitignored)
├── docker-compose.yml
├── start.sh / stop.sh  One-command launcher + teardown
└── .env.example
```

## Configuration

All variables are optional — defaults work for local use. See [.env.example](.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `SESSION_IDLE_TIMEOUT_MS` | `120000` | Reap sessions idle longer than this |
| `SESSION_SWEEP_INTERVAL_MS` | `45000` | Sweeper interval |
| `RUN_TIMEOUT_MS` | `10000` | Hard wall-clock per `docker exec` |
| `RUNNER_MEMORY_BYTES` | `536870912` | Per-container memory cap (512 MB) |
| `RUNNER_NANO_CPUS` | `1000000000` | Per-container CPU cap (1 CPU) |
| `CORS_ORIGIN` | `http://localhost:5173` | Frontend origin |

## Development

Running the full stack via `./start.sh` or `docker compose up` needs no host-side installs — the Dockerfiles handle `npm ci` and system packages inside the images. Only install locally if you want to iterate outside Docker (type-checks, hot-reload frontend against a containerized backend, etc.):

```bash
# One-time host-side install for local iteration
(cd frontend && npm install)
(cd backend  && npm install)

# Type-check without running the stack
(cd frontend && npx tsc --noEmit)
(cd backend  && npx tsc --noEmit)

# Iterate on the frontend only (backend in Docker)
docker compose up -d backend
cd frontend && npm run dev

# Rebuild just the backend after backend changes
docker compose build backend && docker compose up -d --no-deps backend
```

## License

MIT — see [LICENSE](LICENSE).
