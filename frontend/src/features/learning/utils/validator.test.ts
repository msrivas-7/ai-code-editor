import { describe, it, expect } from "vitest";
import { validateLesson } from "./validator";
import type { CompletionRule } from "../types";
import type { RunResult, ProjectFile } from "../../../types";

const okRun: RunResult = {
  stdout: "Hello, World!\n",
  stderr: "",
  exitCode: 0,
  durationMs: 42,
  errorType: "none",
  stage: "run",
};

const errorRun: RunResult = {
  stdout: "",
  stderr: "SyntaxError: invalid syntax",
  exitCode: 1,
  durationMs: 10,
  errorType: "runtime",
  stage: "run",
};

const files: ProjectFile[] = [
  { path: "main.py", content: 'print("Hello, World!")\n' },
];

describe("validateLesson", () => {
  it("auto-passes when there are no rules", () => {
    const result = validateLesson(okRun, files, []);
    expect(result.passed).toBe(true);
  });

  it("passes expected_stdout when output contains the expected string", () => {
    const rules: CompletionRule[] = [
      { type: "expected_stdout", expected: "Hello, World!" },
    ];
    const result = validateLesson(okRun, files, rules);
    expect(result.passed).toBe(true);
  });

  it("fails expected_stdout when output does not match", () => {
    const rules: CompletionRule[] = [
      { type: "expected_stdout", expected: "Goodbye" },
    ];
    const result = validateLesson(okRun, files, rules);
    expect(result.passed).toBe(false);
    expect(result.feedback.some((f) => f.includes("Goodbye"))).toBe(true);
  });

  it("fails expected_stdout when no run result exists", () => {
    const rules: CompletionRule[] = [
      { type: "expected_stdout", expected: "Hello" },
    ];
    const result = validateLesson(null, files, rules);
    expect(result.passed).toBe(false);
    expect(result.feedback[0]).toMatch(/run your code/i);
  });

  it("fails expected_stdout when exit code is nonzero", () => {
    const rules: CompletionRule[] = [
      { type: "expected_stdout", expected: "Hello" },
    ];
    const result = validateLesson(errorRun, files, rules);
    expect(result.passed).toBe(false);
    expect(result.feedback[0]).toMatch(/error/i);
  });

  it("passes required_file_contains when pattern is present", () => {
    const rules: CompletionRule[] = [
      { type: "required_file_contains", file: "main.py", pattern: "print" },
    ];
    const result = validateLesson(okRun, files, rules);
    expect(result.passed).toBe(true);
  });

  it("fails required_file_contains when pattern is missing", () => {
    const rules: CompletionRule[] = [
      { type: "required_file_contains", file: "main.py", pattern: "input(" },
    ];
    const result = validateLesson(okRun, files, rules);
    expect(result.passed).toBe(false);
  });

  it("fails required_file_contains when file does not exist", () => {
    const rules: CompletionRule[] = [
      { type: "required_file_contains", file: "other.py", pattern: "x" },
    ];
    const result = validateLesson(okRun, files, rules);
    expect(result.passed).toBe(false);
    expect(result.feedback[0]).toMatch(/not found/i);
  });

  it("defaults to main.py when file is not specified", () => {
    const rules: CompletionRule[] = [
      { type: "required_file_contains", pattern: "print" },
    ];
    const result = validateLesson(okRun, files, rules);
    expect(result.passed).toBe(true);
  });

  it("requires all rules to pass", () => {
    const rules: CompletionRule[] = [
      { type: "expected_stdout", expected: "Hello, World!" },
      { type: "required_file_contains", file: "main.py", pattern: "input(" },
    ];
    const result = validateLesson(okRun, files, rules);
    expect(result.passed).toBe(false);
  });

  it("handles custom_validator gracefully", () => {
    const rules: CompletionRule[] = [
      { type: "custom_validator" },
    ];
    const result = validateLesson(okRun, files, rules);
    expect(result.passed).toBe(true);
  });

  it("returns nextHints when validation fails", () => {
    const rules: CompletionRule[] = [
      { type: "expected_stdout", expected: "Goodbye" },
    ];
    const result = validateLesson(okRun, files, rules);
    expect(result.passed).toBe(false);
    expect(result.nextHints).toBeDefined();
    expect(result.nextHints!.length).toBeGreaterThan(0);
  });
});
