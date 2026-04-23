// Thin API client for the security suite. Wraps the Playwright request
// context with the three headers every state-changing call needs (auth
// bearer, CSRF marker, origin) so scenarios can focus on attack shape
// rather than plumbing.
//
// We intentionally do NOT share code with the main e2e fixtures' session
// sniffer — the security suite cleans up explicitly in afterEach because
// each scenario creates exactly one session and we want deterministic
// teardown for resource-class tests (a leaked session still holds a
// container alive and can skew the next scenario's sentinel baseline).

import type { APIRequestContext, APIResponse } from "@playwright/test";
import { request as playwrightRequest } from "@playwright/test";
import type { ExecOutcome, Language } from "./types.js";

const BACKEND_URL = process.env.E2E_API_URL ?? "http://localhost:4000";
const APP_ORIGIN = process.env.E2E_APP_ORIGIN ?? "http://localhost:5173";

export interface AttackFile {
  path: string;
  content: string;
}

export interface StartedSession {
  sessionId: string;
  createdAt: string;
}

/**
 * One AttackApi instance per authenticated user per test. Holds the
 * Playwright request context for cleanup.
 */
export class AttackApi {
  private readonly ctx: APIRequestContext;
  private readonly ownCtx: boolean;

  private constructor(ctx: APIRequestContext, ownCtx: boolean) {
    this.ctx = ctx;
    this.ownCtx = ownCtx;
  }

  static async create(accessToken: string): Promise<AttackApi> {
    const ctx = await playwrightRequest.newContext({
      extraHTTPHeaders: {
        Origin: APP_ORIGIN,
        "X-Requested-With": "codetutor",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    return new AttackApi(ctx, true);
  }

  /**
   * Variant that does NOT attach Authorization / CSRF headers. Used by
   * scenarios that deliberately test those middleware layers (e.g. a
   * replay from an anonymous origin). Callers add back only the headers
   * the specific test allows.
   */
  static async createRaw(extraHeaders: Record<string, string> = {}): Promise<AttackApi> {
    const ctx = await playwrightRequest.newContext({
      extraHTTPHeaders: { "Content-Type": "application/json", ...extraHeaders },
    });
    return new AttackApi(ctx, true);
  }

  async dispose(): Promise<void> {
    if (this.ownCtx) await this.ctx.dispose();
  }

  async startSession(): Promise<StartedSession> {
    const res = await this.ctx.post(`${BACKEND_URL}/api/session`, { data: {} });
    await assertOk(res, "startSession");
    const j = (await res.json()) as { sessionId: string; createdAt: string };
    return j;
  }

  async endSession(sessionId: string): Promise<void> {
    // Best-effort — a 404 here just means the session was already reaped.
    await this.ctx
      .post(`${BACKEND_URL}/api/session/end`, { data: { sessionId } })
      .catch(() => {});
  }

  async writeFiles(sessionId: string, files: AttackFile[]): Promise<void> {
    const res = await this.ctx.post(`${BACKEND_URL}/api/project/snapshot`, {
      data: { sessionId, files },
    });
    await assertOk(res, "writeFiles");
  }

  /**
   * Write attack files + run. Returns the execute response verbatim.
   * Caller asserts on fields.
   */
  async runAttack(params: {
    sessionId: string;
    language: Language;
    files: AttackFile[];
    stdin?: string;
  }): Promise<ExecOutcome> {
    await this.writeFiles(params.sessionId, params.files);
    const res = await this.ctx.post(`${BACKEND_URL}/api/execute`, {
      data: {
        sessionId: params.sessionId,
        language: params.language,
        stdin: params.stdin,
      },
    });
    await assertOk(res, "execute");
    return (await res.json()) as ExecOutcome;
  }

  /**
   * Low-level handle to the underlying request context. Scenarios that
   * need to poke custom routes (e.g. `/api/execute/tests` for S8, or
   * deliberate-bad-request probes for S6) use this.
   */
  get raw(): APIRequestContext {
    return this.ctx;
  }
}

async function assertOk(res: APIResponse, label: string): Promise<void> {
  if (!res.ok()) {
    const body = await res.text().catch(() => "<no body>");
    throw new Error(
      `${label} failed: ${res.status()} ${res.statusText()} — ${body.slice(0, 500)}`,
    );
  }
}

export { BACKEND_URL, APP_ORIGIN };
