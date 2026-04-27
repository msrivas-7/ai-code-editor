-- Phase 21C-ext: 9:16 Story-format share image. Stored alongside the
-- 1200x630 OG image so we can offer "Save for Stories" downloads in
-- the share dialog (Instagram Stories, TikTok, Snapchat — all want
-- vertical 9:16 backgrounds, not horizontal 1.91:1).
--
-- Path convention: bucket share-og/s/{token}-story.png. The OG image
-- continues to live at share-og/s/{token}.png. We store the path
-- (not the resolved public URL) because the public URL is just
-- {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path} — derivable
-- and we don't want stale URLs if the project URL ever changes.

ALTER TABLE public.shared_lesson_completions
  ADD COLUMN IF NOT EXISTS og_story_image_path text;
