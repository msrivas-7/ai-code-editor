-- Phase 20-P5: Admin role mechanism via Supabase Custom Access Token Hook.
--
-- Three pieces:
--   1. `user_roles` table — operator-curated mapping of user_id → role.
--      Service-role-only writes, no SELECT policy (clients should not be
--      able to probe whether they're admin from the row directly; the JWT
--      claim is the only authoritative answer they get).
--   2. `attach_role_claim(event)` — Auth Hook function. Supabase invokes
--      it on every JWT issuance; we read user_roles and inject the role
--      into `app_metadata.role`. Critically `app_metadata` is NOT writable
--      via `supabase.auth.updateUser()` — only the service role / Auth
--      hooks can mutate it. This closes the privilege-escalation hole that
--      `user_metadata` would open.
--   3. The hook is wired in the Supabase dashboard:
--        Authentication → Hooks → Customize Access Token → public.attach_role_claim
--      (cannot be set declaratively from a migration as of Phase 20-P5).
--      See `infra/scripts/wire-auth-hook.md` for the operator runbook.

CREATE TABLE public.user_roles (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('admin')),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  reason     text NULL CHECK (reason IS NULL OR char_length(reason) <= 500)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- No SELECT policy — clients should never read this table directly. The
-- backend reads it via service role for defense-in-depth. The Auth hook
-- below also reads it, but as SECURITY DEFINER it bypasses RLS.

-- ---------------------------------------------------------------------------
-- attach_role_claim — Custom Access Token hook
-- ---------------------------------------------------------------------------
--
-- Pulls role from user_roles, injects into app_metadata.role on JWT issue.
-- If a user was demoted (row deleted), the next token strips any stale
-- claim — so the user's effective admin status drops on their next refresh
-- (typ. 1h). The backend's defense-in-depth check on user_roles closes the
-- gap during that hour.
--
-- SECURITY DEFINER runs the function as the function owner (the role
-- creating it, typ. `postgres`), bypassing RLS so the auth hook can read
-- user_roles without a service-role connection. `SET search_path = ''` is
-- the standard hardening pattern — forces the function to fully-qualify
-- every table reference, blocking search-path-poisoning attacks.
--
-- supabase_auth_admin is the role Supabase uses to invoke auth hooks; it
-- needs EXECUTE on the function for the hook to fire.

CREATE OR REPLACE FUNCTION public.attach_role_claim(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_role text;
  claims    jsonb;
BEGIN
  SELECT role INTO user_role
    FROM public.user_roles
   WHERE user_id = (event->>'user_id')::uuid;

  claims := event->'claims';

  IF user_role IS NOT NULL THEN
    -- Ensure app_metadata exists, then set role under it.
    IF claims->'app_metadata' IS NULL THEN
      claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
    END IF;
    claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(user_role));
  ELSE
    -- Demoted user: strip any stale claim. The #- operator removes the path.
    claims := claims #- '{app_metadata,role}';
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.attach_role_claim(jsonb) TO supabase_auth_admin;

-- The auth hook is wired via the Supabase Dashboard, not declaratively in
-- SQL (as of P5). Operator runbook in infra/scripts/wire-auth-hook.md.
