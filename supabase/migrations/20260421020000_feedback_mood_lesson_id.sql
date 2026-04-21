-- Phase 20-P2: persist the lesson-end mood signal even when the learner
-- doesn't type a message. Previously the chip on LessonCompletePanel only
-- pre-seeded the FeedbackModal; if the learner didn't write anything the
-- mood was lost — which is the single highest-intent signal the chip exists
-- to harvest. This migration lets the chip insert a mood-only row directly.
--
-- Two new columns:
--   mood       text NULL — good | okay | bad when set; NULL for classic
--                          modal-submitted rows so existing analytics that
--                          assume a body still works.
--   lesson_id  text NULL — lesson-slug the mood was captured on; only set
--                          when the signal originated from the chip. Nullable
--                          for classic feedback; ≤128 chars so a hostile
--                          client can't smuggle arbitrary blobs.
--
-- Body rule is relaxed to allow empty body WHEN mood is set. The existing
-- ownership + diagnostics invariants are untouched.
--
-- Note: existing rows satisfy the new invariant because their body is
-- non-empty under the old CHECK; nothing to backfill.

ALTER TABLE public.feedback
  ADD COLUMN mood      text NULL,
  ADD COLUMN lesson_id text NULL;

ALTER TABLE public.feedback
  ADD CONSTRAINT feedback_mood_val
    CHECK (mood IS NULL OR mood IN ('good','okay','bad')),
  ADD CONSTRAINT feedback_lesson_id_len
    CHECK (lesson_id IS NULL OR char_length(lesson_id) <= 128);

-- Replace the body length check so an empty body is allowed when mood is
-- set (mood-only chip submissions). When body is non-empty, the 1..4000
-- range still applies so we don't lose the upper-bound protection.
ALTER TABLE public.feedback DROP CONSTRAINT feedback_body_len;
ALTER TABLE public.feedback
  ADD CONSTRAINT feedback_body_or_mood CHECK (
    (char_length(body) BETWEEN 1 AND 4000)
    OR (char_length(body) = 0 AND mood IS NOT NULL)
  );
