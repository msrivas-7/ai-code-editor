import { describe, it, expect } from "vitest";
import { computeMastery, pickShakyLessons, formatTimeSpent } from "./mastery";
import type { LessonMeta, LessonProgress } from "../types";

const lessonMeta = (over: Partial<LessonMeta> = {}): LessonMeta => ({
  id: "lx",
  courseId: "c1",
  title: "Lesson",
  description: "",
  order: 1,
  language: "python",
  estimatedMinutes: 15,
  objectives: [],
  teachesConceptTags: [],
  usesConceptTags: [],
  completionRules: [],
  prerequisiteLessonIds: [],
  ...over,
});

const lp = (over: Partial<LessonProgress> = {}): LessonProgress => ({
  learnerId: "u",
  courseId: "c1",
  lessonId: "lx",
  status: "completed",
  startedAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  completedAt: "2025-01-01T00:00:00.000Z",
  attemptCount: 1,
  runCount: 1,
  hintCount: 0,
  lastCode: null,
  lastOutput: null,
  ...over,
});

describe("computeMastery", () => {
  it("returns null when lesson is not completed", () => {
    expect(computeMastery(lp({ status: "in_progress" }), lessonMeta())).toBeNull();
    expect(computeMastery(lp({ status: "not_started" }), lessonMeta())).toBeNull();
  });

  it("returns null when passed null", () => {
    expect(computeMastery(null, lessonMeta())).toBeNull();
    expect(computeMastery(undefined, lessonMeta())).toBeNull();
  });

  it("classifies a clean completion as strong", () => {
    const m = computeMastery(lp({ attemptCount: 1, hintCount: 0 }), lessonMeta());
    expect(m?.level).toBe("strong");
    expect(m?.score).toBe(0);
    expect(m?.reasons).toEqual([]);
  });

  it("classifies 2 attempts as still strong (boundary)", () => {
    const m = computeMastery(lp({ attemptCount: 2, hintCount: 0 }), lessonMeta());
    expect(m?.level).toBe("strong");
  });

  it("flags 3 attempts as one shakiness signal", () => {
    const m = computeMastery(lp({ attemptCount: 3, hintCount: 0 }), lessonMeta());
    expect(m?.level).toBe("okay");
    expect(m?.reasons).toContain("3 attempts");
  });

  it("flags 3 hints as one shakiness signal", () => {
    const m = computeMastery(lp({ attemptCount: 1, hintCount: 3 }), lessonMeta());
    expect(m?.level).toBe("okay");
    expect(m?.reasons).toContain("3 hints used");
  });

  it("flags over-2x-estimated time as one signal", () => {
    // estimated 15m = 900_000ms; > 1_800_000ms counts
    const m = computeMastery(
      lp({ timeSpentMs: 1_900_000 }),
      lessonMeta({ estimatedMinutes: 15 }),
    );
    expect(m?.level).toBe("okay");
    expect(m?.reasons[0]).toMatch(/spent/);
  });

  it("does not flag exactly-2x time (boundary)", () => {
    const m = computeMastery(
      lp({ timeSpentMs: 1_800_000 }),
      lessonMeta({ estimatedMinutes: 15 }),
    );
    expect(m?.level).toBe("strong");
  });

  it("escalates to shaky when two signals trigger", () => {
    const m = computeMastery(
      lp({ attemptCount: 4, hintCount: 5 }),
      lessonMeta(),
    );
    expect(m?.level).toBe("shaky");
    expect(m?.reasons).toHaveLength(2);
  });

  it("stays shaky when all three signals trigger", () => {
    const m = computeMastery(
      lp({ attemptCount: 5, hintCount: 5, timeSpentMs: 3_000_000 }),
      lessonMeta({ estimatedMinutes: 15 }),
    );
    expect(m?.level).toBe("shaky");
    expect(m?.score).toBe(3);
    expect(m?.reasons).toHaveLength(3);
  });

  it("handles missing timeSpentMs gracefully", () => {
    const m = computeMastery(
      lp({ timeSpentMs: undefined }),
      lessonMeta({ estimatedMinutes: 15 }),
    );
    expect(m?.level).toBe("strong");
  });

  it("handles zero-estimated-minutes without dividing/flagging", () => {
    const m = computeMastery(
      lp({ timeSpentMs: 99_999_999 }),
      lessonMeta({ estimatedMinutes: 0 }),
    );
    expect(m?.level).toBe("strong");
    expect(m?.reasons).toEqual([]);
  });
});

