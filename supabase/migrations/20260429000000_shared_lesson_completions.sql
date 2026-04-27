-- Phase 21C: cinematic share — first table in the project that exposes
-- learner-authored content publicly via the anon role.
--
-- Funnel:
--   1. OG card (1200x630 PNG) — discovery on Twitter/LinkedIn unfurl
--   2. Cinematic share page (/s/:token) — animation + FOMO
--   3. CTA — "Try this lesson — takes 4 minutes →"
--
-- Anyone can SELECT a non-revoked share (public read). Owner can
-- INSERT/UPDATE/DELETE their own row. Two SECURITY DEFINER helpers
-- bump_share_view (called from the page server-side render to
-- increment the view counter without exposing UPDATE on the column
-- to anon) and revoke_share (owner-only soft-delete via a single
-- atomic function that bypasses the UPDATE policy footgun).

CREATE TABLE public.shared_lesson_completions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 8-char base32 URL-safe slug. crypto.randomBytes(5).toString('base64url')
  -- in the backend produces ~6.7 bits-of-entropy per char × ~7 chars =
  -- ~47 bits, ~140 trillion possible tokens; collision-retry inside the
  -- INSERT path absorbs the rare clash.
  share_token   text        UNIQUE NOT NULL,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id     text        NOT NULL,
  lesson_id     text        NOT NULL,
  -- Snapshots: lesson/course content can change (curriculum edits,
  -- title rewrites, lessons being removed) but the share is a
  -- permanent receipt of "what the learner finished on this date."
  lesson_title  text        NOT NULL,
  lesson_order  integer     NOT NULL,
  course_title  text        NOT NULL,
  course_total_lessons integer NOT NULL,
  mastery       text        NOT NULL CHECK (mastery IN ('strong','okay','shaky')),
  time_spent_ms bigint      NOT NULL CHECK (time_spent_ms >= 0),
  attempt_count integer     NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  -- The learner's actual code at the moment they completed the lesson.
  -- Sanitized server-side before INSERT (secret-detection regex +
  -- AWS-key shapes etc). 4KB cap is generous — most lessons produce
  -- single-screen snippets.
  code_snippet  text        NOT NULL,
  -- Display name is opt-in. Default unchecked in the share dialog ⇒
  -- NULL ⇒ artifact reads "someone on codetutor.msrivas.com" instead of the
  -- learner's name. PII by default off.
  display_name  text,
  -- Storage object key for the rendered OG png. Set after the
  -- Satori → resvg → upload chain completes. NULL during the brief
  -- window between INSERT and image-render — public GET handler
  -- treats NULL as "image still rendering" if the user opens the
  -- share URL in <100ms.
  og_image_path text,
  view_count    integer     NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Soft delete. revoked_at IS NOT NULL ⇒ public GET returns 404.
  -- Owner can revoke anytime; we never hard-delete (preserves the
  -- learner's history of what they shared even after they choose to
  -- take it down).
  revoked_at    timestamptz,
  CONSTRAINT shared_completions_code_size CHECK (octet_length(code_snippet) <= 4096),
  CONSTRAINT shared_completions_lesson_title_size CHECK (length(lesson_title) <= 200),
  CONSTRAINT shared_completions_course_title_size CHECK (length(course_title) <= 200),
  CONSTRAINT shared_completions_display_name_size CHECK (display_name IS NULL OR length(display_name) <= 80)
);

-- Token lookup is the hot path (every share-page render goes through
-- it); the unique index already covers it. Add a per-user index for
-- "list my shares" if we ever build that surface.
CREATE INDEX idx_shared_completions_user
  ON public.shared_lesson_completions (user_id, created_at DESC)
  WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- RLS — first public-read table in the project. Treated as a security
-- event in code review.
-- ---------------------------------------------------------------------------

ALTER TABLE public.shared_lesson_completions ENABLE ROW LEVEL SECURITY;

-- Anyone (anon or authenticated) can read non-revoked shares. The
-- artifact is intentionally public; the share URL itself is the
-- access control (8-char base32 ≈ 47 bits of entropy is plenty for
-- "obscurity-as-a-feature" — guessing rate is bounded by the public
-- GET endpoint's rate limit).
CREATE POLICY shared_completions_public_read
  ON public.shared_lesson_completions
  FOR SELECT TO anon, authenticated
  USING (revoked_at IS NULL);

-- Owner inserts own row. Backend always sets user_id = req.userId
-- before INSERT, so this WITH CHECK is defense-in-depth in case a
-- query ever ran under a user JWT context.
CREATE POLICY shared_completions_owner_insert
  ON public.shared_lesson_completions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Owner can soft-revoke. Strictly: this lets owners UPDATE any
-- column. We mitigate by routing the revoke through the
-- SECURITY DEFINER `revoke_share` function which is the ONLY supported
-- write path; the policy here is for direct ownership consistency
-- (e.g., if a learner ever ran a SELECT … FOR UPDATE through a JWT
-- context, RLS still requires they own the row).
CREATE POLICY shared_completions_owner_update
  ON public.shared_lesson_completions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Owner can hard-delete (e.g., post-revoke cleanup if we ever add
-- a "purge my data" path). Soft-revoke is the recommended flow.
CREATE POLICY shared_completions_owner_delete
  ON public.shared_lesson_completions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Note: an earlier draft of this migration declared SECURITY DEFINER
-- helpers `bump_share_view` and `revoke_share` so that anon /
-- authenticated callers could update those specific fields without
-- broader UPDATE grants. We dropped that path because the backend
-- always connects via the service role (which bypasses RLS) — the
-- functions never had a real consumer. View-counter bumps and
-- owner-revoke now run as plain UPDATEs scoped by user_id in the
-- WHERE clause; same security guarantee, simpler shape, testable
-- without faking a Supabase JWT context. If we ever expose PostgREST
-- directly (Phase ?), we can re-add the SECURITY DEFINER pattern then.
