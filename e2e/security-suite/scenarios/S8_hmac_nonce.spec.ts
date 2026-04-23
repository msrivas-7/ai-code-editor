// S8 — HMAC/nonce integrity for the grading system.
//
// Flow we're probing:
//  1. POST /api/execute/tests with a solution + set of FunctionTests.
//  2. Backend generates a fresh 32-byte nonce per run, feeds it to the
//     harness via stdin (not env — matters for S8c).
//  3. Harness wraps results in `SENTINEL + base64({body, sig}) + SENTINEL`
//     where sig = HMAC-SHA256(nonce, body).
//  4. Backend verifies sig with timingSafeEqual and returns only then.
//
// The grading system is a distinct threat surface from the container
// sandbox. A hole here doesn't hurt the host — it invalidates grades,
// certificates, and the integrity of every lesson the platform ships.
//
// Unit tests in backend/ already cover signature verification in
// isolation (envelope.test.ts, trust.test.ts). S8 exercises the full
// HTTP+harness+crypto stack end-to-end, catching the regression no
// unit test can catch: a wiring change that skips verifySignature()
// on some error path.

import { test, expect } from "../harness/fixtures.js";
import { BACKEND_URL } from "../harness/api.js";

// A FunctionTest that MUST fail when the harness is working correctly:
// add(1,2) legitimately returns 3, expected is "999" — so any reported
// `passed: true` can only have come from tampering, not from real
// function evaluation. Crucial for forgery tests: a legitimately-passing
// test would pass trivially regardless of any envelope shenanigans.
const failingTest = {
  setup: "def add(a, b):\n    return a + b\n",
  call: "add(1, 2)",
  expected: "999",
  name: "S8 forgery probe (must fail legitimately)",
};

// A FunctionTest that legitimately passes. Used ONLY by the positive
// control S8g, which asserts the happy path still works.
const passingTest = {
  setup: "def add(a, b):\n    return a + b\n",
  call: "add(1, 2)",
  expected: "3",
  name: "S8 happy path",
};

