import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { AmbientGlyphField } from "../components/AmbientGlyphField";
import { CinematicLighting } from "../components/cinema/CinematicLighting";
import { FilmGrain } from "../components/cinema/FilmGrain";
import { Wordmark } from "../components/Wordmark";

// Shared layout for /login, /signup, /reset-password, /auth/callback. Keeps
// the header branding + card chrome consistent across auth routes so the
// user sees the same visual frame regardless of which entry point they land
// on (direct link, redirect from RequireAuth, etc.).
//
// Phase B: pulled into the same visual language as the rest of the
// product. Previous version looked like a generic SaaS auth card —
// after the 14s cinematic, a returning user signing back in tomorrow
// hit chrome that read like a different product. Now the auth shell
// has AmbientGlyphField + scene-tier FilmGrain underfoot, the
// Wordmark is sized hero, and the form fades up on mount.
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-bg text-ink">
      <AmbientGlyphField />
      {/* Soft key light + vignette — `key-only` + `soft` intensity
          gives the auth surface a subtle warm accent glow with the
          vignette pulling the eye toward the form, without going to
          the full three-point cinematic rig (which stays scoped to
          the cinematic itself). */}
      <CinematicLighting variant="key-only" intensity="soft" />
      <FilmGrain intensity="hero" />
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-6 flex flex-col items-center gap-3">
            <Wordmark size="hero" />
            <h2 className="font-display text-[20px] font-medium tracking-tight text-ink">
              {title}
            </h2>
            {subtitle && (
              <p className="text-center text-[13px] leading-relaxed text-muted">{subtitle}</p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-panel/80 p-5 shadow-sm backdrop-blur">
            {children}
          </div>
          {footer && (
            <div className="mt-4 text-center text-[11px] text-muted">
              {footer}
            </div>
          )}
        </motion.div>
      </div>
      <footer className="relative z-10 border-t border-border bg-panel/60 px-4 py-2 text-center text-[10px] text-faint">
        CodeTutor AI © 2026 Mehul Srivastava — All rights reserved
      </footer>
    </div>
  );
}
