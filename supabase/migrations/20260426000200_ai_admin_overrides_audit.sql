-- Phase 20-P5: per-user free-tier cap overrides + admin action audit log.
--
-- Two tables in this migration because they're tightly coupled — every
-- write to ai_free_tier_overrides should produce a row in admin_audit_log
-- (the route handler is responsible for the pair, not a trigger, so we
-- can include the reason text and the actor's ID in the log).

-- ---------------------------------------------------------------------------
-- ai_free_tier_overrides
-- ---------------------------------------------------------------------------
--
-- Per-user override for the three free-tier caps. NULL on a column means
-- "use the project-wide default" (which itself may be overridden via
-- system_config or fall through to the env var). Operator can set any
-- combination — typical pattern is to set just daily_questions_cap and
-- leave the $ caps NULL.
--
-- Same RLS posture as ai_platform_denylist: service-role only, no user
-- SELECT policy. Users should not see whether they have an override
-- (prevents probing).

CREATE TABLE public.ai_free_tier_overrides (
  user_id              uuid          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_questions_cap  int           NULL CHECK (
    daily_questions_cap IS NULL
    OR (daily_questions_cap >= 0 AND daily_questions_cap <= 10000)
  ),
  daily_usd_cap        numeric(10,4) NULL CHECK (
    daily_usd_cap IS NULL
    OR (daily_usd_cap >= 0 AND daily_usd_cap <= 100)
  ),
  lifetime_usd_cap     numeric(10,4) NULL CHECK (
    lifetime_usd_cap IS NULL
    OR (lifetime_usd_cap >= 0 AND lifetime_usd_cap <= 1000)
  ),
  set_by               uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  set_at               timestamptz   NOT NULL DEFAULT now(),
  reason               text          NULL CHECK (reason IS NULL OR char_length(reason) <= 500)
);

ALTER TABLE public.ai_free_tier_overrides ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- admin_audit_log
-- ---------------------------------------------------------------------------
--
-- Append-only record of admin route writes. Both successful writes AND
-- rejected attempts go here (the latter with event_type='rejected_attempt')
-- so an admin can spot near-miss mistakes.
--
-- The before/after JSONB columns capture the cap value(s) on either side
-- of the change. For a "user_override_set" event:
--   before = { "daily_questions_cap": null, "daily_usd_cap": null, "lifetime_usd_cap": null }
--   after  = { "daily_questions_cap": 200,  "daily_usd_cap": null, "lifetime_usd_cap": null }
-- For a "system_config_set" event with key='free_tier_daily_questions':
--   before = { "value": null, "source": "env", "envDefault": 30 }
--   after  = { "value": 100, "source": "override" }
-- For "rejected_attempt": before = current value, after = the value the
-- admin tried to write, plus a `rejectionReason` field.

CREATE TABLE public.admin_audit_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type      text        NOT NULL CHECK (event_type IN (
    'user_override_set',
    'user_override_cleared',
    'system_config_set',
    'system_config_cleared',
    'denylist_added',
    'denylist_removed',
    'tab_opened',
    'rejected_attempt'
  )),
  target_user_id  uuid        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  target_key      text        NULL,
  before          jsonb       NULL,
  after           jsonb       NULL,
  reason          text        NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_recent ON public.admin_audit_log (created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role only. The admin route GET /api/admin/audit-log is the
-- only path clients use to read this; that route is gated by adminGuard.
