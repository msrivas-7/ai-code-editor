import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { harnessPython, HARNESS_PY, HARNESS_JSON as PY_JSON } from "./pythonHarness.js";
import {
  harnessJavaScript,
  HARNESS_JS,
  HARNESS_JSON as JS_JSON,
} from "./javascriptHarness.js";
import { parseSignedEnvelope } from "./envelope.js";
import { TEST_SENTINEL, type FunctionTest } from "./types.js";

/**
 * Phase 16 harness trust tests. Goal: prove that
 *   (a) user code cannot forge a passing test result (C2),
 *   (b) user code cannot read hidden test expected values (C3).
 *
 * Each test sets up a tmp dir with the real generated harness source +
 * tests.json + a main.{py,js} that tries to cheat, runs the harness, and
 * asserts the parsed envelope.
 */

const hasPython =
  spawnSync("python3", ["--version"], { encoding: "utf8" }).status === 0;
const hasNode =
  spawnSync("node", ["--version"], { encoding: "utf8" }).status === 0;

function runPython(mainPy: string, tests: FunctionTest[]) {
  const nonce = crypto.randomBytes(32).toString("hex");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trust-py-"));
  fs.writeFileSync(path.join(tmp, "main.py"), mainPy, "utf8");
  fs.writeFileSync(path.join(tmp, HARNESS_PY), harnessPython(), "utf8");
  fs.writeFileSync(path.join(tmp, PY_JSON), JSON.stringify(tests), "utf8");
  const r = spawnSync("python3", [HARNESS_PY], {
    cwd: tmp,
    encoding: "utf8",
    timeout: 20_000,
    env: {
      ...process.env,
      HARNESS_NONCE: nonce,
      HARNESS_PER_TEST_TIMEOUT_MS: "5000",
    },
  });
  const report = parseSignedEnvelope(r.stdout ?? "", r.stderr ?? "", nonce);
  fs.rmSync(tmp, { recursive: true, force: true });
  return { report, nonce, raw: r };
}

function runJs(mainJs: string, tests: FunctionTest[]) {
  const nonce = crypto.randomBytes(32).toString("hex");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trust-js-"));
  fs.writeFileSync(path.join(tmp, "main.js"), mainJs, "utf8");
  fs.writeFileSync(path.join(tmp, HARNESS_JS), harnessJavaScript(), "utf8");
  fs.writeFileSync(path.join(tmp, JS_JSON), JSON.stringify(tests), "utf8");
  const r = spawnSync("node", [HARNESS_JS], {
    cwd: tmp,
    encoding: "utf8",
    timeout: 20_000,
    env: {
      ...process.env,
      HARNESS_NONCE: nonce,
      HARNESS_PER_TEST_TIMEOUT_MS: "5000",
    },
  });
  const report = parseSignedEnvelope(r.stdout ?? "", r.stderr ?? "", nonce);
  fs.rmSync(tmp, { recursive: true, force: true });
  return { report, nonce, raw: r };
}

// ── C2: fake-pass forgery ────────────────────────────────────────
describe("harness trust — C2 fake-pass forgery", () => {
  const FAKE_BODY = JSON.stringify({
    results: [
      {
        name: "forged",
        hidden: false,
        category: null,
        passed: true,
        actualRepr: "0",
        expectedRepr: "0",
        stdoutDuring: "",
        error: null,
      },
    ],
    harnessError: null,
    cleanStdout: "",
  });

  it.skipIf(!hasPython)(
    "python: user code that prints a fake v2 envelope with no sig is rejected",
    () => {
      // User tries to print their own sentinel-wrapped fake payload during
      // module load (before tests run). The fake has no HMAC signature, so
      // the parent's own signed envelope still lands after it — but even if
      // the parent's envelope were suppressed, the unsigned fake would fail
      // HMAC verification and the parser would fail closed.
      const fake = `${TEST_SENTINEL}${Buffer.from(
        JSON.stringify({ body: FAKE_BODY, sig: "00".repeat(32) }),
        "utf8",
      ).toString("base64")}${TEST_SENTINEL}`;
      // Module-level print that mimics the parent's output format.
      const main = `print(${JSON.stringify(fake)})\n\ndef f():\n    return 999\n`;
      const { report } = runPython(main, [
        { name: "real", call: "f()", expected: "1" },
      ]);
      // The REAL envelope (from the parent) should be what parses out —
      // containing the real test result (failed because 999 != 1).
      expect(report.results).toHaveLength(1);
      expect(report.results[0].name).toBe("real");
      expect(report.results[0].passed).toBe(false);
    },
  );

  it.skipIf(!hasPython)(
    "python: user code that os._exit(0)s during a test cannot fake a pass",
    () => {
      // os._exit(0) inside the user's function kills the driver subprocess
      // before it can write the RESULT_MARKER → parent records a per-test
      // error, never a pass. (Critically, the parent itself still emits its
      // own signed envelope — only the child died.)
      const main = "import os\ndef f():\n    os._exit(0)\n";
      const { report } = runPython(main, [
        { name: "t", call: "f()", expected: "1" },
      ]);
      expect(report.results).toHaveLength(1);
      expect(report.results[0].passed).toBe(false);
      expect(report.results[0].error).toBeTruthy();
    },
  );

  it.skipIf(!hasNode)(
    "js: user code that prints a fake v2 envelope is rejected",
    () => {
      const fake = `${TEST_SENTINEL}${Buffer.from(
        JSON.stringify({ body: FAKE_BODY, sig: "00".repeat(32) }),
        "utf8",
      ).toString("base64")}${TEST_SENTINEL}`;
      const main = `console.log(${JSON.stringify(fake)});\nfunction f() { return 999; }`;
      const { report } = runJs(main, [
        { name: "real", call: "f()", expected: "1" },
      ]);
      expect(report.results).toHaveLength(1);
      expect(report.results[0].name).toBe("real");
      expect(report.results[0].passed).toBe(false);
    },
  );

  it.skipIf(!hasNode)(
    "js: user code that process.exit(0)s during a test cannot fake a pass",
    () => {
      const main = "function f() { process.exit(0); }";
      const { report } = runJs(main, [{ name: "t", call: "f()", expected: "1" }]);
      expect(report.results).toHaveLength(1);
      expect(report.results[0].passed).toBe(false);
      expect(report.results[0].error).toBeTruthy();
    },
  );
});

