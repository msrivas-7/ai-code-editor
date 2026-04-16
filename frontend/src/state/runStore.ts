import { create } from "zustand";
import type { RunResult } from "../types";

interface RunState {
  running: boolean;
  result: RunResult | null;
  error: string | null;
  setRunning: (v: boolean) => void;
  setResult: (r: RunResult | null) => void;
  setError: (e: string | null) => void;
  clear: () => void;
}

export const useRunStore = create<RunState>((set) => ({
  running: false,
  result: null,
  error: null,
  setRunning: (running) => set({ running }),
  setResult: (result) => set({ result, error: null }),
  setError: (error) => set({ error, result: null }),
  clear: () => set({ result: null, error: null }),
}));
