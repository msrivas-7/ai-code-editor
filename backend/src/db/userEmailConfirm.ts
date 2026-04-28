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
// Once a user IS confirmed, they remain confirmed forever — so the check
// caches per-process for the lifetime of the boot. First request after
// restart pays one DB read; subsequent requests for the same userId are O(1).

import { db } from "./client.js";

const confirmedCache = new Set<string>();

/**
 * Returns true iff `auth.users.email_confirmed_at` is non-null for the given
 * user. Result is cached forever in-process once true (a confirmed email
 * never un-confirms).
 *
 * Returns false on any error path (DB unreachable, user not found) — the
 * free-tier resolver treats false as "skip platform AI", which is the safe
 * default. The user can still BYOK regardless.
 */
export async function isEmailConfirmed(userId: string): Promise<boolean> {
  if (confirmedCache.has(userId)) return true;
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
      confirmedCache.add(userId);
      return true;
    }
    return false;
  } catch (err) {
    // DB read failed — fail closed (no platform AI). The user can still BYOK,
    // which doesn't hit this path. Logging, not throwing, so the caller's
    // hot path stays clean.
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
