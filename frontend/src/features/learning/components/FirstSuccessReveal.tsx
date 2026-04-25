import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useFirstSuccessStore } from "../stores/firstSuccessStore";

// Phase B — the first-success delivery beat.
//
// The cinematic is the *promise*. The first time the learner's own
// code lands a clean run is the *delivery*. This component covers
// that moment quietly: a brief workspace vignette pulsing in over
// 200 ms, holding 600 ms, then releasing over 600 ms. The workspace
// stays rendered underneath; only the corners darken, drawing the
// eye inward toward the output panel where the result has just
// landed. The lesson-complete celebration handles the bigger payoff
// later when Check passes.
//
// Reduced motion: skip the vignette entirely.

const PULSE_IN_MS = 200;
const HOLD_MS = 600;
const PULSE_OUT_MS = 600;
const TOTAL_MS = PULSE_IN_MS + HOLD_MS + PULSE_OUT_MS;

export function FirstSuccessReveal() {
  const reduce = useReducedMotion();
  const celebrationNonce = useFirstSuccessStore((s) => s.celebrationNonce);
  const [activeKey, setActiveKey] = useState<number>(0);

  // Snapshot the nonce at mount so we don't fire on a stale value
  // from a prior lesson. Same pattern as OutputPanel's ring guard.
  const [nonceAtMount] = useState<number>(celebrationNonce);

  useEffect(() => {
    if (celebrationNonce <= nonceAtMount) return;
    setActiveKey(celebrationNonce);
    const t = window.setTimeout(() => setActiveKey(0), TOTAL_MS);
    return () => window.clearTimeout(t);
  }, [celebrationNonce, nonceAtMount]);

  if (!activeKey || reduce) return null;

  return (
    <motion.div
      key={activeKey}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[40]"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{
        duration: TOTAL_MS / 1000,
        times: [
          0,
          PULSE_IN_MS / TOTAL_MS,
          (PULSE_IN_MS + HOLD_MS) / TOTAL_MS,
          1,
        ],
        ease: [0.22, 1, 0.36, 1],
      }}
      style={{
        background:
          "radial-gradient(ellipse at center, transparent 35%, rgb(0 0 0 / 0.55) 100%)",
      }}
    />
  );
}
