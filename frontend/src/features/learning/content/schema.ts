import { z } from "zod";

const nonEmptyString = z.string().min(1);
const kebabOrSnake = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9_-]*$/i, "must be a simple identifier (letters, digits, -, _)");

export const functionTestSchema = z.object({
  name: nonEmptyString,
  call: nonEmptyString,
  expected: nonEmptyString,
  setup: z.string().optional(),
  hidden: z.boolean().optional(),
  category: z.string().optional(),
});

export const expectedStdoutRuleSchema = z.object({
  type: z.literal("expected_stdout"),
  expected: nonEmptyString,
});

export const requiredFileContainsRuleSchema = z.object({
  type: z.literal("required_file_contains"),
  file: z.string().optional(),
  pattern: nonEmptyString,
});

export const functionTestsRuleSchema = z.object({
  type: z.literal("function_tests"),
  tests: z.array(functionTestSchema).min(1),
});

export const customValidatorRuleSchema = z.object({
  type: z.literal("custom_validator"),
});

export const completionRuleSchema = z.discriminatedUnion("type", [
  expectedStdoutRuleSchema,
  requiredFileContainsRuleSchema,
  functionTestsRuleSchema,
  customValidatorRuleSchema,
]);

export const practiceExerciseSchema = z.object({
  id: kebabOrSnake,
  title: nonEmptyString,
  prompt: nonEmptyString,
  goal: nonEmptyString,
  starterCode: z.string().optional(),
  completionRules: z.array(completionRuleSchema).min(1),
  hints: z.array(z.string()).optional(),
});

export const lessonMetaSchema = z.object({
  id: kebabOrSnake,
  courseId: kebabOrSnake,
  title: nonEmptyString,
  description: nonEmptyString,
  order: z.number().int().positive(),
  language: nonEmptyString,
  estimatedMinutes: z.number().int().positive(),
  objectives: z.array(z.string()).min(1),
  teachesConceptTags: z.array(z.string()).default([]),
  usesConceptTags: z.array(z.string()).default([]),
  completionRules: z.array(completionRuleSchema).min(1),
  prerequisiteLessonIds: z.array(kebabOrSnake),
  recap: z.string().optional(),
  practicePrompts: z.array(z.string()).optional(),
  practiceExercises: z.array(practiceExerciseSchema).optional(),
});

export const courseSchema = z.object({
  id: kebabOrSnake,
  title: nonEmptyString,
  description: nonEmptyString,
  language: nonEmptyString,
  lessonOrder: z.array(kebabOrSnake).min(1),
  baseVocabulary: z.array(z.string()).default([]),
});

export type CourseSchemaInferred = z.infer<typeof courseSchema>;
export type LessonMetaSchemaInferred = z.infer<typeof lessonMetaSchema>;
export type PracticeExerciseSchemaInferred = z.infer<typeof practiceExerciseSchema>;
export type CompletionRuleSchemaInferred = z.infer<typeof completionRuleSchema>;
export type FunctionTestSchemaInferred = z.infer<typeof functionTestSchema>;
