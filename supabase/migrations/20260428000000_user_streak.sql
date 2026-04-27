-- Phase 21B: per-user learning streak.
--
-- A "streak day" is any UTC day during which the user fired at least one
-- qualifying action: lesson completed, OR code ran successfully, OR a
-- substantive tutor question (≥4 chars after trim). The chip in-app
-- shows current_streak; it extends on the first qualifying action of
-- a new UTC day.
--
-- Auto-freeze grace: 1 missed UTC day per rolling 7-day window is
-- forgiven automatically — the streak survives, last_freeze_used
-- records the missed day, and the chip carries a persistent frosted
-- second arc for the rest of the rolling window so the learner SEES
-- the grace, not silent forgiveness. Two missed days = streak breaks
-- regardless of freeze state.
--
-- Schema is denormalized (current/longest/last_active_date/last_freeze_used)
-- so the StartPage chip read is O(1) instead of an aggregate scan over
-- lesson_progress on every load. updateUserStreak() in the backend is the
-- write path, called inline from any qualifying-action handler.

CREATE TABLE public.user_streak (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak   integer NOT NULL DEFAULT 0,
  longest_streak   integer NOT NULL DEFAULT 0,
  last_active_date date    NULL,
  last_freeze_used date    NULL,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_streak_current_nonneg CHECK (current_streak >= 0),
  CONSTRAINT user_streak_longest_nonneg CHECK (longest_streak >= 0),
  CONSTRAINT user_streak_longest_ge_current CHECK (longest_streak >= current_streak)
);

CREATE TRIGGER tr_user_streak_touch BEFORE UPDATE ON public.user_streak
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.user_streak ENABLE ROW LEVEL SECURITY;

-- Service-role writes (backend service-role connection) bypass RLS.
-- A SELECT policy lets the user read their own row in case we ever
-- expose direct PostgREST access — today the read goes through
-- /api/user/streak (service-role connection), but defense-in-depth.
CREATE POLICY user_streak_self_read ON public.user_streak
  FOR SELECT USING (auth.uid() = user_id);

-- One-shot backfill: walk distinct UTC completion dates per user
-- backwards from today and seed (current, longest, last_active_date).
-- Freeze state starts NULL — newly-seeded users haven't used a grace.
INSERT INTO public.user_streak (user_id, current_streak, longest_streak, last_active_date)
SELECT id, 0, 0, NULL FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Compute longest distinct-completion-date streak per user, terminating
-- as soon as a 2-day gap appears. We don't apply the rolling-7d freeze
-- in the backfill (would require per-user state machine in SQL); the
-- next live qualifying action will reconcile via updateUserStreak()
-- and self-correct any underreported value. Acceptable: backfill is
-- a floor, not a ceiling.
WITH per_user_dates AS (
  SELECT user_id, completed_at::date AS d
    FROM public.lesson_progress
   WHERE status = 'completed' AND completed_at IS NOT NULL
   GROUP BY user_id, completed_at::date
), ranked AS (
  SELECT user_id, d,
         d - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY d))::integer AS grp
    FROM per_user_dates
), streaks AS (
  SELECT user_id, MIN(d) AS run_start, MAX(d) AS run_end, COUNT(*) AS run_len
    FROM ranked
   GROUP BY user_id, grp
), longest_per_user AS (
  SELECT user_id, MAX(run_len)::integer AS longest
    FROM streaks
   GROUP BY user_id
), current_per_user AS (
  SELECT s.user_id, s.run_len::integer AS current_run, s.run_end AS last_d
    FROM streaks s
    JOIN (
      SELECT user_id, MAX(run_end) AS run_end
        FROM streaks
       GROUP BY user_id
    ) m ON m.user_id = s.user_id AND m.run_end = s.run_end
   WHERE s.run_end >= (CURRENT_DATE AT TIME ZONE 'UTC')::date - INTERVAL '1 day'
)
UPDATE public.user_streak us
   SET current_streak  = COALESCE(c.current_run, 0),
       longest_streak  = GREATEST(COALESCE(l.longest, 0), COALESCE(c.current_run, 0)),
       last_active_date = c.last_d,
       updated_at      = now()
  FROM longest_per_user l
  LEFT JOIN current_per_user c USING (user_id)
 WHERE us.user_id = l.user_id;
