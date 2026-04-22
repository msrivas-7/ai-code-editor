-- Phase 20-P4: Free AI Tier — operator-funded daily allowance for learners
-- who haven't pasted their own OpenAI key. The whole point is to remove the
-- BYOK activation cliff for first-time visitors. Three tables:
--
--   ai_usage_ledger       — append-only record of every AI call (platform or
--                           BYOK). Primary source of truth for the daily
--                           question counter, per-user $ caps, and global $
--                           circuit breaker. No prompt bodies; just metadata.
--   ai_platform_denylist  — operator's targeted kill list. One row per abuser
--                           the operator wants to block from the platform key
--                           without flipping ENABLE_FREE_TIER for everyone.
--   paid_access_interest  — one upsert per click on the exhaustion card's
--                           "Get in touch about paid access" button. This is
--                           the entire willingness-to-pay signal for Phase 1.
--                           Operator polls the table, reaches out manually.
--
-- See plan: /Users/mehul/.claude/plans/hazy-wishing-wren.md
-- Full design debate: /Users/mehul/.claude/plans/free-ai-tier.md

-- ---------------------------------------------------------------------------
-- ai_usage_ledger
-- ---------------------------------------------------------------------------
-- Append-only. Every finished AI call (ask / ask_stream / summarize) writes
-- one row. We derive today's question count, per-user daily $ spend, per-user
-- lifetime $ spend, and global daily $ spend from this single table via
-- partial indexes. Intentionally no pre-decrement / grants table in Phase 1 —
-- at ~5 DAU the non-transactional COUNT pattern is fine, and the deeper $
-- caps (Layers 2–4 in the plan) bound the concurrent-tab race's blast radius.
--
-- counts_toward_quota is false for platform /summarize calls: users never see
-- those, so we don't charge them against the visible 30/day counter. The $
-- caps still apply, so this is not an abuse bypass.
--
-- cost_usd is computed by backend/src/services/ai/pricing.ts from a price
-- table we own, NOT trusted from OpenAI's response. price_version is stamped
-- so historical rows remain interpretable after a pricing rev.
CREATE TABLE public.ai_usage_ledger (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  model               text          NOT NULL,
  funding_source      text          NOT NULL,
  route               text          NOT NULL,
  counts_toward_quota boolean       NOT NULL DEFAULT true,
  input_tokens        int           NOT NULL,
  output_tokens       int           NOT NULL,
  cost_usd            numeric(10,6) NOT NULL,
  price_version       int           NOT NULL,
  status              text          NOT NULL,
  request_id          text          NOT NULL,
  CONSTRAINT ai_usage_ledger_funding_source_val CHECK (funding_source IN ('byok','platform')),
  CONSTRAINT ai_usage_ledger_route_val          CHECK (route IN ('ask','ask_stream','summarize')),
  CONSTRAINT ai_usage_ledger_status_val         CHECK (status IN ('finish','error','aborted')),
  CONSTRAINT ai_usage_ledger_tokens_nonneg      CHECK (input_tokens >= 0 AND output_tokens >= 0),
  CONSTRAINT ai_usage_ledger_cost_nonneg        CHECK (cost_usd >= 0)
);

-- Partial indexes scoped to funding_source='platform' only. BYOK rows are
-- written for debugging but not counted against any limiter.
CREATE INDEX idx_ai_usage_ledger_platform_today
  ON public.ai_usage_ledger (user_id, created_at)
  WHERE funding_source = 'platform';

CREATE INDEX idx_ai_usage_ledger_platform_cost
  ON public.ai_usage_ledger (created_at)
  WHERE funding_source = 'platform';

CREATE INDEX idx_ai_usage_ledger_platform_user
  ON public.ai_usage_ledger (user_id)
  WHERE funding_source = 'platform';

ALTER TABLE public.ai_usage_ledger ENABLE ROW LEVEL SECURITY;

-- Learners see their own rows (for a future "your usage" surface we don't
-- ship yet). INSERT is closed to the client — only the backend service role
-- writes ledger rows on stream/request completion.
CREATE POLICY ai_usage_ledger_own_select ON public.ai_usage_ledger
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- ai_platform_denylist
-- ---------------------------------------------------------------------------
-- Operator-curated kill list. One SQL INSERT by the operator blocks a user
-- from the platform key on their next request (subject to 60s credential-
-- resolver cache). The user's BYOK path is unaffected — they can recover by
-- adding their own key.
--
-- No admin route in Phase 1 — operator writes these rows directly via the
-- Supabase dashboard or psql. Keeps the blast-radius-tightening defense
-- layer (Layer 5) cheap and hard to get wrong.
CREATE TABLE public.ai_platform_denylist (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reason     text        NOT NULL,
  denied_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_platform_denylist_reason_len CHECK (char_length(reason) BETWEEN 1 AND 500)
);

ALTER TABLE public.ai_platform_denylist ENABLE ROW LEVEL SECURITY;

-- No user-facing SELECT policy — users should never see whether they're on
-- the denylist (prevents an abuser from probing). Service role only.

-- ---------------------------------------------------------------------------
-- paid_access_interest
-- ---------------------------------------------------------------------------
-- One row per user who has clicked "Get in touch about paid access" on the
-- exhaustion card. The whole signal loop is: button click → POST route →
-- upsert here → operator queries table and reaches out manually. No email
-- sending, no Stripe, no form. Repeat clicks bump click_count and
-- last_clicked_at so the operator can prioritize by engagement.
--
-- email + display_name are captured server-side from the auth session at
-- insert time; the client doesn't submit them, so no spoofing surface.
CREATE TABLE public.paid_access_interest (
  user_id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            text        NOT NULL,
  display_name     text        NULL,
  first_clicked_at timestamptz NOT NULL DEFAULT now(),
  last_clicked_at  timestamptz NOT NULL DEFAULT now(),
  click_count      int         NOT NULL DEFAULT 1,
  notes            text        NULL,
  CONSTRAINT paid_access_interest_click_count_pos CHECK (click_count >= 1),
  CONSTRAINT paid_access_interest_email_nonempty  CHECK (char_length(email) > 0)
);

ALTER TABLE public.paid_access_interest ENABLE ROW LEVEL SECURITY;

-- Users can read their own row (so the UI can render "We've got your
-- interest" state after reload). INSERT/UPDATE are service-role-only — the
-- backend route does the upsert using auth-session-sourced email, so the
-- client has no write path that could spoof another user's interest.
CREATE POLICY paid_access_interest_own_select ON public.paid_access_interest
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
