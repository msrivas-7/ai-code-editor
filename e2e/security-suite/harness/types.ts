// Shape definitions for the security-suite harness.
//
// Every scenario submits a payload through the real execution pipeline and
// receives back an `ExecOutcome` (what the backend reports) plus, for
// resource-class tests, a `SentinelWindow` (what the host observer saw
// during the attack). Scenarios assert against both — backend-only signals
// aren't enough because attacker-controlled stdout is not a trustworthy
// proof of "nothing escaped."

export type Language = "python" | "javascript" | "typescript" | "go" | "rust" | "ruby" | "java" | "c" | "cpp";

/**
 * The subset of `/api/execute` response we assert against. The server
 * returns a superset (timing buckets, diagnostic breakdowns) — we only
 * lock down the fields that map to security claims.
 */
export type ExecErrorType = "none" | "compile" | "runtime" | "timeout" | "system";

export interface ExecOutcome {
  stdout: string;
  stderr: string;
  exitCode: number;
  errorType: ExecErrorType;
  durationMs: number;
  stage?: "compile" | "run";
}

/**
 * What the host observer recorded during an attack window. Each field is
 * a signal we can assert against in scenarios:
 *  - `canaryMisses`: >0 means the host-side Node event loop stalled long
 *    enough for a 500 ms timer to slip. Fork bombs / CPU hogs that leak
 *    to the host trip this.
 *  - `maxLoadavgDelta`: 1-minute loadavg delta vs. pre-attack baseline.
 *    Catches silent host CPU usage that doesn't stall Node (rare, but
 *    possible under cgroup leak).
 *  - `egressPackets`: packets observed on the Docker bridge that
 *    originated from the runner container. `network=none` means this
 *    MUST be zero. Tcpdump-backed; `null` when tcpdump unavailable
 *    (e.g. local dev without sudo), in which case egress tests fall
 *    back to the backend-level assertion only.
 */
export interface SentinelWindow {
  startedAt: number;
  endedAt: number;
  canaryMisses: number;
  maxLoadavgDelta: number;
  egressPackets: number | null;
}

/**
 * Scenario metadata. Every scenario MUST cite the claim(s) it verifies,
 * so the suite can't accumulate "tests that test nothing in particular"
 * over time. A test with no `claim` is an architectural bug.
 */
export interface ScenarioMeta {
  id: string;              // e.g. "S1a"
  claim: string[];         // e.g. ["C2 network=none"]
  summary: string;         // one-line attack description
}
