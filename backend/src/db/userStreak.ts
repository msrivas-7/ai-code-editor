import { z } from "zod";
import { db } from "./client.js";
import { HttpError } from "../middleware/errorHandler.js";

// Phase 21B: per-user learning streak.
//
// Rules:
//   - "Streak day" = at least one qualifying action that UTC day:
//       * lesson completed (status flipped to 'completed')
//       * code ran successfully (run_count incremented; backend hook)
//       * substantive tutor question (POST body content ≥4 chars trimmed)
//   - Auto-freeze: 1 missed UTC day per rolling 7-day window is forgiven.
//     The chip shows a persistent frosted second arc for the rolling
//     window so grace is VISIBLE — not silent.
//   - Two missed days = streak breaks regardless of freeze state.

export interface UserStreakRow {
  current: number;
  longest: number;
  lastActiveDate: string | null;        // 'YYYY-MM-DD' (UTC)
  lastFreezeUsed: string | null;        // 'YYYY-MM-DD' (UTC)
  isActiveToday: boolean;
  isAtRisk: boolean;
  resetAtUtc: string;                   // ISO of next 00:00 UTC
  freezeActive: boolean;                // freeze used within rolling 7d → frosted arc on
  // True only on the first qualifying action of THIS UTC day; false on
  // plain GET reads or subsequent same-day actions. Frontend uses this
  // to gate the in-place chip animation.
  wasFirstToday: boolean;
  // True only on the first action of a day that came AFTER a missed
  // day, where the freeze was just consumed (transition moment for
  // the welcome-back overlay).
  freezeUsedToday: boolean;
}

const StreakRowSchema = z.object({
  user_id: z.string().uuid(),
  current_streak: z.union([z.number(), z.string()]),
  longest_streak: z.union([z.number(), z.string()]),
  last_active_date: z.date().nullable(),
  last_freeze_used: z.date().nullable(),
});

interface ParsedRow {
  userId: string;
  current: number;
  longest: number;
  lastActiveDate: Date | null;
  lastFreezeUsed: Date | null;
}

