// S7 — Negative controls. These MUST pass for the harness to be
// trustworthy. If `print("hello")` doesn't run, the suite is reporting on
// itself, not on the sandbox. Put another way: a green S7 is the only
// way to know that a green S1–S8 means anything.

import { test, expect } from "../harness/fixtures.js";

test.describe("S7 — negative controls (harness sanity)", () => {
  test("S7a: hello-world Python runs and exits 0 with expected stdout", async ({
    attack,
    sessionId,
    scenario,
  }) => {
    scenario({
      id: "S7a",
      claim: ["harness:golden-path"],
      summary: "benign Python must run successfully",
    });
    const result = await attack.runAttack({
      sessionId,
      language: "python",
      files: [{ path: "main.py", content: `print("hello world")\n` }],
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("hello world");
    expect(result.stderr).toBe("");
    expect(result.errorType).not.toBe("timeout");
  });

  test("S7b: a ZeroDivisionError surfaces on stderr with non-zero exit", async ({
    attack,
    sessionId,
    scenario,
  }) => {
    scenario({
      id: "S7b",
      claim: ["harness:error-path"],
      summary: "runtime errors must propagate correctly",
    });
    const result = await attack.runAttack({
      sessionId,
      language: "python",
      files: [{ path: "main.py", content: `print(1 / 0)\n` }],
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/ZeroDivisionError/);
  });

  test("S7c: sentinel reports no canary misses for a quiet run", async ({
    sentinel,
    attack,
    sessionId,
    scenario,
  }) => {
    scenario({
      id: "S7c",
      claim: ["harness:sentinel-baseline"],
      summary: "sentinel must not false-positive on benign code",
    });
    const obs = await sentinel.window(async () => {
      await attack.runAttack({
        sessionId,
        language: "python",
        files: [{ path: "main.py", content: `print("ok")\n` }],
      });
    });
    expect(obs.canaryMisses).toBe(0);
    // Loadavg sampling is 2 s cadence — a sub-second test can land without
    // any sample in its window. We only fail if the window caught samples
    // AND they moved meaningfully.
    expect(obs.maxLoadavgDelta).toBeLessThan(1.5);
  });
});
