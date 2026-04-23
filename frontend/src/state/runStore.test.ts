import { afterEach, describe, expect, it } from "vitest";
import { useRunStore } from "./runStore";

describe("runStore", () => {
  afterEach(() => {
    // Reset between tests so state from one case doesn't leak.
    useRunStore.getState().reset();
  });

  describe("runningTests flag (QA-C2)", () => {
    // Audit-v2 fix: the global Cmd+Enter handler in useLessonRunner reads
    // `runningTests` from this store to short-circuit `handleRun` while a
    // Check is executing. Without a shared flag, Cmd+Enter during "Checking…"
    // fires a snapshot that wipes the workspace the test harness is still
    // reading — silent wrong verdicts. `runningTests` is the contract
    // between useLessonValidator (writer) and useLessonRunner (reader).

    it("exposes runningTests alongside running, toggleable independently", () => {
      const s = useRunStore.getState();
      expect(s.running).toBe(false);
      expect(s.runningTests).toBe(false);

      s.setRunningTests(true);
      expect(useRunStore.getState().runningTests).toBe(true);
      // running is a separate flag; setting runningTests must not affect it.
      expect(useRunStore.getState().running).toBe(false);
    });

    it("clears runningTests on switchRunContext so a stale validator effect can't leak across lessons", () => {
      useRunStore.getState().setRunningTests(true);
      useRunStore.getState().switchRunContext("lesson:a/b");
      expect(useRunStore.getState().runningTests).toBe(false);
    });

    it("clears runningTests on reset (sign-out path)", () => {
      useRunStore.getState().setRunningTests(true);
      useRunStore.getState().reset();
      expect(useRunStore.getState().runningTests).toBe(false);
    });
  });
});
