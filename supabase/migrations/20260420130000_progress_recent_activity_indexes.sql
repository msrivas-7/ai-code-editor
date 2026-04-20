-- Chunk 4 nit sweep: composite indexes for "recently active" queries.
--
-- The original migration (20260420000000) indexed (user_id) alone on
-- course_progress and (user_id, course_id) on lesson_progress — both
-- adequate for per-user lookups but not for the common UI pattern
-- "show me this user's N most recent lessons across all courses",
-- which needs an ORDER BY updated_at DESC LIMIT N scan.
--
-- Adding (user_id, updated_at DESC) lets Postgres serve those queries
-- from the index alone without a sort step. Cheap to add (two small
-- btree indexes on a row count that scales with active learners) and
-- future-proof for the "resume where you left off" and
-- "learning-streak" surfaces we'll wire up soon.

CREATE INDEX idx_course_progress_user_updated
  ON public.course_progress (user_id, updated_at DESC);

CREATE INDEX idx_lesson_progress_user_updated
  ON public.lesson_progress (user_id, updated_at DESC);
