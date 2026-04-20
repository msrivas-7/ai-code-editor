// Global setup. Asserts the frontend + backend are reachable before any spec
// runs. We don't boot the stack ourselves — that's the developer's one-time
// `docker compose up -d` setup. Surfacing a clear error here is far more
// useful than each spec timing out on a connection refused.

import { request } from "@playwright/test";

const FRONTEND = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const BACKEND = process.env.E2E_API_URL ?? "http://localhost:4000";
// Defaults to the local-CLI URL; override via env for staging / CI.
const SUPABASE = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const MAX_ATTEMPTS = 20;
const ATTEMPT_DELAY_MS = 500;

async function ping(url: string, label: string) {
  const ctx = await request.newContext();
  let lastErr: unknown;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      const res = await ctx.get(url, { timeout: 2_000 });
      if (res.ok() || res.status() === 404) {
        await ctx.dispose();
        return;
      }
      lastErr = new Error(`${label} returned HTTP ${res.status()}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, ATTEMPT_DELAY_MS));
  }
  await ctx.dispose();
  throw new Error(
    `E2E globalSetup: ${label} unreachable at ${url} after ${MAX_ATTEMPTS} attempts. ` +
      `Run \`docker compose up -d\` first. Last error: ${String(lastErr)}`,
  );
}

export default async function globalSetup() {
  await Promise.all([
    ping(FRONTEND, "frontend"),
    ping(`${BACKEND}/api/ai/validate-key`, "backend"),
    // validate-key with no body → 400 is expected + means the route is mounted.
    // Supabase GoTrue health. Same pattern: if `supabase start` isn't running,
    // every spec would 401 at login — far cheaper to fail loudly here.
    ping(`${SUPABASE}/auth/v1/health`, "supabase"),
  ]);

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "E2E globalSetup: SUPABASE_SERVICE_ROLE_KEY is required. " +
        "Put it in ../.env.local (run `npx supabase status` to find the " +
        "local secret) or inject via CI secret. See e2e/fixtures/auth.ts.",
    );
  }

  if (process.env.E2E_REAL_OPENAI === "1" && !process.env.OPENAI_API_KEY) {
    throw new Error(
      "E2E_REAL_OPENAI=1 requires OPENAI_API_KEY in the environment. " +
        "Source .env.local or pass it inline: `OPENAI_API_KEY=sk-… npm run test:real`",
    );
  }
}
