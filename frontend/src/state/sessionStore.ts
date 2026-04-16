import { create } from "zustand";

export type SessionPhase =
  | "idle"
  | "starting"
  | "active"
  | "reconnecting"
  | "error"
  | "ended";

interface SessionState {
  sessionId: string | null;
  phase: SessionPhase;
  error: string | null;
  setSession: (id: string) => void;
  setPhase: (phase: SessionPhase) => void;
  setError: (err: string | null) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  phase: "idle",
  error: null,
  setSession: (id) => set({ sessionId: id, phase: "active", error: null }),
  setPhase: (phase) => set({ phase }),
  setError: (err) => set({ error: err, phase: err ? "error" : "active" }),
  clear: () => set({ sessionId: null, phase: "ended", error: null }),
}));
