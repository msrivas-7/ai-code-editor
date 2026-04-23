// Security-suite test fixture. Each scenario gets:
//
//  - `attack`    — authenticated AttackApi bound to a fresh per-worker
//                  Supabase user. Reuses the main e2e/fixtures/auth.ts
//                  user pool so we don't double-populate GoTrue.
//  - `sessionId` — a session created via POST /api/session, torn down
//                  in afterEach so resource-class tests don't leak
//                  containers into the next scenario.
//  - `sentinel`  — a shared HostSentinel started once per worker in
//                  beforeAll. Scenarios call `sentinel.window(...)` to
//                  bracket attack runs. Tcpdump (if available) and
//                  canary timers keep running across tests — it's the
//                  window() bracket that isolates measurements.
//
// We use Playwright's test runner for three pragmatic reasons:
//  1. per-worker parallelism with an existing auth fixture,
//  2. rich assertion output + HTML report for investigating regressions,
//  3. @playwright/test's `request` context mirrors real HTTP semantics
//     without any browser weight.

import { test as baseTest } from "@playwright/test";
import { getWorkerUser } from "../../fixtures/auth.js";
import { AttackApi } from "./api.js";
import { HostSentinel } from "./sentinel.js";
import type { ScenarioMeta } from "./types.js";

interface Fixtures {
  attack: AttackApi;
  sessionId: string;
  sentinel: HostSentinel;
  /**
   * Declares what claim the current test verifies. Not functional —
   * fails the test if the metadata is obviously wrong so drive-by
   * "copy this test, forget to update the claim" regressions get
   * caught at authoring time.
   */
  scenario: (meta: ScenarioMeta) => void;
}

interface WorkerFixtures {
  workerSentinel: HostSentinel;
}

export const test = baseTest.extend<Fixtures, WorkerFixtures>({
  workerSentinel: [
    async ({}, use) => {
      const s = new HostSentinel();
      await s.start();
      await use(s);
      await s.stop();
    },
    { scope: "worker" },
  ],

  attack: async ({}, use, testInfo) => {
    const user = await getWorkerUser(testInfo.workerIndex);
    const api = await AttackApi.create(user.session.access_token);
    try {
      await use(api);
    } finally {
      await api.dispose();
    }
  },

  sessionId: async ({ attack }, use) => {
    const { sessionId } = await attack.startSession();
    try {
      await use(sessionId);
    } finally {
      await attack.endSession(sessionId);
    }
  },

  sentinel: async ({ workerSentinel }, use) => {
    await use(workerSentinel);
  },

  scenario: async ({}, use) => {
    let called = false;
    const fn = (meta: ScenarioMeta) => {
      called = true;
      if (!meta.id || !meta.claim.length || !meta.summary) {
        throw new Error(
          `scenario() requires non-empty id, claim[], summary — got ${JSON.stringify(meta)}`,
        );
      }
    };
    await use(fn);
    if (!called) {
      throw new Error(
        "test did not call scenario({...}). Every security-suite test MUST declare id + claim + summary.",
      );
    }
  },
});

export { expect } from "@playwright/test";
