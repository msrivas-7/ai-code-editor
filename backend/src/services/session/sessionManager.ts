import { nanoid } from "nanoid";
import { config } from "../../config.js";
import { HttpError } from "../../middleware/errorHandler.js";
import type {
  ExecutionBackend,
  SessionHandle,
} from "../execution/backends/index.js";

export interface SessionRecord {
  id: string;
  /**
   * Phase 18a: the Supabase user who created this session. Every mutating
   * route is gated on `record.userId === req.userId` — see
   * `requireOwnedSession`. A null userId is only produced by legacy callers
   * during tests; production code always threads the authenticated user.
   */
  userId: string;
  /**
   * Opaque runtime reference returned by the ExecutionBackend. Null only
   * during teardown. Callers that need to run code against the session MUST
   * go through `requireActiveSession` which narrows this to non-null.
   */
  handle: SessionHandle | null;
  lastSeen: number;
  createdAt: number;
  selectedModel: string | null;
}

const sessions = new Map<string, SessionRecord>();

let backend: ExecutionBackend | null = null;

/**
 * Inject the ExecutionBackend used for all session lifecycle. Must be called
 * once from the app bootstrap before any route handler runs.
 */
export function initSessionManager(b: ExecutionBackend): void {
  backend = b;
}

function requireBackend(): ExecutionBackend {
  if (!backend) {
    throw new Error(
      "session manager used before initSessionManager() — bootstrap order bug",
    );
  }
  return backend;
}

// Only accept IDs the same shape nanoid produces — prevents a client from
// pushing a path-traversal string into the workspace path.
const ID_RE = /^[A-Za-z0-9_-]{8,32}$/;

export async function startSession(
  userId: string,
  requestedId?: string,
): Promise<SessionRecord> {
  // If the frontend asks to reuse an ID (orphan recovery), honor it as long
  // as it's not already live — keeps logs coherent and the UI badge stable.
  const canReuse = requestedId && ID_RE.test(requestedId) && !sessions.has(requestedId);
  const id = canReuse ? requestedId! : nanoid(12);
  const handle = await requireBackend().createSession({ sessionId: id });
  const now = Date.now();
  const record: SessionRecord = {
    id,
    userId,
    handle,
    lastSeen: now,
    createdAt: now,
    selectedModel: null,
  };
  sessions.set(id, record);
  return record;
}

// Called by the frontend when its heartbeat discovers the session is gone.
// If the requested ID is still live (false alarm), return it untouched and
// flag `reused=true`. Otherwise provision a fresh container under the same
// ID so the UI badge and log prefixes don't change.
//
// Ownership: if a learner asks to rebind an id that is actually live under
// another user, we do NOT reveal that fact. Returning 403 would be an
// existence oracle (attacker learns the id is taken). Instead we silently
// mint a fresh nanoid, which is also what happens in the normal "not
// found" path after a container reap. The caller sees a brand-new id and
// moves on, and the real owner's session is untouched.
export async function rebindSession(
  id: string,
  userId: string,
): Promise<{ record: SessionRecord; reused: boolean }> {
  const existing = sessions.get(id);
  if (existing) {
    if (existing.userId !== userId) {
      // Mint a fresh id rather than leak existence of the other user's
      // session. `startSession` without a requestedId generates a new nanoid.
      const record = await startSession(userId);
      return { record, reused: false };
    }
    existing.lastSeen = Date.now();
    return { record: existing, reused: true };
  }
  const record = await startSession(userId, id);
  return { record, reused: false };
}

export function getSession(id: string): SessionRecord | undefined {
  return sessions.get(id);
}

/**
 * Phase 18a: canonical ownership check. Throws HttpError(404) when the
 * session is unknown, HttpError(403) when it exists but belongs to someone
 * else. Returns the record on success. Centralizing this keeps the 404-vs-
 * 403 distinction consistent across routes and makes "who owns what" a
 * single grep-point for future auditors.
 */
export function requireOwnedSession(
  id: string,
  userId: string,
): SessionRecord {
  const s = sessions.get(id);
  if (!s) throw new HttpError(404, "session not found");
  if (s.userId !== userId) throw new HttpError(403, "session not owned by caller");
  return s;
}

export function pingSession(id: string, userId: string): boolean {
  const s = sessions.get(id);
  if (!s) return false;
  if (s.userId !== userId) return false;
  s.lastSeen = Date.now();
  return true;
}

/**
 * Internal variant used by routes that have already executed the ownership
 * gate (e.g. after requireActiveSession). Skips the userId check because the
 * caller just proved ownership in the same request. Do NOT export beyond
 * this module's route layer.
 */
export function touchSession(id: string): void {
  const s = sessions.get(id);
  if (s) s.lastSeen = Date.now();
}

export async function endSession(id: string, userId: string): Promise<boolean> {
  const s = sessions.get(id);
  if (!s) return false;
  if (s.userId !== userId) throw new HttpError(403, "session not owned by caller");
  sessions.delete(id);
  if (s.handle) await requireBackend().destroy(s.handle);
  return true;
}

export async function getSessionStatus(id: string, userId: string) {
  const s = sessions.get(id);
  if (!s) return { alive: false, containerAlive: false, lastSeen: 0 };
  if (s.userId !== userId) throw new HttpError(403, "session not owned by caller");
  const containerAlive = s.handle ? await requireBackend().isAlive(s.handle) : false;
  return { alive: true, containerAlive, lastSeen: s.lastSeen };
}

export function listSessions(): SessionRecord[] {
  return [...sessions.values()];
}

export async function sweepStaleSessions(now = Date.now()): Promise<string[]> {
  const expired: SessionRecord[] = [];
  for (const s of sessions.values()) {
    if (now - s.lastSeen > config.session.idleTimeoutMs) expired.push(s);
  }
  // Internal sweep: we already know the record, so short-circuit the
  // ownership-aware endSession path and tear down directly.
  await Promise.all(
    expired.map(async (s) => {
      sessions.delete(s.id);
      if (s.handle) await requireBackend().destroy(s.handle);
    }),
  );
  return expired.map((s) => s.id);
}

let sweeper: NodeJS.Timeout | null = null;

export function startSweeper(): void {
  if (sweeper) return;
  sweeper = setInterval(async () => {
    try {
      const killed = await sweepStaleSessions();
      if (killed.length) {
        console.log(`[session-sweeper] reaped ${killed.length}: ${killed.join(", ")}`);
      }
    } catch (err) {
      console.error("[session-sweeper] error", err);
    }
  }, config.session.sweepIntervalMs);
}

export async function shutdownAllSessions(): Promise<void> {
  if (sweeper) clearInterval(sweeper);
  sweeper = null;
  const ids = [...sessions.keys()];
  await Promise.all(
    ids.map(async (id) => {
      const s = sessions.get(id);
      if (!s) return;
      sessions.delete(id);
      if (s.handle) await requireBackend().destroy(s.handle);
    }),
  );
}
