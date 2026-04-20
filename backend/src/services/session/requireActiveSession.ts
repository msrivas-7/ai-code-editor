import type { Response } from "express";
import { getSession } from "./sessionManager.js";
import type { SessionRecord } from "./sessionManager.js";
import type { SessionHandle } from "../execution/backends/index.js";

// All session-gated routes funnel through this helper. It enforces the
// (existence, ownership, runtime-ready) tuple in one place so a new route
// can't accidentally omit one of the checks.
//
//   404 — session id unknown (expired / cleaned up)
//   403 — session exists but was created by a different user (Phase 18a)
//   409 — session exists and is owned, but has no backend handle (teardown
//         mid-flight)
//
// Returns the session on success, or `null` after writing the response — the
// caller should early-return when it sees null.
// Narrowed view: callers can read `handle` without a null check, since
// requireActiveSession already rejected sessions without one.
export type ActiveSession = Omit<SessionRecord, "handle"> & {
  handle: SessionHandle;
};

export function requireActiveSession(
  res: Response,
  sessionId: string,
  userId: string,
): ActiveSession | null {
  const session = getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: "session not found" });
    return null;
  }
  if (session.userId !== userId) {
    res.status(403).json({ error: "session not owned by caller" });
    return null;
  }
  if (!session.handle) {
    res.status(409).json({ error: "session has no active runtime" });
    return null;
  }
  return session as ActiveSession;
}
