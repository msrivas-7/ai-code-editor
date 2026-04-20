import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { config } from "../config.js";

/**
 * Per-IP (or per-user, Phase 18a) rate limits for mutating routes.
 *
 * Fixes H-A2: before Phase 17, only `/api/ai/*` was throttled. A learner
 * (or a rogue script on a page they visited — see H-A3 / csrfGuard) could
 * POST `/api/session` in a tight loop and spawn thousands of runner
 * containers before the socket-proxy PidsLimit / Docker daemon capped out.
 *
 * Phase 18a update: when a request is authenticated, `mutationLimit` keys
 * on `user:<userId>` so two logins at the same NAT (family router, school
 * lab) don't starve each other. Unauthenticated mutations fall back to the
 * IP bucket — currently only happens during the narrow pre-auth window
 * before tokens are attached, or in tests with no auth mounted.
 *
 * `sessionCreateLimit` stays IP-keyed on purpose: a would-be abuser can
 * sign up N accounts to get N user buckets, so we need an IP floor on the
 * expensive op that spawns a container.
 *
 * Two tiers:
 *   - `sessionCreateLimit`: tight — container creation is the expensive op.
 *   - `mutationLimit`: generous — covers per-keystroke snapshot syncs and
 *     per-run code executes where a user legitimately hits the endpoint
 *     often.
 */
const byIp = (req: import("express").Request) =>
  `ip:${ipKeyGenerator(req.ip ?? "")}`;

const byUserOrIp = (req: import("express").Request) => {
  if (req.userId) return `user:${req.userId}`;
  return `ip:${ipKeyGenerator(req.ip ?? "")}`;
};

export const sessionCreateLimit = rateLimit({
  windowMs: config.mutationRateLimit.sessionCreateWindowMs,
  limit: config.mutationRateLimit.sessionCreateMax,
  keyGenerator: byIp,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many session creations; slow down." },
});

export const mutationLimit = rateLimit({
  windowMs: config.mutationRateLimit.mutationWindowMs,
  limit: config.mutationRateLimit.mutationMax,
  keyGenerator: byUserOrIp,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests; slow down." },
});
