// Phase 21B: userStreak unit + integration tests. Pure-logic tests
// (applyDecay) run without a DB. updateUserStreak/getUserStreak cases
// run against the real dev DB and skip cleanly when DATABASE_URL is
// unreachable, mirroring routes/feedback.test.ts conventions.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const { db } = await import("./client.js");
const {
  applyDecay,
  todayUtc,
  getUserStreak,
  updateUserStreak,
  __deleteUserStreakForTests,
} = await import("./userStreak.js");

let dbReachable = false;
const userIds: string[] = [];

async function mkUser(): Promise<string> {
  const id = randomUUID();
  await db()`
    INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (${id}, 'authenticated', 'authenticated', ${`u-${id}@test.local`}, '{}'::jsonb, '{}'::jsonb, now(), now())
  `;
  userIds.push(id);
  return id;
}

beforeAll(async () => {
  try {
    await db()`SELECT 1`;
    await db()`SELECT 1 FROM public.user_streak LIMIT 0`;
    dbReachable = true;
  } catch {
    dbReachable = false;
  }
});

afterAll(async () => {
  if (dbReachable && userIds.length) {
    await db()`DELETE FROM public.user_streak WHERE user_id = ANY(${userIds}::uuid[])`;
    await db()`DELETE FROM auth.users WHERE id = ANY(${userIds}::uuid[])`;
  }
});

// ---------------------------------------------------------------------------
// Pure-logic unit tests — applyDecay. No DB required.
// ---------------------------------------------------------------------------

