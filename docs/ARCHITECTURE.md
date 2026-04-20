# Architecture

```
                           +-------------------------------------------------------+
                           |                  Docker Desktop (host)                |
                           |                                                       |
+------------------+  HTTP/JSON  +------------------+  tcp:2375   +---------------+
|     Frontend     | ----------> |     Backend      | ----------> |  socket-proxy |
|                  |             |                  |  allowlist  |  (tecnativa)  |
|  React + Vite    |             |  Express + TS    |             |               |
|  React Router    | <---------- |  ExecutionBackend| <---------- |  docker.sock  |
|  Monaco + Zustand|   SSE/JSON  |  (localDocker)   |             |   (read-only) |
|  Tailwind CSS    |             |  prompt builders |             +-------+-------+
+------------------+             |  OpenAI proxy    |                     | CONTAINERS + EXEC + IMAGES
      :5173                      +------------------+                     v
                                        :4000                    +------------------+
                                                                 |  Runner (1:1)    |
                                                                 |  Python, Node,   |
                                                                 |  gcc, JDK, Go,   |
                                                                 |  Rust, Ruby      |
                                                                 |  --network none  |
                                                                 +------------------+
                                                            bind: ./temp/sessions/{id}
```

## ExecutionBackend abstraction

The backend never touches dockerode directly at the call-site layer. `backend/src/services/execution/backends/types.ts` defines an `ExecutionBackend` interface (`createSession`, `exec`, `writeFiles`, `fileExists`, `replaceSnapshot`, `destroy`, …) that returns opaque `SessionHandle` values. Routes and the harness dispatcher accept an injected backend; `backend/src/index.ts` picks the impl at boot via the `EXECUTION_BACKEND` env (factory in `backends/index.ts`).

Today only `LocalDockerBackend` ships. The interface is deliberately shaped so each cloud provider is a single additional file plus one switch case:

| Impl (future) | Provider primitive | IAM scope |
| --- | --- | --- |
| `EcsFargateBackend` | `RunTask` / `StopTask` / `ExecuteCommand` | task-definition ARNs only |
| `AksBackend` | `Job.create` / `Pod.exec` (K8s API) | namespace-scoped ServiceAccount |
| `AciBackend` | `ContainerInstances.create` / `exec` | resource-group-scoped Azure role |

A second impl does not change routes, the harness, or session-manager code.

## Local-dev cloud-IAM mirror (socket-proxy)

To stop the backend from holding the raw Docker socket (which equals root on the host), `docker-compose.yml` runs `tecnativa/docker-socket-proxy` as a sidecar. The backend has `DOCKER_HOST=tcp://socket-proxy:2375`; dockerode honors that transparently. The proxy enforces an endpoint allowlist matching what `LocalDockerBackend` actually calls:

- `CONTAINERS=1` — create/start/stop/inspect/remove + self-inspect for host-path discovery
- `EXEC=1` — exec create/start/inspect for running learner code
- `IMAGES=1` — runner-image inspect in `ensureReady()`
- `POST=1` — required for any non-GET request

Everything else (`VOLUMES`, `NETWORKS`, `INFO`, `BUILD`, `SERVICES`, `SECRETS`, `CONFIGS`, …) returns `403` at the proxy. This is the same "tightly-scoped API credential" pattern the cloud impls above will use — local dev now mirrors that posture exactly.

## Frontend

- **React Router** — `/`, `/editor`, `/learn`, `/learn/course/:id`, `/learn/course/:id/lesson/:id`. Lazy-loaded with Suspense.
- **Zustand stores** — `projectStore`, `aiStore`, `sessionStore`, `runStore`, `progressStore`, `learnerStore`. Editor + lesson contexts swap the first four in lockstep.
- **Shared tutor rendering** — `TutorResponseViews.tsx` is the single rendering surface for the tutor, reused by both the editor (`AssistantPanel`) and lessons (`GuidedTutorPanel`).
- **Course content** — static JSON + Markdown in `frontend/public/courses/`. Loaded at runtime via fetch — no build step for authoring.
- **Theme system** — `ThemePref` in localStorage drives `data-theme` + `color-scheme` on `<html>`. Semantic Tailwind tokens resolve to CSS variables, so the app (Monaco included) swaps in lockstep.

## Backend

