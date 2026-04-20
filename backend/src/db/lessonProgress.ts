import type { JSONValue } from "postgres";
import { db } from "./client.js";

export interface LessonProgress {
  courseId: string;
  lessonId: string;
  status: "not_started" | "in_progress" | "completed";
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  attemptCount: number;
  runCount: number;
  hintCount: number;
  timeSpentMs: number;
  lastCode: Record<string, unknown> | null;
  lastOutput: string | null;
  practiceCompletedIds: string[];
  // Per-exercise WIP code snapshots. Keyed by exerciseId → file-path map.
  // Distinct from `lastCode` so entering/leaving practice mode doesn't
  // clobber the main lesson buffer.
  practiceExerciseCode: Record<string, Record<string, string>>;
}

interface Row {
  course_id: string;
  lesson_id: string;
  status: string;
  started_at: Date | null;
  completed_at: Date | null;
  updated_at: Date;
  attempt_count: number;
  run_count: number;
  hint_count: number;
  time_spent_ms: string | number;
  last_code: Record<string, unknown> | null;
  last_output: string | null;
  practice_completed_ids: string[];
  practice_exercise_code: Record<string, Record<string, string>> | null;
}

function rowToLesson(r: Row): LessonProgress {
  return {
    courseId: r.course_id,
    lessonId: r.lesson_id,
    status: r.status as LessonProgress["status"],
    startedAt: r.started_at ? r.started_at.toISOString() : null,
    completedAt: r.completed_at ? r.completed_at.toISOString() : null,
    updatedAt: r.updated_at.toISOString(),
    attemptCount: Number(r.attempt_count),
    runCount: Number(r.run_count),
    hintCount: Number(r.hint_count),
    timeSpentMs: Number(r.time_spent_ms),
    lastCode: r.last_code,
    lastOutput: r.last_output,
    practiceCompletedIds: r.practice_completed_ids ?? [],
    practiceExerciseCode: r.practice_exercise_code ?? {},
  };
}

export async function listLessonProgress(
  userId: string,
  courseId?: string,
): Promise<LessonProgress[]> {
  const sql = db();
  const rows = courseId
    ? await sql<Row[]>`
        SELECT course_id, lesson_id, status, started_at, completed_at,
               updated_at, attempt_count, run_count, hint_count,
               time_spent_ms, last_code, last_output, practice_completed_ids,
               practice_exercise_code
          FROM public.lesson_progress
         WHERE user_id = ${userId} AND course_id = ${courseId}
      `
    : await sql<Row[]>`
        SELECT course_id, lesson_id, status, started_at, completed_at,
               updated_at, attempt_count, run_count, hint_count,
               time_spent_ms, last_code, last_output, practice_completed_ids,
               practice_exercise_code
          FROM public.lesson_progress
         WHERE user_id = ${userId}
      `;
  return rows.map(rowToLesson);
}

export interface LessonPatch {
  status?: LessonProgress["status"];
  startedAt?: string | null;
  completedAt?: string | null;
  attemptCount?: number;
  runCount?: number;
  hintCount?: number;
  timeSpentMs?: number;
  lastCode?: Record<string, unknown> | null;
  lastOutput?: string | null;
  practiceCompletedIds?: string[];
  practiceExerciseCode?: Record<string, Record<string, string>>;
}

export async function upsertLessonProgress(
  userId: string,
  courseId: string,
  lessonId: string,
  patch: LessonPatch,
): Promise<LessonProgress> {
  const sql = db();
  const lastCodeJson =
    patch.lastCode === undefined
      ? null
      : sql.json((patch.lastCode ?? null) as JSONValue);
  const practiceCodeJson =
    patch.practiceExerciseCode === undefined
      ? null
      : sql.json(patch.practiceExerciseCode as JSONValue);
  const rows = await sql<Row[]>`
    INSERT INTO public.lesson_progress (
      user_id, course_id, lesson_id, status, started_at, completed_at,
      attempt_count, run_count, hint_count, time_spent_ms,
      last_code, last_output, practice_completed_ids, practice_exercise_code
    )
    VALUES (
      ${userId},
      ${courseId},
      ${lessonId},
      ${patch.status ?? "not_started"},
      ${patch.startedAt ?? null},
      ${patch.completedAt ?? null},
      ${patch.attemptCount ?? 0},
      ${patch.runCount ?? 0},
      ${patch.hintCount ?? 0},
      ${patch.timeSpentMs ?? 0},
      ${patch.lastCode === undefined ? null : sql.json((patch.lastCode ?? null) as JSONValue)},
      ${patch.lastOutput ?? null},
      ${patch.practiceCompletedIds ?? []},
      ${patch.practiceExerciseCode === undefined ? sql.json({} as JSONValue) : sql.json(patch.practiceExerciseCode as JSONValue)}
    )
    ON CONFLICT (user_id, course_id, lesson_id) DO UPDATE SET
      status                 = COALESCE(${patch.status ?? null}, public.lesson_progress.status),
      started_at             = CASE WHEN ${patch.startedAt !== undefined} THEN ${patch.startedAt ?? null}::timestamptz ELSE public.lesson_progress.started_at END,
      completed_at           = CASE WHEN ${patch.completedAt !== undefined} THEN ${patch.completedAt ?? null}::timestamptz ELSE public.lesson_progress.completed_at END,
      attempt_count          = COALESCE(${patch.attemptCount ?? null}, public.lesson_progress.attempt_count),
      run_count              = COALESCE(${patch.runCount ?? null}, public.lesson_progress.run_count),
      hint_count             = COALESCE(${patch.hintCount ?? null}, public.lesson_progress.hint_count),
      time_spent_ms          = COALESCE(${patch.timeSpentMs ?? null}, public.lesson_progress.time_spent_ms),
      last_code              = CASE WHEN ${patch.lastCode !== undefined} THEN ${lastCodeJson} ELSE public.lesson_progress.last_code END,
      last_output            = CASE WHEN ${patch.lastOutput !== undefined} THEN ${patch.lastOutput ?? null} ELSE public.lesson_progress.last_output END,
      practice_completed_ids = COALESCE(${patch.practiceCompletedIds ?? null}, public.lesson_progress.practice_completed_ids),
      practice_exercise_code = CASE WHEN ${patch.practiceExerciseCode !== undefined} THEN ${practiceCodeJson} ELSE public.lesson_progress.practice_exercise_code END,
      updated_at             = now()
    RETURNING course_id, lesson_id, status, started_at, completed_at,
              updated_at, attempt_count, run_count, hint_count,
              time_spent_ms, last_code, last_output, practice_completed_ids,
              practice_exercise_code
  `;
  return rowToLesson(rows[0]);
}

export async function deleteLessonProgress(
  userId: string,
  courseId: string,
  lessonId?: string,
): Promise<number> {
  const sql = db();
  const rows = lessonId
    ? await sql`
        DELETE FROM public.lesson_progress
         WHERE user_id = ${userId}
           AND course_id = ${courseId}
           AND lesson_id = ${lessonId}
         RETURNING lesson_id
      `
    : await sql`
        DELETE FROM public.lesson_progress
         WHERE user_id = ${userId} AND course_id = ${courseId}
         RETURNING lesson_id
      `;
  return rows.length;
}
