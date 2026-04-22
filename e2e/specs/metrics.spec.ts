// Phase 20-P3: /api/metrics is no longer world-readable. The gate accepts
// either a Bearer token (when METRICS_TOKEN is set on the backend) or a
// loopback caller (when it isn't). The e2e stack runs with METRICS_TOKEN
// set in CI — see .github/workflows/e2e.yml — so this spec exercises the
// authed path. Locally, an operator without METRICS_TOKEN in .env gets the
// loopback-blocked path: the unauthenticated request 403s (external clients
// going through the docker bridge aren't loopback), which is also covered
// below.
//
// Unit-level formatter tests live in backend/src/services/metrics.test.ts;
// unit-level gate tests live in backend/src/routes/metrics.test.ts. This
// spec locks in the cross-cutting properties an e2e alone can prove:
//   - the gate is actually mounted (regressions where the route order is
//     broken would be caught here);
//   - content-type + metric names match live output when you hold a token.

import { expect, request, test } from "@playwright/test";

const BACKEND = process.env.E2E_API_URL ?? "http://localhost:4000";
const METRICS_TOKEN = process.env.METRICS_TOKEN ?? "";

test.describe("metrics endpoint", () => {
  test("rejects unauthenticated external callers", async () => {
    const ctx = await request.newContext();
    // No Authorization header. Reaching the backend from the host goes
    // through docker's bridge network, so req.ip is not loopback — the
    // gate returns 403 (loopback branch) or 401 (token branch) depending
    // on whether METRICS_TOKEN is set on the backend.
    const res = await ctx.get(`${BACKEND}/api/metrics`);
    expect([401, 403]).toContain(res.status());
    await ctx.dispose();
  });

  test("returns Prom text when Authorization matches METRICS_TOKEN", async () => {
    test.skip(
      !METRICS_TOKEN,
      "METRICS_TOKEN not set — skipping authed path (CI always sets it)",
    );
    const ctx = await request.newContext();
    const res = await ctx.get(`${BACKEND}/api/metrics`, {
      headers: { Authorization: `Bearer ${METRICS_TOKEN}` },
    });
    expect(res.status()).toBe(200);

    const ctype = res.headers()["content-type"] ?? "";
    expect(ctype).toContain("text/plain");
    expect(ctype).toContain("version=0.0.4");

    const body = await res.text();
    // The three metric declarations from backend/src/services/metrics.ts.
    expect(body).toMatch(/^# TYPE session_count gauge$/m);
    expect(body).toMatch(/^# TYPE ai_tokens_consumed_total counter$/m);
    expect(body).toMatch(/^# TYPE exec_duration_seconds histogram$/m);
    // Gauge is emitted on every scrape via its collect hook — its value is
    // always present (even with zero sessions), so seeing just the TYPE
    // line without a sample would mean the collect hook is broken.
    expect(body).toMatch(/^session_count \d+(\.\d+)?$/m);

    await ctx.dispose();
  });

  test("rejects a wrong Bearer token with 401", async () => {
    test.skip(
      !METRICS_TOKEN,
      "METRICS_TOKEN not set — skipping authed-negative path",
    );
    const ctx = await request.newContext();
    const res = await ctx.get(`${BACKEND}/api/metrics`, {
      headers: { Authorization: "Bearer not-the-right-token" },
    });
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });
});
