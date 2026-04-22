// Phase 20-P4: ai_platform_denylist lookups. One indexed PK read per
// credential resolution is cheap, but it's on the hot path of every AI
// request — a 60s in-memory cache collapses the QPS into ~1/min per user
// without making an operator's SQL INSERT wait longer than a minute to
// take effect. If they need an immediate kill, restart backend (the cache
// is module-local and does not survive process restart).

import { db } from "./client.js";

const CACHE_TTL_MS = 60_000;

// Map<userId, { denied: boolean; expiresAt: epochMs }>. Per-user instead of
// a single global "denylist set" snapshot so we only pay the DB hit for
// active users, not for every row in the table.
const cache = new Map<string, { denied: boolean; expiresAt: number }>();

export async function isDenylisted(
  userId: string,
  opts: { bypassCache?: boolean } = {},
): Promise<boolean> {
  const now = Date.now();
  if (!opts.bypassCache) {
    const hit = cache.get(userId);
    if (hit && hit.expiresAt > now) {
      return hit.denied;
    }
  }
  const sql = db();
  const rows = await sql<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM public.ai_platform_denylist WHERE user_id = ${userId}
    ) AS exists
  `;
  const denied = rows[0]?.exists === true;
  // Always write-through even on bypass so subsequent cached readers see
  // the freshest state without waiting for the TTL to expire.
  cache.set(userId, { denied, expiresAt: now + CACHE_TTL_MS });
  return denied;
}

// Test-only: reset the cache between specs so one test's positive result
// doesn't leak into another's "user is clean" expectation.
export function __resetDenylistCacheForTests(): void {
  cache.clear();
}
