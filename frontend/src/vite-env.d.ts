/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project API URL (Phase 18a). Dev defaults to the local stack
   * on http://localhost:54321; prod is `https://<ref>.supabase.co`. */
  readonly VITE_SUPABASE_URL: string;
  /** Publishable (anon) key. Safe to ship in the bundle — the real secret
   * lives on Supabase's side and is never exposed to the browser. */
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
