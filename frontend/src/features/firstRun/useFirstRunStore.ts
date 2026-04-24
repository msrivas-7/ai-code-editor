import { create } from "zustand";

// Non-persisted state for the first-run choreography. Lives in module
// scope so the state machine survives LessonPage re-renders but resets
// on full reload — exactly the scope we want. Not backed to the server;
// welcomeDone is the server-backed "first-run complete" flag, and this
// store only tracks where inside the cinematic we currently are.

export type FirstRunStep =
  | "idle"
  | "greet"
  | "awaitRun"
  | "celebrateRun"
  | "awaitEdit"
  | "correctEdit"
  | "praiseEditRun"
  | "awaitCheck"
  | "seed"
  | "done";

interface FirstRunStoreState {
  step: FirstRunStep;
  startedAt: number | null;
  /** When true, something (user action, error, timeout) has aborted the
   *  choreography. The runner hook reads this and unwinds on next tick. */
  skipped: boolean;
  /** Counter of wrong-edit runs in the awaitEdit step. The choreography
   *  reads this to decide which correction copy to surface (specific
   *  nudge on attempt 1, stronger "here's the answer" on attempt 2+). */
  wrongEditAttempts: number;
  start: () => void;
  setStep: (step: FirstRunStep) => void;
  bumpWrongEditAttempts: () => void;
  skip: () => void;
  reset: () => void;
}

export const useFirstRunStore = create<FirstRunStoreState>((set, get) => ({
  step: "idle",
  startedAt: null,
  skipped: false,
  wrongEditAttempts: 0,
  start: () => {
    if (get().step !== "idle") return; // idempotent
    set({ step: "greet", startedAt: Date.now(), skipped: false, wrongEditAttempts: 0 });
  },
  setStep: (step) => set({ step }),
  bumpWrongEditAttempts: () =>
    set({ wrongEditAttempts: get().wrongEditAttempts + 1 }),
  skip: () => set({ skipped: true, step: "done" }),
  reset: () =>
    set({ step: "idle", startedAt: null, skipped: false, wrongEditAttempts: 0 }),
}));
