-- Phase 20-P5: project-wide configuration overrides.
--
-- Single key/value table for runtime-mutable system config. Today's only
-- consumers are the five free-tier caps (see Phase 20-P4 env vars in
-- backend/src/config.ts), but the JSONB value column lets us add more
-- knobs without a migration per cap.
--
-- Precedence at read time:
--   1. system_config row for the key (this table) — operator override
--   2. config.freeTier.* — env var, loaded once at boot
--
-- The env vars stay as deploy-time defaults / disaster recovery: if every
-- system_config row is wiped, the service falls back cleanly.
--
-- All writes are service-role + admin-route only. The `set_by` / `set_at`
-- / `reason` columns are the audit footprint; richer history lives in
-- admin_audit_log (separate migration in this phase).

CREATE TABLE public.system_config (
  key     text        PRIMARY KEY,
  value   jsonb       NOT NULL,
  set_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  set_at  timestamptz NOT NULL DEFAULT now(),
  reason  text        NULL CHECK (reason IS NULL OR char_length(reason) <= 500)
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Service role only. No user-facing read or write — clients have no
-- legitimate reason to know what the project caps are; the AI status
-- route (/api/user/ai-status) already exposes the *effective* values
-- they need.
