import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RingPulse } from "../../../components/cinema/RingPulse";
import { StreakChip } from "./StreakChip";

// Phase 21B: streak-extension cinematic — fires when the LessonCompletePanel
// detects prevStreak < currentStreak (streak just went up).
//
// Choreography (per /Users/mehul/.claude/plans/hazy-wishing-wren.md):
//   t=0       — chip mounts at top-right of panel showing OLD digit (priorStreak)
//   t=900ms   — RingPulse rings=3 maxScale=12 sonar (held breath: pulse, pulse, pulse)
//   t=1150ms  — vertical odometer flip on digit (-8px slide out / +8px slide in)
//   t=1300ms  — soft glow disc behind chip (bg-success/30 blur-2xl) blooms 500ms
//   Milestone (7,14,30,100,365) — bump maxScale=20 + canvas-confetti burst
//
// No sound. No haptic. Silence is louder here.
//
// Reduced-motion: digit cross-fades over 200ms; no ring, no disc, no confetti.
// Number is the message.
//
// onComplete fires at t≈2000ms so the parent can mark the cinematic as
// played (we use this to avoid double-tick if the user already qualified
// today via a code-run/tutor-question).

const HOUSE_EASE = [0.22, 1, 0.36, 1] as const;
const SONAR_DELAY_MS = 900;
const ODOMETER_DELAY_MS = 1150;
const GLOW_DELAY_MS = 1300;
const FINISH_MS = 2000;
const MILESTONES = new Set([7, 14, 30, 100, 365]);

async function fireMilestoneConfetti() {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try {
    const mod = await import("canvas-confetti");
    mod.default({
      particleCount: 80,
      spread: 70,
      origin: { x: 0.85, y: 0.18 },
      ticks: 220,
      colors: ["#34D399", "#38BDF8", "#C084FC", "#D9B269"],
    });
  } catch {
    /* swallow — confetti is decoration, not load-bearing */
  }
}

interface Props {
  /** New (post-extension) streak length. */
  current: number;
  /** Prior streak length (priorCurrent from useStreak). */
  prior: number;
  /** Fires once the cinematic completes (after FINISH_MS). Use to
   * acknowledge the extension so subsequent renders don't replay. */
  onComplete: () => void;
}

export function StreakExtensionCinematic({ current, prior, onComplete }: Props) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showOdometer, setShowOdometer] = useState(false);
  const [showGlow, setShowGlow] = useState(false);
  const isMilestone = MILESTONES.has(current);
  const isHighTier = current >= 7;
  const sonarColor = isHighTier ? "border-success/60" : "border-accent/60";
  const glowClass = isHighTier ? "bg-success/30" : "bg-accent/30";
  const sonarScale = isMilestone ? 20 : 12;

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const t1 = window.setTimeout(() => setShowOdometer(true), ODOMETER_DELAY_MS);
    const t2 = window.setTimeout(() => setShowGlow(true), GLOW_DELAY_MS);
    const t3 = window.setTimeout(() => setShowGlow(false), GLOW_DELAY_MS + 500);
    const t4 = window.setTimeout(onComplete, FINISH_MS);
    if (isMilestone) {
      window.setTimeout(() => void fireMilestoneConfetti(), SONAR_DELAY_MS + 200);
    }
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
  }, [onComplete, isMilestone]);

  if (reducedMotion) {
    // Single 200ms cross-fade between prior and current digits. No ring,
    // no glow, no confetti. The number IS the message.
    return (
      <div className="relative inline-flex" data-cinema="streak-extension">
        <StreakChip />
      </div>
    );
  }

  return (
    <div className="relative inline-flex" data-cinema="streak-extension">
      {/* Soft glow disc behind chip — blooms once at t=1300ms. */}
      <AnimatePresence>
        {showGlow && (
          <motion.div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 -z-10 rounded-full ${glowClass} blur-2xl`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.7, scale: 1.4 }}
            exit={{ opacity: 0, scale: 1.6 }}
            transition={{ duration: 0.5, ease: HOUSE_EASE }}
          />
        )}
      </AnimatePresence>

      {/* Sonar — 3 rings, MATERIAL_EASE, fires at t=900ms. */}
      <RingPulse
        anchor="self"
        rings={3}
        maxScale={sonarScale}
        borderClass={sonarColor}
        delayMs={SONAR_DELAY_MS}
      />

      {/* The chip. Until the odometer fires, render the OLD value via
          override; after, render the new value and let the digit
          flip animate via AnimatePresence on the inner span. */}
      <div className="relative">
        {!showOdometer ? (
          <StreakChip override={{ current: prior, longest: prior, isAtRisk: false, freezeActive: false }} />
        ) : (
          <StreakChip />
        )}
        {/* Odometer flash overlay — kicks the new digit into place at
            t=1150ms with a -8px → 0 vertical slide. The actual chip
            renders the new value; this overlay sells the "tick"
            instant. AnimatePresence remounts on the showOdometer flip. */}
        <AnimatePresence>
          {showOdometer && (
            <motion.span
              key={`odometer-${current}`}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 0.0 }}
              transition={{ duration: 0.24, ease: HOUSE_EASE }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
