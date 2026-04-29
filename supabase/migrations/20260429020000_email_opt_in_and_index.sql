-- Phase 22D: streak-nudge re-engagement email.
--
-- Adds two columns to user_preferences:
--   email_opt_in              — defaults TRUE so existing users are eligible
--                               for the v1 streak nudge without a manual
--                               opt-in flow. Industry norm for transactional
--                               + retention email sent to people who
--                               affirmatively created an account.
--   last_streak_email_sent_at — populated each time the digest sweeper
--                               sends a streak nudge to a user. Acts as the
--                               idempotency guard: the daily sweep filters
--                               on `IS NULL OR < CURRENT_DATE` so a
--                               container restart mid-cron can't double-
--                               send to anyone.
--
-- Adds an index on user_streak(last_active_date) so the cron sweep query
--   WHERE s.last_active_date = (CURRENT_DATE - INTERVAL '1 day')::date
-- is an index range scan instead of a sequential table scan once the
-- user base is non-trivial. Cost: tiny — date column, low cardinality.
--
-- Unsubscribe path: GET /api/email/unsubscribe?token=<HMAC-signed>
--   → backend verifies token, sets email_opt_in = false on this row.
--   → No new audit table; the row update is the audit trail (timestamp
--     in updated_at, before/after visible via row history).

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS email_opt_in              boolean     NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_streak_email_sent_at timestamptz NULL;

-- Cron-sweep query filters on user_streak.last_active_date = yesterday-UTC.
-- Without this index, that's a Seq Scan over the entire user_streak table
-- on every daily run.
CREATE INDEX IF NOT EXISTS idx_user_streak_last_active_date
  ON public.user_streak (last_active_date);
