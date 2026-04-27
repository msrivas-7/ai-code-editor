-- Phase 21A: per-user saved tutor messages.
--
-- A learner can star/bookmark any assistant message in the AI tutor
-- history. Saved messages render in a "Saved" accordion above live
-- history when the learner re-enters the same lesson, practice
-- exercise, or the standalone editor.
--
-- Scope semantics:
--   course_id IS NULL AND lesson_id IS NULL AND exercise_id IS NULL
--     → saved while in the standalone /editor.
--   course_id IS NOT NULL AND lesson_id IS NOT NULL AND exercise_id IS NULL
--     → saved while in lesson view (not practice).
--   course_id IS NOT NULL AND lesson_id IS NOT NULL AND exercise_id IS NOT NULL
--     → saved while in a specific practice exercise.
--
-- Reset lesson progress does NOT wipe these rows. They are personal
-- artifacts the learner curated; reset is for retrying lesson code
-- clean. The reset confirm dialog surfaces "Saved tutor messages stay."

CREATE TABLE public.saved_tutor_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id       text,
  lesson_id       text,
  exercise_id     text,
  message_id      text        NOT NULL,
  role            text        NOT NULL DEFAULT 'assistant',
  content         text        NOT NULL,
  sections        jsonb,
  model           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_tutor_role_valid     CHECK (role IN ('assistant')),
  CONSTRAINT saved_tutor_content_size   CHECK (octet_length(content) <= 64000),
  CONSTRAINT saved_tutor_scope_consistent CHECK (
    (course_id IS NULL AND lesson_id IS NULL AND exercise_id IS NULL)
    OR (course_id IS NOT NULL AND lesson_id IS NOT NULL)
  ),
  CONSTRAINT saved_tutor_unique UNIQUE (user_id, message_id)
);

CREATE INDEX idx_saved_tutor_user_scope
  ON public.saved_tutor_messages
  (user_id, course_id, lesson_id, exercise_id, created_at DESC);

CREATE TRIGGER tr_saved_tutor_messages_touch BEFORE UPDATE ON public.saved_tutor_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.saved_tutor_messages ENABLE ROW LEVEL SECURITY;

-- Service-role only via authenticated context; backend enforces user_id =
-- req.userId in every handler. RLS is defense-in-depth in case a query
-- ever runs under a user JWT instead of the service role.
CREATE POLICY saved_tutor_messages_own ON public.saved_tutor_messages
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
