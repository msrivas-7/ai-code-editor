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

## Design Tokens

All colors in the frontend use semantic Tailwind tokens, never raw palette names:

| Semantic | Use for |
| --- | --- |
| `bg` / `panel` / `elevated` | Surface layers (page, panel, raised card) |
| `ink` / `muted` / `faint` | Primary / secondary / tertiary text |
| `border` / `borderSoft` | Dividers and outlines |
| `accent` / `accentMuted` | Primary interactive elements (focus rings, CTAs) |
| `success` | Completion, validation pass, "OK" states |
| `warn` | Compile errors, "worth your attention" nudges |
| `danger` | Runtime errors, destructive actions |
| `violet` | Guided learning, practice mode, tutor walkthroughs |

These resolve to CSS variables in [`src/index.css`](../frontend/src/index.css) and switch automatically between dark and light themes. **Do not** use `text-green-400`, `bg-red-500/15`, or any raw `{color}-{shade}` class — always use the semantic token so light-theme and re-theming stay correct.

Contrast floor: all text on `panel` / `bg` meets WCAG AA (4.5:1). If you introduce a new foreground/background combination, check it with a contrast tool before shipping.
