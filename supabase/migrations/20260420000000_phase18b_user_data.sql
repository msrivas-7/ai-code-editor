-- Phase 18b: move per-user state from browser localStorage into Supabase
-- Postgres so learners keep progress + preferences across devices.
--
-- Table plan:
--   user_preferences  — persona, model, theme, onboarding flags, UI layout
--   course_progress   — one row per (user × course): status, timestamps
--   lesson_progress   — one row per (user × lesson): attempts, code snapshot
--   editor_project    — one row per user: free-form /editor mode files
--
-- Row-Level Security is defense-in-depth. The backend holds the database
-- credential and does every read/write after authMiddleware has verified the
-- Supabase JWT — so `user_id = req.userId` ownership is enforced server-side.
-- RLS means that if anyone ever wires the frontend to Postgrest directly, or
-- the backend accidentally runs a query under a user's JWT context, the db
-- still refuses cross-user reads.

CREATE TABLE public.user_preferences (
  user_id              uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  persona              text        NOT NULL DEFAULT 'intermediate',
  openai_model         text,
  theme                text        NOT NULL DEFAULT 'dark',
  welcome_done         boolean     NOT NULL DEFAULT false,
  workspace_coach_done boolean     NOT NULL DEFAULT false,
  editor_coach_done    boolean     NOT NULL DEFAULT false,
  ui_layout            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT persona_valid CHECK (persona IN ('beginner','intermediate','advanced')),
  CONSTRAINT theme_valid   CHECK (theme IN ('system','light','dark'))
);

CREATE TABLE public.course_progress (
  user_id              uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id            text        NOT NULL,
  status               text        NOT NULL DEFAULT 'not_started',
  started_at           timestamptz,
  completed_at         timestamptz,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  last_lesson_id       text,
  completed_lesson_ids text[]      NOT NULL DEFAULT '{}',
  PRIMARY KEY (user_id, course_id),
  CONSTRAINT course_status_valid CHECK (status IN ('not_started','in_progress','completed'))
);
CREATE INDEX idx_course_progress_user ON public.course_progress (user_id);

CREATE TABLE public.lesson_progress (
  user_id                uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id              text        NOT NULL,
  lesson_id              text        NOT NULL,
  status                 text        NOT NULL DEFAULT 'not_started',
  started_at             timestamptz,
  completed_at           timestamptz,
  updated_at             timestamptz NOT NULL DEFAULT now(),
  attempt_count          integer     NOT NULL DEFAULT 0,
  run_count              integer     NOT NULL DEFAULT 0,
  hint_count             integer     NOT NULL DEFAULT 0,
  time_spent_ms          bigint      NOT NULL DEFAULT 0,
  last_code              jsonb,
  last_output            text,
  practice_completed_ids text[]      NOT NULL DEFAULT '{}',
  PRIMARY KEY (user_id, course_id, lesson_id),
  CONSTRAINT lesson_status_valid CHECK (status IN ('not_started','in_progress','completed'))
);
CREATE INDEX idx_lesson_progress_user_course ON public.lesson_progress (user_id, course_id);

CREATE TABLE public.editor_project (
  user_id     uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  language    text        NOT NULL DEFAULT 'python',
  files       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  active_file text,
  open_tabs   text[]      NOT NULL DEFAULT '{}',
  file_order  text[]      NOT NULL DEFAULT '{}',
  stdin       text        NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Shared updated_at trigger so clients can always trust the column.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_user_preferences_touch BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER tr_course_progress_touch BEFORE UPDATE ON public.course_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER tr_lesson_progress_touch BEFORE UPDATE ON public.lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER tr_editor_project_touch BEFORE UPDATE ON public.editor_project
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_progress  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editor_project   ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_preferences_own ON public.user_preferences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY course_progress_own ON public.course_progress
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY lesson_progress_own ON public.lesson_progress
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY editor_project_own ON public.editor_project
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