describe("applyDecay (pure logic)", () => {
  const today = todayUtc(new Date("2026-04-27T12:00:00Z"));
  const ymdToDate = (s: string) => new Date(`${s}T00:00:00Z`);

  it("zero current → returns zero, no decay flag", () => {
    const r = applyDecay(
      { userId: "u", current: 0, longest: 5, lastActiveDate: ymdToDate("2026-04-20"), lastFreezeUsed: null },
      new Date("2026-04-27T12:00:00Z"),
    );
    expect(r.current).toBe(0);
    expect(r.decayed).toBe(false);
  });

  it("active today → no change", () => {
    const r = applyDecay(
      { userId: "u", current: 3, longest: 3, lastActiveDate: today, lastFreezeUsed: null },
      new Date("2026-04-27T12:00:00Z"),
    );
    expect(r.current).toBe(3);
    expect(r.decayed).toBe(false);
  });

  it("active yesterday (gap=1) → still alive, not yet extended", () => {
    const r = applyDecay(
      { userId: "u", current: 3, longest: 3, lastActiveDate: ymdToDate("2026-04-26"), lastFreezeUsed: null },
      new Date("2026-04-27T12:00:00Z"),
    );
    expect(r.current).toBe(3);
    expect(r.decayed).toBe(false);
  });

  it("gap=2 with no prior freeze → eligible for grace, kept alive", () => {
    const r = applyDecay(
      { userId: "u", current: 3, longest: 3, lastActiveDate: ymdToDate("2026-04-25"), lastFreezeUsed: null },
      new Date("2026-04-27T12:00:00Z"),
    );
    expect(r.current).toBe(3);
    expect(r.decayed).toBe(false);
  });

  it("gap=2 with freeze used 3 days ago (cooldown) → BREAK", () => {
    const r = applyDecay(
      { userId: "u", current: 3, longest: 3, lastActiveDate: ymdToDate("2026-04-25"), lastFreezeUsed: ymdToDate("2026-04-24") },
      new Date("2026-04-27T12:00:00Z"),
    );
    expect(r.current).toBe(0);
    expect(r.decayed).toBe(true);
  });

  it("gap=2 with freeze used 8 days ago (cooldown expired) → eligible, kept alive", () => {
    const r = applyDecay(
      { userId: "u", current: 3, longest: 3, lastActiveDate: ymdToDate("2026-04-25"), lastFreezeUsed: ymdToDate("2026-04-19") },
      new Date("2026-04-27T12:00:00Z"),
    );
    expect(r.current).toBe(3);
    expect(r.decayed).toBe(false);
  });

  it("gap=3 → BREAK regardless of freeze state", () => {
    const r = applyDecay(
      { userId: "u", current: 5, longest: 5, lastActiveDate: ymdToDate("2026-04-24"), lastFreezeUsed: null },
      new Date("2026-04-27T12:00:00Z"),
    );
    expect(r.current).toBe(0);
    expect(r.decayed).toBe(true);
  });

  it("preserves longest_streak across decay", () => {
    const r = applyDecay(
      { userId: "u", current: 5, longest: 12, lastActiveDate: ymdToDate("2026-04-24"), lastFreezeUsed: null },
      new Date("2026-04-27T12:00:00Z"),
    );
    expect(r.current).toBe(0);
    expect(r.longest).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// Integration tests — updateUserStreak. Real DB.
// ---------------------------------------------------------------------------

describe("updateUserStreak (integration)", () => {
  it("first qualifying action seeds Day 1 with wasFirstToday=true", async () => {
    if (!dbReachable) return;
    const u = await mkUser();
    const r = await updateUserStreak(u);
    expect(r.current).toBe(1);
    expect(r.longest).toBe(1);
    expect(r.wasFirstToday).toBe(true);
    expect(r.freezeUsedToday).toBe(false);
    expect(r.isActiveToday).toBe(true);
  });

  it("same-day repeat returns wasFirstToday=false; values unchanged", async () => {
    if (!dbReachable) return;
    const u = await mkUser();
    await updateUserStreak(u);
    const second = await updateUserStreak(u);
    expect(second.current).toBe(1);
    expect(second.wasFirstToday).toBe(false);
    expect(second.freezeUsedToday).toBe(false);
  });

  it("consecutive day extends streak (gap=1)", async () => {
    if (!dbReachable) return;
    const u = await mkUser();
    // Seed yesterday's row directly.
    await db()`
      INSERT INTO public.user_streak (user_id, current_streak, longest_streak, last_active_date)
      VALUES (${u}, 5, 5, (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '1 day')
      ON CONFLICT (user_id) DO UPDATE
        SET current_streak = 5, longest_streak = 5,
            last_active_date = (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '1 day',
            last_freeze_used = NULL
    `;
    const r = await updateUserStreak(u);
    expect(r.current).toBe(6);
    expect(r.longest).toBe(6);
    expect(r.wasFirstToday).toBe(true);
    expect(r.freezeUsedToday).toBe(false);
  });

  it("gap=2 with freeze eligible extends streak AND records freezeUsedToday", async () => {
    if (!dbReachable) return;
    const u = await mkUser();
    await db()`
      INSERT INTO public.user_streak (user_id, current_streak, longest_streak, last_active_date, last_freeze_used)
      VALUES (${u}, 7, 7, (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '2 days', NULL)
      ON CONFLICT (user_id) DO UPDATE
        SET current_streak = 7, longest_streak = 7,
            last_active_date = (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '2 days',
            last_freeze_used = NULL
    `;
    const r = await updateUserStreak(u);
    expect(r.current).toBe(8);
    expect(r.freezeUsedToday).toBe(true);
    expect(r.lastFreezeUsed).not.toBeNull();
  });

  it("gap=2 with freeze on cooldown resets to Day 1, longest preserved", async () => {
    if (!dbReachable) return;
    const u = await mkUser();
    await db()`
      INSERT INTO public.user_streak (user_id, current_streak, longest_streak, last_active_date, last_freeze_used)
      VALUES (${u}, 5, 12, (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '2 days', (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '4 days')
      ON CONFLICT (user_id) DO UPDATE
        SET current_streak = 5, longest_streak = 12,
            last_active_date = (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '2 days',
            last_freeze_used = (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '4 days'
    `;
    const r = await updateUserStreak(u);
    expect(r.current).toBe(1);
    expect(r.longest).toBe(12);
    expect(r.freezeUsedToday).toBe(false);
  });

  it("gap=3 resets to Day 1 regardless of freeze", async () => {
    if (!dbReachable) return;
    const u = await mkUser();
    await db()`
      INSERT INTO public.user_streak (user_id, current_streak, longest_streak, last_active_date, last_freeze_used)
      VALUES (${u}, 9, 9, (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '3 days', NULL)
      ON CONFLICT (user_id) DO UPDATE
        SET current_streak = 9, longest_streak = 9,
            last_active_date = (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '3 days',
            last_freeze_used = NULL
    `;
    const r = await updateUserStreak(u);
    expect(r.current).toBe(1);
    expect(r.longest).toBe(9);
    expect(r.freezeUsedToday).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration — getUserStreak read path with lazy decay.
// ---------------------------------------------------------------------------

describe("getUserStreak (integration)", () => {
  it("returns shape with isActiveToday=false when never active", async () => {
    if (!dbReachable) return;
    const u = await mkUser();
    const r = await getUserStreak(u);
    expect(r.current).toBe(0);
    expect(r.isActiveToday).toBe(false);
    expect(r.wasFirstToday).toBe(false);
  });

  it("lazy decays a 3-day-old streak on read", async () => {
    if (!dbReachable) return;
    const u = await mkUser();
    await db()`
      INSERT INTO public.user_streak (user_id, current_streak, longest_streak, last_active_date, last_freeze_used)
      VALUES (${u}, 7, 7, (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '3 days', NULL)
      ON CONFLICT (user_id) DO UPDATE
        SET current_streak = 7, longest_streak = 7,
            last_active_date = (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '3 days',
            last_freeze_used = NULL
    `;
    const r = await getUserStreak(u);
    expect(r.current).toBe(0);
    expect(r.longest).toBe(7); // preserved
  });

  it("freezeActive flag set when last_freeze_used is within 7 days", async () => {
    if (!dbReachable) return;
    const u = await mkUser();
    await db()`
      INSERT INTO public.user_streak (user_id, current_streak, longest_streak, last_active_date, last_freeze_used)
      VALUES (${u}, 5, 5, (NOW() AT TIME ZONE 'UTC')::date, (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '2 days')
      ON CONFLICT (user_id) DO UPDATE
        SET current_streak = 5, longest_streak = 5,
            last_active_date = (NOW() AT TIME ZONE 'UTC')::date,
            last_freeze_used = (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '2 days'
    `;
    const r = await getUserStreak(u);
    expect(r.freezeActive).toBe(true);
  });
});

// Touch the helper so the import isn't tree-shaken.
void __deleteUserStreakForTests;
