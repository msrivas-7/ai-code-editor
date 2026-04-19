import { describe, it, expect } from "vitest";
import { buildConceptGraph, conceptsAvailableBefore } from "./conceptGraph";
import type { Course, LessonMeta } from "../types";

function meta(
  id: string,
  order: number,
  teaches: string[],
  uses: string[],
): LessonMeta {
  return {
    id,
    courseId: "c1",
    title: id,
    description: "",
    order,
    language: "python",
    estimatedMinutes: 10,
    objectives: ["x"],
    teachesConceptTags: teaches,
    usesConceptTags: uses,
    completionRules: [{ type: "expected_stdout", expected: "x" }],
    prerequisiteLessonIds: [],
  };
}

function course(lessonOrder: string[], baseVocabulary: string[] = []): Course {
  return {
    id: "c1",
    title: "C1",
    description: "",
    language: "python",
    lessonOrder,
    baseVocabulary,
  };
}

function asMap(lessons: LessonMeta[]): Map<string, LessonMeta> {
  const m = new Map<string, LessonMeta>();
  for (const l of lessons) m.set(l.id, l);
  return m;
}

describe("buildConceptGraph", () => {
  it("flags a lesson that uses a tag before any lesson teaches it", () => {
    const lessons = [
      meta("a", 1, ["print"], []),
      meta("b", 2, ["vars"], ["loops"]),
    ];
    const g = buildConceptGraph(course(["a", "b"]), asMap(lessons));
    const missing = g.issues.filter((i) => i.kind === "missing");
    expect(missing).toHaveLength(1);
    expect(missing[0].lessonId).toBe("b");
    expect(missing[0].tag).toBe("loops");
  });

  it("accepts tags from baseVocabulary as always-available", () => {
    const lessons = [meta("a", 1, ["print"], ["identifiers"])];
    const g = buildConceptGraph(
      course(["a"], ["identifiers"]),
      asMap(lessons),
    );
    expect(g.issues.filter((i) => i.kind === "missing")).toHaveLength(0);
  });

  it("flags overlap when a tag is both taught and used in the same lesson", () => {
    const lessons = [meta("a", 1, ["print", "vars"], ["vars"])];
    const g = buildConceptGraph(course(["a"]), asMap(lessons));
    const overlap = g.issues.filter((i) => i.kind === "overlap");
    expect(overlap).toHaveLength(1);
    expect(overlap[0].tag).toBe("vars");
  });

  it("flags duplicate-teach when two lessons teach the same tag", () => {
    const lessons = [
      meta("a", 1, ["print"], []),
      meta("b", 2, ["print"], []),
    ];
    const g = buildConceptGraph(course(["a", "b"]), asMap(lessons));
    const dup = g.issues.filter((i) => i.kind === "duplicate-teach");
    expect(dup).toHaveLength(1);
    expect(dup[0].lessonId).toBe("b");
    expect(dup[0].tag).toBe("print");
  });

  it("treats earlier-taught tags as available to later lessons", () => {
    const lessons = [
      meta("a", 1, ["print"], []),
      meta("b", 2, ["vars"], ["print"]),
      meta("c", 3, ["loops"], ["print", "vars"]),
    ];
    const g = buildConceptGraph(course(["a", "b", "c"]), asMap(lessons));
    expect(g.issues).toHaveLength(0);
  });

  it("conceptsAvailableBefore does not include the target lesson's own teaches", () => {
    const lessons = [
      meta("a", 1, ["print"], []),
      meta("b", 2, ["vars"], ["print"]),
      meta("c", 3, ["loops"], ["print", "vars"]),
    ];
    const avail = conceptsAvailableBefore(
      course(["a", "b", "c"], ["syntax"]),
      asMap(lessons),
      "c",
    );
    expect(avail.sort()).toEqual(["print", "syntax", "vars"]);
  });
});
