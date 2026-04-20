import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { config } from "../config.js";

// Per-session bucket key. Falls back to IP (IPv6-safe via ipKeyGenerator)
// so an unauthenticated probe still gets throttled — the
// `/api/ai/validate-key` path fits this shape (no session created yet).
//
// Phase 17 will swap the resolver to "authenticated user id" in one line;
// the tenant-ready shape is already in place so downstream routes don't
// have to change when that happens.
function bucketKey(req: import("express").Request): string {
  const sid = (req.body?.sessionId as string | undefined) ?? null;
  if (sid && sid.length > 0) return `sid:${sid}`;
  return `ip:${ipKeyGenerator(req.ip ?? "")}`;
}

export const aiRateLimit = rateLimit({
  windowMs: config.aiRateLimit.windowMs,
  limit: config.aiRateLimit.max,
  keyGenerator: bucketKey,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many AI requests; please slow down." },
});