function parseRow(raw: unknown): ParsedRow {
  const parsed = StreakRowSchema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(
      500,
      `corrupt user_streak row: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  const r = parsed.data;
  return {
    userId: r.user_id,
    current: Number(r.current_streak),
    longest: Number(r.longest_streak),
    lastActiveDate: r.last_active_date,
    lastFreezeUsed: r.last_freeze_used,
  };
}

// ---------------------------------------------------------------------------
// Date helpers — all UTC, all expressed as 'YYYY-MM-DD' strings or Date(UTC midnight).
// ---------------------------------------------------------------------------

/** UTC date of `now` as a JS Date set to midnight UTC of that day. */
export function todayUtc(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Format a Date as a 'YYYY-MM-DD' UTC date string (matches Postgres `date`). */
function fmtDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Add `days` to a Date and return a new Date (UTC-midnight). */
function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

/** Number of whole UTC-day differences between two Dates (a - b). */
function dayDiff(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/** Next 00:00 UTC after `now` as ISO string. */
function nextUtcReset(now: Date = new Date()): string {
  const d = todayUtc(now);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

/** Hours remaining until next UTC midnight. */
function hoursUntilUtcReset(now: Date = new Date()): number {
  const reset = new Date(nextUtcReset(now));
  return (reset.getTime() - now.getTime()) / (60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Decay / read shape
// ---------------------------------------------------------------------------

interface DecayResult {
  current: number;
  longest: number;
  lastActiveDate: Date | null;
  lastFreezeUsed: Date | null;
  /** true if the in-memory row needed adjustment (caller writes back). */
  decayed: boolean;
}

/**
 * Apply lazy decay logic to a row IN MEMORY (no DB write). Used by both
 * the read path (so /streak reflects expired streaks) and the update
 * path (compute the post-decay baseline before deciding the new state).
 */
export function applyDecay(parsed: ParsedRow, now: Date = new Date()): DecayResult {
  const today = todayUtc(now);
  if (!parsed.lastActiveDate || parsed.current === 0) {
    return { current: 0, longest: parsed.longest, lastActiveDate: parsed.lastActiveDate, lastFreezeUsed: parsed.lastFreezeUsed, decayed: false };
  }
  const gap = dayDiff(today, parsed.lastActiveDate);
  // gap === 0 → active today; gap === 1 → active yesterday (still alive,
  // not yet extended). Either case the streak is intact as-is.
  if (gap <= 1) {
    return { current: parsed.current, longest: parsed.longest, lastActiveDate: parsed.lastActiveDate, lastFreezeUsed: parsed.lastFreezeUsed, decayed: false };
  }
  // gap >= 2 — at least one missed day. Eligible for grace ONLY IF gap === 2
  // and freeze cooldown allows. A 3+ day gap kills it regardless.
  // (Decay alone never CONSUMES a freeze — that happens inside update()
  // on the next qualifying action. Decay just decides whether to zero it.)
  if (gap === 2) {
    const freezeEligible =
      !parsed.lastFreezeUsed ||
      dayDiff(today, parsed.lastFreezeUsed) > 7;
    if (freezeEligible) {
      // Streak still alive in principle — grace will be applied on the
      // next qualifying action that fires update(). For read purposes
      // we keep the value but signal "at risk" via the route layer.
      return { current: parsed.current, longest: parsed.longest, lastActiveDate: parsed.lastActiveDate, lastFreezeUsed: parsed.lastFreezeUsed, decayed: false };
    }
  }
  // 3+ day gap, OR 2-day gap with no eligible freeze → break.
  return { current: 0, longest: parsed.longest, lastActiveDate: parsed.lastActiveDate, lastFreezeUsed: parsed.lastFreezeUsed, decayed: true };
}

function freezeActiveAtToday(parsed: ParsedRow, now: Date = new Date()): boolean {
  if (!parsed.lastFreezeUsed) return false;
  return dayDiff(todayUtc(now), parsed.lastFreezeUsed) <= 7;
}

function shapeFor(
  parsed: ParsedRow,
  decay: DecayResult,
  wasFirstToday: boolean,
  freezeUsedToday: boolean,
  now: Date = new Date(),
): UserStreakRow {
  const today = todayUtc(now);
  const isActiveToday =
    !!decay.lastActiveDate && dayDiff(today, decay.lastActiveDate) === 0;
  const hours = hoursUntilUtcReset(now);
  const isAtRisk = decay.current > 0 && !isActiveToday && hours < 4;
  return {
    current: decay.current,
    longest: decay.longest,
    lastActiveDate: decay.lastActiveDate ? fmtDate(decay.lastActiveDate) : null,
    lastFreezeUsed: decay.lastFreezeUsed ? fmtDate(decay.lastFreezeUsed) : null,
    isActiveToday,
    isAtRisk,
    resetAtUtc: nextUtcReset(now),
    freezeActive: freezeActiveAtToday({ ...parsed, lastFreezeUsed: decay.lastFreezeUsed }, now),
    wasFirstToday,
    freezeUsedToday,
  };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * GET /streak read path. Fetches the row (ensuring it exists), applies
 * lazy decay, optionally writes back if decay reduced the value, and
 * returns the public shape with wasFirstToday=false, freezeUsedToday=false.
 */
export async function getUserStreak(userId: string, now: Date = new Date()): Promise<UserStreakRow> {
  const sql = db();
  // Ensure row exists with a single UPSERT — avoids race between SELECT
  // and a missing-row INSERT in concurrent calls.
  const rows = await sql`
    INSERT INTO public.user_streak (user_id)
    VALUES (${userId})
    ON CONFLICT (user_id) DO UPDATE SET updated_at = public.user_streak.updated_at
    RETURNING user_id, current_streak, longest_streak, last_active_date, last_freeze_used
  `;
  const parsed = parseRow(rows[0]);
  const decay = applyDecay(parsed, now);
  if (decay.decayed) {
    await sql`
      UPDATE public.user_streak
         SET current_streak = ${decay.current},
             updated_at     = now()
       WHERE user_id = ${userId}
    `;
  }
  return shapeFor(parsed, decay, false, false, now);
}

// ---------------------------------------------------------------------------
// Update (write path called inline from qualifying-action handlers)
// ---------------------------------------------------------------------------

/**
 * Idempotent write. Called inline from any qualifying-action handler
 * (lesson completion PATCH, code-run, substantive tutor ask). Applies
 * the day-by-day rules:
 *
 *   gap == 0  → no-op (already active today). Returns wasFirstToday=false.
 *   gap == 1  → extend: current+=1, longest = max(longest, current). first.
 *   gap == 2 + freeze eligible → extend AND set last_freeze_used = today-1.
 *   gap == 2 + cooldown OR gap > 2 → reset: current=1.
 *   no prior row OR current=0 → set current=1.
 *
 * Returns the shaped row including wasFirstToday/freezeUsedToday so the
 * caller can include it in the API response without a follow-up read.
 */
export async function updateUserStreak(userId: string, now: Date = new Date()): Promise<UserStreakRow> {
  const sql = db();
  const today = todayUtc(now);
  const todayStr = fmtDate(today);
  const yesterday = addDays(today, -1);
  const yesterdayStr = fmtDate(yesterday);

  // SERIALIZABLE-ish: do the read+write in a transaction so concurrent
  // qualifying-actions on the same UTC day don't race the wasFirstToday
  // flag. postgres.js sql.begin uses BEGIN/COMMIT; we're not changing
  // isolation level — Postgres' default READ COMMITTED + the row-level
  // FOR UPDATE lock below is enough for this (single row per user).
  let result: UserStreakRow | null = null;
  await sql.begin(async (tx) => {
    // Ensure row exists, then lock it.
    await tx`
      INSERT INTO public.user_streak (user_id)
      VALUES (${userId})
      ON CONFLICT (user_id) DO UPDATE SET updated_at = public.user_streak.updated_at
    `;
    const rows = await tx`
      SELECT user_id, current_streak, longest_streak, last_active_date, last_freeze_used
        FROM public.user_streak
       WHERE user_id = ${userId}
       FOR UPDATE
    `;
    const parsed = parseRow(rows[0]);

    // Same-day no-op.
    if (parsed.lastActiveDate && dayDiff(today, parsed.lastActiveDate) === 0) {
      result = shapeFor(parsed, { current: parsed.current, longest: parsed.longest, lastActiveDate: parsed.lastActiveDate, lastFreezeUsed: parsed.lastFreezeUsed, decayed: false }, false, false, now);
      return;
    }

    let nextCurrent: number;
    let nextFreeze: Date | null = parsed.lastFreezeUsed;
    let freezeUsedNow = false;
    const gap = parsed.lastActiveDate ? dayDiff(today, parsed.lastActiveDate) : Infinity;

    if (parsed.current === 0 || !parsed.lastActiveDate || gap === Infinity) {
      // First-ever or post-decay zero → start fresh at Day 1.
      nextCurrent = 1;
    } else if (gap === 1) {
      nextCurrent = parsed.current + 1;
    } else if (gap === 2) {
      const freezeEligible =
        !parsed.lastFreezeUsed || dayDiff(today, parsed.lastFreezeUsed) > 7;
      if (freezeEligible) {
        nextCurrent = parsed.current + 1;
        nextFreeze = yesterday;
        freezeUsedNow = true;
      } else {
        nextCurrent = 1;
      }
    } else {
      // gap > 2 → break, restart at 1.
      nextCurrent = 1;
    }

    const nextLongest = Math.max(parsed.longest, nextCurrent);
    await tx`
      UPDATE public.user_streak
         SET current_streak   = ${nextCurrent},
             longest_streak   = ${nextLongest},
             last_active_date = ${todayStr}::date,
             last_freeze_used = ${nextFreeze ? fmtDate(nextFreeze) : null}::date,
             updated_at       = now()
       WHERE user_id = ${userId}
    `;
    void yesterdayStr; // referenced for readability; nextFreeze carries the value
    result = shapeFor(
      parsed,
      {
        current: nextCurrent,
        longest: nextLongest,
        lastActiveDate: today,
        lastFreezeUsed: nextFreeze,
        decayed: false,
      },
      true,
      freezeUsedNow,
      now,
    );
  });
  if (!result) throw new Error("updateUserStreak: transaction returned no result");
  return result;
}

// Test-only: reset for fixtures.
export async function __deleteUserStreakForTests(userId: string): Promise<void> {
  const sql = db();
  await sql`DELETE FROM public.user_streak WHERE user_id = ${userId}`;
}
