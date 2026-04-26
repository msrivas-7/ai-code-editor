import type { Request, Response, NextFunction } from "express";
import { isAdmin as isAdminInDb } from "../db/userRoles.js";

// Phase 20-P5: real admin gate. Two checks, defense-in-depth.
//
//   1. JWT claim (fast path) — `req.userRole` is populated from the
//      `app_metadata.role` field set by the `attach_role_claim` Auth
//      Hook in Supabase. app_metadata is service-role-only writeable,
//      so a user can't grant themselves admin via supabase.auth.updateUser.
//
//   2. user_roles DB check (truth) — closes the stale-JWT window: a
//      demoted user's existing JWT carries app_metadata.role = 'admin'
//      until refresh (~1h), but their user_roles row was deleted, so
//      the next admin route call returns 403. 30s cache (in
//      backend/src/db/userRoles.ts) keeps this cheap.
//
// Order: claim first (cheap), DB check on cache miss only when the
// claim says admin (so a normal user doesn't pay the DB hit).

export async function adminGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "authentication required" });
    return;
  }
  if (req.userRole !== "admin") {
    res.status(403).json({ error: "admin role required" });
    return;
  }
  // Defense in depth: the JWT claim says admin — verify against the
  // table. If demoted, this returns false even if the cached claim
  // hasn't refreshed yet.
  try {
    const stillAdmin = await isAdminInDb(req.userId);
    if (!stillAdmin) {
      res.status(403).json({ error: "admin role required" });
      return;
    }
  } catch (err) {
    // If the DB check fails (transient), fail closed — better to lock
    // out a legitimate admin for one request than to allow a demoted
    // one through during an outage.
    console.error("[adminGuard] user_roles check failed:", (err as Error).message);
    res.status(503).json({ error: "admin gate unavailable" });
    return;
  }
  next();
}
