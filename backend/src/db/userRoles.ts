// Phase 20-P5: user_roles lookups. Used by adminGuard as defense-in-depth
// against stale JWTs (a user demoted via DELETE FROM user_roles still
// carries `app_metadata.role = 'admin'` in their existing JWT for up to
// 1h until refresh — the table check closes that gap on the next admin
// route call).
//
// Cached 30s rather than the standard 60s so demotion takes effect within
// half a minute. The cache is module-local; restart-safe.

import { db } from "./client.js";

const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  role: string | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export async function getUserRole(
  userId: string,
  opts: { bypassCache?: boolean } = {},
): Promise<string | null> {
  const now = Date.now();
  if (!opts.bypassCache) {
    const hit = cache.get(userId);
    if (hit && hit.expiresAt > now) return hit.role;
  }
  const sql = db();
  const rows = await sql<Array<{ role: string }>>`
    SELECT role FROM public.user_roles WHERE user_id = ${userId}
  `;
  const role = rows[0]?.role ?? null;
  cache.set(userId, { role, expiresAt: now + CACHE_TTL_MS });
  return role;
}

export async function isAdmin(userId: string): Promise<boolean> {
  return (await getUserRole(userId)) === "admin";
}

// Test-only.
export function __resetUserRolesCacheForTests(): void {
  cache.clear();
}
