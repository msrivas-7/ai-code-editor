import { useCallback, useEffect, useState } from "react";
import { api, type UserStreakResponse } from "../api/client";
import { supabase } from "../auth/supabaseClient";

// Phase 21B: learning streak hook.
//
// Module-scoped cache + subscriber set so the StartPage chip, the
// LessonPage/EditorPage header chip, and the LessonCompletePanel can
// all read the same value without each one polling its own /streak.
// Pattern matches useAIStatus.ts.
//
// `justExtended` is the derived "did the streak go up since last
// observation" signal that drives the in-place chip cinematic. We
// compute it in the hook (not the server) by comparing the current
// value to a previous-render snapshot. wasFirstToday from the server
// would also work for the first qualifying action of the day, but
// the local derivation is simpler and survives the read-path (where
// wasFirstToday is always false).

const TTL_MS = 30_000;

let cached: { at: number; value: UserStreakResponse } | null = null;
let inflight: Promise<UserStreakResponse> | null = null;
let epoch = 0;

const subscribers = new Set<(v: UserStreakResponse | null) => void>();

function setGlobal(next: UserStreakResponse | null): void {
  if (next) cached = { at: Date.now(), value: next };
  for (const fn of subscribers) fn(next);
}

async function fetchFresh(): Promise<UserStreakResponse | null> {
  if (inflight) return inflight;
  const startEpoch = epoch;
  inflight = api.getUserStreak().finally(() => {
    inflight = null;
  });
  try {
    const value = await inflight;
    if (startEpoch !== epoch) return null;
    setGlobal(value);
    return value;
  } catch {
    if (startEpoch !== epoch) return null;
    // Streak read failures are non-fatal — the chip just doesn't render
    // (component returns null at current=0). No fallback shape needed.
    return null;
  }
}

/** Force a refetch — call after a qualifying action resolves. */
export function invalidateStreak(): void {
  cached = null;
  inflight = null;
  void fetchFresh();
}

// Sign-out / token-refresh epoch bump matches useAIStatus.
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
    epoch++;
    cached = null;
    inflight = null;
    if (event === "SIGNED_OUT") {
      for (const fn of subscribers) fn(null);
    }
  }
});

export interface UseStreakResult {
  streak: UserStreakResponse | null;
  /** Computed: true when current > prior current (local snapshot). The hook's
   * caller resets this by calling acknowledgeExtension() after firing the
   * cinematic. */
  justExtended: boolean;
  acknowledgeExtension: () => void;
  refetch: () => void;
}

export function useStreak(): UseStreakResult {
  const [streak, setStreak] = useState<UserStreakResponse | null>(() => {
    if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
    return null;
  });
  // Snapshot of last-observed `current` per component instance. We
  // compare on each update; if the new current > snapshot, the chip
  // animates and the caller should ack to clear the flag.
  const [priorCurrent, setPriorCurrent] = useState<number | null>(null);

  useEffect(() => {
    subscribers.add(setStreak);
    if (!cached || Date.now() - cached.at >= TTL_MS) {
      void fetchFresh();
    }
    return () => {
      subscribers.delete(setStreak);
    };
  }, []);

  // Initialize priorCurrent the first time we see a streak value.
  useEffect(() => {
    if (streak && priorCurrent === null) {
      setPriorCurrent(streak.current);
    }
  }, [streak, priorCurrent]);

  const justExtended =
    streak !== null && priorCurrent !== null && streak.current > priorCurrent;

  const acknowledgeExtension = useCallback(() => {
    if (streak) setPriorCurrent(streak.current);
  }, [streak]);

  const refetch = useCallback(() => {
    cached = null;
    inflight = null;
    void fetchFresh();
  }, []);

  return { streak, justExtended, acknowledgeExtension, refetch };
}
