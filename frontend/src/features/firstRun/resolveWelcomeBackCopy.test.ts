import { describe, it, expect } from "vitest";
import { resolveWelcomeBackCopy } from "./resolveWelcomeBackCopy";
import type { CourseProgress, LessonProgress } from "../learning/types";

const NOW = new Date("2026-04-24T12:00:00Z");
const HOURS_AGO = (h: number) =>
  new Date(NOW.getTime() - h * 60 * 60 * 1000).toISOString();

function lessonProgress(
  overrides: Partial<LessonProgress> = {},
): LessonProgress {
  return {
    learnerId: "u1",
    courseId: "python-fundamentals",
    lessonId: "variables-basics",
    status: "not_started",
    startedAt: null,
    updatedAt: HOURS_AGO(24),
    completedAt: null,
    attemptCount: 0,
    runCount: 0,
    hintCount: 0,
    lastCode: null,
    lastOutput: null,
    ...overrides,
  } as LessonProgress;
}

function courseProgress(
  overrides: Partial<CourseProgress> = {},
): CourseProgress {
  return {
    learnerId: "u1",
    courseId: "python-fundamentals",
    status: "not_started",
    startedAt: null,
    updatedAt: HOURS_AGO(24),
    completedAt: null,
    lastLessonId: null,
    completedLessonIds: [],
    ...overrides,
  };
}

const CATALOG = {
  "python-fundamentals": {
    title: "Python Fundamentals",
    lessons: [
      { id: "hello-world", title: "Hello, World", order: 1 },
      { id: "variables-basics", title: "Variables", order: 2 },
      { id: "functions", title: "Functions", order: 6 },
    ],
  },
};

