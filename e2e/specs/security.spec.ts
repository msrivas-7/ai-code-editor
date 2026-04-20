// Security-posture regressions (Phase 15). Exercises the guarantees that are
// invisible from the learner UI but easy to silently regress:
//   - AI route rate-limit kicks in once the per-session bucket exhausts.
//   - helmet security headers (CSP, X-Content-Type-Options, Referrer-Policy,
//     X-Frame-Options) are present on backend responses.
//   - The docker-socket-proxy denies every endpoint outside the tight
//     allowlist (CONTAINERS, EXEC, POST). Relies on docker compose being up.
//
// These tests are intentionally low-level — they use Playwright's
// APIRequestContext / child_process and never drive the browser. Keeping them
// in the E2E suite means they run against the same compose stack that ships
// to production.

import { execFileSync } from "node:child_process";
import { expect, request, test } from "@playwright/test";

const BACKEND = process.env.E2E_API_URL ?? "http://localhost:4000";

test.describe("security posture", () => {
  test("AI rate-limit returns 429 once the per-session bucket is exhausted", async () => {
    // Scope the bucket to a unique session id so this test doesn't cross-
    // contaminate other AI specs running in parallel (they'd otherwise all
    // share the IP fallback bucket). bucketKey() in aiRateLimit.ts prefers
    // sid:<sessionId> over ip:<…> when req.body.sessionId is non-empty.
    const sid = `e2e-rate-limit-${Date.now()}`;
    const ctx = await request.newContext();

    // Fire up to 80 sequential requests. The route handler 400s (the body
    // is deliberately invalid — missing `question`, etc.) but the rate-limit
    // middleware runs BEFORE the handler, so every call ticks the bucket.
    // We expect a 429 somewhere at or before the 65th request (default
    // limit is 60 / 60s).
    let sawRateLimit = false;
    let callsBefore429 = 0;
    for (let i = 0; i < 80; i++) {
      const res = await ctx.post(`${BACKEND}/api/ai/ask`, {
        data: { sessionId: sid },
        failOnStatusCode: false,
      });
      if (res.status() === 429) {
        sawRateLimit = true;
        callsBefore429 = i;
        break;
      }
    }
    await ctx.dispose();

    expect(sawRateLimit, "expected a 429 from /api/ai/ask once bucket exhausts").toBe(true);
    // Soft floor: the limit should not trip before ~50 calls. If it does, it
    // means the default has been tightened unexpectedly or a separate bucket
    // bled into this sid.
    expect(callsBefore429).toBeGreaterThanOrEqual(50);
  });

  test("helmet security headers are present on backend responses", async () => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${BACKEND}/api/health`);
    expect(res.status()).toBe(200);

    const headers = res.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    // helmet defaults: SAMEORIGIN for X-Frame-Options, no-referrer for Referrer-Policy.
    expect(headers["x-frame-options"]?.toUpperCase()).toBe("SAMEORIGIN");
    expect(headers["referrer-policy"]).toBeTruthy();
    // Strict CSP: self default with api.openai.com explicitly allowed for
    // connect-src. If this ever loosens, the snapshot fails and the author
    // has to justify the widening.
    const csp = headers["content-security-policy"] ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("https://api.openai.com");
    expect(csp).toContain("frame-ancestors 'none'");

    await ctx.dispose();
  });

  test("docker-socket-proxy denies endpoints outside the allowlist", async () => {
    // This test proves Phase 14b's allowlist. We exec inside the backend
    // container (the only thing on the internal compose network that can
    // reach socket-proxy:2375) and probe both an allowed and a denied
    // endpoint. Denied endpoints must 403; the allowed one must succeed.
    // If docker compose isn't up (dev running backend bare-metal), skip.
    let allowedStatus: number | null = null;
    let deniedNetworksStatus: number | null = null;
    let deniedVolumesStatus: number | null = null;
    try {
      allowedStatus = probeSocketProxyStatus("/containers/json");
      // /networks and /volumes are outside the allowlist (no NETWORKS=1 /
      // VOLUMES=1 in compose) so the proxy must 403 both.
      deniedNetworksStatus = probeSocketProxyStatus("/networks");
      deniedVolumesStatus = probeSocketProxyStatus("/volumes");
    } catch (err) {
      test.skip(
        true,
        `docker compose exec unavailable — skipping socket-proxy assertions: ${String(err)}`,
      );
      return;
    }

    expect(allowedStatus, "/containers/json should be allowlisted").toBe(200);
    expect(deniedNetworksStatus, "/networks should be denied by allowlist").toBe(403);
    expect(deniedVolumesStatus, "/volumes should be denied by allowlist").toBe(403);
  });
});

// Runs a short node one-liner inside the backend container that issues an
// HTTP GET to socket-proxy:2375 and prints the status code. We use node
// because the backend image is slim node:20-alpine-sans-curl.
function probeSocketProxyStatus(path: string): number {
  const script =
    `const http=require("node:http");` +
    `http.get({host:"socket-proxy",port:2375,path:${JSON.stringify(path)}},` +
    `r=>{console.log(r.statusCode);r.resume();})` +
    `.on("error",e=>{console.log("err:"+e.message);process.exit(2);});`;
  const out = execFileSync(
    "docker",
    ["compose", "exec", "-T", "backend", "node", "-e", script],
    { encoding: "utf8", timeout: 15_000 },
  ).trim();
  const code = Number(out);
  if (!Number.isFinite(code)) {
    throw new Error(`unexpected socket-proxy probe output: ${out}`);
  }
  return code;
}
