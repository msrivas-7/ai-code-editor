import type { Course, LessonMeta } from "../types";

export interface ConceptGraphLesson {
  lessonId: string;
  order: number;
  teaches: string[];
  uses: string[];
}

export interface ConceptGraphIssue {
  kind: "overlap" | "missing" | "duplicate-teach";
  lessonId: string;
  tag: string;
  message: string;
}

export interface ConceptGraph {
  lessons: ConceptGraphLesson[];
  baseVocabulary: string[];
  issues: ConceptGraphIssue[];
}

/**
 * Build a concept graph from a course's lessons and return validation issues.
 *
 * - `overlap`: a lesson declares the same tag in both teaches and uses.
 * - `missing`: a lesson's `uses` tag is not taught by any earlier lesson (by
 *   lessonOrder index) and is not in the course's `baseVocabulary`.
 * - `duplicate-teach`: two lessons claim to teach the same tag (warning-tier
 *   semantically — surfaced so callers can decide whether to warn or fail).
 */
export function buildConceptGraph(
  course: Pick<Course, "lessonOrder" | "baseVocabulary">,
  lessons: ReadonlyMap<string, LessonMeta>,
): ConceptGraph {
  const baseVocabulary = course.baseVocabulary ?? [];
  const ordered: ConceptGraphLesson[] = course.lessonOrder
    .map((lessonId) => {
      const meta = lessons.get(lessonId);
      if (!meta) return null;
      return {
        lessonId,
        order: meta.order,
        teaches: meta.teachesConceptTags ?? [],
        uses: meta.usesConceptTags ?? [],
      };
    })
    .filter((x): x is ConceptGraphLesson => x !== null);

  const issues: ConceptGraphIssue[] = [];
  const everTaughtBy = new Map<string, string>();
  const availableBefore = new Set<string>(baseVocabulary);

  for (const entry of ordered) {
    const teachesSet = new Set(entry.teaches);
    for (const tag of entry.uses) {
      if (teachesSet.has(tag)) {
        issues.push({
          kind: "overlap",
          lessonId: entry.lessonId,
          tag,
          message: `"${tag}" appears in both teachesConceptTags and usesConceptTags`,
        });
      }
      if (!availableBefore.has(tag)) {
        issues.push({
          kind: "missing",
          lessonId: entry.lessonId,
          tag,
          message: `"${tag}" is used but was not taught by any earlier lesson and is not in baseVocabulary`,
        });
      }
    }
    for (const tag of entry.teaches) {
      const firstTeacher = everTaughtBy.get(tag);
      if (firstTeacher && firstTeacher !== entry.lessonId) {
        issues.push({
          kind: "duplicate-teach",
          lessonId: entry.lessonId,
          tag,
          message: `"${tag}" was already taught by "${firstTeacher}"`,
        });
      } else {
        everTaughtBy.set(tag, entry.lessonId);
      }
      availableBefore.add(tag);
    }
  }

  return { lessons: ordered, baseVocabulary, issues };
}

/**
 * Concepts that have been taught strictly before `lessonId` in `course.lessonOrder`,
 * plus `baseVocabulary`. Useful for scoping the tutor's explanations.
 */
export function conceptsAvailableBefore(
  course: Pick<Course, "lessonOrder" | "baseVocabulary">,
  lessons: ReadonlyMap<string, LessonMeta>,
  lessonId: string,
): string[] {
  const available = new Set<string>(course.baseVocabulary ?? []);
  for (const id of course.lessonOrder) {
    if (id === lessonId) break;
    const meta = lessons.get(id);
    if (!meta) continue;
    for (const tag of meta.teachesConceptTags ?? []) available.add(tag);
  }
  return Array.from(available).sort();
}