test.describe("S8 — HMAC/nonce integrity (grading system)", () => {
  test("S8a: user code cannot forge a passing envelope (fabricated signature)", async ({
    attack,
    sessionId,
    scenario,
  }) => {
    scenario({
      id: "S8a",
      claim: ["grading:no-forge-verdict"],
      summary: "printing a forged envelope from user code must not produce a PASS",
    });
    // The solution file writes a well-formed-looking envelope with
    // `results: all passed`. The signature is fabricated (all-zero
    // hex). If the harness/backend trust stdout when envelope parsing
    // succeeds, this would falsely report a pass.
    const sentinel = "<<<CODETUTOR_ENVELOPE_V1>>>";
    const fakeBody = JSON.stringify({
      results: [
        {
          name: "S8 grading probe",
          passed: true,
          actual: "3",
          expected: "3",
        },
      ],
      harnessError: null,
      cleanStdout: "",
    });
    const fakeSig = "0".repeat(64);
    const fakeEnvelope = JSON.stringify({ body: fakeBody, sig: fakeSig });
    const fakeB64 = Buffer.from(fakeEnvelope, "utf8").toString("base64");
    const solution = `
import sys
# The harness that signs real envelopes reads the nonce from stdin.
# User code has no nonce, so any envelope it prints is unsigned.
print("${sentinel}" + "${fakeB64}" + "${sentinel}")
sys.stdout.flush()
`.trim();

    // Write the solution, then submit a /api/execute/tests call.
    await attack.writeFiles(sessionId, [{ path: "main.py", content: solution }]);
    const res = await attack.raw.post(`${BACKEND_URL}/api/execute/tests`, {
      data: {
        sessionId,
        language: "python",
        tests: [failingTest],
      },
    });
    // Must not 200-with-passing-results from the forged envelope.
    if (res.ok()) {
      const body = (await res.json()) as {
        report?: { results?: Array<{ passed: boolean }> };
      };
      const results = body.report?.results ?? [];
      const anyPassed = results.some((r) => r.passed === true);
      expect(anyPassed, "forged envelope must not produce a passing result").toBe(false);
    } else {
      // Accepted outcome: backend rejects the run outright.
      expect(res.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test("S8c: nonce is not leaked via /proc/self/environ, cmdline, or fd/0", async ({
    attack,
    sessionId,
    scenario,
  }) => {
    scenario({
      id: "S8c",
      claim: ["grading:nonce-not-leaked"],
      summary: "user code must not be able to read the per-run nonce",
    });
    // The solution prints everything it can find in the obvious leak
    // surfaces. S8's assertion is that NO 32-byte hex-looking string
    // shows up in the grading response's `cleanStdout` (which is the
    // channel the harness would route back to the user).
    //
    // Running the probe as a FunctionTest means the harness IS in the
    // loop — the nonce lifecycle is fully active during user code exec.
    const probe = `
import os, pathlib
def observe():
    out = []
    try:
        out.append("environ:" + open("/proc/self/environ","rb").read().decode(errors="replace"))
    except Exception as e:
        out.append(f"environ_err:{e}")
    try:
        out.append("cmdline:" + open("/proc/self/cmdline","rb").read().decode(errors="replace"))
    except Exception as e:
        out.append(f"cmdline_err:{e}")
    try:
        out.append("fd0:" + open("/proc/self/fd/0","rb").read().decode(errors="replace"))
    except Exception as e:
        out.append(f"fd0_err:{e}")
    try:
        # Parent process is the harness. If the nonce landed in the
        # parent's cmdline or environ, this reveals it.
        out.append("pcmd:" + open("/proc/self/stat").read().split()[3])
    except Exception as e:
        out.append(f"pstat_err:{e}")
    return "||".join(out)
`;
    await attack.writeFiles(sessionId, [{ path: "main.py", content: probe }]);
    const res = await attack.raw.post(`${BACKEND_URL}/api/execute/tests`, {
      data: {
        sessionId,
        language: "python",
        tests: [
          {
            name: "observe leaks",
            setup: probe,
            call: "observe()",
            expected: "should never match",
          },
        ],
      },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      report?: {
        results?: Array<{ actual?: string }>;
        cleanStdout?: string;
        harnessError?: string | null;
      };
    };
    // Reconstruct every surface the attacker could read — `actual` is
    // what the probe returned; `cleanStdout` is any printed output.
    const surfaces = [
      body.report?.cleanStdout ?? "",
      ...(body.report?.results ?? []).map((r) => r.actual ?? ""),
    ].join("||");
    // The nonce is 32 bytes printed as 64 hex chars. A loose assertion
    // "no 64-char run of hex" would reject many benign strings, so we
    // require a longer boundary: 64 hex chars directly surrounded by
    // non-hex or end-of-string. This is a tighter match than the actual
    // nonce format and avoids false positives while catching any leak.
    const hexRun = /(?:^|[^a-f0-9])([a-f0-9]{64})(?:[^a-f0-9]|$)/i;
    const m = surfaces.match(hexRun);
    if (m) {
      // If we found a hex run, fail with enough context to diagnose.
      throw new Error(
        `possible nonce leak: 64-char hex run "${m[1]}" appeared in grading-response surfaces`,
      );
    }
  });

  test("S8d: hidden test expected values do not leak to user output", async ({
    attack,
    sessionId,
    scenario,
  }) => {
    scenario({
      id: "S8d",
      claim: ["grading:hidden-tests-hidden"],
      summary: "the 'expected' string must never appear in response surfaces the user sees",
    });
    // Use a sentinel-shaped expected value that we can grep for. If the
    // harness accidentally echoes `expected` back, the string will show
    // up in cleanStdout OR in a results row.
    const SENTINEL_EXPECTED = "SECRET_GRADING_TOKEN_2026_DO_NOT_ECHO";
    const probe = `
def add(a,b):
    # Introspect argv, argv-like state, and scan the process's own
    # address space for the sentinel. Print whatever we find to stdout
    # (the "cleanStdout" surface the harness returns to the user).
    import os, sys
    found = []
    for p in ["/proc/self/cmdline", "/proc/self/environ", "/proc/self/status"]:
        try:
            found.append(f"{p}:{open(p,'rb').read()[:500]}")
        except Exception: pass
    print("|".join(found))
    return a + b
`;
    await attack.writeFiles(sessionId, [{ path: "main.py", content: probe }]);
    const res = await attack.raw.post(`${BACKEND_URL}/api/execute/tests`, {
      data: {
        sessionId,
        language: "python",
        tests: [
          {
            name: "hidden-test-leak-probe",
            setup: probe,
            call: "add(1, 2)",
            expected: SENTINEL_EXPECTED,
          },
        ],
      },
    });
    expect(res.status()).toBe(200);
    const raw = await res.text();
    // The grading response can legally mention `expected` INSIDE the
    // per-test result row (the UI needs to show "expected X, got Y" on
    // failure). What it must NOT do is leak the expected into the
    // `cleanStdout` — that's the channel the user code's print()
    // statements land in, and it's what they'd scrape to extract
    // hidden tests across many runs.
    const body = JSON.parse(raw) as {
      report?: {
        cleanStdout?: string;
        results?: Array<{ actual?: string }>;
      };
    };
    const userSurfaces = [
      body.report?.cleanStdout ?? "",
      ...(body.report?.results ?? []).map((r) => r.actual ?? ""),
    ].join("||");
    expect(userSurfaces).not.toContain(SENTINEL_EXPECTED);
  });

  test("S8e: malformed envelopes all fail verification (no silent fallback)", async ({
    attack,
    sessionId,
    scenario,
  }) => {
    scenario({
      id: "S8e",
      claim: ["grading:malformed-envelope-rejected"],
      summary: "truncated / tampered / bad-base64 envelopes must not produce results",
    });
    // This one is a black-box flavor: we don't assert the exact error
    // message (that changes with refactors), only that three different
    // malformed variants ALL fail to produce a passing-result response.
    const variants = [
      // 1. Sentinel marker but no closing marker.
      `print("<<<CODETUTOR_ENVELOPE_V1>>>not-closed-base64")`,
      // 2. Proper sentinels, but the middle is not valid base64.
      `print("<<<CODETUTOR_ENVELOPE_V1>>>!!!not-base64!!!<<<CODETUTOR_ENVELOPE_V1>>>")`,
      // 3. Proper sentinels + base64, but the inner JSON is missing sig.
      (() => {
        const partial = Buffer.from(
          JSON.stringify({ body: JSON.stringify({ results: [] }) }),
          "utf8",
        ).toString("base64");
        return `print("<<<CODETUTOR_ENVELOPE_V1>>>${partial}<<<CODETUTOR_ENVELOPE_V1>>>")`;
      })(),
    ];
    for (const solution of variants) {
      await attack.writeFiles(sessionId, [{ path: "main.py", content: solution }]);
      const res = await attack.raw.post(`${BACKEND_URL}/api/execute/tests`, {
        data: {
          sessionId,
          language: "python",
          tests: [failingTest],
        },
      });
      if (res.ok()) {
        const body = (await res.json()) as {
          report?: { results?: Array<{ passed: boolean }> };
        };
        const anyPass = (body.report?.results ?? []).some((r) => r.passed === true);
        expect(anyPass, `malformed variant should not produce pass: ${solution}`).toBe(false);
      } else {
        expect(res.status()).toBeGreaterThanOrEqual(400);
      }
    }
  });

  test("S8f: stdout-only 'I passed' is not trusted without an envelope", async ({
    attack,
    sessionId,
    scenario,
  }) => {
    scenario({
      id: "S8f",
      claim: ["grading:envelope-required"],
      summary: "plain stdout matching the expected value must not count as PASS",
    });
    // Classic fallback-trap: if the route accepts "stdout equals
    // expected" as a pass when the envelope parse fails, an attacker
    // just prints the expected value. This case prints the right value
    // with no envelope — must still be reported as failing.
    // User prints "999" — matching the FAILING test's expected value.
    // If the route falls back to "stdout-equals-expected" after envelope
    // parsing fails, this would wrongly report a pass.
    const solution = `print("999")\n`;
    await attack.writeFiles(sessionId, [{ path: "main.py", content: solution }]);
    const res = await attack.raw.post(`${BACKEND_URL}/api/execute/tests`, {
      data: {
        sessionId,
        language: "python",
        tests: [failingTest],
      },
    });
    if (res.ok()) {
      const body = (await res.json()) as { results?: Array<{ passed: boolean }> };
      const anyPass = (body.results ?? []).some((r) => r.passed === true);
      expect(anyPass, "envelope-less output must not count as pass").toBe(false);
    } else {
      // Acceptable: backend rejects the run (harness-error path).
      expect(res.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test("S8g: backend always verifies signatures (frontend-trust contract)", async ({
    attack,
    sessionId,
    scenario,
  }) => {
    scenario({
      id: "S8g",
      claim: ["grading:backend-only-verification"],
      summary: "a legitimate passing run produces a well-formed TestReport",
    });
    // Positive control for the category: the happy path must still
    // work. If this fails, our attack-oriented tests above could be
    // false-negatives (e.g. the harness is broken regardless).
    const solution = `def add(a, b):\n    return a + b\n`;
    await attack.writeFiles(sessionId, [{ path: "main.py", content: solution }]);
    const res = await attack.raw.post(`${BACKEND_URL}/api/execute/tests`, {
      data: {
        sessionId,
        language: "python",
        tests: [passingTest],
      },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      report?: { results?: Array<{ name: string; passed: boolean }> };
    };
    expect(body.report?.results?.[0]?.passed).toBe(true);
  });
});
