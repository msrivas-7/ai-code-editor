// Phase 20-P4: upsert + presence-check for paid_access_interest. The signal
// loop is: click → POST /api/user/paid-access-interest → this upsert →
// operator SELECTs and reaches out. No emails, no Stripe, no waitlist form.
//
// email + display_name are sourced server-side from auth.users, never from
// the client — no spoofing surface.
//
// Presence check is cached for 60 s per user, mirroring db/denylist.ts. The
// field is monotonic-once-true (only cleared by an explicit DELETE from the
// user's own withdraw action) so a stale cache entry only delays hiding the
// CTA for at most a minute — and we invalidate on every upsert/delete so the
// calling user sees the state flip instantly.

import { db } from "./client.js";

const PRESENCE_CACHE_TTL_MS = 60_000;
const presenceCache = new Map<string, { shown: boolean; expiresAt: number }>();

export async function hasShownPaidAccessInterest(userId: string): Promise<boolean> {
  const now = Date.now();
  const hit = presenceCache.get(userId);
  if (hit && hit.expiresAt > now) {
    return hit.shown;
  }
  const sql = db();
  const rows = await sql<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM public.paid_access_interest WHERE user_id = ${userId}
    ) AS exists
  `;
  const shown = rows[0]?.exists === true;
  presenceCache.set(userId, { shown, expiresAt: now + PRESENCE_CACHE_TTL_MS });
  return shown;
}

function invalidatePresence(userId: string): void {
  presenceCache.delete(userId);
}

export async function upsertPaidAccessInterest(
  userId: string,
  opts: { denylistedAtClick?: boolean } = {},
): Promise<{ clickCount: number }> {
  const sql = db();
  const rows = await sql<
    Array<{ email: string | null; display_name: string | null }>
  >`
    SELECT email,
           COALESCE(
             raw_user_meta_data->>'display_name',
             raw_user_meta_data->>'full_name',
             raw_user_meta_data->>'name'
           ) AS display_name
      FROM auth.users
     WHERE id = ${userId}
  `;
  const row = rows[0];
  if (!row || !row.email) {
    throw new Error(`[paidAccessInterest] no email on auth.users for user=${userId}`);
  }
  // `denylisted_at_click` is monotonic-once-true: set on INSERT and OR'd on
  // UPDATE so that a user denylisted-then-un-denylisted doesn't lose the
  // banned-lead signal on their next click. The column answers "was this
  // user ever denylisted at the moment of a click?" — exactly the signal the
  // operator uses to triage clean leads vs. banned-but-willing ones.
  const denylistedAtClick = opts.denylistedAtClick === true;
  const result = await sql<Array<{ click_count: number }>>`
    INSERT INTO public.paid_access_interest
      (user_id, email, display_name, denylisted_at_click)
    VALUES (${userId}, ${row.email}, ${row.display_name}, ${denylistedAtClick})
    ON CONFLICT (user_id) DO UPDATE
      SET last_clicked_at     = now(),
          click_count         = public.paid_access_interest.click_count + 1,
          email               = EXCLUDED.email,
          display_name        = EXCLUDED.display_name,
          denylisted_at_click = public.paid_access_interest.denylisted_at_click
                                OR EXCLUDED.denylisted_at_click
    RETURNING click_count
  `;
  invalidatePresence(userId);
  return { clickCount: result[0]?.click_count ?? 1 };
}

// User-initiated "I clicked by mistake / changed my mind." Deletes the row
// and invalidates the presence cache so the CTA re-appears on the next
// ai-status refetch. Operator-initiated deletes (raw SQL) only get picked up
// after the 60 s cache expiry — that's acceptable.
export async function deletePaidAccessInterest(userId: string): Promise<void> {
  const sql = db();
  await sql`
    DELETE FROM public.paid_access_interest WHERE user_id = ${userId}
  `;
  invalidatePresence(userId);
}

export function __resetPaidInterestCacheForTests(): void {
  presenceCache.clear();
}
