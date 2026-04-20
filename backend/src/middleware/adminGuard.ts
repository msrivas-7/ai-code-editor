import type { Request, Response, NextFunction } from "express";

// Placeholder admin gate. Phase 18a/18b ship without a role system — every
// authenticated user is a learner, no one is an admin. Any route that should
// *eventually* require admin privileges (catalog content mutation: adding or
// removing a lesson / course definition, bulk user ops, etc.) is wired
// through this middleware so:
//
//   1. The 403 is unambiguous — attackers and honest clients alike get the
//      same shape no matter which admin route they probe.
//   2. When we add a role system (new `profiles.role` column in Supabase, or
//      a JWT custom claim), there is exactly one place to change — the
//      current `return 403` becomes `if (req.userRole !== 'admin') return 403`.
//
// We deliberately do NOT use this on the user-scoped DELETE /courses/:courseId
// route — that endpoint resets the *caller's own* progress rows, which is a
// regular user action, not an admin one.

export function adminGuard(_req: Request, res: Response, _next: NextFunction): void {
  res.status(403).json({ error: "admin role required" });
}
