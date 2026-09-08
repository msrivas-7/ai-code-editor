import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../workflows/ci.yml", import.meta.url), "utf8");

test("cross-platform build and test jobs retain fail-fast bash", () => {
  for (const name of ["build", "test"]) {
    const job = workflow.match(new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [\\w-]+:|$(?![\\s\\S]))`, "m"))?.[1];
    assert.ok(job, `missing ${name} job`);
    assert.match(job, /^    defaults:\n      run:\n        shell: bash$/m);
    const steps = job.split(/^    steps:\n/m)[1];
    assert.ok(steps, `missing ${name} steps`);
    assert.doesNotMatch(steps, /^        shell:/m, "steps must not override the fail-fast shell");
  }
});

// GitHub's documented shell:bash invocation, including Git for Windows.
// Run this on every matrix OS, not just a simulated Windows platform value.
function run(script) {
  const result = spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", script], {
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.ifError(result.error);
  return result;
}

test("a failed native command cannot be hidden by a later successful command", () => {
  const result = run('node -e "process.exit(23)"\nnode -e "console.log(\'must-not-run\')"');
  assert.equal(result.status, 23);
  assert.doesNotMatch(result.stdout, /must-not-run/);
});

test("a failed pipeline command cannot be hidden by its successful consumer", () => {
  const result = run('node -e "process.exit(23)" | node -e "process.exit(0)"\nnode -e "console.log(\'must-not-run\')"');
  assert.equal(result.status, 23);
  assert.doesNotMatch(result.stdout, /must-not-run/);
});

test("successful command sequences still complete normally", () => {
  const result = run('node -e "console.log(\'first\')"\nnode -e "console.log(\'second\')"');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /first\s+second/);
});
