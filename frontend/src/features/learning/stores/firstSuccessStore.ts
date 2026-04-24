import { create } from "zustand";

// Cinema Kit — session-scoped "first-successful-run" tracker.
//
// The beat: every time a learner gets their first zero-exit run on a
// lesson, fire a tiny celebration in the output panel (single green
// RingPulse + panel-border glow + micro-confetti). The tracker is
// per-lesson, per-browser-tab. Resets on reload — which is fine and
// arguably right: a learner reloading a lesson is starting a session
// and the next successful run is a fresh moment for THEM.
//
// Intentionally not server-backed. Adding a `first_successful_run_at`
// column to `lesson_progress` would be the "correct" persistence,
// but it requires a migration to both dev + prod and the UX loss
// under reload (one extra celebration in rare cases) doesn't earn
// that cost. Revisit if the celebration ever feels repetitive.
//
// Shape: a `Set` of composite keys `${courseId}/${lessonId}`. Signal
// for consumers: `celebrationNonce` bumps each time we mark a new
// first-success so an effect can react without reading the Set.

interface FirstSuccessState {
  celebrated: Set<string>;
  /** Increments on every NEW first-success. Consumers watch this and
   *  key a RingPulse / confetti off it. */
  celebrationNonce: number;
  /** Composite key of the most recent celebration target (for the
   *  consumer to confirm it's celebrating the right lesson). */
  lastCelebratedKey: string | null;
  /** Returns true if this call was the first-success for the lesson;
   *  false if already celebrated in this session. Idempotent — a
   *  second call for the same key is a no-op. */
  markIfFirst: (courseId: string, lessonId: string) => boolean;
}

const composite = (courseId: string, lessonId: string) =>
  `${courseId}/${lessonId}`;

export const useFirstSuccessStore = create<FirstSuccessState>((set, get) => ({
  celebrated: new Set<string>(),
  celebrationNonce: 0,
  lastCelebratedKey: null,
  markIfFirst: (courseId, lessonId) => {
    const key = composite(courseId, lessonId);
    const { celebrated } = get();
    if (celebrated.has(key)) return false;
    const next = new Set(celebrated);
    next.add(key);
    set({
      celebrated: next,
      celebrationNonce: get().celebrationNonce + 1,
      lastCelebratedKey: key,
    });
    return true;
  },
}));
