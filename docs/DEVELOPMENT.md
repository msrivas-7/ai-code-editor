# Development

## Local Setup

```bash
# Install dependencies for type-checks / hot-reload
(cd frontend && npm install)
(cd backend  && npm install)

# Type-check
(cd frontend && npx tsc --noEmit)
(cd backend  && npx tsc --noEmit)

# Tests
(cd frontend && npm test)
(cd backend  && npm test)

# Frontend only (backend in Docker)
docker compose up -d backend
cd frontend && npm run dev
```

## Configuration

All optional — defaults work for local use. See [.env.example](../.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `SESSION_IDLE_TIMEOUT_MS` | `120000` | Reap idle sessions after this |
| `SESSION_SWEEP_INTERVAL_MS` | `45000` | Sweeper interval |
| `RUN_TIMEOUT_MS` | `10000` | Wall-clock per `docker exec` |
| `RUNNER_MEMORY_BYTES` | `536870912` | Per-container memory (512 MB) |
| `RUNNER_NANO_CPUS` | `1000000000` | Per-container CPU (1 CPU) |
| `CORS_ORIGIN` | `http://localhost:5173` | Frontend origin |

## Direct Docker Compose

```bash
docker compose up --build    # start (Ctrl-C to stop)
docker compose down           # teardown
```