- **Sibling-container pattern** — the backend spawns isolated runner containers via `LocalDockerBackend`. Cross-platform host-path discovery via Docker API self-inspection. Dockerode calls are routed through `socket-proxy` — see [ExecutionBackend abstraction](#executionbackend-abstraction) above.
- **Modular prompt pipeline** — composable modules under `prompts/` assembled by two builders: `editorPromptBuilder` (free-form) and `guidedPromptBuilder` (adds lesson context + "never solve" constraints). The guided builder is selected automatically when a request carries `lessonContext`.
- **Structured JSON responses** — OpenAI Responses API with strict `json_schema`. An intent classifier (`debug`/`concept`/`howto`/`walkthrough`/`checkin`) decides which sections get filled.
- **Provider abstraction** — prompt building and API calls sit behind a `Provider` interface so the LLM vendor is swappable without touching callers.

## Guided Learning System

- **File-based courses** — `frontend/public/courses/{courseId}/lessons/{lessonId}/` with `lesson.json`, `content.md`, and `starter/`.
- **Completion rules** — three kinds: `expected_stdout`, `required_file_contains`, `function_tests`. The first two validate client-side against the latest `RunResult`; `function_tests` round-trips through the backend.
- **Progress persistence** — versioned, owned-prefix localStorage keys (`learner:v1:`, `onboarding:v1:`) gated by an allow-list. `LearningRepository` wraps it so a future backend-persisted impl can swap in without touching callers.
- **Coach rail** — priority-ordered deterministic rule engine that surfaces one contextual nudge at a time. No AI, no API calls.
- **Practice mode** — exercises attach to a lesson but are tracked independently of lesson completion; entering practice swaps the starter, exiting restores the lesson snapshot.
- **Function-test harness** — lessons can declare visible + hidden test cases. `POST /api/execute/tests` generates a per-run harness that loads learner code and evaluates each test in an isolated scope using the language's literal parser for `expected`. Hidden test names/inputs never leave the backend; an author-tagged `category` string is revealed only after two consecutive fails on the same hidden test.
- **Per-language harness layer** — `HarnessBackend { language, generate, parseOutput }` + a `language → HarnessBackend` registry is the extension seam. New languages plug in without changing route or validator code. `content-lint` consults the same registry so authoring a `function_tests` block for an unsupported language fails at author-time, and each language carries an authoring-order floor below which `function_tests` is rejected.
- **Dev surfaces (DEV-only, tree-shaken)** — `frontend/src/__dev__/` gated on `import.meta.env.DEV`. Profile seeds apply pre-hydration so Zustand wakes up into the chosen state. An allow-list keeps OpenAI keys, theme, and UI prefs untouched across swaps. A content-health dashboard at `/dev/content` renders per-lesson authoring signals.

## Content Validation Pipeline

The `frontend/public/courses/` tree is plain JSON + Markdown + per-language starter code, but three layers keep it honest:

- **Zod schema** — one set of schemas shared between the TypeScript types and the runtime validator so compile-time and runtime agree on a single source of truth.
- **Concept graph** — each lesson declares `teachesConceptTags` and `usesConceptTags`. A graph-walker flags used-before-taught, overlap, and duplicate-teach issues. The accumulated vocabulary feeds the guided prompt so the tutor knows which concepts are in scope.
- **Content lint** — Zod validation plus structural invariants (id parity, order contiguity, prereq ordering, per-language `function_tests` literal-parse + authoring-order floor). CI-gated.
- **Golden solutions + verify-solutions** — every lesson and practice exercise has a committed correct solution; the verifier runs each through the same engine production uses. Verification runs `python3`/`node` directly rather than the runner sandbox — the trust boundary sits around learner code, not our own. CI-gated.
- **Authoring CLIs** — `new-lesson` and `new-practice` scaffold from templates, update `course.lessonOrder`, and auto-run the lint. See [CONTENT_AUTHORING.md](./CONTENT_AUTHORING.md).

## Testing

Three layers, each catching a different class of bug:

- **Unit tests (`frontend`/`backend`, Vitest)** — pure functions, store reducers, prompt builders, validators, per-language harness generators (Python + JavaScript). Run on every commit. No network, no Docker.
- **Content validation (`npm run lint:content` + `verify:solutions`)** — see the pipeline section above. Keeps course JSON honest and every golden solution passing against the same engine production uses.
- **End-to-end (`e2e/`, Playwright)** — drives the real product: Vite dev server + Dockerized backend + runner container + real localStorage. Catches UI-integration regressions unit tests miss (Monaco focus, modal portals, SSE streaming, Zustand hydration, router navigation). Chromium-only, ~100 specs covering editor / guided-learning / function-tests / dev-profiles / progress-I/O / tutor / onboarding / coach-rail / settings / practice / js / security. OpenAI is mocked by default; `E2E_REAL_OPENAI=1` enables an opt-in real-key suite for release-gate smoke. Starting states come from the same seed JSONs the dev-profile switcher uses. CI job: `.github/workflows/e2e.yml`.

## API Surface

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/session` | Create session + runner container |
| `POST` | `/api/session/ping` | Heartbeat |
| `POST` | `/api/session/rebind` | Reuse same ID after expiry |
| `POST` | `/api/session/end` | Destroy session + container |
| `POST` | `/api/project/snapshot` | Write project into workspace |
| `POST` | `/api/execute` | Compile (if needed) and run |
| `POST` | `/api/execute/tests` | Run a lesson's `function_tests` harness and return a `TestReport` |
| `POST` | `/api/ai/validate-key` | Check an OpenAI key |
| `GET`  | `/api/ai/models` | List chat-capable models |
| `POST` | `/api/ai/ask/stream` | Tutor turn (SSE stream, supports `lessonContext`) |
| `POST` | `/api/ai/ask` | Tutor turn (non-streaming) |
| `POST` | `/api/ai/summarize` | Compress older history |

## Project Layout

```
codetutor-ai/
├── backend/                 Express + TypeScript
│   └── src/services/ai/
│       ├── prompts/         Modular prompt components (8 modules)
│       ├── editorPromptBuilder.ts
│       └── guidedPromptBuilder.ts
├── frontend/                React + Vite + Tailwind
│   ├── public/courses/      Course content (JSON + Markdown + starter + golden solutions)
│   ├── scripts/             content-lint, verify-solutions, new-lesson, new-practice
│   └── src/
│       ├── components/      Shared UI (Monaco, tutor views, settings, splitters)
│       ├── features/learning/
│       │   ├── pages/       Dashboard, CourseOverview, LessonPage
│       │   ├── components/  GuidedTutorPanel, LessonInstructions, CoachRail, WorkspaceCoach, etc.
│       │   ├── content/     Zod schema, conceptGraph, courseLoader
│       │   ├── stores/      progressStore, learnerStore (localStorage-backed)
│       │   ├── repositories/ LearningRepository interface + implementations
│       │   └── utils/       Lesson validator
│       ├── __dev__/         Dev-only profile switcher + content health (tree-shaken in prod)
│       ├── pages/           StartPage, EditorPage
│       └── state/           Zustand stores (project, ai, session, run)
├── runner-image/            Polyglot Dockerfile (9 language toolchains)
├── samples/                 Starter projects per language
├── docker-compose.yml
├── start.sh / stop.sh       macOS/Linux launcher
└── start.ps1 / stop.ps1     Windows launcher
```

## Shipping posture

Local dev is **not** local-deployment. Long-term the product runs frontend on the learner's device (PWA/Electron) and backend + sandbox in cloud (ECS Fargate / ACI / AKS). The backend never holds the raw Docker socket; it talks to `socket-proxy` over TCP (dockerode via `DOCKER_HOST`), and the proxy enforces an API allowlist. `ExecutionBackend` is the seam the cloud impls drop into without touching routes or session code.

## Security posture

Defense-in-depth layers on top of the `ExecutionBackend` + socket-proxy seam. Each row names the cloud primitive it maps to so the port lands as configuration, not refactor work.

| Area | Local impl | Cloud equivalent |
| --- | --- | --- |
| Kernel capabilities | `CapDrop: ["ALL"]` on every runner container | K8s `SecurityContext.capabilities.drop: ["ALL"]` / ECS `linuxParameters.capabilities.drop` / ACI `securityContext.capabilities.drop` |
| Filesystem isolation | `ReadonlyRootfs` + tmpfs `/tmp`; compiler cache dirs redirected into it via env | `readOnlyRootFilesystem` + emptyDir `medium: Memory` volume |
| Privilege escalation | `SecurityOpt: ["no-new-privileges"]` | `allowPrivilegeEscalation: false` |
| Resource exhaustion | Per-container `PidsLimit`, `NanoCpus`, `Memory`, `Ulimits.nofile`. Fork-bomb protection is cgroup-scoped via `PidsLimit`. | K8s resource requests/limits + Pod `hostPID: false` |
| Network egress | `NetworkMode: "none"` on every runner | NetworkPolicy `egress: []` / VPC-isolated subnet |
| Host API surface | `socket-proxy` allowlist: CONTAINERS/EXEC/IMAGES/POST. Everything else 403s. | IAM role scoped to RunTask/StopTask/ExecuteCommand (Fargate) or Job.create/Pod.exec (K8s) |
| Filename→flag injection | `./`-prefixed compiler globs; `safeResolve` rejects dash-prefixed path segments | Same impl |
| HTTP headers | `helmet()` with a strict CSP | Same middleware |
| Error leakage | 500 fallback returns `{error: "Internal error"}`; full stack logged server-side only | Same |
| Prompt injection | Untrusted content wrapped in `<user_file>` / `<user_selection>` tags; tutor prompt classifies them as data | Same |
| AI abuse | `express-rate-limit` on `/api/ai/*`, per-session-id bucket with IP fallback. Swapping the resolver to authenticated user-id is a one-line change. | Same middleware; resolver reads user id from auth context |
| LAN exposure | Ports bound to `127.0.0.1` only | No-op in cloud (private VPC) |
