import path from "node:path";

const num = (v: string | undefined, d: number) => (v ? Number(v) : d);

export const config = {
  port: num(process.env.PORT, 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",

  runnerImage: process.env.RUNNER_IMAGE ?? "ai-code-editor-runner:latest",

  // Absolute path on the host where per-session workspaces live.
  // Must be a host path because it is bind-mounted into sibling runner containers.
  workspaceRoot: process.env.WORKSPACE_ROOT_HOST
    ?? path.resolve(process.cwd(), "..", "temp", "sessions"),

  session: {
    idleTimeoutMs: num(process.env.SESSION_IDLE_TIMEOUT_MS, 2 * 60 * 1000),
    sweepIntervalMs: num(process.env.SESSION_SWEEP_INTERVAL_MS, 45 * 1000),
  },

  runner: {
    memoryBytes: num(process.env.RUNNER_MEMORY_BYTES, 512 * 1024 * 1024),
    nanoCpus: num(process.env.RUNNER_NANO_CPUS, 1_000_000_000),
    execTimeoutMs: num(process.env.RUN_TIMEOUT_MS, 10_000),
  },
} as const;
