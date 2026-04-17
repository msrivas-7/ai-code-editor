import type { CourseProgress, LessonProgress } from "../types";
import type { LearningRepository } from "./LearningRepository";

const COURSE_KEY = (courseId: string) => `learner:v1:progress:${courseId}`;
const LESSON_KEY = (courseId: string, lessonId: string) =>
  `learner:v1:lesson:${courseId}:${lessonId}`;
const LESSON_INDEX_KEY = (courseId: string) =>
  `learner:v1:lesson-index:${courseId}`;

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or disabled */
  }
}

export class LocalLearningRepository implements LearningRepository {
  async getCourseProgress(
    _learnerId: string,
    courseId: string
  ): Promise<CourseProgress | null> {
    return load<CourseProgress>(COURSE_KEY(courseId));
  }

  async saveCourseProgress(progress: CourseProgress): Promise<void> {
    save(COURSE_KEY(progress.courseId), progress);
  }

  async getLessonProgress(
    _learnerId: string,
    courseId: string,
    lessonId: string
  ): Promise<LessonProgress | null> {
    return load<LessonProgress>(LESSON_KEY(courseId, lessonId));
  }

  async saveLessonProgress(progress: LessonProgress): Promise<void> {
    save(LESSON_KEY(progress.courseId, progress.lessonId), progress);

    const indexKey = LESSON_INDEX_KEY(progress.courseId);
    const index = load<string[]>(indexKey) ?? [];
    if (!index.includes(progress.lessonId)) {
      index.push(progress.lessonId);
      save(indexKey, index);
    }
  }

  async getAllLessonProgress(
    _learnerId: string,
    courseId: string
  ): Promise<LessonProgress[]> {
    const indexKey = LESSON_INDEX_KEY(courseId);
    const index = load<string[]>(indexKey) ?? [];
    return index
      .map((id) => load<LessonProgress>(LESSON_KEY(courseId, id)))
      .filter((p): p is LessonProgress => p !== null);
  }
}
