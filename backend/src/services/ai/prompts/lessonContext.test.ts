import { describe, it, expect } from "vitest";
import { buildLessonContextBlock } from "./lessonContext.js";
import type { LessonContext } from "./lessonContext.js";

const full: LessonContext = {
  courseId: "python-fundamentals",
  lessonId: "hello-world",
  lessonTitle: "Hello, World!",
  lessonObjectives: ["Write and run a Python program", "Use print()"],
  conceptTags: ["print", "strings", "syntax"],
  completionRules: [{ type: "expected_stdout", expected: "Hello, World!" }],
  studentProgressSummary: "attempt 1, 0 runs",
  lessonOrder: 1,
  totalLessons: 10,
};

describe("buildLessonContextBlock", () => {
  it("includes the lesson title in quotes", () => {
    const block = buildLessonContextBlock(full);
    expect(block).toMatch(/"Hello, World!"/);
  });

  it("renders each objective as a bullet", () => {
    const block = buildLessonContextBlock(full);
    expect(block).toMatch(/- Write and run a Python program/);
    expect(block).toMatch(/- Use print\(\)/);
  });

  it("renders concept tags as comma-separated list", () => {
    const block = buildLessonContextBlock(full);
    expect(block).toMatch(/Concepts covered: print, strings, syntax/);
  });

  it("renders expected_stdout rule as task description", () => {
    const block = buildLessonContextBlock(full);
    expect(block).toMatch(/produce stdout containing "Hello, World!"/);
  });

  it("renders required_file_contains rule with file name", () => {
    const ctx: LessonContext = {
      ...full,
      completionRules: [{ type: "required_file_contains", file: "main.py", pattern: "print" }],
    };
    const block = buildLessonContextBlock(ctx);
    expect(block).toMatch(/write code in main\.py containing `print`/);
  });

  it("defaults to main.py when file is not specified in required_file_contains", () => {
    const ctx: LessonContext = {
      ...full,
      completionRules: [{ type: "required_file_contains", pattern: "def " }],
    };
    const block = buildLessonContextBlock(ctx);
    expect(block).toMatch(/write code in main\.py containing `def `/);
  });

  it("renders custom_validator as pass custom validation", () => {
    const ctx: LessonContext = {
      ...full,
      completionRules: [{ type: "custom_validator" }],
    };
    const block = buildLessonContextBlock(ctx);
    expect(block).toMatch(/pass custom validation/);
  });

  it("joins multiple rules with '; and '", () => {
    const ctx: LessonContext = {
      ...full,
      completionRules: [
        { type: "expected_stdout", expected: "Hello" },
        { type: "required_file_contains", file: "main.py", pattern: "print" },
      ],
    };
    const block = buildLessonContextBlock(ctx);
    expect(block).toMatch(/; and /);
  });

  it("includes lesson order when provided", () => {
    const block = buildLessonContextBlock(full);
    expect(block).toMatch(/GUIDED LESSON \(lesson 1 of 10\)/);
  });

  it("omits lesson order when not provided", () => {
    const { lessonOrder, totalLessons, ...noOrder } = full;
    const block = buildLessonContextBlock(noOrder as LessonContext);
    expect(block).toMatch(/^GUIDED LESSON\n/);
    expect(block).not.toMatch(/lesson \d+ of/);
  });

  it("includes student progress summary", () => {
    const block = buildLessonContextBlock(full);
    expect(block).toMatch(/Progress: attempt 1, 0 runs/);
  });

  it("includes lesson rules", () => {
    const block = buildLessonContextBlock(full);
    expect(block).toMatch(/IMPORTANT LESSON RULES:/);
    expect(block).toMatch(/Stay within the scope/);
    expect(block).toMatch(/Guide toward the solution without giving it away/);
  });
});