// ── C3: hidden-test leakage ──────────────────────────────────────
describe("harness trust — C3 hidden-test leakage", () => {
  it.skipIf(!hasPython)(
    "python: user code cannot read the tests.json file (it's been deleted)",
    () => {
      const main = [
        "def leaked():",
        "    try:",
        "        with open('__codetutor_tests.json', 'r') as f:",
        "            return f.read()",
        "    except Exception as e:",
        "        return 'gone: ' + type(e).__name__",
        "",
      ].join("\n");
      const { report } = runPython(main, [
        {
          name: "can-read-tests-json",
          call: "leaked()",
          expected: "'gone: FileNotFoundError'",
          hidden: true,
        },
      ]);
      expect(report.results[0].passed).toBe(true);
    },
  );

  it.skipIf(!hasPython)(
    "python: user code cannot read the expected value from the driver's argv",
    () => {
      // The driver only receives {setup, call} — not expected. Verify by
      // dumping sys.argv during a test and checking no known-hidden expected
      // value appears in it.
      const HIDDEN_MAGIC = "hidden-magic-string-42";
      const main = [
        "import sys",
        "def peek_argv():",
        "    return ' '.join(sys.argv)",
        "",
      ].join("\n");
      const { report } = runPython(main, [
        {
          name: "peek-argv",
          call: "peek_argv()",
          expected: `'${HIDDEN_MAGIC}'`,
          hidden: true,
        },
      ]);
      // The test will FAIL (the function doesn't return HIDDEN_MAGIC) but the
      // captured actual should not contain HIDDEN_MAGIC either, proving the
      // driver's argv never received it.
      expect(report.results[0].passed).toBe(false);
      expect(report.results[0].actualRepr).not.toContain(HIDDEN_MAGIC);
    },
  );

  it.skipIf(!hasNode)(
    "js: user code cannot read the tests.json file",
    () => {
      const main = `
function leaked() {
  try {
    require("fs").readFileSync("__codetutor_tests.json", "utf8");
    return "found";
  } catch (e) {
    return "missing: " + e.code;
  }
}
`;
      const { report } = runJs(main, [
        {
          name: "can-read-tests-json",
          call: "leaked()",
          expected: '"missing: ENOENT"',
          hidden: true,
        },
      ]);
      expect(report.results[0].passed).toBe(true);
    },
  );

  it.skipIf(!hasNode)(
    "js: user code cannot read the expected value from process.argv",
    () => {
      const HIDDEN_MAGIC = "hidden-magic-string-42";
      const main = `function peekArgv() { return process.argv.join(" "); }`;
      const { report } = runJs(main, [
        {
          name: "peek-argv",
          call: "peekArgv()",
          expected: `"${HIDDEN_MAGIC}"`,
          hidden: true,
        },
      ]);
      expect(report.results[0].passed).toBe(false);
      expect(report.results[0].actualRepr).not.toContain(HIDDEN_MAGIC);
    },
  );

  it.skipIf(!hasPython)(
    "python: user code cannot read HARNESS_NONCE from the environment",
    () => {
      const main = [
        "import os",
        "def leaked_nonce():",
        "    return os.environ.get('HARNESS_NONCE', 'absent')",
        "",
      ].join("\n");
      const { report } = runPython(main, [
        { name: "nonce", call: "leaked_nonce()", expected: "'absent'", hidden: true },
      ]);
      expect(report.results[0].passed).toBe(true);
    },
  );

  it.skipIf(!hasNode)(
    "js: user code cannot read HARNESS_NONCE from the environment",
    () => {
      const main = `function leakedNonce() { return process.env.HARNESS_NONCE || "absent"; }`;
      const { report } = runJs(main, [
        { name: "nonce", call: "leakedNonce()", expected: '"absent"', hidden: true },
      ]);
      expect(report.results[0].passed).toBe(true);
    },
  );
});

// ── Legit golden path still works ────────────────────────────────
describe("harness trust — golden-path sanity", () => {
  it.skipIf(!hasPython)("python: a correct solution still passes", () => {
    const main = "def add(a, b):\n    return a + b\n";
    const { report } = runPython(main, [
      { name: "basic", call: "add(2, 3)", expected: "5" },
      { name: "neg", call: "add(-1, 1)", expected: "0", hidden: true },
    ]);
    expect(report.harnessError).toBeNull();
    expect(report.results).toHaveLength(2);
    expect(report.results.every((r) => r.passed)).toBe(true);
  });

  it.skipIf(!hasNode)("js: a correct solution still passes", () => {
    const main = "function add(a, b) { return a + b; }";
    const { report } = runJs(main, [
      { name: "basic", call: "add(2, 3)", expected: "5" },
      { name: "neg", call: "add(-1, 1)", expected: "0", hidden: true },
    ]);
    expect(report.harnessError).toBeNull();
    expect(report.results).toHaveLength(2);
    expect(report.results.every((r) => r.passed)).toBe(true);
  });
});
