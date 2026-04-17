import type { CourseProgress, LessonProgress } from "../types";

export interface LearningRepository {
  getCourseProgress(learnerId: string, courseId: string): Promise<CourseProgress | null>;
  saveCourseProgress(progress: CourseProgress): Promise<void>;
  getLessonProgress(
    learnerId: string,
    courseId: string,
    lessonId: string
  ): Promise<LessonProgress | null>;
  saveLessonProgress(progress: LessonProgress): Promise<void>;
  getAllLessonProgress(
    learnerId: string,
    courseId: string
  ): Promise<LessonProgress[]>;
}
