import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildRegistry } from "./vitePluginCourseRegistry";

// QA-M1: the plugin is the contract for "dropping a folder auto-registers a
// course." If `buildRegistry` silently accepts a course.json whose id doesn't
// match the folder name, the learner will see a 404 on the dashboard — the
// loader fetches `/courses/<folder>/...` but the id-driven routing expects
// a match. Likewise if a folder without course.json slips through, the
// registry lists a dead entry and every loadCourse call 500s.

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "course-registry-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function scaffold(name: string, course: Record<string, unknown> | "no-json" | "bad-json") {
  const dir = join(workDir, name);
  mkdirSync(dir, { recursive: true });
  if (course === "no-json") return;
  const payload =
    course === "bad-json"
      ? "{not-valid-json"
      : JSON.stringify(course);
  writeFileSync(join(dir, "course.json"), payload);
}

describe("buildRegistry", () => {
  it("returns an empty manifest when the courses dir doesn't exist", () => {
    const { entries, skipped } = buildRegistry(join(workDir, "does-not-exist"));
    expect(entries).toEqual([]);
    expect(skipped).toEqual([]);
  });

  it("collects every folder whose course.json id matches the folder name", () => {
    scaffold("python-fundamentals", { id: "python-fundamentals" });
    scaffold("javascript-fundamentals", { id: "javascript-fundamentals" });
    const { entries, skipped } = buildRegistry(workDir);
    expect(entries.map((e) => e.id).sort()).toEqual([
      "javascript-fundamentals",
      "python-fundamentals",
    ]);
    expect(skipped).toEqual([]);
  });

  it("skips a folder without course.json and records it in `skipped`", () => {
    scaffold("orphan", "no-json");
    scaffold("good", { id: "good" });
    const { entries, skipped } = buildRegistry(workDir);
    expect(entries.map((e) => e.id)).toEqual(["good"]);
    expect(skipped.some((s) => s.startsWith("orphan"))).toBe(true);
  });

  it("skips a folder whose course.json id doesn't match the folder name", () => {
    // If a learner renamed the folder but forgot to update the id, the
    // loader's per-folder fetch would hit /courses/<folder> but the dashboard
    // would link to /<id> — a silent mismatch. Reject loudly instead.
    scaffold("renamed", { id: "original-name" });
    const { entries, skipped } = buildRegistry(workDir);
    expect(entries).toEqual([]);
    expect(skipped.some((s) => s.includes("renamed") && s.includes("does not match folder"))).toBe(true);
  });

  it("skips a course.json that fails to parse without aborting the whole scan", () => {
    scaffold("broken", "bad-json");
    scaffold("good", { id: "good" });
    const { entries, skipped } = buildRegistry(workDir);
    expect(entries.map((e) => e.id)).toEqual(["good"]);
    expect(skipped.some((s) => s.includes("broken") && s.includes("parse error"))).toBe(true);
  });

  it("ignores hidden (dot-prefixed) entries and the manifest file itself", () => {
    // A `.DS_Store` or `registry.json` from a previous run must not be read
    // as a course folder.
    scaffold(".DS_Store", "no-json");
    writeFileSync(join(workDir, "registry.json"), "{}");
    scaffold("ok", { id: "ok" });
    const { entries, skipped } = buildRegistry(workDir);
    expect(entries.map((e) => e.id)).toEqual(["ok"]);
    expect(skipped.some((s) => s.startsWith("."))).toBe(false);
    expect(skipped.some((s) => s.startsWith("registry.json"))).toBe(false);
  });
});
