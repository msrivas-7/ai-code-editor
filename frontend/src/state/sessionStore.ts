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
  // Phase 20-P0 #6: set to true when a rebind returned reused=false — i.e.
  // the backend got a fresh container, which means any in-memory state
  // inside the runner (built artifacts, stdin buffer, uploaded files outside
  // the frontend's projectStore) is gone. The frontend's projectStore
  // re-snapshots on every Run, so the happy path survives; this flag just
  // lets us surface a one-shot dismissible notice explaining the reset.
  sessionRestarted: boolean;
  setSession: (id: string) => void;
  setPhase: (phase: SessionPhase) => void;
  setError: (err: string | null) => void;
  setSessionRestarted: (v: boolean) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  phase: "idle",
  error: null,
  sessionRestarted: false,
  setSession: (id) => set({ sessionId: id, phase: "active", error: null }),
  setPhase: (phase) => set({ phase }),
  setError: (err) => set({ error: err, phase: err ? "error" : "active" }),
  setSessionRestarted: (v) => set({ sessionRestarted: v }),
  clear: () => set({ sessionId: null, phase: "ended", error: null, sessionRestarted: false }),
}));
