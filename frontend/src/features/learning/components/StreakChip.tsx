import { useStreak } from "../../../state/useStreak";

// Phase 21B: streak chip — single component, parameterized escalation.
//
// Design (per /Users/mehul/.claude/plans/hazy-wishing-wren.md "Experience-grade
// design notes — the visual metaphor"):
//
//   - Forming arc / week-ring (NOT a flame). Activity-Ring lineage.
//     One segment closes per consecutive day, capped at 7. The ring
//     "closes" at Day 7 and the integer keeps climbing.
//   - Single chip transforms by parameter (border, ink, glow, stroke
//     width); never variant-swaps.
//   - Day 0 = render nothing. Don't lecture.
//   - Day 1 = muted ember, "Day 1." (period, Fraunces). It's a name
//     tag, not a trophy.
//   - Day 3+ = accent treatment + soft glow.
//   - Day 7 (ring closes) = success treatment + brighter glow.
//   - Day 30+ = arc segments fill (no shape change).
//   - Day 100+ = inner arc inherits violet token.
//   - Day 365+ = gold hairline seam between outer success and inner violet.
//   - Freeze active = persistent frosted second concentric arc behind
//     the streak ring. Visible until the rolling 7-day window closes.
//   - At-risk = ring breathes (opacity 0.7 ↔ 1.0 sinusoid, MATERIAL_EASE,
//     2400ms loop). NO color change. Companion, not gas-station amber.
//   - Reduced-motion = static at opacity-0.85 inner shadow instead of
//     the breath; everything else identical.

const ARC_SIZE = 18; // SVG viewBox 18×18, ~16px chip glyph
const ARC_RADIUS = 7;
const ARC_CIRCUMFERENCE = 2 * Math.PI * ARC_RADIUS; // ~43.98
const SEGMENTS = 7;

interface ChipProps {
  /** Optional override for tests / Storybook-style rendering. Real callers
   * use the streak from the hook. */
  override?: {
    current: number;
    longest: number;
    isAtRisk: boolean;
    freezeActive: boolean;
  };
  /** Compact mode for crowded surfaces (lesson/editor header peer to
   * FreeTierPill). Default = full size for the dashboard. */
  compact?: boolean;
}

interface ResolvedTier {
  border: string;
  ink: string;
  glowStyle: string;
  arcStroke: number;
  arcColor: string;
  arcFill: boolean;
  innerArcColor: string | null; // Day 100+ violet inner
  hairline: boolean; // Day 365+ gold seam
  filledRing: boolean; // Day 30+ — arc segments fill
}

function resolveTier(current: number): ResolvedTier {
  if (current >= 365) {
    return {
      border: "border-success/40",
      ink: "text-ink",
      glowStyle: "0 0 18px -6px rgba(52, 211, 153, 0.32)",
      arcStroke: 1.5,
      arcColor: "rgb(52 211 153)",
      arcFill: true,
      innerArcColor: "rgb(192 132 252)",
      hairline: true,
      filledRing: true,
    };
  }
  if (current >= 100) {
    return {
      border: "border-success/35",
      ink: "text-ink",
      glowStyle: "0 0 16px -6px rgba(52, 211, 153, 0.30)",
      arcStroke: 1.5,
      arcColor: "rgb(52 211 153)",
      arcFill: true,
      innerArcColor: "rgb(192 132 252)",
      hairline: false,
      filledRing: true,
    };
  }
  if (current >= 30) {
    return {
      border: "border-success/35",
      ink: "text-ink",
      glowStyle: "0 0 16px -6px rgba(52, 211, 153, 0.30)",
      arcStroke: 1.5,
      arcColor: "rgb(52 211 153)",
      arcFill: true,
      innerArcColor: null,
      hairline: false,
      filledRing: true,
    };
  }
  if (current >= 7) {
    return {
      border: "border-success/35",
      ink: "text-ink",
      glowStyle: "0 0 16px -6px rgba(52, 211, 153, 0.30)",
      arcStroke: 1.5,
      arcColor: "rgb(52 211 153)",
      arcFill: false,
      innerArcColor: null,
      hairline: false,
      filledRing: false,
    };
  }
  if (current >= 3) {
    return {
      border: "border-accent/30",
      ink: "text-ink",
      glowStyle: "0 0 12px -6px rgba(56, 189, 248, 0.25)",
      arcStroke: 1,
      arcColor: "rgb(56 189 248)",
      arcFill: false,
      innerArcColor: null,
      hairline: false,
      filledRing: false,
    };
  }
  // Day 1–2: visible but not loud. "Day 1." with period, soft accent
  // ring + light glow so first-time users actually NOTICE the chip
  // instead of dismissing it as inactive chrome. The escalation tiers
  // above turn it up further; this is the discoverable baseline.
  return {
    border: "border-accent/30",
    ink: "text-ink",
    glowStyle: "0 0 10px -6px rgba(56, 189, 248, 0.22)",
    arcStroke: 1,
    arcColor: "rgb(56 189 248)",
    arcFill: false,
    innerArcColor: null,
    hairline: false,
    filledRing: false,
  };
}

/** Compute the SVG arc dasharray for `closedSegments / SEGMENTS` of the ring. */
function arcDashArray(closedSegments: number): string {
  const filled = (ARC_CIRCUMFERENCE * Math.min(closedSegments, SEGMENTS)) / SEGMENTS;
  const empty = ARC_CIRCUMFERENCE - filled;
  return `${filled} ${empty}`;
}

