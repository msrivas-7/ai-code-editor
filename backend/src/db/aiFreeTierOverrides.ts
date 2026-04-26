// Phase 20-P5: per-user free-tier cap overrides.
//
// Same shape as denylist's cache pattern: per-user 60s in-module cache
// invalidated on write so admin route changes are visible within the
// next minute (or immediately, if the route handler explicitly calls
// the invalidator post-write).

import { db } from "./client.js";

const CACHE_TTL_MS = 60_000;

export interface AiFreeTierOverrideRow {
  userId: string;
  dailyQuestionsCap: number | null;
  dailyUsdCap: number | null;
  lifetimeUsdCap: number | null;
  setBy: string | null;
  setAt: string;
  reason: string | null;
}

interface CacheEntry {
  row: AiFreeTierOverrideRow | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export async function getOverride(
  userId: string,
  opts: { bypassCache?: boolean } = {},
): Promise<AiFreeTierOverrideRow | null> {
  const now = Date.now();
  if (!opts.bypassCache) {
    const hit = cache.get(userId);
    if (hit && hit.expiresAt > now) return hit.row;
  }
  const sql = db();
  const rows = await sql<
    Array<{
      user_id: string;
      daily_questions_cap: number | null;
      daily_usd_cap: string | null;
      lifetime_usd_cap: string | null;
      set_by: string | null;
      set_at: Date;
      reason: string | null;
    }>
  >`
    SELECT user_id, daily_questions_cap, daily_usd_cap, lifetime_usd_cap,
           set_by, set_at, reason
      FROM public.ai_free_tier_overrides
     WHERE user_id = ${userId}
  `;
  const r = rows[0];
  // numeric(10,4) comes back as string from postgres.js by default; coerce.
  const row: AiFreeTierOverrideRow | null = r
    ? {
        userId: r.user_id,
        dailyQuestionsCap: r.daily_questions_cap,
        dailyUsdCap: r.daily_usd_cap === null ? null : Number(r.daily_usd_cap),
        lifetimeUsdCap: r.lifetime_usd_cap === null ? null : Number(r.lifetime_usd_cap),
        setBy: r.set_by,
        setAt: r.set_at.toISOString(),
        reason: r.reason,
      }
    : null;
  cache.set(userId, { row, expiresAt: now + CACHE_TTL_MS });
  return row;
}

export async function setOverride(args: {
  userId: string;
  dailyQuestionsCap: number | null;
  dailyUsdCap: number | null;
  lifetimeUsdCap: number | null;
  setBy: string;
  reason: string;
}): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO public.ai_free_tier_overrides (
      user_id, daily_questions_cap, daily_usd_cap, lifetime_usd_cap,
      set_by, set_at, reason
    ) VALUES (
      ${args.userId},
      ${args.dailyQuestionsCap},
      ${args.dailyUsdCap},
      ${args.lifetimeUsdCap},
      ${args.setBy},
      NOW(),
      ${args.reason}
    )
    ON CONFLICT (user_id) DO UPDATE
      SET daily_questions_cap = EXCLUDED.daily_questions_cap,
          daily_usd_cap       = EXCLUDED.daily_usd_cap,
          lifetime_usd_cap    = EXCLUDED.lifetime_usd_cap,
          set_by              = EXCLUDED.set_by,
          set_at              = EXCLUDED.set_at,
          reason              = EXCLUDED.reason
  `;
  cache.delete(args.userId);
}

export async function clearOverride(userId: string): Promise<void> {
  const sql = db();
  await sql`DELETE FROM public.ai_free_tier_overrides WHERE user_id = ${userId}`;
  cache.delete(userId);
}

// Test-only.
export function __resetOverrideCacheForTests(): void {
  cache.clear();
}
