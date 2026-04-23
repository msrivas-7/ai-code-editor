import { create } from "zustand";
import type { RunResult } from "../types";
import { starterStdin } from "./projectStore";
import { useAIStore } from "./aiStore";

interface RunSnapshot {
  result: RunResult | null;
  error: string | null;
  stdin: string;
}

const runCache = new Map<string, RunSnapshot>();

interface RunState {
  running: boolean;
  // runningTests mirrors the useLessonValidator local state so both the
  // global Cmd+Enter handler and the run guard can see "Check is currently
  // executing" — without it, pressing Cmd+Enter during "Checking…" fires
  // a snapshot that wipes the workspace while the test harness is still
  // reading files from it.
  runningTests: boolean;
  result: RunResult | null;
  error: string | null;
  stdin: string;
  runContext: string | null;
  setRunning: (v: boolean) => void;
  setRunningTests: (v: boolean) => void;
  setResult: (r: RunResult | null) => void;
  setError: (e: string | null) => void;
  setStdin: (v: string) => void;
  switchRunContext: (contextKey: string, defaults?: { stdin?: string }) => void;
  reset: () => void;
}

export const useRunStore = create<RunState>((set, get) => ({
  running: false,
  runningTests: false,
  result: null,
  error: null,
  stdin: starterStdin("python"),
  runContext: null,
  setRunning: (running) => set({ running }),
  setRunningTests: (runningTests) => set({ runningTests }),
  setResult: (result) => {
    set({ result, error: null });
    if (result) useAIStore.getState().noteRun();
  },
  setError: (error) => set({ error, result: null }),
  setStdin: (stdin) => set({ stdin }),
  switchRunContext: (contextKey, defaults) => {
    const state = get();
    if (state.runContext) {
      runCache.set(state.runContext, {
        result: state.result,
        error: state.error,
        stdin: state.stdin,
      });
    }

    if (state.runContext === contextKey) return;

    const saved = runCache.get(contextKey);

    set({
      runContext: contextKey,
      running: false,
      runningTests: false,
      result: saved?.result ?? null,
      error: saved?.error ?? null,
      stdin: saved?.stdin ?? defaults?.stdin ?? "",
    });
  },
  reset: () => {
    runCache.clear();
    set({
      running: false,
      runningTests: false,
      result: null,
      error: null,
      stdin: starterStdin("python"),
      runContext: null,
    });
  },
}));