describe("resolveWelcomeBackCopy", () => {
  it("branches to in-progress lesson when one exists", () => {
    const out = resolveWelcomeBackCopy({
      firstName: "Mehul",
      now: NOW,
      lastWelcomeBackAt: HOURS_AGO(10),
      courseProgressMap: {
        "python-fundamentals": courseProgress({ status: "in_progress" }),
      },
      lessonProgressMap: {
        "python-fundamentals/variables-basics": lessonProgress({
          status: "in_progress",
          updatedAt: HOURS_AGO(3),
        }),
      },
      courseCatalog: CATALOG,
    });
    expect(out.hero).toBe("Welcome back, Mehul.");
    expect(out.subtitle).toBe("Picking up at Lesson 2: Variables.");
  });

  it("prefers the most recently-updated in-progress lesson when multiple exist", () => {
    const out = resolveWelcomeBackCopy({
      firstName: "Mehul",
      now: NOW,
      lastWelcomeBackAt: null,
      courseProgressMap: {
        "python-fundamentals": courseProgress({ status: "in_progress" }),
      },
      lessonProgressMap: {
        "python-fundamentals/variables-basics": lessonProgress({
          lessonId: "variables-basics",
          status: "in_progress",
          updatedAt: HOURS_AGO(48),
        }),
        "python-fundamentals/functions": lessonProgress({
          lessonId: "functions",
          status: "in_progress",
          updatedAt: HOURS_AGO(1),
        }),
      },
      courseCatalog: CATALOG,
    });
    expect(out.subtitle).toBe("Picking up at Lesson 6: Functions.");
  });

  it("celebrates recently-completed courses (<24h)", () => {
    const out = resolveWelcomeBackCopy({
      firstName: "Ada",
      now: NOW,
      lastWelcomeBackAt: HOURS_AGO(20),
      courseProgressMap: {
        "python-fundamentals": courseProgress({
          status: "completed",
          completedAt: HOURS_AGO(3),
        }),
      },
      lessonProgressMap: {},
      courseCatalog: CATALOG,
    });
    expect(out.subtitle).toBe(
      "Nice work on Python Fundamentals — ready for what's next?",
    );
  });

  it("does NOT re-celebrate courses completed more than 24h ago", () => {
    const out = resolveWelcomeBackCopy({
      firstName: "Ada",
      now: NOW,
      lastWelcomeBackAt: null,
      courseProgressMap: {
        "python-fundamentals": courseProgress({
          status: "completed",
          completedAt: HOURS_AGO(48),
        }),
      },
      lessonProgressMap: {},
      courseCatalog: CATALOG,
    });
    // Falls through to branch 3 (has progress, nothing in-flight).
    // Phase B: copy is now state-aware. lessonProgressMap is empty
    // here so completedCount=0 → falls to the generic resume line.
    expect(out.subtitle).toBe("Pick up where you left off.");
  });

  it("idle-with-progress branch: has progress but nothing in-flight", () => {
    const out = resolveWelcomeBackCopy({
      firstName: "Grace",
      now: NOW,
      lastWelcomeBackAt: HOURS_AGO(20),
      courseProgressMap: {
        "python-fundamentals": courseProgress({ status: "in_progress" }),
      },
      lessonProgressMap: {
        "python-fundamentals/hello-world": lessonProgress({
          lessonId: "hello-world",
          status: "completed",
        }),
      },
      courseCatalog: CATALOG,
    });
    // Phase B: state-aware subtitle names what the user has done.
    // 1 completed lesson → singular phrasing.
    expect(out.subtitle).toBe(
      "One lesson down. Pick the next one when you're ready.",
    );
  });

  it("no-progress branch: invites without pressure", () => {
    const out = resolveWelcomeBackCopy({
      firstName: "Alan",
      now: NOW,
      lastWelcomeBackAt: null,
      courseProgressMap: {},
      lessonProgressMap: {},
      courseCatalog: CATALOG,
    });
    expect(out.subtitle).toBe("Today's a good day to start.");
  });

  it("softens the hero after a >7-day absence", () => {
    const out = resolveWelcomeBackCopy({
      firstName: "Mehul",
      now: NOW,
      lastWelcomeBackAt: HOURS_AGO(24 * 9),
      courseProgressMap: {},
      lessonProgressMap: {},
      courseCatalog: CATALOG,
    });
    expect(out.hero).toBe("Good to see you again, Mehul.");
  });

  it("degrades gracefully when the course catalog is missing", () => {
    const out = resolveWelcomeBackCopy({
      firstName: "Mehul",
      now: NOW,
      lastWelcomeBackAt: null,
      courseProgressMap: {},
      lessonProgressMap: {
        "python-fundamentals/variables-basics": lessonProgress({
          status: "in_progress",
          updatedAt: HOURS_AGO(1),
        }),
      },
      // no catalog
    });
    expect(out.subtitle).toBe("Picking up where you left off.");
  });

  // Phase 21B — milestone streak copy.
  describe("streak milestone branch (Phase 21B)", () => {
    it("Day 7 active → 'A week in'", () => {
      const out = resolveWelcomeBackCopy({
        firstName: "Mehul",
        now: NOW,
        lastWelcomeBackAt: null,
        courseProgressMap: {},
        lessonProgressMap: {},
        streakCurrent: 7,
        streakIsActiveToday: true,
      });
      expect(out.hero).toBe("Day 7.");
      expect(out.subtitle).toBe("A week in, Mehul.");
    });

    it("Day 30 active → 'A month of showing up'", () => {
      const out = resolveWelcomeBackCopy({
        firstName: "Mehul",
        now: NOW,
        lastWelcomeBackAt: null,
        courseProgressMap: {},
        lessonProgressMap: {},
        streakCurrent: 30,
        streakIsActiveToday: true,
      });
      expect(out.hero).toBe("Day 30.");
    });

    it("non-milestone day (Day 5) falls through to existing branches", () => {
      const out = resolveWelcomeBackCopy({
        firstName: "Mehul",
        now: NOW,
        lastWelcomeBackAt: null,
        courseProgressMap: {},
        lessonProgressMap: {},
        streakCurrent: 5,
        streakIsActiveToday: true,
      });
      expect(out.hero).toBe("Welcome back, Mehul.");
    });

    it("milestone day, NOT active today yet (returning user, hasn't qualified yet) → STILL fires", () => {
      // Iter-2: the activeToday guard was dropped because returning
      // Day-7 users sign in BEFORE qualifying today; the milestone
      // copy must fire on first sign-in, not be suppressed waiting
      // for a qualifying action. lastWelcomeBackAt throttles the
      // overlay to once-per-day, so no risk of repeat-firing.
      const out = resolveWelcomeBackCopy({
        firstName: "Mehul",
        now: NOW,
        lastWelcomeBackAt: null,
        courseProgressMap: {},
        lessonProgressMap: {},
        streakCurrent: 7,
        streakIsActiveToday: false,
      });
      expect(out.hero).toBe("Day 7.");
      expect(out.subtitle).toBe("A week in, Mehul.");
    });

    it("streak data absent → falls through", () => {
      const out = resolveWelcomeBackCopy({
        firstName: "Mehul",
        now: NOW,
        lastWelcomeBackAt: null,
        courseProgressMap: {},
        lessonProgressMap: {},
      });
      expect(out.hero).toBe("Welcome back, Mehul.");
    });
  });
});
