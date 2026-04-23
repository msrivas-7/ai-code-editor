import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

// Session-scoped registry of "which progress bars have shimmered once".
// Reviewer flagged: shimmering every bar on every mount turned the effect
// into visual noise — navigate dashboard → course → back → course and the
// sheen fires 4x in 10s. Shimmer should mark CHANGE, not presence. We gate
// two cases:
//   1. Upward value transition (pct grew) → always shimmer.
//   2. First-ever mount for this `shimmerKey` in the current tab session
//      → shimmer once. Revisits of the same bar don't re-sheen.
// Kept in module scope so it's shared across instances but resets on page
// reload — exactly the scope we want ("first time you see this bar today").
const seenKeys = new Set<string>();

// Tab-scoped memory of "what was this bar showing when we last saw it."
// Solves the "navigate away + come back → bar re-animates from 0"
// problem. On mount, we use the remembered value as `initial` so the
// fill appears to resume from where the user left it, and only animates
// if the actual value changed since then. Tab reload resets this —
// which is the right scope (the user chose to reload; fresh state is
// expected).
const lastSeenPct = new Map<string, number>();

/**
 * Linear progress bar with an on-change shimmer overlay. Fill snaps in
 * on mount with an eased ease-out over the full width. Shimmer fires
 * only when the value moves upward OR the caller's `shimmerKey` hasn't
 * been seen in this session.
 *
 * `prefers-reduced-motion` is honored automatically by framer-motion —
 * the fill snaps to final width with zero duration when the OS flag is
 * set; the shimmer is cosmetic and also short-circuits.
 */
export function AnimatedProgressBar({
  pct,
  height = 8,
  fillClassName = "bg-accent",
  trackClassName = "bg-elevated",
  ariaLabel,
  shimmer = true,
  shimmerKey,
}: {
  pct: number; // 0-100
  height?: number;
  fillClassName?: string;
  trackClassName?: string;
  ariaLabel?: string;
  shimmer?: boolean;
  // Stable identifier the bar uses to remember "I've already shimmered
  // for this user in this session." Typically the course id +
  // some indicator of which bar this is (e.g. `course:python-fundamentals`).
  // Omit to shimmer on every mount (fallback to pre-fix behavior).
  shimmerKey?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const prevPctRef = useRef<number | null>(null);
  const [shouldShimmer, setShouldShimmer] = useState(false);
  // Read-once "what did this bar show last time we mounted" lookup, so
  // re-entering a page with existing progress resumes from there
  // instead of re-animating from 0. Captured in a ref so a later
  // re-render doesn't shift the initial frame of the animation.
  const initialPctRef = useRef<number>(
    shimmerKey ? (lastSeenPct.get(shimmerKey) ?? 0) : 0,
  );

  useEffect(() => {
    // Remember what this bar ends at so the next mount resumes from
    // there instead of animating from 0. Always written, regardless of
    // shimmer state — the resume behavior is independent of the
    // visual sheen gating below.
    if (shimmerKey) lastSeenPct.set(shimmerKey, clamped);

    if (!shimmer || clamped === 0) {
      prevPctRef.current = clamped;
      return;
    }
    const prev = prevPctRef.current;
    const isUpwardChange = prev !== null && clamped > prev;
    const isFirstSeen =
      !!shimmerKey && !seenKeys.has(shimmerKey) && prev === null;
    if (isUpwardChange || isFirstSeen) {
      setShouldShimmer(true);
      if (shimmerKey) seenKeys.add(shimmerKey);
      // Clear after the sheen's duration so repeated value updates
      // within a short window can re-fire the animation cleanly.
      const t = window.setTimeout(() => setShouldShimmer(false), 1200);
      prevPctRef.current = clamped;
      return () => window.clearTimeout(t);
    }
    prevPctRef.current = clamped;
  }, [clamped, shimmer, shimmerKey]);

  return (
    <div
      className={`relative overflow-hidden rounded-full ${trackClassName}`}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <motion.div
        className={`relative h-full rounded-full ${fillClassName}`}
        initial={{ width: `${initialPctRef.current}%` }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      >
        {shimmer && shouldShimmer && clamped > 0 && (
          <motion.span
            className="pointer-events-none absolute inset-y-0 left-0 w-1/3 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)",
            }}
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: "300%", opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.1, ease: "easeOut", times: [0, 0.1, 0.9, 1] }}
          />
        )}
      </motion.div>
    </div>
  );
}
