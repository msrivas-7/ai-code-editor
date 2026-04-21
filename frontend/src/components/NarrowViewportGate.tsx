import { useEffect, useState } from "react";

// Phase 20-P2: the Editor + Lesson layouts pack Monaco, a file tree, an
// output panel and a tutor panel onto one screen. Below ~640px wide, the
// splitters collapse onto each other, Monaco's gutter eats the code column,
// and touch targets get ambiguous — the experience is broken, not just
// cramped. Rather than ship a bad mobile view, we gate with a full-screen
// card that explains the constraint and offers a "Continue anyway" escape
// hatch for power users who really want to poke at it on a phone.
//
// The dismissal is session-scoped (sessionStorage, not localStorage) so the
// user gets the warning again next time they land here on mobile — reminding
// them to switch devices is the right default; silently respecting a stale
// dismiss would be more annoying than useful.

const BREAKPOINT_PX = 640;
const DISMISS_KEY = "ui:narrow-viewport-dismissed";

export function NarrowViewportGate() {
  const [isNarrow, setIsNarrow] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  });

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${BREAKPOINT_PX - 1}px)`);
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (!isNarrow || dismissed) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="narrow-viewport-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/95 px-4 backdrop-blur"
    >
      <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-5 text-center shadow-lg">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <line x1="12" y1="18" x2="12" y2="18.01" />
          </svg>
        </div>
        <h2 id="narrow-viewport-title" className="text-sm font-semibold text-ink">
          Bigger screen, please
        </h2>
        <p className="mt-2 text-xs text-muted">
          The code editor and lesson panels need a laptop or tablet to be
          usable. Come back on a wider screen and you'll get the full
          experience — file tree, Monaco, tutor, and output all visible at
          once.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="mt-4 text-[11px] text-muted hover:text-ink hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Continue anyway
        </button>
      </div>
    </div>
  );
}
