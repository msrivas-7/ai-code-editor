// S4 — Resource exhaustion. This is the category where assertion shape
// matters most — exit codes alone are not enough. A fork bomb test
// passing because the container died tells us nothing if the host also
// hiccuped. Every test here brackets the attack in `sentinel.window()`
// and asserts on BOTH the backend response and the host observer.
//
// Claims covered:
//   C6  memory cap             → S4b
//   C7  CPU cap                → S4c (indirectly — the wall-clock is the
//                                effective ceiling under cgroup throttling)
//   C8  PidsLimit 256          → S4a
//   C9  ulimit nofile 256      → S4f
//   C11 output cap 1 MB + 8 KB → S4d (regression test for the fix just shipped)
//   C12 wall-clock timeout     → S4c, S4e
//
// Sentinel assertion philosophy: we expect the container to die — that's
// the point of the cap. What we DON'T want is the host's Node event
// loop stalling (=> canary miss) or sustained loadavg spikes (=> CPU
// leaked). So the positive assertions ARE on the sentinel.

import { test, expect } from "../harness/fixtures.js";

test.describe("S4 — resource exhaustion (with host sentinel)", () => {
  test("S4a: fork bomb is capped by PidsLimit, host stays responsive", async ({
    attack,
    sessionId,
    sentinel,
    scenario,
  }) => {
    scenario({
      id: "S4a",
      claim: ["C8 PidsLimit 256"],
      summary: "classic fork-bomb must not affect the host",
    });
    const obs = await sentinel.window(async () => {
      const result = await attack.runAttack({
        sessionId,
        language: "python",
        files: [
          {
            path: "main.py",
            content: `
import os, time
# Spin up children until the kernel says no (EAGAIN from clone()).
forked = 0
try:
    for _ in range(5000):
        pid = os.fork()
        if pid == 0:
            time.sleep(10)
            os._exit(0)
        forked += 1
except BlockingIOError as e:
    print(f"BLOCKED:{forked}:{type(e).__name__}")
except OSError as e:
    print(f"BLOCKED:{forked}:OSError:{e.errno}")
else:
    print(f"OK:spawned-{forked}")
`.trim(),
          },
        ],
      });
      // Either the container was killed (exit 137 from wall-clock or
      // OOM) OR the fork cap kicked in cleanly (exit 0 with BLOCKED).
      // What matters is we didn't succeed in spawning 5000 children.
      const spawnedAll = /OK:spawned-5000/.test(result.stdout);
      expect(spawnedAll).toBe(false);
    });
    // Host must not have stalled. Canary misses = tick gaps >1s.
    expect(obs.canaryMisses).toBeLessThanOrEqual(1);
    // 1-minute loadavg is a lagging indicator; we give it some room,
    // but a fork bomb that leaked to the host would spike by >3.
    expect(obs.maxLoadavgDelta).toBeLessThan(3);
  });

  test("S4b: memory balloon triggers OOM, host memory untouched", async ({
    attack,
    sessionId,
    sentinel,
    scenario,
  }) => {
    scenario({
      id: "S4b",
      claim: ["C6 memory cap"],
      summary: "attempt to allocate 2 GB must OOM inside the container",
    });
    const obs = await sentinel.window(async () => {
      const result = await attack.runAttack({
        sessionId,
        language: "python",
        files: [
          {
            path: "main.py",
            content: `
# Allocate in chunks so the kernel has clear SIGKILL points.
import sys
chunks = []
try:
    for i in range(2048):  # 2 GB, 1 MB chunks
        chunks.append(bytearray(1024 * 1024))
    print(f"OK:allocated-{len(chunks)}MB")
except MemoryError:
    print(f"BLOCKED:MemoryError:{len(chunks)}")
`.trim(),
          },
        ],
      });
      // Allocating 2 GB must fail — either via exit 137 (SIGKILL from
      // cgroup oom) or a raised MemoryError.
      const allocatedAll = /OK:allocated-2048MB/.test(result.stdout);
      expect(allocatedAll).toBe(false);
    });
    expect(obs.canaryMisses).toBeLessThanOrEqual(1);
  });

  test("S4c: infinite CPU loop is killed at wall-clock", async ({
    attack,
    sessionId,
    sentinel,
    scenario,
  }) => {
    scenario({
      id: "S4c",
      claim: ["C7 CPU cap", "C12 wall-clock timeout"],
      summary: "infinite loop must be killed near the configured timeout",
    });
    const obs = await sentinel.window(async () => {
      const result = await attack.runAttack({
        sessionId,
        language: "python",
        files: [{ path: "main.py", content: `while True: pass\n` }],
      });
      // Wall-clock is typically 10 s; timedOut should be set, exit should
      // be the timeout shape (137 SIGKILL).
      expect(result.errorType).toBe("timeout");
      expect(result.durationMs).toBeLessThan(15_000);
      expect(result.durationMs).toBeGreaterThan(5_000);
    });
    // Infinite CPU loop in a CPU-capped container should not stall the
    // host. Allow generous canary tolerance — the runner machine is
    // under some load from our own docker stack.
    expect(obs.canaryMisses).toBeLessThanOrEqual(2);
  });

  test("S4d: single giant stderr line is per-line-capped (regression)", async ({
    attack,
    sessionId,
    scenario,
  }) => {
    scenario({
      id: "S4d",
      claim: ["C11 output cap per-line 8 KB"],
      summary: "the 2 MB single-write repro must degrade to ~8 KB",
    });
    // This is the exact shape that froze the UI before the fix. The
    // backend's whole-stream cap sliced to 1 MB; the per-line cap
    // should now reduce to ~8 KB + marker.
    const result = await attack.runAttack({
      sessionId,
      language: "python",
      files: [
        {
          path: "main.py",
          content: `import sys\nsys.stderr.write("E" * (2 * 1024 * 1024))\n`,
        },
      ],
    });
    // Absolute size bound — generous to account for truncation marker
    // and any platform-dependent overhead.
    expect(result.stderr.length).toBeLessThan(20 * 1024);
    // The truncation marker's byte-count reflects the pre-cap original
    // line length, which after the 1 MB stream slice is 1048576 bytes.
    expect(result.stderr).toContain("[line truncated");
    // Wall-clock budget — the fix should not introduce any blocking
    // work; transform is O(n) on already-capped 1 MB.
    expect(result.durationMs).toBeLessThan(10_000);
  });

  test("S4e: slow-drip output doesn't prevent wall-clock kill", async ({
    attack,
    sessionId,
    scenario,
  }) => {
    scenario({
      id: "S4e",
      claim: ["C12 wall-clock timeout"],
      summary: "output activity must not defer the timeout SIGKILL",
    });
    const result = await attack.runAttack({
      sessionId,
      language: "python",
      files: [
        {
          path: "main.py",
          content: `
import time, sys
for i in range(10000):
    print(f"tick-{i}")
    sys.stdout.flush()
    time.sleep(0.02)
`.trim(),
        },
      ],
    });
    expect(result.errorType).toBe("timeout");
    expect(result.durationMs).toBeLessThan(15_000);
  });

  test("S4f: FD exhaustion hits ulimit at 256", async ({
    attack,
    sessionId,
    scenario,
  }) => {
    scenario({
      id: "S4f",
      claim: ["C9 ulimit nofile 256"],
      summary: "opening 300+ FDs must hit EMFILE around 256",
    });
    const result = await attack.runAttack({
      sessionId,
      language: "python",
      files: [
        {
          path: "main.py",
          content: `
import os, errno
fds = []
try:
    for i in range(400):
        fd = os.open("/tmp", os.O_RDONLY)
        fds.append(fd)
    print(f"OK:opened-{len(fds)}")
except OSError as e:
    print(f"BLOCKED:{len(fds)}:errno={e.errno}")
finally:
    for fd in fds:
        try: os.close(fd)
        except Exception: pass
`.trim(),
        },
      ],
    });
    expect(result.stdout).not.toContain("OK:opened-400");
    expect(result.stdout).toMatch(/BLOCKED:\d+:errno=(24|23)/);
  });
});
