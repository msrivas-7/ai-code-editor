// Single source of truth for the CodeTutor AI wordmark. Replaces the
// inlined "AI" gradient-badge that was copy-pasted across 8 surfaces.
//
// Sizes map to the typography scale in tailwind.config.js:
//   hero → text-display   (48 px) — StartPage hero block
//   lg   → text-h1        (28 px) — AuthLoader + AuthShell
//   md   → text-h2        (20 px) — (reserved for marketing surfaces)
//   sm   → text-meta ↑    (14 px medium) — page headers
//
// Visual policy (review note): no gradient fill. The accent→violet
// gradient is reserved for ONE deliberately-emphasized element per
// page (e.g. the primary CTA on the dashboard welcome card). Making
// every instance of the brand name a gradient made the gradient mean
// "default emphasis" — which is the same as no emphasis at all.

import { memo } from "react";

type Size = "sm" | "md" | "lg" | "hero";

// Class map kept inline so no Tailwind-safelist config is needed.
// The `font-*` and `tracking-*` utilities are baseline Tailwind,
// available without custom theme tokens. Sizes reference the
// typography-scale tokens added in tailwind.config.js — when those
// aren't present the text- classes fall back to Tailwind's stock
// sizes, which keeps the component safe mid-refactor.
const SIZE_CLASSES: Record<Size, string> = {
  sm: "text-[14px] font-medium leading-none tracking-tight",
  md: "text-[20px] font-semibold leading-none tracking-tight",
  lg: "text-[28px] font-semibold leading-[1.1] tracking-[-0.015em]",
  hero: "text-[48px] font-semibold leading-[1.05] tracking-[-0.02em]",
};

interface WordmarkProps {
  size?: Size;
  className?: string;
  // Override the brand text if a caller has a reason (e.g. a marketing
  // surface that wants "CodeTutor" on its own). Defaults to the full
  // product name.
  label?: string;
  // Dim color used on backgrounds where `text-ink` would be too loud
  // (e.g. stacked against a hero backdrop with lots of content above).
  // Defaults to plain ink. Not gradient-capable by design.
  tone?: "ink" | "muted";
}

function WordmarkComponent({
  size = "sm",
  className = "",
  label = "CodeTutor AI",
  tone = "ink",
}: WordmarkProps) {
  const toneClass = tone === "muted" ? "text-muted" : "text-ink";
  return (
    <span
      className={`inline-block select-none ${toneClass} ${SIZE_CLASSES[size]} ${className}`}
    >
      {label}
    </span>
  );
}

export const Wordmark = memo(WordmarkComponent);
