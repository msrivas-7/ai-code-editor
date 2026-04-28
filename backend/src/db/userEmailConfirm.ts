// Phase 22A: defense-in-depth check that the user has clicked their
// confirmation email before we hand them platform-funded AI calls.
//
// Today Supabase's default flow refuses to issue a JWT until email_confirmed_at
// is stamped, so an unconfirmed user can't even reach the authMiddleware.
// But that's a Supabase project-config setting; if it's ever flipped (or we
// migrate auth providers), the JWT-only check leaves the platform $ caps
// exposed to email-farming attacks. This module gates the free-tier path
// against `auth.users.email_confirmed_at IS NOT NULL` regardless.
//
// Phase 22A audit: cache is TTL'd, not monotonic.
// The original "confirmed once = confirmed forever" assumption is wrong.
// Supabase's admin API can clear `email_confirmed_at` (incident response
// freeze, mass-ban, user reports compromise), and a long-lived process-
// local cache would keep granting platform AI to a frozen account until
// next restart. Cap the cache at CACHE_TTL_MS so a stale entry self-heals
// without operator action; first request after the TTL pays one DB read.

import { db } from "./client.js";
import { emailConfirmCheckFailures } from "../services/metrics.js";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

const confirmedCache = new Map<string, number>(); // userId → expiresAt

/**
 * Returns true iff `auth.users.email_confirmed_at` is non-null for the given
 * user. Result is cached for CACHE_TTL_MS once true; cache entries past their
 * expiry trigger a fresh DB read.
 *
 * Returns false on any error path (DB unreachable, user not found) — the
 * free-tier resolver treats false as "skip platform AI", which is the safe
 * default. The user can still BYOK regardless. DB-error path also bumps
 * `email_confirm_check_failures_total` so a sustained Supabase outage is
 * observable rather than silently denying free-tier AI to all users.
 */
export async function isEmailConfirmed(userId: string): Promise<boolean> {
  const now = Date.now();
  const expiresAt = confirmedCache.get(userId);
  if (expiresAt !== undefined && expiresAt > now) return true;
  if (expiresAt !== undefined) confirmedCache.delete(userId); // evict stale
  try {
    const sql = db();
    const rows = await sql<Array<{ confirmed_at: Date | null }>>`
      SELECT email_confirmed_at AS confirmed_at
        FROM auth.users
       WHERE id = ${userId}
       LIMIT 1
    `;
    const row = rows[0];
    if (!row) return false;
    if (row.confirmed_at !== null) {
      confirmedCache.set(userId, now + CACHE_TTL_MS);
      return true;
    }
    return false;
  } catch (err) {
    // DB read failed — fail closed (no platform AI). The user can still BYOK,
    // which doesn't hit this path. Logging + metric, not throwing, so the
    // caller's hot path stays clean. A sustained spike on this counter means
    // Supabase is unreachable; ops should alert before users notice.
    emailConfirmCheckFailures.inc();
    console.error(
      JSON.stringify({
        level: "error",
        evt: "email_confirm_check_failed",
        userId,
        msg: err instanceof Error ? err.message : String(err),
      }),
    );
    return false;
  }
}

/** Test-only helper to clear the cache between vitest cases. */
export function _resetEmailConfirmCacheForTests(): void {
  confirmedCache.clear();
}
