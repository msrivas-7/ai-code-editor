import { describe, it, expect, expectTypeOf } from "vitest";
import type {
  CompletionRule,
  Course,
  FunctionTest,
  LessonMeta,
  PracticeExercise,
} from "../types";
import {
  completionRuleSchema,
  courseSchema,
  functionTestSchema,
  lessonMetaSchema,
  practiceExerciseSchema,
  type CompletionRuleSchemaInferred,
  type CourseSchemaInferred,
  type FunctionTestSchemaInferred,
  type LessonMetaSchemaInferred,
  type PracticeExerciseSchemaInferred,
} from "./schema";

describe("content schemas", () => {
  it("courseSchema inferred type matches Course", () => {
    expectTypeOf<CourseSchemaInferred>().toMatchTypeOf<Course>();
    const sample: Course = {
      id: "python-fundamentals",
      title: "Python",
      description: "Desc",
      language: "python",
      lessonOrder: ["a"],
      baseVocabulary: [],
    };
    expect(courseSchema.parse(sample)).toEqual(sample);
  });

  it("functionTestSchema inferred type matches FunctionTest", () => {
    expectTypeOf<FunctionTestSchemaInferred>().toMatchTypeOf<FunctionTest>();
    const sample: FunctionTest = {
      name: "test",
      call: "f(1)",
      expected: "1",
      hidden: true,
      category: "edge",
    };
    expect(functionTestSchema.parse(sample)).toEqual(sample);
  });

  it("completionRuleSchema accepts all four variants", () => {
    expectTypeOf<CompletionRuleSchemaInferred>().toMatchTypeOf<CompletionRule>();
    expect(
      completionRuleSchema.parse({ type: "expected_stdout", expected: "hi" }),
    ).toBeTruthy();
    expect(
      completionRuleSchema.parse({ type: "required_file_contains", pattern: "def " }),
    ).toBeTruthy();
    expect(
      completionRuleSchema.parse({
        type: "function_tests",
        tests: [{ name: "t", call: "f()", expected: "1" }],
      }),
    ).toBeTruthy();
    expect(completionRuleSchema.parse({ type: "custom_validator" })).toBeTruthy();
  });

  it("completionRuleSchema rejects unknown type", () => {
    expect(() =>
      completionRuleSchema.parse({ type: "bogus", expected: "x" }),
    ).toThrow();
  });

  it("practiceExerciseSchema inferred type matches PracticeExercise", () => {
    expectTypeOf<PracticeExerciseSchemaInferred>().toMatchTypeOf<PracticeExercise>();
  });

  it("lessonMetaSchema inferred type matches LessonMeta", () => {
    expectTypeOf<LessonMetaSchemaInferred>().toMatchTypeOf<LessonMeta>();
  });

  it("lessonMetaSchema rejects missing required fields", () => {
    expect(() => lessonMetaSchema.parse({ id: "x" })).toThrow();
  });

  it("lessonMetaSchema rejects non-positive order", () => {
    const base = {
      id: "a",
      courseId: "c",
      title: "T",
      description: "D",
      order: 0,
      language: "python",
      estimatedMinutes: 10,
      objectives: ["learn"],
      teachesConceptTags: [],
      usesConceptTags: [],
      completionRules: [{ type: "expected_stdout", expected: "hi" }],
      prerequisiteLessonIds: [],
    };
    expect(() => lessonMetaSchema.parse(base)).toThrow();
  });

  it("functionTestsRule requires at least one test", () => {
    expect(() =>
      completionRuleSchema.parse({ type: "function_tests", tests: [] }),
    ).toThrow();
  });
});
