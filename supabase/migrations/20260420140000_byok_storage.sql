-- Phase 18e: move BYOK OpenAI keys out of browser localStorage and into the
-- server. Cipher + nonce live in user_preferences so every BYOK read is one
-- row lookup keyed by the already-joined user_id. Encryption is AES-256-GCM
-- keyed off BYOK_ENCRYPTION_KEY (32-byte base64) — the raw key never leaves
-- the backend, and RLS blocks cross-user reads as defense-in-depth.
--
-- Both columns nullable: absence means "user hasn't set a key" and the AI
-- routes return 400 so the frontend prompts the user to enter one.

ALTER TABLE public.user_preferences
  ADD COLUMN openai_api_key_cipher bytea,
  ADD COLUMN openai_api_key_nonce  bytea;
