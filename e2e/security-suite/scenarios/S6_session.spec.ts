// S6 — Session ownership.
//
// C14: every session is tagged with the creating user's id. The
// `requireActiveSession(sessionId, userId)` guard refuses if they don't
// match. That's the protection against user A hitchhiking user B's
// already-hot container.
//
// These tests use TWO users, so they can't piggyback on the default
// per-worker fixture — each case builds its own AttackApi pair.

import { test, expect } from "../harness/fixtures.js";
import { AttackApi, BACKEND_URL } from "../harness/api.js";
import { getWorkerUser } from "../../fixtures/auth.js";

test.describe("S6 — session ownership (C14)", () => {
  test("S6a: user B cannot exec against user A's session", async ({
    scenario,
  }, testInfo) => {
    scenario({
      id: "S6a",
      claim: ["C14 session ownership"],
      summary: "cross-user exec against a foreign sessionId must 404",
    });
    const userA = await getWorkerUser(testInfo.workerIndex);
    const userB = await getWorkerUser(testInfo.workerIndex + 2000);
    expect(userA.userId).not.toBe(userB.userId);

    const apiA = await AttackApi.create(userA.session.access_token);
    const apiB = await AttackApi.create(userB.session.access_token);
    const sessA = (await apiA.startSession()).sessionId;
    try {
      // B submits an execute request with A's sessionId. Backend must
      // refuse — ideally a 404 (session not found for this user) rather
      // than 403, because a 403 would leak "this session exists, just
      // not yours".
      const res = await apiB.raw.post(`${BACKEND_URL}/api/execute`, {
        data: { sessionId: sessA, language: "python" },
      });
      expect(res.status()).toBe(404);
    } finally {
      await apiA.endSession(sessA);
      await apiA.dispose();
      await apiB.dispose();
    }
  });

  test("S6b: fabricated session handle is rejected", async ({
    attack,
    scenario,
  }) => {
    scenario({
      id: "S6b",
      claim: ["C14 session ownership"],
      summary: "well-formed but fabricated sessionId must not spawn a container",
    });
    // A syntactically plausible id (20 hex chars) that we never created.
    // It must 404, not 500 or (worse) reuse an unrelated container.
    const res = await attack.raw.post(`${BACKEND_URL}/api/execute`, {
      data: { sessionId: "abcdef0123456789abcd", language: "python" },
    });
    expect(res.status()).toBe(404);
  });
});
