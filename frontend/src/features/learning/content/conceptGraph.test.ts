import { describe, it, expect } from "vitest";
import {
  buildConceptGraph,
  conceptsAvailableBefore,
  resolveInheritedVocabulary,
} from "./conceptGraph";
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

  // Phase 22F2A — B5: inheritsBaseVocabularyFrom
  it("treats inherited vocabulary the same as the course's own baseVocabulary", () => {
    const lessons = [meta("a", 1, ["loops"], ["print"])];
    const g = buildConceptGraph(course(["a"]), asMap(lessons), ["print"]);
    expect(g.issues.filter((i) => i.kind === "missing")).toHaveLength(0);
  });

  it("conceptsAvailableBefore includes inherited vocab", () => {
    const lessons = [meta("a", 1, ["loops"], [])];
    const avail = conceptsAvailableBefore(
      course(["a"], ["syntax"]),
      asMap(lessons),
      "a",
      ["print", "vars"],
    );
    expect(avail.sort()).toEqual(["print", "syntax", "vars"]);
  });
});

describe("resolveInheritedVocabulary", () => {
  type CourseLike = Pick<Course, "id" | "baseVocabulary"> & {
    inheritsBaseVocabularyFrom?: string[];
  };

  function asCourseMap(courses: CourseLike[]): Map<string, CourseLike> {
    const m = new Map<string, CourseLike>();
    for (const c of courses) m.set(c.id, c);
    return m;
  }

  it("returns empty when the start course has no inheritance", () => {
    const r = resolveInheritedVocabulary(
      "child",
      asCourseMap([{ id: "child", baseVocabulary: ["a", "b"] }]),
    );
    expect(r.vocabulary).toEqual([]);
    expect(r.errors).toEqual([]);
  });

  it("walks one level of inheritance", () => {
    const r = resolveInheritedVocabulary(
      "child",
      asCourseMap([
        { id: "parent", baseVocabulary: ["a", "b"] },
        { id: "child", baseVocabulary: [], inheritsBaseVocabularyFrom: ["parent"] },
      ]),
    );
    expect(r.vocabulary).toEqual(["a", "b"]);
    expect(r.errors).toEqual([]);
  });

  it("walks transitively (grandparent → parent → child)", () => {
    const r = resolveInheritedVocabulary(
      "child",
      asCourseMap([
        { id: "grand", baseVocabulary: ["a"] },
        { id: "parent", baseVocabulary: ["b"], inheritsBaseVocabularyFrom: ["grand"] },
        { id: "child", baseVocabulary: [], inheritsBaseVocabularyFrom: ["parent"] },
      ]),
    );
    expect(r.vocabulary.sort()).toEqual(["a", "b"]);
  });

  it("dedupes overlapping vocab from multiple parents", () => {
    const r = resolveInheritedVocabulary(
      "child",
      asCourseMap([
        { id: "p1", baseVocabulary: ["a", "shared"] },
        { id: "p2", baseVocabulary: ["b", "shared"] },
        { id: "child", baseVocabulary: [], inheritsBaseVocabularyFrom: ["p1", "p2"] },
      ]),
    );
    expect(r.vocabulary.sort()).toEqual(["a", "b", "shared"]);
  });

  it("surfaces unknown-parent error and skips that branch", () => {
    const r = resolveInheritedVocabulary(
      "child",
      asCourseMap([
        { id: "p1", baseVocabulary: ["a"] },
        { id: "child", baseVocabulary: [], inheritsBaseVocabularyFrom: ["p1", "ghost"] },
      ]),
    );
    expect(r.vocabulary).toEqual(["a"]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].kind).toBe("unknown-parent");
    expect(r.errors[0].parentCourseId).toBe("ghost");
  });

  it("detects a 2-node cycle (a → b → a)", () => {
    const r = resolveInheritedVocabulary(
      "a",
      asCourseMap([
        { id: "a", baseVocabulary: ["x"], inheritsBaseVocabularyFrom: ["b"] },
        { id: "b", baseVocabulary: ["y"], inheritsBaseVocabularyFrom: ["a"] },
      ]),
    );
    expect(r.errors.some((e) => e.kind === "cycle")).toBe(true);
  });
});
