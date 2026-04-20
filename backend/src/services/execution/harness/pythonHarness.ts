import {
  TEST_SENTINEL,
  RESULT_MARKER,
  RESULT_ERR_MARKER,
  type FunctionTest,
  type HarnessBackend,
  type HarnessFile,
} from "./types.js";

export const HARNESS_PY = "__codetutor_tests.py";
export const HARNESS_JSON = "__codetutor_tests.json";

/**
 * Python harness (Phase 16 trust model).
 *
 *   1. Runs as the parent process inside the runner container. Reads
 *      HARNESS_NONCE from env, then deletes it so any subprocess it spawns
 *      cannot read the nonce.
 *   2. Reads __codetutor_tests.json into memory, then os.remove()s the file.
 *      Hidden-test metadata (expected values, category labels) lives only in
 *      the parent's RAM from this point on — user code has no path to it.
 *   3. For each test, spawns a fresh `python3 -c DRIVER TEST_JSON` subprocess.
 *      DRIVER is an inlined Python snippet that loads main.py via runpy,
 *      runs setup, evaluates call, and writes `repr(actual)` between a
 *      RESULT_MARKER pair on its own stdout. The subprocess's stdout is
 *      captured by the parent (never reaches the container's stdout).
 *   4. The parent extracts the LAST RESULT_MARKER block from each
 *      subprocess's stdout and parses it with ast.literal_eval to compare
 *      against the in-memory expected. `repr()` + ast.literal_eval round-
 *      trips cleanly for every literal-friendly value; non-literal returns
 *      (class instances, generators) fall back to string equality on repr,
 *      which matches the v1 harness's behavior.
 *   5. The parent builds the full report, HMAC-signs the body with the nonce,
 *      and emits `SENTINEL + base64(envelope) + SENTINEL + "\n"` to stdout.
 */
