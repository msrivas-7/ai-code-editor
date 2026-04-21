import { config } from "../config.js";

// Phase 20-P0 #9: thin wrapper around Supabase's admin auth REST endpoints.
// We deliberately don't pull @supabase/supabase-js into the backend — the
// only admin action we need is deleteUser, and the REST call is two lines
// of fetch. Adding a whole SDK for that would bloat the container.
//
// The service-role key is optional: when unset (e.g. after Phase 20-P1
// drops it from the VM), `isAdminAvailable()` returns false and the
// delete-account route responds with 501. That lets us turn off
// self-service deletion without taking the backend down.

export function isAdminAvailable(): boolean {
  return (
    !!config.supabase.url &&
    !!config.supabase.serviceRoleKey &&
    config.supabase.serviceRoleKey.trim() !== ""
  );
}

function adminHeaders(): Record<string, string> {
  const key = config.supabase.serviceRoleKey;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  }
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

// DELETE /auth/v1/admin/users/{user_id}. On success the row is removed from
// auth.users and every public.* table referencing it via ON DELETE CASCADE
// drops with it — so we don't need to enumerate tables here.
export async function adminDeleteUser(userId: string): Promise<void> {
  const base = config.supabase.url;
  if (!base) throw new Error("SUPABASE_URL not configured");
  const res = await fetch(
    `${base.replace(/\/$/, "")}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    { method: "DELETE", headers: adminHeaders() },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `supabase admin deleteUser failed: ${res.status} ${text}`,
    );
  }
}
