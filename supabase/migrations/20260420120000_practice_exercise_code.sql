-- Phase 18b follow-up: persist in-progress practice code per exercise.
-- Prior to this column, practice exercises only stored a completed-id list
-- — the learner's WIP code was in-memory only and lost on reload. This
-- adds a jsonb bucket keyed by exerciseId, each value a file-path → content
-- map matching the shape of `last_code`.

ALTER TABLE public.lesson_progress
  ADD COLUMN practice_exercise_code jsonb NOT NULL DEFAULT '{}'::jsonb;
