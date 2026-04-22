import { useEffect, useState } from "react";

// Phase 20-P3 Bucket 3 (#5): soft "your screen is narrow" nudge.
//
// The editor + lesson layout assumes ≥1024 px wide. On phones (< 640 px) it
// collapses to something barely usable; on tablets (640–1023 px) it's
// cramped but functional. We don't block either — users who want to push
// through on a phone can, that's their call. We just show a dismissible
// banner that explains why a laptop is better.
//
// Dismissal is sessionStorage-scoped so the warning reappears next visit —
// reminding the learner that the experience is better elsewhere is the right
// default; silently respecting a stale dismiss would be more annoying than
// useful.

const PHONE_MAX_PX = 639;
const TABLET_MAX_PX = 1023;
const DISMISS_KEY = "ui:narrow-viewport-dismissed";

type Size = "phone" | "tablet" | "wide";

function readSize(): Size {
  if (typeof window === "undefined") return "wide";
  const w = window.innerWidth;
  if (w <= PHONE_MAX_PX) return "phone";
  if (w <= TABLET_MAX_PX) return "tablet";
  return "wide";
}

export function NarrowViewportGate() {
  const [size, setSize] = useState<Size>(() => readSize());
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  });

  useEffect(() => {
    const update = () => setSize(readSize());
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (size === "wide" || dismissed) return null;

  const onDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const isPhone = size === "phone";
  const headline = isPhone
    ? "You'll have a better time on a laptop"
    : "Looking a little cramped";
  const body = isPhone
    ? "CodeTutor's editor and lessons are built for bigger screens. Things will feel squeezed on a phone — you're welcome to keep going, but a laptop or tablet will make everything easier to read and tap."
    : "The editor is designed for wider screens. Everything fits on your tablet, but panels are tight. For the best experience, open this on a laptop when you have one handy.";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-2 z-40 -translate-x-1/2 rounded-lg border border-border bg-panel/95 px-3 py-2 text-xs text-ink shadow-md backdrop-blur"
      style={{ maxWidth: "calc(100vw - 1rem)" }}
    >
      <div className="flex items-start gap-2">
        <svg
          className="mt-[2px] h-4 w-4 flex-shrink-0 text-accent"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="4" width="20" height="14" rx="2" />
          <line x1="2" y1="20" x2="22" y2="20" />
        </svg>
        <div className="flex-1">
          <p className="font-medium text-ink">{headline}</p>
          <p className="mt-0.5 text-[11px] text-muted">{body}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="ml-1 flex-shrink-0 rounded p-1 text-muted hover:bg-border/40 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