describe("pickShakyLessons", () => {
  const metasById: Record<string, LessonMeta> = {
    l1: lessonMeta({ id: "l1", order: 1, estimatedMinutes: 15 }),
    l2: lessonMeta({ id: "l2", order: 2, estimatedMinutes: 15 }),
    l3: lessonMeta({ id: "l3", order: 3, estimatedMinutes: 15 }),
    l4: lessonMeta({ id: "l4", order: 4, estimatedMinutes: 15 }),
  };

  it("returns empty when no lessons are shaky", () => {
    const lps = [
      lp({ lessonId: "l1", attemptCount: 1, hintCount: 0 }),
      lp({ lessonId: "l2", attemptCount: 2, hintCount: 1 }),
    ];
    expect(pickShakyLessons(lps, metasById)).toEqual([]);
  });

  it("skips in-progress lessons", () => {
    const lps = [
      lp({ lessonId: "l1", status: "in_progress", attemptCount: 10, hintCount: 10 }),
    ];
    expect(pickShakyLessons(lps, metasById)).toEqual([]);
  });

  it("skips lessons missing metadata", () => {
    const lps = [
      lp({ lessonId: "missing", attemptCount: 5, hintCount: 5 }),
    ];
    expect(pickShakyLessons(lps, metasById)).toEqual([]);
  });

  it("orders by score desc, then by lesson order asc", () => {
    const lps = [
      lp({ lessonId: "l3", attemptCount: 4, hintCount: 5 }), // score 2
      lp({ lessonId: "l1", attemptCount: 5, hintCount: 5, timeSpentMs: 3_000_000 }), // score 3
      lp({ lessonId: "l2", attemptCount: 4, hintCount: 5 }), // score 2
    ];
    const result = pickShakyLessons(lps, metasById);
    expect(result.map((r) => r.lessonId)).toEqual(["l1", "l2", "l3"]);
  });

  it("respects the limit", () => {
    const lps = ["l1", "l2", "l3", "l4"].map((id) =>
      lp({ lessonId: id, attemptCount: 5, hintCount: 5 }),
    );
    expect(pickShakyLessons(lps, metasById, 2)).toHaveLength(2);
  });
});

describe("formatTimeSpent", () => {
  it("returns 0m for null/undefined/zero", () => {
    expect(formatTimeSpent(null)).toBe("0m");
    expect(formatTimeSpent(undefined)).toBe("0m");
    expect(formatTimeSpent(0)).toBe("0m");
  });

  it("returns <1m for sub-minute", () => {
    expect(formatTimeSpent(30_000)).toBe("<1m");
  });

  it("rounds to nearest minute", () => {
    expect(formatTimeSpent(60_000)).toBe("1m");
    expect(formatTimeSpent(90_000)).toBe("2m");
    expect(formatTimeSpent(600_000)).toBe("10m");
  });

  it("formats hours + minutes", () => {
    expect(formatTimeSpent(3_600_000)).toBe("1h");
    expect(formatTimeSpent(5_400_000)).toBe("1h 30m");
    expect(formatTimeSpent(7_200_000)).toBe("2h");
  });

  it("rejects non-finite input", () => {
    expect(formatTimeSpent(NaN)).toBe("0m");
    expect(formatTimeSpent(-1_000)).toBe("0m");
  });
});