interface ArcProps {
  segmentsClosed: number;
  tier: ResolvedTier;
  freezeActive: boolean;
  isAtRisk: boolean;
}

function StreakArc({ segmentsClosed, tier, freezeActive, isAtRisk }: ArcProps) {
  return (
    <svg
      width={ARC_SIZE}
      height={ARC_SIZE}
      viewBox={`0 0 ${ARC_SIZE} ${ARC_SIZE}`}
      aria-hidden="true"
      className={`shrink-0 ${isAtRisk ? "animate-streakBreath motion-reduce:animate-none motion-reduce:opacity-[0.85]" : ""}`}
      style={{ overflow: "visible" }}
    >
      {/* Track — faint full circle so the partial arc reads as progress
          rather than a stray crescent. */}
      <circle
        cx={ARC_SIZE / 2}
        cy={ARC_SIZE / 2}
        r={ARC_RADIUS}
        fill="none"
        stroke="rgb(148 163 184 / 0.18)"
        strokeWidth={tier.arcStroke}
      />
      {/* Freeze: persistent frosted second arc behind the streak ring. */}
      {freezeActive && (
        <circle
          cx={ARC_SIZE / 2}
          cy={ARC_SIZE / 2}
          r={ARC_RADIUS - 2}
          fill="none"
          stroke="rgb(186 230 253 / 0.5)"
          strokeWidth={1}
        />
      )}
      {/* Filled segments — start from 12 o'clock, sweep clockwise. */}
      <circle
        cx={ARC_SIZE / 2}
        cy={ARC_SIZE / 2}
        r={ARC_RADIUS}
        fill={tier.arcFill ? tier.arcColor : "none"}
        fillOpacity={tier.arcFill ? 0.18 : 0}
        stroke={tier.arcColor}
        strokeWidth={tier.arcStroke}
        strokeDasharray={arcDashArray(segmentsClosed)}
        strokeDashoffset={0}
        strokeLinecap="round"
        transform={`rotate(-90 ${ARC_SIZE / 2} ${ARC_SIZE / 2})`}
      />
      {/* Day 100+: violet inner arc. */}
      {tier.innerArcColor && (
        <circle
          cx={ARC_SIZE / 2}
          cy={ARC_SIZE / 2}
          r={ARC_RADIUS - 3}
          fill="none"
          stroke={tier.innerArcColor}
          strokeWidth={1}
          strokeOpacity={0.7}
        />
      )}
      {/* Day 365: gold hairline seam between outer success + inner violet. */}
      {tier.hairline && (
        <circle
          cx={ARC_SIZE / 2}
          cy={ARC_SIZE / 2}
          r={ARC_RADIUS - 1.5}
          fill="none"
          stroke="rgb(217 178 105)"
          strokeWidth={0.6}
          strokeOpacity={0.85}
        />
      )}
    </svg>
  );
}

export function StreakChip({ override, compact }: ChipProps) {
  const { streak } = useStreak();
  const data = override
    ? { current: override.current, longest: override.longest, isAtRisk: override.isAtRisk, freezeActive: override.freezeActive }
    : streak
      ? { current: streak.current, longest: streak.longest, isAtRisk: streak.isAtRisk, freezeActive: streak.freezeActive }
      : null;

  // Day 0 — render nothing. Don't lecture.
  if (!data || data.current === 0) return null;

  const tier = resolveTier(data.current);
  const segmentsClosed = Math.min(data.current, SEGMENTS);
  // Iter-2 (post-feedback): always "{N}-day streak". The earlier "Day 1."
  // / "Day 2" minimal forms read as cryptic to first-time learners — the
  // chip in the toolbar needs to explain itself at a glance, no tooltip
  // hover required.
  const label = `${data.current}-day streak`;

  const padding = compact ? "px-1.5 py-[1px]" : "px-2 py-[1px]";
  const fontSize = compact ? "text-[10px]" : "text-[11px]";

  // Tooltip layers:
  //   - Freeze active: "Grace · yesterday held."
  //   - At-risk: "Today's lesson keeps your week going."
  //   - Default: "{N}-day streak · longest {longest}".
  const tooltip = data.freezeActive
    ? `Grace · yesterday held. Streak: ${data.current} days.`
    : data.isAtRisk
      ? `Today's lesson keeps your ${data.current}-day streak going.`
      : `${data.current}-day streak · longest ${data.longest}`;

  return (
    <span
      role="status"
      aria-label={tooltip}
      title={tooltip}
      className={`inline-flex items-center gap-1.5 rounded-full border bg-elevated/40 ${padding} ${fontSize} font-medium tabular-nums ${tier.border} ${tier.ink} transition-colors motion-reduce:transition-none`}
      style={{ boxShadow: tier.glowStyle, letterSpacing: "0.01em" }}
    >
      <StreakArc
        segmentsClosed={segmentsClosed}
        tier={tier}
        freezeActive={data.freezeActive}
        isAtRisk={data.isAtRisk}
      />
      <span>{label}</span>
      <style>{`
        @keyframes streakBreath {
          0%, 100% { opacity: 0.7; }
          50%      { opacity: 1; }
        }
        .animate-streakBreath { animation: streakBreath 2400ms cubic-bezier(0.4, 0, 0.2, 1) infinite; }
      `}</style>
    </span>
  );
}