export function harnessPython(): string {
  return `import base64, hashlib, hmac, json, os, subprocess, sys, traceback

SENTINEL = ${JSON.stringify(TEST_SENTINEL)}
RESULT_MARKER = ${JSON.stringify(RESULT_MARKER)}
RESULT_ERR_MARKER = ${JSON.stringify(RESULT_ERR_MARKER)}

# --- Read + scrub the nonce and per-test timeout from env --------------
_nonce = os.environ.get("HARNESS_NONCE", "")
if "HARNESS_NONCE" in os.environ:
    del os.environ["HARNESS_NONCE"]
try:
    _per_test_timeout = float(os.environ.get("HARNESS_PER_TEST_TIMEOUT_MS", "5000")) / 1000.0
except (TypeError, ValueError):
    _per_test_timeout = 5.0
if "HARNESS_PER_TEST_TIMEOUT_MS" in os.environ:
    del os.environ["HARNESS_PER_TEST_TIMEOUT_MS"]

# --- Read tests into memory, then delete the file (hides C3) ----------
_tests_path = ${JSON.stringify(HARNESS_JSON)}
_tests = []
_load_err = None
try:
    with open(_tests_path, "r", encoding="utf-8") as _f:
        _tests = json.load(_f)
    os.remove(_tests_path)
except BaseException as _e:
    _load_err = "could not load test specs: " + repr(_e)

# --- Driver run by each per-test subprocess ---------------------------
# The driver reads the test spec from sys.argv[1] (setup + call only — the
# expected value stays with the parent, so user code in the subprocess
# cannot read it). We use python3 -c so driver source and test JSON are on
# argv rather than stdin; /proc/self/cmdline exposes argv but nothing here
# is secret (sentinel markers, user's own setup/call).
_DRIVER = (
    "import sys, runpy, traceback, contextlib, io, json\\n"
    "_test = json.loads(sys.argv[1])\\n"
    "_out = io.StringIO()\\n"
    "try:\\n"
    "    with contextlib.redirect_stdout(_out):\\n"
    "        _ns = runpy.run_path('main.py', run_name='__codetutor_main__')\\n"
    "        _setup = _test.get('setup') or ''\\n"
    "        if _setup:\\n"
    "            exec(_setup, _ns)\\n"
    "        _actual = eval(_test.get('call') or '', _ns)\\n"
    "    sys.stdout.write(_out.getvalue())\\n"
    "    sys.stdout.write('\\\\n' + " + json.dumps(RESULT_MARKER) + " + repr(_actual) + " + json.dumps(RESULT_MARKER) + " + '\\\\n')\\n"
    "except BaseException:\\n"
    "    sys.stdout.write(_out.getvalue())\\n"
    "    sys.stdout.write('\\\\n' + " + json.dumps(RESULT_ERR_MARKER) + " + traceback.format_exc(limit=2) + " + json.dumps(RESULT_ERR_MARKER) + " + '\\\\n')\\n"
)

def _extract_between(text, marker):
    # Last marker block wins: the driver writes exactly one pair at the end
    # of its happy-path flow. If user code emits fake pairs earlier (e.g. a
    # module-level print), they're ignored.
    end = text.rfind(marker)
    if end == -1:
        return None
    start = text.rfind(marker, 0, end)
    if start == -1:
        return None
    return text[start + len(marker):end]

def _strip_markers(text):
    for m in (RESULT_MARKER, RESULT_ERR_MARKER):
        while True:
            a = text.find(m)
            if a == -1:
                break
            b = text.find(m, a + len(m))
            if b == -1:
                break
            text = text[:a] + text[b + len(m):]
    return text.strip()

def _probe_main():
    try:
        return subprocess.run(
            ["python3", "-c", "import runpy; runpy.run_path('main.py', run_name='__codetutor_main__')"],
            capture_output=True, text=True, timeout=_per_test_timeout,
        )
    except subprocess.TimeoutExpired:
        return None
    except BaseException:
        return None

def _result_shell(test):
    return {
        "name": test.get("name", ""),
        "hidden": bool(test.get("hidden", False)),
        "category": test.get("category"),
        "passed": False,
        "actualRepr": None,
        "expectedRepr": None,
        "stdoutDuring": "",
        "error": None,
    }

def _run_one(test):
    shell = _result_shell(test)
    # Only send setup + call into the subprocess. Expected stays in parent RAM.
    payload = json.dumps({"setup": test.get("setup") or "", "call": test.get("call") or ""})
    try:
        r = subprocess.run(
            ["python3", "-c", _DRIVER, payload],
            capture_output=True, text=True, timeout=_per_test_timeout,
        )
    except subprocess.TimeoutExpired:
        shell["error"] = "Test timed out."
        return shell
    except BaseException as e:
        shell["error"] = "Could not spawn test subprocess: " + repr(e)
        return shell

    child_out = r.stdout or ""
    actual_repr = _extract_between(child_out, RESULT_MARKER)
    err_blob = _extract_between(child_out, RESULT_ERR_MARKER)
    shell["stdoutDuring"] = _strip_markers(child_out)

    expected_src = test.get("expected", "")
    if actual_repr is not None:
        try:
            import ast
            expected = ast.literal_eval(expected_src)
        except BaseException:
            shell["error"] = "invalid expected (must be a Python literal): " + expected_src[:200]
            shell["actualRepr"] = actual_repr
            return shell
        try:
            import ast as _ast
            actual = _ast.literal_eval(actual_repr)
            shell["passed"] = actual == expected
        except BaseException:
            # Non-literal repr — fall back to string equality.
            shell["passed"] = actual_repr == repr(expected)
        shell["actualRepr"] = actual_repr
        shell["expectedRepr"] = repr(expected)
        return shell

    if err_blob is not None:
        tail = (err_blob.strip().splitlines() or [""])[-1]
        shell["error"] = tail or "Test raised an exception."
        return shell

    # No marker at all — the subprocess exited before the driver could write
    # anything (os._exit, SIGKILL, etc). Fail closed.
    stderr_tail = ""
    if r.stderr:
        lines = r.stderr.strip().splitlines()
        if lines:
            stderr_tail = lines[-1]
    shell["error"] = stderr_tail or "Test produced no result (the subprocess exited before finishing)."
    return shell

# --- Drive the tests --------------------------------------------------
_results = []
_harness_error = _load_err
_clean_stdout = ""

if _harness_error is None:
    _probe = _probe_main()
    if _probe is None:
        _harness_error = "Your code could not be loaded (probe timed out or crashed)."
    elif _probe.returncode != 0:
        _msg = (_probe.stderr or "").strip() or "Your code could not be loaded."
        _harness_error = _msg
    else:
        _clean_stdout = _probe.stdout or ""
        for _t in _tests:
            _results.append(_run_one(_t))

# --- Sign + emit the envelope ----------------------------------------
_body = json.dumps({
    "results": _results,
    "harnessError": _harness_error,
    "cleanStdout": _clean_stdout,
})
_sig = hmac.new(_nonce.encode("utf-8"), _body.encode("utf-8"), hashlib.sha256).hexdigest()
_inner = json.dumps({"body": _body, "sig": _sig})
_encoded = base64.b64encode(_inner.encode("utf-8")).decode("ascii")
sys.stdout.write(SENTINEL + _encoded + SENTINEL + "\\n")
`;
}

export const pythonHarness: HarnessBackend = {
  language: "python",
  prepareFiles(tests: FunctionTest[]): HarnessFile[] {
    return [
      { name: HARNESS_PY, content: harnessPython() },
      { name: HARNESS_JSON, content: JSON.stringify(tests) },
    ];
  },
  execCommand(): string {
    return `python3 ${HARNESS_PY}`;
  },
};
