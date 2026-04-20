import crypto from "node:crypto";
import { config } from "../../../config.js";
import type {
  ExecutionBackend,
  SessionHandle,
} from "../backends/index.js";
import { parseSignedEnvelope } from "./envelope.js";
import type {
  FunctionTest,
  HarnessBackend,
  RunTestsResult,
} from "./types.js";

export interface RunTestsOptions {
  handle: SessionHandle;
  tests: FunctionTest[];
  timeoutMs?: number;
}

/**
 * Language-agnostic harness runner. Writes the backend's temp files into the
 * workspace, execs the backend's command inside the session container, parses
 * a signed stdout envelope, and always cleans up the temp files afterward.
 *
 * Phase 16 trust model: the parent generates a per-run nonce, passes it to
 * the harness via a per-exec env var, and verifies the HMAC signature the
 * harness puts on its result body. User code running inside the runner
 * cannot produce a valid envelope because it cannot see the nonce (the
 * harness scrubs it from the environment before spawning any user-code
 * subprocess). A missing or forged envelope fails closed as a generic
 * "Test run failed" error — no leak of which failure mode it was.
 *
 * The 137 exit code from `timeout --signal=KILL` surfaces as an explicit
 * harnessError so the UI can say "timed out" rather than showing empty
 * results.
 */
export async function runTests(
  execBackend: ExecutionBackend,
  harness: HarnessBackend,
  opts: RunTestsOptions,
): Promise<RunTestsResult> {
  const { handle, tests } = opts;
  const timeoutMs = opts.timeoutMs ?? config.runner.execTimeoutMs;
  const files = harness.prepareFiles(tests);
  const filePaths = files.map((f) => f.name);

  const nonce = crypto.randomBytes(32).toString("hex");
  // Give each child subprocess enough time for a golden solution's slowest
  // test but leave headroom under the wall-clock cap so the parent's own
  // envelope-emit has time to run.
  const perTestTimeoutMs = Math.max(1000, Math.floor(timeoutMs * 0.8));

  try {
    await execBackend.writeFiles(
      handle,
      files.map((f) => ({ path: f.name, content: f.content })),
    );

    const exec = await execBackend.exec(
      handle,
      harness.execCommand(),
      timeoutMs,
      {
        stdin: "",
        env: {
          HARNESS_NONCE: nonce,
          HARNESS_PER_TEST_TIMEOUT_MS: String(perTestTimeoutMs),
        },
      },
    );

    const timedOut = exec.exitCode === 137;
    if (timedOut) {
      return {
        report: {
          results: [],
          harnessError: `Tests timed out after ${timeoutMs}ms. Check for infinite loops.`,
          cleanStdout: exec.stdout,
        },
        stderr: exec.stderr,
        exitCode: exec.exitCode,
        timedOut: true,
        durationMs: exec.durationMs,
      };
    }

    const report = parseSignedEnvelope(exec.stdout, exec.stderr, nonce);
    return {
      report,
      stderr: exec.stderr,
      exitCode: exec.exitCode,
      timedOut: false,
      durationMs: exec.durationMs,
    };
  } finally {
    await execBackend.removeFiles(handle, filePaths);
  }
}
