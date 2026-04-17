import { describe, it, expect, beforeEach, vi } from "vitest";

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
  get length() { return storage.size; },
  key: (_i: number) => null as string | null,
};
vi.stubGlobal("localStorage", localStorageMock);

import { useProgressStore, loadSavedCode, loadAllLessonProgress } from "./progressStore";
import type { LessonProgress } from "../types";

const LEARNER = "test-learner";
const COURSE = "python-fundamentals";
const LESSON = "hello-world";
const LESSON_KEY = `learner:v1:lesson:${COURSE}:${LESSON}`;
const COURSE_KEY = `learner:v1:progress:${COURSE}`;

function resetStore() {
  storage.clear();
  useProgressStore.setState({
    courseProgress: {},
    lessonProgress: {},
  });
}

describe("progressStore", () => {
  beforeEach(resetStore);

  describe("loadCourseProgress", () => {
    it("creates fresh progress when none exists", () => {
      const cp = useProgressStore.getState().loadCourseProgress(LEARNER, COURSE);
      expect(cp.status).toBe("not_started");
      expect(cp.courseId).toBe(COURSE);
      expect(cp.completedLessonIds).toEqual([]);
      expect(storage.has(COURSE_KEY)).toBe(true);
    });

    it("loads existing progress from localStorage", () => {
      const existing = {
        learnerId: LEARNER,
        courseId: COURSE,
        status: "in_progress",
        startedAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-02T00:00:00.000Z",
        completedAt: null,
        lastLessonId: LESSON,
        completedLessonIds: [LESSON],
      };
      storage.set(COURSE_KEY, JSON.stringify(existing));

      const cp = useProgressStore.getState().loadCourseProgress(LEARNER, COURSE);
      expect(cp.status).toBe("in_progress");
      expect(cp.completedLessonIds).toEqual([LESSON]);
    });
  });

  describe("startLesson", () => {
    it("creates lesson progress and sets course to in_progress", () => {
      useProgressStore.getState().loadCourseProgress(LEARNER, COURSE);
      useProgressStore.getState().startLesson(LEARNER, COURSE, LESSON);

      const lp = useProgressStore.getState().lessonProgress[`${COURSE}/${LESSON}`];
      expect(lp).toBeDefined();
      expect(lp.status).toBe("in_progress");
      expect(lp.attemptCount).toBe(1);

      const cp = useProgressStore.getState().courseProgress[COURSE];
      expect(cp.status).toBe("in_progress");
      expect(cp.lastLessonId).toBe(LESSON);
    });

    it("does not reset completed lesson status", () => {
      const completedLp: LessonProgress = {
        learnerId: LEARNER, courseId: COURSE, lessonId: LESSON,
        status: "completed", startedAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z", completedAt: "2025-01-01T00:00:00.000Z",
        attemptCount: 2, runCount: 5, hintCount: 1, lastCode: null, lastOutput: null,
      };
      storage.set(LESSON_KEY, JSON.stringify(completedLp));
      useProgressStore.getState().loadCourseProgress(LEARNER, COURSE);
      useProgressStore.getState().startLesson(LEARNER, COURSE, LESSON);

      const lp = useProgressStore.getState().lessonProgress[`${COURSE}/${LESSON}`];
      expect(lp.status).toBe("completed");
      expect(lp.attemptCount).toBe(2);
    });

    it("only bumps attempt once per session for same lesson", () => {
      const uniqueLesson = "session-dedup-test";
      const key = `${COURSE}/${uniqueLesson}`;
      useProgressStore.getState().loadCourseProgress(LEARNER, COURSE);
      useProgressStore.getState().startLesson(LEARNER, COURSE, uniqueLesson);

      const lp1 = useProgressStore.getState().lessonProgress[key];
      expect(lp1.attemptCount).toBe(1);

      useProgressStore.getState().startLesson(LEARNER, COURSE, uniqueLesson);
      const lp2 = useProgressStore.getState().lessonProgress[key];
      expect(lp2.attemptCount).toBe(1);
    });

    it("reads from localStorage when Zustand is empty", () => {
      const uniqueLesson = "ls-fallback-test";
      const lsKey = `learner:v1:lesson:${COURSE}:${uniqueLesson}`;
      const key = `${COURSE}/${uniqueLesson}`;
      const existingLp: LessonProgress = {
        learnerId: LEARNER, courseId: COURSE, lessonId: uniqueLesson,
        status: "in_progress", startedAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z", completedAt: null,
        attemptCount: 3, runCount: 10, hintCount: 2, lastCode: null, lastOutput: null,
      };
      storage.set(lsKey, JSON.stringify(existingLp));
      useProgressStore.getState().loadCourseProgress(LEARNER, COURSE);

      useProgressStore.getState().startLesson(LEARNER, COURSE, uniqueLesson);
      const lp = useProgressStore.getState().lessonProgress[key];
      expect(lp.attemptCount).toBe(4);
      expect(lp.runCount).toBe(10);
      expect(lp.hintCount).toBe(2);
    });
  });

  describe("incrementRun", () => {
    it("increments run count atomically", () => {
      useProgressStore.getState().loadCourseProgress(LEARNER, COURSE);
      useProgressStore.getState().startLesson(LEARNER, COURSE, LESSON);

      useProgressStore.getState().incrementRun(COURSE, LESSON);
      useProgressStore.getState().incrementRun(COURSE, LESSON);
      useProgressStore.getState().incrementRun(COURSE, LESSON);

      const lp = useProgressStore.getState().lessonProgress[`${COURSE}/${LESSON}`];
      expect(lp.runCount).toBe(3);
    });

    it("falls back to localStorage when Zustand is empty", () => {
      const existingLp: LessonProgress = {
        learnerId: LEARNER, courseId: COURSE, lessonId: LESSON,
        status: "in_progress", startedAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z", completedAt: null,
        attemptCount: 1, runCount: 5, hintCount: 0, lastCode: null, lastOutput: null,
      };
      storage.set(LESSON_KEY, JSON.stringify(existingLp));

      useProgressStore.getState().incrementRun(COURSE, LESSON);
      const lp = useProgressStore.getState().lessonProgress[`${COURSE}/${LESSON}`];
      expect(lp.runCount).toBe(6);
    });

    it("does nothing when lesson has no progress", () => {
      useProgressStore.getState().incrementRun(COURSE, LESSON);
      const lp = useProgressStore.getState().lessonProgress[`${COURSE}/${LESSON}`];
      expect(lp).toBeUndefined();
    });
  });

  describe("incrementHint", () => {
    it("increments hint count", () => {
      useProgressStore.getState().loadCourseProgress(LEARNER, COURSE);
      useProgressStore.getState().startLesson(LEARNER, COURSE, LESSON);

      useProgressStore.getState().incrementHint(COURSE, LESSON);
      useProgressStore.getState().incrementHint(COURSE, LESSON);

      const lp = useProgressStore.getState().lessonProgress[`${COURSE}/${LESSON}`];
      expect(lp.hintCount).toBe(2);
    });
  });

  describe("saveCode", () => {
    it("saves code without clobbering run count", () => {
      useProgressStore.getState().loadCourseProgress(LEARNER, COURSE);
      useProgressStore.getState().startLesson(LEARNER, COURSE, LESSON);
      useProgressStore.getState().incrementRun(COURSE, LESSON);
      useProgressStore.getState().incrementRun(COURSE, LESSON);

      useProgressStore.getState().saveCode(COURSE, LESSON, { "main.py": "print('hi')" });

      const lp = useProgressStore.getState().lessonProgress[`${COURSE}/${LESSON}`];
      expect(lp.runCount).toBe(2);
      expect(lp.lastCode).toEqual({ "main.py": "print('hi')" });
    });

    it("persists code to localStorage", () => {
      useProgressStore.getState().loadCourseProgress(LEARNER, COURSE);
      useProgressStore.getState().startLesson(LEARNER, COURSE, LESSON);
      useProgressStore.getState().saveCode(COURSE, LESSON, { "main.py": "x = 1" });

      const raw = storage.get(LESSON_KEY);
      expect(raw).toBeDefined();
      const parsed = JSON.parse(raw!);
      expect(parsed.lastCode).toEqual({ "main.py": "x = 1" });
    });
  });

  describe("completeLesson", () => {
    it("marks lesson and course as completed", () => {
      useProgressStore.getState().loadCourseProgress(LEARNER, COURSE);
      useProgressStore.getState().startLesson(LEARNER, COURSE, LESSON);
      useProgressStore.getState().completeLesson(LEARNER, COURSE, LESSON, 1);

      const lp = useProgressStore.getState().lessonProgress[`${COURSE}/${LESSON}`];
      expect(lp.status).toBe("completed");
      expect(lp.completedAt).toBeTruthy();

      const cp = useProgressStore.getState().courseProgress[COURSE];
      expect(cp.status).toBe("completed");
      expect(cp.completedLessonIds).toContain(LESSON);
    });

    it("does not mark course complete if lessons remain", () => {
      useProgressStore.getState().loadCourseProgress(LEARNER, COURSE);
      useProgressStore.getState().startLesson(LEARNER, COURSE, LESSON);
      useProgressStore.getState().completeLesson(LEARNER, COURSE, LESSON, 10);

      const cp = useProgressStore.getState().courseProgress[COURSE];
      expect(cp.status).toBe("in_progress");
    });

    it("does not duplicate lessonId in completedLessonIds", () => {
      useProgressStore.getState().loadCourseProgress(LEARNER, COURSE);
      useProgressStore.getState().startLesson(LEARNER, COURSE, LESSON);
      useProgressStore.getState().completeLesson(LEARNER, COURSE, LESSON, 10);
      useProgressStore.getState().completeLesson(LEARNER, COURSE, LESSON, 10);

      const cp = useProgressStore.getState().courseProgress[COURSE];
      const count = cp.completedLessonIds.filter((id) => id === LESSON).length;
      expect(count).toBe(1);
    });
  });

  describe("loadSavedCode", () => {
    it("returns null when no progress exists", () => {
      expect(loadSavedCode(COURSE, LESSON)).toBeNull();
    });

    it("returns saved code from localStorage", () => {
      const lp: LessonProgress = {
        learnerId: LEARNER, courseId: COURSE, lessonId: LESSON,
        status: "in_progress", startedAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z", completedAt: null,
        attemptCount: 1, runCount: 0, hintCount: 0,
        lastCode: { "main.py": "print('saved')" }, lastOutput: null,
      };
      storage.set(LESSON_KEY, JSON.stringify(lp));
      expect(loadSavedCode(COURSE, LESSON)).toEqual({ "main.py": "print('saved')" });
    });
  });

  describe("loadAllLessonProgress", () => {
    it("returns only lessons with existing progress", () => {
      const lp: LessonProgress = {
        learnerId: LEARNER, courseId: COURSE, lessonId: LESSON,
        status: "completed", startedAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z", completedAt: "2025-01-01T00:00:00.000Z",
        attemptCount: 1, runCount: 3, hintCount: 0, lastCode: null, lastOutput: null,
      };
      storage.set(LESSON_KEY, JSON.stringify(lp));

      const results = loadAllLessonProgress(COURSE, [LESSON, "variables", "loops"]);
      expect(results).toHaveLength(1);
      expect(results[0].lessonId).toBe(LESSON);
    });

    it("returns empty array when no progress exists", () => {
      const results = loadAllLessonProgress(COURSE, [LESSON, "variables"]);
      expect(results).toHaveLength(0);
    });
  });

  describe("concurrent operations preserve data", () => {
    it("incrementRun + saveCode don't clobber each other when sequential", () => {
      useProgressStore.getState().loadCourseProgress(LEARNER, COURSE);
      useProgressStore.getState().startLesson(LEARNER, COURSE, LESSON);

      useProgressStore.getState().incrementRun(COURSE, LESSON);
      useProgressStore.getState().saveCode(COURSE, LESSON, { "main.py": "x = 1" });
      useProgressStore.getState().incrementRun(COURSE, LESSON);

      const lp = useProgressStore.getState().lessonProgress[`${COURSE}/${LESSON}`];
      expect(lp.runCount).toBe(2);
      expect(lp.lastCode).toEqual({ "main.py": "x = 1" });
    });

    it("incrementHint + incrementRun don't clobber each other", () => {
      useProgressStore.getState().loadCourseProgress(LEARNER, COURSE);
      useProgressStore.getState().startLesson(LEARNER, COURSE, LESSON);

      useProgressStore.getState().incrementRun(COURSE, LESSON);
      useProgressStore.getState().incrementHint(COURSE, LESSON);
      useProgressStore.getState().incrementRun(COURSE, LESSON);
      useProgressStore.getState().incrementHint(COURSE, LESSON);

      const lp = useProgressStore.getState().lessonProgress[`${COURSE}/${LESSON}`];
      expect(lp.runCount).toBe(2);
      expect(lp.hintCount).toBe(2);
    });
  });
});
