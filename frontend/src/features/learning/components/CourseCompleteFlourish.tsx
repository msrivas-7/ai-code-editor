import { memo, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import type { Options as ConfettiOptions } from "canvas-confetti";

// Quiet, always-there visual signal that the course is FINISHED. Renders
// behind content (pointer-events-none, low opacity) so the lesson list
// stays readable. Two layers:
//
//   1. Golden sparkle field — a small constellation of tiny dots drifting
//      upward, similar in spirit to AmbientGlyphField but celebratory
//      (warm palette, pulse instead of drift, sparser).
//   2. A soft radial aura behind the page header, so the course title
//      feels "lit" when the course is complete.
//
// Reduced-motion honored — still rendered but with animation disabled.
// The intent is "this is complete, forever (until reset)" — so we want
// it to register statically even without motion.

const SPARKLE_COUNT = 14;

// Deterministic RNG so re-renders don't re-shuffle the constellation —
// that flicker would be more noticeable than motion itself.
function makeSparkles(seed: number) {
  const rng = (n: number) => {
    const x = Math.sin((n + seed) * 9973) * 10000;
    return x - Math.floor(x);
  };
  return Array.from({ length: SPARKLE_COUNT }, (_, i) => ({
    left: rng(i + 1) * 100,
    top: 10 + rng(i + 23) * 80, // 10–90% vertical — bias toward content area
    size: 2 + Math.floor(rng(i + 47) * 3), // 2–4 px
    delay: rng(i + 71) * 4,
    duration: 3 + rng(i + 97) * 3, // 3–6 s pulse
  }));
}

/**
 * Persistent celebration layer for a completed course. Always mounted
 * while the course is at 100% (the parent hides it when reset). Never
 * covers content — pointer-events:none, z-0, opacity tuned low.
 */
export const CourseCompleteFlourish = memo(function CourseCompleteFlourish({
  seed = 1,
}: {
  seed?: number;
}) {
  const sparkles = useMemo(() => makeSparkles(seed), [seed]);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Radial aura — warm gold, heavily blurred, behind the top of
          the page. Pulses slowly so it feels alive without animating. */}
      <motion.div
        className="absolute left-1/2 top-0 h-[420px] w-[520px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[rgb(234,179,8)] opacity-[0.08] blur-3xl"
        animate={{ opacity: [0.06, 0.12, 0.06] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Sparkle constellation. Each sparkle twinkles on its own phase. */}
      {sparkles.map((s, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-[rgb(250,204,21)]"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            boxShadow: "0 0 6px rgba(250,204,21,0.65)",
          }}
          animate={{ opacity: [0, 1, 0], scale: [0.6, 1.2, 0.6] }}
          transition={{
            duration: s.duration,
            delay: s.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
});

// Lazy-imported confetti — matches the pattern in useLessonValidator so
// the chunk is only fetched on an actual celebration, never at load.
async function fireCelebration(options: ConfettiOptions) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const mod = await import("canvas-confetti");
  mod.default(options);
}

const CELEBRATED_KEY_PREFIX = "courseComplete:celebrated:";

/**
 * First-visit burst helper. Call once from CourseOverviewPage when the
 * course transitions to pct === 100 AND the celebrated flag isn't set.
 * Also call `clearCourseCelebratedFlag(courseId)` from the reset flow
 * so a subsequent re-completion celebrates again.
 */
export function useCourseCompleteBurst({
  courseId,
  isComplete,
}: {
  courseId: string | undefined;
  isComplete: boolean;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (!courseId || !isComplete || fired.current) return;
    const key = `${CELEBRATED_KEY_PREFIX}${courseId}`;
    try {
      if (localStorage.getItem(key) === "1") return;
      localStorage.setItem(key, "1");
    } catch {
      // Private-mode localStorage throws; fine to fall through —
      // we'll just celebrate every visit for this learner.
    }
    fired.current = true;
    // Multi-wave: a center burst, then side cannons. Brand colors +
    // gold so it reads "celebration," not generic-party.
    const brandColors = [
      "#22c55e",
      "#3b82f6",
      "#a855f7",
      "#eab308",
      "#f59e0b",
      "#f472b6",
    ];
    void fireCelebration({
      particleCount: 260,
      spread: 110,
      startVelocity: 52,
      origin: { y: 0.5 },
      colors: brandColors,
    });
    window.setTimeout(() => {
      void fireCelebration({
        particleCount: 120,
        angle: 60,
        spread: 80,
        startVelocity: 62,
        origin: { x: 0, y: 0.65 },
        colors: brandColors,
      });
      void fireCelebration({
        particleCount: 120,
        angle: 120,
        spread: 80,
        startVelocity: 62,
        origin: { x: 1, y: 0.65 },
        colors: brandColors,
      });
    }, 260);
  }, [courseId, isComplete]);
}

export function clearCourseCelebratedFlag(courseId: string) {
  try {
    localStorage.removeItem(`${CELEBRATED_KEY_PREFIX}${courseId}`);
  } catch {
    /* private mode / no storage — not our problem */
  }
}
